import { describe, expect, it } from 'vitest';
import { findInvoiceLineProblems } from '../../../services/invoiceService';
import { priceStockLine, type PriceRule } from '../pricing';
import {
  NAMAF_RULE_013_2025,
  NO_PRICING_RULES,
  describePricedLine,
  itemKindOf,
  materialHandlingFeeCents,
  priceItemLine,
  pricingDraftFrom,
  pricingRulesFromDraft,
  pricingRulesFromRow,
  pricingRulesToJson,
  sameRules,
  tierFor,
  type PricingRules
} from '../pricingRules';
import { stockBillingLine } from '../stockLine';

// A practice's own bands (invented figures)
const BANDS: PriceRule = {
  bands: [
    { upToCents: 10_000, markupPercent: 50, feeCents: 1_000 },
    { upToCents: null, markupPercent: 25, feeCents: 2_000 }
  ]
};

const RULES: PricingRules = {
  tiers: {
    medical_aid: { markupPercent: 30, feeCents: 1_500 },
    private: { markupPercent: 40, feeCents: 0 },
    staff: { markupPercent: 5, feeCents: 0 }
  },
  material: NAMAF_RULE_013_2025
};

const line = (overrides: Partial<Parameters<typeof priceItemLine>[0]> = {}) =>
  priceItemLine({ kind: 'medicine', quantity: 10, lineCostCents: 2_000, vatRate: 15, bands: BANDS, rules: RULES, fixedUnitPriceCents: null, ...overrides });

describe('nothing that prices today changes until the practice sets a new rule', () => {
  it('prices a medicine and a material exactly as the bands did when no tier, material rule or reference price is set', () => {
    for (const kind of ['medicine', 'material'] as const) {
      const before = priceStockLine({ quantity: 3, lineCostCents: 4_500, vatRate: 15, rule: BANDS, fixedUnitPriceCents: null })!;
      const now = priceItemLine({ kind, quantity: 3, lineCostCents: 4_500, vatRate: 15, bands: BANDS, rules: NO_PRICING_RULES, fixedUnitPriceCents: null, context: { hasMedicalAid: true } })!;
      expect(now.totalCents).toBe(before.totalCents);
      expect(now.unitPriceCents).toBe(before.unitPriceCents);
      expect(now.tier).toBeNull();
      expect(now.handlingFee).toBe(false);
    }
  });

  it('keeps a material on the bands while the practice has not switched the material rule on, even with tiers set', () => {
    const rules: PricingRules = { ...RULES, material: null };
    const material = priceItemLine({ kind: 'material', quantity: 1, lineCostCents: 1_000, vatRate: 15, bands: BANDS, rules, fixedUnitPriceCents: null, context: { hasMedicalAid: true } })!;
    expect(material.totalCents).toBe(priceStockLine({ quantity: 1, lineCostCents: 1_000, vatRate: 15, rule: BANDS, fixedUnitPriceCents: null })!.totalCents);
  });

  it('sees a medicine as the medications category and everything else billed from stock as a material (claimed under 0201)', () => {
    expect(itemKindOf('medications')).toBe('medicine');
    expect(itemKindOf('disposables')).toBe('material');
    expect(itemKindOf('equipment')).toBe('material');
  });
});

