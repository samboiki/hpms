/**
 * auth-sms-hook: Supabase Auth "Send SMS" hook. Sends patient app sign-in codes through the practice SMS
 * gateway instead of a separate SMS provider.
 *
 * 1. Authenticate: Supabase Auth signs every call with the hook secret (Standard Webhooks, checked in
 *    ../_shared/standardWebhook.ts against SEND_SMS_HOOK_SECRET). Auth cannot send a user JWT, so the
 *    function is deployed with verify_jwt = false (supabase/config.toml). Anything else gets 401.
 * 2. Decide (../_shared/authOtpPolicy.ts): caps per number (every request counts) and for all numbers per
 *    hour; then a code only for a number that is on at least one patient file.
 * 3. Send through centralized-sms-gateway with the service role key, message type auth_otp: the gateway
 *    stores the text with the code hidden and charges the practice that saw the patient most recently.
 * 4. Answer Auth: {} when a code was sent AND when none was (number not on a file, gateway failure), so
 *    the sign-in screen cannot reveal who is a patient. A cap answers with an error message the person
 *    sees ("Too many sign-in codes ...").
 *
 * Every request is recorded in patient_portal_otp_sends (no code). Logs never contain the code or a full
 * phone number.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  decideOtpSend,
  hookPhoneToE164,
  isOtpCode,
  latestVisitDates,
  maskPhone,
  otpCapRefusal,
  otpLimitsFromEnv,
  otpSmsText,
  recordsForNumber,
  type OtpPatientRecord,
  type OtpSendCounts,
} from '../_shared/authOtpPolicy.ts';
import { AUTH_OTP_MESSAGE_TYPE } from '../_shared/smsMessagePolicy.ts';
import { storedPhoneSearchPattern } from '../_shared/smsPhone.ts';
import { clinicDateKey } from '../_shared/smsReplyPlan.ts';
import { verifyWebhook, webhookHeaders } from '../_shared/standardWebhook.ts';

const MAX_BODY_CHARS = 20_000;
const SENDS_TABLE = 'patient_portal_otp_sends';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Supabase Auth passes error.message on to the person signing in when the hook answers 200 with it
const hookError = (httpCode: number, message: string) => json(200, { error: { http_code: httpCode, message } });

const UNAVAILABLE = 'Sign-in by SMS is not available right now. Please try again later or contact your practice.';

type SendOutcome = 'sent' | 'failed' | 'no_patient' | 'invalid_number' | 'rate_limited';

async function countRequests(db: SupabaseClient, phoneE164: string, now: Date): Promise<OtpSendCounts> {
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const [hour, day, sent] = await Promise.all([
    db.from(SENDS_TABLE).select('id', { count: 'exact', head: true }).eq('phone_e164', phoneE164).gte('created_at', hourAgo),
    db.from(SENDS_TABLE).select('id', { count: 'exact', head: true }).eq('phone_e164', phoneE164).gte('created_at', dayAgo),
    db.from(SENDS_TABLE).select('id', { count: 'exact', head: true }).eq('outcome', 'sent').gte('created_at', hourAgo),
  ]);
  const failed = hour.error ?? day.error ?? sent.error;
  if (failed) throw new Error(`could not count earlier requests: ${failed.message}`);
  return { numberLastHour: hour.count ?? 0, numberLastDay: day.count ?? 0, sentAllNumbersLastHour: sent.count ?? 0 };
}

/** Patient files with this number, each with its latest visit day (to choose the paying practice). */
async function patientRecords(db: SupabaseClient, phoneE164: string, now: Date): Promise<OtpPatientRecord[]> {
  const pattern = storedPhoneSearchPattern(phoneE164);
  if (!pattern) return [];
  const { data, error } = await db.from('patients').select('id, practice_id, cell_number, created_at').ilike('cell_number', pattern).limit(50);
  if (error) throw new Error(`patient search failed: ${error.message}`);
  const rows = (data ?? []) as Array<{ id: string; practice_id: string | null; cell_number: string | null; created_at: string | null }>;
  const records = recordsForNumber(
    rows.map((row) => ({ patientId: row.id, practiceId: row.practice_id, cellNumber: row.cell_number, createdAt: row.created_at, lastVisitDate: null })),
    phoneE164
  );
  if (records.length < 2) return records;

  const today = clinicDateKey(now);
  const { data: visits, error: visitError } = await db
    .from('visits')
    .select('patient_id, visit_date')
    .in('patient_id', records.map((record) => record.patientId))
    .lte('visit_date', today)
    .order('visit_date', { ascending: false })
    .limit(500);
  if (visitError) console.warn('auth-sms-hook: visit lookup failed, charging the newest file:', visitError.message);
  const latest = latestVisitDates((visits ?? []) as Array<{ patient_id: string | null; visit_date: string | null }>, today);
  return records.map((record) => ({ ...record, lastVisitDate: latest.get(record.patientId) ?? null }));
}

