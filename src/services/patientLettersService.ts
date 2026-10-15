/**
 * Letters for a patient: referral letters and other letters (patient_letters,
 * proposals/2026-10-07-patient-safety.sql), the visit's sick notes (leave_forms, already in use), what
 * a letter may say about the patient, and emailing a letter through the centralized email gateway.
 *
 * Before the proposal is applied, letters can still be made, printed and emailed; they are only not
 * kept on the patient file (listLetters and createLetter throw LettersNotSetUpError).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { communicationService, getCommunicationErrorMessage } from './communicationService';
import { isSafetyNotSetUp, loadPatientSafety } from './patientSafetyService';
import { loadLetterhead } from '../components/quotes/quoteService';
import { letterPdfBase64, renderLetterPdf } from '../components/letters/letterPdf';
import { allergyDescription } from '../components/patients/safety/safetyFormat';
import { isMissingColumnError, isMissingTableError } from '../utils/diary/dbErrors';
import { formatLetterDate, type LetterContext, type LetterDocument } from '../utils/clinical/letters';
import { patientListService } from './patientListService';
import {
  appointmentMergeValues,
  patientMergeValues,
  practiceMergeValues,
  sickNoteMergeValues,
  type MergeValues,
  type PatientMergeSource
} from '../utils/templates/mergeFields';
import { isTemporaryIdNumber, patientFileStatus } from '../utils/patients/temporaryPatient';

export const LETTERS_TABLE = 'patient_letters';

export class LettersNotSetUpError extends Error {
  constructor() {
    super('Letters are not kept on the patient file yet (switched on with the patient safety update).');
    this.name = 'LettersNotSetUpError';
  }
}

export const isLettersNotSetUp = (error: unknown): boolean =>
  error instanceof LettersNotSetUpError || isMissingTableError(error, LETTERS_TABLE);

export type StoredLetterKind = 'referral' | 'letter';

export interface LetterRecord {
  id: string;
  patientId: string;
  visitId: string | null;
  kind: StoredLetterKind;
  /** The practice's letter template it was made from (letter_templates), if any */
  templateId: string | null;
  title: string;
  recipientName: string | null;
  recipientEmail: string | null;
  letterDate: string;
  validUntil: string | null;
  document: LetterDocument;
  authorName: string | null;
  sentAt: string | null;
  sentTo: string | null;
  createdAt: string;
}

export interface SickNoteRecord {
  id: string;
  visitId: string | null;
  formNumber: string | null;
  status: string | null;
  fromDate: string;
  toDate: string;
  diagnosis: string | null;
  diagnosisCode: string | null;
  issueDate: string | null;
  doctorId: string | null;
  createdAt: string;
}

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const nameOf = (value: unknown): string | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? text((row as Row).full_name) : null;
};

// The generated database types do not include patient_letters or leave_forms
const db = supabase as unknown as SupabaseClient;

export function toLetterRecord(row: Row): LetterRecord {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    visitId: text(row.visit_id),
    kind: row.kind === 'letter' ? 'letter' : 'referral',
    templateId: text(row.template_id),
    title: String(row.title ?? ''),
    recipientName: text(row.recipient_name),
    recipientEmail: text(row.recipient_email),
    letterDate: String(row.letter_date ?? ''),
    validUntil: text(row.valid_until),
    document: row.content as LetterDocument,
    authorName: nameOf(row.author),
    sentAt: text(row.sent_at),
    sentTo: text(row.sent_to),
    createdAt: String(row.created_at ?? '')
  };
}

const LETTER_COLUMNS = 'id, patient_id, visit_id, kind, title, recipient_name, recipient_email, letter_date, valid_until, content, sent_at, sent_to, created_at';

