/**
 * Diary report: per practitioner, how many bookings a period had, how many patients came, did not
 * come or cancelled, and how full the diary was (booked hours against the hours they were
 * available). Every number keeps the ids of the bookings it counts, so the report links straight to
 * them (B23 in the parity backlog: Eminance prints totals only).
 *
 * Definitions (the same words the report shows):
 * - Bookings: every booking in the period, cancelled ones included.
 * - Seen: checked in, with the practitioner or completed.
 * - No-shows: marked no-show. The no-show rate is no-shows out of the patients who were due
 *   (seen + no-shows), so bookings still to come do not lower it.
 * - Cancelled: cancelled by the practice or the patient; the rate is out of all bookings.
 * - Not marked: past bookings nobody checked in or marked as a no-show (worth a look).
 * - Booked hours: the length of every booking that kept its slot (no-shows included: the time was
 *   taken). Available hours: the practitioner's working hours (else the practice's opening hours)
 *   less breaks, blocked time and public holidays.
 */
import { diaryBlockAppliesTo, diaryBlockWindowOn, type DiaryBlock } from './blockedTime';
import { addDaysToKey } from './diaryTime';
import { diaryHolidayOn } from './holidays';
import type { HoursForDay } from './nextFreeSlot';

export type ReportOutcome = 'seen' | 'no_show' | 'cancelled' | 'upcoming';

export interface ReportBooking {
  id: string;
  patientId: string | null;
  patientName: string;
  practitionerId: string | null;
  /** 'yyyy-MM-dd' */
  date: string;
  /** 'HH:mm' or null */
  time: string | null;
  outcome: ReportOutcome;
  /** Minutes (its booked length, else its type's default) */
  minutes: number;
  /** The practice's own status it was last given (diaryStatuses.ts), for "By status"; null = none */
  statusId?: string | null;
}

export interface ReportVisitRow {
  id: string;
  patient_id: string | null;
  doctor_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  visit_date: string | null;
  visit_time: string | null;
  status: string | null;
  is_cancelled: boolean | null;
  is_checked_in?: boolean | null;
  is_ready?: boolean | null;
}

/** Where a booking ended up, in the report's words. */
export function reportOutcome(visit: Pick<ReportVisitRow, 'status' | 'is_cancelled' | 'is_checked_in' | 'is_ready'>): ReportOutcome {
  const status = visit.status ?? '';
  if (visit.is_cancelled || status === 'cancelled') return 'cancelled';
  if (status === 'no-show') return 'no_show';
  if (status === 'completed' || status === 'in-progress' || status === 'ready' || visit.is_checked_in || visit.is_ready) return 'seen';
  return 'upcoming';
}

export interface PractitionerReportRow {
  /** null: bookings without a practitioner (website requests not yet given one) */
  practitionerId: string | null;
  name: string;
  bookingIds: string[];
  seenIds: string[];
  noShowIds: string[];
  cancelledIds: string[];
  /** Still to come (today or later) */
  upcomingIds: string[];
  /** In the past but never checked in or marked a no-show */
  unmarkedIds: string[];
  bookedMinutes: number;
  /** Null when the practitioner was not available at all in the period */
  availableMinutes: number | null;
  /** 0-1, null when nobody was due yet */
  noShowRate: number | null;
  /** 0-1, null without bookings */
  cancellationRate: number | null;
  /** 0-1 (can pass 1 when double-booked), null without available hours */
  utilisation: number | null;
}

type Interval = { start: number; end: number };

/** The parts of `windows` not covered by `cut`. */
function subtract(windows: Interval[], cut: Interval[]): Interval[] {
  let result = windows;
  for (const piece of cut) {
    result = result.flatMap((window) => {
      if (piece.end <= window.start || piece.start >= window.end) return [window];
      const left = piece.start > window.start ? [{ start: window.start, end: piece.start }] : [];
      const right = piece.end < window.end ? [{ start: piece.end, end: window.end }] : [];
      return [...left, ...right];
    });
  }
  return result;
}

/** Minutes a practitioner could be booked from `from` to `to`: hours less breaks, blocks and holidays. */
export function availableMinutes(hoursFor: HoursForDay, blocks: DiaryBlock[], practitionerId: string, from: string, to: string): number {
  let total = 0;
  for (let day = from; day <= to; day = addDaysToKey(day, 1)) {
    const hours = hoursFor(day);
    if (!hours || diaryHolidayOn(day)) continue;
    const blocked = blocks
      .filter((block) => diaryBlockAppliesTo(block, practitionerId))
      .map((block) => diaryBlockWindowOn(block, day))
      .filter((window): window is Interval => window !== null);
    const open = subtract([{ start: hours.open, end: hours.close }], [...(hours.breaks ?? []), ...blocked]);
    total += open.reduce((sum, window) => sum + (window.end - window.start), 0);
  }
  return total;
}

