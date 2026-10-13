/**
 * SMS message types: which ones still go to a patient who replied STOP, and what a patient's reply
 * refers to. This is the one place for these lists. The SMS gateway, the reply webhook and the app
 * (patient automation lists, bulk messages) all read them from here.
 *
 * Pure TypeScript (no Deno APIs): unit tested with Vitest.
 */

/** Message type of the reply webhook's automatic answers. The loop guard looks for it. */
export const AUTO_REPLY_MESSAGE_TYPE = 'sms_auto_reply';

/** Message type of patient app sign-in codes (auth-sms-hook). The patient asked for the code. */
export const AUTH_OTP_MESSAGE_TYPE = 'auth_otp';

/**
 * Still sent to a patient who opted out (patients.sms_opt_out): messages about care the patient
 * booked or asked for. Each type also covers its timing/channel variants, e.g.
 * appointment_reminder_24h, appointment_reminder_2h, appointment_confirmation_sms.
 */
export const ESSENTIAL_SMS_TYPES = [
  AUTH_OTP_MESSAGE_TYPE,
  'appointment_reminder',
  'appointment_confirmation',
  'appointment_cancellation',
  'appointment_rescheduled',
  'results_ready',
  'lab_results',
  'critical_lab_results',
  'imaging_results_ready',
  'prescription_ready',
  'invoice',
  'invoice_notification',
  'telemedicine_link',
  'custom', // a message staff typed to one patient (bulk sends are excluded, see below)
  'system',
  AUTO_REPLY_MESSAGE_TYPE,
] as const;

/**
 * Never sent to a patient who opted out. Listed for senders (campaigns, automation lists): any type
 * that is not in ESSENTIAL_SMS_TYPES is treated the same way, including types added later.
 */
export const NON_ESSENTIAL_SMS_TYPES = [
  'marketing',
  'promotion',
  'newsletter',
  'campaign',
  'birthday',
  'recall',
  'automation',
  'automation_list',
  'general', // welcome automation (process-automation-queue)
  'follow_up', // includes Google review requests
  'feedback_request',
  'review_request',
] as const;

// Timing/channel variants of a type: _24h, _2h, _7d, _sms
const TYPE_VARIANT_SUFFIX = /^_(?:\d+[hd]|sms)$/;

const matchesType = (messageType: string, base: string): boolean =>
  messageType === base ||
  (messageType.startsWith(base) && TYPE_VARIANT_SUFFIX.test(messageType.slice(base.length)));

const cleanType = (messageType: string | null | undefined): string => (messageType ?? '').trim().toLowerCase();

/** True for message types a patient who opted out still receives. */
export function isEssentialSmsType(messageType: string | null | undefined): boolean {
  const type = cleanType(messageType);
  return type !== '' && ESSENTIAL_SMS_TYPES.some((base) => matchesType(type, base));
}

/**
 * May this message go to a patient who replied STOP? Only essential types, and never a bulk send:
 * a message to many patients at once is a campaign whatever type it carries.
 */
export function maySendToOptedOutPatient(messageType: string | null | undefined, metadata?: unknown): boolean {
  if (metadata && typeof metadata === 'object') {
    const meta = metadata as Record<string, unknown>;
    if (meta.bulkSend === true || meta.bulk_send === true) return false;
  }
  return isEssentialSmsType(messageType);
}

/** What a reply can refer to, from the message the patient answered. */
export type SmsReplyContext = 'appointment' | 'waitlist_offer' | 'feedback' | 'none';

/** Messages about one appointment: 1 / YES = confirm, 2 / NO = cancel, 3 = new time. */
export const APPOINTMENT_PROMPT_TYPES = ['appointment_reminder', 'appointment_confirmation'] as const;

/** Messages that ask the patient to rate a visit from 1 to 5. */
export const FEEDBACK_PROMPT_TYPES = ['feedback_request'] as const;

/**
 * Messages that offer a freed slot to a waitlisted patient. appointmentService sends these as
 * 'appointment_reminder' with metadata.source 'waitlist_notification', and their appointment_id is
 * the other patient's cancelled visit, so YES must never confirm that visit.
 */
