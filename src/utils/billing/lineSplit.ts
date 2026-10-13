/**
 * Who pays each billing line, the medical aid fund or the patient, in whole cents (parity D8).
 *
 * Business rules:
 * - A private patient (no medical aid) pays the whole line. A discount, for private patients only, comes off the
 *   line first: the line total on the invoice is the amount after the discount.
 * - A medical aid patient's line goes to the fund, except the co-payment the practice set for that fund: either a
 *   percentage of each line (for example 5%, rounded half up to the cent) or a fixed amount per line (for example
 *   N$ 50.00, never more than the line). The patient pays it and the fund the rest. The claim still carries the whole
 *   line, from which the fund works out its own share.
 * - A levy is a fixed amount the patient pays once per invoice (one visit), for example N$ 20.00: it comes off the
 *   fund's share of the invoice's lines, first line first, and never makes the patient pay more than the fund's
 *   share was (applyLevy).
 * - A line can be paid by one side only (paidBy): 'patient' lines are never claimed and all of the line is the
 *   patient's (the database keeps them out of claim batches); 'fund' lines have no co-payment or levy. Each tariff
 *   code can start its new lines that way (the practice's default portion per code, TARIFF_PORTIONS_SETTING_KEY).
 * - A medical aid line gets no discount: the fund is claimed at the agreed price.
 * - fund + patient = the line total, to the cent, and neither is negative. These are the two portions the receipts
 *   core allocates against ('medical_aid' and 'patient').
 *
 * Co-payments and levies are practice settings (practice_settings key fund_copayments): a list of { fundReference,
 * planOption, percent, amount, levy }. A plan option's own rule wins over the fund-wide rule, as fund prices do
 * (fundPricing.ts).
 */
import { formatNad, fromCents, hasAtMostDecimals, percentOfCents, toCents } from './money.ts';

export const COPAY_SETTING_KEY = 'fund_copayments';

/** practice_settings key of the practice's default portion per tariff code: a list of { code, paidBy }. */
export const TARIFF_PORTIONS_SETTING_KEY = 'tariff_portions';

/** The most a fixed co-payment or a levy can be (N$): anything larger is a typing mistake. */
export const MAX_FIXED_SHARE = 100_000;

/** A line paid by one side only: the fund all of it (no co-payment or levy) or the patient all of it (never claimed). */
export type PaidBy = 'fund' | 'patient';

/** Plain words for who pays a line ('split': as the fund's co-payment and levy say). */
export const PAID_BY_LABELS: Record<PaidBy | 'split', string> = {
  split: "As the fund's rules say",
  fund: 'Medical aid pays all',
  patient: 'Patient pays all (not claimed)'
};

export const isPaidBy = (value: unknown): value is PaidBy => value === 'fund' || value === 'patient';

/** One co-payment rule: what the patient pays of this fund's lines (and plan option, when given). */
export interface CopayRule {
  /** The fund code on claims (medical_aid_providers.medical_aid_reference, e.g. MAG1) */
  fundReference: string;
  /** null: every plan option of the fund */
  planOption: string | null;
  /** The patient's share of each line in percent (more than 0, at most 100, 2 decimals); 0 when the rule has none */
  percent: number;
  /** Or a fixed amount in N$ the patient pays on each line (never more than the line); absent or 0 for none */
  amount?: number;
  /** A fixed amount in N$ the patient pays once per invoice (visit), off the fund's share; absent or 0 for none */
  levy?: number;
}

const upper = (value: unknown): string => (typeof value === 'string' ? value.trim().toUpperCase() : '');
const lower = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** A usable co-payment percentage (0 < percent <= 100, at most 2 decimals), or null. */
export function parseCopayPercent(value: unknown): number | null {
  const percent = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100 || !hasAtMostDecimals(percent, 2)) return null;
  return percent;
}

/** A usable fixed co-payment or levy in N$ (0 < amount <= MAX_FIXED_SHARE, whole cents), or null. */
export function parseShareAmount(value: unknown): number | null {
  const text = typeof value === 'string' ? value.replace(/[N$\s,]/gi, '') : value;
  const amount = typeof text === 'number' ? text : typeof text === 'string' && text !== '' ? Number(text) : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_FIXED_SHARE || !hasAtMostDecimals(amount, 2)) return null;
  return amount;
}

/** A stored part of a rule: absent, empty or 0 means none (0); anything else must be usable, otherwise null. */
const optionalPart = (value: unknown, parse: (value: unknown) => number | null): number | null => {
  if (value === undefined || value === null || value === 0 || (typeof value === 'string' && value.trim() === '')) return 0;
  return parse(value);
};

