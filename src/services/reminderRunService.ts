/**
 * "Remind patients" from the diary: reception sends the SMS reminders for one day's bookings now,
 * with a preview and a count first. The rules (who gets one, the message, never twice) are the same
 * ones the automatic schedule uses: supabase/functions/_shared/appointmentReminders.ts and
 * reminderRun.ts. Each reminder is claimed in diary_reminder_log (claim_diary_reminder) before it is
 * sent through centralized-sms-gateway with the visit id, then its outcome is recorded.
 *
 * Without proposals/2026-10-07-diary-2.sql there is no reminder log, so nothing could stop a second
 * reminder: the preview then says "not set up yet" and nothing is sent.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { communicationService } from './communicationService';
import { loadDiarySettings } from './diarySettingsService';
import { loadSmsRepliesLive } from '../components/communications/smsRepliesService';
import {
  REMINDER_PATIENT_COLUMNS,
  REMINDER_PATIENT_COLUMNS_WITHOUT_OPT_OUT,
  REMINDER_VISIT_COLUMNS,
  REMINDER_VISIT_COLUMNS_WITHOUT_VIDEO,
  planManualReminders,
  reminderBookingFromRow,
  sentReminderFromRow,
  type PlannedReminder,
  type ReminderBooking,
  type ReminderPlan,
  type ReminderSettings,
  type SentReminder
} from '../../supabase/functions/_shared/appointmentReminders.ts';
import {
  REMINDER_MESSAGE_TYPE,
  reminderSmsMetadata,
  sendReminders,
  type ReminderRepository,
  type ReminderRunSummary
} from '../../supabase/functions/_shared/reminderRun.ts';
import { isMissingColumnError, isMissingFunctionError, isMissingTableError } from '../utils/diary/dbErrors';

// The reminder tables are not in the generated database types yet
const db = supabase as unknown as SupabaseClient;

const REMINDER_LOG_TABLE = 'diary_reminder_log';
const ID_CHUNK = 40;

export const REMINDERS_NOT_ENABLED_MESSAGE =
  'Reminders are not switched on yet. Your administrator needs to apply the diary update first, so that no patient is reminded twice.';

export interface ReminderPreview {
  /** 'yyyy-MM-dd' */
  date: string;
  plan: ReminderPlan;
  settings: ReminderSettings;
  remindersLastRunAt: string | null;
}

export type ReminderPreviewLoad =
  | { state: 'ready'; preview: ReminderPreview }
  | { state: 'not_enabled' }
  | { state: 'error'; message: string };