describe('materials at cost plus the NAMAF rule 013 handling fee (D29)', () => {
  it('charges 35% of a small cost, so a N$ 100.00 material sells for N$ 155.25 with VAT', () => {
    expect(materialHandlingFeeCents(NAMAF_RULE_013_2025, 10_000)).toBe(3_500);
    const price = priceItemLine({ kind: 'material', quantity: 1, lineCostCents: 10_000, vatRate: 15, bands: BANDS, rules: RULES, fixedUnitPriceCents: null })!;
    expect(price.handlingFee).toBe(true);
    expect(price.feeCents).toBe(3_500);
    expect(price.markupCents).toBe(0);
    expect(price.totalCents).toBe(15_525);
  });

  it('charges 35% up to N$ 4,240.20 and 10% of the rest: N$ 5,000.00 of material carries a N$ 1,560.05 fee', () => {
    expect(materialHandlingFeeCents(NAMAF_RULE_013_2025, 500_000)).toBe(148_407 + 7_598);
    const price = priceItemLine({ kind: 'material', quantity: 1, lineCostCents: 500_000, vatRate: 15, bands: BANDS, rules: RULES, fixedUnitPriceCents: null })!;
    expect(price.exclVatCents).toBe(656_005);
    expect(price.totalCents).toBe(754_406);
  });

  it('never charges more than the ceiling (N$ 8,016.80), however dear the material', () => {
    expect(materialHandlingFeeCents(NAMAF_RULE_013_2025, 10_000_000)).toBe(801_680);
    expect(materialHandlingFeeCents({ ...NAMAF_RULE_013_2025, maxFeeCents: null }, 10_000_000)).toBe(148_407 + 957_598);
  });

  it('keeps the bill "unit price x quantity" exact, so the invoice check accepts the material line', () => {
    const price = priceItemLine({ kind: 'material', quantity: 7, lineCostCents: 1_234, vatRate: 15, bands: BANDS, rules: RULES, fixedUnitPriceCents: null })!;
    const service = stockBillingLine({
      item: { id: '2f1e8c7a-1b2c-4d3e-8f90-a1b2c3d4e5f6', name: 'Example composite', nappiCode: '700000002', tariffCode: '0201', sku: null, category: 'disposables' },
      quantity: 7,
      price,
      hasMedicalAid: true,
      lineId: 'line-1'
    });
    expect(findInvoiceLineProblems([service], { today: '2026-10-13' })).toEqual([]);
  });

  it('never applies the material rule to a medicine, which keeps its own pricing', () => {
    const price = line({ context: undefined })!;
    expect(price.handlingFee).toBe(false);
  });
});

describe('medicine price tiers (E7)', () => {
  it('prices a medical aid patient by the medical aid tier, a private patient by the private tier', () => {
    const aid = line({ context: { hasMedicalAid: true } })!;
    expect(aid.tier).toBe('medical_aid');
    // N$ 20.00 + 30% (6.00) + N$ 15.00 fee = 41.00 + VAT 6.15 = 47.15
    expect(aid.ruleTotalCents).toBe(4_715);
    const cash = line({ context: { hasMedicalAid: false } })!;
    expect(cash.tier).toBe('private');
    expect(cash.ruleTotalCents).toBe(Math.round((2_000 + 800) * 1.15));
  });

  it('gives staff their own price only when it is chosen, whatever their medical aid', () => {
    expect(tierFor(RULES, { hasMedicalAid: true, staffPrice: true })).toBe('staff');
    expect(tierFor({ ...RULES, tiers: {} }, { staffPrice: true })).toBeNull();
  });

  it('uses the bands for a group the practice set no tier for, and when no patient is known (the Stock screens)', () => {
    const rules: PricingRules = { tiers: { medical_aid: RULES.tiers.medical_aid }, material: null };
    expect(line({ rules, context: { hasMedicalAid: false } })!.tier).toBeNull();
    expect(line({ context: undefined })!.tier).toBeNull();
  });

  it('keeps an item\'s own fixed selling price whatever tier the patient is in', () => {
    const price = line({ fixedUnitPriceCents: 500, context: { hasMedicalAid: true } })!;
    expect(price.source).toBe('fixed');
    expect(price.tier).toBeNull();
    expect(price.totalCents).toBe(5_000);
  });
});

