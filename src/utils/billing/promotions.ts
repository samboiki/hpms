/**
 * Promotions (parity D18): a percentage or an amount off chosen codes from one day to another, set by a practice
 * administrator (Admin > Tariffs > Contracts and co-payments) and applied on the visit's Billing tab to a private patient's
 * line as its discount, with the promotion named on the line (invoice_services.promotion_id). Discounts given lists it
 * under the promotion's name (Finance > Reports > Discounts given).
 *
 * A medical aid line is claimed at the agreed price, so it is never discounted (lineSplit.ts applyLineDiscount): a
 * promotion applies to private patients only. A line paid from a prepaid package, a line priced by its rule (8346) and a
 * line with a discount typed by hand keep what they have. Two promotions never cover the same code on the same day (the
 * database refuses it). Money is in whole cents.
 */
import { formatServiceDate, isValidDateKey } from './dates';
import { formatNad, fromCents, hasAtMostDecimals, percentOfCents, toCents } from './money';
import { coversCode, formatCodeList, parseCodeList } from './codeList';
import type { ServiceSelection } from '../../types/billing';

export type PromotionKind = 'percent' | 'amount';

export interface Promotion {
  id: string;
  name: string;
  kind: PromotionKind;
  /** percent: the percentage; amount: N$ off each unit, in cents */
  percent: number | null;
  amountCents: number | null;
  codes: string[];
  startsOn: string;
  endsOn: string;
  /** Ended early: it applies to nothing new */
  endedAt: string | null;
}

export interface PromotionRow {
  id: string;
  name: string;
  kind: string;
  value: number | string;
  codes: string[] | null;
  starts_on: string;
  ends_on: string;
  ended_at?: string | null;
}

export const PROMOTION_LIMITS = { nameMin: 2, nameMax: 60, maxCodes: 50, maxDays: 731, maxAmountCents: 100_000_000 } as const;

/** A stored promotion, or null when it cannot be used (an unknown kind) */
export function normalizePromotion(row: PromotionRow): Promotion | null {
  if (row.kind !== 'percent' && row.kind !== 'amount') return null;
  const value = Number(row.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    percent: row.kind === 'percent' ? value : null,
    amountCents: row.kind === 'amount' ? toCents(value) : null,
    codes: row.codes ?? [],
    startsOn: row.starts_on.slice(0, 10),
    endsOn: row.ends_on.slice(0, 10),
    endedAt: row.ended_at ?? null
  };
}

export const promotionActiveOn = (promotion: Promotion, dateKey: string): boolean =>
  promotion.endedAt === null && promotion.startsOn <= dateKey && dateKey <= promotion.endsOn;

export type PromotionState = 'running' | 'upcoming' | 'over' | 'ended';

export function promotionState(promotion: Promotion, todayKey: string): PromotionState {
  if (promotion.endedAt) return 'ended';
  if (todayKey < promotion.startsOn) return 'upcoming';
  if (todayKey > promotion.endsOn) return 'over';
  return 'running';
}

/** The promotion covering a code on a day; null when none does */
export function promotionFor(promotions: readonly Promotion[], code: string, dateKey: string): Promotion | null {
  return promotions.find(promotion => promotionActiveOn(promotion, dateKey) && coversCode(promotion.codes, code)) ?? null;
}

/** What a promotion takes off a line worth `grossCents` (unit price x quantity): never more than the line */
export function promotionDiscountCents(promotion: Promotion, grossCents: number, quantity: number): number {
  if (!Number.isInteger(grossCents) || grossCents <= 0) return 0;
  const off = promotion.kind === 'percent'
    ? percentOfCents(grossCents, promotion.percent ?? 0)
    : Math.round((promotion.amountCents ?? 0) * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1));
  return Math.min(off, grossCents);
}

/** "10% off" or "N$ 50.00 off each" */
export const describeOffer = (promotion: Pick<Promotion, 'kind' | 'percent' | 'amountCents'>): string =>
  promotion.kind === 'percent' ? `${promotion.percent}% off` : `${formatNad(fromCents(promotion.amountCents ?? 0))} off each`;

