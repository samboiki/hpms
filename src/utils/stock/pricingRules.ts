/**
 * The practice's medicine and material price rules (parity E7, D29), on top of its price bands (pricing.ts). Kept in
 * stock_pricing_rules and stock_reference_prices (proposals/2026-10-13-billing-extras.sql); Stock > Settings and an
 * item's sheet set them.
 *
 * - Medicines: the price bands (markup and dispensing fee by the line's cost) give the standard price. A tier replaces
 *   the bands for a group of patients: medical aid patients, private patients, or staff (chosen when the medicine is
 *   added). A tier is cost + its own markup + its own dispensing fee per line, then VAT.
 * - A medicine's fund reference price (per unit, VAT included) is the most a medical aid pays for it: for a medical aid
 *   patient a medicine priced above it is billed at it, unless staff choose the full price.
 * - Materials (every item that is not a medicine): once the practice sets its material rule, cost + a handling fee
 *   (NAMAF rule 013: one percentage of the cost up to a limit, another of the cost above it, the fee at most a ceiling),
 *   then VAT. Without the rule, materials keep the bands, as before.
 * - An item with its own fixed selling price keeps it whatever the rules say (the reference price aside).
 * Nothing priced today changes until the practice sets a tier, the material rule or a reference price.
 *
 * Money is in whole cents; the database keeps N$.
 */
import { formatNad, fromCents, hasAtMostDecimals, percentOfCents, toCents } from '../billing/money';
import { parseAmountText } from './items';
import { priceStockLine, type PriceRule, type PricedLine } from './pricing';

export const MEDICINE_TIERS = ['medical_aid', 'private', 'staff'] as const;
export type MedicineTier = (typeof MEDICINE_TIERS)[number];

export const TIER_LABELS: Readonly<Record<MedicineTier, string>> = {
  medical_aid: 'Medical aid patients',
  private: 'Private patients',
  staff: 'Staff'
};

export interface TierRule {
  markupPercent: number;
  /** Dispensing fee per line, excl VAT */
  feeCents: number;
}

/** Cost + lowerPercent of the cost up to thresholdCents + upperPercent of the cost above it; the fee at most maxFeeCents */
export interface MaterialRule {
  lowerPercent: number;
  thresholdCents: number;
  upperPercent: number;
  /** null: no ceiling */
  maxFeeCents: number | null;
}

export interface PricingRules {
  /** A tier left out uses the bands */
  tiers: Partial<Record<MedicineTier, TierRule>>;
  /** null: materials are priced by the bands, as before */
  material: MaterialRule | null;
}

export const NO_PRICING_RULES: PricingRules = { tiers: {}, material: null };

/**
 * NAMAF rule 013 as the 2025 dental benchmark schedule words it (the Eminance analysis, history-and-documents.md 4.2):
 * 35 % handling fee on the cost up to N$ 4,240.20, 10 % above, the fee at most N$ 8,016.80. Offered as a starting
 * point the practice confirms against its current schedule; never applied by itself.
 */
export const NAMAF_RULE_013_2025: MaterialRule = { lowerPercent: 35, thresholdCents: 424_020, upperPercent: 10, maxFeeCents: 801_680 };

export const PRICING_LIMITS = {
  maxPercent: 1000,
  maxTierFeeCents: 10_000_000,
  maxMaterialCents: 1_000_000_000
} as const;

// ---------------------------------------------------------------------------------------------
// As stored (N$, the database's checks: stock_save_pricing_rules)
// ---------------------------------------------------------------------------------------------

export interface PricingRulesJson {
  medicine_tiers: Partial<Record<MedicineTier, { markup_percent: number; fee: number }>>;
  material_rule: { lower_percent: number; threshold: number; upper_percent: number; max_fee: number | null } | null;
}

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && hasAtMostDecimals(value, 2);
/** numeric columns may arrive as text */
const amountOf = (value: unknown): number | null => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return isAmount(number) ? number : null;
};

