import { describe, expect, it } from 'vitest';
import { findInvoiceLineProblems } from '../../../services/invoiceService';
import {
  DEFAULT_PRICE_RULE,
  bandFor,
  describeBand,
  draftsFromPriceRule,
  priceRuleFromDrafts,
  priceRuleFromJson,
  priceRuleToJson,
  priceStockLine,
  validatePriceRule,
  type PriceRule
} from '../pricing';
import { stockBillingLine } from '../stockLine';

// A practice's own rule (invented figures): small lines pay a fee, bigger ones a lower markup
const RULE: PriceRule = {
  bands: [
    { upToCents: 10_000, markupPercent: 50, feeCents: 1_000 },
    { upToCents: null, markupPercent: 25, feeCents: 2_000 }
  ]
};

describe('priceStockLine: the practice\'s own rule, never a built-in formula', () => {
  it('adds the markup and the dispensing fee of the band, then VAT, exactly as the practice set them', () => {
    // 30 capsules costing N$ 15.00: + 50% (7.50) + N$ 10.00 fee = 32.50; VAT 15% = 4.88 (half up); 37.38 in all
    const price = priceStockLine({ quantity: 30, lineCostCents: 1_500, vatRate: 15, rule: RULE, fixedUnitPriceCents: null })!;
    expect(price.source).toBe('rule');
    expect(price.markupCents).toBe(750);
    expect(price.feeCents).toBe(1_000);
    expect(price.exclVatCents).toBe(3_250);
    expect(price.vatCents).toBe(488);
    expect(price.ruleTotalCents).toBe(3_738);
  });

  it('spreads the fee over the units so the invoice line stays "unit price x quantity" (the invoice check refuses anything else)', () => {
    const price = priceStockLine({ quantity: 30, lineCostCents: 1_500, vatRate: 15, rule: RULE, fixedUnitPriceCents: null })!;
    expect(price.unitPriceCents).toBe(125);
    expect(price.totalCents).toBe(125 * 30);
    const line = stockBillingLine({
      item: { id: '2f1e8c7a-1b2c-4d3e-8f90-a1b2c3d4e5f6', name: 'Example capsules 500 mg', nappiCode: '700000001', tariffCode: null, sku: null, category: 'medications' },
      quantity: 30,
      price,
      hasMedicalAid: false,
      lineId: 'line-1'
    });
    expect(findInvoiceLineProblems([line], { today: '2026-10-08' })).toEqual([]);
  });

  it('picks the band by the cost of the whole line, so a large quantity moves to the next band', () => {
    expect(bandFor(RULE, 10_000)).toBe(RULE.bands[0]);
    expect(bandFor(RULE, 10_001)).toBe(RULE.bands[1]);
  });

  it('uses the item\'s fixed price when it has one (frames, over-the-counter items), whatever the rule says', () => {
    const price = priceStockLine({ quantity: 2, lineCostCents: 50_000, vatRate: 15, rule: RULE, fixedUnitPriceCents: 89_900 })!;
    expect(price.source).toBe('fixed');
    expect(price.totalCents).toBe(179_800);
    expect(price.vatCents + price.exclVatCents).toBe(179_800);
  });

  it('adds no VAT on a zero-rated item', () => {
    const price = priceStockLine({ quantity: 1, lineCostCents: 1_000, vatRate: 0, rule: RULE, fixedUnitPriceCents: null })!;
    expect(price.vatCents).toBe(0);
    expect(price.totalCents).toBe(1_000 + 500 + 1_000);
  });

  it('refuses to price an item whose cost is unknown, rather than selling it for the fee alone', () => {
    expect(priceStockLine({ quantity: 1, lineCostCents: null, vatRate: 15, rule: RULE, fixedUnitPriceCents: null })).toBeNull();
    expect(priceStockLine({ quantity: 1, lineCostCents: 0, vatRate: 15, rule: RULE, fixedUnitPriceCents: null })).toBeNull();
  });

  it('sells at cost plus VAT until the practice sets its rule (no made-up markup)', () => {
    const price = priceStockLine({ quantity: 10, lineCostCents: 2_000, vatRate: 15, rule: DEFAULT_PRICE_RULE, fixedUnitPriceCents: null })!;
    expect(price.exclVatCents).toBe(2_000);
    expect(price.totalCents).toBe(2_300);
  });
});

