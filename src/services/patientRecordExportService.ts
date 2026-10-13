/**
 * One patient's full record, exported from the patient file (parity C17): a summary PDF (details, alerts, visits with
 * their notes and diagnoses, medicines, results, letters, notes, invoices and payments) and, in a ZIP with it, the
 * patient's stored documents from the private records bucket.
 *
 * Everything is read with the signed-in person's own rights, so the export holds exactly what they may see on the file
 * (row level security: only their practice's patients, only the kinds of note their role reads). Private notes of other
 * practitioners are never read; the exporter's own are added only when they ask. Parts that cannot be read (a table
 * not set up, a failed query) are named in the summary instead of stopping the export.
 *
 * Each export is offered to the record-access log (proposals/2026-10-13-access-log.sql): see logRecordExport.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingColumnError } from '../utils/diary/dbErrors';
import { storedFileTarget } from './recordPaths';
import { loadLetterhead } from '../components/quotes/quoteService';
import { loadPatientSafety } from './patientSafetyService';
import { listLetters, listSickNotes } from './patientLettersService';
import { listConsents } from './patientConsentsService';
import { loadPatientNotes } from './patientNotesService';
import { loadPrivateNotes } from './privateNotesService';
import { loadPracticeStaff } from './invoiceContextService';
import { loadPatientBalances, loadPatientReceipts } from '../components/finance/receipts/arService';
import { toPatientInvoice, type PatientInvoiceRecord } from '../components/patients/patientBilling';
import { allergyDescription } from '../components/patients/safety/safetyFormat';
import { NOTE_TYPE_LABELS } from '../components/patients/notes/patientNotes';
import { renderRecordSummaryPdf } from '../components/patients/export/recordSummaryPdf';
import { PAYER_LABELS, RECEIPT_METHOD_LABELS } from './ledger/arModel';
import { practiceLinesOf } from '../utils/clinical/letters';
import { signedAtText, signerRoleLine } from '../utils/clinical/consent';
import { formalPatientName } from '../utils/patients/patientName';
import { isTemporaryIdNumber, patientFileStatus } from '../utils/patients/temporaryPatient';
import { ageOn, windhoekClock } from '../utils/patientLists/listDates';
import { formatServiceDate, toDateKey } from '../utils/billing/dates';
import { EXCLUDE_CARRIER_VISITS } from '../utils/carrierVisits';
import { zipStore, type ZipEntry } from '../utils/export/zipStore';
import {
  aboutSection,
  documentZipPaths,
  documentsSection,
  recordExportBase,
  recordSections,
  type DocumentOutcome,
  type PatientRecord,
  type RecordDocument,
  type RecordNote,
  type RecordSection
} from '../utils/export/patientRecord';

// The generated database types do not include several of these tables and columns yet
const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;

/**
 * Largest export: more is listed in the summary as not added (it can still be opened on the file). The ZIP is built in
 * the browser's memory, the documents and the archive at once, so a tablet stays within about 300 MB.
 */
export const MAX_EXPORT_BYTES = 150 * 1024 * 1024;
export const MAX_EXPORT_DOCUMENTS = 1000;
const DOWNLOADS_AT_ONCE = 3;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const nameOf = (value: unknown): string | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? text((row as Row).full_name) : null;
};
const humanize = (value: string | null): string | null => (value ? value.replace(/[_-]+/g, ' ').replace(/^\w/, letter => letter.toUpperCase()) : null);

async function rowsOf(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Row[];
}

/** Runs a query per chunk of ids (PostgREST keeps "in" lists short) and joins the rows. */
async function rowsByIds(ids: readonly string[], run: (chunk: string[]) => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  const all: Row[] = [];
  for (let start = 0; start < ids.length; start += 100) all.push(...(await rowsOf(run(ids.slice(start, start + 100)))));
  return all;
}

export interface ExportProgress {
  stage: 'reading' | 'documents' | 'packing';
  done: number;
  total: number;
}

export interface LoadedRecord {
  record: PatientRecord;
  practice: { name: string; lines: string[]; primaryColor: string };
  exportedBy: string;
  /** Windhoek date, yyyy-MM-dd */
  dateKey: string;
  exportedAt: string;
}

