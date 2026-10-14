/**
 * A practice's own tariff list (parity E13): codes the practice adds or prices itself, on top of the shared list of
 * its practice type (practice_tariffs, normally the NAMAF benchmark, shared by every practice of the type).
 *
 * Business rules (practice owner: "one practice never changes another's prices"):
 * - Own codes are stored per practice (practice_own_tariffs, proposals/2026-10-09-practice-own-tariffs.sql), so a
 *   practice administrator can add or reprice a code without touching the shared list or another practice.
 * - The practice's own list wins: from the first date its own version of a code applies, the shared versions of that
 *   code no longer do (also next year's). Before that date the shared price still applies, so a visit dated before
 *   the change keeps the price of its date (mergeOwnTariffs).
 * - An own code is versioned like the shared list: a new price from a date adds a version; billing picks the newest
 *   version in effect on the service date (selectBillableTariffs). Removing an own code puts the shared price back.
 * - Codes are 1-10 capitals and digits (as on claims), descriptions 1-200 characters, prices N$ 0 to 1,000,000 in
 *   whole cents, "once per line" or "per unit", and whether the line needs a tooth (dental practices).
 *
 * No imports outside src/utils/billing, so the module stays pure and testable.
 */
import { hasAtMostDecimals } from './money.ts';
import { addDaysToKey, isValidDateKey, toDateKey } from './dates.ts';
import { MAX_UNIT_PRICE, selectBillableTariffs, type TariffRow } from './pricing.ts';
import { isDentalPractice } from './tariffRules.ts';
import type { PaidBy, TariffPortions } from './lineSplit.ts';
import type { CodeRules } from './codeRules.ts';

/** A practice_own_tariffs row as it is read. */
export interface OwnTariffRow {
  id: string;
  practice_id: string;
  code: string;
  description: string | null;
  price: number | string | null;
  can_be_multiplied: string | null;
  requires_tooth_number: string | null;
  effective_from: string | null;
  is_active: boolean | null;
  updated_at?: string | null;
}

/** A tariff row as billing reads it (the practice_tariffs_with_types fields), own or shared. */
export interface PracticeTariffLike {
  id: string;
  code: string;
  description: string | null;
  price: number | string | null;
  unit: string | null;
  is_active: boolean | null;
  effective_from: string | null;
  effective_to: string | null;
  can_be_multiplied: string | null;
  requires_tooth_number: string | null;
  business_rule_formula: string | null;
  example_calculation: string | null;
  notes: string | null;
  /** True for the practice's own version of the code (Admin > Tariffs) */
  is_own?: boolean;
  /** Who pays new lines of the code by default (the practice's default portion); absent: the fund's rules */
  default_paid_by?: PaidBy | null;
  /** What happens when the code is billed (the practice's rules, codeRules.ts); absent or null: nothing extra */
  code_rules?: CodeRules | null;
}

export const OWN_CODE_PATTERN = /^[0-9A-Z]{1,10}$/;
export const MAX_OWN_DESCRIPTION = 200;

const codeKey = (code: string | null | undefined): string => (code ?? '').trim().toUpperCase();

/** An own tariff row in the shape of a shared one. */
export function ownTariffAsRow(row: OwnTariffRow): PracticeTariffLike {
  return {
    id: row.id,
    code: codeKey(row.code),
    description: row.description,
    price: row.price,
    unit: null,
    is_active: row.is_active !== false,
    effective_from: row.effective_from,
    effective_to: null,
    can_be_multiplied: row.can_be_multiplied,
    requires_tooth_number: row.requires_tooth_number,
    business_rule_formula: null,
    example_calculation: null,
    notes: null,
    is_own: true
  };
}

/**
 * The tariff rows a practice bills from: the shared rows, with every code the practice prices itself taken over by its
 * own versions from the first date they apply. A shared version that starts on or after that date is left out; one
 * that started before ends the day before. Inactive own rows (removed codes) change nothing.
 */
export function mergeOwnTariffs<T extends { code: string | null; effective_from?: string | null; effective_to?: string | null }>(
  shared: readonly T[],
  own: readonly OwnTariffRow[]
): Array<T | PracticeTariffLike> {
  const active = own.filter(row => row.is_active !== false && OWN_CODE_PATTERN.test(codeKey(row.code)) && isValidDateKey(toDateKey(row.effective_from ?? null)));
  const firstOwnDate = new Map<string, string>();
  active.forEach(row => {
    const code = codeKey(row.code);
    const from = toDateKey(row.effective_from ?? null) as string;
    const known = firstOwnDate.get(code);
    if (!known || from < known) firstOwnDate.set(code, from);
  });
  const kept = shared.flatMap(row => {
    const takeover = firstOwnDate.get(codeKey(row.code));
    if (!takeover) return [row];
    const from = row.effective_from ? toDateKey(row.effective_from) : null;
    if (from && from >= takeover) return [];
    const lastDay = addDaysToKey(takeover, -1);
    const to = row.effective_to ? toDateKey(row.effective_to) : null;
    return [{ ...row, effective_to: to && to < lastDay ? row.effective_to : lastDay }];
  });
  return [...kept, ...active.map(ownTariffAsRow)];
}

