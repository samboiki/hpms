/**
 * A yearly percentage increase of the practice's prices (parity E3): choose the codes (all, or a range such as 0190 to
 * 0199), the percentage, the date the new prices start and how to round them; the preview lists each code's price now
 * and its new price, and applying saves a new dated version of every code ticked (apply_practice_tariff_increase,
 * which saves each one through save_practice_tariff: the practice's own dated prices, practiceTariffs.ts).
 *
 * Business rules (practice owner: "people must not get wrong prices"):
 * - "Price now" is the price billing uses the day before the new prices start (selectBillableTariffs on the practice's
 *   list), so running the same increase again gives the same new prices, never an increase on an increase.
 * - A code that is billed at another price from that date already (a version that starts then, or an earlier one
 *   taking over) is left out unless staff tick it: the increase would replace that price.
 * - A code that stops before the date is not offered; a code whose price does not change after rounding (N$ 0.00) is
 *   left out.
 * - New price = price now x (100 + percent) / 100 in whole cents, half up, then to the nearest step chosen (the cent,
 *   N$ 1, N$ 5 or N$ 10), half up.
 * - Visits dated before the start date keep their prices: the earlier versions stay (the history).
 * - A shared-list code the practice puts up becomes the practice's own price from that date, as "Change" does: later
 *   updates of the shared list no longer change it.
 * Pure: no database or React.
 */
import { addDaysToKey, formatServiceDate, isValidDateKey } from './dates.ts';
import { formatNad, fromCents, hasAtMostDecimals, percentOfCents, toCents } from './money.ts';
import { MAX_UNIT_PRICE, selectBillableTariffs, type BillableTariff, type TariffRow } from './pricing.ts';
import { MAX_OWN_DESCRIPTION, OWN_CODE_PATTERN } from './practiceTariffs.ts';

export type IncreaseRounding = 'cent' | 'one' | 'five' | 'ten';

export const INCREASE_ROUNDING: ReadonlyArray<{ value: IncreaseRounding; label: string; stepCents: number }> = [
  { value: 'cent', label: 'To the cent', stepCents: 1 },
  { value: 'one', label: 'To the nearest N$ 1', stepCents: 100 },
  { value: 'five', label: 'To the nearest N$ 5', stepCents: 500 },
  { value: 'ten', label: 'To the nearest N$ 10', stepCents: 1000 }
];

export const MAX_INCREASE_PERCENT = 100;

const stepOf = (rounding: IncreaseRounding): number => INCREASE_ROUNDING.find(option => option.value === rounding)?.stepCents ?? 1;

/** The new price in cents: the old one up by `percent` (half up to the cent), then to the nearest step (half up) */
export function increasedPriceCents(cents: number, percent: number, rounding: IncreaseRounding): number {
  const raised = percentOfCents(cents, 100 + percent);
  const step = stepOf(rounding);
  const whole = Math.floor(raised / step);
  const rest = raised - whole * step;
  return (rest * 2 >= step ? whole + 1 : whole) * step;
}

/** The first day of next year: the usual start of a new price list */
export const nextNewYear = (todayKey: string): string => `${Number(todayKey.slice(0, 4)) + 1}-01-01`;

/** What an administrator chooses */
export interface IncreaseOptions {
  /** As typed: "6", "5.5", "6%" */
  percent: string;
  /** yyyy-MM-dd: the new prices apply to services on and after this day */
  fromDate: string;
  rounding: IncreaseRounding;
  scope: 'all' | 'range';
  /** The range, both ends included (scope 'range') */
  fromCode: string;
  toCode: string;
}

export interface CheckedIncrease {
  percent: number;
  fromDate: string;
  rounding: IncreaseRounding;
  range: { from: string; to: string } | null;
}

const naturalCompare = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true });
const codeKey = (code: string | null | undefined): string => (code ?? '').trim().toUpperCase();

