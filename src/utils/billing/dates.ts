/**
 * Calendar-date helpers for billing and claims.
 *
 * Dates are handled as 'yyyy-MM-dd' keys (the format of Postgres DATE columns) and all
 * arithmetic is done in UTC, so results never shift by a day because of the browser's time
 * zone or daylight saving.
 *
 * Imports in src/utils/billing use explicit .ts extensions and no third-party packages so the
 * same code can run in Deno edge functions.
 */

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPACT_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** True for a real calendar date written as yyyy-MM-dd (1900-2999). */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1900 && year <= 2999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Normalises a date to 'yyyy-MM-dd'. Accepts 'yyyy-MM-dd', 'yyyyMMdd', an ISO timestamp
 * (the date part is used as written) or a Date (its local calendar date). Returns null when
 * the value is missing or not a real date.
 */
export function toDateKey(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const key = `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
    return isValidDateKey(key) ? key : null;
  }
  const text = String(value).trim();
  const head = text.slice(0, 10);
  if (isValidDateKey(head) && (text.length === 10 || /^[T ]/.test(text.slice(10)))) return head;
  const compact = COMPACT_DATE_PATTERN.exec(text);
  if (compact) {
    const key = `${compact[1]}-${compact[2]}-${compact[3]}`;
    return isValidDateKey(key) ? key : null;
  }
  return null;
}

/** Normalises a date to the claim-file format 'yyyyMMdd', or null when invalid. */
export function toClaimDate(value: string | Date | null | undefined): string | null {
  const key = toDateKey(value);
  return key ? key.replace(/-/g, '') : null;
}

const keyToUtc = (key: string): number => {
  if (!isValidDateKey(key)) throw new RangeError(`Not a valid date: ${key}`);
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const utcToKey = (ms: number): string => {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

/** Adds whole days to a date key. */
export function addDaysToKey(key: string, days: number): string {
  if (!Number.isInteger(days)) throw new RangeError(`Days must be a whole number: ${days}`);
  return utcToKey(keyToUtc(key) + days * MS_PER_DAY);
}

/** Adds calendar months; the day is clamped to the end of a shorter month (31 Jan + 1 = 28/29 Feb). */
export function addMonthsToKey(key: string, months: number): string {
  if (!Number.isInteger(months)) throw new RangeError(`Months must be a whole number: ${months}`);
  keyToUtc(key);
  const [year, month, day] = key.split('-').map(Number);
  const monthIndex = year * 12 + (month - 1) + months;
  const newYear = Math.floor(monthIndex / 12);
  const newMonth = (monthIndex % 12) + 1;
  const newDay = Math.min(day, daysInMonth(newYear, newMonth));
  return `${newYear}-${pad2(newMonth)}-${pad2(newDay)}`;
}

/** Whole days from `fromKey` to `toKey` (negative when toKey is earlier). */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / MS_PER_DAY);
}

/** Today's local calendar date as 'yyyy-MM-dd'. */
export function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A date day first, as Namibian staff write it: '2026-10-07' -> '7 Oct 2026'; '-' when missing or invalid. */
export function formatServiceDate(value: string | Date | null | undefined): string {
  const key = toDateKey(value ?? null);
  if (!key) return '-';
  const [year, month, day] = key.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}
