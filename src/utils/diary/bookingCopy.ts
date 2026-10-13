/**
 * "Book again" and "Copy" in the visit actions: a booking's patient, practitioner, type, length and reason carried
 * into the booking form, so a follow-up or a rebooking is not typed again. Nothing here saves a booking: the booking
 * form still runs every check (bookingChecks.ts) and asks with "Book anyway".
 */
import { FALLBACK_BOOKING_LENGTH, formatBookingLength, isValidBookingLength, isVisitType, type VisitType } from './bookingLength';
import { addDaysToKey, parseDateKey } from './diaryTime';

export interface BookingPrefill {
  patientId: string;
  /** "Anna Tester", shown in the form's patient field */
  patientName: string;
  /** For the diary's "Copied" banner */
  patientFirstName: string;
  /** null: the booking had no practitioner (a website request) */
  practitionerId: string | null;
  type: VisitType;
  durationMinutes: number;
  /** What reception typed as the reason ('' when nothing) */
  reason: string;
  /** The practice's appointment type the booking was made as (appointmentTypes.ts); null = none */
  appointmentTypeId?: string | null;
}

/** A booking as the diary holds it */
export interface CopyableBooking {
  patient_id: string | null | undefined;
  doctor_id: string | null | undefined;
  type: string | null | undefined;
  appointment_type_id?: string | null;
  /** Minutes the booking takes (its stored length, else its type's default) */
  duration: number | null | undefined;
  /** visits.chief_complaint */
  reason?: string | null;
  patient?: { first_name?: string | null; last_name?: string | null } | null;
}

// The booking form writes this line into visits.notes, and rescheduling used to copy it into the reason
const AUTOMATIC_NOTE = /^appointment scheduled for /i;

/** The reason to carry over: what reception typed, never the form's automatic line (it names the old date). */
export function bookingReason(text: string | null | undefined): string {
  const reason = (text ?? '').trim();
  return AUTOMATIC_NOTE.test(reason) ? '' : reason;
}

/** What "Book again" and "Copy" carry into the booking form; null when the booking has no patient. */
export function prefillFromBooking(booking: CopyableBooking): BookingPrefill | null {
  if (!booking.patient_id) return null;
  const first = (booking.patient?.first_name ?? '').trim();
  const last = (booking.patient?.last_name ?? '').trim();
  return {
    patientId: booking.patient_id,
    patientName: `${first} ${last}`.trim() || 'Patient',
    patientFirstName: first || last || 'Patient',
    practitionerId: booking.doctor_id || null,
    type: isVisitType(booking.type) ? booking.type : 'consultation',
    durationMinutes: isValidBookingLength(booking.duration) ? booking.duration : FALLBACK_BOOKING_LENGTH,
    reason: bookingReason(booking.reason),
    appointmentTypeId: booking.appointment_type_id ?? null
  };
}

/**
 * The first day "Book again" looks at for a free time ('yyyy-MM-dd'): the day after the booking, since a patient is
 * not booked twice on one day, and never before today.
 */
export function bookAgainFrom(bookingDate: string | null | undefined, todayKey: string): string {
  const day = parseDateKey(bookingDate);
  const next = day ? addDaysToKey((bookingDate ?? '').slice(0, 10), 1) : todayKey;
  return next < todayKey ? todayKey : next;
}

/**
 * The practitioner of a pasted booking: the column that was clicked (the day grid), else the copied booking's own
 * (the week grid has a column per day, not per practitioner).
 */
export function pastePractitioner(columnPractitionerId: string | null | undefined, copied: BookingPrefill): string | null {
  return columnPractitionerId || copied.practitionerId || null;
}

/** "Anna, 45 min" for the diary's banner */
export function describeCopied(copied: BookingPrefill): string {
  return `${copied.patientFirstName}, ${formatBookingLength(copied.durationMinutes)}`;
}