const PATIENT_COLUMNS =
  'id, first_name, last_name, title, initials, id_number, date_of_birth, gender, cell_number, email, home_address, postal_address, ' +
  'postal_code, occupation, employer, home_language, marital_status, system_patient_reference_number, legacy_account_number';

const vitalsLine = (row: Row): string | null => {
  const parts = [
    text(row.blood_pressure) ? `BP ${text(row.blood_pressure)}` : null,
    row.pulse_rate != null ? `pulse ${row.pulse_rate}` : null,
    row.temperature != null ? `temperature ${row.temperature} C` : null,
    row.respiratory_rate != null ? `breathing ${row.respiratory_rate}/min` : null,
    row.oxygen_saturation != null ? `oxygen ${row.oxygen_saturation}%` : null,
    row.weight != null ? `weight ${row.weight} kg` : null,
    row.height != null ? `height ${row.height} cm` : null,
    row.bmi != null ? `BMI ${row.bmi}` : null
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

/** Reads everything the summary shows, with the signed-in person's rights. */
export async function loadPatientRecord(options: {
  practiceId: string;
  patientId: string;
  userId: string;
  includeMyPrivateNotes: boolean;
}): Promise<LoadedRecord> {
  const { practiceId, patientId, userId } = options;
  const now = new Date();
  const dateKey = windhoekClock(now).dateKey;
  const unavailable: string[] = [];
  const optional = async <T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await run();
    } catch {
      unavailable.push(label);
      return fallback;
    }
  };

  // The file itself must be read: without it there is nothing to export
  let patientQuery = await db.from('patients').select(`${PATIENT_COLUMNS}, pregnancy_due_date`).eq('id', patientId).eq('practice_id', practiceId).maybeSingle();
  if (patientQuery.error && isMissingColumnError(patientQuery.error)) {
    patientQuery = await db.from('patients').select(PATIENT_COLUMNS).eq('id', patientId).eq('practice_id', practiceId).maybeSingle();
  }
  if (patientQuery.error) throw new Error(`Could not read the patient's file: ${patientQuery.error.message}`);
  if (!patientQuery.data) throw new Error("This patient is not on your practice's files.");
  const patientRow = patientQuery.data as Row;

  const [letterhead, staff] = await Promise.all([
    loadLetterhead(practiceId),
    loadPracticeStaff(practiceId).catch(() => [])
  ]);
  const staffName = new Map(staff.map(member => [member.id, text(member.full_name)]));

  const [medicalAids, nextOfKin, safety, visits, medicines, labRequests, imaging, letters, sickNotes, consents, notes, privateNotes, invoicesData, documents] =
    await Promise.all([
      optional('Medical aid', () => rowsOf(db.from('medical_aid_details').select('provider, scheme, plan_type, membership_number, dependant_code, main_member_name, main_member_id_number, relationship_to_main').eq('patient_id', patientId)), []),
      optional('Next of kin', () => rowsOf(db.from('next_of_kin').select('name, relationship, phone, address').eq('patient_id', patientId)), []),
      optional('Allergies, alerts and problems', () => loadPatientSafety(patientId), null),
      optional('Visits', () => loadVisits(practiceId, patientId), []),
      optional('Medicines', () => rowsOf(db.from('medications').select('medication_name, dosage, frequency, duration, instructions, status, prescribed_date, created_at').eq('patient_id', patientId).order('created_at', { ascending: false })), []),
      optional('Laboratory', () => rowsOf(db.from('lab_requests').select('id, request_date, lab_facility, status, notes, media_url, created_at, lab_results(test_name, test_value, test_unit, reference_range, status, created_at)').eq('patient_id', patientId).order('request_date', { ascending: false })), []),
      optional('Imaging', () => rowsOf(db.from('imaging_requests').select('request_date, imaging_type, body_part, status, report_text, radiologist_name, completed_date').eq('patient_id', patientId).order('request_date', { ascending: false })), []),
      optional('Letters', () => listLetters(patientId), []),
      optional('Sick notes', () => listSickNotes(patientId), []),
      optional('Consent forms', () => listConsents(patientId), []),
      optional('Notes on the file', () => loadPatientNotes(patientId), []),
      options.includeMyPrivateNotes ? optional('My private notes', () => loadPrivateNotes(patientId, userId), []) : Promise.resolve(null),
      optional('Invoices and payments', () => loadMoney(practiceId, patientId), { invoices: [], payments: [] }),
      loadDocuments(patientId, unavailable)
    ]);

  const status = patientFileStatus({ id_number: text(patientRow.id_number), date_of_birth: text(patientRow.date_of_birth), gender: text(patientRow.gender) });
  const name = [text(patientRow.first_name), text(patientRow.last_name)].filter(Boolean).join(' ') || 'Patient';
  const idNumber = text(patientRow.id_number);

  const labResults = labRequests.flatMap(request =>
    (Array.isArray(request.lab_results) ? (request.lab_results as Row[]) : []).map(result => ({
      date: text(request.request_date) ?? text(result.created_at),
      test: text(result.test_name) ?? 'Test',
      value: text(result.test_value) ?? '',
      unit: text(result.test_unit),
      range: text(result.reference_range),
      status: text(result.status)
    }))
  );

  const noteOf = (note: { createdAt: string; header?: string | null; body: string; createdBy?: string | null; addenda?: Array<{ createdAt: string; body: string }> }, kind: string): RecordNote => ({
    date: note.createdAt,
    kind,
    header: note.header ?? null,
    body: note.body,
    author: note.createdBy ? staffName.get(note.createdBy) ?? 'A former staff member' : null,
    addenda: (note.addenda ?? []).map(addendum => ({ date: addendum.createdAt, body: addendum.body }))
  });

  const record: PatientRecord = {
    patient: {
      name,
      formalName: formalPatientName({ title: text(patientRow.title), initials: text(patientRow.initials), first_name: text(patientRow.first_name), last_name: text(patientRow.last_name) }),
      idNumber: idNumber && !isTemporaryIdNumber(idNumber) ? idNumber : null,
      dateOfBirth: status.dateOfBirth,
      age: status.dateOfBirth ? ageOn(status.dateOfBirth, dateKey) : null,
      gender: humanize(status.gender),
      fileNumber: patientRow.system_patient_reference_number != null ? String(patientRow.system_patient_reference_number) : null,
      oldFileNumber: text(patientRow.legacy_account_number),
      cellNumber: text(patientRow.cell_number),
      email: text(patientRow.email),
      homeAddress: text(patientRow.home_address),
      postalAddress: [text(patientRow.postal_address), text(patientRow.postal_code)].filter(Boolean).join(' ') || null,
      occupation: text(patientRow.occupation),
      employer: text(patientRow.employer),
      homeLanguage: text(patientRow.home_language),
      maritalStatus: humanize(text(patientRow.marital_status)),
      pregnancyDueDate: toDateKey(text(patientRow.pregnancy_due_date))
    },
    medicalAids: medicalAids.map(aid => ({
      fund: text(aid.provider),
      option: [text(aid.scheme), text(aid.plan_type)].filter(Boolean).join(', ') || null,
      memberNumber: text(aid.membership_number),
      dependantCode: text(aid.dependant_code),
      mainMember: text(aid.main_member_name),
      mainMemberId: text(aid.main_member_id_number),
      relationship: humanize(text(aid.relationship_to_main))
    })),
    nextOfKin: nextOfKin.map(kin => ({ name: text(kin.name) ?? '', relationship: text(kin.relationship), phone: text(kin.phone), address: text(kin.address) })),
    alerts: {
      allergies: safety ? safety.allergies.map(allergyDescription) : null,
      noKnownAllergies: safety?.profile?.noKnownAllergies === true,
      alertNote: safety?.profile?.alertNote ?? null,
      activeProblems: (safety?.problems ?? []).filter(problem => problem.status === 'active').map(problem => (problem.icd10Code ? `${problem.description} (${problem.icd10Code})` : problem.description)),
      pastProblems: (safety?.problems ?? []).filter(problem => problem.status !== 'active').map(problem => (problem.icd10Code ? `${problem.description} (${problem.icd10Code})` : problem.description))
    },
    visits,
    medicines: medicines.map(row => ({
      date: text(row.prescribed_date) ?? text(row.created_at),
      name: text(row.medication_name) ?? 'Medicine',
      dose: text(row.dosage),
      frequency: text(row.frequency),
      duration: text(row.duration),
      instructions: text(row.instructions),
      status: humanize(text(row.status))
    })),
    labRequests: labRequests
      .filter(request => !Array.isArray(request.lab_results) || request.lab_results.length === 0)
      .map(request => ({ date: text(request.request_date), laboratory: text(request.lab_facility), status: humanize(text(request.status)), notes: text(request.notes) })),
    labResults,
    imaging: imaging.map(row => ({
      date: text(row.completed_date) ?? text(row.request_date),
      study: [humanize(text(row.imaging_type)), text(row.body_part)].filter(Boolean).join(', ') || 'Imaging',
      status: humanize(text(row.status)),
      report: [text(row.report_text), text(row.radiologist_name) ? `(${text(row.radiologist_name)})` : null].filter(Boolean).join(' ') || null
    })),
    letters: [
      ...letters.map(letter => ({ date: letter.letterDate, title: letter.title, details: [letter.recipientName ? `to ${letter.recipientName}` : null, letter.authorName].filter(Boolean).join(', ') || null })),
      ...sickNotes.map(note => ({
        date: note.issueDate ?? note.fromDate,
        title: `Sick note${note.formNumber ? ` no ${note.formNumber}` : ''}`,
        details: note.toDate && note.toDate !== note.fromDate ? `${formatServiceDate(note.fromDate)} to ${formatServiceDate(note.toDate)}` : formatServiceDate(note.fromDate)
      })),
      ...consents.map(consent => ({
        date: consent.signedAt,
        title: consent.title,
        details: `Signed by ${consent.signerName} (${signerRoleLine(consent.signedBy, name).toLowerCase()})${consent.obtainedByName ? `, witness ${consent.obtainedByName}` : ''}`
      }))
    ].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
    notes: notes.map(note => noteOf(note, NOTE_TYPE_LABELS[note.type])),
    privateNotes: privateNotes ? privateNotes.map(note => noteOf({ ...note, createdBy: userId }, 'Private')) : null,
    invoices: invoicesData.invoices,
    payments: invoicesData.payments,
    documents,
    unavailable
  };

  const exportedBy = staffName.get(userId) ?? 'A staff member';
  return {
    record,
    practice: {
      name: letterhead.name,
      lines: practiceLinesOf(letterhead),
      primaryColor: letterhead.primaryColor ?? '#01b9d4'
    },
    exportedBy,
    dateKey,
    exportedAt: signedAtText(now)
  };
}

