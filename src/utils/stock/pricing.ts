/**
 * Selling prices of stock: the practice's own price rule (markup and dispensing fee by cost band) or a fixed price on
 * the item. OneHealth builds in no regulatory pricing formula: the practice sets the rule it applies (Stock >
 * Settings), and the same rule is checked by stock_save_settings (proposals/2026-10-07-dispensing-and-stock.sql).
 *
 * Money is in whole cents. Prices from the rule add VAT to cost + markup + fee; a fixed price includes VAT. The fee is
 * per dispensed line and is spread over its units, so the invoice line keeps "unit price x quantity" exactly.
 */
import { formatNad, fromCents, hasAtMostDecimals, percentOfCents, toCents } from '../billing/money';
import { parseAmountText } from './items';

export interface PriceBand {
  /** The band covers line costs (excl VAT) up to and including this; null = everything above the band before */
  upToCents: number | null;
  markupPercent: number;
  feeCents: number;
}

export interface PriceRule {
  bands: PriceBand[];
}

/** As stored in stock_settings.price_rule (N$, not cents) */
export interface PriceRuleJson {
  bands: Array<{ up_to: number | null; markup_percent: number; fee: number }>;
}

export const PRICE_RULE_LIMITS = {
  maxBands: 10,
  maxMarkupPercent: 1000,
  maxFeeCents: 10_000_000,
  maxUpToCents: 1_000_000_000
} as const;

/** A practice that has not set its rule sells at cost (plus VAT): never a made-up markup */
export const DEFAULT_PRICE_RULE: PriceRule = { bands: [{ upToCents: null, markupPercent: 0, feeCents: 0 }] };

const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && hasAtMostDecimals(value, 2);

/** The rule as stored, or null when it is not a usable rule (the screen then shows the default and says so) */
export function priceRuleFromJson(value: unknown): PriceRule | null {
  if (!value || typeof value !== 'object' || !Array.isArray((value as PriceRuleJson).bands)) return null;
  const bands: PriceBand[] = [];
  for (const band of (value as PriceRuleJson).bands) {
    if (!band || typeof band !== 'object') return null;
    const upTo = band.up_to;
    if (!(upTo === null || upTo === undefined || isAmount(upTo)) || !isAmount(band.markup_percent) || !isAmount(band.fee)) return null;
    bands.push({ upToCents: upTo === null || upTo === undefined ? null : toCents(upTo), markupPercent: band.markup_percent, feeCents: toCents(band.fee) });
  }
  const rule = { bands };
  return validatePriceRule(rule) === null ? rule : null;
}

export const priceRuleToJson = (rule: PriceRule): PriceRuleJson => ({
  bands: rule.bands.map(band => ({
    up_to: band.upToCents === null ? null : fromCents(band.upToCents),
    markup_percent: band.markupPercent,
    fee: fromCents(band.feeCents)
  }))
});

/** What is wrong with a rule, in plain words, or null when it can be saved (the database checks the same) */
export function validatePriceRule(rule: PriceRule): string | null {
  const { bands } = rule;
  if (bands.length < 1 || bands.length > PRICE_RULE_LIMITS.maxBands) return `A price rule has 1 to ${PRICE_RULE_LIMITS.maxBands} bands.`;
  let previous = 0;
  for (const [index, band] of bands.entries()) {
    const number = index + 1;
    const last = index === bands.length - 1;
    if (last && band.upToCents !== null) return 'The last band covers everything above the band before it, so it has no upper limit.';
    if (!last) {
      if (band.upToCents === null || !Number.isInteger(band.upToCents) || band.upToCents <= 0) return `Band ${number}: give the cost it goes up to.`;
      if (band.upToCents <= previous) return `Band ${number}: each band must go higher than the one before it.`;
      if (band.upToCents > PRICE_RULE_LIMITS.maxUpToCents) return `Band ${number}: the cost limit is too high.`;
      previous = band.upToCents;
    }
    if (!isAmount(band.markupPercent) || band.markupPercent > PRICE_RULE_LIMITS.maxMarkupPercent) {
      return `Band ${number}: the markup must be from 0% to ${PRICE_RULE_LIMITS.maxMarkupPercent}% with at most 2 decimals.`;
    }
    if (!Number.isInteger(band.feeCents) || band.feeCents < 0 || band.feeCents > PRICE_RULE_LIMITS.maxFeeCents) {
      return `Band ${number}: the dispensing fee must be from N$ 0 to ${formatNad(fromCents(PRICE_RULE_LIMITS.maxFeeCents))}.`;
    }
  }
  return null;
}

/** A band as typed on the settings screen */
export interface PriceBandDraft {
  upTo: string;
  markup: string;
  fee: string;
}

export const draftsFromPriceRule = (rule: PriceRule): PriceBandDraft[] =>
  rule.bands.map(band => ({
    upTo: band.upToCents === null ? '' : fromCents(band.upToCents).toFixed(2),
    markup: String(band.markupPercent),
    fee: band.feeCents === 0 ? '' : fromCents(band.feeCents).toFixed(2)
  }));

/**
 * The rule the settings form describes, or what to fix. A blank markup or fee means none; the last band has no
 * upper limit (its "up to" is ignored); "N$ 1,000" and "25%" are read as 1000 and 25.
 */
