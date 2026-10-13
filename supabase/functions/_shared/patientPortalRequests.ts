/**
 * What a patient may ask for in the patient app (patient-portal edge function). Pure TypeScript (no Deno
 * APIs): unit tested with Vitest, and used by the app's forms to show the same messages before sending.
 *
 * - Book, reschedule and profile changes are requests: they wait in patient_portal_requests until
 *   reception handles them (Communications > App requests). Nothing in the clinical record changes.
 * - Cancelling is done at once, with the same rules as cancelling by SMS reply (only the patient's own
 *   appointment, still scheduled, in the future), and only up to PORTAL_REQUEST_LIMITS.cancelCutoffHours
 *   before it starts. Closer to the time the patient is asked to phone the practice.
 */
import { checkVisitForSmsAction, clinicDateKey, visitStartInstant, type SmsVisit } from './smsReplyPlan.ts';

export type PortalRequestKind = 'book' | 'reschedule' | 'profile_change';
export const PORTAL_REQUEST_KINDS: readonly PortalRequestKind[] = ['book', 'reschedule', 'profile_change'];

export type PreferredTime = 'morning' | 'afternoon' | 'any';
export const PREFERRED_TIMES: readonly PreferredTime[] = ['morning', 'afternoon', 'any'];

export const PORTAL_REQUEST_LIMITS = {
  /** A booking or new time can be asked for from tomorrow up to this many days ahead */
  maxDaysAhead: 90,
  maxMessageLength: 500,
  minProfileMessageLength: 5,
  /** Requests of one patient waiting for reception at the same time */
  maxPendingPerPatient: 3,
  /** Cancelling or moving an appointment in the app stops this many hours before it starts */
  cancelCutoffHours: 2,
} as const;

/** The note added to a visit the patient cancelled in the app (same layout as the SMS note). */
export const APP_CANCELLATION_NOTE = '[Cancelled by patient in the patient app]';

export function appendAppCancellationNote(notes: string | null | undefined): string {
  const existing = (notes ?? '').trim();
  return existing ? `${existing}\n\n${APP_CANCELLATION_NOTE}` : APP_CANCELLATION_NOTE;
}

export interface PortalRequestInput {
  kind: string;
  patientId: string;
  visitId?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  message?: string | null;
}

export interface NormalizedPortalRequest {
  kind: PortalRequestKind;
  patientId: string;
  visitId: string | null;
  preferredDate: string | null;
  preferredTime: PreferredTime | null;
  message: string | null;
}

export interface PortalRequestContext {
  now: Date;
  /** The patient's requests still waiting for reception */
  pendingForPatient: number;
  /** For a reschedule: the visit (null when not found) and requests already waiting for it */
  visit?: SmsVisit | null;
  /** The practice of the patient record the request is for */
  patientPracticeId?: string | null;
  pendingForVisit?: number;
}