export async function listLetters(patientId: string, visitId?: string | null): Promise<LetterRecord[]> {
  const run = (columns: string) => {
    let query = db
      .from(LETTERS_TABLE)
      .select(`${columns}, author:users!patient_letters_author_id_fkey(full_name)`)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (visitId) query = query.eq('visit_id', visitId);
    return query;
  };
  let { data, error } = await run(`${LETTER_COLUMNS}, template_id`);
  // Before the letter templates update a letter has no template column: the letters still list
  if (error && isMissingColumnError(error)) ({ data, error } = await run(LETTER_COLUMNS));
  if (error) {
    if (isLettersNotSetUp(error)) throw new LettersNotSetUpError();
    throw new Error(`Could not load the letters: ${error.message}`);
  }
  return ((data ?? []) as unknown as Row[]).map(toLetterRecord);
}

export async function listSickNotes(patientId: string, visitId?: string | null): Promise<SickNoteRecord[]> {
  let query = db
    .from('leave_forms')
    .select('id, visit_id, form_number, status, from_date, to_date, diagnosis, diagnosis_code, issue_date, doctor_id, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (visitId) query = query.eq('visit_id', visitId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load the sick notes: ${error.message}`);
  return ((data ?? []) as Row[]).map(row => ({
    id: String(row.id),
    visitId: text(row.visit_id),
    formNumber: row.form_number === null || row.form_number === undefined ? null : String(row.form_number),
    status: text(row.status),
    fromDate: String(row.from_date ?? '').slice(0, 10),
    toDate: String(row.to_date ?? '').slice(0, 10),
    diagnosis: text(row.diagnosis),
    diagnosisCode: text(row.diagnosis_code),
    issueDate: text(row.issue_date),
    doctorId: text(row.doctor_id),
    createdAt: String(row.created_at ?? '')
  }));
}

export interface NewLetter {
  practiceId: string;
  patientId: string;
  visitId: string | null;
  kind: StoredLetterKind;
  document: LetterDocument;
  recipientName: string | null;
  recipientEmail: string | null;
  letterDate: string;
  validUntil: string | null;
  /** The practice's letter template it was made from (needs the letter templates update) */
  templateId?: string | null;
}

const letterRow = (letter: NewLetter) => ({
  practice_id: letter.practiceId,
  patient_id: letter.patientId,
  visit_id: letter.visitId,
  kind: letter.kind,
  title: letter.document.recordTitle.slice(0, 200),
  recipient_name: letter.recipientName,
  recipient_email: letter.recipientEmail,
  letter_date: letter.letterDate,
  valid_until: letter.validUntil,
  content: letter.document,
  // Only a letter from a template names one, so letters without a template are kept before the update too
  ...(letter.templateId ? { template_id: letter.templateId } : {})
});

/** Keeps the letter on the patient file exactly as made (the database stamps the author). */
export async function createLetter(letter: NewLetter): Promise<LetterRecord> {
  const { data, error } = await db
    .from(LETTERS_TABLE)
    .insert(letterRow(letter))
    .select(letter.templateId ? `${LETTER_COLUMNS}, template_id` : LETTER_COLUMNS)
    .single();
  if (error) {
    if (isLettersNotSetUp(error)) throw new LettersNotSetUpError();
    throw new Error(`Could not keep the letter on the file: ${error.message}`);
  }
  // The column list is chosen at run time, so the client cannot type the row
  return toLetterRecord(data as unknown as Row);
}

/** Keeps a run of letters (one per patient on a list) on each patient's file in one request; returns how many. */
export async function createLetters(letters: readonly NewLetter[]): Promise<number> {
  if (letters.length === 0) return 0;
  let kept = 0;
  // PostgREST takes the rows in one request; 200 at a time keeps each request small
  for (let start = 0; start < letters.length; start += 200) {
    const { data, error } = await db.from(LETTERS_TABLE).insert(letters.slice(start, start + 200).map(letterRow)).select('id');
    if (error) {
      if (isLettersNotSetUp(error)) throw new LettersNotSetUpError();
      throw new Error(`Could not keep the letters on the patient files (${kept} kept): ${error.message}`);
    }
    kept += (data ?? []).length;
  }
  return kept;
}

export async function markLetterEmailed(letterId: string, email: string): Promise<void> {
  const { error } = await db
    .from(LETTERS_TABLE)
    .update({ sent_at: new Date().toISOString(), sent_via: 'email', sent_to: email })
    .eq('id', letterId);
  if (error && !isLettersNotSetUp(error)) throw new Error(`The letter was sent, but could not be marked as sent: ${error.message}`);
}

export interface LetterContextRequest {
  practiceId: string;
  patientId: string;
  visitId: string | null;
  /** The practitioner who signs the letter */
  authorId: string;
  /** Windhoek date of the letter, yyyy-MM-dd */
  letterDate: string;
}

export interface LoadedLetterContext {
  context: LetterContext;
  patientEmail: string | null;
  /** The values of the {{merge fields}} a letter template can use (utils/templates/mergeFields.ts) */
  merge: MergeValues;
}

const MEDICINE_LOOKBACK_DAYS = 180;

const LETTER_PATIENT_COLUMNS = 'first_name, last_name, date_of_birth, id_number, email, title, initials, postal_address, postal_code, home_address';

/**
 * The patient a letter is about, with the town (patients.town, kept apart from the address by the town picker) when
 * the database has the column; before proposals/2026-10-13-patient-town.sql the address alone.
 */
async function readLetterPatient(patientId: string) {
  const withTown = await db.from('patients').select(`${LETTER_PATIENT_COLUMNS}, town`).eq('id', patientId).single();
  if (!withTown.error || !isMissingColumnError(withTown.error)) return withTown;
  return db.from('patients').select(LETTER_PATIENT_COLUMNS).eq('id', patientId).single();
}

/**
 * Everything a letter may say, read fresh: letterhead, signing practitioner, patient, the visit, its
 * medicines (or those of the last six months for a letter from the file), allergies and active problems; and for
 * templates the visit's sick note and the patient's next booking and last visit.
 */
export async function loadLetterContext(request: LetterContextRequest): Promise<LoadedLetterContext> {
  const since = new Date(Date.now() - MEDICINE_LOOKBACK_DAYS * 86_400_000).toISOString();
  const medicinesQuery = request.visitId
    ? db.from('medications').select('medication_name, dosage, frequency, created_at').eq('visit_id', request.visitId)
    : db.from('medications').select('medication_name, dosage, frequency, created_at').eq('patient_id', request.patientId).gte('created_at', since);

  const [letterhead, author, patient, visit, medicines, safety, sickNotes, facts] = await Promise.all([
    loadLetterhead(request.practiceId),
    db.from('users').select('full_name, job_title, hpcsa_number').eq('id', request.authorId).maybeSingle(),
    readLetterPatient(request.patientId),
    request.visitId ? db.from('visits').select('visit_date, diagnosis').eq('id', request.visitId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    medicinesQuery.order('created_at', { ascending: false }),
    loadPatientSafety(request.patientId).catch((error: unknown) => {
      // Before the safety records exist a letter says "Allergies not recorded"
      if (isSafetyNotSetUp(error)) return null;
      throw error;
    }),
    // The visit's sick note fills a template's sick note fields; without one a letter asks for them
    request.visitId ? listSickNotes(request.patientId, request.visitId).catch(() => []) : Promise.resolve([]),
    // Next booking and last visit, by the patient lists' own rules; when they cannot be read a letter asks for them
    patientListService.loadFacts(request.practiceId, request.letterDate, [request.patientId]).catch(() => [])
  ]);
  if (patient.error || !patient.data) throw new Error(`Could not read the patient: ${patient.error?.message ?? 'not found'}`);
  const patientRow = patient.data as Row;
  const authorRow = (author.data ?? {}) as Row;
  const visitRow = (visit.data ?? {}) as Row;

  const seenMedicines = new Set<string>();
  const medicineLines: string[] = [];
  for (const row of ((medicines.data ?? []) as Row[])) {
    const name = text(row.medication_name);
    if (!name || seenMedicines.has(name.toLowerCase())) continue;
    seenMedicines.add(name.toLowerCase());
    medicineLines.push([name, text(row.dosage), text(row.frequency)].filter(Boolean).join(', '));
  }

  const context: LetterContext = {
    practice: {
      name: letterhead.name,
      address: letterhead.address,
      city: letterhead.city,
      country: letterhead.country,
      postalCode: letterhead.postalCode,
      contactPhone: letterhead.contactPhone,
      contactEmail: letterhead.contactEmail,
      practiceNumber: letterhead.practiceNumber,
      primaryColor: letterhead.primaryColor
    },
    author: {
      name: text(authorRow.full_name) ?? 'The treating practitioner',
      title: text(authorRow.job_title),
      hpcnaNumber: text(authorRow.hpcsa_number)
    },
    patient: {
      name: [text(patientRow.first_name), text(patientRow.last_name)].filter(Boolean).join(' '),
      // A file opened with a name and cell number only: its temporary ID and placeholder birthday are never printed
      dateOfBirth: patientFileStatus({ id_number: text(patientRow.id_number), date_of_birth: text(patientRow.date_of_birth) }).dateOfBirth,
      idNumber: isTemporaryIdNumber(text(patientRow.id_number)) ? null : text(patientRow.id_number)
    },
    letterDate: request.letterDate,
    visitDate: text(visitRow.visit_date)?.slice(0, 10) ?? null,
    diagnosis: text(visitRow.diagnosis),
    medicines: medicineLines,
    allergies: safety ? safety.allergies.map(allergyDescription) : [],
    noKnownAllergies: safety?.profile?.noKnownAllergies === true && (safety?.allergies.length ?? 0) === 0,
    problems: safety
      ? safety.problems.filter(problem => problem.status === 'active').map(problem => (problem.icd10Code ? `${problem.description} (${problem.icd10Code})` : problem.description))
      : []
  };
  const issuedNote = sickNotes.find(note => (note.status ?? '').toLowerCase() === 'issued') ?? null;
  const merge: MergeValues = {
    ...patientMergeValues(
      {
        title: text(patientRow.title),
        initials: text(patientRow.initials),
        firstName: text(patientRow.first_name),
        lastName: text(patientRow.last_name),
        idNumber: text(patientRow.id_number),
        dateOfBirth: text(patientRow.date_of_birth),
        postalAddress: text(patientRow.postal_address),
        postalCode: text(patientRow.postal_code),
        homeAddress: text(patientRow.home_address),
        town: text(patientRow.town)
      },
      request.letterDate
    ),
    ...practiceMergeValues({
      name: letterhead.name,
      phone: letterhead.contactPhone,
      email: letterhead.contactEmail,
      address: letterhead.address,
      city: letterhead.city
    }),
    ...appointmentMergeValues(facts[0] ?? null),
    ...sickNoteMergeValues(issuedNote),
    visitDate: formatLetterDate(context.visitDate) || null,
    diagnosis: context.diagnosis?.trim() || null,
    practitionerName: text(authorRow.full_name),
    today: formatLetterDate(request.letterDate) || null
  };
  return { context, patientEmail: text(patientRow.email), merge };
}

export interface ListLetterSource {
  practice: LetterContext['practice'];
  author: LetterContext['author'];
  /** Each patient's details a letter can use (title, initials, ID, birthday, address), by patient id */
  patients: Map<string, PatientMergeSource>;
}

/** What a list's letters need, read once for the whole list: the letterhead, who signs, and each patient's details. */
export async function loadListLetterSource(practiceId: string, authorId: string, patientIds: readonly string[]): Promise<ListLetterSource> {
  const [letterhead, author] = await Promise.all([
    loadLetterhead(practiceId),
    db.from('users').select('full_name, job_title, hpcsa_number').eq('id', authorId).maybeSingle()
  ]);
  const patients = new Map<string, PatientMergeSource>();
  // The town too, when the database has the column (letters print the address with it)
  let columns = `id, ${LETTER_PATIENT_COLUMNS}, town`;
  for (let start = 0; start < patientIds.length; start += 100) {
    let { data, error } = await db.from('patients').select(columns).in('id', patientIds.slice(start, start + 100));
    if (error && columns.endsWith(', town') && isMissingColumnError(error)) {
      columns = `id, ${LETTER_PATIENT_COLUMNS}`;
      ({ data, error } = await db.from('patients').select(columns).in('id', patientIds.slice(start, start + 100)));
    }
    if (error) throw new Error(`Could not read the patients on the list: ${error.message}`);
    // The column list is chosen at run time (with or without the town), so the client cannot type the rows itself
    for (const row of (data ?? []) as unknown as Row[]) {
      patients.set(String(row.id), {
        title: text(row.title),
        initials: text(row.initials),
        firstName: text(row.first_name),
        lastName: text(row.last_name),
        idNumber: text(row.id_number),
        dateOfBirth: text(row.date_of_birth),
        postalAddress: text(row.postal_address),
        postalCode: text(row.postal_code),
        homeAddress: text(row.home_address),
        town: text(row.town)
      });
    }
  }
  const authorRow = (author.data ?? {}) as Row;
  return {
    practice: {
      name: letterhead.name,
      address: letterhead.address,
      city: letterhead.city,
      country: letterhead.country,
      postalCode: letterhead.postalCode,
      contactPhone: letterhead.contactPhone,
      contactEmail: letterhead.contactEmail,
      practiceNumber: letterhead.practiceNumber,
      primaryColor: letterhead.primaryColor
    },
    author: { name: text(authorRow.full_name) ?? 'The practice', title: text(authorRow.job_title), hpcnaNumber: text(authorRow.hpcsa_number) },
    patients
  };
}

export interface EmailLetterRequest {
  practiceId: string;
  patientId: string;
  visitId: string | null;
  document: LetterDocument;
  to: string;
  recipientName: string | null;
  /** The stored letter, when it is kept on the file */
  letterId?: string | null;
  /**
   * A PDF (base64) to attach instead of the letter's own: an issued sick note goes as the owner's leave form, the same
   * as it prints (owner, 15 Oct 2026)
   */
  pdfBase64?: string;
}

export const isEmailAddress = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Emails the letter as a PDF through the centralized email gateway (logged per practice). */
export async function emailLetter(request: EmailLetterRequest): Promise<{ ok: boolean; message: string }> {
  const to = request.to.trim();
  if (!isEmailAddress(to)) return { ok: false, message: 'Enter a complete email address.' };
  const { document } = request;
  const response = await communicationService.sendEmail({
    practiceId: request.practiceId,
    recipientEmail: to,
    recipientName: request.recipientName ?? undefined,
    subject: document.email.subject,
    htmlContent: document.email.html,
    textContent: document.email.text,
    emailType: 'report',
    patientId: request.patientId,
    visitId: request.visitId ?? undefined,
    attachments: [{ filename: document.fileName, content: request.pdfBase64 ?? letterPdfBase64(renderLetterPdf(document)), type: 'application/pdf' }],
    metadata: { kind: document.kind, letterId: request.letterId ?? null, source: 'patient_letter' },
    tags: ['letter', document.kind]
  });
  if (!response.success) return { ok: false, message: getCommunicationErrorMessage('email', response.error) };
  if (request.letterId) {
    try {
      await markLetterEmailed(request.letterId, to);
    } catch {
      return { ok: true, message: `Emailed to ${to}. It could not be noted on the letter; the email log has it.` };
    }
  }
  return { ok: true, message: `Emailed to ${to}.` };
}
