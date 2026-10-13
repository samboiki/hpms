import { formatNad, fromCents, hasAtMostDecimals, percentOfCents } from '../../utils/billing/money';
import { isEffective, type ArAdjustment, type PortionCents } from './arModel';
import { canGiveDiscounts } from './arRules';

// ---------------------------------------------------------------------------------------------
// Discounts on an invoice (parity D19). A discount is its own entry on the invoice
// (invoice_adjustments kind 'discount', numbered DS-000001), like a credit note: the invoice and
// its lines never change, so claim lines already sent to a fund keep their amounts. It comes off
// what the PATIENT pays only; the medical aid is claimed at the agreed price. It is never more than
// the patient still owes on the invoice, a percentage is of what the patient was charged there, and
// only an administrator or a practitioner gives one. The database checks the same
// (proposals/2026-10-13-discounts-and-statements.sql). Amounts are whole cents.
// ---------------------------------------------------------------------------------------------

export type DiscountReason = 'loyal' | 'pensioner' | 'staff' | 'courtesy' | 'paid_on_day' | 'hardship' | 'goodwill' | 'other';

/** Why a discount is given; the database accepts exactly these codes (invoice_adjustments_discount_rules) */
export const DISCOUNT_REASONS: ReadonlyArray<{ code: DiscountReason; label: string }> = [
  { code: 'loyal', label: 'Loyal or long-standing patient' },
  { code: 'pensioner', label: 'Pensioner' },
  { code: 'staff', label: 'Staff member or their family' },
  { code: 'courtesy', label: 'Professional courtesy (a colleague)' },
  { code: 'paid_on_day', label: 'Paid in full on the day' },
  { code: 'hardship', label: 'Cannot afford the full amount' },
  { code: 'goodwill', label: 'Goodwill (a complaint or a long wait)' },
  { code: 'other', label: 'Other (say why)' }
];

export const isDiscountReason = (code: unknown): code is DiscountReason => DISCOUNT_REASONS.some(reason => reason.code === code);

export const discountReasonLabel = (code: string | null | undefined): string =>
  DISCOUNT_REASONS.find(reason => reason.code === code)?.label ?? 'Discount';

/** The longest note kept with a discount */
export const DISCOUNT_NOTE_MAX = 200;

const nad = (cents: number): string => formatNad(fromCents(cents));

/**
 * What a percentage discount is of: what the patient was charged on the invoice, their portion as
 * billed plus any unpaid medical aid amount moved to them. The medical aid's portion is never part
 * of it.
 */
export const discountBaseCents = (input: { billed: PortionCents; shortfallCents: number }): number =>
  Math.max(input.billed.patient + Math.max(input.shortfallCents, 0), 0);

/** A percentage typed by staff ("10", "12.5", "12,5 %"); null unless more than 0 and at most 100, with at most 2 decimals */
export function parsePercentInput(text: string): number | null {
  const cleaned = text.replace(/%/g, '').replace(',', '.').trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 100 || !hasAtMostDecimals(value, 2)) return null;
  return value;
}

/** A percentage as printed: 10 -> "10%", 12.5 -> "12.5%" */
export const percentText = (percent: number): string => `${Number(percent.toFixed(2))}%`;

export type DiscountMode = 'amount' | 'percent';

export interface DiscountDraft {
  mode: DiscountMode;
  /** The amount typed, in cents (amount mode); null when it is not an amount */
  amountCents: number | null;
  /** The percentage typed (percent mode); null when it is not a percentage */
  percent: number | null;
  reasonCode: DiscountReason | '';
  /** Free text: needed for "Other", optional otherwise */
  note: string;
}

export interface DiscountContext {
  /** What the patient was charged on the invoice (discountBaseCents) */
  baseCents: number;
  /** What the patient still owes on the invoice now */
  patientOwesCents: number;
}

/** What is saved: the amount (worked out from a percentage to the cent), the percentage and the reason */
export interface DiscountPlan {
  amountCents: number;
  percent: number | null;
  reasonCode: DiscountReason;
  /** The note, else the reason's words: kept with the entry and shown on the account */
  reason: string;
}

