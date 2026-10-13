/**
 * When two bookings take the same doctor's time. Pure (no Supabase import), so the diary checks
 * and their tests can use it; utils/appointments.ts re-exports it for the older callers.
 */
import { addMinutes, parse, setHours, setMinutes } from 'date-fns';
import { FALLBACK_BOOKING_LENGTH, resolveBookingLength, type TypeLengths } from './bookingLength';

/**
 * Minutes a booking without a stored length takes when the practice's lengths are not known (the
 * older callers in utils/appointments.ts). The diary itself resolves lengths with bookingLength.ts.
 */
export const APPOINTMENT_DURATION = FALLBACK_BOOKING_LENGTH;

export interface ConflictVisit {
  id: string;
  visit_date: string | null;
  visit_time: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string | null;
  is_cancelled: boolean | null;
  /** The booked length (visits.duration_minutes); null = the practice default for visit_type */
  duration_minutes?: number | null;
  visit_type?: string | null;
}

/** False for bookings that no longer hold their slot: cancelled visits and no-shows free it. */
export function visitHoldsSlot(visit: Pick<ConflictVisit, 'status' | 'is_cancelled'>): boolean {
  return !visit.is_cancelled && !['cancelled', 'no-show'].includes(visit.status ?? '');
}

/**
 * The day a visit takes place ('yyyy-MM-dd'). A visit moved while only scheduled_* was updated still
 * has its old visit_date, but it now takes place on scheduled_date.
 */
export function visitDay(visit: Pick<ConflictVisit, 'scheduled_date' | 'visit_date'>): string {
  return (visit.scheduled_date || visit.visit_date || '').slice(0, 10);
}

/**
 * True when an existing visit overlaps the requested slot. Bookings store their date/time in
 * scheduled_* (and visit_*); the visit blocks its own length (its stored length, else the practice's
 * default for its type from `lengths`, else 30 minutes). Cancelled visits and no-shows free their slot.
 */
export function visitOverlapsSlot(visit: ConflictVisit, slotStart: Date, durationMinutes: number, lengths?: TypeLengths | null): boolean {
  if (!visitHoldsSlot(visit)) return false;
  const date = visit.scheduled_date || visit.visit_date;
  const time = visit.scheduled_time || visit.visit_time;
  if (!date || !time) return false;
  const [hours, minutes] = time.split(':').map(Number);
  const visitStart = setMinutes(setHours(parse(date.slice(0, 10), 'yyyy-MM-dd', new Date()), hours), minutes);
  const visitEnd = addMinutes(visitStart, resolveBookingLength(visit, lengths));
  const slotEnd = addMinutes(slotStart, durationMinutes);
  return slotStart < visitEnd && slotEnd > visitStart;
}
