/**
 * Discounts given (parity R3): per period, practitioner and reason, with every row opening its invoice, so a practice
 * can see what it gave away and why. Invented figures.
 */
import { describe, expect, it } from 'vitest';
import type { ArAdjustment } from '../../../../services/ledgerService';
import {
  LINE_DISCOUNT_REASON,
  NO_PRACTITIONER,
  discountFromAdjustment,
  discountFromLine,
  discountGroupTable,
  discountListTable,
  groupDiscounts,
  practitionerKey,
  reasonKey,
  reasonKeyLabel,
  type RawLineDiscountRow
} from '../discountListing';

const adjustment = (overrides: Partial<ArAdjustment> = {}): ArAdjustment => ({
  id: 'd1', number: 'DS-000001', kind: 'discount', invoiceId: 'inv-1', receiptId: null, patientId: 'p1', portion: 'patient', amountCents: 3000,
  method: null, reasonCode: 'pensioner', reason: 'Pensioner', approvedBy: 'doc-1', effectiveOn: '2026-10-05', createdBy: 'doc-1',
  createdAt: '2026-10-05T09:00:00+02:00', reversal: null, percent: 10, ...overrides
});

const line = (overrides: Partial<RawLineDiscountRow> = {}): RawLineDiscountRow => ({
  id: 'l1', code: '0190', discount_amount: '50.00', practitioner_id: null,
  invoice: { id: 'inv-2', invoice_number: 'INV-0002', patient_id: 'p2', practitioner_id: 'doc-2', payment_status: 'pending', issue_date: '2026-10-06' },
  ...overrides
});

const invoices = { 'inv-1': { id: 'inv-1', invoiceNumber: 'INV-0001', patientId: 'p1', practitionerId: 'doc-1' } };

describe('the discounts of a period', () => {
  it("counts an invoice discount for the invoice's practitioner, with its reason, percentage and who gave it", () => {
    expect(discountFromAdjustment(adjustment(), invoices['inv-1'])).toMatchObject({
      source: 'invoice', number: 'DS-000001', invoiceNumber: 'INV-0001', practitionerId: 'doc-1', reasonCode: 'pensioner', reasonText: 'Pensioner', percent: 10, givenBy: 'doc-1', cents: 3000
    });
  });

  it('leaves out a discount that was taken back, because it was not given in the end', () => {
    expect(discountFromAdjustment(adjustment({ reversal: { at: '2026-10-06T08:00:00Z', by: 'admin', reason: 'Wrong invoice' } }), invoices['inv-1'])).toBeNull();
    expect(discountFromAdjustment(adjustment({ kind: 'credit_note' }), invoices['inv-1'])).toBeNull();
  });

  it("lists a private patient's line discount too, for the line's practitioner else the invoice's, saying no reason was asked", () => {
    expect(discountFromLine(line())).toMatchObject({ source: 'line', number: null, practitionerId: 'doc-2', reasonText: LINE_DISCOUNT_REASON, cents: 5000, dateKey: '2026-10-06' });
    expect(discountFromLine(line({ practitioner_id: 'doc-3' }))?.practitionerId).toBe('doc-3');
    expect(discountFromLine(line({ invoice: { ...line().invoice!, payment_status: 'cancelled' } }))).toBeNull();
    expect(discountFromLine(line({ discount_amount: 0 }))).toBeNull();
  });

  it('adds up per practitioner and per reason to the same total as the list, the largest first', () => {
    const items = [
      discountFromAdjustment(adjustment(), invoices['inv-1']),
      discountFromAdjustment(adjustment({ id: 'd2', number: 'DS-000002', amountCents: 10000, reasonCode: 'staff', reason: 'Staff member or their family' }), invoices['inv-1']),
      discountFromLine(line()),
      discountFromAdjustment(adjustment({ id: 'd3', number: 'DS-000003', amountCents: 2000 }), undefined)
    ].filter((item): item is NonNullable<typeof item> => item !== null);
    const byPractitioner = groupDiscounts(items, practitionerKey);
    expect(byPractitioner).toEqual([
      { key: 'doc-1', count: 2, cents: 13000 },
      { key: 'doc-2', count: 1, cents: 5000 },
      { key: NO_PRACTITIONER, count: 1, cents: 2000 }
    ]);
    const byReason = groupDiscounts(items, reasonKey);
    expect(byReason.map(group => [reasonKeyLabel(group.key), group.cents])).toEqual([
      ['Staff member or their family', 10000],
      [LINE_DISCOUNT_REASON, 5000],
      ['Pensioner', 5000]
    ]);
    const list = discountListTable(items, 'Oct 2026', { 'doc-1': 'Dr One Testing' }, { p1: 'Pat Testing', p2: 'Sam Testing' });
    const totals = list.table.totals ?? [];
    expect(totals[totals.length - 1]).toBe(200);
    expect(list.targets.every(target => target?.kind === 'invoice')).toBe(true);
    const grouped = discountGroupTable({ groups: byPractitioner, title: 'Discounts given per practitioner', header: 'Practitioner', label: key => key, periodLabel: 'Oct 2026' });
    expect(grouped.table.totals).toEqual(['Total', 4, 200]);
  });
});
