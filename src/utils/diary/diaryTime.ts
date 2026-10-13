/**
 * Date and time helpers for the diary. Days are local calendar days written 'yyyy-MM-dd' (the way
 * visits store scheduled_date) and times are minutes since midnight, so comparisons never depend on
 * the browser's time zone. Dates are shown day first ("7 Oct 2026"), as practices write them.
 */
import { format } from 'date-fns';

export const MINUTES_PER_DAY = 24 * 60;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'HH:mm', 'HH:mm:ss' or 'H:mm' as minutes since midnight; null when it is not a time of day. */
export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

/** Minutes since midnight as 'HH:mm' ('24:00' is the end of the day). */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/** A local date as a 'yyyy-MM-dd' key. */
export const toDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

/** A 'yyyy-MM-dd' key as a local date at midnight; null for anything else, including 2026-02-30. */
export function parseDateKey(key: string | null | undefined): Date | null {
  const match = DATE_KEY.exec((key ?? '').slice(0, 10));
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** The key `days` after (negative: before) a key. */
export function addDaysToKey(key: string, days: number): string {
  const date = parseDateKey(key);
  if (!date) return key;
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** Day of the week of a key: 0 = Sunday ... 6 = Saturday (-1 when the key is not a date). */
export function weekdayOfKey(key: string): number {
  return parseDateKey(key)?.getDay() ?? -1;
}

/** "7 Oct 2026" */
export function formatDiaryDate(key: string): string {
  const date = parseDateKey(key);
  return date ? format(date, 'd MMM yyyy') : key;
}

/** "7 Oct 2026", "7-11 Oct 2026", "28 Oct-3 Nov 2026" or "30 Dec 2026-2 Jan 2027" */
export function formatDiaryDateRange(fromKey: string, toKey: string): string {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to || fromKey === toKey) return formatDiaryDate(fromKey);
  if (from.getFullYear() !== to.getFullYear()) return `${format(from, 'd MMM yyyy')}-${format(to, 'd MMM yyyy')}`;
  if (from.getMonth() !== to.getMonth()) return `${format(from, 'd MMM')}-${format(to, 'd MMM yyyy')}`;
  return `${format(from, 'd')}-${format(to, 'd MMM yyyy')}`;
}

/** "13:00-14:00" */
export const formatTimeRange = (startMinutes: number, endMinutes: number): string =>
  `${minutesToTime(startMinutes)}-${minutesToTime(endMinutes)}`;

/** "6 Oct 2026, 08:15" for an ISO timestamp, or null when it cannot be read. */
export function formatDiaryTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : format(date, 'd MMM yyyy, HH:mm');
}
