/**
 * The practice's message log: every SMS and email the centralized gateways sent (practice_sms_logs,
 * practice_email_logs), newest first, in plain words: who it went to, when, what it was, how it went and the patient
 * it belongs to. Pure; messageLogService.ts reads the rows. The four outcomes are the patient file's
 * (patients/patientMessages.ts), so the file and the log never disagree.
 */
import { messageOutcome, type MessageChannel, type MessageOutcome } from '../patients/patientMessages';

export type LogChannelFilter = 'all' | MessageChannel;
export type LogOutcomeFilter = 'all' | MessageOutcome;

export interface MessageLogEntry {
  /** "sms-<id>" / "email-<id>": unique across both logs */
  key: string;
  id: string;
  channel: MessageChannel;
  at: string;
  /** The number or address it went to */
  to: string;
  recipientName: string | null;
  patientId: string | null;
  /** SMS: the start of the text. Email: the subject. */
  summary: string;
  /** What it was, in plain words: "Appointment reminder", "Invoice", "Statement" */
  what: string;
  outcome: MessageOutcome;
  failureReason: string | null;
  invoiceId: string | null;
  visitId: string | null;
  /** File names of the attachments, when the sender noted them */
  attachments: string[];
}

/** The gateways' statuses behind each outcome (messageOutcome): a filter asks the database for exactly these */
export const OUTCOME_STATUSES: Readonly<Record<Exclude<MessageOutcome, 'failed'>, readonly string[]>> = {
  delivered: ['delivered', 'opened', 'clicked'],
  sent: ['sent'],
  waiting: ['pending', 'queued']
};

const KIND_LABELS: Readonly<Record<string, string>> = {
  invoice: 'Invoice',
  statement: 'Statement',
  quote: 'Quote',
  receipt: 'Receipt',
  payment_receipt: 'Receipt',
  debt_reminder: 'Account reminder',
  referral: 'Referral letter',
  letter: 'Letter',
  sick_note: 'Sick note'
};

const TYPE_LABELS: Readonly<Record<string, string>> = {
  appointment_reminder: 'Appointment reminder',
  appointment_confirmation: 'Booking confirmation',
  automation_list: 'List message',
  automation: 'Automatic message',
  follow_up: 'Follow-up',
  marketing: 'News and offers',
  system: 'Practice message',
  custom: 'Message',
  invoice: 'Account',
  report: 'Report',
  birthday: 'Birthday wishes',
  feedback_request: 'Review request',
  sms_auto_reply: 'Automatic reply',
  bulk_message: 'Message to many',
  test: 'Test message'
};

/** "follow_up_visit" -> "Follow up visit": a type nobody named yet still reads as words */
const humanise = (code: string): string => {
  const words = code.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Message';
};

type Row = Record<string, unknown>;
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const objectOf = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** What a message was: the sender's own note of it (a statement, a receipt, a letter) first, then its type. */
export function messageKindLabel(type: string | null, metadata: unknown): string {
  const meta = objectOf(metadata);
  const kind = text(meta.kind);
  if (kind && KIND_LABELS[kind]) return KIND_LABELS[kind];
  if (text(meta.source) === 'patient_letter') return 'Letter';
  if (!type) return 'Message';
  return TYPE_LABELS[type] ?? humanise(type);
}

const MAX_SUMMARY = 120;
const shorten = (value: string): string => {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_SUMMARY ? `${flat.slice(0, MAX_SUMMARY - 3).trimEnd()}...` : flat;
};

export function toLogEntry(channel: MessageChannel, row: Row): MessageLogEntry {
  const meta = objectOf(row.metadata);
  const names = Array.isArray(meta.attachmentNames) ? meta.attachmentNames.filter((name): name is string => typeof name === 'string') : [];
  return {
    key: `${channel}-${String(row.id)}`,
    id: String(row.id),
    channel,
    at: String(row.created_at ?? ''),
    to: String((channel === 'sms' ? row.recipient_phone : row.recipient_email) ?? ''),
    recipientName: text(row.recipient_name),
    patientId: text(row.patient_id),
    summary: shorten(String((channel === 'sms' ? row.message_content : row.subject) ?? '')) || (channel === 'sms' ? '(empty SMS)' : '(no subject)'),
    what: messageKindLabel(text(channel === 'sms' ? row.message_type : row.email_type), row.metadata),
    outcome: messageOutcome(text(row.status)),
    failureReason: text(row.failure_reason),
    invoiceId: text(row.invoice_id),
    visitId: text(row.visit_id),
    attachments: names
  };
}

/**
 * One page of the log: both logs' rows together, newest first, without rows already shown (a page starts at the time
 * the last one ended, so rows with that same time come back once more). `more` when either log may hold older rows.
 */
export function mergeLogPage(
  sms: readonly MessageLogEntry[],
  email: readonly MessageLogEntry[],
  pageSize: number,
  shown: ReadonlySet<string> = new Set()
): { entries: MessageLogEntry[]; more: boolean } {
  const fresh = [...sms, ...email].filter(entry => !shown.has(entry.key)).sort((a, b) => b.at.localeCompare(a.at));
  return { entries: fresh.slice(0, pageSize), more: fresh.length > pageSize || sms.length > pageSize || email.length > pageSize };
}

const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Windhoek',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

/** "12 Oct 2026, 09:30" in Windhoek time, whatever the computer's clock is set to */
export function logTime(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? '' : TIME_FORMAT.format(date);
}

/**
 * What staff typed in the search box, safe inside a database filter: letters, digits, spaces and the characters of
 * numbers and addresses (@ . + - '); anything that has a meaning in a filter (commas, brackets, quotes, *) is dropped.
 */
export function searchText(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N} @.+'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