export interface ReminderPreviewRequest {
  practiceId: string;
  /** The day whose patients are reminded ('yyyy-MM-dd') */
  date: string;
  /** Only this practitioner's patients; null = everyone's */
  practitionerId?: string | null;
  practitionerName: (id: string | null) => string | null | undefined;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

async function loadDayBookings(practiceId: string, date: string, practitionerId: string | null): Promise<ReminderBooking[]> {
  const query = (patientColumns: string, visitColumns = REMINDER_VISIT_COLUMNS) => {
    let request = db
      .from('visits')
      .select(`${visitColumns}, patient:patients!visits_patient_id_fkey(${patientColumns})`)
      .eq('practice_id', practiceId)
      .eq('scheduled_date', date)
      .not('is_cancelled', 'is', true)
      .order('scheduled_time', { ascending: true })
      .limit(1000);
    if (practitionerId) request = request.eq('doctor_id', practitionerId);
    return request;
  };
  let { data, error } = await query(REMINDER_PATIENT_COLUMNS);
  // Before the two-way SMS update there is no opt-out column: nobody has opted out yet
  if (error && isMissingColumnError(error)) ({ data, error } = await query(REMINDER_PATIENT_COLUMNS_WITHOUT_OPT_OUT));
  // Before the video bookings update there is no video_link column: no booking has a room link yet
  if (error && isMissingColumnError(error)) ({ data, error } = await query(REMINDER_PATIENT_COLUMNS, REMINDER_VISIT_COLUMNS_WITHOUT_VIDEO));
  if (error && isMissingColumnError(error)) ({ data, error } = await query(REMINDER_PATIENT_COLUMNS_WITHOUT_OPT_OUT, REMINDER_VISIT_COLUMNS_WITHOUT_VIDEO));
  if (error) {
    console.error('Could not load the bookings to remind:', error);
    throw new Error("Could not load the day's bookings. Please try again.");
  }
  return ((data ?? []) as unknown[]).map(reminderBookingFromRow).filter((booking): booking is ReminderBooking => booking !== null);
}

/** Reminders already claimed for these bookings, or 'not_enabled' when the log table is missing. */
async function loadSent(visitIds: string[]): Promise<SentReminder[] | 'not_enabled'> {
  const rows: SentReminder[] = [];
  for (const ids of chunk(visitIds, ID_CHUNK)) {
    const { data, error } = await db.from(REMINDER_LOG_TABLE).select('visit_id, kind, slot_key, status, error').in('visit_id', ids);
    if (error) {
      if (isMissingTableError(error, REMINDER_LOG_TABLE)) return 'not_enabled';
      console.error('Could not load the reminder log:', error);
      throw new Error('Could not check which patients were already reminded. Please try again.');
    }
    for (const row of (data ?? []) as unknown[]) {
      const sent = sentReminderFromRow(row);
      if (sent) rows.push(sent);
    }
  }
  return rows;
}

/** Who gets a reminder for the day, who does not and why, and the message each one gets. */
export async function loadReminderPreview(request: ReminderPreviewRequest): Promise<ReminderPreviewLoad> {
  try {
    const [settingsLoad, practice, bookings, repliesLive] = await Promise.all([
      loadDiarySettings(request.practiceId),
      supabase.from('practices').select('name, contact_phone').eq('id', request.practiceId).maybeSingle(),
      loadDayBookings(request.practiceId, request.date, request.practitionerId ?? null),
      // The reminder asks for a reply only while the practice's replies are collected
      loadSmsRepliesLive(request.practiceId)
    ]);
    if (settingsLoad.state === 'not_enabled') return { state: 'not_enabled' };
    // Even with no bookings, the log must exist before anything could be sent
    const sent = await loadSent(bookings.length > 0 ? bookings.map((booking) => booking.visitId) : []);
    if (sent === 'not_enabled') return { state: 'not_enabled' };
    const settings = settingsLoad.settings;
    const plan = planManualReminders({
      now: new Date(),
      date: request.date,
      bookings,
      sent,
      template: settings.reminders.template,
      practiceName: practice.data?.name ?? null,
      practicePhone: (practice.data as { contact_phone?: string | null } | null)?.contact_phone ?? null,
      practitionerName: (id) => request.practitionerName(id) ?? null,
      repliesLive
    });
    return { state: 'ready', preview: { date: request.date, plan, settings: settings.reminders, remindersLastRunAt: settings.remindersLastRunAt } };
  } catch (error) {
    return { state: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

/** Claims through the database function, sends with the staff member's own sign-in through the gateway. */
const receptionRepository: ReminderRepository = {
  async claim(reminder) {
    const { data, error } = await db.rpc('claim_diary_reminder', {
      p_visit_id: reminder.booking.visitId,
      p_kind: reminder.kind,
      p_slot_key: reminder.slotKey
    });
    if (error) {
      return { status: 'error', error: isMissingFunctionError(error, 'claim_diary_reminder') ? REMINDERS_NOT_ENABLED_MESSAGE : error.message };
    }
    return typeof data === 'string' && data ? { status: 'claimed', logId: data } : { status: 'duplicate' };
  },
  async send(reminder, logId) {
    const response = await communicationService.sendSMS({
      practiceId: reminder.booking.practiceId,
      recipientPhone: reminder.phone,
      messageContent: reminder.message,
      messageType: REMINDER_MESSAGE_TYPE,
      patientId: reminder.booking.patientId ?? undefined,
      // The visit, so the diary icon and the patient's reply attach to this booking
      visitId: reminder.booking.visitId,
      metadata: reminderSmsMetadata(reminder, logId, 'reception')
    });
    if (response.success) return { ok: true, smsLogId: response.logId || null };
    const error = response.error === 'SMS_LIMIT_REACHED' ? "The practice's SMS bundle for this month is used up." : response.error || 'Not sent';
    return { ok: false, error };
  },
  async finish(logId, outcome) {
    const { error } = await db.rpc('finish_diary_reminder', {
      p_log_id: logId,
      p_sent: outcome.sent,
      p_sms_log_id: outcome.smsLogId,
      p_error: outcome.error
    });
    if (error) throw new Error(error.message);
  }
};

/** Sends the previewed reminders (three at a time), never one that was claimed before. */
export function sendRemindersNow(reminders: PlannedReminder[], onProgress?: (done: number, total: number) => void): Promise<ReminderRunSummary> {
  return sendReminders(receptionRepository, reminders, { concurrency: 3, onProgress });
}
