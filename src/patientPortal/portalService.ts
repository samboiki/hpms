/**
 * Reads and writes of the patient app.
 * - Reads call the portal_* database functions: they return only the signed-in login's linked patients
 *   and only patient-safe columns (no visit notes or diagnosis, lab results only once released).
 * - Changes go through the patient-portal edge function, which checks the login and the link again.
 * Until proposals/2026-10-07-patient-portal.sql is applied and the function deployed, loads answer
 * 'not_enabled' and the app says it is not switched on yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toPatientInvoice, type PatientInvoice, type PatientInvoiceRecord } from '../components/patients/patientBilling';
import {
  releasedResultsOnly,
  toAppointment,
  toInvoiceLine,
  toLinkedPatient,
  toPortalRequest,
  toPrescription,
  type LinkedPatient,
  type PortalAppointment,
  type PortalInvoiceLine,
  type PortalLabResult,
  type PortalPrescription,
  type PortalRequest,
} from './portalModel';

// The generated database types do not know the portal functions and tables yet
const db = supabase as unknown as SupabaseClient;

export type PortalLoad<T> = { state: 'ready'; data: T } | { state: 'not_enabled' } | { state: 'error'; message: string };

export const LOAD_ERROR = 'Could not load this right now. Check your connection and try again.';
export const SEND_ERROR = 'Could not send this right now. Check your connection and try again.';

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const nonNull = <T,>(value: T | null): value is T => value !== null;

/** The database change or the edge function is not there yet. */
export function isNotEnabledError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code ?? '')) return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('could not find the function') || (message.includes('portal') && message.includes('does not exist'));
}

async function rpcRows(fn: string, args?: Record<string, unknown>): Promise<PortalLoad<unknown[]>> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    if (isNotEnabledError(error)) return { state: 'not_enabled' };
    console.error(`Patient app: ${fn} failed:`, error.message);
    return { state: 'error', message: LOAD_ERROR };
  }
  return { state: 'ready', data: Array.isArray(data) ? data : [] };
}

const mapLoad = <T,>(load: PortalLoad<unknown[]>, map: (rows: unknown[]) => T): PortalLoad<T> =>
  load.state === 'ready' ? { state: 'ready', data: map(load.data) } : load;

export async function loadMyPatients(): Promise<PortalLoad<LinkedPatient[]>> {
  return mapLoad(await rpcRows('portal_my_patients'), (rows) => rows.map(toLinkedPatient).filter(nonNull));
}

export async function loadAppointments(patientId: string): Promise<PortalLoad<PortalAppointment[]>> {
  return mapLoad(await rpcRows('portal_appointments', { p_patient_id: patientId }), (rows) =>
    rows.map((row) => toAppointment(row, patientId)).filter(nonNull)
  );
}

export interface PortalInvoice extends PatientInvoice {
  practiceId: string | null;
  practiceName: string | null;
}

const toPortalInvoice = (row: unknown): PortalInvoice | null => {
  if (!row || typeof row !== 'object' || typeof (row as { id?: unknown }).id !== 'string') return null;
  const r = row as PatientInvoiceRecord & { practice_name?: unknown };
  return { ...toPatientInvoice(r), practiceId: text(r.practice_id), practiceName: text(r.practice_name) };
};

export async function loadInvoices(patientId: string): Promise<PortalLoad<PortalInvoice[]>> {
  return mapLoad(await rpcRows('portal_invoices', { p_patient_id: patientId }), (rows) => rows.map(toPortalInvoice).filter(nonNull));
}

export async function loadInvoiceLines(invoiceId: string): Promise<PortalLoad<PortalInvoiceLine[]>> {
  return mapLoad(await rpcRows('portal_invoice_lines', { p_invoice_id: invoiceId }), (rows) => rows.map(toInvoiceLine).filter(nonNull));
}

export async function loadPrescriptions(patientId: string): Promise<PortalLoad<PortalPrescription[]>> {
  return mapLoad(await rpcRows('portal_prescriptions', { p_patient_id: patientId }), (rows) => rows.map(toPrescription).filter(nonNull));
}

/** Released lab results only (the database filters them; releasedResultsOnly checks again). */
export async function loadResults(patientId: string): Promise<PortalLoad<PortalLabResult[]>> {
  return mapLoad(await rpcRows('portal_lab_results', { p_patient_id: patientId }), releasedResultsOnly);
}

const REQUEST_COLUMNS = 'id, patient_id, kind, visit_id, preferred_date, preferred_time, message, status, staff_note, created_at';

