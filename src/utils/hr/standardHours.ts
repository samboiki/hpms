import { LABOUR_ACT } from './labourAct';

/**
 * The practice's standard working day for timesheets and payroll (practice_settings, key 'timesheet_standard_hours').
 *
 * Owner decision 13 Oct 2026: the timesheet's standard hours must be real. Hours worked above the standard day are
 * overtime. The Labour Act limits still apply on top: a standard day longer than the Act's ordinary day (9 hours,
 * 8 when more than 5 days are worked in the week) cannot make extra hours ordinary time.
 */
export const STANDARD_HOURS_SETTING_KEY = 'timesheet_standard_hours';

export interface StandardHours {
  start: string; // HH:mm
  end: string; // HH:mm
}

const toMinutes = (time: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/** Why these times cannot be the standard day, or null when they can */
export function standardHoursProblem(hours: StandardHours): string | null {
  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);
  if (start === null || end === null) return 'Enter the start and end of the standard day as times, for example 08:00 and 17:00.';
  if (end <= start) return 'The standard day must end after it starts.';
  return null;
}

/** Hours in the standard day (end minus start), or null when the times are not a valid day */
export function standardDayHours(hours: StandardHours | null | undefined): number | null {
  if (!hours || standardHoursProblem(hours)) return null;
  return ((toMinutes(hours.end) as number) - (toMinutes(hours.start) as number)) / 60;
}

/** Ordinary hours in a 5-day week of standard days, never more than the Act's 45 (used for the hourly wage) */
export function standardWeeklyHours(hours: StandardHours | null | undefined): number {
  const day = standardDayHours(hours);
  return day === null ? LABOUR_ACT.maxOrdinaryHoursPerWeek : Math.min(day * 5, LABOUR_ACT.maxOrdinaryHoursPerWeek);
}

/** A stored value read back; anything that is not a valid day is treated as "not set" */
export function parseStandardHours(value: unknown): StandardHours | null {
  if (!value || typeof value !== 'object') return null;
  const { start, end } = value as { start?: unknown; end?: unknown };
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const hours = { start: start.trim(), end: end.trim() };
  return standardHoursProblem(hours) ? null : hours;
}
