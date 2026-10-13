/**
 * Reminder and confirmation status of a booking, for the small icon on its diary card. It comes from
 * what the SMS gateway logged (practice_sms_logs, linked to the visit by visit_id or appointment_id)
 * and what the patient answered (practice_sms_replies, see proposals/2026-10-07-two-way-sms.sql), so
 * reception sees who confirmed, who cancelled and whose reminder never arrived without opening anything.
 */
// Shared with the edge functions (pure TypeScript): which messages are about one appointment
import { replyContextFor } from '../../../supabase/functions/_shared/smsMessagePolicy.ts';
import { formatDiaryTimestamp } from './diaryTime';

export interface AppointmentSmsLog {
  id: string;
  /** The visit(s) the message is about: visit_id and appointment_id (reminders log the visit there) */
  visitIds: string[];
  messageType: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  metadata: unknown;
}

/** Reply intents that change what the diary shows */
export const DIARY_REPLY_INTENTS = ['confirm', 'cancel', 'reschedule'] as const;
export type DiaryReplyIntent = (typeof DIARY_REPLY_INTENTS)[number];

export interface AppointmentSmsReply {
  visitId: string;
  intent: DiaryReplyIntent;
  receivedAt: string;
}

export type ReminderTone = 'confirmed' | 'cancelled' | 'reschedule' | 'delivered' | 'sent' | 'pending' | 'failed';

export interface ReminderStatus {
  tone: ReminderTone;
  /** Short words for the card: "Confirmed by SMS", "Reminder failed" */
  label: string;
  /** The full story for the tooltip and the visit actions sheet */
  detail: string;
  /** Solar bold-duotone icon */
  icon: string;
}

const ICONS: Record<ReminderTone, string> = {
  confirmed: 'solar:check-circle-bold-duotone',
  cancelled: 'solar:close-circle-bold-duotone',
  reschedule: 'solar:calendar-mark-bold-duotone',
  delivered: 'solar:chat-round-check-bold-duotone',
  sent: 'solar:chat-round-line-bold-duotone',
  pending: 'solar:clock-circle-bold-duotone',
  failed: 'solar:danger-triangle-bold-duotone'
};

const FAILURE_REASON_MAX = 120;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const time = (iso: string | null): number => (iso ? Date.parse(iso) || 0 : 0);

/** A practice_sms_logs row, or null when it lacks what the diary needs. */
export function normalizeAppointmentSmsLog(row: unknown): AppointmentSmsLog | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const createdAt = text(r.created_at);
  const visitIds = [...new Set([text(r.visit_id), text(r.appointment_id)].filter((value): value is string => value !== null))];
  if (!id || !createdAt || visitIds.length === 0) return null;
  return {
    id,
    visitIds,
    messageType: text(r.message_type) ?? '',
    status: (text(r.status) ?? 'pending').toLowerCase(),
    createdAt,
    sentAt: text(r.sent_at),
    failedAt: text(r.failed_at),
    failureReason: text(r.failure_reason),
    metadata: r.metadata ?? null
  };
}

/** A practice_sms_replies row about a visit, or null for other replies. */
export function normalizeAppointmentSmsReply(row: unknown): AppointmentSmsReply | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const visitId = text(r.visit_id);
  const receivedAt = text(r.received_at);
  const intent = text(r.intent);
  if (!visitId || !receivedAt || !intent || !(DIARY_REPLY_INTENTS as readonly string[]).includes(intent)) return null;
  return { visitId, intent: intent as DiaryReplyIntent, receivedAt };
}

/**
 * Reminders and booking confirmations count; a waitlist offer does not, even though it is sent as an
 * 'appointment_reminder' linked to the cancelled visit whose slot it offers (smsMessagePolicy.ts).
 */
export const isAppointmentSms = (log: AppointmentSmsLog): boolean =>
  replyContextFor({ messageType: log.messageType, metadata: log.metadata }) === 'appointment';

const smsNoun = (log: AppointmentSmsLog): string =>
  log.messageType.toLowerCase().startsWith('appointment_confirmation') ? 'Booking SMS' : 'Reminder';

