/**
 * "Next free slot" for one practitioner: the first start time where a booking of the chosen length
 * fits in the practitioner's working hours (else the practice's opening hours), outside their break,
 * without touching another of their bookings (each as long as it was booked), blocked time or a
 * public holiday. Reception's most common question on the phone.
 */
import { blocksOverlapping, type DiaryBlock } from './blockedTime';
import type { DayVisit } from './bookingChecks';
import type { TypeLengths } from './bookingLength';
import { addDaysToKey, minutesToTime, parseDateKey, timeToMinutes, weekdayOfKey } from './diaryTime';
import { diaryHolidayOn } from './holidays';
import { visitDay, visitHoldsSlot, visitOverlapsSlot } from './visitOverlap';

/** Opening (or working) hours of one day in minutes since midnight */
export interface DayHours {
  open: number;
  close: number;
  /** Time between open and close that is not offered: a lunch break, the gap between two branches */
  breaks?: Array<{ start: number; end: number }>;
}

/** Opening hours for a day ('yyyy-MM-dd'), or null when the practice is closed that day */
export type HoursForDay = (dateKey: string) => DayHours | null;

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** What Settings shows a practice that has not saved its hours: Monday to Friday, 08:00-17:00 */
export const DEFAULT_WEEKDAY_HOURS: DayHours = { open: 8 * 60, close: 17 * 60 };

/**
 * Reads practices.business_hours ({ monday: { open: '08:00', close: '17:00', closed: false }, ... }).
 * A day that is missing or marked closed is closed, as in the booking form.
 */
export function practiceHoursResolver(businessHours: unknown): HoursForDay {
  if (!businessHours || typeof businessHours !== 'object' || Array.isArray(businessHours)) {
    return (dateKey) => {
      const weekday = weekdayOfKey(dateKey);
      return weekday >= 1 && weekday <= 5 ? DEFAULT_WEEKDAY_HOURS : null;
    };
  }
  const table = businessHours as Record<string, unknown>;
  return (dateKey) => {
    const entry = table[DAY_KEYS[weekdayOfKey(dateKey)] ?? ''];
    if (!entry || typeof entry !== 'object') return null;
    const day = entry as { open?: unknown; close?: unknown; closed?: unknown };
    if (day.closed) return null;
    const open = timeToMinutes(typeof day.open === 'string' ? day.open : null);
    const close = timeToMinutes(typeof day.close === 'string' ? day.close : null);
    return open !== null && close !== null && close > open ? { open, close } : null;
  };
}

/**
 * The first day after fromDate that the practice is open and is not a public holiday, within
 * `maxDays` (null when none): "Remind patients" offers it, so on a Friday reception reminds Monday's
 * patients instead of an empty Saturday.
 */
export function nextOpenDay(fromDate: string, hoursFor: HoursForDay, maxDays = 7): string | null {
  for (let offset = 1; offset <= maxDays; offset++) {
    const dateKey = addDaysToKey(fromDate, offset);
    if (hoursFor(dateKey) && !diaryHolidayOn(dateKey)) return dateKey;
  }
  return null;
}

export interface NextFreeSlotInput {
  doctorId: string;
  /** First day to look at ('yyyy-MM-dd') */
  fromDate: string;
  /** On the first day, nothing earlier than this ('HH:mm'): now, when looking from today */
  notBefore?: string | null;
  durationMinutes: number;
  /** How many days to look at, the first day included */
  days: number;
  hoursFor: HoursForDay;
  /** Visits in the period (other practitioners' visits are ignored) */
  visits: DayVisit[];
  blocks: DiaryBlock[];
  /** Start times are multiples of this (the booking form offers 15-minute steps) */
  stepMinutes?: number;
  /** The booking being moved, which must not block its own new time */
  ignoreVisitId?: string | null;
  /** The practice's default length per visit type, for bookings without a stored length */
  lengths?: TypeLengths | null;
}

export interface FreeSlot {
  /** 'yyyy-MM-dd' */
  date: string;
  /** 'HH:mm' */
  time: string;
}

export function findNextFreeSlot(input: NextFreeSlotInput): FreeSlot | null {
  const step = Math.max(5, Math.round(input.stepMinutes ?? 15));
  const duration = Math.max(5, Math.round(input.durationMinutes));
  const own = input.visits.filter(
    (visit) => visit.doctor_id === input.doctorId && visit.id !== input.ignoreVisitId && visitHoldsSlot(visit)
  );

  for (let offset = 0; offset < input.days; offset++) {
    const dateKey = addDaysToKey(input.fromDate, offset);
    const date = parseDateKey(dateKey);
    const hours = input.hoursFor(dateKey);
    if (!date || !hours || diaryHolidayOn(dateKey)) continue;

    const notBefore = offset === 0 ? timeToMinutes(input.notBefore) : null;
    const first = Math.ceil(Math.max(hours.open, notBefore ?? 0) / step) * step;
    const dayVisits = own.filter((visit) => visitDay(visit) === dateKey);

    for (let start = first; start + duration <= hours.close; start += step) {
      if (hours.breaks?.some((pause) => start < pause.end && start + duration > pause.start)) continue;
      if (blocksOverlapping(input.blocks, dateKey, start, start + duration, input.doctorId).length > 0) continue;
      const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(start / 60), start % 60);
      if (dayVisits.some((visit) => visitOverlapsSlot(visit, slotStart, duration, input.lengths))) continue;
      return { date: dateKey, time: minutesToTime(start) };
    }
  }
  return null;
}
