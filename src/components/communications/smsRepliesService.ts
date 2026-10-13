/**
 * Patients' SMS replies for the SMS replies inbox. Rows are written by the sms-reply-webhook edge
 * function (table practice_sms_replies, see proposals/2026-10-07-two-way-sms.sql); staff read them,
 * mark them handled and answer through the centralized SMS gateway (communicationService.sendSMS),
 * so every answer is logged and counted against the practice's SMS bundle.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { format, isToday, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { communicationService, getCommunicationErrorMessage } from '../../services/communicationService';
import { formatPhoneForDisplay, normalizePhoneNumber } from '../patients/patientContact';
// Shared with the edge functions (pure TypeScript): the one home of SMS message types and intents
import { AUTO_REPLY_MESSAGE_TYPE, SMS_REPLIES_FEATURE_KEY } from '../../../supabase/functions/_shared/smsMessagePolicy.ts';
import type { SmsReplyIntent } from '../../../supabase/functions/_shared/smsReplyIntent.ts';

// The generated database types do not know practice_sms_replies yet, so rows are read with the
// untyped client and checked at runtime (normalizeSmsReplyRow)
const db = supabase as unknown as SupabaseClient;

export const SMS_REPLIES_TABLE = 'practice_sms_replies';

export type SmsReplyStatus = 'new' | 'handled';
export type SmsReplyFilter = 'needs_reply' | 'handled' | 'all';

export interface SmsReply {
  id: string;
  practiceId: string;
  patientId: string | null;
  patientName: string | null;
  visitId: string | null;
  /** The number that sent the reply (answers go back to it) */
  sourcePhone: string;
  message: string;
  originalMessage: string | null;
  originalMessageType: string | null;
  intent: SmsReplyIntent;
  rating: number | null;
  /** What the system did automatically, or why staff must look */
  actionTaken: string | null;
  status: SmsReplyStatus;
  handledAt: string | null;
  handledByName: string | null;
  /** Handled by the webhook itself (no staff member) */
  handledAutomatically: boolean;
  receivedAt: string;
}

export type SmsRepliesLoad =
  | { state: 'ready'; replies: SmsReply[]; needsReplyCount: number }
  | { state: 'not_enabled' }
  | { state: 'error'; message: string };

export type SmsReplyBadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray';

/** How each intent is shown to staff. Typed against the webhook's intents, so none can be missing. */
export const SMS_REPLY_INTENT_LABELS: Record<SmsReplyIntent, { label: string; icon: string; tone: SmsReplyBadgeTone }> = {
  confirm: { label: 'Confirms appointment', icon: 'solar:calendar-mark-bold-duotone', tone: 'green' },
  cancel: { label: 'Cancels appointment', icon: 'solar:close-circle-bold-duotone', tone: 'red' },
  reschedule: { label: 'Wants a new time', icon: 'solar:calendar-mark-bold-duotone', tone: 'amber' },
  booking: { label: 'Booking request', icon: 'solar:calendar-add-bold-duotone', tone: 'blue' },
  opt_out: { label: 'Stop SMS (STOP)', icon: 'solar:user-block-rounded-bold-duotone', tone: 'gray' },
  opt_in: { label: 'Start SMS again', icon: 'solar:user-check-rounded-bold-duotone', tone: 'green' },
  help: { label: 'Asked for help', icon: 'solar:info-circle-bold-duotone', tone: 'blue' },
  rating: { label: 'Rating', icon: 'solar:star-bold-duotone', tone: 'purple' },
  waitlist_accept: { label: 'Wants the offered slot', icon: 'solar:user-plus-bold-duotone', tone: 'blue' },
  waitlist_decline: { label: 'Declined the offered slot', icon: 'solar:minus-circle-bold-duotone', tone: 'gray' },
  free_text: { label: 'Message', icon: 'solar:chat-square-bold-duotone', tone: 'gray' },
};

