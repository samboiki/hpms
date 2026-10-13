/**
 * Consent forms signed on the screen (patient_consents, proposals/2026-10-13-patient-file-extras.sql). Signing makes
 * the PDF (src/components/letters/letterPdf.ts, the practice letterhead with the drawn signature), stores it in the
 * private records bucket under the practice's patient documents, then records it through record_patient_consent,
 * which checks the practice, the patient, the visit and that the PDF is really there, and stamps who obtained it and
 * when. A recorded form is never changed. Before the proposal is applied, forms are "not set up yet".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingFunctionError, isMissingTableError } from '../utils/diary/dbErrors';
import { RECORDS_BUCKET, recordPath } from './recordPaths';
import { renderLetterPdf } from '../components/letters/letterPdf';
import { isConsentSigner, type ConsentSigner } from '../utils/clinical/consent';
import type { LetterDocument } from '../utils/clinical/letters';

export const CONSENTS_TABLE = 'patient_consents';

export class ConsentsNotSetUpError extends Error {
  constructor() {
    super('Consent forms are not set up in this database yet.');
    this.name = 'ConsentsNotSetUpError';
  }
}

export const isConsentsNotSetUp = (error: unknown): boolean =>
  error instanceof ConsentsNotSetUpError || isMissingTableError(error, CONSENTS_TABLE) || isMissingFunctionError(error, 'record_patient_consent');

export interface ConsentRecord {
  id: string;
  patientId: string;
  visitId: string | null;
  templateId: string | null;
  title: string;
  signedBy: ConsentSigner;
  signerName: string;
  /** The signed PDF in the records bucket */
  filePath: string;
  fileSha256: string;
  fileSize: number;
  obtainedByName: string | null;
  signedAt: string;
  /** The form as signed, when it was read (listConsents with content) */
  document: LetterDocument | null;
}

type Row = Record<string, unknown>;

// The generated database types do not include this table or its function yet
const db = supabase as unknown as SupabaseClient;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

export function toConsentRecord(row: Row): ConsentRecord {
  const obtained = Array.isArray(row.obtained) ? row.obtained[0] : row.obtained;
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    visitId: text(row.visit_id),
    templateId: text(row.template_id),
    title: String(row.title ?? ''),
    signedBy: isConsentSigner(row.signed_by) ? row.signed_by : 'patient',
    signerName: String(row.signer_name ?? ''),
    filePath: String(row.file_path ?? ''),
    fileSha256: String(row.file_sha256 ?? ''),
    fileSize: Number(row.file_size ?? 0),
    obtainedByName: obtained && typeof obtained === 'object' ? text((obtained as Row).full_name) : null,
    signedAt: String(row.signed_at ?? ''),
    document: row.content && typeof row.content === 'object' ? (row.content as LetterDocument) : null
  };
}

const COLUMNS =
  'id, patient_id, visit_id, template_id, title, signed_by, signer_name, file_path, file_sha256, file_size, signed_at, ' +
  'obtained:users!patient_consents_obtained_by_fkey(full_name)';

/** The patient's signed forms (of one visit when given), newest first; with the signed text and signature if asked. */
export async function listConsents(patientId: string, options: { visitId?: string | null; withContent?: boolean } = {}): Promise<ConsentRecord[]> {
  let query = db
    .from(CONSENTS_TABLE)
    .select(options.withContent ? `${COLUMNS}, content` : COLUMNS)
    .eq('patient_id', patientId)
    .order('signed_at', { ascending: false });
  if (options.visitId) query = query.eq('visit_id', options.visitId);
  const { data, error } = await query;
  if (error) {
    if (isConsentsNotSetUp(error)) throw new ConsentsNotSetUpError();
    throw new Error(`Could not load the consent forms: ${error.message}`);
  }
  return ((data ?? []) as unknown as Row[]).map(toConsentRecord);
}

/**
 * The practitioner of a visit (visits.doctor_id), for a consent form signed at that visit: the form names who treats,
 * while the signed-in staff member is the witness. Null when the visit names nobody or cannot be read.
 */
export async function loadVisitPractitionerName(visitId: string): Promise<string | null> {
  const { data } = await db.from('visits').select('doctor:users!visits_doctor_id_fkey(full_name)').eq('id', visitId).maybeSingle();
  const doctor = (data as Row | null)?.doctor;
  const row = Array.isArray(doctor) ? doctor[0] : doctor;
  return row && typeof row === 'object' ? text((row as Row).full_name) : null;
}

/** SHA-256 of the PDF in hex, kept with the form so a copy can be checked against what was signed. */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

const randomPart = (): string => Math.random().toString(36).slice(2, 10);

/** The folder of a patient's documents that holds the signed consent forms */
export const CONSENTS_FOLDER = 'consents';

/**
 * Where a signed form's PDF is stored: <practice>/patient-documents/<patient>/consents/consent-<date>-<random>.pdf. The
 * storage rules lock that folder: a file is uploaded once and never deleted, replaced or moved
 * (proposals/2026-10-13-consent-files-locked.sql), and record_patient_consent accepts no other place.
 */
export function consentPdfPath(practiceId: string, patientId: string, dateKey: string, unique: string = randomPart()): string {
  return recordPath(practiceId, 'patient-documents', patientId, CONSENTS_FOLDER, `consent-${dateKey}-${unique}.pdf`);
}

export interface NewConsent {
  practiceId: string;
  patientId: string;
  visitId: string | null;
  templateId: string | null;
  /** The signed form (buildConsentDocument with the signature) */
  document: LetterDocument;
  signedBy: ConsentSigner;
  signerName: string;
  /** Windhoek date, yyyy-MM-dd: part of the PDF's name */
  dateKey: string;
}

interface DbError {
  code?: string;
  message?: string;
}

/**
 * Keeps the signed form: the PDF in the patient's documents, then the record. If the record cannot be made, the PDF
 * is taken out again, so no unrecorded consent is left lying in the documents. Returns the record's id.
 */
export async function recordConsent(consent: NewConsent): Promise<string> {
  const pdf = new Uint8Array(renderLetterPdf(consent.document).output('arraybuffer') as ArrayBuffer);
  const hash = await sha256Hex(pdf);
  const path = consentPdfPath(consent.practiceId, consent.patientId, consent.dateKey);
  const upload = await supabase.storage
    .from(RECORDS_BUCKET)
    .upload(path, new Blob([pdf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false });
  if (upload.error) throw new Error(`The signed form could not be saved in the patient's documents: ${upload.error.message}`);

  const { data, error } = await db.rpc('record_patient_consent', {
    p_patient_id: consent.patientId,
    p_visit_id: consent.visitId || null,
    p_template_id: consent.templateId,
    p_title: consent.document.recordTitle,
    p_signed_by: consent.signedBy,
    p_signer_name: consent.signerName,
    p_content: consent.document,
    p_file_path: path,
    p_file_sha256: hash,
    p_file_size: pdf.byteLength
  });
  if (error) {
    await supabase.storage.from(RECORDS_BUCKET).remove([path]).catch(() => undefined);
    if (isConsentsNotSetUp(error)) throw new ConsentsNotSetUpError();
    const { code, message } = error as DbError;
    if ((code === '42501' || code === '22023') && message && !/row-level security|permission denied/i.test(message)) throw new Error(message);
    throw new Error('The signed form could not be kept on the file. Please try again.');
  }
  return String(data);
}
