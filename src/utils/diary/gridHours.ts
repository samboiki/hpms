/**
 * The hours the diary's time grids show, and when each practitioner is not working. The grids used to
 * run 08:00-23:00 whatever the practice's hours, so reception scrolled past empty evenings and could
 * not see who works when. Now they run from the earliest opening or starting time of the days shown
 * to the latest closing or finishing time, always far enough to show every booking (one made outside
 * those hours too), and the time a practitioner is not working is shaded.
 *
 * Hours come from the same place as the booking warnings and "Next free slot": the practitioner's
 * own working hours when saved in Diary settings, else the practice's opening hours
 * (workingHours.ts practitionerHoursResolver).
 */
import { MINUTES_PER_DAY, formatTimeRange, minutesToTime } from './diaryTime';
import { DEFAULT_WEEKDAY_HOURS, type DayHours } from './nextFreeSlot';

/** The diary rows are half-hours */
export const GRID_SLOT_MINUTES = 30;

/** Minutes since midnight; `end` is not included */
export interface GridRange {
  start: number;
  end: number;
}

export interface GridBooking {
  /** Minutes since midnight; null when the booking has no time */
  start: number | null;
  minutes: number;
}

/**
 * From the earliest start to the latest end of the working days given (the practice's and the
 * practitioners' for the days shown; null = not working that day), widened to every booking and
 * rounded out to whole slots. When nobody works on the days shown: the default 08:00-17:00.
 */
export function shownGridRange(days: Array<DayHours | null | undefined>, bookings: GridBooking[], slotMinutes = GRID_SLOT_MINUTES): GridRange {
  const step = Math.max(5, Math.round(slotMinutes));
  const working = days.filter((day): day is DayHours => !!day && day.close > day.open);
  let start = working.length > 0 ? Math.min(...working.map((day) => day.open)) : DEFAULT_WEEKDAY_HOURS.open;
  let end = working.length > 0 ? Math.max(...working.map((day) => day.close)) : DEFAULT_WEEKDAY_HOURS.close;
  for (const booking of bookings) {
    if (booking.start === null || !Number.isFinite(booking.start)) continue;
    start = Math.min(start, booking.start);
    end = Math.max(end, booking.start + Math.max(1, booking.minutes || step));
  }
  start = Math.max(0, Math.floor(start / step) * step);
  end = Math.min(MINUTES_PER_DAY, Math.ceil(end / step) * step);
  if (end <= start) start = Math.max(0, end - step);
  return { start, end };
}

/** The start of each row ('HH:mm') from range.start up to range.end. */
export function gridRowTimes(range: GridRange, slotMinutes = GRID_SLOT_MINUTES): string[] {
  const step = Math.max(5, Math.round(slotMinutes));
  const rows: string[] = [];
  for (let time = range.start; time < range.end; time += step) rows.push(minutesToTime(time));
  return rows;
}

export interface ColumnCell {
  /** Minutes since midnight */
  start: number;
  minutes: number;
  /** Time before the column's first slot (the grid starts earlier for another practitioner): drawn, not bookable */
  filler: boolean;
}

/**
 * One practitioner's own slots in the day grid, when the practitioners shown have different slot lengths
 * (slotLength.ts): each slot starts at a multiple of its length, so a 20-minute practitioner's slots are 08:00, 08:20,
 * 08:40 however early the grid starts; a filler covers the time before the first one, and the last is cut at the end.
 */
export function columnCells(range: GridRange, slotMinutes: number): ColumnCell[] {
  const step = Math.max(5, Math.round(slotMinutes));
  const cells: ColumnCell[] = [];
  const first = Math.ceil(range.start / step) * step;
  if (first > range.start) cells.push({ start: range.start, minutes: Math.min(first, range.end) - range.start, filler: true });
  for (let start = first; start < range.end; start += step) cells.push({ start, minutes: Math.min(step, range.end - start), filler: false });
  return cells;
}

