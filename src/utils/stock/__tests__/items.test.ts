import { describe, expect, it } from 'vitest';
import { billingCodeFor, draftFromItem, normalizeNappi, normalizeStockItem, validateItemDraft } from '../items';
import { normalizeMovement, normalizeSettings } from '../stockRows';

const PRACTICE = '11111111-2222-4333-8444-555555555555';

describe('stock item form', () => {
  it('accepts a medicine with its NAPPI code and builds what the database saves', () => {
    const draft = { ...draftFromItem(null), name: 'Example tablets 10 mg', nappiCode: '700 123-001', unitCost: '1.25', minimum: '20', maximum: '100', packSize: '30', openingQuantity: '60' };
    const result = validateItemDraft(draft, { practiceId: PRACTICE, costLocked: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toMatchObject({ nappi_code: '700123001', unit_cost: 1.25, reorder_level: 20, max_level: 100, pack_size: 30, opening_quantity: 60 });
  });

  it('does not send a cost for an item already in the ledger: its cost follows the deliveries', () => {
    const draft = { ...draftFromItem(null), id: 'item-1', name: 'Gloves', category: 'disposables', unitCost: '9.99' };
    const result = validateItemDraft(draft, { practiceId: PRACTICE, costLocked: true });
    expect(result.ok && 'unit_cost' in result.payload).toBe(false);
  });

  it('explains each problem next to its field instead of refusing the whole form', () => {
    const draft = { ...draftFromItem(null), name: '', nappiCode: '12', minimum: '10', maximum: '5', sellingPrice: '12.345' };
    const result = validateItemDraft(draft, { practiceId: PRACTICE, costLocked: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['maximum', 'name', 'nappiCode', 'sellingPrice']);
  });
});

describe('billing code of an item', () => {
  it('bills a medicine under its NAPPI code, which the fund needs on the claim', () => {
    expect(billingCodeFor({ nappiCode: '700123001', tariffCode: '0201', sku: 'AMOX' })).toBe('700123001');
  });

  it('bills other stock under its linked tariff code, else its own product code', () => {
    expect(billingCodeFor({ nappiCode: null, tariffCode: '15052', sku: 'FR-1' })).toBe('15052');
    expect(billingCodeFor({ nappiCode: null, tariffCode: null, sku: 'fr 1' })).toBe('FR1');
    expect(billingCodeFor({ nappiCode: null, tariffCode: null, sku: null })).toBe('STOCK');
  });

  it('stores NAPPI codes without spaces or dashes, so the same code is always found', () => {
    expect(normalizeNappi(' 700 123-001 ')).toBe('700123001');
    expect(normalizeNappi('')).toBeNull();
  });
});

describe('rows from the database', () => {
  it('reads numeric columns sent as strings into cents', () => {
    const item = normalizeStockItem({ id: 'i', practice_id: PRACTICE, name: 'Item', unit_cost: '2.83', selling_price: null, vat_rate: '0', quantity: 12 });
    expect(item.unitCostCents).toBe(283);
    expect(item.sellingPriceCents).toBeNull();
    expect(item.vatRate).toBe(0);
  });

  it('leaves out a movement of a kind it does not know, rather than counting it wrongly', () => {
    expect(normalizeMovement({ id: 'm', item_id: 'i', kind: 'teleported', quantity: 1, value: '0', occurred_on: '2026-10-08', created_at: '2026-10-08T00:00:00Z' })).toBeNull();
    expect(normalizeMovement({ id: 'm', item_id: 'i', kind: 'sold', quantity: '-3', value: '-8.50', occurred_on: '2026-10-08', created_at: '2026-10-08T00:00:00Z' })?.valueCents).toBe(-850);
  });

  it('treats a practice without settings as not dispensing, selling at cost', () => {
    const settings = normalizeSettings(null);
    expect(settings.dispensingEnabled).toBe(false);
    expect(settings.priceRule.bands).toHaveLength(1);
  });

  it('flags a stored price rule it cannot read, so an admin is asked to save it again', () => {
    expect(normalizeSettings({ dispensing_enabled: true, price_rule: { bands: 'nonsense' } }).priceRuleReadable).toBe(false);
  });
});
