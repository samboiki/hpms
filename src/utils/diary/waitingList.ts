/**
 * The diary's waiting list (parity B21): patients who want an earlier time than the diary has for them, with the
 * practitioner, the days and times that suit them and until when they wait. When a booking is cancelled or reception
 * clicks a free time, the diary lists who on the list could take it (whoCouldTake: first come, first served), and
 * reception offers the time by SMS through the practice's SMS gateway (offerMessage) or books it straight away.
 * The patient's answer goes to the SMS Replies inbox for staff: YES never books anything by itself
 * (supabase/functions/_shared/smsReplyPlan.ts, 'waitlist_accept').
 * Stored in diary_waiting_list (proposals/2026-10-13-diary-waiting-list.sql, whose save_waiting_list_entry() checks
 * the same rules).
 */
import { fitReply, formatVisitWhen, practicePhoneForSms } from '../../../supabase/functions/_shared/smsReplyPlan.ts';
import { withReplyInvite } from '../../../supabase/functions/_shared/smsMessagePolicy.ts';
import { BOOKING_LENGTH_MAX, BOOKING_LENGTH_MIN, isValidBookingLength, type VisitType } from './bookingLength';
import { addDaysToKey, formatDiaryDate, parseDateKey, timeToMinutes, weekdayOfKey } from './diaryTime';
import { windhoekClock } from '../patientLists/listDates';
import { normalizePhoneNumber } from '../../components/patients/patientContact';

export const WAITING_LIST_TABLE = 'diary_waiting_list';

export type WaitingStatus = 'waiting' | 'offered' | 'booked' | 'removed';

/** Same limits as save_waiting_list_entry() */
export const WAITING_NOTE_MAX = 300;
/** A patient waits at most a year: an entry older than that is forgotten, not kept "just in case" */
export const WAITING_DAYS_AHEAD_MAX = 365;

/** Days of the week as the diary counts them (0 = Sunday ... 6 = Saturday), Monday first as practices read a week */
export const WAITING_DAYS: ReadonlyArray<{ day: number; short: string; label: string }> = [
  { day: 1, short: 'Mon', label: 'Monday' },
  { day: 2, short: 'Tue', label: 'Tuesday' },
  { day: 3, short: 'Wed', label: 'Wednesday' },
  { day: 4, short: 'Thu', label: 'Thursday' },
  { day: 5, short: 'Fri', label: 'Friday' },
  { day: 6, short: 'Sat', label: 'Saturday' },
  { day: 0, short: 'Sun', label: 'Sunday' }
];

/**
 * The SMS asks for YES or NO only while the practice's replies are collected (smsMessagePolicy.ts withReplyInvite);
 * smsReplyIntent.ts reads YES/1 and NO/2 as the answer to an offer.
 */
export const OFFER_REPLY_INVITE = 'Reply YES to take it or NO to let it go.';

/**
 * How an offer is sent: as its own message type, which is not an essential one (smsMessagePolicy.ts
 * ESSENTIAL_SMS_TYPES), so the SMS gateway never sends it to a patient who replied STOP, nor to a number another patient
 * file of the practice replied STOP from. The type also marks the SMS as an offer, so a YES is read as "wants the slot"
 * and never confirms another booking (smsMessagePolicy.ts WAITLIST_OFFER_MARKERS).
 */
export const OFFER_SMS_TYPE = 'waitlist_offer';
export const OFFER_SMS_SOURCE = 'waitlist_offer';

export interface WaitingPatient {
  id: string;
  firstName: string;
  lastName: string;
  cellNumber: string | null;
  /** Replied STOP (patients.sms_opt_out, the flag every SMS the practice sends honours): no offer by SMS */
  smsOptOut: boolean;
}

/** Can a time be offered to the patient by SMS? Never when they asked for no SMS; phoning them stays possible. */
export type SmsOfferState = 'can_offer' | 'asked_for_no_sms' | 'no_cell_number';

export function smsOfferState(patient: Pick<WaitingPatient, 'cellNumber' | 'smsOptOut'>): SmsOfferState {
  if (patient.smsOptOut) return 'asked_for_no_sms';
  return normalizePhoneNumber(patient.cellNumber) ? 'can_offer' : 'no_cell_number';
}

