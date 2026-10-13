/**
 * A practice's own appointment types (parity B6): "New patient, 45 min, at most 4 a day". Each is one of the four
 * visit types the system knows (consultation, follow-up, procedure, emergency: billing and reports keep using those),
 * with its own length and an optional daily limit per practitioner. Picking one in the booking form sets the visit type
 * and the length, and the booking keeps which type it was (visits.appointment_type_id). The limit only warns, with
 * "Book anyway", like every other booking check (bookingChecks.ts): a practice may fit in a fifth new patient.
 * Stored in diary_appointment_types (proposals/2026-10-12-diary-statuses-and-types.sql, whose
 * save_diary_appointment_type() checks the same rules).
 */
import type { BookingWarning } from './bookingChecks';
import { BOOKING_LENGTH_MAX, BOOKING_LENGTH_MIN, VISIT_TYPE_LABELS, formatBookingLength, isValidBookingLength, isVisitType, type VisitType } from './bookingLength';
import { formatDiaryDate } from './diaryTime';
import { visitDay, visitHoldsSlot } from './visitOverlap';

/** Same limits as save_diary_appointment_type() */
export const APPOINTMENT_TYPE_NAME_MAX = 40;
export const APPOINTMENT_TYPES_MAX = 30;
export const DAILY_LIMIT_MAX = 50;

export interface AppointmentType {
  id: string;
  name: string;
  /** What the booking is saved, billed and reported as */
  visitType: VisitType;
  lengthMinutes: number;
  /** At most this many bookings of the type per practitioner per day; null = no limit */
  dailyLimit: number | null;
  /** false once removed: no longer offered, bookings made as it keep it */
  isActive: boolean;
}

const wholeNumber = (value: unknown): number | null => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) ? number : null;
};

/** A diary_appointment_types row, or null when it can't be used. */
export function normalizeAppointmentTypeRow(row: unknown): AppointmentType | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const length = wholeNumber(r.length_minutes);
  const limit = wholeNumber(r.daily_limit);
  if (!id || !name || !isVisitType(r.visit_type) || !isValidBookingLength(length)) return null;
  return {
    id,
    name,
    visitType: r.visit_type,
    lengthMinutes: length,
    dailyLimit: limit !== null && limit >= 1 && limit <= DAILY_LIMIT_MAX ? limit : null,
    isActive: r.is_active !== false
  };
}

/** By name, as the booking form and Diary settings list them */
export const sortAppointmentTypes = (types: AppointmentType[]): AppointmentType[] => [...types].sort((a, b) => a.name.localeCompare(b.name));

/** The types the booking form offers: the practice's active types, by name. */
export const bookableAppointmentTypes = (types: AppointmentType[]): AppointmentType[] => sortAppointmentTypes(types.filter((type) => type.isActive));

/** "45 min, at most 4 a day per practitioner, billed as Consultation" */
export function describeAppointmentType(type: Pick<AppointmentType, 'lengthMinutes' | 'dailyLimit' | 'visitType'>): string {
  const parts = [formatBookingLength(type.lengthMinutes)];
  if (type.dailyLimit !== null) parts.push(`at most ${type.dailyLimit} a day per practitioner`);
  parts.push(`billed as ${VISIT_TYPE_LABELS[type.visitType]}`);
  return parts.join(', ');
}

export interface AppointmentTypeInput {
  name: string;
  visitType: string;
  lengthMinutes: number;
  /** null or 0: no limit */
  dailyLimit: number | null;
}

export type AppointmentTypeValidation =
  | { ok: true; value: { name: string; visitType: VisitType; lengthMinutes: number; dailyLimit: number | null } }
  | { ok: false; errors: string[] };

/** Checks the Diary settings form in plain words, before the database does the same. */
export function validateAppointmentType(
  input: AppointmentTypeInput,
  existing: AppointmentType[],
  editingId: string | null = null
): AppointmentTypeValidation {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name) errors.push('Name the appointment type, for example "New patient".');
  else if (name.length > APPOINTMENT_TYPE_NAME_MAX) errors.push(`Keep the name to ${APPOINTMENT_TYPE_NAME_MAX} characters.`);
  else if (existing.some((type) => type.isActive && type.id !== editingId && type.name.toLowerCase() === name.toLowerCase())) {
    errors.push(`There is already an appointment type called "${name}".`);
  }
  if (!isVisitType(input.visitType)) errors.push('Choose what the appointment is billed and reported as.');
  if (!isValidBookingLength(input.lengthMinutes)) errors.push(`Choose a length of ${BOOKING_LENGTH_MIN} to ${BOOKING_LENGTH_MAX} minutes.`);
  const limit = input.dailyLimit === null || input.dailyLimit === 0 ? null : input.dailyLimit;
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > DAILY_LIMIT_MAX)) {
    errors.push(`The daily limit is 1 to ${DAILY_LIMIT_MAX} bookings, or none.`);
  }
  if (!editingId && existing.filter((type) => type.isActive).length >= APPOINTMENT_TYPES_MAX) {
    errors.push(`A practice can have ${APPOINTMENT_TYPES_MAX} appointment types: remove one first.`);
  }
  if (errors.length > 0 || !isVisitType(input.visitType)) return { ok: false, errors };
  return { ok: true, value: { name, visitType: input.visitType, lengthMinutes: input.lengthMinutes, dailyLimit: limit } };
}

/** A booking as the limit counts it */
export interface TypedBooking {
  id: string;
  doctor_id: string | null;
  appointment_type_id?: string | null;
  scheduled_date: string | null;
  visit_date: string | null;
  status: string | null;
  is_cancelled: boolean | null;
}

/**
 * How many bookings of the type the practitioner already has that day. Cancelled bookings and no-shows do not count
 * (they freed their place), nor does the booking being moved or edited.
 */
export function countTypeBookings(
  bookings: TypedBooking[],
  query: { typeId: string; practitionerId: string; date: string; ignoreVisitId?: string | null }
): number {
  return bookings.filter(
    (booking) =>
      booking.id !== query.ignoreVisitId &&
      booking.appointment_type_id === query.typeId &&
      booking.doctor_id === query.practitionerId &&
      visitDay(booking) === query.date &&
      visitHoldsSlot(booking)
  ).length;
}

/**
 * The warning when the practitioner already has the type's daily limit that day, or null. "New patient: Dr A already
 * has 4 on 13 Oct 2026, the most the practice books in a day."
 */
export function dailyLimitWarning(
  type: Pick<AppointmentType, 'name' | 'dailyLimit'> | null | undefined,
  booked: number,
  date: string,
  practitionerName: string | null | undefined
): BookingWarning | null {
  if (!type || type.dailyLimit === null || booked < type.dailyLimit) return null;
  const who = practitionerName?.trim() || 'This practitioner';
  return {
    kind: 'type_daily_limit',
    message: `${type.name}: ${who} already has ${booked} on ${formatDiaryDate(date)}, and the practice books at most ${type.dailyLimit} a day.`
  };
}
