/**
 * The promotion a line's discount came from and the prepaid package a line was paid from are saved with the line
 * (proposals/2026-10-13-billing-extras.sql), so Discounts given can name the promotion and the package counts the
 * session; before the database has the columns such a line is refused rather than saved without them.
 */
import { describe, expect, it } from 'vitest';
import { buildInvoiceLineRow, type InvoiceLineSource } from '../invoiceLineRow';
import { lineExtrasFromRow } from '../lineExtras';

const line = (overrides: Partial<InvoiceLineSource> = {}): InvoiceLineSource => ({
  tariffId: 't1', code: '8261', description: 'Invented whitening', unitPrice: 1200, quantity: 1, ...overrides
});

const context = { invoiceId: 'inv-1', hasMedicalAid: false, lineDetails: true, lineExtras: true };

describe('a line keeps its promotion and its package', () => {
  it("names the promotion of a private patient's discounted line", () => {
    const row = buildInvoiceLineRow(line({ discountAmount: 120, promotionId: 'promo-1' }), context);
    expect(row).toMatchObject({ discount_amount: 120, total_price: 1080, promotion_id: 'promo-1', package_id: null });
  });

  it('names no promotion on a line without a discount (the report would credit it for nothing)', () => {
    expect(buildInvoiceLineRow(line({ promotionId: 'promo-1' }), context).promotion_id).toBeNull();
  });

  it('keeps the package of a N$ 0.00 line paid from it', () => {
    const row = buildInvoiceLineRow(line({ unitPrice: 0, packageId: 'pack-1', paidBy: 'patient' }), { ...context, hasMedicalAid: true, linePortions: true });
    expect(row).toMatchObject({ total_price: 0, package_id: 'pack-1', medical_aid_covered: 0, paid_by: 'patient' });
  });

  it('refuses a promoted or package line before the database keeps them, instead of losing them', () => {
    expect(() => buildInvoiceLineRow(line({ unitPrice: 0, packageId: 'pack-1' }), { ...context, lineExtras: false })).toThrow(/billing extras update/);
    expect(() => buildInvoiceLineRow(line(), { ...context, lineExtras: false })).not.toThrow();
  });

  it('reads them back from a saved line, so saving the visit again keeps them', () => {
    expect(lineExtrasFromRow({ promotion_id: 'promo-1', package_id: null })).toEqual({ promotionId: 'promo-1' });
    expect(lineExtrasFromRow({})).toEqual({});
  });
});
