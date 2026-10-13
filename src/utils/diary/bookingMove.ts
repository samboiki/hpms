/**
 * Moving a booking by dragging it in the day or the week grid (both use useBookingMove). Before a move lands, reception
 * confirms whatever the booking checks find (the diary passes bookingChecks.ts through diaryService.checkBooking);
 * these are the rules that decide whether there is a move at all.
 */
import { blocksOverlapping, describeDiaryBlock, type DiaryBlock } from './blockedTime';
import { timeToMinutes, toDateKey } from './diaryTime';
import { diaryHolidayOn, holidayBookingWarning } from './holidays';

export interface MovableBooking {
  id: string;
  /** 'yyyy-MM-dd' */
  date: string;
  /** 'HH:mm' or 'HH:mm:ss' */
  time: string;
  doctor_id: string | null | undefined;
  status: string;
  /** Minutes the booking takes */
  duration?: number | null;
}

// The record of a visit that started, ended, was missed or was cancelled belongs to its time
const FIXED_STATUSES = ['in-progress', 'completed', 'no-show', 'cancelled'];

/** Why the booking cannot be dropped for that practitioner, or null when it can. */
export function moveProblem(booking: MovableBooking, targetPractitionerId: string | null | undefined): string | null {
  if (FIXED_STATUSES.includes(booking.status)) return 'Only appointments that have not started yet can be moved';
  if (!targetPractitionerId) return 'Open the booking to choose its practitioner first';
  return null;
}

/** Dropped back on its own time and practitioner: nothing to save or confirm. */
export function isSameSlot(booking: MovableBooking, time: Date, practitionerId: string): boolean {
  return (
    booking.date.slice(0, 10) === toDateKey(time) &&
    timeToMinutes(booking.time) === time.getHours() * 60 + time.getMinutes() &&
    (booking.doctor_id || '') === practitionerId
  );
}

export interface LocalMoveCheck {
  blocks: DiaryBlock[];
  /** The new start */
  time: Date;
  minutes: number;
  practitionerId: string;
  practitionerName: (id: string | null) => string | null;
}

/** What a move must confirm when the diary passes no full check: blocked time and public holidays. */
export function localMoveReasons(check: LocalMoveCheck): string[] {
  const dateKey = toDateKey(check.time);
  const start = check.time.getHours() * 60 + check.time.getMinutes();
  const holiday = diaryHolidayOn(dateKey);
  return [
    ...blocksOverlapping(check.blocks, dateKey, start, start + check.minutes, check.practitionerId).map(
      (block) => `${describeDiaryBlock(block, check.practitionerName(block.doctorId))}.`
    ),
    ...(holiday ? [holidayBookingWarning(holiday)] : [])
  ];
}

/** The question asked before a move the checks warn about */
export const moveConfirmQuestion = (reasons: string[]): string => `${reasons.join('\n')}\n\nMove the appointment here anyway?`;
