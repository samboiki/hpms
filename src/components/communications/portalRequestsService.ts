/**
 * Requests patients send from the patient app (table patient_portal_requests, written by the
 * patient-portal edge function; see proposals/2026-10-07-patient-portal.sql). Reception reads them in
 * Communications > App requests and answers each one: "Done" or "Not possible", with an optional note the
 * patient sees in the app. Answering changes nothing else: staff book, move or edit in the usual screens.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

// The generated database types do not know patient_portal_requests yet
const db = supabase as unknown as SupabaseClient;

export const PORTAL_REQUESTS_TABLE = 'patient_portal_requests';

export type PortalRequestKind = 'book' | 'reschedule' | 'cancel' | 'profile_change';
export type PortalRequestStatus = 'pending' | 'done' | 'declined' | 'withdrawn';
export type PortalRequestFilter = 'pending' | 'handled' | 'all';

export interface StaffPortalRequest {
  id: string;
  patientId: string;
  patientName: string | null;
  kind: PortalRequestKind;
  visitId: string | null;
  /** The appointment the request is about (yyyy-mm-dd and time), when there is one */
  visitDate: string | null;
  visitTime: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  message: string | null;
  status: PortalRequestStatus;
  staffNote: string | null;
  handledAt: string | null;
  handledByName: string | null;
  createdAt: string;
}

export type PortalRequestsLoad =
  | { state: 'ready'; requests: StaffPortalRequest[]; pendingCount: number }
  | { state: 'not_enabled' }
  | { state: 'error'; message: string };

export const STAFF_NOTE_MAX_LENGTH = 500;

const KINDS: readonly PortalRequestKind[] = ['book', 'reschedule', 'cancel', 'profile_change'];
const STATUSES: readonly PortalRequestStatus[] = ['pending', 'done', 'declined', 'withdrawn'];

const COLUMNS =
  'id, patient_id, kind, visit_id, preferred_date, preferred_time, message, status, staff_note, handled_at, created_at, ' +
  'patient:patients(first_name, last_name), visit:visits(scheduled_date, scheduled_time, visit_date, visit_time), handler:users(full_name)';

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const embedded = (value: unknown): Record<string, unknown> | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
};

/** A database row as a StaffPortalRequest, or null when it lacks what the inbox needs. */
export function normalizePortalRequestRow(row: unknown): StaffPortalRequest | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const patientId = text(r.patient_id);
  const createdAt = text(r.created_at);
  const kind = KINDS.find((value) => value === r.kind);
  const status = STATUSES.find((value) => value === r.status);
  if (!id || !patientId || !createdAt || !kind || !status) return null;
  const patient = embedded(r.patient);
  const visit = embedded(r.visit);
  const handler = embedded(r.handler);
  const scheduledDate = visit ? text(visit.scheduled_date) : null;
  return {
    id,
    patientId,
    patientName: patient ? [text(patient.first_name), text(patient.last_name)].filter(Boolean).join(' ') || null : null,
    kind,
    visitId: text(r.visit_id),
    visitDate: scheduledDate ?? (visit ? text(visit.visit_date) : null),
    visitTime: visit ? (scheduledDate ? text(visit.scheduled_time) : text(visit.visit_time)) : null,
    preferredDate: text(r.preferred_date),
    preferredTime: text(r.preferred_time),
    message: text(r.message),
    status,
    staffNote: text(r.staff_note),
    handledAt: text(r.handled_at),
    handledByName: handler ? text(handler.full_name) : null,
    createdAt,
  };
}

/** Requests of a practice, newest first, and how many wait for reception. */
export async function loadPortalRequests(practiceId: string, filter: PortalRequestFilter, limit = 100): Promise<PortalRequestsLoad> {
  let list = db.from(PORTAL_REQUESTS_TABLE).select(COLUMNS).eq('practice_id', practiceId).order('created_at', { ascending: false }).limit(limit);
  if (filter === 'pending') list = list.eq('status', 'pending');
  if (filter === 'handled') list = list.neq('status', 'pending');

  const [rows, waiting] = await Promise.all([
    list,
    db.from(PORTAL_REQUESTS_TABLE).select('id', { count: 'exact', head: true }).eq('practice_id', practiceId).eq('status', 'pending'),
  ]);
  if (rows.error) {
    // The table does not exist yet: the patient app has not been switched on for this database
    const missing = rows.error.code === '42P01' || rows.error.code === 'PGRST205' || (rows.error.message ?? '').includes(PORTAL_REQUESTS_TABLE);
    return missing ? { state: 'not_enabled' } : { state: 'error', message: rows.error.message };
  }
  const requests = ((rows.data ?? []) as unknown[]).map(normalizePortalRequestRow).filter((request): request is StaffPortalRequest => request !== null);
  return { state: 'ready', requests, pendingCount: waiting.count ?? requests.filter((request) => request.status === 'pending').length };
}

/** How many requests wait for reception (for the tab badge); null when unknown or not switched on. */
export async function countPendingPortalRequests(practiceId: string): Promise<number | null> {
  const { count, error } = await db
    .from(PORTAL_REQUESTS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('practice_id', practiceId)
    .eq('status', 'pending');
  return error ? null : (count ?? 0);
}

export type PortalRequestAnswer = { ok: true } | { ok: false; message: string };

/** Marks a waiting request done or not possible, with an optional note the patient reads in the app. */
export async function answerPortalRequest(requestId: string, status: 'done' | 'declined', staffNote: string): Promise<PortalRequestAnswer> {
  const note = staffNote.trim();
  if (note.length > STAFF_NOTE_MAX_LENGTH) return { ok: false, message: `Keep the note under ${STAFF_NOTE_MAX_LENGTH} characters.` };
  if (status === 'declined' && !note) return { ok: false, message: 'Tell the patient why it is not possible (they see this note in the app).' };
  const { data: auth } = await supabase.auth.getSession();
  const { data, error } = await db
    .from(PORTAL_REQUESTS_TABLE)
    .update({ status, staff_note: note || null, handled_by: auth.session?.user?.id ?? null, handled_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id');
  if (error) return { ok: false, message: `Not saved: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, message: 'Not saved: the patient withdrew it, or someone else answered it already.' };
  return { ok: true };
}