export type DiscountCheck = { ok: true; plan: DiscountPlan; error: null } | { ok: false; plan: null; error: string };

const refuse = (error: string): DiscountCheck => ({ ok: false, plan: null, error });

/**
 * Checks a discount before it is saved and works out what is stored. The reasons a practice gets
 * for a refusal say what to do instead: a medical aid that should be charged less needs a claim
 * correction (credit note), and money already paid is given back with a credit note and a refund.
 */
export function planDiscount(draft: DiscountDraft, context: DiscountContext, role: string | null | undefined): DiscountCheck {
  if (!canGiveDiscounts(role)) return refuse('Only a practice administrator or practitioner can give a discount. Ask one of them.');
  if (context.patientOwesCents <= 0) {
    return refuse('The patient owes nothing on this invoice, so there is nothing to discount. A discount never lowers what the medical aid is claimed: to charge the fund less, use a credit note.');
  }
  let amountCents: number;
  let percent: number | null = null;
  if (draft.mode === 'percent') {
    if (draft.percent === null) return refuse('Enter a percentage such as 10 (more than 0, at most 100)');
    if (context.baseCents <= 0) return refuse('The patient was charged nothing on this invoice to take a percentage of');
    percent = draft.percent;
    amountCents = percentOfCents(context.baseCents, percent);
    if (amountCents <= 0) return refuse('That percentage comes to less than one cent');
  } else {
    if (draft.amountCents === null || !Number.isInteger(draft.amountCents) || draft.amountCents <= 0) return refuse('Enter the discount in N$ and cents, such as 50.00');
    amountCents = draft.amountCents;
  }
  if (amountCents > context.patientOwesCents) {
    return refuse(`A discount cannot be more than the ${nad(context.patientOwesCents)} the patient still owes on this invoice. Money already paid is given back with a credit note and a refund.`);
  }
  if (!draft.reasonCode) return refuse('Choose why the discount is given');
  const note = draft.note.trim();
  if (draft.reasonCode === 'other' && note.length < 3) return refuse('Say in a few words why the discount is given');
  if (note.length > DISCOUNT_NOTE_MAX) return refuse(`Keep the note under ${DISCOUNT_NOTE_MAX} characters`);
  return {
    ok: true,
    error: null,
    plan: { amountCents, percent, reasonCode: draft.reasonCode, reason: note || discountReasonLabel(draft.reasonCode) }
  };
}

/** How a discount's reason reads on the invoice, statements and lists: "Pensioner", "Pensioner: as agreed", or the note for "Other" */
export function discountReasonText(adjustment: Pick<ArAdjustment, 'reasonCode' | 'reason'>): string {
  const note = adjustment.reason.trim();
  if (adjustment.reasonCode === 'other' || !isDiscountReason(adjustment.reasonCode)) return note || 'Discount';
  const label = discountReasonLabel(adjustment.reasonCode);
  return note && note !== label ? `${label}: ${note}` : label;
}

/** The discounts still standing on an invoice (taken-back ones no longer count), oldest first, and their total */
export function standingDiscounts(adjustments: readonly ArAdjustment[]): { discounts: ArAdjustment[]; totalCents: number } {
  const discounts = adjustments
    .filter(adjustment => adjustment.kind === 'discount' && isEffective(adjustment))
    .sort((a, b) => (a.effectiveOn ?? '').localeCompare(b.effectiveOn ?? '') || a.number.localeCompare(b.number));
  return { discounts, totalCents: discounts.reduce((sum, discount) => sum + discount.amountCents, 0) };
}

/** What standing discounts take off each portion (always the patient's), for an invoice's money table */
export function discountedPortions(adjustments: readonly ArAdjustment[]): PortionCents {
  const result = { medical_aid: 0, patient: 0 };
  for (const discount of standingDiscounts(adjustments).discounts) {
    if (discount.portion) result[discount.portion] += discount.amountCents;
  }
  return result;
}
