/**
 * Discounts given lists a promotion's discounts under the promotion's name (parity D18), in the same report as every
 * other discount, so the practice sees in one place what each promotion cost it. Invented figures.
 */
import { describe, expect, it } from 'vitest';
import { LINE_DISCOUNT_REASON, discountFromLine, discountListTable, groupDiscounts, reasonKey, reasonKeyLabel, type RawLineDiscountRow } from '../discountListing';

const line = (overrides: Partial<RawLineDiscountRow> = {}): RawLineDiscountRow => ({
  id: 'l1', code: '8261', discount_amount: '120.00', practitioner_id: null, promotion_id: 'promo-1',
  invoice: { id: 'inv-1', invoice_number: 'INV-0001', patient_id: 'p1', practitioner_id: 'doc-1', payment_status: 'pending', issue_date: '2026-10-13' },
  ...overrides
});

const NAMES = { 'promo-1': 'Spring smile' };

describe("a promotion's discounts in Discounts given", () => {
  it('names the promotion as the reason, instead of "no reason was asked"', () => {
    const item = discountFromLine(line(), NAMES);
    expect(item).toMatchObject({ source: 'line', promotionId: 'promo-1', reasonText: 'Promotion: Spring smile', cents: 12_000, code: '8261' });
  });

  it('keeps a discount typed by hand as a line discount', () => {
    expect(discountFromLine(line({ promotion_id: null }), NAMES)?.reasonText).toBe(LINE_DISCOUNT_REASON);
    expect(discountFromLine(line({ promotion_id: undefined }))?.reasonText).toBe(LINE_DISCOUNT_REASON);
  });

  it('groups each promotion on its own row of "Per reason", apart from typed line discounts', () => {
    const items = [
      discountFromLine(line(), NAMES),
      discountFromLine(line({ id: 'l2', discount_amount: '30.00' }), NAMES),
      discountFromLine(line({ id: 'l3', promotion_id: null, discount_amount: '10.00' }), NAMES)
    ].filter((item): item is NonNullable<typeof item> => item !== null);
    const groups = groupDiscounts(items, reasonKey);
    expect(groups.map(group => [reasonKeyLabel(group.key, NAMES), group.count, group.cents])).toEqual([
      ['Promotion: Spring smile', 2, 15_000],
      [LINE_DISCOUNT_REASON, 1, 1_000]
    ]);
    const list = discountListTable(items, 'Oct 2026', {}, { p1: 'Pat Testing' });
    expect(list.table.rows.map(row => row[5])).toContain('Promotion: Spring smile');
  });

  it('says so when the promotion is no longer on the list, rather than dropping the discount', () => {
    expect(reasonKeyLabel('promotion:gone', NAMES)).toBe('Promotion: no longer on the list');
  });
});