/**
 * The practice's co-payment rules from the stored setting. An entry is left out when it has no fund code, when any of
 * its parts is unusable, when it asks for both a percentage and a fixed amount, or when it charges nothing; a later
 * entry for the same fund and plan option replaces an earlier one.
 */
export function parseCopayRules(value: unknown): CopayRule[] {
  const list = Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray((value as { rules?: unknown }).rules) ? (value as { rules: unknown[] }).rules : [];
  const rules = new Map<string, CopayRule>();
  list.forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const raw = entry as Record<string, unknown>;
    const fundReference = upper(raw.fundReference);
    const percent = optionalPart(raw.percent, parseCopayPercent);
    const amount = optionalPart(raw.amount, parseShareAmount);
    const levy = optionalPart(raw.levy, parseShareAmount);
    if (!fundReference || percent === null || amount === null || levy === null) return;
    if ((percent > 0 && amount > 0) || percent + amount + levy === 0) return;
    const planOption = typeof raw.planOption === 'string' && raw.planOption.trim() ? raw.planOption.trim() : null;
    rules.set(`${fundReference}|${lower(planOption)}`, {
      fundReference,
      planOption,
      percent,
      ...(amount > 0 ? { amount } : {}),
      ...(levy > 0 ? { levy } : {})
    });
  });
  return [...rules.values()].sort((a, b) => a.fundReference.localeCompare(b.fundReference) || (a.planOption ?? '').localeCompare(b.planOption ?? ''));
}

/** The co-payment for a patient's fund and plan options: the plan option's own rule first, then the fund's. */
export function copayFor(rules: readonly CopayRule[], fund: { reference: string | null; planOptions: readonly string[] } | null): CopayRule | null {
  const reference = upper(fund?.reference);
  if (!fund || !reference) return null;
  const plans = new Set(fund.planOptions.map(lower).filter(Boolean));
  const ofFund = rules.filter(rule => upper(rule.fundReference) === reference);
  return ofFund.find(rule => rule.planOption !== null && plans.has(lower(rule.planOption))) ?? ofFund.find(rule => rule.planOption === null) ?? null;
}

/** What a fund's rule asks of the patient, as the line and invoice builders take it (all 0 without a rule). */
export interface PatientShare {
  copayPercent: number;
  /** N$ per line */
  copayAmount: number;
  /** N$ once per invoice */
  levy: number;
}

export const shareOf = (rule: CopayRule | null | undefined): PatientShare => ({
  copayPercent: rule?.percent ?? 0,
  copayAmount: rule?.amount ?? 0,
  levy: rule?.levy ?? 0
});

/** The rule in plain words: "5% of each line", "N$ 50.00 of each line and a N$ 20.00 levy per visit". */
export function describeCopayRule(rule: Pick<CopayRule, 'percent' | 'amount' | 'levy'>): string {
  const parts: string[] = [];
  if (rule.percent > 0) parts.push(`${rule.percent}% of each line`);
  if ((rule.amount ?? 0) > 0) parts.push(`${formatNad(rule.amount ?? 0)} of each line`);
  if ((rule.levy ?? 0) > 0) parts.push(`a ${formatNad(rule.levy ?? 0)} levy per visit`);
  return parts.join(' and ');
}

export interface LineSplit {
  fundCents: number;
  patientCents: number;
  /** The co-payment part of patientCents */
  copayCents: number;
}

/** Splits a line total (cents) between the fund and the patient. */
export function splitLineCents(input: {
  totalCents: number;
  hasMedicalAid: boolean;
  copayPercent?: number | null;
  /** A fixed co-payment per line in N$ (instead of a percentage) */
  copayAmount?: number | null;
  /** The line is paid by one side only */
  paidBy?: PaidBy | null;
}): LineSplit {
  const { totalCents } = input;
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new RangeError(`A line total must be whole, non-negative cents: ${totalCents}`);
  if (!input.hasMedicalAid || input.paidBy === 'patient') return { fundCents: 0, patientCents: totalCents, copayCents: 0 };
  if (input.paidBy === 'fund') return { fundCents: totalCents, patientCents: 0, copayCents: 0 };
  const percent = input.copayPercent ?? 0;
  const amount = input.copayAmount ?? 0;
  if (percent !== 0 && parseCopayPercent(percent) === null) throw new RangeError(`A co-payment must be more than 0% and at most 100%: ${percent}`);
  if (amount !== 0 && parseShareAmount(amount) === null) throw new RangeError(`A fixed co-payment must be a positive amount in whole cents: ${amount}`);
  if (percent !== 0 && amount !== 0) throw new RangeError('A co-payment is a percentage or a fixed amount, not both');
  const copayCents = percent !== 0 ? percentOfCents(totalCents, percent) : Math.min(toCents(amount), totalCents);
  return { fundCents: totalCents - copayCents, patientCents: copayCents, copayCents };
}