export function validateTier(tier: TierRule): string | null {
  if (!isAmount(tier.markupPercent) || tier.markupPercent > PRICING_LIMITS.maxPercent) {
    return `The markup must be from 0% to ${PRICING_LIMITS.maxPercent}% with at most 2 decimals.`;
  }
  if (!Number.isInteger(tier.feeCents) || tier.feeCents < 0 || tier.feeCents > PRICING_LIMITS.maxTierFeeCents) {
    return `The dispensing fee must be from N$ 0 to ${formatNad(fromCents(PRICING_LIMITS.maxTierFeeCents))}.`;
  }
  return null;
}

export function validateMaterialRule(rule: MaterialRule): string | null {
  for (const [value, what] of [[rule.lowerPercent, 'The handling fee up to the limit'], [rule.upperPercent, 'The handling fee above the limit']] as const) {
    if (!isAmount(value) || value > PRICING_LIMITS.maxPercent) return `${what} must be from 0% to ${PRICING_LIMITS.maxPercent}% with at most 2 decimals.`;
  }
  if (!Number.isInteger(rule.thresholdCents) || rule.thresholdCents <= 0 || rule.thresholdCents > PRICING_LIMITS.maxMaterialCents) {
    return 'Give the cost limit in N$, more than N$ 0.00.';
  }
  if (rule.maxFeeCents !== null && (!Number.isInteger(rule.maxFeeCents) || rule.maxFeeCents <= 0 || rule.maxFeeCents > PRICING_LIMITS.maxMaterialCents)) {
    return 'The largest handling fee must be more than N$ 0.00, or left empty for no ceiling.';
  }
  return null;
}

/** The rules as stored; `readable` is false when a stored rule could not be used (it then prices as if not set) */
export function pricingRulesFromRow(row: { medicine_tiers?: unknown; material_rule?: unknown } | null): { rules: PricingRules; readable: boolean } {
  if (!row) return { rules: NO_PRICING_RULES, readable: true };
  let readable = true;
  const tiers: Partial<Record<MedicineTier, TierRule>> = {};
  const stored = row.medicine_tiers && typeof row.medicine_tiers === 'object' ? (row.medicine_tiers as Record<string, unknown>) : {};
  for (const key of MEDICINE_TIERS) {
    const value = stored[key] as { markup_percent?: unknown; fee?: unknown } | null | undefined;
    if (!value) continue;
    const markup = amountOf(value.markup_percent);
    const fee = amountOf(value.fee);
    const tier = markup === null || fee === null ? null : { markupPercent: markup, feeCents: toCents(fee) };
    if (tier && validateTier(tier) === null) tiers[key] = tier;
    else readable = false;
  }
  let material: MaterialRule | null = null;
  const raw = row.material_rule as { lower_percent?: unknown; threshold?: unknown; upper_percent?: unknown; max_fee?: unknown } | null | undefined;
  if (raw && typeof raw === 'object') {
    const lower = amountOf(raw.lower_percent);
    const threshold = amountOf(raw.threshold);
    const upper = amountOf(raw.upper_percent);
    const maxFee = raw.max_fee === null || raw.max_fee === undefined ? null : amountOf(raw.max_fee);
    const candidate = lower === null || threshold === null || upper === null || (raw.max_fee !== null && raw.max_fee !== undefined && maxFee === null)
      ? null
      : { lowerPercent: lower, thresholdCents: toCents(threshold), upperPercent: upper, maxFeeCents: maxFee === null ? null : toCents(maxFee) };
    if (candidate && validateMaterialRule(candidate) === null) material = candidate;
    else readable = false;
  }
  return { rules: { tiers, material }, readable };
}

