/**
 * Pregnancy due dates (patients.pregnancy_due_date, proposals/2026-10-13-patient-file-extras.sql): which practices keep
 * them, the checks a due date passes before it is saved, working it out from the first day of the last period, how far
 * along the patient is, and the periods the due-dates list offers (Messages > Lists > Due dates).
 *
 * Dates are yyyy-MM-dd keys in Windhoek time (windhoekClock), so "today" never shifts with the browser's time zone.
 */
import { addDaysToKey, addMonthsToKey, daysBetweenKeys, isValidDateKey } from '../billing/dates';
import { isDentalPractice, isOptometryPractice } from '../billing/tariffRules';
import { monthBounds } from '../patientLists/listDates';

/** 40 weeks: the due date is 280 days after the first day of the last period */
export const PREGNANCY_DAYS = 280;
/** A due date that passed up to 6 weeks ago may still be entered (a file brought up to date late) */
export const LATE_ENTRY_DAYS = 42;

/** Dental and optometry practices keep no due dates; GP, specialist, nursing and therapy practices do. */
export const keepsDueDates = (practiceType: string | null | undefined): boolean =>
  !isDentalPractice(practiceType) && !isOptometryPractice(practiceType);

/** A patient recorded as male is never offered a due date (one already on file still shows, so it can be cleared). */
export const canHaveDueDate = (gender: string | null | undefined): boolean => (gender ?? '').trim().toLowerCase() !== 'male';

/** Why a due date cannot be saved, in plain words; null when it can. */
export function dueDateProblem(dueDate: string, todayKey: string): string | null {
  if (!isValidDateKey(dueDate)) return 'Enter the due date.';
  if (dueDate > addDaysToKey(todayKey, PREGNANCY_DAYS)) return 'A due date is at most 40 weeks from today. Check the year.';
  if (dueDate < addDaysToKey(todayKey, -LATE_ENTRY_DAYS)) {
    return 'That due date is more than 6 weeks ago. If the baby was born, clear the due date instead.';
  }
  return null;
}

/** The due date from the first day of the last period (40 weeks later), or why it cannot be worked out. */
export function dueDateFromLastPeriod(lastPeriod: string, todayKey: string): { dueDate: string } | { problem: string } {
  if (!isValidDateKey(lastPeriod)) return { problem: 'Enter the first day of the last period.' };
  if (lastPeriod > todayKey) return { problem: 'The last period cannot start after today.' };
  const dueDate = addDaysToKey(lastPeriod, PREGNANCY_DAYS);
  if (dueDateProblem(dueDate, todayKey)) return { problem: 'That period started too long ago for a pregnancy now. Check the date.' };
  return { dueDate };
}

export interface Gestation {
  /** Completed weeks of pregnancy today */
  weeks: number;
  /** Days past those weeks (0-6) */
  days: number;
  /** Days from today to the due date; negative once it has passed */
  daysToGo: number;
}

/** How far along the patient is today, counted back from the due date; null for a date that cannot be read. */
export function gestationOn(dueDate: string | null | undefined, todayKey: string): Gestation | null {
  if (!isValidDateKey(dueDate) || !isValidDateKey(todayKey)) return null;
  const daysToGo = daysBetweenKeys(todayKey, dueDate);
  const pregnantDays = Math.max(PREGNANCY_DAYS - daysToGo, 0);
  return { weeks: Math.floor(pregnantDays / 7), days: pregnantDays % 7, daysToGo };
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/** "24 weeks 3 days pregnant", "due today", "5 days past the due date". */
export function gestationText(dueDate: string | null | undefined, todayKey: string): string {
  const gestation = gestationOn(dueDate, todayKey);
  if (!gestation) return '';
  if (gestation.daysToGo === 0) return 'due today';
  if (gestation.daysToGo < 0) return `${plural(-gestation.daysToGo, 'day')} past the due date`;
  return `${plural(gestation.weeks, 'week')}${gestation.days ? ` ${plural(gestation.days, 'day')}` : ''} pregnant`;
}

/** The short form for a list row: "24 wk", "due today", "5 d over". */
export function gestationShort(dueDate: string | null | undefined, todayKey: string): string {
  const gestation = gestationOn(dueDate, todayKey);
  if (!gestation) return '';
  if (gestation.daysToGo === 0) return 'due today';
  if (gestation.daysToGo < 0) return `${-gestation.daysToGo} d over`;
  return `${gestation.weeks} wk`;
}

// ---------------------------------------------------------------------------------------------
// The periods of the due-dates list
// ---------------------------------------------------------------------------------------------

export type DuePeriod = 'next_4_weeks' | 'this_month' | 'next_month' | 'next_3_months' | 'past_due' | 'custom';

export const DUE_PERIODS: ReadonlyArray<{ value: DuePeriod; label: string }> = [
  { value: 'next_4_weeks', label: 'The next 4 weeks' },
  { value: 'this_month', label: 'This month' },
  { value: 'next_month', label: 'Next month' },
  { value: 'next_3_months', label: 'The next 3 months' },
  { value: 'past_due', label: 'Past the due date (not cleared yet)' },
  { value: 'custom', label: 'Choose the dates' }
];

export interface DateRange {
  from: string;
  to: string;
}

/** The dates a period covers (both included). A chosen range is checked: both dates, the first not after the last. */
export function duePeriodRange(period: DuePeriod, todayKey: string, custom?: Partial<DateRange>): DateRange | { problem: string } {
  switch (period) {
    case 'next_4_weeks':
      return { from: todayKey, to: addDaysToKey(todayKey, 27) };
    case 'this_month':
      return monthBounds(todayKey);
    case 'next_month':
      return monthBounds(addMonthsToKey(monthBounds(todayKey).from, 1));
    case 'next_3_months':
      return { from: todayKey, to: addDaysToKey(addMonthsToKey(todayKey, 3), -1) };
    case 'past_due':
      return { from: addDaysToKey(todayKey, -365), to: addDaysToKey(todayKey, -1) };
    case 'custom': {
      const from = custom?.from ?? '';
      const to = custom?.to ?? '';
      if (!isValidDateKey(from) || !isValidDateKey(to)) return { problem: 'Choose the first and the last day.' };
      if (from > to) return { problem: 'The first day is after the last day.' };
      return { from, to };
    }
  }
}
