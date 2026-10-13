/**
 * Several practitioners in one practice (parity D31): who bills each line, and at what rate.
 *
 * - A partner can bill their own work under their own practice number: claim field 29 is the "treating doctor's
 *   practice number" (claim specification). Each practitioner's own number is kept with their staff record
 *   (practitioner_billing, set by a practice administrator; proposals/2026-10-12-line-teeth-and-billing-practitioners.sql).
 *   A line bills under its treating practitioner's own number when they have one, else under the practice's; the claim
 *   file's header keeps the practice's number. The database's claim builder applies the same rule.
 * - A practitioner can charge their own rate: a percentage of the practice's price list (120 = a fifth above it). It
 *   prices the lines they treat that come from the practice's price list; a fund's own agreed price is never changed,
 *   and a fee changed by hand on a line stays as it is.
 * Pure (no database), so the rules are tested directly. Explicit .ts imports: the claim modules use it.
 */
import { fromCents, toCents } from './money.ts';

export interface PractitionerBilling {
  /** Their own practice number; null: the practice's */
  practiceNumber: string | null;
  /** Their rate as a percentage of the practice's price list; null: the list itself */
  ratePercent: number | null;
}

/** By users.id */
export type PractitionerBillingMap = ReadonlyMap<string, PractitionerBilling>;

export const NO_PRACTITIONER_BILLING: PractitionerBillingMap = new Map();

/** A practice number has 7 to 15 digits (Namibian numbers 13, with a leading zero): the claim checks' rule too. */
export const PRACTICE_NUMBER_PATTERN = /^\d{7,15}$/;
export const MIN_RATE_PERCENT = 10;
export const MAX_RATE_PERCENT = 500;

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/** A practice number as typed: spaces taken out; empty is none (the practice's number applies). */
export function parsePracticeNumber(input: string | null | undefined): Parsed<string | null> {
  const value = (input ?? '').replace(/\s+/g, '');
  if (!value) return { ok: true, value: null };
  return PRACTICE_NUMBER_PATTERN.test(value) ? { ok: true, value } : { ok: false, message: 'A practice number has 7 to 15 digits, without letters.' };
}

/** A rate as typed ("120", "120%", "95.5"); empty or 100 is none (the price list as it is). */
export function parseRatePercent(input: string | number | null | undefined): Parsed<number | null> {
  const text = typeof input === 'number' ? String(input) : (input ?? '').replace(/[%\s]/g, '');
  if (!text) return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { ok: false, message: 'Enter the rate as a percentage of the price list, for example 120 or 95.5.' };
  const value = Number(text);
  if (value < MIN_RATE_PERCENT || value > MAX_RATE_PERCENT) {
    return { ok: false, message: `A rate is from ${MIN_RATE_PERCENT}% to ${MAX_RATE_PERCENT}% of the price list.` };
  }
  return { ok: true, value: value === 100 ? null : value };
}

/** A unit price at a rate: the list price x rate / 100, to the cent (half up); the list price itself without a rate. */
export function priceAtRate(listPrice: number, ratePercent: number | null | undefined): number {
  if (ratePercent === null || ratePercent === undefined || ratePercent === 100 || !Number.isFinite(listPrice)) return listPrice;
  // Whole numbers only: 120.5% is 12050 hundredths of a percent, so no floating-point drift reaches the cents
  const hundredths = Math.round(ratePercent * 100);
  return fromCents(Math.round((toCents(listPrice) * hundredths) / 10000));
}

/** The rate of a practitioner (null: the price list as it is). */
export const rateOf = (practitionerId: string | null | undefined, billing: PractitionerBillingMap): number | null =>
  (practitionerId ? billing.get(practitionerId)?.ratePercent : null) ?? null;

/** "120% of the price list"; '' without a rate. */
export const describeRate = (ratePercent: number | null | undefined): string =>
  ratePercent === null || ratePercent === undefined || ratePercent === 100 ? '' : `${ratePercent}% of the price list`;

/** The practice number a line bills under (claim field 29): its practitioner's own, else the practice's. */
export function billingPracticeNumber(
  practitionerId: string | null | undefined,
  billing: PractitionerBillingMap,
  practiceNumber: string | null | undefined
): { number: string; own: boolean } {
  const own = (practitionerId ? billing.get(practitionerId)?.practiceNumber : null)?.trim();
  return own ? { number: own, own: true } : { number: (practiceNumber ?? '').trim(), own: false };
}

export interface PractitionerBillingRow {
  user_id: string;
  practice_number: string | null;
  rate_percent: number | string | null;
}

/** practitioner_billing rows as the map the screens use; a row with nothing set is left out. */
export function practitionerBillingFromRows(rows: readonly PractitionerBillingRow[]): Map<string, PractitionerBilling> {
  const map = new Map<string, PractitionerBilling>();
  rows.forEach(row => {
    const number = parsePracticeNumber(row.practice_number);
    const rate = parseRatePercent(row.rate_percent === null ? null : Number(row.rate_percent));
    const practiceNumber = number.ok ? number.value : null;
    const ratePercent = rate.ok ? rate.value : null;
    if (row.user_id && (practiceNumber || ratePercent !== null)) map.set(row.user_id, { practiceNumber, ratePercent });
  });
  return map;
}