export function pricingRulesToJson(rules: PricingRules): PricingRulesJson {
  const medicine_tiers: PricingRulesJson['medicine_tiers'] = {};
  for (const key of MEDICINE_TIERS) {
    const tier = rules.tiers[key];
    if (tier) medicine_tiers[key] = { markup_percent: tier.markupPercent, fee: fromCents(tier.feeCents) };
  }
  const material = rules.material;
  return {
    medicine_tiers,
    material_rule: material
      ? {
          lower_percent: material.lowerPercent,
          threshold: fromCents(material.thresholdCents),
          upper_percent: material.upperPercent,
          max_fee: material.maxFeeCents === null ? null : fromCents(material.maxFeeCents)
        }
      : null
  };
}

// ---------------------------------------------------------------------------------------------
// The settings form (text as typed)
// ---------------------------------------------------------------------------------------------

export interface TierDraft {
  on: boolean;
  markup: string;
  fee: string;
}

export interface MaterialRuleDraft {
  on: boolean;
  lower: string;
  threshold: string;
  upper: string;
  /** '' = no ceiling */
  maxFee: string;
}

export interface PricingDraft {
  tiers: Record<MedicineTier, TierDraft>;
  material: MaterialRuleDraft;
}

const percentText = (value: number): string => String(value);
const centsText = (cents: number): string => fromCents(cents).toFixed(2);

export function materialDraftFrom(rule: MaterialRule | null, on: boolean): MaterialRuleDraft {
  return rule
    ? { on, lower: percentText(rule.lowerPercent), threshold: centsText(rule.thresholdCents), upper: percentText(rule.upperPercent), maxFee: rule.maxFeeCents === null ? '' : centsText(rule.maxFeeCents) }
    : { on, lower: '', threshold: '', upper: '', maxFee: '' };
}

export function pricingDraftFrom(rules: PricingRules): PricingDraft {
  const tierDraft = (key: MedicineTier): TierDraft => {
    const tier = rules.tiers[key];
    return tier ? { on: true, markup: percentText(tier.markupPercent), fee: tier.feeCents === 0 ? '' : centsText(tier.feeCents) } : { on: false, markup: '', fee: '' };
  };
  return {
    tiers: { medical_aid: tierDraft('medical_aid'), private: tierDraft('private'), staff: tierDraft('staff') },
    material: materialDraftFrom(rules.material, rules.material !== null)
  };
}

const parsePercent = (text: string): number | null => (text.trim() === '' ? 0 : parseAmountText(text.trim().replace(/\s*%$/, '')));

/**
 * The rules the form describes, or what to fix. A blank markup or fee means none; a tier or the material rule that is
 * off is left out. "N$ 4,240.20" and "35%" are read as 4240.20 and 35.
 */
export function pricingRulesFromDraft(draft: PricingDraft): { rules: PricingRules; error: null } | { rules: null; error: string } {
  const tiers: Partial<Record<MedicineTier, TierRule>> = {};
  for (const key of MEDICINE_TIERS) {
    const entry = draft.tiers[key];
    if (!entry.on) continue;
    const markup = parsePercent(entry.markup);
    if (markup === null) return { rules: null, error: `${TIER_LABELS[key]}: the markup is a percentage such as 25 or 12.5.` };
    const fee = entry.fee.trim() === '' ? 0 : parseAmountText(entry.fee);
    if (fee === null) return { rules: null, error: `${TIER_LABELS[key]}: the dispensing fee is an amount in N$ such as 10 or 10.50.` };
    const tier = { markupPercent: markup, feeCents: toCents(fee) };
    const problem = validateTier(tier);
    if (problem) return { rules: null, error: `${TIER_LABELS[key]}: ${problem}` };
    tiers[key] = tier;
  }
  let material: MaterialRule | null = null;
  if (draft.material.on) {
    const lower = parsePercent(draft.material.lower);
    const upper = parsePercent(draft.material.upper);
    const threshold = parseAmountText(draft.material.threshold);
    const maxFee = draft.material.maxFee.trim() === '' ? null : parseAmountText(draft.material.maxFee);
    if (lower === null || upper === null) return { rules: null, error: 'Materials: the handling fee is a percentage such as 35 or 10.' };
    if (threshold === null) return { rules: null, error: 'Materials: give the cost limit in N$, for example 4240.20.' };
    if (draft.material.maxFee.trim() !== '' && maxFee === null) return { rules: null, error: 'Materials: the largest handling fee is an amount in N$, or leave it empty.' };
    const rule = { lowerPercent: lower, thresholdCents: toCents(threshold), upperPercent: upper, maxFeeCents: maxFee === null ? null : toCents(maxFee) };
    const problem = validateMaterialRule(rule);
    if (problem) return { rules: null, error: `Materials: ${problem}` };
    material = rule;
  }
  return { rules: { tiers, material }, error: null };
}

