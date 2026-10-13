/**
 * patient-portal: what a signed-in patient may change, from the patient app (src/patientPortal).
 *
 * Patients read their records through the portal_* database functions (proposals/2026-10-07-patient-portal.sql).
 * Everything that writes goes through here, with the service role, after these checks:
 * - the caller is a signed-in patient app login: a valid session, a phone number, and no staff profile;
 * - every patient id must be linked to that login (activeLinkedPatientIds, the database rule as well).
 *
 * Actions (POST JSON { action, ... }):
 *   status    how many patient files carry this number, how many are linked, whether linking is locked
 *   link      { relationship, dateOfBirth, idNumber? }: link files after the check in
 *             ../_shared/patientPortalLink.ts; wrong tries are recorded for the lock (no details stored)
 *   request   { kind: book | reschedule | profile_change, patientId, ... }: a request for reception
 *             (../_shared/patientPortalRequests.ts); nothing in the clinical record changes
 *   cancel    { patientId, visitId }: cancels the patient's own scheduled appointment at once, with the
 *             SMS-reply rules plus the app cut-off, and records it for reception
 *   withdraw  { requestId }: takes back the patient's own request that reception has not handled yet
 *
 * Business refusals answer 200 { ok: false, error } with a message for the patient. Logs never contain
 * dates of birth, ID numbers or full phone numbers.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { hookPhoneToE164, maskPhone } from '../_shared/authOtpPolicy.ts';
import { bearerToken } from '../_shared/smsGatewayAccess.ts';
import { normalizePhoneNumber, storedPhoneSearchPattern } from '../_shared/smsPhone.ts';
import { SMS_VISIT_COLUMNS, type SmsVisit } from '../_shared/smsReplyPlan.ts';
import {
  activeLinkedPatientIds,
  countsAsFailure,
  decideLink,
  LINK_LIMITS,
  linkLock,
  type LinkCandidate,
  type PatientAccountLink,
} from '../_shared/patientPortalLink.ts';
import { appendAppCancellationNote, checkVisitChange, validatePortalRequest } from '../_shared/patientPortalRequests.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const refuse = (error: string, extra: Record<string, unknown> = {}) => json(200, { ok: false, error, ...extra });

const TRY_AGAIN = 'Something went wrong. Please try again in a moment.';
const NOT_LINKED = 'This patient is not linked to your login.';

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** Patient files whose cell number is this login's number (the LIKE search is loose; normalise to confirm). */
async function filesOnNumber(db: SupabaseClient, phoneE164: string): Promise<LinkCandidate[]> {
  const pattern = storedPhoneSearchPattern(phoneE164);
  if (!pattern) return [];
  const { data, error } = await db
    .from('patients')
    .select('id, practice_id, date_of_birth, id_number, cell_number')
    .ilike('cell_number', pattern)
    // A file merged into another one is archived without a practice (proposals/2026-10-09-patient-merge.sql)
    .not('practice_id', 'is', null)
    .limit(100);
  if (error) throw new Error(`patient search failed: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; practice_id: string | null; date_of_birth: string | null; id_number: string | null; cell_number: string | null }>)
    .filter((row) => normalizePhoneNumber(row.cell_number) === phoneE164)
    .map((row) => ({ patientId: row.id, practiceId: row.practice_id, dateOfBirth: row.date_of_birth, idNumber: row.id_number }));
}

async function linkedPatientIds(db: SupabaseClient, userId: string, phoneE164: string): Promise<string[]> {
  const { data, error } = await db.from('patient_accounts').select('patient_id, phone_e164, revoked_at').eq('user_id', userId);
  if (error) throw new Error(`link lookup failed: ${error.message}`);
  return activeLinkedPatientIds((data ?? []) as PatientAccountLink[], phoneE164);
}

async function recentFailures(db: SupabaseClient, userId: string, now: Date): Promise<string[]> {
  const since = new Date(now.getTime() - LINK_LIMITS.longWindowDays * 86_400_000).toISOString();
  const { data, error } = await db
    .from('patient_portal_link_attempts')
    .select('created_at')
    .eq('user_id', userId)
    .eq('counts_as_failure', true)
    .gte('created_at', since);
  if (error) throw new Error(`attempt lookup failed: ${error.message}`);
  return ((data ?? []) as Array<{ created_at: string }>).map((row) => row.created_at);
}

async function patientPractice(db: SupabaseClient, patientId: string): Promise<string | null> {
  const { data, error } = await db.from('patients').select('practice_id').eq('id', patientId).maybeSingle();
  if (error) throw new Error(`patient lookup failed: ${error.message}`);
  return (data as { practice_id: string | null } | null)?.practice_id ?? null;
}

async function pendingCount(db: SupabaseClient, filter: { patientId?: string; visitId?: string }): Promise<number> {
  let query = db.from('patient_portal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (filter.patientId) query = query.eq('patient_id', filter.patientId);
  if (filter.visitId) query = query.eq('visit_id', filter.visitId);
  const { count, error } = await query;
  if (error) throw new Error(`request count failed: ${error.message}`);
  return count ?? 0;
}

async function findVisit(db: SupabaseClient, visitId: string | null): Promise<SmsVisit | null> {
  if (!visitId) return null;
  const { data, error } = await db.from('visits').select(SMS_VISIT_COLUMNS).eq('id', visitId).maybeSingle();
  if (error) throw new Error(`visit lookup failed: ${error.message}`);
  return (data as SmsVisit | null) ?? null;
}

async function handleStatus(db: SupabaseClient, userId: string, phoneE164: string, now: Date): Promise<Response> {
  const [files, linked, failures] = await Promise.all([
    filesOnNumber(db, phoneE164),
    linkedPatientIds(db, userId, phoneE164),
    recentFailures(db, userId, now),
  ]);
  const linkedSet = new Set(linked);
  return json(200, {
    ok: true,
    filesOnNumber: files.length,
    linkedCount: linked.length,
    unlinkedOnNumber: files.filter((file) => !linkedSet.has(file.patientId)).length,
    lock: linkLock(failures, now),
  });
}

async function handleLink(db: SupabaseClient, userId: string, phoneE164: string, body: Record<string, unknown>, now: Date): Promise<Response> {
  const [candidates, linked, failures] = await Promise.all([
    filesOnNumber(db, phoneE164),
    linkedPatientIds(db, userId, phoneE164),
    recentFailures(db, userId, now),
  ]);
  const decision = decideLink({
    candidates,
    request: { relationship: String(body.relationship ?? ''), dateOfBirth: String(body.dateOfBirth ?? ''), idNumber: text(body.idNumber) },
    linkedPatientIds: linked,
    failureTimes: failures,
    now,
  });

  if (decision.outcome !== 'invalid' && decision.outcome !== 'locked') {
    const { error } = await db.from('patient_portal_link_attempts').insert({
      user_id: userId,
      phone_e164: phoneE164,
      outcome: decision.outcome,
      counts_as_failure: countsAsFailure(decision),
    });
    // Without the record the lock could be bypassed: stop rather than link
    if (error) throw new Error(`could not record the try: ${error.message}`);
  }

  if (decision.outcome === 'linked') {
    const practiceOf = new Map(candidates.map((candidate) => [candidate.patientId, candidate.practiceId]));
    const rows = decision.patientIds.map((patientId) => ({
      user_id: userId,
      patient_id: patientId,
      practice_id: practiceOf.get(patientId) ?? null,
      relationship: decision.relationship,
      verified_by: decision.verifiedBy[patientId],
      phone_e164: phoneE164,
      verified_at: now.toISOString(),
      revoked_at: null,
      revoke_reason: null,
    }));
    const { error } = await db.from('patient_accounts').upsert(rows, { onConflict: 'user_id,patient_id' });
    if (error) throw new Error(`could not save the link: ${error.message}`);
    console.log(`patient-portal: ${maskPhone(phoneE164)} linked ${rows.length} file(s) as ${decision.relationship}`);
    return json(200, { ok: true, outcome: 'linked', linkedCount: rows.length, relationship: decision.relationship });
  }

  console.log(`patient-portal: ${maskPhone(phoneE164)} link outcome ${decision.outcome}`);
  if (decision.outcome === 'invalid') return refuse(decision.message, { outcome: 'invalid' });
  const { outcome, ...rest } = decision;
  return json(200, { ok: true, outcome, ...rest });
}

async function handleRequest(db: SupabaseClient, userId: string, linked: string[], body: Record<string, unknown>, now: Date): Promise<Response> {
  const patientId = text(body.patientId);
  if (!patientId || !linked.includes(patientId)) return refuse(NOT_LINKED);
  const kind = String(body.kind ?? '');
  const visitId = text(body.visitId);
  const practiceId = await patientPractice(db, patientId);
  if (!practiceId) return refuse('Your file is not linked to a practice yet. Please contact the practice.');

  const [pendingForPatient, visit, pendingForVisit] = await Promise.all([
    pendingCount(db, { patientId }),
    kind === 'reschedule' ? findVisit(db, visitId) : Promise.resolve(null),
    kind === 'reschedule' && visitId ? pendingCount(db, { visitId }) : Promise.resolve(0),
  ]);
  const check = validatePortalRequest(
    { kind, patientId, visitId, preferredDate: text(body.preferredDate), preferredTime: text(body.preferredTime), message: typeof body.message === 'string' ? body.message : null },
    { now, pendingForPatient, visit, patientPracticeId: practiceId, pendingForVisit }
  );
  if (!check.ok) return refuse(check.message, { field: check.field });

  const { request } = check;
  const { data, error } = await db
    .from('patient_portal_requests')
    .insert({
      practice_id: practiceId,
      patient_id: patientId,
      requested_by: userId,
      kind: request.kind,
      visit_id: request.visitId,
      preferred_date: request.preferredDate,
      preferred_time: request.preferredTime,
      message: request.message,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`could not save the request: ${error?.message ?? 'no row'}`);
  return json(200, { ok: true, requestId: (data as { id: string }).id });
}

async function handleCancel(db: SupabaseClient, userId: string, linked: string[], body: Record<string, unknown>, now: Date): Promise<Response> {
  const patientId = text(body.patientId);
  const visitId = text(body.visitId);
  if (!patientId || !linked.includes(patientId)) return refuse(NOT_LINKED);
  const practiceId = await patientPractice(db, patientId);
  const visit = await findVisit(db, visitId);
  const check = checkVisitChange(visit, { patientId, practiceId }, now);
  if (!check.ok || !visit || !practiceId) return refuse(check.ok ? 'This appointment was not found.' : check.message, { code: check.ok ? 'missing' : check.code });

  // The same guards as a cancellation by SMS reply: still this patient's scheduled appointment when saved
  const { data, error } = await db
    .from('visits')
    .update({ is_cancelled: true, status: 'cancelled', notes: appendAppCancellationNote(visit.notes), updated_at: now.toISOString() })
    .eq('id', visit.id)
    .eq('practice_id', practiceId)
    .eq('patient_id', patientId)
    .not('is_cancelled', 'is', true)
    .not('is_checked_in', 'is', true)
    .not('is_handoff', 'is', true)
    .or('status.is.null,status.not.in.(cancelled,completed,no-show,in-progress,ready)')
    .select('id');
  if (error) throw new Error(`could not cancel: ${error.message}`);
  if ((data ?? []).length !== 1) return refuse('This appointment changed in the meantime. Please phone the practice.');

  // As appointmentService.cancelAppointment does: no reminders for a cancelled visit
  const reminders = await db.from('appointment_reminders').update({ status: 'cancelled' }).eq('appointment_id', visit.id).eq('status', 'pending');
  if (reminders.error) console.warn('patient-portal: could not cancel pending reminders:', reminders.error.message);

  // Reception sees the cancellation in App requests (already done, nothing to approve)
  const record = await db.from('patient_portal_requests').insert({
    practice_id: practiceId,
    patient_id: patientId,
    requested_by: userId,
    kind: 'cancel',
    visit_id: visit.id,
    message: text(body.reason)?.slice(0, 500) ?? null,
    status: 'done',
    handled_at: now.toISOString(),
  });
  if (record.error) console.warn('patient-portal: could not record the cancellation for reception:', record.error.message);
  return json(200, { ok: true });
}

async function handleWithdraw(db: SupabaseClient, linked: string[], body: Record<string, unknown>): Promise<Response> {
  const requestId = text(body.requestId);
  if (!requestId || linked.length === 0) return refuse('This request was not found.');
  const { data, error } = await db
    .from('patient_portal_requests')
    .update({ status: 'withdrawn' })
    .eq('id', requestId)
    .eq('status', 'pending')
    .in('patient_id', linked)
    .select('id');
  if (error) throw new Error(`could not withdraw: ${error.message}`);
  if ((data ?? []).length !== 1) return refuse('This request was already handled by the practice.');
  return json(200, { ok: true });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });

  // Who is calling: a patient app login (phone, no staff profile)
  const token = bearerToken(req.headers.get('Authorization'));
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user ?? null;
  if (!user) return json(401, { ok: false, error: 'Please sign in again.' });
  const { data: staff, error: staffError } = await db.from('users').select('id').eq('id', user.id).maybeSingle();
  if (staffError) return json(500, { ok: false, error: TRY_AGAIN });
  if (staff) return json(403, { ok: false, error: 'Staff logins use the practice app, not the patient app.' });
  const phoneE164 = hookPhoneToE164(user.phone);
  if (!phoneE164) return json(403, { ok: false, error: 'Sign in with your cell number to use the patient app.' });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') return json(400, { ok: false, error: 'Unknown action' });
  const now = new Date();

  try {
    switch (body.action) {
      case 'status':
        return await handleStatus(db, user.id, phoneE164, now);
      case 'link':
        return await handleLink(db, user.id, phoneE164, body, now);
      case 'request':
        return await handleRequest(db, user.id, await linkedPatientIds(db, user.id, phoneE164), body, now);
      case 'cancel':
        return await handleCancel(db, user.id, await linkedPatientIds(db, user.id, phoneE164), body, now);
      case 'withdraw':
        return await handleWithdraw(db, await linkedPatientIds(db, user.id, phoneE164), body);
      default:
        return json(400, { ok: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error(`patient-portal: ${String(body.action)} failed:`, error instanceof Error ? error.message : String(error));
    return json(500, { ok: false, error: TRY_AGAIN });
  }
});