async function loadVisits(practiceId: string, patientId: string): Promise<PatientRecord['visits']> {
  const visits = await rowsOf(
    db
      .from('visits')
      .select('id, visit_date, visit_time, visit_type, status, chief_complaint, diagnosis, treatment_plan, prescription, notes, doctor:users!visits_doctor_id_fkey(full_name)')
      .eq('patient_id', patientId)
      .eq('practice_id', practiceId)
      // A row that only carries invoices is not a visit; its invoices are under Invoices and payments
      .or(EXCLUDE_CARRIER_VISITS)
      .order('visit_date', { ascending: false, nullsFirst: false })
  );
  const ids = visits.map(visit => String(visit.id));
  const [vitals, invoices] = await Promise.all([
    rowsByIds(ids, chunk => db.from('vitals').select('visit_id, blood_pressure, temperature, pulse_rate, respiratory_rate, weight, height, bmi, oxygen_saturation, created_at').in('visit_id', chunk)).catch(() => [] as Row[]),
    rowsByIds(ids, chunk => db.from('invoices_enhanced').select('id, visit_id').in('visit_id', chunk)).catch(() => [] as Row[])
  ]);
  const visitOfInvoice = new Map(invoices.map(invoice => [String(invoice.id), String(invoice.visit_id)]));
  const lines = await rowsByIds([...visitOfInvoice.keys()], chunk => db.from('invoice_services').select('invoice_id, icd10_primary, icd10_secondary').in('invoice_id', chunk)).catch(() => [] as Row[]);
  const codes = new Map<string, Set<string>>();
  for (const line of lines) {
    const visitId = visitOfInvoice.get(String(line.invoice_id));
    if (!visitId) continue;
    const set = codes.get(visitId) ?? new Set<string>();
    for (const code of [line.icd10_primary, ...(Array.isArray(line.icd10_secondary) ? line.icd10_secondary : [])]) {
      if (typeof code === 'string' && code.trim()) set.add(code.trim().toUpperCase());
    }
    codes.set(visitId, set);
  }
  const vitalsOf = new Map<string, string>();
  for (const row of vitals) {
    const line = vitalsLine(row);
    if (line && !vitalsOf.has(String(row.visit_id))) vitalsOf.set(String(row.visit_id), line);
  }
  return visits.map(visit => ({
    date: text(visit.visit_date),
    time: text(visit.visit_time),
    type: humanize(text(visit.visit_type)),
    status: humanize(text(visit.status)),
    practitioner: nameOf(visit.doctor),
    complaint: text(visit.chief_complaint),
    diagnosis: text(visit.diagnosis),
    icd10: [...(codes.get(String(visit.id)) ?? [])],
    treatmentPlan: text(visit.treatment_plan),
    notes: text(visit.notes),
    prescription: text(visit.prescription),
    vitals: vitalsOf.get(String(visit.id)) ?? null
  }));
}