export const sameRules = (a: PricingRules, b: PricingRules): boolean => JSON.stringify(pricingRulesToJson(a)) === JSON.stringify(pricingRulesToJson(b));

// ---------------------------------------------------------------------------------------------
// Pricing a line
// ---------------------------------------------------------------------------------------------

/** The NAMAF rule 013 handling fee for a material line costing `costCents` (excl VAT) */
export function materialHandlingFeeCents(rule: MaterialRule, costCents: number): number {
  if (!Number.isInteger(costCents) || costCents <= 0) return 0;
  const lower = Math.min(costCents, rule.thresholdCents);
  const upper = Math.max(costCents - rule.thresholdCents, 0);
  const fee = percentOfCents(lower, rule.lowerPercent) + percentOfCents(upper, rule.upperPercent);
  return rule.maxFeeCents === null ? fee : Math.min(fee, rule.maxFeeCents);
}

/** "35% of the cost up to N$ 4,240.20, 10% above it, at most N$ 8,016.80" */
export function describeMaterialRule(rule: MaterialRule): string {
  return `${rule.lowerPercent}% of the cost up to ${formatNad(fromCents(rule.thresholdCents))}, ${rule.upperPercent}% above it` +
    (rule.maxFeeCents === null ? '' : `, at most ${formatNad(fromCents(rule.maxFeeCents))}`);
}

/** "cost + 30% + N$ 15.00 fee" */
export function describeTier(tier: TierRule): string {
  const parts = ['cost'];
  if (tier.markupPercent > 0) parts.push(`${tier.markupPercent}%`);
  if (tier.feeCents > 0) parts.push(`${formatNad(fromCents(tier.feeCents))} fee`);
  return parts.join(' + ');
}

export type ItemKind = 'medicine' | 'material';

/** A medicine is an item of the medications category; everything else billed from stock is a material (claimed as 0201) */
export const itemKindOf = (category: string | null | undefined): ItemKind => (category === 'medications' ? 'medicine' : 'material');

/** Who the line is for, when it is billed to a patient */
export interface PricingContext {
  /** The patient's medical aid record says they have one */
  hasMedicalAid?: boolean;
  /** The staff tier, chosen when the medicine is added */
  staffPrice?: boolean;
  /** For a medical aid patient: false bills the full price even above the fund's reference price (default true) */
  atReferencePrice?: boolean;
}

/** The tier a medicine line takes: staff when chosen, else the patient's group, when the practice set that tier */
export function tierFor(rules: PricingRules, context: PricingContext | undefined): MedicineTier | null {
  if (!context) return null;
  if (context.staffPrice && rules.tiers.staff) return 'staff';
  if (context.hasMedicalAid === true && rules.tiers.medical_aid) return 'medical_aid';
  if (context.hasMedicalAid === false && rules.tiers.private) return 'private';
  return null;
}

export interface PricedItemLine extends PricedLine {
  kind: ItemKind;
  /** The tier that priced a medicine; null: the bands or the item's own price */
  tier: MedicineTier | null;
  /** True when a material was priced at cost plus the handling fee (feeCents is the handling fee) */
  handlingFee: boolean;
  /** The fund's reference price per unit, VAT included (medicines); null when none is kept */
  referenceUnitCents: number | null;
  /** Billed at the fund's reference price (a medical aid patient, priced above it) */
  atReference: boolean;
  /** A medical aid patient's medicine priced above the reference price and billed at the full price */
  aboveReference: boolean;
}