/** A line's split as the levy needs it. */
export interface LevyLine {
  fundCents: number;
  patientCents: number;
  /** False for lines the levy never comes from: private patients' lines and lines paid by one side only */
  levyApplies: boolean;
}

/**
 * Takes a levy (whole cents, once per invoice) off the fund's share of the lines and puts it on the patient's, first
 * line first, each line at most its fund share. Returns the lines with their new split and the levy charged, which is
 * less than asked only when the fund's share of the whole invoice is smaller. Every line still adds up to its total.
 */
export function applyLevy<T extends LevyLine>(lines: readonly T[], levyCents: number): { lines: T[]; levyCents: number } {
  if (!Number.isInteger(levyCents) || levyCents < 0) throw new RangeError(`A levy must be whole, non-negative cents: ${levyCents}`);
  let remaining = levyCents;
  const result = lines.map(line => {
    if (remaining === 0 || !line.levyApplies || line.fundCents <= 0) return line;
    const moved = Math.min(remaining, line.fundCents);
    remaining -= moved;
    return { ...line, fundCents: line.fundCents - moved, patientCents: line.patientCents + moved };
  });
  return { lines: result, levyCents: levyCents - remaining };
}

/** The practice's default portion per tariff code (code in capitals): codes without one follow the fund's rules. */
export type TariffPortions = ReadonlyMap<string, PaidBy>;

/** The default portions from the stored setting: entries without a code or with an unknown portion are left out. */
export function parseTariffPortions(value: unknown): Map<string, PaidBy> {
  const portions = new Map<string, PaidBy>();
  (Array.isArray(value) ? value : []).forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const raw = entry as Record<string, unknown>;
    const code = upper(raw.code);
    if (/^[0-9A-Z]{1,10}$/.test(code) && isPaidBy(raw.paidBy)) portions.set(code, raw.paidBy);
  });
  return portions;
}

/** The setting value for a set of default portions, in code order. */
export const tariffPortionsSetting = (portions: TariffPortions): { code: string; paidBy: PaidBy }[] =>
  [...portions.entries()].map(([code, paidBy]) => ({ code, paidBy })).sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));

/** The longest authorisation number a claim line carries (claim field 31). */
export const MAX_AUTHORISATION_LENGTH = 21;

/**
 * A fund's authorisation number as the claim carries it (outer spaces off), or why it cannot be used: 1-21 letters,
 * digits, '/', '.' or '-' (no spaces or commas, which would break the claim file). Empty means none (null).
 */
export function parseAuthorisationNumber(value: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') return { ok: true, value: null };
  if (text.length > MAX_AUTHORISATION_LENGTH || !/^[A-Za-z0-9/.-]+$/.test(text)) {
    return { ok: false, message: `An authorisation number has at most ${MAX_AUTHORISATION_LENGTH} letters or digits (no spaces or commas).` };
  }
  return { ok: true, value: text };
}

export type DiscountResult = { ok: true; discountCents: number; netCents: number } | { ok: false; message: string };

/**
 * Takes a discount off a line (private patients only). The discount may not be negative, have more than 2 decimals
 * or be more than the line.
 */
export function applyLineDiscount(input: { code?: string; grossCents: number; discount: number | null | undefined; hasMedicalAid: boolean }): DiscountResult {
  const label = input.code ? `Code ${input.code}` : 'This line';
  const discount = input.discount ?? 0;
  if (discount === 0) return { ok: true, discountCents: 0, netCents: input.grossCents };
  if (typeof discount !== 'number' || !Number.isFinite(discount) || discount < 0 || !hasAtMostDecimals(discount, 2)) {
    return { ok: false, message: `${label}: the discount must be an amount in N$ with at most 2 decimals.` };
  }
  if (input.hasMedicalAid) {
    return { ok: false, message: `${label}: a medical aid line is claimed at the agreed price, so it cannot be discounted. Discounts are for private patients.` };
  }
  const discountCents = toCents(discount);
  if (discountCents > input.grossCents) {
    return { ok: false, message: `${label}: the discount ${formatNad(discount)} is more than the line (${formatNad(fromCents(input.grossCents))}).` };
  }
  return { ok: true, discountCents, netCents: input.grossCents - discountCents };
}
