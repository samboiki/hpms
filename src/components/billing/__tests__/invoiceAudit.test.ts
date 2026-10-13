import { describe, expect, it } from 'vitest';
import { describeAuditEvents, formatAuditTime, type InvoiceAuditEvent } from '../invoiceAudit';

const line = (overrides: Record<string, unknown> = {}) => ({
  code: '8101',
  service_date: '2026-10-07',
  practitioner_id: 'doc-1',
  tooth_number: null,
  quantity: 1,
  unit_price: 373.9,
  discount_amount: 0,
  total_price: 373.9,
  medical_aid_covered: 373.9,
  patient_portion: 0,
  description: 'Oral examination',
  notes: '',
  ...overrides
});

const event = (overrides: Partial<InvoiceAuditEvent>): InvoiceAuditEvent => ({
  id: Math.random().toString(36).slice(2),
  action: 'line_added',
  line_code: '8101',
  changed_by: 'reception-1',
  changed_at: '2026-10-07T08:30:00.123+00:00',
  ...overrides
});

const names = { 'doc-1': 'Dr. A Tester', 'nurse-1': 'Sister B Helper' };

describe('who changed an invoice, in plain words', () => {
  // Saving a visit replaces its lines: an unchanged save must not flood the history with "removed / added"
  it('leaves out lines that were saved again without a change', () => {
    const events = [
      event({ action: 'line_removed', line_before: line() }),
      event({ action: 'line_added', line_after: line() })
    ];
    expect(describeAuditEvents(events, names)).toEqual([]);
  });

  // D23: a corrected practitioner or date is recorded with who and when
  it('describes a line whose date and practitioner changed in one save', () => {
    const events = [
      event({ id: 1, action: 'line_removed', line_before: line() }),
      event({ id: 2, action: 'line_added', line_after: line({ service_date: '2026-10-06', practitioner_id: 'nurse-1' }) })
    ];
    expect(describeAuditEvents(events, names)).toEqual([
      { key: '2', text: 'Line 8101: date 7 Oct 2026 to 6 Oct 2026; practitioner Dr. A Tester to Sister B Helper.', by: 'reception-1', at: '2026-10-07T08:30:00.123+00:00' }
    ]);
  });

  it('describes a changed note and practitioner on the invoice', () => {
    const entries = describeAuditEvents(
      [
        event({ id: 3, action: 'invoice_changed', field: 'notes', old_value: 'Paid cash', new_value: 'Paid by card', line_code: null }),
        event({ id: 4, action: 'invoice_changed', field: 'practitioner_id', old_value: 'doc-1', new_value: 'nurse-1', line_code: null })
      ],
      names
    );
    expect(entries.map(entry => entry.text)).toEqual([
      'Treating practitioner changed from Dr. A Tester to Sister B Helper.',
      'Note changed from "Paid cash" to "Paid by card".'
    ]);
  });

  it('describes lines added or removed with their amounts', () => {
    const entries = describeAuditEvents([
      event({ id: 5, action: 'line_added', line_code: '8109', line_after: line({ code: '8109', total_price: 25 }) }),
      event({ id: 6, action: 'line_removed', line_code: '8341', line_before: line({ code: '8341', total_price: 500.1 }), changed_at: '2026-10-06T08:00:00+00:00' })
    ]);
    expect(entries.map(entry => entry.text)).toEqual(['Line 8109 added (N$ 25.00).', 'Line 8341 removed (N$ 500.10).']);
  });

  // Two people saving at once are two different changes, never paired up
  it("pairs a removed and an added line only within one person's save", () => {
    const entries = describeAuditEvents([
      event({ id: 7, action: 'line_removed', line_before: line(), changed_by: 'a' }),
      event({ id: 8, action: 'line_added', line_after: line(), changed_by: 'b' })
    ]);
    expect(entries).toHaveLength(2);
  });

  it('shows money and quantities as amounts, and says when a value was empty', () => {
    const [entry] = describeAuditEvents([
      event({ id: 9, action: 'line_changed', line_before: line({ discount_amount: 0, notes: '' }), line_after: line({ discount_amount: 50, total_price: 323.9, notes: 'Staff' }) })
    ]);
    expect(entry.text).toBe('Line 8101: discount N$ 0.00 to N$ 50.00; amount N$ 373.90 to N$ 323.90; note nothing to "Staff".');
  });

  it('writes the time in Windhoek', () => {
    expect(formatAuditTime('2026-10-07T08:30:00Z')).toBe('7 Oct 2026, 10:30');
    expect(formatAuditTime('nonsense')).toBe('-');
  });

  // Parity D23: who corrected a claim line the fund already had, what changed and which batch took it to the fund
  // again; the fund keeps both claims, so the invoice must say why there are two
  it('says a claim line was corrected and sent again, and what changed from what the fund received', () => {
    const [entry] = describeAuditEvents([
      event({
        id: 21,
        action: 'claim_corrected',
        line_code: '0190',
        new_value: 'Wrong date on the visit',
        line_before: { batch_number: 5, service_date: '2026-10-07', icd10: ['J06.9'], practitioner_id: 'doc-1', authorisation_number: '', patient_name: 'TESTA' },
        line_after: { batch_number: 9, line_number: 3, flag: 'R', service_date: '2026-10-06', icd10: ['J02.9'], authorisation_number: 'A1' }
      })
    ], names);
    expect(entry.text).toBe(
      'Claim for line 0190 corrected and sent again in batch 9 (resubmission R): date 7 Oct 2026 to 6 Oct 2026; ICD-10 J06.9 to J02.9; ' +
        'authorisation nothing to A1. Note: "Wrong date on the visit".'
    );
  });

  it('says a claim line the fund had not paid was sent again', () => {
    const [entry] = describeAuditEvents([
      event({ id: 22, action: 'claim_resent', line_code: '0190', line_before: { batch_number: 5 }, line_after: { batch_number: 9, flag: 'R' } })
    ]);
    expect(entry.text).toBe('Claim for line 0190 sent again in batch 9 (resubmission R): the fund had not paid it since batch 5.');
  });
});
