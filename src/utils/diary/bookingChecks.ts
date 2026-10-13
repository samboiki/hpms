/**
 * What reception is told before a booking is saved. Nothing here refuses a booking: each warning is
 * shown with a "Book anyway" choice, because practices do double-book on purpose (a quick script
 * collection, a nurse seeing two patients) and do open on holidays. The point is that nobody books
 * a clash, a closed day or a practitioner's leave without seeing it.
 */
import { blocksOverlapping, describeDiaryBlock, type DiaryBlock } from './blockedTime';
import { resolveBookingLength, type TypeLengths } from './bookingLength';
import { formatDiaryDate, minutesToTime, parseDateKey, timeToMinutes } from './diaryTime';
import { diaryHolidayOn, holidayBookingWarning } from './holidays';
import { visitDay, visitHoldsSlot, visitOverlapsSlot, type ConflictVisit } from './visitOverlap';
import { workingHoursProblem, type PractitionerDay } from './workingHours';

export type BookingWarningKind =
  | 'doctor_overlap'
  | 'patient_same_day'
  | 'blocked_time'
  | 'public_holiday'
  | 'closed_day'
  | 'outside_hours'
  // The practice's appointment type is full for the practitioner that day (appointmentTypes.ts dailyLimitWarning)
  | 'type_daily_limit';

export interface BookingWarning {
  kind: BookingWarningKind;
  message: string;
}

export interface BookingProposal {
  /** The visit being moved or edited (it never clashes with itself); null for a new booking */
  visitId: string | null;
  patientId: string;
  doctorId: string;
  /** 'yyyy-MM-dd' */
  date: string;
  /** 'HH:mm' */
  time: string;
  durationMinutes: number;
}

/** A visit of the practice on the day of the booking (any practitioner). */
export interface DayVisit extends ConflictVisit {
  patient_id: string | null;
  doctor_id: string | null;
}

/** A row of the older appointments table for the same practitioner and day. */
export interface LegacyAppointment {
  id: string;
  time: string | null;
  duration: number | null;
}

export interface BookingCheckInput {
  proposal: BookingProposal;
  /** The practice's visits on that day */
  visits: DayVisit[];
  legacyAppointments?: LegacyAppointment[];
  blocks: DiaryBlock[];
  /** Practitioner names for the messages */
  doctorName?: (doctorId: string) => string | null | undefined;
  /** Lower-case weekday ('sunday') when the practice's business hours say it is closed that day */
  closedWeekday?: string | null;
  /** The practice's default length per visit type, for the other bookings without a stored length */
  lengths?: TypeLengths | null;
  /**
   * The practitioner's working hours that day (workingHours.ts practitionerDayHours): undefined when
   * they saved none (no check), null when they do not work that day
   */
  practitionerDay?: PractitionerDay | null;
}

/** Changes whenever anything that decides the warnings changes, so "Book anyway" covers exactly one proposal. */
export function bookingProposalKey(proposal: BookingProposal): string {
  return [proposal.visitId ?? 'new', proposal.patientId, proposal.doctorId, proposal.date, proposal.time.slice(0, 5), proposal.durationMinutes].join('|');
}

const joinTimes = (times: string[]): string =>
  times.length <= 1 ? (times[0] ?? '') : `${times.slice(0, -1).join(', ')} and ${times[times.length - 1]}`;

const startTimeOf = (visit: ConflictVisit): string => (visit.scheduled_time || visit.visit_time || '').slice(0, 5);