export const WAITLIST_OFFER_MARKERS = ['waitlist_offer', 'waitlist_notification'] as const;

export interface OriginalSmsMessage {
  messageType?: string | null;
  metadata?: unknown;
}

/** The context of a reply, from the original message's type and metadata. */
export function replyContextFor(original: OriginalSmsMessage | null | undefined): SmsReplyContext {
  if (!original) return 'none';
  const type = cleanType(original.messageType);
  const meta = original.metadata && typeof original.metadata === 'object'
    ? (original.metadata as Record<string, unknown>)
    : {};
  const source = typeof meta.source === 'string' ? meta.source.trim().toLowerCase() : '';

  if (WAITLIST_OFFER_MARKERS.some((marker) => marker === type || marker === source)) return 'waitlist_offer';
  if (FEEDBACK_PROMPT_TYPES.some((base) => matchesType(type, base))) return 'feedback';
  if (APPOINTMENT_PROMPT_TYPES.some((base) => matchesType(type, base))) return 'appointment';
  return 'none';
}

/**
 * Two-way SMS is live for a practice when OneHealth support switched on its practice_features row 'sms_replies': the
 * sms-reply-webhook is deployed and SMSPortal sends that practice's replies to it. Staff cannot switch it on
 * (practice_features has no write policy), and there is no row until support adds one, so it starts off.
 */
export const SMS_REPLIES_FEATURE_KEY = 'sms_replies';

const REPLY_WORD = /\breply\b/i;

/** True when a message asks the patient to reply ("Reply 2 to cancel", "reply STOP"). */
export const invitesReply = (text: string): boolean => REPLY_WORD.test(text);

/**
 * A message with its reply line only while the practice's replies are collected. Until then no SMS asks the patient to
 * reply: a patient who answers "2" would believe the booking is cancelled while nobody ever sees the answer.
 * A template that already ends in the line (the defaults before 2026-10-08, or a practice's copy of them) loses it
 * while replies are not collected, and never gets it twice.
 */
export function withReplyInvite(template: string, invite: string, repliesLive: boolean): string {
  const text = template.trimEnd();
  const body = text.endsWith(invite) ? text.slice(0, -invite.length).trimEnd() : text;
  return repliesLive && !invitesReply(body) ? `${body} ${invite}` : body;
}

/** Why a practice's own message cannot be saved as it is, or null: it asks for replies nobody collects yet. */
export function replyInviteProblem(template: string, invite: string, repliesLive: boolean): string | null {
  if (repliesLive || !invitesReply(withReplyInvite(template, invite, false))) return null;
  return "Patients' SMS replies are not collected yet, so the message cannot ask them to reply. Take out the \"Reply ...\" part.";
}

/** True when the original message was one of the webhook's automatic answers (loop guard). */
export function isAutoReplyMessage(original: OriginalSmsMessage | null | undefined): boolean {
  if (!original) return false;
  if (cleanType(original.messageType) === AUTO_REPLY_MESSAGE_TYPE) return true;
  const meta = original.metadata;
  return !!meta && typeof meta === 'object' && (meta as Record<string, unknown>).auto_reply === true;
}

/**
 * Message types whose text carries a secret (a sign-in code). Practice staff can read
 * practice_sms_logs, and anyone who sees a code can sign in to that patient's app account.
 */
export const SECRET_SMS_TYPES = [AUTH_OTP_MESSAGE_TYPE] as const;

/** Mask used for each hidden code in stored and logged message text. */
export const HIDDEN_CODE_MASK = '******';

/** True for message types whose text must never be stored or logged as sent. */
export function isSecretSmsType(messageType: string | null | undefined): boolean {
  const type = cleanType(messageType);
  return SECRET_SMS_TYPES.some((secret) => secret === type);
}

/**
 * The message text as stored in practice_sms_logs and printed in function logs: for secret types
 * every run of 4 or more digits (the code) is replaced by HIDDEN_CODE_MASK, so staff can still see
 * that a code went out without being able to use it. Other messages are returned unchanged.
 */
export function smsContentForLog(messageType: string | null | undefined, content: string): string {
  if (!isSecretSmsType(messageType)) return content;
  return content.replace(/\d{4,}/g, HIDDEN_CODE_MASK);
}