export type PortalRequestCheck =
  | { ok: true; request: NormalizedPortalRequest }
  | { ok: false; field: 'kind' | 'visit' | 'preferredDate' | 'preferredTime' | 'message' | 'limit'; message: string };

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const addDays = (dateKey: string, days: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const isRealDateKey = (value: string): boolean => {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
};

/** The first and last day a patient may ask for (tomorrow .. maxDaysAhead), as yyyy-mm-dd at the clinic. */
export function requestableDateRange(now: Date): { first: string; last: string } {
  const today = clinicDateKey(now);
  return { first: addDays(today, 1), last: addDays(today, PORTAL_REQUEST_LIMITS.maxDaysAhead) };
}

function checkPreferredDate(raw: string | null | undefined, now: Date): { ok: true; date: string } | { ok: false; message: string } {
  const value = (raw ?? '').trim();
  if (!value) return { ok: false, message: 'Choose the day you would like.' };
  if (!isRealDateKey(value)) return { ok: false, message: 'Choose a real date.' };
  const { first, last } = requestableDateRange(now);
  if (value < first) return { ok: false, message: 'Choose a day from tomorrow. For today, please phone the practice.' };
  if (value > last) {
    return { ok: false, message: `Choose a day within the next ${PORTAL_REQUEST_LIMITS.maxDaysAhead} days.` };
  }
  return { ok: true, date: value };
}

const cleanMessage = (raw: string | null | undefined): string | null => {
  const value = (raw ?? '').replace(/\r\n/g, '\n').trim();
  return value ? value : null;
};

export type VisitChangeCheck = { ok: true } | { ok: false; code: string; message: string };

/**
 * May the patient cancel (or ask to move) this appointment in the app? The visit must be this patient's,
 * at the patient's practice, still scheduled, and start more than cancelCutoffHours from now.
 */
export function checkVisitChange(
  visit: SmsVisit | null | undefined,
  owner: { patientId: string; practiceId: string | null },
  now: Date
): VisitChangeCheck {
  const check = checkVisitForSmsAction(visit ?? null, owner, now);
  if (!check.ok) {
    if (check.code === 'missing' || check.code === 'other_patient') {
      return { ok: false, code: check.code, message: 'This appointment was not found.' };
    }
    if (check.code === 'cancelled') return { ok: false, code: check.code, message: 'This appointment is already cancelled.' };
    return { ok: false, code: check.code, message: 'This appointment can no longer be changed in the app.' };
  }
  const start = visit ? visitStartInstant(visit) : null;
  const cutoffMs = PORTAL_REQUEST_LIMITS.cancelCutoffHours * 3_600_000;
  if (!start || start.getTime() - now.getTime() < cutoffMs) {
    return {
      ok: false,
      code: 'too_late',
      message: `This appointment starts in less than ${PORTAL_REQUEST_LIMITS.cancelCutoffHours} hours, so it can no longer be changed in the app. Please phone the practice.`,
    };
  }
  return { ok: true };
}

/** Checks a booking, reschedule or profile-change request before it is stored. */
export function validatePortalRequest(input: PortalRequestInput, context: PortalRequestContext): PortalRequestCheck {
  if (!PORTAL_REQUEST_KINDS.includes(input.kind as PortalRequestKind)) {
    return { ok: false, field: 'kind', message: 'This request type is not available.' };
  }
  const kind = input.kind as PortalRequestKind;
  const message = cleanMessage(input.message);
  if (message && message.length > PORTAL_REQUEST_LIMITS.maxMessageLength) {
    return { ok: false, field: 'message', message: `Keep the message under ${PORTAL_REQUEST_LIMITS.maxMessageLength} characters.` };
  }
  if (context.pendingForPatient >= PORTAL_REQUEST_LIMITS.maxPendingPerPatient) {
    return {
      ok: false,
      field: 'limit',
      message: `You already have ${PORTAL_REQUEST_LIMITS.maxPendingPerPatient} requests waiting for the practice. Please wait for an answer first.`,
    };
  }

  if (kind === 'profile_change') {
    if (!message || message.length < PORTAL_REQUEST_LIMITS.minProfileMessageLength) {
      return { ok: false, field: 'message', message: 'Tell the practice what to change, for example your new address.' };
    }
    return { ok: true, request: { kind, patientId: input.patientId, visitId: null, preferredDate: null, preferredTime: null, message } };
  }

  const rawTime = (input.preferredTime ?? 'any').trim() || 'any';
  if (!PREFERRED_TIMES.includes(rawTime as PreferredTime)) {
    return { ok: false, field: 'preferredTime', message: 'Choose morning, afternoon or any time.' };
  }
  const preferredTime = rawTime as PreferredTime;
  const date = checkPreferredDate(input.preferredDate, context.now);
  if (!date.ok) return { ok: false, field: 'preferredDate', message: date.message };

  if (kind === 'reschedule') {
    const visitCheck = checkVisitChange(
      context.visit,
      { patientId: input.patientId, practiceId: context.patientPracticeId ?? null },
      context.now
    );
    if (!visitCheck.ok) return { ok: false, field: 'visit', message: visitCheck.message };
    if ((context.pendingForVisit ?? 0) > 0) {
      return { ok: false, field: 'visit', message: 'You already asked to move this appointment. The practice will contact you.' };
    }
    return {
      ok: true,
      request: { kind, patientId: input.patientId, visitId: context.visit?.id ?? null, preferredDate: date.date, preferredTime, message },
    };
  }

  return { ok: true, request: { kind, patientId: input.patientId, visitId: null, preferredDate: date.date, preferredTime, message } };
}
