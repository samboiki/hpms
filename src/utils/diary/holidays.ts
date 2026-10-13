/**
 * Namibian public holidays in the diary. The list itself is utils/hr/namibiaHolidays.ts (payroll pays
 * the same days), so the diary and payroll can never disagree; the sources are cited there.
 * One-off days the President declares for a single year (an election day, a day of mourning) are not
 * in that list: practices add them as "practice closed" blocked time.
 */
import { getNamibiaPublicHolidays } from '../hr/namibiaHolidays';
import { formatDiaryDate, parseDateKey } from './diaryTime';

export interface DiaryHoliday {
  /** 'yyyy-MM-dd' */
  date: string;
  /** Every holiday on that day: "Africa Day and Ascension Day" when two fall together */
  name: string;
}

const joinNames = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** The public holiday on a day, or null. */
export function diaryHolidayOn(dateKey: string): DiaryHoliday | null {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  const names = getNamibiaPublicHolidays(date.getFullYear())
    .filter((holiday) => holiday.date === dateKey)
    .map((holiday) => holiday.name);
  return names.length > 0 ? { date: dateKey, name: joinNames(names) } : null;
}

/** What reception reads before booking on a holiday. */
export function holidayBookingWarning(holiday: DiaryHoliday): string {
  return `${formatDiaryDate(holiday.date)} is ${holiday.name}, a public holiday. Most practices are closed.`;
}
