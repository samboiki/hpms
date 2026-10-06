import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDaysInMonth,
  isValid,
  parseISO,
  startOfMonth,
  subMonths
} from 'date-fns';

// ---------------------------------------------------------------------------------------------
// Dates (local calendar days)
// ---------------------------------------------------------------------------------------------

export interface DateRange {
  /** Inclusive, yyyy-MM-dd */
  startKey: string;
  /** Inclusive, yyyy-MM-dd */
  endKey: string;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const toDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

/**
 * Local calendar day of a DB value. DATE columns (yyyy-MM-dd) are already local days; timestamps
 * are converted to the local day of that instant (slicing an ISO string would give the UTC day).
 */
export function dateKeyFrom(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (DATE_KEY_PATTERN.test(trimmed)) {
    return isValid(parseISO(trimmed)) ? trimmed : null;
  }
  const parsed = new Date(trimmed);
  return isValid(parsed) ? toDateKey(parsed) : null;
}

export const monthKeyOf = (dateKey: string): string => dateKey.slice(0, 7);

export const isInRange = (dateKey: string | null | undefined, range: DateRange): boolean =>
  !!dateKey && dateKey >= range.startKey && dateKey <= range.endKey;

/** Whole calendar days from one local date to another (negative when `toKey` is earlier). */
export const daysBetween = (fromKey: string, toKey: string): number =>
  differenceInCalendarDays(parseISO(toKey), parseISO(fromKey));

/** `count` month keys (yyyy-MM), oldest first, ending with the month of `endKey`. */
export function monthKeysEndingAt(endKey: string, count: number): string[] {
  const endMonth = startOfMonth(parseISO(endKey));
  return Array.from({ length: count }, (_, i) => format(subMonths(endMonth, count - 1 - i), 'yyyy-MM'));
}

/** Every month key touched by a range, oldest first. */
export function monthKeysInRange(range: DateRange): string[] {
  const keys: string[] = [];
  const last = monthKeyOf(range.endKey);
  for (let month = startOfMonth(parseISO(range.startKey)); ; month = addMonths(month, 1)) {
    const key = format(month, 'yyyy-MM');
    if (key > last) return keys;
    keys.push(key);
  }
}

// ---------------------------------------------------------------------------------------------
// Reporting periods
// ---------------------------------------------------------------------------------------------

export type PeriodPreset = 'this_month' | 'last_month' | 'last_3_months' | 'last_12_months' | 'this_year' | 'custom';

export interface PeriodSelection {
  preset: PeriodPreset;
  /** Used when preset is 'custom' */
  custom?: DateRange | null;
}

export interface PeriodRanges {
  preset: PeriodPreset;
  current: DateRange;
  /** The comparison period: the same span one period earlier */
  previous: DateRange;
}

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  last_12_months: 'Last 12 months',
  this_year: 'Year to date',
  custom: 'Custom range'
};

/** Months a preset spans, i.e. how far back its comparison period sits. */
const PRESET_MONTH_SPAN: Record<Exclude<PeriodPreset, 'custom'>, number> = {
  this_month: 1,
  last_month: 1,
  last_3_months: 3,
  last_12_months: 12,
  this_year: 12
};

/**
 * Move a date by whole months keeping its day of month. A month-end maps to the target
 * month-end (30 Sep -> 31 Aug) and other days are clamped (30 Mar -> 28 Feb).
 */
export function shiftDateKeyByMonths(dateKey: string, months: number): string {
  const date = parseISO(dateKey);
  const target = addMonths(startOfMonth(date), months);
  const isMonthEnd = date.getDate() === getDaysInMonth(date);
  const day = isMonthEnd ? getDaysInMonth(target) : Math.min(date.getDate(), getDaysInMonth(target));
  return toDateKey(new Date(target.getFullYear(), target.getMonth(), day));
}

/** The same number of days immediately before a range (for custom ranges). */
export function previousRangeOfSameLength(range: DateRange): DateRange {
  const days = daysBetween(range.startKey, range.endKey) + 1;
  const start = parseISO(range.startKey);
  return { startKey: toDateKey(addDays(start, -days)), endKey: toDateKey(addDays(start, -1)) };
}

/** Order a user-entered range; fall back to `fallback` when either end is not a valid date. */
export function normalizeRange(range: DateRange | null | undefined, fallback: DateRange): DateRange {
  const startKey = dateKeyFrom(range?.startKey);
  const endKey = dateKeyFrom(range?.endKey);
  if (!startKey || !endKey) return fallback;
  return startKey <= endKey ? { startKey, endKey } : { startKey: endKey, endKey: startKey };
}

function presetRange(preset: Exclude<PeriodPreset, 'custom'>, now: Date): DateRange {
  const todayKey = toDateKey(now);
  const monthStart = startOfMonth(now);
  switch (preset) {
    case 'last_month': {
      const lastMonth = subMonths(monthStart, 1);
      return { startKey: toDateKey(lastMonth), endKey: toDateKey(endOfMonth(lastMonth)) };
    }
    case 'last_3_months':
      return { startKey: toDateKey(subMonths(monthStart, 2)), endKey: todayKey };
    case 'last_12_months':
      return { startKey: toDateKey(subMonths(monthStart, 11)), endKey: todayKey };
    case 'this_year':
      return { startKey: `${format(now, 'yyyy')}-01-01`, endKey: todayKey };
    case 'this_month':
      return { startKey: toDateKey(monthStart), endKey: todayKey };
  }
}

/**
 * Current and comparison ranges for a period selection, in local calendar days. Presets compare
 * with the same span one period earlier (1-6 Oct vs 1-6 Sep); a custom range compares with the
 * same number of days immediately before it.
 */
export function getPeriodRanges(selection: PeriodSelection, now: Date): PeriodRanges {
  const preset = selection.preset;
  if (preset === 'custom') {
    const current = normalizeRange(selection.custom, presetRange('this_month', now));
    return { preset, current, previous: previousRangeOfSameLength(current) };
  }
  const current = presetRange(preset, now);
  const span = PRESET_MONTH_SPAN[preset];
  return {
    preset,
    current,
    previous: {
      startKey: shiftDateKeyByMonths(current.startKey, -span),
      endKey: shiftDateKeyByMonths(current.endKey, -span)
    }
  };
}
