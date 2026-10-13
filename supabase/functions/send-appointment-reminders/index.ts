/**
 * send-appointment-reminders: the appointment reminder schedule. pg_cron calls it every 15 minutes
 * with the service role key (proposals/2026-10-07-diary-2.sql, section 10). Nothing else may call
 * it: it sends SMS for every practice.
 *
 * For each practice that switched reminders on (diary_settings.reminders_enabled) it reads today's
 * and tomorrow's bookings (visits) with their patients, works out which reminders are due now
 * (../_shared/appointmentReminders.ts: day before at the practice's time, optionally N hours before,
 * never at night, never to a patient who replied STOP), then claims, sends and records each one
 * (../_shared/reminderRun.ts): the claim in diary_reminder_log is unique per booking, kind and slot,
 * so no reminder is ever sent twice. Every SMS goes through centralized-sms-gateway with the visit id,
 * so it is logged and counted, the diary shows it on the booking and the patient's reply (1 confirm,
 * 2 cancel, 3 new time) is applied to that booking. A reply is invited only while the practice's replies are
 * collected (practice_features 'sms_replies', switched on by OneHealth support).
 *
 * This file only does the I/O. Logs never contain names, numbers or message text.
 * The old version read the appointments table, which the diary no longer uses, and nothing called it.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { decidePlatformAccess, deniedResponse } from '../_shared/callerAccess.ts';
import {
  REMINDER_PATIENT_COLUMNS,
  REMINDER_PATIENT_COLUMNS_WITHOUT_OPT_OUT,
  REMINDER_VISIT_COLUMNS,
  REMINDER_VISIT_COLUMNS_WITHOUT_VIDEO,
  addDaysToDateKey,
  normalizeReminderSettings,
  planDueReminders,
  reminderBookingFromRow,
  sentReminderFromRow,
  type PlannedReminder,
  type ReminderBooking,
  type SentReminder
} from '../_shared/appointmentReminders.ts';
import {
  REMINDER_MESSAGE_TYPE,
  reminderSmsMetadata,
  sendReminders,
  type ReminderRepository,
  type ReminderSendResult
} from '../_shared/reminderRun.ts';
import { clinicDateKey } from '../_shared/smsReplyPlan.ts';
import { SMS_REPLIES_FEATURE_KEY } from '../_shared/smsMessagePolicy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/** At most this many SMS per run (well inside the function's time limit); the rest go 15 minutes later */
const MAX_SENDS_PER_RUN = 100;
/** Visit ids per request, well inside URL length limits */
const ID_CHUNK = 100;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

interface DbError {
  code?: string;
  message?: string;
}
const isMissingTable = (error: DbError | null) => error?.code === '42P01' || error?.code === 'PGRST205';
const isMissingColumn = (error: DbError | null) => error?.code === '42703' || error?.code === 'PGRST204';
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

/** The practice's bookings on these days, with their patients. */
async function loadBookings(db: SupabaseClient, practiceId: string, dates: string[]): Promise<ReminderBooking[]> {
  const query = (patientColumns: string, visitColumns = REMINDER_VISIT_COLUMNS) =>
    db
      .from('visits')
      .select(`${visitColumns}, patient:patients!visits_patient_id_fkey(${patientColumns})`)
      .eq('practice_id', practiceId)
      .in('scheduled_date', dates)
      .not('is_cancelled', 'is', true)
      .limit(2000);
  let { data, error } = await query(REMINDER_PATIENT_COLUMNS);
  // Before the two-way SMS change there is no sms_opt_out column: nobody has opted out yet
  if (error && isMissingColumn(error)) ({ data, error } = await query(REMINDER_PATIENT_COLUMNS_WITHOUT_OPT_OUT));
  // Before the video bookings change there is no video_link column: no booking has a room link yet
  if (error && isMissingColumn(error)) ({ data, error } = await query(REMINDER_PATIENT_COLUMNS, REMINDER_VISIT_COLUMNS_WITHOUT_VIDEO));
  if (error && isMissingColumn(error)) ({ data, error } = await query(REMINDER_PATIENT_COLUMNS_WITHOUT_OPT_OUT, REMINDER_VISIT_COLUMNS_WITHOUT_VIDEO));
  if (error) throw new Error(`could not read the bookings: ${error.message}`);
  return ((data ?? []) as unknown[]).map(reminderBookingFromRow).filter((booking): booking is ReminderBooking => booking !== null);
}

/** Reminders already claimed for these bookings. */
async function loadSent(db: SupabaseClient, visitIds: string[]): Promise<SentReminder[]> {
  const parts = await Promise.all(
    chunk([...new Set(visitIds)], ID_CHUNK).map(async (ids) => {
      const { data, error } = await db.from('diary_reminder_log').select('visit_id, kind, slot_key, status, error').in('visit_id', ids);
      if (error) throw new Error(`could not read the reminder log: ${error.message}`);
      return ((data ?? []) as unknown[]).map(sentReminderFromRow).filter((row): row is SentReminder => row !== null);
    })
  );
  return parts.flat();
}

/**
 * Whether the practice's SMS replies are collected (support switched practice_features 'sms_replies' on): only then
 * does the reminder invite a reply. When it cannot be read, no reply is invited.
 */
async function loadRepliesLive(db: SupabaseClient, practiceId: string): Promise<boolean> {
  const { data, error } = await db
    .from('practice_features')
    .select('is_enabled')
    .eq('practice_id', practiceId)
    .eq('feature_key', SMS_REPLIES_FEATURE_KEY)
    .maybeSingle();
  if (error) console.warn('send-appointment-reminders: could not read whether SMS replies are collected:', error.message);
  return (data as { is_enabled?: boolean } | null)?.is_enabled === true;
}