export interface DiaryReportInput {
  bookings: ReportBooking[];
  practitioners: Array<{ id: string; name: string }>;
  /** 'yyyy-MM-dd', both included */
  from: string;
  to: string;
  /** Hours for one practitioner (their own, else the practice's opening hours) */
  hoursFor: (practitionerId: string) => HoursForDay;
  blocks: DiaryBlock[];
  /** Today ('yyyy-MM-dd'): open bookings before it were never marked */
  today: string;
}

const rate = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

/** One row per practitioner (those with bookings or in the list), busiest first. */
export function buildDiaryReport(input: DiaryReportInput): PractitionerReportRow[] {
  const inPeriod = input.bookings.filter((booking) => booking.date >= input.from && booking.date <= input.to);
  const ids = new Set<string | null>(input.practitioners.map((p) => p.id));
  for (const booking of inPeriod) ids.add(booking.practitionerId);

  const rows = [...ids].map((practitionerId): PractitionerReportRow => {
    const own = inPeriod.filter((booking) => booking.practitionerId === practitionerId);
    const ofOutcome = (outcome: ReportOutcome) => own.filter((booking) => booking.outcome === outcome).map((booking) => booking.id);
    const seenIds = ofOutcome('seen');
    const noShowIds = ofOutcome('no_show');
    const cancelledIds = ofOutcome('cancelled');
    const bookedMinutes = own.filter((booking) => booking.outcome !== 'cancelled').reduce((sum, booking) => sum + booking.minutes, 0);
    const available = practitionerId ? availableMinutes(input.hoursFor(practitionerId), input.blocks, practitionerId, input.from, input.to) : 0;
    return {
      practitionerId,
      name: practitionerId ? input.practitioners.find((p) => p.id === practitionerId)?.name ?? 'Former practitioner' : 'No practitioner yet',
      bookingIds: own.map((booking) => booking.id),
      seenIds,
      noShowIds,
      cancelledIds,
      upcomingIds: own.filter((booking) => booking.outcome === 'upcoming' && booking.date >= input.today).map((booking) => booking.id),
      unmarkedIds: own.filter((booking) => booking.outcome === 'upcoming' && booking.date < input.today).map((booking) => booking.id),
      bookedMinutes,
      availableMinutes: available > 0 ? available : null,
      noShowRate: rate(noShowIds.length, seenIds.length + noShowIds.length),
      cancellationRate: rate(cancelledIds.length, own.length),
      utilisation: available > 0 ? bookedMinutes / available : null
    };
  });
  // Practitioners without bookings stay listed (an empty diary is worth seeing), after the busy ones
  return rows.sort((a, b) => b.bookingIds.length - a.bookingIds.length || a.name.localeCompare(b.name));
}

export interface PatientNoShows {
  patientId: string;
  patientName: string;
  /** The no-shows of the period, by booking id, oldest first */
  bookingIds: string[];
  /** Their days ('yyyy-MM-dd'), oldest first */
  dates: string[];
  /** Bookings the patient was due for in the period (seen + no-shows), so "2 of 3" says how often */
  dueCount: number;
}

/**
 * The no-shows report (parity O5): who missed appointments in the period, when, and how often (out of the bookings
 * they were due for). Most no-shows first, then the latest. Cancelled and future bookings are not "due".
 */
export function noShowsByPatient(bookings: readonly ReportBooking[], from: string, to: string): PatientNoShows[] {
  const byPatient = new Map<string, { name: string; noShows: ReportBooking[]; due: number }>();
  for (const booking of bookings) {
    if (!booking.patientId || booking.date < from || booking.date > to) continue;
    if (booking.outcome !== 'no_show' && booking.outcome !== 'seen') continue;
    const entry = byPatient.get(booking.patientId) ?? { name: booking.patientName, noShows: [], due: 0 };
    entry.due += 1;
    if (booking.outcome === 'no_show') entry.noShows.push(booking);
    byPatient.set(booking.patientId, entry);
  }
  const rows: PatientNoShows[] = [];
  for (const [patientId, entry] of byPatient) {
    if (entry.noShows.length === 0) continue;
    const ordered = [...entry.noShows].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
    rows.push({
      patientId,
      patientName: entry.name,
      bookingIds: ordered.map((booking) => booking.id),
      dates: ordered.map((booking) => booking.date),
      dueCount: entry.due
    });
  }
  return rows.sort(
    (a, b) =>
      b.dates.length - a.dates.length ||
      b.dates[b.dates.length - 1].localeCompare(a.dates[a.dates.length - 1]) ||
      a.patientName.localeCompare(b.patientName)
  );
}

/** "12%" (rounded), "-" when there is nothing to divide. */
export const formatRate = (value: number | null): string => (value === null ? '-' : `${Math.round(value * 100)}%`);

/** "22.5 h" */
export const formatHours = (minutes: number): string => `${Math.round((minutes / 60) * 10) / 10} h`;
