/**
 * Reminder and confirmation status of the bookings on screen, read from the SMS gateway's log
 * (practice_sms_logs) and patients' replies (practice_sms_replies, proposals/2026-10-07-two-way-sms.sql).
 * Read only. The rules are in src/utils/diary/reminderStatus.ts. A status is a convenience: when it
 * cannot be loaded the booking simply shows no icon, and the diary keeps working.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingColumnError, isMissingTableError } from '../utils/diary/dbErrors';
import {
  DIARY_REPLY_INTENTS,
  normalizeAppointmentSmsLog,
  normalizeAppointmentSmsReply,
  reminderStatusesByVisit,
  type AppointmentSmsLog,
  type AppointmentSmsReply,
  type ReminderStatus
} from '../utils/diary/reminderStatus';

// Neither table is in the generated database types, so rows are read untyped and checked at runtime
const db = supabase as unknown as SupabaseClient;

const SMS_LOGS_TABLE = 'practice_sms_logs';
/** Same table as SMS_REPLIES_TABLE in components/communications/smsRepliesService.ts */
const SMS_REPLIES_TABLE = 'practice_sms_replies';

// The gateway writes sent_at, failed_at and failure_reason; older databases may lack one of them
const LOG_COLUMNS = 'id, visit_id, appointment_id, message_type, status, created_at, sent_at, failed_at, failure_reason, metadata';
const LOG_COLUMNS_MINIMAL = 'id, visit_id, appointment_id, message_type, status, created_at, metadata';

/** Visit ids per request, so the filter stays well inside URL length limits */
const ID_CHUNK = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Remembered for this page load: which log columns exist, and whether two-way SMS is switched on
let logColumns = LOG_COLUMNS;
let repliesTableMissing = false;

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

async function loadLogs(visitIds: string[]): Promise<AppointmentSmsLog[]> {
  const list = visitIds.join(',');
  const query = (columns: string) =>
    db
      .from(SMS_LOGS_TABLE)
      .select(columns)
      .or(`visit_id.in.(${list}),appointment_id.in.(${list})`)
      .ilike('message_type', 'appointment%')
      .order('created_at', { ascending: false })
      .limit(500);

  let { data, error } = await query(logColumns);
  if (error && logColumns !== LOG_COLUMNS_MINIMAL && isMissingColumnError(error)) {
    logColumns = LOG_COLUMNS_MINIMAL;
    ({ data, error } = await query(logColumns));
  }
  if (error) {
    console.error('Could not load SMS reminders for the diary:', error);
    return [];
  }
  return ((data ?? []) as unknown[])
    .map(normalizeAppointmentSmsLog)
    .filter((log): log is AppointmentSmsLog => log !== null);
}

async function loadReplies(visitIds: string[]): Promise<AppointmentSmsReply[]> {
  if (repliesTableMissing) return [];
  const { data, error } = await db
    .from(SMS_REPLIES_TABLE)
    .select('visit_id, intent, received_at')
    .in('visit_id', visitIds)
    .in('intent', [...DIARY_REPLY_INTENTS])
    .order('received_at', { ascending: false })
    .limit(500);
  if (error) {
    // Two-way SMS not switched on yet: there are no replies to show
    if (isMissingTableError(error, SMS_REPLIES_TABLE)) repliesTableMissing = true;
    else console.error('Could not load SMS replies for the diary:', error);
    return [];
  }
  return ((data ?? []) as unknown[])
    .map(normalizeAppointmentSmsReply)
    .filter((reply): reply is AppointmentSmsReply => reply !== null);
}

/** Status per visit id; visits without any appointment SMS or reply are left out. */
export async function loadReminderStatuses(visitIds: string[]): Promise<Map<string, ReminderStatus>> {
  const ids = [...new Set(visitIds)].filter((id) => UUID.test(id));
  if (ids.length === 0) return new Map();
  const groups = chunk(ids, ID_CHUNK);
  const [logs, replies] = await Promise.all([
    Promise.all(groups.map(loadLogs)).then((parts) => parts.flat()),
    Promise.all(groups.map(loadReplies)).then((parts) => parts.flat())
  ]);
  return reminderStatusesByVisit(ids, logs, replies);
}
