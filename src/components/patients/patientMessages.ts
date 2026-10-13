/**
 * The messages a patient was sent (SMS and email, from the centralized gateways' logs), newest first,
 * for the patient file. Only the columns the list shows are read: email logs also hold attachments.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

// The generated database types do not include the gateways' log tables
const db = supabase as unknown as SupabaseClient;

export type MessageChannel = 'sms' | 'email';
export type MessageOutcome = 'delivered' | 'sent' | 'waiting' | 'failed';

export interface PatientMessage {
  id: string;
  channel: MessageChannel;
  /** SMS: the start of the text. Email: the subject. */
  summary: string;
  to: string;
  outcome: MessageOutcome;
  at: string;
}

export const OUTCOME_LABELS: Readonly<Record<MessageOutcome, string>> = {
  delivered: 'Delivered',
  sent: 'Sent',
  waiting: 'Waiting to send',
  failed: 'Not delivered'
};

/** The gateways' many statuses as four plain outcomes. */
export function messageOutcome(status: string | null | undefined): MessageOutcome {
  const value = (status ?? '').toLowerCase();
  if (value === 'delivered' || value === 'opened' || value === 'clicked') return 'delivered';
  if (value === 'sent') return 'sent';
  if (value === 'pending' || value === 'queued' || value === '') return 'waiting';
  return 'failed';
}

const MAX_SUMMARY = 90;
const shorten = (value: string): string => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY - 3).trimEnd()}...` : text;
};

type Row = Record<string, unknown>;

/** SMS and email rows together, newest first, at most `limit`. */
export function mergePatientMessages(sms: readonly Row[], emails: readonly Row[], limit: number): PatientMessage[] {
  const all: PatientMessage[] = [
    ...sms.map(row => ({
      id: `sms-${String(row.id)}`,
      channel: 'sms' as const,
      summary: shorten(String(row.message_content ?? '')),
      to: String(row.recipient_phone ?? ''),
      outcome: messageOutcome(row.status as string | null),
      at: String(row.created_at ?? '')
    })),
    ...emails.map(row => ({
      id: `email-${String(row.id)}`,
      channel: 'email' as const,
      summary: shorten(String(row.subject ?? '(no subject)')),
      to: String(row.recipient_email ?? ''),
      outcome: messageOutcome(row.status as string | null),
      at: String(row.created_at ?? '')
    }))
  ];
  return all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export interface PatientMessages {
  messages: PatientMessage[];
  /** True when the SMS or the email log could not be read: the list may be missing some */
  incomplete: boolean;
}

export async function loadPatientMessages(practiceId: string, patientId: string, limit = 5): Promise<PatientMessages> {
  const [sms, emails] = await Promise.all([
    db
      .from('practice_sms_logs')
      .select('id, message_content, recipient_phone, status, created_at')
      .eq('practice_id', practiceId)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit),
    db
      .from('practice_email_logs')
      .select('id, subject, recipient_email, status, created_at')
      .eq('practice_id', practiceId)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit)
  ]);
  if (sms.error && emails.error) throw new Error('Could not load the messages.');
  return {
    messages: mergePatientMessages((sms.data ?? []) as Row[], (emails.data ?? []) as Row[], limit),
    incomplete: Boolean(sms.error || emails.error)
  };
}