export type OffHourKind = 'outside' | 'break' | 'gap' | 'day_off';

export interface OffHourSpan {
  start: number;
  end: number;
  kind: OffHourKind;
}

export const OFF_HOUR_LABELS: Record<OffHourKind, string> = {
  outside: 'Outside working hours',
  break: 'Break',
  gap: 'Not working',
  day_off: 'Not working today'
};

type Interval = { start: number; end: number };
// A practitioner's saved break is kind 'break'; the time between two branches is kind 'gap'
type Pause = Interval & { kind?: 'break' | 'gap' };

/** The day's hours less its breaks */
function workingIntervals(day: DayHours): Interval[] {
  const pauses = [...((day.breaks ?? []) as Pause[])].sort((a, b) => a.start - b.start);
  const intervals: Interval[] = [];
  let from = day.open;
  for (const pause of pauses) {
    if (pause.start > from) intervals.push({ start: from, end: Math.min(pause.start, day.close) });
    from = Math.max(from, pause.end);
  }
  if (day.close > from) intervals.push({ start: from, end: day.close });
  return intervals;
}

/** A time between working stretches is a break when every practitioner is on a saved break then */
function pauseKind(gap: Interval, days: DayHours[]): 'break' | 'gap' {
  const onBreak = (day: DayHours): boolean =>
    ((day.breaks ?? []) as Pause[]).some((pause) => pause.start <= gap.start && pause.end >= gap.end && pause.kind !== 'gap');
  return days.every(onBreak) ? 'break' : 'gap';
}

/**
 * The shaded time of a diary column within the range shown: before the first working time and after
 * the last ('outside'), breaks, the gap between two branches, or the whole day off. Given several
 * practitioners' days (the week grid showing everyone), only the time nobody works is shaded.
 */
export function offHourSpans(range: GridRange, days: Array<DayHours | null>): OffHourSpan[] {
  if (days.length === 0 || range.end <= range.start) return [];
  const working = days.filter((day): day is DayHours => day !== null);
  const merged: Interval[] = [];
  working
    .flatMap(workingIntervals)
    .map((interval) => ({ start: Math.max(interval.start, range.start), end: Math.min(interval.end, range.end) }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start)
    .forEach((interval) => {
      const last = merged[merged.length - 1];
      if (last && interval.start <= last.end) merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, interval.end) };
      else merged.push(interval);
    });
  if (merged.length === 0) return [{ start: range.start, end: range.end, kind: 'day_off' }];

  const spans: OffHourSpan[] = [];
  if (merged[0].start > range.start) spans.push({ start: range.start, end: merged[0].start, kind: 'outside' });
  for (let index = 1; index < merged.length; index++) {
    const gap = { start: merged[index - 1].end, end: merged[index].start };
    spans.push({ ...gap, kind: pauseKind(gap, working) });
  }
  const last = merged[merged.length - 1];
  if (last.end < range.end) spans.push({ start: last.end, end: range.end, kind: 'outside' });
  return spans;
}

/** "Break, 13:00 to 14:00" (screen readers and the slot's tooltip), or "Not working today". */
export function describeOffHourSpan(span: OffHourSpan): string {
  if (span.kind === 'day_off') return OFF_HOUR_LABELS.day_off;
  return `${OFF_HOUR_LABELS[span.kind]}, ${minutesToTime(span.start)} to ${minutesToTime(span.end)}`;
}

/** A column header's hours: "08:00-17:00, break 13:00-14:00", or "Not working today". */
export function describeWorkingDay(day: DayHours | null): string {
  if (!day) return OFF_HOUR_LABELS.day_off;
  const pauses = ((day.breaks ?? []) as Pause[]).map(
    (pause) => `${pause.kind === 'gap' ? 'not working' : 'break'} ${formatTimeRange(pause.start, pause.end)}`
  );
  return [formatTimeRange(day.open, day.close), ...pauses].join(', ');
}
