/**
 * Repeat bookings: the same patient, practitioner and time every N days, weeks or months, until a
 * date or for a number of bookings (a weekly physiotherapy course, monthly reviews, dressings every
 * two days). Each occurrence is an ordinary booking; the booking checks run for every date and are
 * shown once for the whole series, so reception confirms one list instead of one prompt per date.
 */
import type { BookingWarning } from './bookingChecks';
import { addDaysToKey, formatDiaryDate, parseDateKey, toDateKey } from './diaryTime';

export type RepeatUnit = 'days' | 'weeks' | 'months';

export interface RepeatRule {
  /** Every this many units (1-52) */
  every: number;
  unit: RepeatUnit;
  /** How it ends: after this many bookings, the first included... */
  ends: 'count' | 'until';
  count: number;
  /** ...or on this day ('yyyy-MM-dd'), included */
  until: string;
}

/** More than a year of weekly bookings is almost always a mistake */
export const REPEAT_MAX_BOOKINGS = 52;
export const REPEAT_MAX_EVERY = 52;

export const DEFAULT_REPEAT_RULE: RepeatRule = { every: 1, unit: 'weeks', ends: 'count', count: 6, until: '' };

const UNIT_WORDS: Record<RepeatUnit, [string, string]> = {
  days: ['day', 'days'],
  weeks: ['week', 'weeks'],
  months: ['month', 'months']
};

/** The day `months` months after a day, on the same date or the month's last day ("31 Jan" -> "28 Feb"). */
function addMonthsToKey(key: string, months: number): string {
  const date = parseDateKey(key);
  if (!date) return key;
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return toDateKey(new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay)));
}

function step(first: string, rule: RepeatRule, index: number): string {
  const every = Math.max(1, Math.floor(rule.every));
  if (rule.unit === 'months') return addMonthsToKey(first, every * index);
  return addDaysToKey(first, (rule.unit === 'weeks' ? 7 : 1) * every * index);
}

/** Every booking day of the series, the first one included, at most REPEAT_MAX_BOOKINGS. */
export function repeatDates(firstDate: string, rule: RepeatRule): string[] {
  if (!parseDateKey(firstDate)) return [];
  const dates: string[] = [];
  for (let index = 0; index < REPEAT_MAX_BOOKINGS; index++) {
    const date = step(firstDate, rule, index);
    if (rule.ends === 'count' && index >= rule.count) break;
    if (rule.ends === 'until' && date > rule.until) break;
    dates.push(date);
  }
  return dates;
}

export type RepeatValidation = { ok: true; dates: string[] } | { ok: false; errors: string[] };

/** Checks the repeat choices in plain words and returns the booking days. */
export function validateRepeatRule(firstDate: string, rule: RepeatRule): RepeatValidation {
  const errors: string[] = [];
  if (!Number.isInteger(rule.every) || rule.every < 1 || rule.every > REPEAT_MAX_EVERY) {
    errors.push(`Repeat every 1 to ${REPEAT_MAX_EVERY} ${UNIT_WORDS[rule.unit][1]}.`);
  }
  if (rule.ends === 'count' && (!Number.isInteger(rule.count) || rule.count < 2 || rule.count > REPEAT_MAX_BOOKINGS)) {
    errors.push(`Choose 2 to ${REPEAT_MAX_BOOKINGS} bookings.`);
  }
  if (rule.ends === 'until') {
    if (!parseDateKey(rule.until)) errors.push('Choose the last day of the series.');
    else if (rule.until <= firstDate) errors.push('The last day must be after the first booking.');
  }
  if (errors.length > 0) return { ok: false, errors };
  const dates = repeatDates(firstDate, rule);
  if (dates.length < 2) return { ok: false, errors: ['The series has only one booking: make the last day later or repeat more often.'] };
  if (rule.ends === 'until' && step(firstDate, rule, REPEAT_MAX_BOOKINGS) <= rule.until) {
    return { ok: false, errors: [`A series can have at most ${REPEAT_MAX_BOOKINGS} bookings: make the last day earlier.`] };
  }
  return { ok: true, dates };
}

/** "Every 2 weeks: 6 bookings, 8 Oct 2026 to 17 Dec 2026" */
export function describeRepeat(rule: RepeatRule, dates: string[]): string {
  const [one, many] = UNIT_WORDS[rule.unit];
  const every = rule.every === 1 ? `Every ${one}` : `Every ${rule.every} ${many}`;
  if (dates.length === 0) return every;
  return `${every}: ${dates.length} booking${dates.length === 1 ? '' : 's'}, ${formatDiaryDate(dates[0])} to ${formatDiaryDate(dates[dates.length - 1])}`;
}

export interface SeriesDateWarnings {
  /** 'yyyy-MM-dd' */
  date: string;
  warnings: BookingWarning[];
}

/**
 * One list for the whole series, each warning starting with its day, so "Book all anyway" is one
 * informed decision instead of one prompt per date.
 */
export function seriesWarnings(items: SeriesDateWarnings[]): BookingWarning[] {
  return items.flatMap((item) => item.warnings.map((warning) => ({ ...warning, message: `${formatDiaryDate(item.date)}: ${warning.message}` })));
}