/** "10% off 0190, 8261 from 13 Oct 2026 to 12 Nov 2026" */
export const describePromotion = (promotion: Promotion): string =>
  `${describeOffer(promotion)} ${formatCodeList(promotion.codes)} from ${formatServiceDate(promotion.startsOn)} to ${formatServiceDate(promotion.endsOn)}`;

// ---------------------------------------------------------------------------------------------
// The administrator's form
// ---------------------------------------------------------------------------------------------

export interface PromotionDraft {
  id?: string;
  name: string;
  kind: PromotionKind;
  value: string;
  codes: string;
  startsOn: string;
  endsOn: string;
}

export interface PromotionPayload {
  id: string | null;
  practice_id: string;
  name: string;
  kind: PromotionKind;
  value: number;
  codes: string[];
  starts_on: string;
  ends_on: string;
}

const MS_PER_DAY = 86_400_000;
const dayNumber = (key: string): number => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / MS_PER_DAY;

/** The payload billing_save_promotion takes, or what to fix (the database checks the same) */
export function promotionPayload(draft: PromotionDraft, practiceId: string): { payload: PromotionPayload; error: null } | { payload: null; error: string } {
  const fail = (error: string) => ({ payload: null, error });
  const name = draft.name.trim();
  if (name.length < PROMOTION_LIMITS.nameMin || name.length > PROMOTION_LIMITS.nameMax) return fail('Give the promotion a name of 2 to 60 characters.');
  const text = draft.value.trim().replace(/^N\$\s*/i, '').replace(/\s*%$/, '').replace(/,/g, '');
  const value = /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : NaN;
  if (!Number.isFinite(value) || value <= 0 || !hasAtMostDecimals(value, 2)) {
    return fail(draft.kind === 'percent' ? 'The percentage is a number such as 10 or 12.5.' : 'The amount off is in N$, for example 50 or 50.00.');
  }
  if (draft.kind === 'percent' && value > 100) return fail('A percentage is at most 100.');
  if (draft.kind === 'amount' && toCents(value) > PROMOTION_LIMITS.maxAmountCents) return fail('The amount off is too large.');
  const codes = parseCodeList(draft.codes, PROMOTION_LIMITS.maxCodes);
  if (codes.error !== null) return fail(codes.error);
  if (!isValidDateKey(draft.startsOn) || !isValidDateKey(draft.endsOn)) return fail('Choose the first and the last day of the promotion.');
  if (draft.endsOn < draft.startsOn) return fail('The last day cannot be before the first day.');
  if (dayNumber(draft.endsOn) - dayNumber(draft.startsOn) > PROMOTION_LIMITS.maxDays) return fail('A promotion runs for at most two years.');
  return {
    payload: { id: draft.id ?? null, practice_id: practiceId, name, kind: draft.kind, value, codes: codes.codes, starts_on: draft.startsOn, ends_on: draft.endsOn },
    error: null
  };
}

export function draftFromPromotion(promotion: Promotion | null, todayKey: string, endKey: string): PromotionDraft {
  if (!promotion) return { name: '', kind: 'percent', value: '', codes: '', startsOn: todayKey, endsOn: endKey };
  return {
    id: promotion.id,
    name: promotion.name,
    kind: promotion.kind,
    value: promotion.kind === 'percent' ? String(promotion.percent ?? '') : fromCents(promotion.amountCents ?? 0).toFixed(2),
    codes: formatCodeList(promotion.codes),
    startsOn: promotion.startsOn,
    endsOn: promotion.endsOn
  };
}

// ---------------------------------------------------------------------------------------------
// The visit's lines
// ---------------------------------------------------------------------------------------------

type BillLine = Pick<ServiceSelection, 'id' | 'code' | 'unitPrice' | 'quantity' | 'serviceDate' | 'discountAmount' | 'promotionId' | 'packageId' | 'isAutoGenerated'>;

/** A line's gross (unit price x quantity) in cents; 0 when it cannot be priced */
const grossOf = (line: BillLine): number => {
  const unit = Number(line.unitPrice);
  const quantity = Number(line.quantity);
  if (!Number.isFinite(unit) || !Number.isFinite(quantity) || unit <= 0 || quantity <= 0) return 0;
  return Math.round(toCents(unit) * quantity);
};

