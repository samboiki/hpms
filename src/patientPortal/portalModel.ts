/**
 * The patient app's data, as the portal_* database functions return it (proposals/2026-10-07-patient-portal.sql),
 * and the rules for showing it. Pure, so it is unit tested.
 */
import { format, parseISO } from 'date-fns';
import { getResultStatus, type LabResultStatus } from '../utils/labResultStatus';
import {
  clinicDateKey,
  smsVisitStage,
  visitDateTime,
  visitStartInstant,
  type SmsVisit,
  type SmsVisitStage,
} from '../../supabase/functions/_shared/smsReplyPlan.ts';

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const flag = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const amount = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const record = (row: unknown): Record<string, unknown> | null => (row && typeof row === 'object' ? (row as Record<string, unknown>) : null);

// ---------------------------------------------------------------------------------------------
// Dates (day first, as Namibians write them)
// ---------------------------------------------------------------------------------------------

/**
 * "Wed 9 Oct 2026" from yyyy-mm-dd (or a timestamp), or null. A timestamp is a moment: its day is the day in Windhoek
 * (UTC+2), so a request sent at 01:30 on the 9th shows the 9th, not the 8th (the UTC day).
 */
export function formatDay(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  const instant = raw.length > 10 && (raw[10] === 'T' || raw[10] === ' ') ? new Date(raw) : null;
  const key = instant && !Number.isNaN(instant.getTime()) ? clinicDateKey(instant) : raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = parseISO(key);
  return Number.isNaN(date.getTime()) ? null : format(date, 'EEE d MMM yyyy');
}

/** "Wed 9 Oct 2026, 14:05" (this device's time) from a timestamp, or null. */
export function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : format(date, 'EEE d MMM yyyy, HH:mm');
}