/** The patients' requests to the practice, newest first. */
export async function loadRequests(patientIds: string[]): Promise<PortalLoad<PortalRequest[]>> {
  if (patientIds.length === 0) return { state: 'ready', data: [] };
  const { data, error } = await db
    .from('patient_portal_requests')
    .select(REQUEST_COLUMNS)
    .in('patient_id', patientIds)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return isNotEnabledError(error) ? { state: 'not_enabled' } : { state: 'error', message: LOAD_ERROR };
  return { state: 'ready', data: ((data ?? []) as unknown[]).map(toPortalRequest).filter(nonNull) };
}

// ---------------------------------------------------------------------------------------------
// The patient-portal edge function
// ---------------------------------------------------------------------------------------------

export type PortalCallResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; notEnabled?: boolean; data?: Record<string, unknown> };

/** Calls the edge function; business refusals come back as { ok: false, error } with the patient's message. */
export async function callPortal(action: string, payload: Record<string, unknown> = {}): Promise<PortalCallResult> {
  const { data, error } = await supabase.functions.invoke('patient-portal', { body: { action, ...payload } });
  if (error) {
    // Answers other than 2xx carry their JSON in error.context (the Response)
    const context = (error as { context?: unknown }).context;
    const status = context instanceof Response ? context.status : 0;
    const body = context instanceof Response ? ((await context.json().catch(() => null)) as Record<string, unknown> | null) : null;
    if (status === 404) return { ok: false, error: 'The patient app is not switched on yet.', notEnabled: true };
    return { ok: false, error: text(body?.error) ?? SEND_ERROR };
  }
  const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!body || body.ok !== true) return { ok: false, error: text(body?.error) ?? SEND_ERROR, data: body ?? undefined };
  return { ok: true, data: body };
}

export interface PortalStatus {
  filesOnNumber: number;
  linkedCount: number;
  unlinkedOnNumber: number;
  lock: { until: string; askReception: boolean } | null;
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** How many patient files carry the login's number, how many are linked, and any lock. */
export async function loadPortalStatus(): Promise<PortalLoad<PortalStatus>> {
  const result = await callPortal('status');
  if (!result.ok) return result.notEnabled ? { state: 'not_enabled' } : { state: 'error', message: result.error };
  const lock = result.data.lock && typeof result.data.lock === 'object' ? (result.data.lock as Record<string, unknown>) : null;
  return {
    state: 'ready',
    data: {
      filesOnNumber: count(result.data.filesOnNumber),
      linkedCount: count(result.data.linkedCount),
      unlinkedOnNumber: count(result.data.unlinkedOnNumber),
      lock: lock && typeof lock.until === 'string' ? { until: lock.until, askReception: lock.askReception === true } : null,
    },
  };
}

export type LinkOutcome =
  | 'linked'
  | 'already_linked'
  | 'no_records'
  | 'locked'
  | 'id_number_required'
  | 'mismatch'
  | 'child_is_adult'
  | 'invalid'
  | 'error';

export interface LinkResult {
  outcome: LinkOutcome;
  message?: string;
  attemptsLeft?: number;
  until?: string;
  askReception?: boolean;
  linkedCount?: number;
}

const LINK_OUTCOMES: LinkOutcome[] = ['linked', 'already_linked', 'no_records', 'locked', 'id_number_required', 'mismatch', 'child_is_adult', 'invalid'];

export async function linkRecords(input: { relationship: 'self' | 'child'; dateOfBirth: string; idNumber: string }): Promise<LinkResult> {
  const result = await callPortal('link', input);
  // Refusals ("invalid") also carry the outcome in their body
  const body = result.data;
  const outcome = LINK_OUTCOMES.find((value) => value === body?.outcome);
  if (!outcome) return { outcome: 'error', message: result.ok ? SEND_ERROR : result.error };
  return {
    outcome,
    message: result.ok ? undefined : result.error,
    attemptsLeft: typeof body?.attemptsLeft === 'number' ? body.attemptsLeft : undefined,
    until: typeof body?.until === 'string' ? body.until : undefined,
    askReception: body?.askReception === true,
    linkedCount: typeof body?.linkedCount === 'number' ? body.linkedCount : undefined,
  };
}

export function sendRequest(input: {
  kind: 'book' | 'reschedule' | 'profile_change';
  patientId: string;
  visitId?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  message?: string | null;
}): Promise<PortalCallResult> {
  return callPortal('request', input);
}

export function cancelAppointment(patientId: string, visitId: string): Promise<PortalCallResult> {
  return callPortal('cancel', { patientId, visitId });
}

export function withdrawRequest(requestId: string): Promise<PortalCallResult> {
  return callPortal('withdraw', { requestId });
}