/** The percentage as typed ("6", "5.5", "6 %"); null when it is not a number with at most 2 decimals */
export function parsePercent(text: string): number | null {
  const clean = text.replace(/[%\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) && hasAtMostDecimals(value, 2) ? value : null;
}

/** Checks the choices; each problem is one plain sentence */
export function checkIncreaseOptions(options: IncreaseOptions): { ok: true; value: CheckedIncrease } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const percent = parsePercent(options.percent);
  if (percent === null || percent <= 0 || percent > MAX_INCREASE_PERCENT) {
    errors.push(`Enter the increase as a percentage from 0.01 to ${MAX_INCREASE_PERCENT}, for example 6 or 5.5.`);
  }
  if (!isValidDateKey(options.fromDate)) errors.push('Choose the date the new prices start.');
  let range: CheckedIncrease['range'] = null;
  if (options.scope === 'range') {
    const from = codeKey(options.fromCode);
    const to = codeKey(options.toCode);
    if (!OWN_CODE_PATTERN.test(from) || !OWN_CODE_PATTERN.test(to)) {
      errors.push('Enter the first and the last code of the range, for example 0190 and 0199.');
    } else if (naturalCompare(from, to) > 0) {
      errors.push('The first code of the range comes after the last one.');
    } else {
      range = { from, to };
    }
  }
  if (errors.length > 0 || percent === null) return { ok: false, errors };
  return { ok: true, value: { percent, fromDate: options.fromDate, rounding: options.rounding, range } };
}

/** One code in the preview */
export interface IncreaseItem {
  code: string;
  description: string;
  /** N$: billed the day before the new prices start */
  oldPrice: number;
  newPrice: number;
  perUnit: boolean;
  needsTooth: boolean;
  /** Changed when the increase is applied */
  include: boolean;
  /** False when there is nothing to change (the price stays the same after rounding, or is too high) */
  selectable: boolean;
  /** Why it is left out until ticked, or cannot change, in plain words */
  note: string | null;
}

const descriptionOf = (tariff: BillableTariff): string => tariff.description.trim().slice(0, MAX_OWN_DESCRIPTION).trim() || `Code ${tariff.code}`;

/**
 * The preview: every code billed the day before the new prices start (in the range, when one is chosen) with its new
 * price, ticked unless another price applies from that date already. In code order.
 */
export function planIncrease(rows: readonly TariffRow[], increase: CheckedIncrease): IncreaseItem[] {
  const dayBefore = addDaysToKey(increase.fromDate, -1);
  const before = selectBillableTariffs(rows, dayBefore).tariffs;
  const onTheDay = new Map(selectBillableTariffs(rows, increase.fromDate).tariffs.map(tariff => [codeKey(tariff.code), tariff]));
  const inRange = (code: string): boolean =>
    !increase.range || (naturalCompare(code, increase.range.from) >= 0 && naturalCompare(code, increase.range.to) <= 0);

  return before.flatMap((tariff): IncreaseItem[] => {
    const code = codeKey(tariff.code);
    const then = onTheDay.get(code);
    if (!inRange(code) || !then || !OWN_CODE_PATTERN.test(code)) return [];
    const oldCents = toCents(tariff.unitPrice);
    const newCents = increasedPriceCents(oldCents, increase.percent, increase.rounding);
    const item = {
      code,
      description: descriptionOf(tariff),
      oldPrice: fromCents(oldCents),
      newPrice: fromCents(newCents),
      perUnit: tariff.multiplyRule !== 'NO',
      needsTooth: tariff.requiresTooth
    };
    if (newCents > MAX_UNIT_PRICE * 100) {
      return [{ ...item, include: false, selectable: false, note: `The new price would be above ${formatNad(MAX_UNIT_PRICE)}.` }];
    }
    if (newCents === oldCents) return [{ ...item, include: false, selectable: false, note: 'No change after rounding.' }];
    if (then.id !== tariff.id) {
      return [
        {
          ...item,
          include: false,
          selectable: true,
          note: `Billed at ${formatNad(then.unitPrice)} from ${formatServiceDate(increase.fromDate)} already: tick it to replace that price.`
        }
      ];
    }
    return [{ ...item, include: true, selectable: true, note: null }];
  });
}

/** The apply_practice_tariff_increase items: the codes ticked */
export const increasePayload = (items: readonly IncreaseItem[]) =>
  items
    .filter(item => item.include && item.selectable)
    .map(item => ({ code: item.code, description: item.description, price: item.newPrice, per_unit: item.perUnit, needs_tooth: item.needsTooth }));