describe('validatePriceRule: the same checks the database makes when the rule is saved', () => {
  it('accepts a rule with rising limits and an open last band', () => {
    expect(validatePriceRule(RULE)).toBeNull();
  });

  it('refuses bands that do not rise, so every cost has exactly one band', () => {
    const falling: PriceRule = { bands: [{ upToCents: 10_000, markupPercent: 1, feeCents: 0 }, { upToCents: 5_000, markupPercent: 1, feeCents: 0 }, { upToCents: null, markupPercent: 0, feeCents: 0 }] };
    expect(validatePriceRule(falling)).toMatch(/higher than the one before/);
  });

  it('refuses a limit on the last band, which would leave larger costs without a price', () => {
    expect(validatePriceRule({ bands: [{ upToCents: 10_000, markupPercent: 10, feeCents: 0 }] })).toMatch(/no upper limit/);
  });

  it('refuses a markup over 1000% or with more than 2 decimals (a typing slip, not a price)', () => {
    expect(validatePriceRule({ bands: [{ upToCents: null, markupPercent: 1500, feeCents: 0 }] })).toMatch(/markup/);
    expect(validatePriceRule({ bands: [{ upToCents: null, markupPercent: 12.345, feeCents: 0 }] })).toMatch(/markup/);
  });
});

describe('price rules as stored', () => {
  it('reads back what it writes, in N$ as the database keeps them', () => {
    const json = priceRuleToJson(RULE);
    expect(json.bands[0]).toEqual({ up_to: 100, markup_percent: 50, fee: 10 });
    expect(priceRuleFromJson(json)).toEqual(RULE);
  });

  it('gives null for a stored rule it cannot use, so the screen says so instead of pricing with it', () => {
    expect(priceRuleFromJson({ bands: [{ up_to: 'x', markup_percent: 1, fee: 0 }] })).toBeNull();
    expect(priceRuleFromJson(null)).toBeNull();
  });

  it('describes each band in words for the settings screen', () => {
    expect(describeBand(RULE, 0)).toBe('Up to N$ 100.00: cost + 50% + N$ 10.00 fee');
    expect(describeBand(RULE, 1)).toBe('Above N$ 100.00: cost + 25% + N$ 20.00 fee');
  });
});

describe('the price rule as the admin types it', () => {
  it('reads N$ amounts with commas and a % sign, and a blank fee as no fee, so the rule is what was meant', () => {
    const result = priceRuleFromDrafts([
      { upTo: 'N$ 1,000', markup: '50%', fee: '' },
      { upTo: '', markup: '25', fee: '10.50' }
    ]);
    expect(result.error).toBeNull();
    expect(result.rule?.bands).toEqual([
      { upToCents: 100_000, markupPercent: 50, feeCents: 0 },
      { upToCents: null, markupPercent: 25, feeCents: 1_050 }
    ]);
  });

  it('names the band to fix when a limit or fee is not an amount, instead of saving a different rule', () => {
    expect(priceRuleFromDrafts([{ upTo: 'abc', markup: '10', fee: '' }, { upTo: '', markup: '5', fee: '' }]).error).toMatch(/^Band 1: give the cost/);
    expect(priceRuleFromDrafts([{ upTo: '', markup: '10', fee: '1.234' }]).error).toMatch(/^Band 1: the dispensing fee/);
  });

  it('shows the saved rule in the form and reads it back unchanged', () => {
    expect(priceRuleFromDrafts(draftsFromPriceRule(RULE)).rule).toEqual(RULE);
  });
});