const isIntent = (value: unknown): value is SmsReplyIntent =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(SMS_REPLY_INTENT_LABELS, value);

const COLUMNS =
  'id, practice_id, patient_id, visit_id, source_phone, message, original_message, original_message_type, intent, rating, ' +
  'action_taken, status, handled_by, handled_at, received_at, patient:patients(first_name, last_name), handler:users(full_name)';

/** The table does not exist yet: two-way SMS has not been switched on for this database. */
export function isMissingTableError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes(SMS_REPLIES_TABLE) && (message.includes('does not exist') || message.includes('could not find the table'));
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);
const embedded = (value: unknown): Record<string, unknown> | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
};

/** A database row as an SmsReply, or null when it lacks what the inbox needs. */
export function normalizeSmsReplyRow(row: unknown): SmsReply | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const practiceId = text(r.practice_id);
  const receivedAt = text(r.received_at);
  if (!id || !practiceId || !receivedAt) return null;

  const patient = embedded(r.patient);
  const patientName = patient ? [text(patient.first_name), text(patient.last_name)].filter(Boolean).join(' ') || null : null;
  const handler = embedded(r.handler);
  const status: SmsReplyStatus = r.status === 'handled' ? 'handled' : 'new';
  const rating = typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5 ? r.rating : null;

  return {
    id,
    practiceId,
    patientId: text(r.patient_id),
    patientName,
    visitId: text(r.visit_id),
    sourcePhone: text(r.source_phone) ?? '',
    message: typeof r.message === 'string' ? r.message : '',
    originalMessage: text(r.original_message),
    originalMessageType: text(r.original_message_type),
    intent: isIntent(r.intent) ? r.intent : 'free_text',
    rating,
    actionTaken: text(r.action_taken),
    status,
    handledAt: text(r.handled_at),
    handledByName: handler ? text(handler.full_name) : null,
    handledAutomatically: status === 'handled' && !text(r.handled_by),
    receivedAt,
  };
}

/** Replies of a practice, newest first, and how many are waiting for staff. */
export async function loadSmsReplies(practiceId: string, filter: SmsReplyFilter, limit = 100): Promise<SmsRepliesLoad> {
  let list = db.from(SMS_REPLIES_TABLE).select(COLUMNS).eq('practice_id', practiceId).order('received_at', { ascending: false }).limit(limit);
  if (filter === 'needs_reply') list = list.eq('status', 'new');
  if (filter === 'handled') list = list.eq('status', 'handled');

  const [rows, waiting] = await Promise.all([
    list,
    db.from(SMS_REPLIES_TABLE).select('id', { count: 'exact', head: true }).eq('practice_id', practiceId).eq('status', 'new'),
  ]);
  if (rows.error) {
    return isMissingTableError(rows.error) ? { state: 'not_enabled' } : { state: 'error', message: rows.error.message };
  }
  const replies = ((rows.data ?? []) as unknown[]).map(normalizeSmsReplyRow).filter((reply): reply is SmsReply => reply !== null);
  return { state: 'ready', replies, needsReplyCount: waiting.error ? replies.filter((r) => r.status === 'new').length : (waiting.count ?? 0) };
}

/**
 * Are the practice's SMS replies collected? Only when OneHealth support switched practice_features 'sms_replies' on
 * (the reply webhook serves the practice); staff cannot switch it. Anything unreadable counts as not collected, so
 * no SMS ever asks for a reply that nobody would see.
 */
export async function loadSmsRepliesLive(practiceId: string): Promise<boolean> {
  try {
    const { data, error } = await db
      .from('practice_features')
      .select('is_enabled')
      .eq('practice_id', practiceId)
      .eq('feature_key', SMS_REPLIES_FEATURE_KEY)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { is_enabled?: unknown } | null)?.is_enabled === true;
  } catch (error) {
    console.warn('Could not read whether SMS replies are collected:', error instanceof Error ? error.message : error);
    return false;
  }
}

