/**
 * The days the diary loads and shows for each view: one day, its Monday-to-Sunday week (the week the
 * week grid draws), or its calendar month. The dashboard loads exactly this range, so the week and
 * month views show every booking in them and nothing more.
 */
import { addDaysToKey, parseDateKey, toDateKey } from './diaryTime';

export type DiaryViewMode = 'day' | 'week' | 'month';

export interface DiaryRange {
  /** First day ('yyyy-MM-dd') */
  from: string;
  /** Last day ('yyyy-MM-dd'), included */
  to: string;
}

/** Monday of the week of a day */
function mondayOf(date: Date): Date {
  const offset = (date.getDay() + 6) % 7; // Monday 0 ... Sunday 6
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

/** The days a view shows around the selected day. */
export function diaryRangeFor(mode: DiaryViewMode, selected: Date): DiaryRange {
  if (mode === 'week') {
    const from = toDateKey(mondayOf(selected));
    return { from, to: addDaysToKey(from, 6) };
  }
  if (mode === 'month') {
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    return { from: toDateKey(first), to: toDateKey(last) };
  }
  const day = toDateKey(selected);
  return { from: day, to: day };
}

/** True when the day ('yyyy-MM-dd') is inside the range. */
export const isInDiaryRange = (range: DiaryRange, dateKey: string): boolean => dateKey >= range.from && dateKey <= range.to;

export interface MonthGridDay {
  /** 'yyyy-MM-dd' */
  date: string;
  /** False for the days of the previous or next month that fill the first and last week */
  inMonth: boolean;
}

/** The month as whole weeks, Monday first, for the month grid (5 or 6 rows of 7 days). */
export function monthGridWeeks(selected: Date): MonthGridDay[][] {
  const { from, to } = diaryRangeFor('month', selected);
  const weeks: MonthGridDay[][] = [];
  let day = toDateKey(mondayOf(parseDateKey(from) ?? selected));
  while (day <= to) {
    const week: MonthGridDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: day, inMonth: day >= from && day <= to });
      day = addDaysToKey(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
