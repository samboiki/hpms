/**
 * Recalls (parity O3): a date and a reason per patient ("6-monthly check-up" on 12 Apr 2027), set on the patient file
 * or at a visit. Whether a booking completes a recall is decided in ONE place, the database view
 * public.patient_recall_status (proposals/2026-10-12-patient-recalls.sql: a booking for a day after the recall was set
 * and no earlier than 30 days before its date, not cancelled or missed). This file only checks what staff type, offers
 * quick dates and picks the recalls for the "Recalled but not seen" report. Dates are Windhoek date keys ('yyyy-MM-dd').
 */
import { addMonthsToKey, addDaysToKey, isValidDateKey, toDateKey } from '../billing/dates';

export type RecallStatus = 'open' | 'booked' | 'seen' | 'removed';

export interface PatientRecall {
  id: string;
  patientId: string;
  /** The day the patient should come back */
  dueOn: string;
  reason: string;
  /** The visit it was set from; null when it was set on the file */
  visitId: string | null;
  createdAt: string | null;
  /** open: nothing booked for it yet; booked: a matching booking is coming; seen: the patient came; removed: by staff */
  status: RecallStatus;
  /** The booking that completes it (booked or seen) and its day */
  matchedVisitId: string | null;
  matchedOn: string | null;
}

/** A row of public.patient_recall_status as PostgREST returns it. */
export interface PatientRecallRow {
  id: string;
  patient_id: string | null;
  due_on: string | null;
  reason: string | null;
  visit_id?: string | null;
  created_at?: string | null;
  status: string | null;
  matched_visit_id?: string | null;
  matched_on?: string | null;
}

const STATUSES: readonly RecallStatus[] = ['open', 'booked', 'seen', 'removed'];

/** The row as the screens use it; null when it cannot be read (no patient or date). */
export function toPatientRecall(row: PatientRecallRow): PatientRecall | null {
  const dueOn = toDateKey(row.due_on);
  if (!row.id || !row.patient_id || !dueOn) return null;
  const status = STATUSES.includes(row.status as RecallStatus) ? (row.status as RecallStatus) : 'open';
  return {
    id: row.id,
    patientId: row.patient_id,
    dueOn,
    reason: row.reason?.trim() || 'Recall',
    visitId: row.visit_id ?? null,
    createdAt: row.created_at ?? null,
    status,
    matchedVisitId: row.matched_visit_id ?? null,
    matchedOn: toDateKey(row.matched_on ?? null)
  };
}

/** The database's limits (set_patient_recall): staff see the same message before anything is sent. */
export const RECALL_LIMITS = { reasonMin: 2, reasonMax: 120, yearsAhead: 5 } as const;

/** Spaces tidied as the database stores the reason. */
export const tidyRecallReason = (reason: string): string => reason.replace(/\s+/g, ' ').trim();

/** What is wrong with a recall staff typed, in plain words; null when it can be saved. */
export function recallInputProblem(input: { dueOn: string; reason: string }, todayKey: string): string | null {
  if (!isValidDateKey(input.dueOn)) return 'Choose the recall date.';
  if (input.dueOn < todayKey) return 'The recall date has passed. Choose today or a later day.';
  if (input.dueOn > addMonthsToKey(todayKey, RECALL_LIMITS.yearsAhead * 12)) return 'Choose a recall date within five years.';
  const reason = tidyRecallReason(input.reason);
  if (reason.length < RECALL_LIMITS.reasonMin) return 'Say what the recall is for, e.g. "6-monthly check-up".';
  if (reason.length > RECALL_LIMITS.reasonMax) return `Keep the reason to ${RECALL_LIMITS.reasonMax} characters.`;
  return null;
}

export interface RecallInterval {
  id: string;
  label: string;
  /** The recall date for a recall set on `todayKey` */
  dateFrom: (todayKey: string) => string;
}

/** One-tap dates; any other day can be picked. Every discipline uses these intervals. */
export const RECALL_INTERVALS: readonly RecallInterval[] = [
  { id: '2w', label: 'In 2 weeks', dateFrom: (today) => addDaysToKey(today, 14) },
  { id: '1m', label: 'In 1 month', dateFrom: (today) => addMonthsToKey(today, 1) },
  { id: '3m', label: 'In 3 months', dateFrom: (today) => addMonthsToKey(today, 3) },
  { id: '6m', label: 'In 6 months', dateFrom: (today) => addMonthsToKey(today, 6) },
  { id: '1y', label: 'In 1 year', dateFrom: (today) => addMonthsToKey(today, 12) }
];

/** Reasons offered with one tap (none of them belongs to one discipline); staff can type any other. */
export const RECALL_REASON_SUGGESTIONS: readonly string[] = ['6-monthly check-up', 'Annual check-up', 'Follow-up visit', 'Review results'];

/** Recalls still to do first (soonest date first), then the booked, seen and removed ones, latest first. */
export function sortRecallsForFile(recalls: readonly PatientRecall[]): PatientRecall[] {
  const rank: Record<RecallStatus, number> = { open: 0, booked: 1, seen: 2, removed: 3 };
  return [...recalls].sort((a, b) =>
    rank[a.status] - rank[b.status] ||
    (a.status === 'open' ? a.dueOn.localeCompare(b.dueOn) : b.dueOn.localeCompare(a.dueOn)) ||
    a.id.localeCompare(b.id)
  );
}

/** The recall shown on the patient's file: the earliest one still to do, else the booking that completes the next one. */
export function headlineRecall(recalls: readonly PatientRecall[]): PatientRecall | null {
  const open = recalls.filter((recall) => recall.status === 'open').sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  if (open.length > 0) return open[0];
  const booked = recalls.filter((recall) => recall.status === 'booked').sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return booked[0] ?? null;
}

/**
 * "Recalled but not seen" (parity O5, Eminance's "No shows" report): recalls whose date fell in the period and has
 * passed, with no booking or visit that completes them (a missed or cancelled booking does not). Most overdue first.
 */
export function recalledNotSeen(recalls: readonly PatientRecall[], range: { from: string; to: string }, todayKey: string): PatientRecall[] {
  return recalls
    .filter((recall) => recall.status === 'open' && recall.dueOn >= range.from && recall.dueOn <= range.to && recall.dueOn < todayKey)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.patientId.localeCompare(b.patientId) || a.id.localeCompare(b.id));
}