/** a / b rounded half up, for non-negative integers */
const divideRoundHalfUp = (a: number, b: number): number => Math.floor((2 * a + b) / (2 * b));

/**
 * The selling price of a line of stock under the practice's rules (the file comment). Null when it cannot be priced:
 * no units, or no fixed price and no cost.
 */
export function priceItemLine(input: {
  kind: ItemKind;
  quantity: number;
  /** The cost (excl VAT) of these units at the average cost on hand; null when unknown */
  lineCostCents: number | null;
  vatRate: number;
  /** The practice's price bands (stock_settings.price_rule) */
  bands: PriceRule;
  rules: PricingRules;
  /** The item's fixed selling price per unit (incl VAT), if it has one */
  fixedUnitPriceCents: number | null;
  /** The fund's reference price per unit (incl VAT), medicines only */
  referenceUnitCents?: number | null;
  context?: PricingContext;
}): PricedItemLine | null {
  const { kind, quantity, vatRate, rules } = input;
  const fixed = input.fixedUnitPriceCents;
  const tier = kind === 'medicine' && fixed === null ? tierFor(rules, input.context) : null;
  const tierRule = tier ? rules.tiers[tier] : undefined;
  const cost = input.lineCostCents !== null && input.lineCostCents > 0 ? input.lineCostCents : 0;
  const material = kind === 'material' && fixed === null ? rules.material : null;
  // A tier and the material rule are each one band: cost + their markup and fee (the handling fee is worked out from the cost)
  const rule: PriceRule = tierRule
    ? { bands: [{ upToCents: null, markupPercent: tierRule.markupPercent, feeCents: tierRule.feeCents }] }
    : material
      ? { bands: [{ upToCents: null, markupPercent: 0, feeCents: materialHandlingFeeCents(material, cost) }] }
      : input.bands;
  const base = priceStockLine({ quantity, lineCostCents: input.lineCostCents, vatRate, rule, fixedUnitPriceCents: fixed });
  if (!base) return null;
  const referenceUnitCents = kind === 'medicine' && input.referenceUnitCents && input.referenceUnitCents > 0 ? input.referenceUnitCents : null;
  const priced: PricedItemLine = {
    ...base,
    kind,
    tier: tierRule ? tier : null,
    handlingFee: material !== null,
    referenceUnitCents,
    atReference: false,
    aboveReference: false
  };
  if (referenceUnitCents === null || input.context?.hasMedicalAid !== true || base.unitPriceCents <= referenceUnitCents) return priced;
  if (input.context.atReferencePrice === false) return { ...priced, aboveReference: true };
  // Billed at the reference price: the VAT and the margin follow from it
  const total = referenceUnitCents * quantity;
  const exclVat = vatRate > 0 ? divideRoundHalfUp(total * 100, 100 + vatRate) : total;
  return {
    ...priced,
    exclVatCents: exclVat,
    vatCents: total - exclVat,
    markupCents: Math.max(exclVat - base.costCents - base.feeCents, 0),
    ruleTotalCents: total,
    unitPriceCents: referenceUnitCents,
    totalCents: total,
    atReference: true
  };
}

const TIER_PRICE_WORDS: Readonly<Record<MedicineTier, string>> = {
  medical_aid: 'the medical aid price',
  private: 'the private price',
  staff: 'the staff price'
};

/** How a priced line came about, in a few words, for the line's sheet ("the staff price", "at the fund's reference price") */
export function describePricedLine(price: Pick<PricedItemLine, 'source' | 'tier' | 'handlingFee' | 'atReference'>): string | null {
  if (price.atReference) return "at the fund's reference price";
  if (price.source === 'fixed') return "the item's price";
  if (price.tier) return TIER_PRICE_WORDS[price.tier];
  if (price.handlingFee) return 'cost plus the handling fee';
  return null;
}
