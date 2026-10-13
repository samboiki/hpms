/**
 * Practitioner working hours (doctor_branch_schedules, proposals/2026-10-07-diary-2.sql): per weekday
 * and branch, with an optional break. A practitioner without any saved hours works the practice's
 * opening hours, as before. Hours only warn: the time picker marks the time outside them, "Next free
 * slot" skips it, and the booking form says so before saving; reception can still book.
 */
import type { DayHours, HoursForDay } from './nextFreeSlot';
import { formatTimeRange, minutesToTime, timeToMinutes, weekdayOfKey } from './diaryTime';

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** The order the week is shown in: Monday first, as Namibian practices plan it */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface WorkingHoursRow {
  doctorId: string;
  branchId: string | null;
  branchName: string | null;
  /** 0 = Sunday ... 6 = Saturday */
  dayOfWeek: number;
  /** Minutes since midnight */
  start: number;
  end: number;
  breakStart: number | null;
  breakEnd: number | null;
}

/** Time inside the working day that is not bookable: the break, or the gap between two branches */
export interface WorkingPause {
  start: number;
  end: number;
  kind: 'break' | 'gap';
}

export interface PractitionerDay extends DayHours {
  breaks: WorkingPause[];
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** A doctor_branch_schedules row (with the embedded branch name), or null when it can't be used. */
export function normalizeWorkingHoursRow(row: unknown): WorkingHoursRow | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const doctorId = text(r.doctor_id);
  const dayOfWeek = Number(r.day_of_week);
  const start = timeToMinutes(text(r.start_time));
  const end = timeToMinutes(text(r.end_time));
  if (!doctorId || r.is_active === false || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null;
  if (start === null || end === null || end <= start) return null;
  const breakStart = timeToMinutes(text(r.break_start));
  const breakEnd = timeToMinutes(text(r.break_end));
  const hasBreak = breakStart !== null && breakEnd !== null && breakStart > start && breakEnd < end && breakEnd > breakStart;
  const branch = Array.isArray(r.branch) ? r.branch[0] : r.branch;
  return {
    doctorId,
    branchId: text(r.branch_id),
    branchName: branch && typeof branch === 'object' ? text((branch as Record<string, unknown>).name) : null,
    dayOfWeek,
    start,
    end,
    breakStart: hasBreak ? breakStart : null,
    breakEnd: hasBreak ? breakEnd : null
  };
}

/** True when the practitioner has saved hours: then days without hours are days off. */
export function hasWorkingHours(rows: WorkingHoursRow[], doctorId: string): boolean {
  return rows.some((row) => row.doctorId === doctorId);
}

/**
 * The practitioner's hours on a day: undefined when they saved no hours (the practice's opening hours
 * apply), null when they do not work that day.
 */
export function practitionerDayHours(rows: WorkingHoursRow[], doctorId: string, dateKey: string): PractitionerDay | null | undefined {
  if (!hasWorkingHours(rows, doctorId)) return undefined;
  const weekday = weekdayOfKey(dateKey);
  const day = rows.filter((row) => row.doctorId === doctorId && row.dayOfWeek === weekday).sort((a, b) => a.start - b.start);
  if (day.length === 0) return null;
  const breaks: WorkingPause[] = [];
  day.forEach((row, index) => {
    if (row.breakStart !== null && row.breakEnd !== null) breaks.push({ start: row.breakStart, end: row.breakEnd, kind: 'break' });
    const next = day[index + 1];
    if (next && next.start > row.end) breaks.push({ start: row.end, end: next.start, kind: 'gap' });
  });
  return { open: day[0].start, close: Math.max(...day.map((row) => row.end)), breaks };
}

/** Hours for "Next free slot": the practitioner's when saved, else the practice's opening hours. */
export function practitionerHoursResolver(rows: WorkingHoursRow[], doctorId: string, practiceHours: HoursForDay): HoursForDay {
  return (dateKey) => {
    const own = practitionerDayHours(rows, doctorId, dateKey);
    return own === undefined ? practiceHours(dateKey) : own;
  };
}

/**
 * Why a booking from startMinutes to endMinutes is outside the practitioner's hours, in plain words,
 * or null when it is inside them (or no hours are saved).
 */
export function workingHoursProblem(
  day: PractitionerDay | null | undefined,
  dateKey: string,
  startMinutes: number,
  endMinutes: number,
  practitionerName: string | null | undefined
): string | null {
  if (day === undefined) return null;
  const name = practitionerName?.trim() || 'This practitioner';
  const weekday = WEEKDAY_NAMES[weekdayOfKey(dateKey)] ?? 'that day';
  if (day === null) return `${name} does not work on ${weekday}s.`;
  const booking = formatTimeRange(startMinutes, endMinutes);
  if (startMinutes < day.open || endMinutes > day.close) {
    return `${name} works ${formatTimeRange(day.open, day.close)} on ${weekday}s; ${booking} is outside these hours.`;
  }
  const pause = day.breaks.find((item) => startMinutes < item.end && endMinutes > item.start);
  if (pause?.kind === 'break') return `${booking} is during ${name}'s break (${formatTimeRange(pause.start, pause.end)}).`;
  if (pause) return `${name} is not working ${formatTimeRange(pause.start, pause.end)} on ${weekday}s.`;
  return null;
}

/**
 * Labels for the booking form's start times ('HH:mm' -> "Break" or "Not working"), from `from` to
 * `to` in `step` minutes. Empty when no hours are saved.
 */
export function workingHoursLabels(day: PractitionerDay | null | undefined, from: number, to: number, step = 15): Record<string, string> {
  const labels: Record<string, string> = {};
  if (day === undefined) return labels;
  for (let start = from; start <= to; start += step) {
    const pause = day?.breaks.find((item) => start >= item.start && start < item.end);
    if (day === null || start < day.open || start >= day.close) labels[minutesToTime(start)] = 'Not working';
    else if (pause) labels[minutesToTime(start)] = pause.kind === 'break' ? 'Break' : 'Not working';
  }
  return labels;
}

// ---------------------------------------------------------------------------------------------
// The weekly hours as staff read and edit them
// ---------------------------------------------------------------------------------------------

const dayText = (row: Pick<WorkingHoursRow, 'start' | 'end' | 'breakStart' | 'breakEnd'>): string =>
  row.breakStart !== null && row.breakEnd !== null
    ? `${formatTimeRange(row.start, row.end)} (break ${formatTimeRange(row.breakStart, row.breakEnd)})`
    : formatTimeRange(row.start, row.end);

/** "Mon-Fri 08:00-17:00 (break 13:00-14:00), Sat 08:00-12:00", or null when no hours are saved. */
export function describeWorkingWeek(rows: WorkingHoursRow[], doctorId: string): string | null {
  const own = rows.filter((row) => row.doctorId === doctorId);
  if (own.length === 0) return null;
  const textByDay = WEEK_ORDER.map((day) => {
    const dayRows = own.filter((row) => row.dayOfWeek === day).sort((a, b) => a.start - b.start);
    return dayRows.length > 0 ? dayRows.map((row) => `${dayText(row)}${row.branchName ? ` at ${row.branchName}` : ''}`).join(' and ') : null;
  });
  const parts: string[] = [];
  let index = 0;
  while (index < WEEK_ORDER.length) {
    const value = textByDay[index];
    let last = index;
    while (last + 1 < WEEK_ORDER.length && textByDay[last + 1] === value) last += 1;
    if (value) {
      const first = WEEKDAY_SHORT[WEEK_ORDER[index]];
      parts.push(`${last > index ? `${first}-${WEEKDAY_SHORT[WEEK_ORDER[last]]}` : first} ${value}`);
    }
    index = last + 1;
  }
  return parts.join(', ');
}

/** One weekday in the hours editor ('HH:mm' strings, as the time inputs give them) */
export interface DayDraft {
  works: boolean;
  start: string;
  end: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
  branchId: string | null;
}

/** Index = day of the week (0 = Sunday) */
export type WeekDraft = DayDraft[];

/** One day as save_practitioner_hours takes it */
export interface SavedWorkingDay {
  day_of_week: number;
  branch_id: string | null;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

const OFF_DAY: DayDraft = { works: false, start: '08:00', end: '17:00', hasBreak: false, breakStart: '13:00', breakEnd: '14:00', branchId: null };

/**
 * The editor's starting point: the saved hours, else the practice's opening hours for each weekday
 * (shown as a suggestion; nothing is saved until "Save hours"). One row per day: a practitioner at
 * two branches on one day keeps the first branch's hours here.
 */
export function weekDraftFromRows(rows: WorkingHoursRow[], doctorId: string, practiceHours: HoursForDay, anyMonday = '2026-10-05'): WeekDraft {
  const own = rows.filter((row) => row.doctorId === doctorId);
  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    if (own.length > 0) {
      const row = own.filter((item) => item.dayOfWeek === day).sort((a, b) => a.start - b.start)[0];
      if (!row) return { ...OFF_DAY };
      return {
        works: true,
        start: minutesToTime(row.start),
        end: minutesToTime(row.end),
        hasBreak: row.breakStart !== null,
        breakStart: row.breakStart !== null ? minutesToTime(row.breakStart) : OFF_DAY.breakStart,
        breakEnd: row.breakEnd !== null ? minutesToTime(row.breakEnd) : OFF_DAY.breakEnd,
        branchId: row.branchId
      };
    }
    // A date with this weekday, to ask the practice's opening hours (anyMonday is a Monday)
    const [year, month, date] = anyMonday.split('-').map(Number);
    const sample = new Date(year, month - 1, date + ((day + 6) % 7));
    const key = `${sample.getFullYear()}-${String(sample.getMonth() + 1).padStart(2, '0')}-${String(sample.getDate()).padStart(2, '0')}`;
    const hours = practiceHours(key);
    return hours ? { ...OFF_DAY, works: true, start: minutesToTime(hours.open), end: minutesToTime(hours.close) } : { ...OFF_DAY };
  });
}