export interface WaitingOffer {
  /** 'yyyy-MM-dd' */
  date: string;
  /** 'HH:mm' */
  time: string;
  practitionerId: string | null;
  /** When it was offered (ISO) */
  at: string | null;
}

export interface WaitingListEntry {
  id: string;
  patient: WaitingPatient;
  /** null: any practitioner */
  practitionerId: string | null;
  appointmentTypeId: string | null;
  /** How long the time must be */
  lengthMinutes: number;
  /** Days that suit (0 = Sunday ... 6 = Saturday); empty: any day */
  days: number[];
  /** 'HH:mm', or null: from opening */
  from: string | null;
  /** 'HH:mm', or null: until closing */
  to: string | null;
  /** The last day the patient waits ('yyyy-MM-dd') */
  until: string;
  /** The booking the patient would like earlier, when they have one: an offer must be earlier than it */
  current: { visitId: string; date: string; time: string | null } | null;
  note: string | null;
  status: WaitingStatus;
  offer: WaitingOffer | null;
  bookedVisitId: string | null;
  createdAt: string;
}

/** A free time in the diary: a cancelled booking's place, or a time reception clicked */
export interface DiarySlot {
  practitionerId: string;
  /** 'yyyy-MM-dd' */
  date: string;
  /** 'HH:mm' */
  time: string;
  lengthMinutes: number;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

const hhmm = (value: unknown): string | null => {
  const minutes = timeToMinutes(text(value));
  return minutes === null ? null : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

const dateKey = (value: unknown): string | null => {
  const key = text(value)?.slice(0, 10) ?? null;
  return key && parseDateKey(key) ? key : null;
};

const STATUSES: readonly WaitingStatus[] = ['waiting', 'offered', 'booked', 'removed'];

/** Days as stored (smallint[]): only 0-6, each once, in week order (Monday first) */
export function cleanDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  const wanted = new Set(days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6));
  return WAITING_DAYS.map((entry) => entry.day).filter((day) => wanted.has(day));
}

/**
 * A diary_waiting_list row with its patient (patient:patients(...)) and the booking it wants earlier
 * (current:visits(...)) embedded, or null when it cannot be used.
 */
export function normalizeWaitingListRow(row: unknown): WaitingListEntry | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const until = dateKey(r.wait_until);
  const status = STATUSES.find((value) => value === r.status) ?? null;
  const length = typeof r.length_minutes === 'number' ? r.length_minutes : Number(r.length_minutes);
  const patientRaw = Array.isArray(r.patient) ? r.patient[0] : r.patient;
  const patient = patientRaw && typeof patientRaw === 'object' ? (patientRaw as Record<string, unknown>) : null;
  const patientId = text(r.patient_id) ?? text(patient?.id);
  if (!id || !until || !status || !patientId || !isValidBookingLength(length)) return null;

  const currentRaw = Array.isArray(r.current) ? r.current[0] : r.current;
  const current = currentRaw && typeof currentRaw === 'object' ? (currentRaw as Record<string, unknown>) : null;
  const currentDate = current ? dateKey(current.scheduled_date) ?? dateKey(current.visit_date) : null;
  // A booking that was cancelled or seen no longer needs moving
  const currentHolds = current ? current.is_cancelled !== true && !['cancelled', 'no-show', 'completed'].includes(String(current.status ?? '')) : false;
  const visitId = text(r.current_visit_id);

  const offerDate = dateKey(r.offered_date);
  const offerTime = hhmm(r.offered_time);
  return {
    id,
    patient: {
      id: patientId,
      firstName: text(patient?.first_name) ?? '',
      lastName: text(patient?.last_name) ?? '',
      cellNumber: text(patient?.cell_number),
      smsOptOut: patient?.sms_opt_out === true
    },
    practitionerId: text(r.practitioner_id),
    appointmentTypeId: text(r.appointment_type_id),
    lengthMinutes: length,
    days: cleanDays(r.preferred_days),
    from: hhmm(r.preferred_from),
    to: hhmm(r.preferred_to),
    until,
    current:
      visitId && currentDate && currentHolds
        ? { visitId, date: currentDate, time: hhmm(current?.scheduled_date ? current?.scheduled_time : current?.visit_time) }
        : null,
    note: text(r.note),
    status,
    offer: offerDate && offerTime ? { date: offerDate, time: offerTime, practitionerId: text(r.offered_practitioner_id), at: text(r.offered_at) } : null,
    bookedVisitId: text(r.booked_visit_id),
    createdAt: text(r.created_at) ?? ''
  };
}