/** Every warning for the proposed booking, most important first (an empty list: nothing to confirm). */
export function findBookingWarnings(input: BookingCheckInput): BookingWarning[] {
  const { proposal, blocks } = input;
  const warnings: BookingWarning[] = [];
  const date = parseDateKey(proposal.date);
  const startMinutes = timeToMinutes(proposal.time);
  if (!date || startMinutes === null) return warnings;
  const duration = Math.max(1, proposal.durationMinutes);
  const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(startMinutes / 60), startMinutes % 60);
  const nameOf = (doctorId: string | null) => (doctorId ? input.doctorName?.(doctorId)?.trim() : null) || null;
  const others = input.visits.filter((visit) => visit.id !== proposal.visitId && visitHoldsSlot(visit) && visitDay(visit) === proposal.date);

  // 1. The practitioner already has someone at that time
  const clashTimes = others
    .filter((visit) => visit.doctor_id === proposal.doctorId && visitOverlapsSlot(visit, slotStart, duration, input.lengths))
    .map(startTimeOf);
  const endMinutes = startMinutes + duration;
  for (const appointment of input.legacyAppointments ?? []) {
    const start = timeToMinutes(appointment.time);
    if (appointment.id === proposal.visitId || start === null) continue;
    if (startMinutes < start + (appointment.duration || 30) && endMinutes > start) clashTimes.push((appointment.time ?? '').slice(0, 5));
  }
  if (clashTimes.length > 0) {
    const times = [...new Set(clashTimes)].sort();
    const one = times.length === 1;
    warnings.push({
      kind: 'doctor_overlap',
      message: `${nameOf(proposal.doctorId) ?? 'This practitioner'} already has ${one ? 'a booking' : 'bookings'} at ${joinTimes(times)} that ${one ? 'overlaps' : 'overlap'} this time.`
    });
  }

  // 2. The patient is already coming that day (often a duplicate made by a second receptionist)
  const sameDay = others
    .filter((visit) => visit.patient_id === proposal.patientId)
    .sort((a, b) => startTimeOf(a).localeCompare(startTimeOf(b)));
  if (sameDay.length > 0) {
    const parts = sameDay.map((visit) => {
      const doctor = nameOf(visit.doctor_id);
      const time = startTimeOf(visit);
      return `${time ? `at ${time}` : 'without a time'}${doctor ? ` with ${doctor}` : ''}`;
    });
    warnings.push({
      kind: 'patient_same_day',
      message: `This patient is already booked on ${formatDiaryDate(proposal.date)} ${joinTimes(parts)}.`
    });
  }

  // 3. Blocked time: leave, a meeting, lunch, the practice or a branch closed
  for (const block of blocksOverlapping(blocks, proposal.date, startMinutes, endMinutes, proposal.doctorId)) {
    warnings.push({ kind: 'blocked_time', message: `${describeDiaryBlock(block, nameOf(block.doctorId))}.` });
  }

  // 4. Outside the practitioner's own working hours, or during their break
  const hoursProblem = workingHoursProblem(input.practitionerDay, proposal.date, startMinutes, endMinutes, nameOf(proposal.doctorId));
  if (hoursProblem) warnings.push({ kind: 'outside_hours', message: hoursProblem });

  // 5. A public holiday, and 6. a day the practice's business hours say it is closed
  const holiday = diaryHolidayOn(proposal.date);
  if (holiday) warnings.push({ kind: 'public_holiday', message: holidayBookingWarning(holiday) });
  if (input.closedWeekday) {
    const day = input.closedWeekday.charAt(0).toUpperCase() + input.closedWeekday.slice(1).toLowerCase();
    warnings.push({ kind: 'closed_day', message: `The practice's business hours say it is closed on ${day}s.` });
  }

  return warnings;
}

/**
 * Start times (every `step` minutes) at which the practitioner already has a booking running, for
 * the booking form's time list: each booking takes its own length, not a fixed 30 minutes. The
 * booking being edited does not count against itself.
 */
export function takenStartTimes(
  visits: DayVisit[],
  lengths: TypeLengths | null | undefined,
  ignoreVisitId?: string | null,
  step = 15
): string[] {
  const taken = new Set<string>();
  for (const visit of visits) {
    if (visit.id === ignoreVisitId || !visitHoldsSlot(visit)) continue;
    const start = timeToMinutes(visit.scheduled_time || visit.visit_time);
    if (start === null) continue;
    const end = start + resolveBookingLength(visit, lengths);
    for (let time = Math.ceil(start / step) * step; time < end; time += step) taken.add(minutesToTime(time));
  }
  return [...taken].sort();
}

/**
 * Shown when a patient is picked, like Eminance's previous-status warning: reception can ask the
 * patient to confirm, or offer a slot that is easier to keep. Null when there is nothing to say.
 */
export function describeNoShowHistory(count: number, lastDate: string | null): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const last = lastDate && parseDateKey(lastDate) ? formatDiaryDate(lastDate.slice(0, 10)) : null;
  if (count === 1) return last ? `Missed an appointment on ${last} (no-show).` : 'Missed an appointment before (no-show).';
  return last ? `Missed ${count} appointments, most recently on ${last}.` : `Missed ${count} appointments before.`;
}