/** Names of the practitioners of these bookings (they may work at more than one practice). */
async function loadPractitionerNames(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return names;
  const { data, error } = await db.from('users').select('id, full_name').in('id', unique);
  if (error) console.warn('send-appointment-reminders: could not read practitioner names:', error.message);
  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
    if (row.full_name?.trim()) names.set(row.id, row.full_name.trim());
  }
  return names;
}

async function sendThroughGateway(reminder: PlannedReminder, logId: string): Promise<ReminderSendResult> {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/centralized-sms-gateway`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        practiceId: reminder.booking.practiceId,
        recipientPhone: reminder.phone,
        messageContent: reminder.message,
        messageType: REMINDER_MESSAGE_TYPE,
        patientId: reminder.booking.patientId ?? undefined,
        // The visit, so the diary icon and the patient's reply attach to this booking
        visitId: reminder.booking.visitId,
        metadata: reminderSmsMetadata(reminder, logId, 'schedule')
      })
    });
    const body = (await response.json().catch(() => null)) as { success?: boolean; logId?: string; error?: string } | null;
    if (!response.ok || !body?.success) return { ok: false, error: errorText(body?.error ?? `the SMS gateway answered ${response.status}`) };
    return { ok: true, smsLogId: body.logId ?? null };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** Claims in diary_reminder_log (service role), the gateway for sending. */
function scheduleRepository(db: SupabaseClient): ReminderRepository {
  return {
    async claim(reminder) {
      const { data, error } = await db
        .from('diary_reminder_log')
        .upsert(
          {
            practice_id: reminder.booking.practiceId,
            visit_id: reminder.booking.visitId,
            patient_id: reminder.booking.patientId,
            kind: reminder.kind,
            slot_key: reminder.slotKey,
            status: 'sending',
            source: 'schedule'
          },
          { onConflict: 'visit_id,kind,slot_key', ignoreDuplicates: true }
        )
        .select('id');
      if (error) return { status: 'error', error: error.message };
      const id = (data as Array<{ id: string }> | null)?.[0]?.id;
      return id ? { status: 'claimed', logId: id } : { status: 'duplicate' };
    },
    send: sendThroughGateway,
    async finish(logId, outcome) {
      const { error } = await db
        .from('diary_reminder_log')
        .update({
          status: outcome.sent ? 'sent' : 'failed',
          sms_log_id: outcome.smsLogId,
          error: outcome.error ? outcome.error.slice(0, 300) : null,
          finished_at: new Date().toISOString()
        })
        .eq('id', logId);
      if (error) throw new Error(error.message);
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Only the platform (pg_cron, with the service role key) may run it
  const access = decidePlatformAccess(req.headers.get('Authorization'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!access.allowed) return deniedResponse(access, corsHeaders);

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false }
  });
  const now = new Date();
  const today = clinicDateKey(now);
  const days = [today, addDaysToDateKey(today, 1)];

  const { data: settingsRows, error: settingsError } = await db.from('diary_settings').select('*').eq('reminders_enabled', true);
  if (settingsError) {
    if (isMissingTable(settingsError)) {
      return json(200, { ok: true, practices: 0, note: 'Reminders are not set up yet: apply proposals/2026-10-07-diary-2.sql' });
    }
    console.error('send-appointment-reminders: could not read the reminder settings:', settingsError.message);
    return json(500, { ok: false, error: 'Could not read the reminder settings' });
  }

  let budget = MAX_SENDS_PER_RUN;
  const results: Array<Record<string, unknown>> = [];
  for (const row of (settingsRows ?? []) as Array<Record<string, unknown>>) {
    const practiceId = typeof row.practice_id === 'string' ? row.practice_id : null;
    if (!practiceId) continue;
    try {
      const settings = normalizeReminderSettings(row);
      const [bookings, practice, repliesLive] = await Promise.all([
        loadBookings(db, practiceId, days),
        db.from('practices').select('name, contact_phone').eq('id', practiceId).maybeSingle(),
        loadRepliesLive(db, practiceId)
      ]);
      const [sent, names] = await Promise.all([
        loadSent(db, bookings.map((booking) => booking.visitId)),
        loadPractitionerNames(db, bookings.flatMap((booking) => (booking.practitionerId ? [booking.practitionerId] : [])))
      ]);
      const practiceRow = (practice.data ?? null) as { name: string | null; contact_phone: string | null } | null;
      const plan = planDueReminders({
        now,
        settings,
        bookings,
        sent,
        template: settings.template,
        practiceName: practiceRow?.name ?? null,
        practicePhone: practiceRow?.contact_phone ?? null,
        practitionerName: (id) => (id ? names.get(id) ?? null : null),
        repliesLive
      });

      const toSend = plan.due.slice(0, Math.max(0, budget));
      budget -= toSend.length;
      const summary = await sendReminders(scheduleRepository(db), toSend, { concurrency: 4 });

      // The settings screen shows when the schedule last checked the practice
      const { error: stampError } = await db.from('diary_settings').update({ reminders_last_run_at: now.toISOString() }).eq('practice_id', practiceId);
      if (stampError) console.warn('send-appointment-reminders: could not record the run time:', stampError.message);

      const line = { practiceId, due: plan.due.length, sent: summary.sent, failed: summary.failed, duplicate: summary.duplicate, deferred: plan.due.length - toSend.length };
      console.log('send-appointment-reminders:', JSON.stringify(line));
      results.push(line);
    } catch (error) {
      console.error(`send-appointment-reminders: practice ${practiceId} not processed:`, errorText(error));
      results.push({ practiceId, error: errorText(error) });
    }
  }

  return json(200, { ok: true, practices: results.length, results });
});