/** Whether a line can take a promotion at all (see the file comment) */
export const promotionCanApply = (line: BillLine, hasMedicalAid: boolean): boolean =>
  !hasMedicalAid && !line.packageId && !line.isAutoGenerated && !((line.discountAmount ?? 0) > 0 && !line.promotionId);

export interface AppliedPromotion {
  lineId: string;
  code: string;
  promotion: Promotion;
  discountCents: number;
}

/**
 * The lines with a promotion put on each line in `lineIds` it covers on the line's day (its own date, else the visit's),
 * and what was applied. Lines it cannot apply to are left exactly as they are.
 */
export function applyPromotions<T extends BillLine>(
  lines: readonly T[],
  promotions: readonly Promotion[],
  options: { hasMedicalAid: boolean; visitDateKey: string; lineIds: ReadonlySet<string> }
): { lines: T[]; applied: AppliedPromotion[] } {
  const applied: AppliedPromotion[] = [];
  const next = lines.map(line => {
    if (!options.lineIds.has(line.id) || line.promotionId || !promotionCanApply(line, options.hasMedicalAid)) return line;
    const promotion = promotionFor(promotions, line.code, line.serviceDate || options.visitDateKey);
    if (!promotion) return line;
    const discountCents = promotionDiscountCents(promotion, grossOf(line), Number(line.quantity));
    if (discountCents <= 0) return line;
    applied.push({ lineId: line.id, code: line.code, promotion, discountCents });
    return { ...line, discountAmount: fromCents(discountCents), promotionId: promotion.id };
  });
  return { lines: next, applied };
}

/** The line without its promotion: no discount, nothing named */
export function withoutPromotion<T extends BillLine>(line: T): T {
  const { promotionId: _promotion, ...rest } = line;
  void _promotion;
  return { ...rest, discountAmount: undefined } as T;
}

/** A promoted line as this screen last saw it: its discount and its gross, in cents */
export interface PromotedLineSeen {
  discountCents: number;
  grossCents: number;
}

/**
 * Keeps each promoted line right while the visit is billed: a line seen for the first time (opened from a saved
 * invoice, or just promoted) is left as it is; when its quantity or price changes the discount follows the promotion;
 * when staff type another discount the line keeps that discount without the promotion's name; a medical aid patient's
 * line loses the discount (a fund line is claimed at the agreed price). Returns the lines (the same array when nothing
 * changed) and how each promoted line now stands.
 */
export function syncPromotedLines<T extends BillLine>(
  lines: readonly T[],
  promotions: readonly Promotion[],
  options: { hasMedicalAid: boolean; seen: ReadonlyMap<string, PromotedLineSeen> }
): { lines: readonly T[]; seen: Map<string, PromotedLineSeen> } {
  const seen = new Map<string, PromotedLineSeen>();
  let changed = false;
  const next = lines.map(line => {
    if (!line.promotionId) return line;
    if (options.hasMedicalAid) {
      changed = true;
      return withoutPromotion(line);
    }
    const gross = grossOf(line);
    const current = toCents(line.discountAmount ?? 0);
    const before = options.seen.get(line.id);
    if (before && before.discountCents !== current) {
      // Typed by hand: the discount stays, it is no longer the promotion's
      changed = true;
      return { ...line, promotionId: undefined } as T;
    }
    const promotion = promotions.find(item => item.id === line.promotionId);
    if (!before || before.grossCents === gross || !promotion) {
      seen.set(line.id, { discountCents: current, grossCents: gross });
      return line;
    }
    const wanted = promotionDiscountCents(promotion, gross, Number(line.quantity));
    seen.set(line.id, { discountCents: wanted, grossCents: gross });
    if (wanted === current) return line;
    changed = true;
    return wanted > 0 ? { ...line, discountAmount: fromCents(wanted) } : withoutPromotion(line);
  });
  return { lines: changed ? next : lines, seen };
}
