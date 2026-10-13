/** Finance > Reports > Who did what (parity R17, Q8). Invented ids, numbers and amounts only. */
import { describe, expect, it } from 'vitest';
import { NOT_RECORDED, activityEntries, activityTable, windhoekTime, type RawActivityRow } from '../userActivity';

const row = (overrides: Partial<RawActivityRow>): RawActivityRow => ({
  occurred_at: '2026-10-05T08:00:00+00:00', area: 'invoice', action: 'invoice_raised', invoice_id: 'i1', receipt_id: null, patient_id: 'p1',
  batch_id: null, record_table: 'invoices_enhanced', record_id: 'i1', document: 'INV-1', amount: '450.00', details: {}, ...overrides
});

describe('who did what (R17, Q8)', () => {
  const entries = activityEntries([
    row({}),
    row({ occurred_at: '2026-10-05T09:00:00+00:00', action: 'invoice_changed', details: { id: 1, field: 'due_date', old_value: '2026-10-31', new_value: '2026-11-30' } }),
    row({ occurred_at: '2026-10-05T10:00:00+00:00', area: 'payment', action: 'receipt_created', invoice_id: null, receipt_id: 'r1', document: 'RC-1', amount: '200.00', details: { method: 'cash' } }),
    row({ occurred_at: '2026-10-05T10:00:05+00:00', area: 'payment', action: 'adjustment_created', invoice_id: 'i1', document: 'CN-1', amount: '50.00', details: { kind: 'credit_note', invoice_number: 'INV-1' } }),
    row({ occurred_at: '2026-10-06T07:00:00+00:00', area: 'patient_file', action: 'update', invoice_id: null, record_table: 'patients', record_id: 'p1', document: null, amount: null }),
    row({ occurred_at: '2026-10-06T08:00:00+00:00', area: 'claims', action: 'batch_sent', invoice_id: null, patient_id: null, batch_id: 'b1', document: '12', amount: '900.00', details: { fund: 'MAG1', claims: 3 } }),
    row({ occurred_at: '2026-10-06T09:00:00+00:00', area: 'claims', action: 'rejection_written_off', document: '0190', details: { fund: 'NMC1', claim_line_id: 'c1' } }),
    row({ occurred_at: '2026-10-07T09:00:00+00:00', area: 'export', action: 'report_csv', invoice_id: null, patient_id: null, document: 'cash_by_practitioner', amount: null, details: { rows: 12, from: '2026-10-01', to: '2026-10-07' } }),
    row({ area: 'something_new' })
  ], { cash_by_practitioner: 'Cash flow per practitioner' });

  it('words each action plainly, in the order it was done, leaving out what it cannot read', () => {
    expect(entries.map(entry => entry.text)).toEqual([
      'Raised invoice INV-1 (N$ 450.00)',
      'Invoice INV-1: Due date changed from 31 Oct 2026 to 30 Nov 2026.',
      'Recorded payment RC-1 (N$ 200.00, Cash)',
      'Credit note CN-1 on invoice INV-1 (N$ 50.00)',
      'Patient file changed',
      'Sent claim batch 12 to PSEMAS (3 claims, N$ 900.00)',
      'Rejection of code 0190 (Namibia Medical Care (NMC)): written off',
      'Downloaded Cash flow per practitioner (12 rows, 1 Oct 2026 to 7 Oct 2026)'
    ]);
  });

  it('opens what each action was about: the invoice, the payment, the patient\'s file, the batch, the claim line', () => {
    expect(entries.map(entry => entry.target?.kind ?? null)).toEqual(['invoice', 'invoice', 'receipt', 'invoice', 'patient', 'batch', 'claim_line', null]);
  });

  it('says on the report what nobody records, so silence is not read as "nothing happened"', () => {
    const table = activityTable(entries, 'Staff One', '1-7 Oct 2026', { p1: 'Patient One' }).table;
    for (const sentence of NOT_RECORDED) expect(table.notes).toContain(sentence);
    // Opening a file is recorded now; what still is not (seeing a patient in lists, a missing sign-out) is said plainly
    expect(NOT_RECORDED.join(' ')).toMatch(/Seeing a patient in a list, the diary, search or the dashboard/);
    expect(NOT_RECORDED.join(' ')).toMatch(/leaves no sign-out/);
    expect(table.rows[0][0]).toBe('5 Oct 2026 10:00'); // Windhoek time (UTC+2)
  });

  it('lists files opened, sign-ins and sign-outs (Q8): which file and from which screen, never what it showed', () => {
    const access = activityEntries([
      row({ occurred_at: '2026-10-13T06:00:00+00:00', area: 'access', action: 'signed_in', invoice_id: null, patient_id: null, record_table: 'record_access_log', record_id: null, document: 'sign_in', amount: null }),
      row({ occurred_at: '2026-10-13T06:05:00+00:00', area: 'access', action: 'patient_opened', invoice_id: null, patient_id: 'p1', record_table: 'record_access_log', record_id: null, document: 'patient_file', amount: null }),
      row({ occurred_at: '2026-10-13T06:20:00+00:00', area: 'access', action: 'patient_opened', invoice_id: null, patient_id: 'p2', record_table: 'record_access_log', record_id: null, document: 'visit_screen', amount: null }),
      row({ occurred_at: '2026-10-13T06:25:00+00:00', area: 'access', action: 'record_exported', invoice_id: null, patient_id: 'p2', record_table: 'record_access_log', record_id: null, document: 'patient_file', amount: null }),
      row({ occurred_at: '2026-10-13T15:00:00+00:00', area: 'access', action: 'signed_out', invoice_id: null, patient_id: null, record_table: 'record_access_log', record_id: null, document: 'app', amount: null })
    ]);
    expect(access.map(entry => entry.text)).toEqual([
      'Signed in',
      "Opened the patient's file (from the patient file)",
      "Opened the patient's file (from a visit)",
      // A whole record leaving OneHealth is named as such (the patient file's record export)
      "Exported the patient's record",
      'Signed out'
    ]);
    // An opened or exported file links back to that patient's file; a sign-in or sign-out opens nothing
    expect(access.map(entry => entry.target)).toEqual([null, { kind: 'patient', id: 'p1' }, { kind: 'patient', id: 'p2' }, { kind: 'patient', id: 'p2' }, null]);
    const table = activityTable(access, 'Staff One', '13 Oct 2026', { p1: 'Patient One', p2: 'Patient Two' }).table;
    expect(table.rows.map(cells => [cells[1], cells[3]])).toEqual([
      ['Files opened or exported, sign-ins and sign-outs', ''],
      ['Files opened or exported, sign-ins and sign-outs', 'Patient One'],
      ['Files opened or exported, sign-ins and sign-outs', 'Patient Two'],
      ['Files opened or exported, sign-ins and sign-outs', 'Patient Two'],
      ['Files opened or exported, sign-ins and sign-outs', '']
    ]);
  });

  it('puts a late-night action on the Windhoek day it happened, not the UTC day', () => {
    expect(windhoekTime('2026-10-05T23:30:00+00:00')).toBe('6 Oct 2026 01:30');
  });
});