/** Number of replies waiting for staff (for a badge), or null when unknown or not switched on. */
export async function countSmsRepliesNeedingReply(practiceId: string): Promise<number | null> {
  const { count, error } = await db
    .from(SMS_REPLIES_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('practice_id', practiceId)
    .eq('status', 'new');
  return error ? null : (count ?? 0);
}

export type SmsReplyUpdate = { ok: true } | { ok: false; message: string };

/**
 * Mark a reply handled (by the signed-in user) or move it back to "Needs reply".
 * Only these columns may be changed by staff (see the grants in the SQL proposal).
 */
export async function setSmsReplyHandled(replyId: string, handled: boolean): Promise<SmsReplyUpdate> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user?.id ?? null;
  const { data, error } = await db
    .from(SMS_REPLIES_TABLE)
    .update(
      handled
        ? { status: 'handled', handled_by: userId, handled_at: new Date().toISOString() }
        : { status: 'new', handled_by: null, handled_at: null }
    )
    .eq('id', replyId)
    .select('id');
  if (error) return { ok: false, message: `Not saved: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, message: 'Not saved: this reply belongs to another practice or no longer exists.' };
  return { ok: true };
}

/** SMS parts a text needs (160 characters for one, 153 per part after that). */
export function smsParts(message: string): number {
  const length = message.length;
  if (length === 0) return 0;
  return length <= 160 ? 1 : Math.ceil(length / 153);
}

/** The sender as staff read it: "+264 81 123 4567", or the number as received. */
export function formatSmsSender(sourcePhone: string): string {
  const e164 = normalizePhoneNumber(sourcePhone);
  return e164 ? formatPhoneForDisplay(e164) : sourcePhone;
}

/** "Today, 10:42" or "7 Oct 2026, 10:42" (day first). */
export function formatReceivedAt(iso: string): string {
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return isToday(date) ? `Today, ${format(date, 'HH:mm')}` : format(date, 'd MMM yyyy, HH:mm');
}

/** The original message type in words: "appointment reminder", "automatic answer". */
export function describeMessageType(messageType: string | null): string | null {
  if (!messageType) return null;
  if (messageType === AUTO_REPLY_MESSAGE_TYPE) return 'automatic answer';
  if (messageType === 'custom') return 'message from the practice';
  return messageType.replace(/_/g, ' ');
}

export type SmsAnswerResult = { ok: true; markedHandled: boolean } | { ok: false; message: string };

/**
 * Answer a reply by SMS through the gateway (logged and counted like every SMS), to the number that
 * wrote, then mark the reply handled. 'custom' (a message typed for one patient) still reaches a
 * patient who replied STOP: they wrote to the practice.
 */
export async function sendSmsReplyAnswer(reply: SmsReply, answer: string): Promise<SmsAnswerResult> {
  const message = answer.trim();
  if (!message) return { ok: false, message: 'Type a reply first.' };
  const phone = normalizePhoneNumber(reply.sourcePhone);
  if (!phone) return { ok: false, message: `The number ${reply.sourcePhone || '(none)'} cannot receive SMS.` };

  const result = await communicationService.sendSMS({
    practiceId: reply.practiceId,
    recipientPhone: phone,
    messageContent: message,
    messageType: 'custom',
    patientId: reply.patientId ?? undefined,
    visitId: reply.visitId ?? undefined,
    metadata: { source: 'sms_replies_inbox', in_reply_to: reply.id },
  });
  if (!result.success) return { ok: false, message: getCommunicationErrorMessage('sms', result.error) };

  if (reply.status === 'handled') return { ok: true, markedHandled: true };
  const marked = await setSmsReplyHandled(reply.id, true);
  return { ok: true, markedHandled: marked.ok };
}

/** Reload when a reply of the practice arrives or changes (needs the table in supabase_realtime). */
export function subscribeToSmsReplies(practiceId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`sms-replies-${practiceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SMS_REPLIES_TABLE, filter: `practice_id=eq.${practiceId}` },
      () => onChange()
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