const INVOICE_COLUMNS = 'id, invoice_number, visit_id, practice_id, issue_date, due_date, created_at, total, medical_aid_total, patient_total, payment_status, payment_method';
const INVOICE_STATUS_LABELS: Readonly<Record<string, string>> = { paid: 'Paid', pending: 'Owing', overdue: 'Overdue', cancelled: 'Cancelled' };

async function loadMoney(practiceId: string, patientId: string): Promise<Pick<PatientRecord, 'invoices' | 'payments'>> {
  const [rows, ledger, receipts] = await Promise.all([
    rowsOf(db.from('invoices_enhanced').select(INVOICE_COLUMNS).eq('patient_id', patientId).eq('practice_id', practiceId).order('issue_date', { ascending: false, nullsFirst: false })),
    loadPatientBalances(patientId, practiceId).catch(() => null),
    loadPatientReceipts(patientId, practiceId).catch(() => null)
  ]);
  const balances = ledger?.state === 'ready' ? ledger.balances : null;
  return {
    invoices: (rows as unknown as PatientInvoiceRecord[]).map(toPatientInvoice).map(invoice => {
      const balance = balances?.[invoice.id];
      return {
        date: invoice.date,
        number: invoice.invoiceNumber,
        total: invoice.total,
        medicalAid: invoice.medicalAidPortion,
        patient: invoice.patientPortion,
        paid: balance ? (balance.allocated.medical_aid + balance.allocated.patient) / 100 : null,
        status: invoice.partPaid ? 'Part paid' : INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status
      };
    }),
    payments: (receipts?.state === 'ready' ? receipts.receipts : []).map(receipt => ({
      date: receipt.receivedOn,
      number: receipt.number,
      payer: receipt.payerType === 'medical_aid' && receipt.fundName ? receipt.fundName : receipt.payerName ?? PAYER_LABELS[receipt.payerType],
      method: RECEIPT_METHOD_LABELS[receipt.method] ?? null,
      amount: receipt.amountCents / 100,
      reversed: receipt.reversal !== null
    }))
  };
}