export function priceRuleFromDrafts(drafts: readonly PriceBandDraft[]): { rule: PriceRule; error: null } | { rule: null; error: string } {
  const bands: PriceBand[] = [];
  for (const [index, draft] of drafts.entries()) {
    const number = index + 1;
    let upToCents: number | null = null;
    if (index < drafts.length - 1) {
      const upTo = parseAmountText(draft.upTo);
      if (upTo === null) return { rule: null, error: `Band ${number}: give the cost it goes up to, in N$ (for example 100 or 100.50).` };
      upToCents = toCents(upTo);
    }
    const markup = draft.markup.trim() === '' ? 0 : parseAmountText(draft.markup.trim().replace(/\s*%$/, ''));
    if (markup === null) return { rule: null, error: `Band ${number}: the markup is a percentage such as 25 or 12.5.` };
    const fee = draft.fee.trim() === '' ? 0 : parseAmountText(draft.fee);
    if (fee === null) return { rule: null, error: `Band ${number}: the dispensing fee is an amount in N$ such as 10 or 10.50.` };
    bands.push({ upToCents, markupPercent: markup, feeCents: toCents(fee) });
  }
  const rule: PriceRule = { bands };
  const error = validatePriceRule(rule);
  return error === null ? { rule, error: null } : { rule: null, error };
}

/** The band a line cost falls in: the first whose limit it does not pass */
export function bandFor(rule: PriceRule, lineCostCents: number): PriceBand {
  return rule.bands.find(band => band.upToCents === null || lineCostCents <= band.upToCents) ?? rule.bands[rule.bands.length - 1];
}

/** "Up to N$ 100.00: cost + 50% + N$ 10.00 fee", "Above N$ 100.00: cost + 25%" */
export function describeBand(rule: PriceRule, index: number): string {
  const band = rule.bands[index];
  const before = index > 0 ? rule.bands[index - 1].upToCents : null;
  const range = band.upToCents !== null ? `Up to ${formatNad(fromCents(band.upToCents))}` : before !== null ? `Above ${formatNad(fromCents(before))}` : 'Any cost';
  const parts = ['cost'];
  if (band.markupPercent > 0) parts.push(`${band.markupPercent}%`);
  if (band.feeCents > 0) parts.push(`${formatNad(fromCents(band.feeCents))} fee`);
  return `${range}: ${parts.join(' + ')}`;
}

export interface PricedLine {
  /** rule: from the practice's rule; fixed: the item's own selling price */
  source: 'rule' | 'fixed';
  costCents: number;
  markupCents: number;
  feeCents: number;
  exclVatCents: number;
  vatCents: number;
  vatRate: number;
  /** What the rule gives for the whole line, VAT included */
  ruleTotalCents: number;
  /** Per unit, VAT included, to the cent */
  unitPriceCents: number;
  /** unit price x quantity: what goes on the invoice line */
  totalCents: number;
}

/** a / b rounded half up, for non-negative integers */
const divideRoundHalfUp = (a: number, b: number): number => Math.floor((2 * a + b) / (2 * b));

/**
 * The selling price of a line of stock. Null when it cannot be priced: no units, or no fixed price and no cost (an
 * item whose cost is unknown would otherwise be sold for the fee alone).
 */
export function priceStockLine(input: {
  quantity: number;
  /** The cost (excl VAT) of these units at the average cost on hand; null when unknown */
  lineCostCents: number | null;
  vatRate: number;
  rule: PriceRule;
  /** The item's fixed selling price per unit (incl VAT), if it has one */
  fixedUnitPriceCents: number | null;
}): PricedLine | null {
  const { quantity, vatRate } = input;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const costCents = input.lineCostCents !== null && input.lineCostCents > 0 ? input.lineCostCents : 0;
  if (input.fixedUnitPriceCents !== null && input.fixedUnitPriceCents >= 0) {
    const total = input.fixedUnitPriceCents * quantity;
    const exclVat = vatRate > 0 ? divideRoundHalfUp(total * 100, 100 + vatRate) : total;
    return {
      source: 'fixed',
      costCents,
      markupCents: Math.max(exclVat - costCents, 0),
      feeCents: 0,
      exclVatCents: exclVat,
      vatCents: total - exclVat,
      vatRate,
      ruleTotalCents: total,
      unitPriceCents: input.fixedUnitPriceCents,
      totalCents: total
    };
  }
  if (costCents <= 0) return null;
  const band = bandFor(input.rule, costCents);
  const markupCents = percentOfCents(costCents, band.markupPercent);
  const exclVatCents = costCents + markupCents + band.feeCents;
  const vatCents = percentOfCents(exclVatCents, vatRate);
  const ruleTotalCents = exclVatCents + vatCents;
  const unitPriceCents = divideRoundHalfUp(ruleTotalCents, quantity);
  return {
    source: 'rule',
    costCents,
    markupCents,
    feeCents: band.feeCents,
    exclVatCents,
    vatCents,
    vatRate,
    ruleTotalCents,
    unitPriceCents,
    totalCents: unitPriceCents * quantity
  };
}