/** Still on the list: waiting or offered, and not past its last day */
export const isOpenEntry = (entry: Pick<WaitingListEntry, 'status' | 'until'>, today: string): boolean =>
  (entry.status === 'waiting' || entry.status === 'offered') && entry.until >= today;

/** Open on the list but past its last day: shown as "Waited until ..." so reception can remove it */
export const isLapsedEntry = (entry: Pick<WaitingListEntry, 'status' | 'until'>, today: string): boolean =>
  (entry.status === 'waiting' || entry.status === 'offered') && entry.until < today;

/** "Dr A's patients first" is not a rule: whoever waited longest comes first */
const byWaitingLongest = (a: WaitingListEntry, b: WaitingListEntry): number =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** "Now" as fitsSlot reads it: the Windhoek date and minutes since midnight, whatever the computer's time zone */
export function waitingNow(now: Date = new Date()): { date: string; minutes: number } {
  const clock = windhoekClock(now);
  return { date: clock.dateKey, minutes: clock.minutes };
}

/**
 * Could this patient take the time? The practitioner they asked for (or any), a day and a time window that suit them,
 * long enough for what they need, on or before their last day, not in the past, and earlier than the booking they
 * already have.
 */
export function fitsSlot(entry: WaitingListEntry, slot: DiarySlot, now: { date: string; minutes: number }): boolean {
  if (!isOpenEntry(entry, now.date)) return false;
  if (entry.practitionerId && entry.practitionerId !== slot.practitionerId) return false;
  const start = timeToMinutes(slot.time);
  if (start === null || !parseDateKey(slot.date)) return false;
  if (slot.date < now.date || (slot.date === now.date && start <= now.minutes)) return false;
  if (slot.date > entry.until) return false;
  if (entry.days.length > 0 && !entry.days.includes(weekdayOfKey(slot.date))) return false;
  if (slot.lengthMinutes < entry.lengthMinutes) return false;
  const from = timeToMinutes(entry.from);
  const to = timeToMinutes(entry.to);
  if (from !== null && start < from) return false;
  if (to !== null && start + entry.lengthMinutes > to) return false;
  if (entry.current) {
    const currentStart = timeToMinutes(entry.current.time) ?? 24 * 60;
    if (slot.date > entry.current.date || (slot.date === entry.current.date && start >= currentStart)) return false;
  }
  return true;
}

/** Everyone on the list who could take the time, whoever waited longest first */
export function whoCouldTake(entries: WaitingListEntry[], slot: DiarySlot, now: { date: string; minutes: number }): WaitingListEntry[] {
  return entries.filter((entry) => fitsSlot(entry, slot, now)).sort(byWaitingLongest);
}

/** The list as reception reads it: open entries first (longest waiting first), then the ones whose last day passed */
export function sortWaitingList(entries: WaitingListEntry[], today: string): WaitingListEntry[] {
  const open = entries.filter((entry) => isOpenEntry(entry, today)).sort(byWaitingLongest);
  const lapsed = entries.filter((entry) => isLapsedEntry(entry, today)).sort(byWaitingLongest);
  return [...open, ...lapsed];
}

/** "Mon, Wed and Fri", "Any day" */
export function describeDays(days: number[]): string {
  const shorts = WAITING_DAYS.filter((entry) => days.includes(entry.day)).map((entry) => entry.short);
  if (shorts.length === 0 || shorts.length === 7) return 'Any day';
  if (shorts.length === 1) return shorts[0];
  return `${shorts.slice(0, -1).join(', ')} and ${shorts[shorts.length - 1]}`;
}