function smsTone(status: string): 'delivered' | 'sent' | 'pending' | 'failed' {
  if (status === 'delivered') return 'delivered';
  if (status === 'sent') return 'sent';
  if (status === 'pending' || status === 'queued') return 'pending';
  return 'failed'; // failed, expired, rejected, blocked (over the SMS bundle)
}

const on = (iso: string | null): string => {
  const when = formatDiaryTimestamp(iso);
  return when ? ` on ${when}` : '';
};

function describeSms(log: AppointmentSmsLog): { tone: ReminderTone; label: string; line: string } {
  const noun = smsNoun(log);
  const tone = smsTone(log.status);
  if (tone === 'delivered') return { tone, label: `${noun} delivered`, line: `${noun} delivered (sent${on(log.sentAt ?? log.createdAt)}).` };
  if (tone === 'sent') return { tone, label: `${noun} sent`, line: `${noun} sent${on(log.sentAt ?? log.createdAt)}.` };
  if (tone === 'pending') return { tone, label: `${noun} not sent yet`, line: `${noun} queued${on(log.createdAt)}, not sent yet.` };
  const reason = log.failureReason
    ? `: ${log.failureReason.length > FAILURE_REASON_MAX ? `${log.failureReason.slice(0, FAILURE_REASON_MAX - 3)}...` : log.failureReason}`
    : '';
  return { tone, label: `${noun} failed`, line: `${noun} could not be sent${on(log.failedAt ?? log.createdAt)}${reason}. Call the patient.` };
}

function describeReply(reply: AppointmentSmsReply): { tone: ReminderTone; label: string; line: string } {
  if (reply.intent === 'confirm') return { tone: 'confirmed', label: 'Confirmed by SMS', line: `Patient confirmed by SMS${on(reply.receivedAt)}.` };
  if (reply.intent === 'cancel') return { tone: 'cancelled', label: 'Cancelled by SMS', line: `Patient cancelled by SMS${on(reply.receivedAt)}.` };
  return { tone: 'reschedule', label: 'Wants a new time', line: `Patient asked for a new time by SMS${on(reply.receivedAt)}. Call them to rebook.` };
}

/**
 * The status of one booking, or null when no appointment SMS was sent and the patient never replied.
 * The newest event wins: a reply after the reminder shows the answer; a reminder sent after the reply
 * (the booking was moved and a new one went out) shows that reminder, with the earlier reply mentioned.
 */
export function summarizeReminderStatus(logs: AppointmentSmsLog[], replies: AppointmentSmsReply[]): ReminderStatus | null {
  const sms = logs.filter(isAppointmentSms).sort((a, b) => time(b.createdAt) - time(a.createdAt))[0];
  const reply = [...replies].sort((a, b) => time(b.receivedAt) - time(a.receivedAt))[0];
  const smsPart = sms ? describeSms(sms) : null;
  const replyPart = reply ? describeReply(reply) : null;

  if (replyPart && reply && (!sms || time(reply.receivedAt) >= time(sms.createdAt))) {
    return {
      tone: replyPart.tone,
      label: replyPart.label,
      detail: smsPart ? `${replyPart.line} ${smsPart.line}` : replyPart.line,
      icon: ICONS[replyPart.tone]
    };
  }
  if (smsPart) {
    return {
      tone: smsPart.tone,
      label: smsPart.label,
      detail: replyPart ? `${smsPart.line} Earlier: ${replyPart.line}` : smsPart.line,
      icon: ICONS[smsPart.tone]
    };
  }
  return null;
}

/** Status per visit for the bookings on screen (visits without SMS activity are left out). */
export function reminderStatusesByVisit(
  visitIds: string[],
  logs: AppointmentSmsLog[],
  replies: AppointmentSmsReply[]
): Map<string, ReminderStatus> {
  const result = new Map<string, ReminderStatus>();
  for (const visitId of new Set(visitIds)) {
    const status = summarizeReminderStatus(
      logs.filter((log) => log.visitIds.includes(visitId)),
      replies.filter((reply) => reply.visitId === visitId)
    );
    if (status) result.set(visitId, status);
  }
  return result;
}