/** The patient's stored files, oldest first; a table that cannot be read is named and skipped. */
async function loadDocuments(patientId: string, unavailable: string[]): Promise<RecordDocument[]> {
  const read = async (label: string, run: () => Promise<RecordDocument[]>): Promise<RecordDocument[]> => {
    try {
      return await run();
    } catch {
      unavailable.push(label);
      return [];
    }
  };
  const fileRows = (table: string, columns: string) => rowsOf(db.from(table).select(columns).eq('patient_id', patientId));
  const groups = await Promise.all([
    read('Photos and scans', async () =>
      (await fileRows('patient_media', 'title, original_name, file_name, storage_path, storage_bucket, category, subcategory, mime_type, uploaded_at, created_at')).map(row => ({
        kind: humanize(text(row.subcategory) ?? text(row.category)) ?? 'Media',
        label: text(row.title) ?? text(row.original_name) ?? text(row.file_name) ?? 'file',
        date: text(row.uploaded_at) ?? text(row.created_at),
        ref: String(row.storage_path ?? ''),
        bucket: text(row.storage_bucket),
        mimeType: text(row.mime_type)
      }))
    ),
    read('Patient documents', async () =>
      (await fileRows('patient_documents', 'original_name, file_name, storage_path, category, mime_type, created_at')).map(row => ({
        kind: humanize(text(row.category)) ?? 'Document',
        label: text(row.original_name) ?? text(row.file_name) ?? 'file',
        date: text(row.created_at),
        ref: String(row.storage_path ?? ''),
        bucket: null,
        mimeType: text(row.mime_type)
      }))
    ),
    read('Laboratory files', async () =>
      (await fileRows('patient_laboratory', 'title, original_name, test_name, storage_path, storage_bucket, mime_type, test_date, created_at')).map(row => ({
        kind: 'Lab result',
        label: text(row.title) ?? text(row.test_name) ?? text(row.original_name) ?? 'file',
        date: text(row.test_date) ?? text(row.created_at),
        ref: String(row.storage_path ?? ''),
        bucket: text(row.storage_bucket),
        mimeType: text(row.mime_type)
      }))
    ),
    read('Imaging files', async () =>
      (await fileRows('patient_imaging', 'title, original_name, imaging_type, storage_path, storage_bucket, mime_type, study_date, created_at')).map(row => ({
        kind: 'Imaging',
        label: text(row.title) ?? humanize(text(row.imaging_type)) ?? text(row.original_name) ?? 'file',
        date: text(row.study_date) ?? text(row.created_at),
        ref: String(row.storage_path ?? ''),
        bucket: text(row.storage_bucket),
        mimeType: text(row.mime_type)
      }))
    ),
    read('Visit documents', async () =>
      (await fileRows('visit_documents', 'document_type, document_name, file_path, storage_bucket, file_type, generated_at, created_at')).map(row => ({
        kind: humanize(text(row.document_type)) ?? 'Visit document',
        label: text(row.document_name) ?? 'file',
        date: text(row.generated_at) ?? text(row.created_at),
        ref: String(row.file_path ?? ''),
        bucket: text(row.storage_bucket),
        mimeType: text(row.file_type)
      }))
    ),
    read('Laboratory request files', async () =>
      (await fileRows('lab_requests', 'request_date, lab_facility, media_url, media_type, created_at')).flatMap(row =>
        text(row.media_url)
          ? [{ kind: 'Lab request', label: text(row.lab_facility) ?? 'Laboratory', date: text(row.request_date) ?? text(row.created_at), ref: String(row.media_url), bucket: null, mimeType: text(row.media_type) }]
          : []
      )
    ),
    read('Referral letters received', async () =>
      (await rowsOf(db.from('patient_referrals').select('referral_date, referring_name, letter_path, letter_name, removed_at').eq('patient_id', patientId).is('removed_at', null))).flatMap(row =>
        text(row.letter_path)
          ? [{ kind: 'Referral letter', label: text(row.letter_name) ?? `From ${text(row.referring_name) ?? 'a practitioner'}`, date: text(row.referral_date), ref: String(row.letter_path), bucket: 'records', mimeType: null }]
          : []
      )
    ),
    read('Signed consent forms', async () =>
      (await listConsents(patientId)).map(consent => ({ kind: 'Consent form', label: consent.title, date: consent.signedAt, ref: consent.filePath, bucket: 'records', mimeType: 'application/pdf' }))
    )
  ]);
  return groups
    .flat()
    .filter(document => document.ref.trim() !== '')
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
}