/** "09:30" from a stored time ("09:30:00"), or null. */
export function formatTime(value: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec((value ?? '').trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

// ---------------------------------------------------------------------------------------------
// Linked patients
// ---------------------------------------------------------------------------------------------

export interface PracticeBankDetails {
  bankName: string;
  accountHolder: string | null;
  accountNumber: string;
  accountType: string | null;
  branchCode: string | null;
  swiftCode: string | null;
}

export interface LinkedPatient {
  patientId: string;
  relationship: 'self' | 'child';
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  idNumber: string | null;
  cellNumber: string | null;
  email: string | null;
  homeAddress: string | null;
  postalAddress: string | null;
  postalCode: string | null;
  practiceId: string | null;
  practiceName: string | null;
  practicePhone: string | null;
  practiceEmail: string | null;
  practiceAddress: string | null;
  /** Null when the practice has not set its bank name and account number */
  bank: PracticeBankDetails | null;
}

export function toLinkedPatient(row: unknown): LinkedPatient | null {
  const r = record(row);
  const patientId = r ? text(r.patient_id) : null;
  if (!r || !patientId) return null;
  const bankName = text(r.bank_name);
  const accountNumber = text(r.bank_account_number);
  return {
    patientId,
    relationship: r.relationship === 'child' ? 'child' : 'self',
    firstName: text(r.first_name) ?? '',
    lastName: text(r.last_name) ?? '',
    dateOfBirth: text(r.date_of_birth),
    gender: text(r.gender),
    idNumber: text(r.id_number),
    cellNumber: text(r.cell_number),
    email: text(r.email),
    homeAddress: text(r.home_address),
    postalAddress: text(r.postal_address),
    postalCode: text(r.postal_code),
    practiceId: text(r.practice_id),
    practiceName: text(r.practice_name),
    practicePhone: text(r.practice_phone),
    practiceEmail: text(r.practice_email),
    practiceAddress: text(r.practice_address),
    bank:
      bankName && accountNumber
        ? {
            bankName,
            accountHolder: text(r.bank_account_holder),
            accountNumber,
            accountType: text(r.bank_account_type),
            branchCode: text(r.bank_branch_code),
            swiftCode: text(r.bank_swift_code),
          }
        : null,
  };
}

export const patientName = (patient: Pick<LinkedPatient, 'firstName' | 'lastName'>): string =>
  [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient';

// ---------------------------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------------------------

export interface PortalAppointment {
  visit: SmsVisit;
  practiceName: string | null;
  practicePhone: string | null;
  visitType: string | null;
  doctorName: string | null;
  isConfirmed: boolean;
  /** Local date (yyyy-mm-dd) and time ("09:30") of the appointment */
  date: string | null;
  time: string | null;
  stage: SmsVisitStage;
  /** When it starts (null without a date) */
  start: Date | null;
}

/** A portal_appointments() row; `patientId` is the patient the rows were loaded for. */
export function toAppointment(row: unknown, patientId: string): PortalAppointment | null {
  const r = record(row);
  const id = r ? text(r.visit_id) : null;
  if (!r || !id) return null;
  const visit: SmsVisit = {
    id,
    practice_id: text(r.practice_id),
    patient_id: patientId,
    status: text(r.status),
    is_cancelled: flag(r.is_cancelled),
    is_checked_in: flag(r.is_checked_in),
    is_ready: flag(r.is_ready),
    is_handoff: flag(r.is_handoff),
    is_confirmed: flag(r.is_confirmed),
    scheduled_date: text(r.scheduled_date),
    scheduled_time: text(r.scheduled_time),
    visit_date: text(r.visit_date),
    visit_time: text(r.visit_time),
  };
  const when = visitDateTime(visit);
  return {
    visit,
    practiceName: text(r.practice_name),
    practicePhone: text(r.practice_phone),
    visitType: text(r.visit_type),
    doctorName: text(r.doctor_name),
    isConfirmed: r.is_confirmed === true,
    date: when?.date ?? null,
    time: when?.time ?? null,
    stage: smsVisitStage(visit),
    start: visitStartInstant(visit),
  };
}

/**
 * Upcoming: still scheduled and not yet started, soonest first. Past: everything else (seen, missed,
 * cancelled, or the time went by), newest first.
 */
export function splitAppointments(appointments: PortalAppointment[], now: Date): { upcoming: PortalAppointment[]; past: PortalAppointment[] } {
  const isUpcoming = (appointment: PortalAppointment) =>
    appointment.stage === 'scheduled' && !!appointment.start && appointment.start.getTime() > now.getTime();
  const time = (appointment: PortalAppointment) => appointment.start?.getTime() ?? 0;
  return {
    upcoming: appointments.filter(isUpcoming).sort((a, b) => time(a) - time(b)),
    past: appointments.filter((appointment) => !isUpcoming(appointment)).sort((a, b) => time(b) - time(a)),
  };
}

export type StatusTone = 'blue' | 'green' | 'amber' | 'red' | 'gray';

/** What the patient reads on an appointment: "Confirmed", "Cancelled", "Missed"... */
export function appointmentStatus(appointment: PortalAppointment, now: Date): { label: string; tone: StatusTone } {
  switch (appointment.stage) {
    case 'cancelled':
      return { label: 'Cancelled', tone: 'gray' };
    case 'no-show':
      return { label: 'Missed', tone: 'amber' };
    case 'completed':
      return { label: 'Seen', tone: 'green' };
    case 'checked-in':
    case 'in-progress':
    case 'handed-off':
      return { label: 'At the practice', tone: 'blue' };
    default:
      if (appointment.start && appointment.start.getTime() <= now.getTime()) return { label: 'Time passed', tone: 'gray' };
      return appointment.isConfirmed ? { label: 'Confirmed', tone: 'green' } : { label: 'Booked', tone: 'blue' };
  }
}

/** "Consultation" from "consultation", "Follow up" from "follow_up". */
export function visitTypeLabel(type: string | null): string {
  if (!type) return 'Appointment';
  const words = type.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ---------------------------------------------------------------------------------------------
// Lab results: only what a doctor released, ever
// ---------------------------------------------------------------------------------------------

export interface PortalLabResult {
  id: string;
  labRequestId: string | null;
  requestDate: string | null;
  labFacility: string | null;
  testName: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  releasedAt: string | null;
  /** low / normal / high against the reference range (getResultStatus, as on the staff screens) */
  status: LabResultStatus;
}

/**
 * Result rows the patient may see: released_to_patient must be exactly true. The database already returns
 * only released results; this is a second check, so a result the doctor has not released is never shown
 * even if a change on the server ever sent one.
 */
export function releasedResultsOnly(rows: unknown[]): PortalLabResult[] {
  const results: PortalLabResult[] = [];
  for (const row of rows) {
    const r = record(row);
    const id = r ? text(r.id) : null;
    if (!r || !id || r.released_to_patient !== true) continue;
    const value = typeof r.test_value === 'number' ? String(r.test_value) : text(r.test_value);
    const testName = text(r.test_name);
    if (!value || !testName) continue;
    const referenceRange = text(r.reference_range);
    results.push({
      id,
      labRequestId: text(r.lab_request_id),
      requestDate: text(r.request_date),
      labFacility: text(r.lab_facility),
      testName,
      value,
      unit: text(r.test_unit),
      referenceRange,
      releasedAt: text(r.released_at),
      status: getResultStatus(value, referenceRange),
    });
  }
  return results;
}

export interface ResultGroup {
  key: string;
  requestDate: string | null;
  labFacility: string | null;
  releasedAt: string | null;
  results: PortalLabResult[];
}

/** Results by lab request, the most recently released first. */
export function groupResults(results: PortalLabResult[]): ResultGroup[] {
  const groups = new Map<string, ResultGroup>();
  for (const result of results) {
    const key = result.labRequestId ?? result.id;
    const group = groups.get(key) ?? { key, requestDate: result.requestDate, labFacility: result.labFacility, releasedAt: null, results: [] };
    group.results.push(result);
    if (result.releasedAt && (!group.releasedAt || result.releasedAt > group.releasedAt)) group.releasedAt = result.releasedAt;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (b.releasedAt ?? b.requestDate ?? '').localeCompare(a.releasedAt ?? a.requestDate ?? ''));
}

// ---------------------------------------------------------------------------------------------
// Prescriptions and invoice lines
// ---------------------------------------------------------------------------------------------

export interface PortalPrescription {
  id: string;
  medicine: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  prescribedDate: string | null;
  status: string | null;
  prescriberName: string | null;
  practiceName: string | null;
}

export function toPrescription(row: unknown): PortalPrescription | null {
  const r = record(row);
  const id = r ? text(r.id) : null;
  const medicine = r ? text(r.medication_name) : null;
  if (!r || !id || !medicine) return null;
  return {
    id,
    medicine,
    dosage: text(r.dosage),
    frequency: text(r.frequency),
    duration: text(r.duration),
    instructions: text(r.instructions),
    prescribedDate: text(r.prescribed_date),
    status: text(r.status),
    prescriberName: text(r.prescriber_name),
    practiceName: text(r.practice_name),
  };
}

export interface PortalInvoiceLine {
  id: string;
  code: string | null;
  description: string;
  toothNumber: string | null;
  quantity: number;
  totalPrice: number;
  patientPortion: number | null;
  medicalAidCovered: number | null;
}

export function toInvoiceLine(row: unknown): PortalInvoiceLine | null {
  const r = record(row);
  const id = r ? text(r.id) : null;
  if (!r || !id) return null;
  return {
    id,
    code: text(r.code),
    description: text(r.description) ?? 'Service',
    toothNumber: text(r.tooth_number),
    quantity: amount(r.quantity) ?? 1,
    totalPrice: amount(r.total_price) ?? 0,
    patientPortion: amount(r.patient_portion),
    medicalAidCovered: amount(r.medical_aid_covered),
  };
}

// ---------------------------------------------------------------------------------------------
// Requests to the practice
// ---------------------------------------------------------------------------------------------

export type PortalRequestStatus = 'pending' | 'done' | 'declined' | 'withdrawn';

export interface PortalRequest {
  id: string;
  patientId: string;
  kind: 'book' | 'reschedule' | 'cancel' | 'profile_change';
  visitId: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  message: string | null;
  status: PortalRequestStatus;
  staffNote: string | null;
  createdAt: string;
}

const REQUEST_KINDS = ['book', 'reschedule', 'cancel', 'profile_change'] as const;
const REQUEST_STATUSES = ['pending', 'done', 'declined', 'withdrawn'] as const;

export function toPortalRequest(row: unknown): PortalRequest | null {
  const r = record(row);
  const id = r ? text(r.id) : null;
  const patientId = r ? text(r.patient_id) : null;
  const createdAt = r ? text(r.created_at) : null;
  const kind = REQUEST_KINDS.find((value) => value === r?.kind);
  const status = REQUEST_STATUSES.find((value) => value === r?.status);
  if (!r || !id || !patientId || !createdAt || !kind || !status) return null;
  return {
    id,
    patientId,
    kind,
    visitId: text(r.visit_id),
    preferredDate: text(r.preferred_date),
    preferredTime: text(r.preferred_time),
    message: text(r.message),
    status,
    staffNote: text(r.staff_note),
    createdAt,
  };
}

export const REQUEST_KIND_LABELS: Record<PortalRequest['kind'], string> = {
  book: 'Booking request',
  reschedule: 'New time requested',
  cancel: 'Cancelled in the app',
  profile_change: 'Change to my details',
};

export const REQUEST_STATUS_LABELS: Record<PortalRequestStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Waiting for the practice', tone: 'amber' },
  done: { label: 'Done', tone: 'green' },
  declined: { label: 'Not possible', tone: 'red' },
  withdrawn: { label: 'Withdrawn', tone: 'gray' },
};

export const PREFERRED_TIME_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  any: 'Any time',
};