async function recordRequest(
  db: SupabaseClient,
  row: { phone_e164: string | null; outcome: SendOutcome; practice_id?: string; patient_id?: string; sms_log_id?: string | null }
): Promise<void> {
  const { error } = await db.from(SENDS_TABLE).insert(row);
  if (error) console.error('auth-sms-hook: could not record the request (caps are weaker until fixed):', error.message);
}

/** Through the centralized gateway, as the platform's own functions do (service role key). */
async function sendThroughGateway(request: { practiceId: string; patientId: string; phoneE164: string; text: string }): Promise<{ ok: boolean; logId: string | null; error?: string }> {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/centralized-sms-gateway`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        practiceId: request.practiceId,
        recipientPhone: request.phoneE164,
        messageContent: request.text,
        messageType: AUTH_OTP_MESSAGE_TYPE,
        patientId: request.patientId,
        metadata: { source: 'auth-sms-hook' },
      }),
    });
    const body = (await response.json().catch(() => null)) as { success?: boolean; logId?: string; error?: string } | null;
    if (!response.ok || !body?.success) {
      return { ok: false, logId: body?.logId ?? null, error: body?.error ?? `the SMS gateway answered ${response.status}` };
    }
    return { ok: true, logId: body.logId ?? null };
  } catch (error) {
    return { ok: false, logId: null, error: error instanceof Error ? error.message : String(error) };
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // 1. Authenticate before reading anything else
  const body = await req.text();
  if (body.length > MAX_BODY_CHARS) return json(413, { error: 'Body too large' });
  const check = await verifyWebhook({
    body,
    headers: webhookHeaders((name) => req.headers.get(name)),
    secret: Deno.env.get('SEND_SMS_HOOK_SECRET'),
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!check.ok) {
    console.error(`auth-sms-hook: refused a call (${check.reason})`);
    return json(401, { error: 'Unauthorized' });
  }

  let payload: { user?: { phone?: string | null }; sms?: { otp?: unknown } } | null = null;
  try {
    payload = JSON.parse(body);
  } catch {
    return hookError(400, UNAVAILABLE);
  }
  const code = payload?.sms?.otp;
  if (!isOtpCode(code)) {
    console.error('auth-sms-hook: the hook payload has no usable code');
    return hookError(500, UNAVAILABLE);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
  const now = new Date();
  const rawPhone = payload?.user?.phone ?? null;
  const phoneE164 = hookPhoneToE164(rawPhone);

  try {
    if (!phoneE164) {
      await recordRequest(db, { phone_e164: null, outcome: 'invalid_number' });
      return json(200, {});
    }

    // 2. Caps first (they do not depend on whether the number is a patient's), then the patient files
    const counts = await countRequests(db, phoneE164, now);
    const limits = otpLimitsFromEnv((name) => Deno.env.get(name));
    const refusal = otpCapRefusal(phoneE164, counts, limits);
    if (refusal) {
      await recordRequest(db, { phone_e164: phoneE164, outcome: 'rate_limited' });
      console.log(`auth-sms-hook: ${maskPhone(phoneE164)} rate limited`);
      return hookError(refusal.httpStatus, refusal.message);
    }

    const decision = decideOtpSend({ rawPhone, records: await patientRecords(db, phoneE164, now), counts, limits });
    if (decision.action === 'refuse') return hookError(decision.httpStatus, decision.message);
    if (decision.action === 'skip') {
      await recordRequest(db, { phone_e164: phoneE164, outcome: decision.outcome });
      console.log(`auth-sms-hook: ${maskPhone(phoneE164)} ${decision.outcome}: no SMS`);
      return json(200, {});
    }

    // 3. Send
    const expiryMinutes = Number(Deno.env.get('OTP_EXPIRY_MINUTES') ?? '');
    const text = otpSmsText(code, {
      expiryMinutes: Number.isInteger(expiryMinutes) && expiryMinutes > 0 ? expiryMinutes : undefined,
      webOtpDomain: Deno.env.get('PORTAL_WEB_OTP_DOMAIN') ?? null,
    });
    const sent = await sendThroughGateway({ practiceId: decision.practiceId, patientId: decision.patientId, phoneE164, text });
    await recordRequest(db, {
      phone_e164: phoneE164,
      outcome: sent.ok ? 'sent' : 'failed',
      practice_id: decision.practiceId,
      patient_id: decision.patientId,
      sms_log_id: sent.logId,
    });
    if (!sent.ok) console.error(`auth-sms-hook: ${maskPhone(phoneE164)} SMS failed:`, sent.error);
    else console.log(`auth-sms-hook: ${maskPhone(phoneE164)} code sent`);

    // 4. The same answer either way (see the header)
    return json(200, {});
  } catch (error) {
    console.error('auth-sms-hook:', error instanceof Error ? error.message : String(error));
    return hookError(503, UNAVAILABLE);
  }
});
