import { describe, it, expect } from 'vitest';
import { batchTotalsFromLines, planHeaderTotals, type DetailAmountRow } from '../batchTotals';

const line = (invoice_number: string, service_amount: number | string, discount_amount: number | string | null = 0): DetailAmountRow => ({
  invoice_number,
  service_amount,
  discount_amount
});

const before = [line('INV1', 100), line('INV1', 50), line('INV2', 30)];
const after = [line('INV2', 30)];

// Business rule: header totals follow the database trigger's basis - distinct invoices and the sum
// of (service amount - discount) - computed in whole cents.
describe('batchTotalsFromLines', () => {
  it('counts distinct invoices and sums amount minus discount', () => {
    expect(batchTotalsFromLines(before)).toEqual({ totalInvoices: 2, totalAmountCents: 18000 });
    expect(batchTotalsFromLines([line('A', '135.40'), line('A', 34.4, '4.40'), line(' ', 10)])).toEqual({ totalInvoices: 1, totalAmountCents: 17540 });
    expect(batchTotalsFromLines([])).toEqual({ totalInvoices: 0, totalAmountCents: 0 });
  });
});

// Business rule: after an invoice is removed, the header totals are only written when their basis is
// proven (they matched the lines before the change) and the database did not already update them.
// When the basis is unknown nothing is written - a wrong total is worse than a stale one, because
// the claim file always uses the lines.
describe('planHeaderTotals', () => {
  it('does nothing when the database trigger already updated the totals', () => {
    expect(
      planHeaderTotals({
        storedBefore: { total_invoices: 2, total_amount: 180 },
        linesBefore: before,
        storedAfter: { total_invoices: 1, total_amount: 30 },
        linesAfter: after
      })
    ).toEqual({ action: 'none' });
  });

  it('writes the new totals when the basis is proven and they are stale', () => {
    expect(
      planHeaderTotals({
        storedBefore: { total_invoices: 2, total_amount: '180.00' },
        linesBefore: before,
        storedAfter: { total_invoices: 2, total_amount: 180 },
        linesAfter: after
      })
    ).toEqual({ action: 'update', totalInvoices: 1, totalAmount: 30 });
  });

  it.each([
    { label: 'no stored totals', storedBefore: { total_invoices: null, total_amount: null } },
    { label: 'a different invoice count', storedBefore: { total_invoices: 3, total_amount: 180 } },
    { label: 'a different amount', storedBefore: { total_invoices: 2, total_amount: 179.99 } },
    { label: 'an unreadable amount', storedBefore: { total_invoices: 2, total_amount: 'n/a' } }
  ])('leaves the totals alone when the stored totals had $label', ({ storedBefore }) => {
    expect(
      planHeaderTotals({ storedBefore, linesBefore: before, storedAfter: storedBefore, linesAfter: after })
    ).toEqual({ action: 'unknown_basis' });
  });

  it('handles removing the last invoice (empty batch)', () => {
    expect(
      planHeaderTotals({
        storedBefore: { total_invoices: 1, total_amount: 30 },
        linesBefore: after,
        storedAfter: { total_invoices: 1, total_amount: 30 },
        linesAfter: []
      })
    ).toEqual({ action: 'update', totalInvoices: 0, totalAmount: 0 });
  });
});