describe('the fund\'s reference price (E7)', () => {
  it('bills a medical aid patient at the reference price when the medicine costs more, because the fund pays no more', () => {
    // The medical aid tier gives 47.15 for 10 units (4.72 each); the fund pays at most 3.00 a unit
    const price = line({ referenceUnitCents: 300, context: { hasMedicalAid: true } })!;
    expect(price.atReference).toBe(true);
    expect(price.unitPriceCents).toBe(300);
    expect(price.totalCents).toBe(3_000);
    expect(price.vatCents + price.exclVatCents).toBe(3_000);
    expect(describePricedLine(price)).toBe("at the fund's reference price");
  });

  it('bills the full price when staff choose it, and says the line is above the reference price', () => {
    const price = line({ referenceUnitCents: 300, context: { hasMedicalAid: true, atReferencePrice: false } })!;
    expect(price.atReference).toBe(false);
    expect(price.aboveReference).toBe(true);
    expect(price.totalCents).toBe(4_720);
  });

  it('leaves a private patient\'s price alone (the reference price is the fund\'s) and a price under it', () => {
    expect(line({ referenceUnitCents: 300, context: { hasMedicalAid: false } })!.atReference).toBe(false);
    expect(line({ referenceUnitCents: 10_000, context: { hasMedicalAid: true } })!.atReference).toBe(false);
  });

  it('keeps no reference price for a material', () => {
    expect(priceItemLine({ kind: 'material', quantity: 1, lineCostCents: 1_000, vatRate: 15, bands: BANDS, rules: RULES, fixedUnitPriceCents: null, referenceUnitCents: 1, context: { hasMedicalAid: true } })!.referenceUnitCents).toBeNull();
  });
});

describe('the rules as stored and as typed', () => {
  it('reads back what it writes, in N$ as the database keeps them', () => {
    const json = pricingRulesToJson(RULES);
    expect(json.material_rule).toEqual({ lower_percent: 35, threshold: 4240.2, upper_percent: 10, max_fee: 8016.8 });
    const read = pricingRulesFromRow({ medicine_tiers: json.medicine_tiers, material_rule: json.material_rule });
    expect(read.readable).toBe(true);
    expect(sameRules(read.rules, RULES)).toBe(true);
  });

  it('prices as if nothing was set when a stored rule cannot be used, and says so', () => {
    const read = pricingRulesFromRow({ medicine_tiers: { staff: { markup_percent: 'lots', fee: 0 } }, material_rule: { lower_percent: 35 } });
    expect(read.readable).toBe(false);
    expect(read.rules).toEqual(NO_PRICING_RULES);
    expect(pricingRulesFromRow(null)).toEqual({ rules: NO_PRICING_RULES, readable: true });
  });

  it('reads "N$ 4,240.20" and "35%" as typed, and leaves out a tier that is off', () => {
    const draft = pricingDraftFrom(NO_PRICING_RULES);
    const result = pricingRulesFromDraft({
      tiers: { ...draft.tiers, staff: { on: true, markup: '5%', fee: '' } },
      material: { on: true, lower: '35%', threshold: 'N$ 4,240.20', upper: '10', maxFee: '8,016.80' }
    });
    expect(result.error).toBeNull();
    expect(result.rules).toEqual({ tiers: { staff: { markupPercent: 5, feeCents: 0 } }, material: NAMAF_RULE_013_2025 });
  });

  it('names what to fix instead of saving a different rule', () => {
    const draft = pricingDraftFrom(NO_PRICING_RULES);
    expect(pricingRulesFromDraft({ ...draft, material: { on: true, lower: '35', threshold: '', upper: '10', maxFee: '' } }).error).toMatch(/cost limit/);
    expect(pricingRulesFromDraft({ ...draft, tiers: { ...draft.tiers, private: { on: true, markup: 'abc', fee: '' } } }).error).toMatch(/^Private patients: the markup/);
  });

  it('shows the saved rules in the form and reads them back unchanged', () => {
    const back = pricingRulesFromDraft(pricingDraftFrom(RULES));
    expect(back.rules && sameRules(back.rules, RULES)).toBe(true);
  });
});