export type WeekDraftValidation = { ok: true; days: SavedWorkingDay[] } | { ok: false; errors: string[] };

/** Checks the hours editor in plain words. Mirrors save_practitioner_hours and its CHECK constraints. */
export function validateWeekDraft(draft: WeekDraft): WeekDraftValidation {
  const errors: string[] = [];
  const days: SavedWorkingDay[] = [];
  draft.forEach((day, dayOfWeek) => {
    if (!day.works) return;
    const name = WEEKDAY_NAMES[dayOfWeek];
    const start = timeToMinutes(day.start);
    const end = timeToMinutes(day.end);
    if (start === null || end === null) {
      errors.push(`${name}: choose the start and end time.`);
      return;
    }
    if (end <= start) {
      errors.push(`${name}: the end time must be after the start time.`);
      return;
    }
    let breakStart: number | null = null;
    let breakEnd: number | null = null;
    if (day.hasBreak) {
      breakStart = timeToMinutes(day.breakStart);
      breakEnd = timeToMinutes(day.breakEnd);
      if (breakStart === null || breakEnd === null || breakEnd <= breakStart) {
        errors.push(`${name}: the break must end after it starts.`);
        return;
      }
      if (breakStart <= start || breakEnd >= end) {
        errors.push(`${name}: the break must fall inside the working hours.`);
        return;
      }
    }
    days.push({
      day_of_week: dayOfWeek,
      branch_id: day.branchId,
      start_time: minutesToTime(start),
      end_time: minutesToTime(end),
      break_start: breakStart !== null ? minutesToTime(breakStart) : null,
      break_end: breakEnd !== null ? minutesToTime(breakEnd) : null
    });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, days };
}