/** Whether a line of `code` given on `serviceDate` (yyyy-MM-dd) needs a tooth number; null when that cannot be told. */
export type ToothRule = (code: string, serviceDate: string | null | undefined) => boolean | null;

/**
 * Whether a line needs a tooth number, decided as the visit's billing decides it, so claim review never asks for a
 * tooth the visit did not ask for, nor lets through a line the visit would have stopped:
 * - `rows` have the practice's own codes merged in (mergeOwnTariffs, as loadPracticeTariffRows reads them): its own
 *   "needs a tooth" for a code it overrides (Admin > Tariffs), else the shared list's;
 * - the version of the code billed on the line's date counts (selectBillableTariffs, as billableVisitTariffs);
 * - only dental practices number teeth (isDentalPractice, as withDisciplineRules);
 * - a dental specialist's NAMAF codes are not in `rows` (its shared list is empty), so a code no row of the practice speaks
 *   for takes the dentist's rule, as the visit gives it (`dentistToothCodes`, namafTariffs.ts withDentistToothFlags).
 * Null when no version of the code is billed on that date, or the date is unknown: the tooth is then not checked.
 */
export function toothRuleFor(rows: readonly TariffRow[], practiceType: string | null | undefined, dentistToothCodes?: ReadonlySet<string>): ToothRule {
  if (!isDentalPractice(practiceType)) return () => false;
  const flagsByDate = new Map<string, ReadonlyMap<string, boolean>>();
  return (code, serviceDate) => {
    if (!isValidDateKey(serviceDate)) return null;
    let flags = flagsByDate.get(serviceDate);
    if (!flags) {
      flags = new Map(selectBillableTariffs(rows, serviceDate).tariffs.map(tariff => [codeKey(tariff.code), tariff.requiresTooth]));
      flagsByDate.set(serviceDate, flags);
    }
    // A row of the practice (its own code, or its type's shared one) always speaks first, YES or NO
    return flags.get(codeKey(code)) ?? (dentistToothCodes?.has(codeKey(code)) ? true : null);
  };
}

/** Rows with the practice's default portion per code attached (default_paid_by), for the line builders. */
export function withDefaultPortions<T extends { code: string | null }>(rows: readonly T[], portions: TariffPortions): Array<T & { default_paid_by: PaidBy | null }> {
  return rows.map(row => ({ ...row, default_paid_by: portions.get(codeKey(row.code)) ?? null }));
}

/** What an administrator types to add or change one code. */
export interface OwnTariffDraft {
  code: string;
  description: string;
  /** As typed, in N$ */
  price: string;
  perUnit: boolean;
  needsTooth: boolean;
  /** yyyy-MM-dd: the price applies to services on and after this date */
  fromDate: string;
}

/** The save_practice_tariff arguments for a checked draft. */
export interface OwnTariffPayload {
  p_practice_id: string;
  p_code: string;
  p_description: string;
  p_price: number;
  p_per_unit: boolean;
  p_needs_tooth: boolean;
  p_from: string;
}

export const parseOwnPrice = (text: string): number | null => {
  const clean = text.replace(/[N$\s,]/gi, '');
  if (clean === '') return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 && value <= MAX_UNIT_PRICE && hasAtMostDecimals(value, 2) ? value : null;
};

/** Problems that stop a code from being saved, one plain sentence each (empty when it can be saved). */
export function validateOwnTariffDraft(draft: OwnTariffDraft): string[] {
  const errors: string[] = [];
  if (!OWN_CODE_PATTERN.test(codeKey(draft.code))) errors.push('Enter the code: 1 to 10 letters or digits, as on the claim (for example 0190).');
  const description = draft.description.trim();
  if (!description) errors.push('Describe the service in a few words.');
  else if (description.length > MAX_OWN_DESCRIPTION) errors.push(`Keep the description to ${MAX_OWN_DESCRIPTION} characters.`);
  if (parseOwnPrice(draft.price) === null) errors.push('Enter the price in N$, such as 450 or 450.00.');
  if (!isValidDateKey(draft.fromDate)) errors.push('Choose the date the price starts.');
  return errors;
}

export function ownTariffPayload(practiceId: string, draft: OwnTariffDraft): OwnTariffPayload {
  return {
    p_practice_id: practiceId,
    p_code: codeKey(draft.code),
    p_description: draft.description.trim(),
    p_price: parseOwnPrice(draft.price) as number,
    p_per_unit: draft.perUnit,
    p_needs_tooth: draft.needsTooth,
    p_from: draft.fromDate
  };
}
