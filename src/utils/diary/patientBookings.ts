/**
 * A patient's bookings for the patient file: what is coming up (soonest first) and what happened
 * (latest first), each with its stage in the clinic's words, its invoice when it has one, and the
 * links back to the diary, the visit and the invoice (principle 2: if A shows B, B links back to A).
 */
import { getVisitStage, STAGE_LABELS, type VisitStage, type VisitStageFields } from '../visitStage';
import { diaryDayParams, type DiaryDayFocus } from './diaryDayFocus';
import { formatDiaryDate } from './diaryTime';

export interface PatientBookingVisit extends VisitStageFields {
  id: string;
  patient_id: string | null;
  doctor_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  visit_date: string | null;
  visit_time: string | null;
}

export interface BookingInvoice {
  id: string;
  visitId: string;
  number: string;
  paymentStatus: string | null;
}

export interface PatientBooking {
  id: string;
  /** 'yyyy-MM-dd' */
  date: string;
  /** 'HH:mm', or null */
  time: string | null;
  practitionerId: string | null;
  stage: VisitStage;
  stageLabel: string;
  invoice: BookingInvoice | null;
}

const startOf = (visit: PatientBookingVisit) => ({
  date: (visit.scheduled_date || visit.visit_date || '').slice(0, 10),
  time: (visit.scheduled_time || visit.visit_time || '').slice(0, 5) || null
});

/**
 * Upcoming: today or later and still to happen (scheduled or checked in), soonest first. Past:
 * everything else, latest first, at most `pastLimit`.
 */
export function splitPatientBookings(
  visits: PatientBookingVisit[],
  invoices: BookingInvoice[],
  today: string,
  pastLimit = 10
): { upcoming: PatientBooking[]; past: PatientBooking[] } {
  const bookings = visits
    .map((visit): PatientBooking | null => {
      const { date, time } = startOf(visit);
      if (!date) return null;
      const stage = getVisitStage(visit);
      return {
        id: visit.id,
        date,
        time,
        practitionerId: visit.doctor_id,
        stage,
        stageLabel: stage === 'in-progress' ? 'With the practitioner' : STAGE_LABELS[stage],
        invoice: invoices.find((invoice) => invoice.visitId === visit.id) ?? null
      };
    })
    .filter((booking): booking is PatientBooking => booking !== null);
  const key = (booking: PatientBooking) => `${booking.date}T${booking.time ?? '99:99'}`;
  const isUpcoming = (booking: PatientBooking) => booking.date >= today && (booking.stage === 'scheduled' || booking.stage === 'checked-in');
  return {
    upcoming: bookings.filter(isUpcoming).sort((a, b) => key(a).localeCompare(key(b))),
    past: bookings
      .filter((booking) => !isUpcoming(booking))
      .sort((a, b) => key(b).localeCompare(key(a)))
      .slice(0, pastLimit)
  };
}

/** "8 Oct 2026, 09:30" */
export const formatBookingWhen = (booking: Pick<PatientBooking, 'date' | 'time'>): string =>
  `${formatDiaryDate(booking.date)}${booking.time ? `, ${booking.time}` : ''}`;

/** Where each link goes. Pages read these in src/pages/Dashboard.tsx and the patient list. */
export const bookingLinks = {
  /** The day in the diary; with a focus (diaryDayFocus.ts) the booking is in view on arrival */
  diaryDay: (date: string, focus?: DiaryDayFocus | null) => `/?${diaryDayParams(date, focus).toString()}`,
  /** The visit in the patient file */
  visit: (patientId: string, visitId: string) =>
    `/patients?patientId=${encodeURIComponent(patientId)}&tab=encounters&visitId=${encodeURIComponent(visitId)}&action=edit-visit`,
  /** The patient's invoices (the Billing tab of the patient file) */
  invoices: (patientId: string) => `/patients?patientId=${encodeURIComponent(patientId)}&tab=billing`,
  /** The patient file */
  patient: (patientId: string) => `/patients?patientId=${encodeURIComponent(patientId)}`
};
