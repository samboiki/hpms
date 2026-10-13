/**
 * Reads the message log (practice_sms_logs and practice_email_logs; staff of the practice may read them). Only the
 * columns the list shows are read: email logs also hold the attachments, which are never fetched here. A message's
 * full text is read on its own when staff open it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { searchPatients } from '../finance/receipts/arService';
import type { MessageChannel } from '../patients/patientMessages';
import {
  OUTCOME_STATUSES,
  mergeLogPage,
  searchText,
  toLogEntry,
  type LogChannelFilter,
  type LogOutcomeFilter,
  type MessageLogEntry
} from './messageLog';

// The gateways' log tables are not in the generated types
const db = supabase as unknown as SupabaseClient;

export const MESSAGE_LOG_PAGE = 50;

const SMS_COLUMNS = 'id, created_at, recipient_phone, message_content, message_type, status, failure_reason, patient_id, visit_id, metadata';
const EMAIL_COLUMNS = 'id, created_at, recipient_email, recipient_name, subject, email_type, status, failure_reason, patient_id, visit_id, invoice_id, metadata';

export interface MessageLogQuery {
  search?: string;
  channel: LogChannelFilter;
  outcome: LogOutcomeFilter;
  /** One patient's messages (the patient file's "Show all") */
  patientId?: string | null;
  /** Older than (or as old as) this time: the next page */
  before?: string | null;
  /** Rows already on screen (left out of the next page) */
  shown?: ReadonlySet<string>;
}

export interface MessageLogPage {
  entries: MessageLogEntry[];
  more: boolean;
  /** Patient names of the entries, by patient id */
  patientNames: Record<string, string>;
  /** One of the two logs could not be read: the list may be missing some */
  incomplete: boolean;
}

type Row = Record<string, unknown>;

async function readLog(channel: MessageChannel, practiceId: string, query: MessageLogQuery, patientIds: readonly string[] | null, term: string) {
  const table = channel === 'sms' ? 'practice_sms_logs' : 'practice_email_logs';
  let request = db
    .from(table)
    .select(channel === 'sms' ? SMS_COLUMNS : EMAIL_COLUMNS)
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_LOG_PAGE + 1);
  if (query.patientId) request = request.eq('patient_id', query.patientId);
  if (query.before) request = request.lte('created_at', query.before);
  if (query.outcome === 'failed') {
    const known = [...OUTCOME_STATUSES.delivered, ...OUTCOME_STATUSES.sent, ...OUTCOME_STATUSES.waiting];
    request = request.not('status', 'in', `(${known.join(',')})`);
  } else if (query.outcome !== 'all') {
    request = request.in('status', [...OUTCOME_STATUSES[query.outcome]]);
  }
  if (term) {
    const content = channel === 'sms' ? 'message_content' : 'subject';
    const recipient = channel === 'sms' ? 'recipient_phone' : 'recipient_email';
    const filters = [`${content}.ilike.%${term}%`, `${recipient}.ilike.%${term}%`];
    if (channel === 'email') filters.push(`recipient_name.ilike.%${term}%`);
    if (patientIds && patientIds.length > 0) filters.push(`patient_id.in.(${patientIds.join(',')})`);
    request = request.or(filters.join(','));
  }
  const { data, error } = await request;
  // The column list depends on the log, so the client cannot type the rows
  return { rows: ((data ?? []) as unknown as Row[]).map(row => toLogEntry(channel, row)), error };
}

/** One page of the log, newest first. */
export async function loadMessageLog(practiceId: string, query: MessageLogQuery): Promise<MessageLogPage> {
  const term = searchText(query.search ?? '');
  // A name typed in the search also finds that patient's messages (the patients search staff know from elsewhere)
  const patientIds = term && !query.patientId ? (await searchPatients(practiceId, term).catch(() => [])).map(match => match.id) : null;
  const [sms, email] = await Promise.all([
    query.channel === 'email' ? Promise.resolve({ rows: [] as MessageLogEntry[], error: null }) : readLog('sms', practiceId, query, patientIds, term),
    query.channel === 'sms' ? Promise.resolve({ rows: [] as MessageLogEntry[], error: null }) : readLog('email', practiceId, query, patientIds, term)
  ]);
  if (sms.error && email.error) throw new Error('The message log could not be loaded. Please try again.');
  const page = mergeLogPage(sms.rows, email.rows, MESSAGE_LOG_PAGE, query.shown);
  return { ...page, patientNames: await loadPatientNames(page.entries), incomplete: Boolean(sms.error || email.error) };
}

async function loadPatientNames(entries: readonly MessageLogEntry[]): Promise<Record<string, string>> {
  const ids = [...new Set(entries.map(entry => entry.patientId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return {};
  const { data, error } = await db.from('patients').select('id, first_name, last_name').in('id', ids);
  if (error) return {};
  return Object.fromEntries(
    ((data ?? []) as Row[]).map(row => [String(row.id), [row.first_name, row.last_name].filter(value => typeof value === 'string' && value.trim()).join(' ') || 'Patient'])
  );
}

export interface MessageBody {
  text: string;
  failureReason: string | null;
}

/** A message's full text, read when staff open it (the email's text part, never its attachments). */
export async function loadMessageBody(entry: Pick<MessageLogEntry, 'channel' | 'id'>): Promise<MessageBody> {
  const { data, error } =
    entry.channel === 'sms'
      ? await db.from('practice_sms_logs').select('message_content, failure_reason').eq('id', entry.id).maybeSingle()
      : await db.from('practice_email_logs').select('text_content, subject, failure_reason').eq('id', entry.id).maybeSingle();
  if (error) throw new Error('The message could not be opened. Please try again.');
  const row = (data ?? {}) as Row;
  const body = entry.channel === 'sms' ? row.message_content : row.text_content ?? row.subject;
  return {
    text: typeof body === 'string' && body.trim() ? body.trim() : 'The text of this message was not kept.',
    failureReason: typeof row.failure_reason === 'string' && row.failure_reason.trim() ? row.failure_reason.trim() : null
  };
}
