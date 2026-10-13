/**
 * The period the Practice Overhead tiles add up (Settings > Practice > Practice Overhead).
 *
 * Owner decision 13 Oct 2026: the tiles show THIS MONTH by default, with a month picker to look back, and the
 * practice's administrators choose the default period (this month, this financial year or all time) in Settings.
 * The choice is one practice_settings row (key below; every staff member reads it, only administrators change it).
 * Before, the tiles added every expense ever recorded, so "Fixed Monthly" grew month after month.
 *
 * The financial year is Namibia's tax year, 1 March to the end of February (NamRA). Dates are 'yyyy-MM-dd' keys in
 * Windhoek time, compared as text (the format of the expense_date column).
 */
import { windhoekClock } from '../../utils/patientLists/listDates';

export type OverheadPeriodKind = 'month' | 'financial_year' | 'all';

export const OVERHEAD_PERIOD_SETTING_KEY = 'overhead_default_period';

export const OVERHEAD_PERIOD_CHOICES: ReadonlyArray<{ value: OverheadPeriodKind; label: string }> = [
  { value: 'month', label: 'This month' },
  { value: 'financial_year', label: 'This financial year' },
  { value: 'all', label: 'All time' }
];

/** First month of the financial year (March, Namibia's tax year) */
export const FINANCIAL_YEAR_START_MONTH = 3;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (value: number): string => String(value).padStart(2, '0');

/** The stored setting, made safe: no row, an unknown value or an unreadable one gives this month */
export function parseOverheadPeriod(value: unknown): OverheadPeriodKind {
  const raw = typeof value === 'object' && value !== null && 'period' in value ? (value as { period: unknown }).period : value;
  return raw === 'financial_year' || raw === 'all' ? raw : 'month';
}

/** The month being looked at, 'yyyy-MM', for today in Windhoek */
export function currentMonthKey(now: Date = new Date()): string {
  return windhoekClock(now).dateKey.slice(0, 7);
}

export interface OverheadRange {
  /** First day included, 'yyyy-MM-dd'; null = no lower bound */
  from: string | null;
  /** Last day included, 'yyyy-MM-dd'; null = no upper bound */
  to: string | null;
}

const lastDayOf = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * The days the tiles add up. 'month' uses the picked month ('yyyy-MM'; this month when empty or unreadable);
 * 'financial_year' is the one today falls in.
 */
export function overheadRange(kind: OverheadPeriodKind, monthKey: string | null, now: Date = new Date()): OverheadRange {
  if (kind === 'all') return { from: null, to: null };
  const today = windhoekClock(now).dateKey;
  if (kind === 'financial_year') {
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const startMonth: number = FINANCIAL_YEAR_START_MONTH;
    const startYear = month >= startMonth ? year : year - 1;
    const endMonth = startMonth === 1 ? 12 : startMonth - 1;
    const endYear = startMonth === 1 ? startYear : startYear + 1;
    return {
      from: `${startYear}-${pad2(FINANCIAL_YEAR_START_MONTH)}-01`,
      to: `${endYear}-${pad2(endMonth)}-${pad2(lastDayOf(endYear, endMonth))}`
    };
  }
  const key = monthKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) ? monthKey : today.slice(0, 7);
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return { from: `${key}-01`, to: `${key}-${pad2(lastDayOf(year, month))}` };
}

/** Whether an expense dated `expenseDate` counts in the range (an undated expense counts only in "all time") */
export function isInOverheadRange(expenseDate: string | null | undefined, range: OverheadRange): boolean {
  if (range.from === null && range.to === null) return true;
  const day = (expenseDate ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return (range.from === null || day >= range.from) && (range.to === null || day <= range.to);
}

/** What the tiles add up, in words: "October 2026", "Financial year March 2026 to February 2027", "All time" */
export function overheadRangeLabel(kind: OverheadPeriodKind, range: OverheadRange): string {
  if (kind === 'all' || !range.from || !range.to) return 'All time';
  const monthName = (key: string) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  if (kind === 'month') return monthName(range.from);
  return `Financial year ${monthName(range.from)} to ${monthName(range.to)}`;
}