/** One stored file's bytes: from the bucket with the person's own rights, or a link saved before the records moved. */
async function fetchDocument(document: RecordDocument): Promise<Uint8Array> {
  const target = storedFileTarget(document.ref, document.bucket);
  if ('link' in target) {
    const response = await fetch(target.link);
    if (!response.ok) throw new Error(`The file could not be fetched (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }
  const { data, error } = await supabase.storage.from(target.bucket).download(target.path);
  if (error || !data) throw error ?? new Error('The file is missing.');
  return new Uint8Array(await data.arrayBuffer());
}

/** Saves bytes as a file in the browser's downloads. */
export function downloadBytes(bytes: Uint8Array, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Hook into the record-access log (proposals/2026-10-13-access-log.sql, src/services/recordAccessLog.ts). That log
 * knows a file opened, a sign-in and a sign-out; an export is offered as event 'record_exported' from the patient file
 * and is recorded once the log accepts that event (until then the database refuses it and nothing is recorded). Never
 * waits, never stops or slows the export.
 */
export function logRecordExport(patientId: string): void {
  void Promise.resolve(db.rpc('log_record_access', { p_event: 'record_exported', p_patient_id: patientId, p_screen: 'patient_file' })).catch(
    () => undefined
  );
}

export interface RecordExportResult {
  fileName: string;
  documentsAdded: number;
  documentsMissing: number;
}

function summaryPdf(loaded: LoadedRecord, outcomes: readonly DocumentOutcome[] | null): Uint8Array {
  const sections: RecordSection[] = [
    ...recordSections(loaded.record),
    documentsSection(loaded.record.documents, outcomes),
    aboutSection({ exportedBy: loaded.exportedBy, exportedAt: loaded.exportedAt, practiceName: loaded.practice.name }, loaded.record.unavailable)
  ];
  const pdf = renderRecordSummaryPdf(
    {
      practiceName: loaded.practice.name,
      practiceLines: loaded.practice.lines,
      primaryColor: loaded.practice.primaryColor,
      patientName: loaded.record.patient.name,
      madeLine: `Made ${loaded.exportedAt} by ${loaded.exportedBy}`
    },
    sections
  );
  return new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer);
}

/** The summary PDF only (no documents), saved to downloads. */
export async function exportRecordSummary(options: { practiceId: string; patientId: string; userId: string; includeMyPrivateNotes: boolean }): Promise<RecordExportResult> {
  const loaded = await loadPatientRecord(options);
  const fileName = `${recordExportBase(loaded.record.patient.name, loaded.dateKey)}.pdf`;
  downloadBytes(summaryPdf(loaded, null), fileName, 'application/pdf');
  logRecordExport(options.patientId);
  return { fileName, documentsAdded: 0, documentsMissing: 0 };
}

/** The summary PDF and every stored document in one ZIP, saved to downloads. */
export async function exportRecordZip(options: {
  practiceId: string;
  patientId: string;
  userId: string;
  includeMyPrivateNotes: boolean;
  onProgress?: (progress: ExportProgress) => void;
}): Promise<RecordExportResult> {
  options.onProgress?.({ stage: 'reading', done: 0, total: 0 });
  const loaded = await loadPatientRecord(options);
  const base = recordExportBase(loaded.record.patient.name, loaded.dateKey);
  const documents = loaded.record.documents;
  const paths = documentZipPaths(base, documents);
  const outcomes: DocumentOutcome[] = documents.map(() => ({ path: null, problem: 'Not added' }));
  const files: Array<ZipEntry | null> = documents.map(() => null);
  let bytes = 0;
  let next = 0;
  let done = 0;
  options.onProgress?.({ stage: 'documents', done: 0, total: documents.length });

  const worker = async () => {
    while (next < documents.length) {
      const index = next;
      next += 1;
      if (index >= MAX_EXPORT_DOCUMENTS) {
        outcomes[index] = { path: null, problem: 'Not added: too many documents for one export; open it on the file' };
      } else {
        try {
          const data = await fetchDocument(documents[index]);
          if (bytes + data.byteLength > MAX_EXPORT_BYTES) {
            outcomes[index] = { path: null, problem: 'Not added: the export would be too large; open it on the file' };
          } else {
            bytes += data.byteLength;
            const stored = new Date(documents[index].date ?? '');
            files[index] = { name: paths[index], data, modified: Number.isNaN(stored.getTime()) ? undefined : stored };
            outcomes[index] = { path: paths[index], problem: null };
          }
        } catch {
          outcomes[index] = { path: null, problem: 'Could not be fetched (it may have been removed)' };
        }
      }
      done += 1;
      options.onProgress?.({ stage: 'documents', done, total: documents.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOWNLOADS_AT_ONCE, documents.length) }, worker));

  options.onProgress?.({ stage: 'packing', done: 0, total: 1 });
  const entries: ZipEntry[] = [
    { name: `${base}/${base}.pdf`, data: summaryPdf(loaded, outcomes) },
    ...files.filter((file): file is ZipEntry => file !== null)
  ];
  const fileName = `${base}.zip`;
  downloadBytes(zipStore(entries), fileName, 'application/zip');
  logRecordExport(options.patientId);
  const added = outcomes.filter(outcome => outcome.path).length;
  return { fileName, documentsAdded: added, documentsMissing: documents.length - added };
}
