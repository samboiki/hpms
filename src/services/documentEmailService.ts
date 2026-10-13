/**
 * Emails a document (invoice, statement, quote, receipt) as a PDF attachment through the centralized email gateway
 * (communicationService.sendEmail): logged in practice_email_logs with the patient, so it shows under "Messages sent"
 * on the patient file and in Messages > Message log; counted against the practice's email bundle. Nothing is sent
 * until staff press Send.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { communicationService, getCommunicationErrorMessage, type EmailType } from './communicationService';
import { formalPatientName } from '../utils/patients/patientName';
import {
  documentRecipients,
  isEmailAddress,
  messageHtml,
  type DocumentKind,
  type DocumentRecipient
} from '../utils/messages/documentEmail';

// account_holder_links is not in the generated types
const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const personOf = (row: Row | null): { name: string; email: string | null } | null => {
  if (!row) return null;
  const first = text(row.first_name);
  const last = text(row.last_name);
  const name = formalPatientName({ title: text(row.title), initials: text(row.initials), first_name: first, last_name: last }) ?? [first, last].filter(Boolean).join(' ');
  return { name: name || 'Patient', email: text(row.email) };
};

const PERSON_COLUMNS = 'first_name, last_name, title, initials, email';

/**
 * Where a patient's documents can go, the default first: the account holder (who pays) when the patient is on
 * someone's account, then the patient. Before the debtors update there are no accounts: the patient only.
 */
export async function loadDocumentRecipients(practiceId: string, patientId: string): Promise<DocumentRecipient[]> {
  const [patient, link] = await Promise.all([
    db.from('patients').select(PERSON_COLUMNS).eq('id', patientId).maybeSingle(),
    db
      .from('account_holder_links')
      .select('holder_patient_id')
      .eq('practice_id', practiceId)
      .eq('patient_id', patientId)
      .is('unlinked_at', null)
      .limit(1)
  ]);
  if (patient.error) throw new Error(`Could not read the patient's email address: ${patient.error.message}`);
  const holderId = link.error ? null : text(((link.data ?? []) as Row[])[0]?.holder_patient_id);
  let holder: Row | null = null;
  if (holderId) {
    const { data } = await db.from('patients').select(PERSON_COLUMNS).eq('id', holderId).maybeSingle();
    holder = (data as Row | null) ?? null;
  }
  return documentRecipients(personOf(patient.data as Row | null), personOf(holder));
}

export interface DocumentEmail {
  practiceId: string;
  /** The patient the document belongs to: the email is logged on their file */
  patientId: string;
  kind: DocumentKind;
  to: string;
  recipientName: string | null;
  subject: string;
  /** The message staff checked, plain text */
  message: string;
  attachment: { fileName: string; base64: string };
  /** The gateway's type for the log ('invoice' for money documents) */
  emailType: EmailType;
  invoiceId?: string | null;
  visitId?: string | null;
  /** What else the log keeps (the receipt or quote id, the statement run) */
  metadata?: Record<string, unknown>;
}

export interface DocumentEmailResult {
  ok: boolean;
  message: string;
}

/** Sends the document as a PDF through the centralized email gateway. */
export async function emailDocument(email: DocumentEmail): Promise<DocumentEmailResult> {
  const to = email.to.trim();
  if (!isEmailAddress(to)) return { ok: false, message: 'Enter a complete email address.' };
  if (!email.subject.trim()) return { ok: false, message: 'Give the email a subject.' };
  if (!email.message.trim()) return { ok: false, message: 'Write a short message to go with the document.' };
  const response = await communicationService.sendEmail({
    practiceId: email.practiceId,
    recipientEmail: to,
    recipientName: email.recipientName ?? undefined,
    subject: email.subject.trim(),
    htmlContent: messageHtml(email.message),
    textContent: email.message.trim(),
    emailType: email.emailType,
    patientId: email.patientId,
    invoiceId: email.invoiceId ?? undefined,
    visitId: email.visitId ?? undefined,
    attachments: [{ filename: email.attachment.fileName, content: email.attachment.base64, type: 'application/pdf' }],
    metadata: { ...email.metadata, kind: email.kind, source: 'document_email', attachmentNames: [email.attachment.fileName] },
    tags: ['document', email.kind]
  });
  if (!response.success) return { ok: false, message: getCommunicationErrorMessage('email', response.error) };
  return { ok: true, message: `Emailed to ${to}.` };
}
