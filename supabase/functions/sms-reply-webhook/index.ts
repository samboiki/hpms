/**
 * sms-reply-webhook: receives SMSPortal "SMS Reply Webhook" calls (a patient replied to a practice SMS).
 *
 * 1. Authenticate: shared secret SMS_REPLY_WEBHOOK_KEY as ?key= or an x-webhook-key header, compared
 *    in constant time. SMSPortal cannot send a Supabase JWT, so the function is deployed with
 *    verify_jwt = false (supabase/config.toml). Anything else gets 401 and nothing is stored.
 * 2. Read the body defensively (../_shared/smsReplyPayload.ts).
 * 3. Match, store once, act and answer (../_shared/smsReplyHandler.ts). The original message comes
 *    from customerId = practice_sms_logs.id (set by centralized-sms-gateway). Automatic answers go
 *    through centralized-sms-gateway, so they are logged and counted like every SMS.
 *
 * This file only does the I/O. Logs never contain message text or phone numbers.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { AUTO_REPLY_MESSAGE_TYPE } from '../_shared/smsMessagePolicy.ts';
import { constantTimeEqual, parseSmsPortalReply, replyIdempotencyKey } from '../_shared/smsReplyPayload.ts';
import {
  errorText,
  handleSmsReply,
  type AutoReplyRequest,
  type AutoReplyResult,
  type PatientPhoneRow,
  type ReplyRepository,
  type SmsLogRow,
} from '../_shared/smsReplyHandler.ts';
import { SMS_VISIT_COLUMNS, type PracticeForReply, type SmsVisit } from '../_shared/smsReplyPlan.ts';

const MIN_KEY_LENGTH = 16;
const MAX_BODY_CHARS = 20_000;
const LOG_COLUMNS =
  'id, practice_id, patient_id, visit_id, appointment_id, recipient_phone, message_type, message_content, metadata, created_at';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const warn = (what: string, error: { message?: string } | null) => {
  if (error) console.warn(`sms-reply-webhook: ${what} failed:`, error.message);
};

/** Send an automatic answer through the centralized gateway (as process-automation-queue does). */
async function sendThroughGateway(request: AutoReplyRequest): Promise<AutoReplyResult> {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/centralized-sms-gateway`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        practiceId: request.practiceId,
        recipientPhone: request.phone,
        messageContent: request.text,
        messageType: AUTO_REPLY_MESSAGE_TYPE,
        patientId: request.patientId ?? undefined,
        visitId: request.visitId ?? undefined,
        metadata: {
          auto_reply: true,
          source: 'sms-reply-webhook',
          sms_reply_id: request.replyId,
          in_reply_to_log_id: request.inReplyToLogId,
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as { success?: boolean; logId?: string; error?: string } | null;
    if (!response.ok || !body?.success) return { ok: false, error: errorText(body?.error ?? `the SMS gateway answered ${response.status}`) };
    return { ok: true, logId: body.logId ?? null };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** ReplyRepository on the database (service role) and the SMS gateway. */
function databaseRepository(db: SupabaseClient): ReplyRepository {
  return {
    async findSmsLog(logId) {
      const { data, error } = await db.from('practice_sms_logs').select(LOG_COLUMNS).eq('id', logId).maybeSingle();
      warn('original message lookup', error);
      return (data as SmsLogRow | null) ?? null;
    },

    async findRecentSmsLogs(phonePattern, sinceIso) {
      const { data, error } = await db
        .from('practice_sms_logs')
        .select(LOG_COLUMNS)
        .ilike('recipient_phone', phonePattern)
        .neq('status', 'failed')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(25);
      warn('message search by number', error);
      return (data ?? []) as SmsLogRow[];
    },

    async findPatientsByPhone(phonePattern, practiceId) {
      let query = db.from('patients').select('id, practice_id, cell_number').ilike('cell_number', phonePattern).limit(50);
      if (practiceId) query = query.eq('practice_id', practiceId);
      const { data, error } = await query;
      warn('patient search by number', error);
      return (data ?? []) as PatientPhoneRow[];
    },

    async findPractice(practiceId) {
      const { data, error } = await db.from('practices').select('id, name, contact_phone').eq('id', practiceId).maybeSingle();
      warn('practice lookup', error);
      if (!data) return null;
      const row = data as { id: string; name: string | null; contact_phone: string | null };
      const practice: PracticeForReply = { id: row.id, name: row.name, contactPhone: row.contact_phone };
      return practice;
    },

    async findVisit(visitId) {
      const { data, error } = await db.from('visits').select(SMS_VISIT_COLUMNS).eq('id', visitId).maybeSingle();
      warn('linked visit lookup', error);
      return (data as SmsVisit | null) ?? null;
    },

    async findUpcomingVisits(patientId, practiceId, fromDate) {
      const { data, error } = await db
        .from('visits')
        .select(SMS_VISIT_COLUMNS)
        .eq('patient_id', patientId)
        .eq('practice_id', practiceId)
        .or(`scheduled_date.gte.${fromDate},visit_date.gte.${fromDate}`)
        .not('is_cancelled', 'is', true)
        .limit(10);
      warn('upcoming visit lookup', error);
      return (data ?? []) as SmsVisit[];
    },

    async insertReply(row) {
      const { data, error } = await db.from('practice_sms_replies').insert(row).select('id').single();
      if (error?.code === '23505') return 'duplicate';
      if (error || !data) throw new Error(error?.message ?? 'no row returned');
      return { id: (data as { id: string }).id };
    },

    async recordOutcome(replyId, outcome) {
      const { error } = await db.from('practice_sms_replies').update(outcome).eq('id', replyId);
      if (error) console.error('sms-reply-webhook: could not record the outcome:', error.message);
    },

    async countAutoReplies(e164, sinceIso) {
      const { count, error } = await db
        .from('practice_sms_replies')
        .select('id', { count: 'exact', head: true })
        .eq('source_phone_e164', e164)
        .not('auto_reply_log_id', 'is', null)
        .gte('received_at', sinceIso);
      warn('count of recent automatic answers', error);
      return error ? null : (count ?? 0);
    },

    async updateScheduledVisit(visitId, owner, changes) {
      // The visit must still be this patient's scheduled appointment when the update runs: someone may
      // have checked the patient in or cancelled it since it was read
      const { data, error } = await db
        .from('visits')
        .update(changes)
        .eq('id', visitId)
        .eq('practice_id', owner.practiceId)
        .eq('patient_id', owner.patientId)
        .not('is_cancelled', 'is', true)
        .not('is_checked_in', 'is', true)
        .not('is_handoff', 'is', true)
        .or('status.is.null,status.not.in.(cancelled,completed,no-show,in-progress,ready)')
        .select('id');
      warn('visit update', error);
      return !error && (data ?? []).length === 1;
    },

    async cancelPendingReminders(visitId) {
      const { error } = await db
        .from('appointment_reminders')
        .update({ status: 'cancelled' })
        .eq('appointment_id', visitId)
        .eq('status', 'pending');
      warn('cancelling pending reminders', error);
    },

    async setSmsOptOut(practiceId, patientIds, optOut, atIso) {
      if (patientIds.length === 0) return 0;
      const { data, error } = await db
        .from('patients')
        .update(optOut ? { sms_opt_out: true, sms_opt_out_at: atIso } : { sms_opt_out: false, sms_opt_out_at: null })
        .eq('practice_id', practiceId)
        .in('id', patientIds)
        .eq('sms_opt_out', !optOut)
        .select('id');
      if (error) throw new Error(error.message);
      return (data ?? []).length;
    },

    sendAutoReply: sendThroughGateway,
  };
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  // 1. Authenticate before reading or storing anything
  const expectedKey = Deno.env.get('SMS_REPLY_WEBHOOK_KEY') ?? '';
  if (expectedKey.length < MIN_KEY_LENGTH) {
    console.error('sms-reply-webhook: SMS_REPLY_WEBHOOK_KEY is not set or shorter than 16 characters; refusing every call');
    return json(401, { ok: false, error: 'Unauthorized' });
  }
  const presentedKey = new URL(req.url).searchParams.get('key') ?? req.headers.get('x-webhook-key') ?? '';
  if (!constantTimeEqual(presentedKey, expectedKey)) return json(401, { ok: false, error: 'Unauthorized' });

  // 2. Read the body defensively
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_CHARS) return json(413, { ok: false, error: 'Body too large' });
  const parsed = parseSmsPortalReply(rawBody);
  if (!parsed.ok) return json(400, { ok: false, error: parsed.error });
  const eventKey = replyIdempotencyKey(parsed.reply);
  if (!eventKey) return json(400, { ok: false, error: 'The body has no incomingId or eventId: check the SMSPortal custom body' });

  let rawPayload: unknown = { unparsed_body: rawBody };
  if (!parsed.repaired) {
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      // keep the text
    }
  }

  // 3. Match, store once, act and answer
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
  try {
    const result = await handleSmsReply({ reply: parsed.reply, eventKey, rawPayload, now: new Date() }, databaseRepository(db));
    if (result.duplicate) {
      console.log(`sms-reply-webhook: repeated delivery of ${eventKey} ignored`);
      return json(200, { ok: true, duplicate: true });
    }
    console.log(`sms-reply-webhook: ${eventKey} intent=${result.intent} action=${result.action} status=${result.status}`);
    return json(200, { ok: true, id: result.replyId, intent: result.intent, status: result.status });
  } catch (error) {
    // Nothing was stored: answer 500 so SMSPortal can deliver it again later
    console.error('sms-reply-webhook: could not store the reply:', errorText(error));
    return json(500, { ok: false, error: 'Could not store the reply' });
  }
});