/** "08:00-12:00", "From 14:00", "Until 11:00", "Any time" */
export function describeTimes(from: string | null, to: string | null): string {
  if (from && to) return `${from}-${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return 'Any time';
}

/** "Mon and Wed, 08:00-12:00, until 31 Oct 2026" */
export function describePreferences(entry: Pick<WaitingListEntry, 'days' | 'from' | 'to' | 'until'>): string {
  return `${describeDays(entry.days)}, ${describeTimes(entry.from, entry.to).replace(/^Any time$/, 'any time')}, until ${formatDiaryDate(entry.until)}`;
}

/** "Tue 14 Oct at 10:30" */
export const describeSlotWhen = (date: string, time: string): string =>
  formatVisitWhen({ id: '', practice_id: null, patient_id: null, status: null, scheduled_date: date, scheduled_time: time }) ?? `${formatDiaryDate(date)} at ${time}`;

export interface WaitingListDraft {
  patientId: string | null;
  practitionerId: string | null;
  appointmentTypeId: string | null;
  lengthMinutes: number;
  days: number[];
  /** 'HH:mm' or '' */
  from: string;
  to: string;
  /** 'yyyy-MM-dd' */
  until: string;
  currentVisitId: string | null;
  note: string;
}

export interface WaitingListValue {
  patientId: string;
  practitionerId: string | null;
  appointmentTypeId: string | null;
  lengthMinutes: number;
  days: number[];
  from: string | null;
  to: string | null;
  until: string;
  currentVisitId: string | null;
  note: string | null;
}

export type WaitingListValidation = { ok: true; value: WaitingListValue } | { ok: false; errors: string[] };

/** Checks the waiting list form in plain words, before the database does the same. */
export function validateWaitingListDraft(draft: WaitingListDraft, today: string): WaitingListValidation {
  const errors: string[] = [];
  if (!draft.patientId) errors.push('Choose the patient who is waiting.');
  if (!isValidBookingLength(draft.lengthMinutes)) errors.push(`Choose a length of ${BOOKING_LENGTH_MIN} to ${BOOKING_LENGTH_MAX} minutes.`);
  const from = draft.from.trim() ? timeToMinutes(draft.from) : null;
  const to = draft.to.trim() ? timeToMinutes(draft.to) : null;
  if (draft.from.trim() && from === null) errors.push('The earliest time is not a time of day.');
  if (draft.to.trim() && to === null) errors.push('The latest time is not a time of day.');
  if (from !== null && to !== null && to - from < Math.max(draft.lengthMinutes, BOOKING_LENGTH_MIN)) {
    errors.push('The latest time must leave room for the whole appointment after the earliest time.');
  }
  const until = parseDateKey(draft.until) ? draft.until : null;
  if (!until) errors.push('Choose until when the patient waits.');
  else if (until < today) errors.push('The last day to wait cannot be in the past.');
  else if (until > addDaysToKey(today, WAITING_DAYS_AHEAD_MAX)) errors.push('A patient can wait at most a year: choose an earlier last day.');
  const note = draft.note.trim();
  if (note.length > WAITING_NOTE_MAX) errors.push(`Keep the note to ${WAITING_NOTE_MAX} characters.`);
  if (errors.length > 0 || !draft.patientId || !until) return { ok: false, errors };
  return {
    ok: true,
    value: {
      patientId: draft.patientId,
      practitionerId: draft.practitionerId || null,
      appointmentTypeId: draft.appointmentTypeId || null,
      lengthMinutes: draft.lengthMinutes,
      days: cleanDays(draft.days),
      from: from === null ? null : draft.from.trim().slice(0, 5).padStart(5, '0'),
      to: to === null ? null : draft.to.trim().slice(0, 5).padStart(5, '0'),
      until,
      currentVisitId: draft.currentVisitId || null,
      note: note || null
    }
  };
}

export interface OfferMessageInput {
  practiceName: string | null;
  /** The practice's phone as stored (the first number is used) */
  practicePhone: string | null;
  patientFirstName: string | null;
  practitionerName: string | null;
  date: string;
  time: string;
  /** The practice's SMS replies are collected: only then may the SMS ask for YES or NO */
  repliesLive: boolean;
}

/**
 * The offer: "Example Practice: Hi Maria, an earlier time came free: Tue 14 Oct at 10:30 with Dr A Nangolo. Reply YES
 * to take it or NO to let it go." Without collected replies the patient is asked to call. The practice name is
 * shortened to keep one SMS where it can (fitReply); the time and the instruction never are.
 */
export function offerMessage(input: OfferMessageInput): string {
  const greeting = input.patientFirstName?.trim() ? `Hi ${input.patientFirstName.trim()}, ` : 'Hi, ';
  const withWho = input.practitionerName?.trim() ? ` with ${input.practitionerName.trim()}` : '';
  const phone = practicePhoneForSms(input.practicePhone);
  const callLine = phone ? `Call ${phone} to take it.` : 'Call the practice to take it.';
  const when = describeSlotWhen(input.date, input.time);
  return fitReply((name) => {
    const body = `${name}: ${greeting}an earlier time came free: ${when}${withWho}.`;
    return input.repliesLive ? withReplyInvite(body, OFFER_REPLY_INVITE, true) : `${body} ${callLine}`;
  }, input.practiceName);
}

/** What the list says about an offer: "Offered Tue 14 Oct at 10:30" */
export function describeOffer(offer: WaitingOffer | null): string | null {
  return offer ? `Offered ${describeSlotWhen(offer.date, offer.time)}` : null;
}

/** A booking as the diary holds it (PremiumAppointmentScheduler's appointments) */
export interface DiaryBookingLike {
  doctor_id: string | null | undefined;
  /** 'yyyy-MM-dd' */
  date: string;
  /** 'HH:mm' or 'HH:mm:ss' */
  time: string;
  /** Minutes the booking takes in the diary */
  duration: number;
  status?: string | null;
  is_cancelled?: boolean | null;
}

/**
 * How long the practitioner is free from a time reception clicked: until their next booking that day (else the end of
 * the day); 0 when a booking already holds that time. Cancelled bookings and no-shows hold nothing.
 */
export function freeMinutesFrom(bookings: DiaryBookingLike[], practitionerId: string, date: string, time: string): number {
  const start = timeToMinutes(time);
  if (start === null) return 0;
  let end = 24 * 60;
  for (const booking of bookings) {
    if (booking.doctor_id !== practitionerId || (booking.date ?? '').slice(0, 10) !== date) continue;
    if (booking.is_cancelled || booking.status === 'cancelled' || booking.status === 'no-show') continue;
    const bookingStart = timeToMinutes(booking.time);
    if (bookingStart === null) continue;
    if (bookingStart <= start && bookingStart + Math.max(BOOKING_LENGTH_MIN, booking.duration || 0) > start) return 0;
    if (bookingStart > start && bookingStart < end) end = bookingStart;
  }
  return end - start;
}

/**
 * The time a cancelled or deleted booking frees, for the waiting list's offer (Cancel Visit, Delete Booking and the
 * Reschedule form's Cancel Appointment): its practitioner, day, start and length. null when it had no practitioner,
 * day or time, so nobody's diary time came free.
 */
export function freedSlotOf(booking: Pick<DiaryBookingLike, 'doctor_id' | 'date' | 'time' | 'duration'>): DiarySlot | null {
  const date = dateKey(booking.date);
  const time = hhmm(booking.time);
  if (!booking.doctor_id || !date || !time) return null;
  return { practitionerId: booking.doctor_id, date, time, lengthMinutes: booking.duration };
}

/** What the booking form starts with when reception books a waiting patient (bookingCopy.ts BookingPrefill) */
export function bookingPrefillFor(
  entry: WaitingListEntry,
  type: { visitType: VisitType } | null
): {
  patientId: string;
  patientName: string;
  patientFirstName: string;
  practitionerId: string | null;
  type: VisitType;
  durationMinutes: number;
  reason: string;
  appointmentTypeId: string | null;
} {
  const name = [entry.patient.firstName, entry.patient.lastName].filter(Boolean).join(' ') || 'Patient';
  return {
    patientId: entry.patient.id,
    patientName: name,
    patientFirstName: entry.patient.firstName || name,
    practitionerId: entry.practitionerId,
    type: type?.visitType ?? 'consultation',
    durationMinutes: entry.lengthMinutes,
    reason: entry.note ?? '',
    appointmentTypeId: entry.appointmentTypeId
  };
}

/** "Maria Shikongo" */
export const waitingPatientName = (entry: Pick<WaitingListEntry, 'patient'>): string =>
  [entry.patient.firstName, entry.patient.lastName].filter(Boolean).join(' ') || 'Patient without a name';
