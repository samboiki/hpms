/**
 * Calendar helpers for patient lists.
 *
 * Practices are in Namibia, so "today", "this week", birthdays and send times are always the
 * practice's local date and time in Africa/Windhoek (UTC+2 all year: Namibia dropped winter time
 * in 2017). They never follow the browser's or the server's time zone: the scheduled sender runs
 * on UTC servers, where 23:30 on 6 October is already 7 October in Windhoek.
 *
 * Dates are 'yyyy-MM-dd' keys (the format of Postgres DATE columns). No third-party imports and
 * explicit .ts extensions, so the scheduled sender (a Deno edge function) runs this same code.
 */
import { addDaysToKey, isValidDateKey, toDateKey } from '../billing/dates.ts';

export const WINDHOEK_UTC_OFFSET_MINUTES = 120;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** The practice's local date and time of day. */
export interface PracticeClock {
  /** Windhoek calendar date, yyyy-MM-dd */
  dateKey: string;
  /** Minutes since Windhoek midnight, 0-1439 */
  minutes: number;
}

export function windhoekClock(now: Date): PracticeClock {
  const local = new Date(now.getTime() + WINDHOEK_UTC_OFFSET_MINUTES * 60_000);
  return {
    dateKey: `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`,
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes()
  };
}

export const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * The day a patient's birthday is celebrated in `year`. Someone born on 29 February is greeted on
 * 28 February in years without a 29 February, so they are never skipped for three years.
 */
export function birthdayInYear(dateOfBirth: string | null | undefined, year: number): string | null {
  const dob = toDateKey(dateOfBirth ?? null);
  if (!dob || !Number.isInteger(year)) return null;
  const month = Number(dob.slice(5, 7));
  const day = Number(dob.slice(8, 10));
  const celebratedDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  const key = `${year}-${pad2(month)}-${pad2(celebratedDay)}`;
  return isValidDateKey(key) && key >= dob ? key : null;
}

/** The celebrated birthday between two dates (inclusive), or null. Handles ranges across New Year. */
export function birthdayBetween(dateOfBirth: string | null | undefined, fromKey: string, toKey: string): string | null {
  const fromYear = Number(fromKey.slice(0, 4));
  const toYear = Number(toKey.slice(0, 4));
  for (let year = fromYear; year <= toYear; year += 1) {
    const birthday = birthdayInYear(dateOfBirth, year);
    if (birthday && birthday >= fromKey && birthday <= toKey) return birthday;
  }
  return null;
}

/**
 * The birthday that is "current" around today: the first one from a month ago onwards. A list of
 * this month's birthdays shows who turned 40 last week and who turns 40 next week, both as 40.
 */
export function currentBirthday(dateOfBirth: string | null | undefined, todayKey: string): string | null {
  return birthdayBetween(dateOfBirth, addDaysToKey(todayKey, -31), addDaysToKey(todayKey, 366));
}

/** Age in whole years on a date, counting a 29 February birthday as reached on 28 February. */
export function ageOn(dateOfBirth: string | null | undefined, dateKey: string): number | null {
  const dob = toDateKey(dateOfBirth ?? null);
  if (!dob || !isValidDateKey(dateKey) || dob > dateKey) return null;
  const year = Number(dateKey.slice(0, 4));
  const birthdayThisYear = birthdayInYear(dob, year);
  const age = year - Number(dob.slice(0, 4));
  return birthdayThisYear && dateKey < birthdayThisYear ? age - 1 : age;
}

/** Day of week for a date key: 0 = Monday ... 6 = Sunday. */
const weekdayIndex = (key: string): number => {
  const [year, month, day] = key.split('-').map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
};

/** Monday to Sunday of the week that contains `todayKey`. */
export function weekBounds(todayKey: string): { from: string; to: string } {
  const from = addDaysToKey(todayKey, -weekdayIndex(todayKey));
  return { from, to: addDaysToKey(from, 6) };
}

/** First and last day of the month that contains `todayKey`. */
export function monthBounds(todayKey: string): { from: string; to: string } {
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${todayKey.slice(0, 7)}-01`, to: `${todayKey.slice(0, 7)}-${pad2(lastDay)}` };
}

/** ISO 8601 week, e.g. '2026-W41'. The days around New Year belong to the week of their Thursday. */
export function isoWeekKey(dateKey: string): string {
  const thursday = addDaysToKey(dateKey, 3 - weekdayIndex(dateKey));
  const year = Number(thursday.slice(0, 4));
  const [, month, day] = thursday.split('-').map(Number);
  const dayOfYear = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000);
  return `${year}-W${pad2(Math.floor(dayOfYear / 7) + 1)}`;
}
