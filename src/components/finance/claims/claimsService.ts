/**
 * Data access for the claims module. Reads are scoped to one practice; every query checks its
 * error and throws a readable message instead of continuing with partial data.
 *
 * Writes (saving ICD-10 codes on batch lines, adding invoices to a batch, recording a submission)
 * only run when staff press the matching button and confirm.
 * Submission goes through communicationService (centralized email gateway); nothing is sent
 * automatically.
 */
import { supabase } from '../../../lib/supabase';
import { communicationService } from '../../../services/communicationService';
import { formatNad } from '../../../utils/billing/money';
import { parseYesNo } from '../../../utils/billing/pricing';
import type { ClaimFile } from '../../../utils/billing/claimFile';
import type {
  BatchDetailRow,
  BatchHeaderRow,
  BatchLineSources,
  BatchSubmissionRow,
  DoctorRow,
  FundProvider,
  InvoiceServiceRow,
  PatientRow,
  PracticeInfo,
  RemoveInvoiceResult,
  SubmitBatchResult,
  UnbatchedInvoice,
  VisitRow
} from './types';
import { planHeaderTotals, type DetailAmountRow, type StoredTotals } from './batchTotals';
import { isOpenBatch } from './status';

// Defined in the dependency-free status.ts and re-exported here (other modules import them from here)
export { OPEN_BATCH_STATUSES, isOpenBatch } from './status';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IN_CHUNK_SIZE = 100;

const fail = (what: string, error: { message: string } | null): never => {
  throw new Error(`Could not load ${what}: ${error?.message ?? 'unknown error'}`);
};

const unique = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

/** Runs an `.in()` query in chunks so long id lists do not exceed URL limits. */
async function inChunks<T>(
  ids: string[],
  what: string,
  query: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; start < ids.length; start += IN_CHUNK_SIZE) {
    const { data, error } = await query(ids.slice(start, start + IN_CHUNK_SIZE));
    if (error) fail(what, error);
    rows.push(...(data ?? []));
  }
  return rows;
}

export async function loadPracticeInfo(practiceId: string): Promise<PracticeInfo> {
  if (!UUID_PATTERN.test(practiceId)) throw new Error('No valid practice is selected.');
  const { data, error } = await supabase
    .from('practices')
    .select('id, name, practice_number, practice_type, contact_email')
    .eq('id', practiceId)
    .maybeSingle();
  if (error) fail('the practice', error);
  if (!data) throw new Error('The selected practice was not found.');
  return data as PracticeInfo;
}

export async function loadFunds(): Promise<FundProvider[]> {
  const { data, error } = await supabase
    .from('medical_aid_providers')
    .select('id, name, short_name, email, medical_aid_reference, logo_url, theme_color')
    .order('name');
  if (error) fail('the medical aid funds', error);
  return (data ?? []) as FundProvider[];
}

const BATCH_COLUMNS =
  'id, practice_id, practice_number, batch_number, batch_date, medical_aid_reference, status, total_amount, total_invoices, generated_file_content, recipient_email, sent_at, confirmed_at, created_at, transaction_type, source_software, source_software_version, system_identification';

/** The practice's batches, newest first. Older batches may only carry the practice number. */
export async function loadBatches(practice: PracticeInfo): Promise<BatchHeaderRow[]> {
  const practiceNumber = (practice.practice_number ?? '').trim();
  const query = supabase.from('batch_headers').select(BATCH_COLUMNS);
  const scoped = /^\d+$/.test(practiceNumber)
    ? query.or(`practice_id.eq.${practice.id},practice_number.eq.${practiceNumber}`)
    : query.eq('practice_id', practice.id);
  const { data, error } = await scoped
    .order('batch_date', { ascending: false })
    .order('batch_number', { ascending: false })
    .limit(300);
  if (error) fail('the claim batches', error);
  return (data ?? []) as unknown as BatchHeaderRow[];
}

export async function loadSubmissions(batchIds: string[]): Promise<BatchSubmissionRow[]> {
  return inChunks<BatchSubmissionRow>(unique(batchIds), 'the submission history', chunk =>
    supabase
      .from('batch_submissions')
      .select('id, batch_header_id, status, recipient_email, file_name, submitted_at, sent_at, email_id, error_details, total_amount, total_claims')
      .in('batch_header_id', chunk)
      .order('submitted_at', { ascending: false }) as unknown as PromiseLike<{ data: BatchSubmissionRow[] | null; error: { message: string } | null }>
  );
}

/** Loads a batch's lines and the patient, visit, doctor, invoice and tariff records they need. */
export async function loadBatchLineSources(batch: BatchHeaderRow, practice: PracticeInfo): Promise<BatchLineSources> {
  const { data: detailData, error: detailError } = await supabase
    .from('batch_details')
    .select('*')
    .eq('batch_header_id', batch.id)
    .order('transaction_number_in_batch', { ascending: true });
  if (detailError) fail('the batch lines', detailError);
  const details = (detailData ?? []) as unknown as BatchDetailRow[];
  const warnings: string[] = [];

  const patients = await inChunks<PatientRow>(unique(details.map(d => d.patient_id)), 'the patients', chunk =>
    supabase
      .from('patients')
      .select('id, first_name, last_name, date_of_birth, id_number, gender, system_patient_reference_number')
      .in('id', chunk) as unknown as PromiseLike<{ data: PatientRow[] | null; error: { message: string } | null }>
  );
  const visits = await inChunks<VisitRow>(unique(details.map(d => d.visit_id)), 'the visits', chunk =>
    supabase
      .from('visits')
      .select('id, visit_date, doctor_id, diagnosis')
      .in('id', chunk) as unknown as PromiseLike<{ data: VisitRow[] | null; error: { message: string } | null }>
  );
  const doctors = await inChunks<DoctorRow>(unique(visits.map(v => v.doctor_id)), 'the treating doctors', chunk =>
    supabase
      .from('users')
      .select('id, full_name, hpcsa_number')
      .in('id', chunk) as unknown as PromiseLike<{ data: DoctorRow[] | null; error: { message: string } | null }>
  );
  const invoiceServices = await inChunks<InvoiceServiceRow>(unique(details.map(d => d.invoice_id)), 'the invoice lines', chunk =>
    supabase
      .from('invoice_services')
      .select('id, invoice_id, code, unit_price, quantity, total_price, tooth_number, system_transaction_number')
      .in('invoice_id', chunk) as unknown as PromiseLike<{ data: InvoiceServiceRow[] | null; error: { message: string } | null }>
  );

  const requiresToothByCode = new Map<string, boolean>();
  if (practice.practice_type) {
    const { data: tariffs, error: tariffError } = await supabase
      .from('practice_tariffs_with_types')
      .select('code, requires_tooth_number')
      .eq('practice_type_name', practice.practice_type);
    if (tariffError) {
      warnings.push(`The tariff list could not be read (${tariffError.message}), so tooth numbers were not checked.`);
    } else {
      (tariffs ?? []).forEach(row => {
        if (row.code) requiresToothByCode.set(row.code.trim(), parseYesNo(row.requires_tooth_number));
      });
    }
  } else {
    warnings.push('The practice type is not set, so tooth numbers were not checked.');
  }

  return {
    details,
    patients: new Map(patients.map(row => [row.id, row])),
    visits: new Map(visits.map(row => [row.id, row])),
    doctors: new Map(doctors.map(row => [row.id, row])),
    invoiceServices,
    requiresToothByCode,
    warnings
  };
}

/** Fund for a patient's medical aid record: by provider id, then by provider name. */
const findFund = (
  funds: readonly FundProvider[],
  providerId: string | null,
  providerName: string | null
): FundProvider | undefined => {
  if (providerId) {
    const byId = funds.find(fund => fund.id === providerId);
    if (byId) return byId;
  }
  const name = (providerName ?? '').trim().toLowerCase();
  if (!name) return undefined;
  return funds.find(fund => fund.name.trim().toLowerCase() === name || (fund.short_name ?? '').trim().toLowerCase() === name);
};

/**
 * Billed invoices of medical aid patients (last 12 months) that are in no batch yet: the database
 * normally batches them automatically, so anything listed here was missed and would never be claimed.
 */
export async function loadUnbatchedInvoices(practiceId: string, funds: readonly FundProvider[], since: string): Promise<UnbatchedInvoice[]> {
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices_enhanced')
    .select('id, invoice_number, issue_date, visit_id, patient_id, total, payment_status')
    .eq('practice_id', practiceId)
    .is('batch_id', null)
    .gte('issue_date', since)
    .order('issue_date', { ascending: false })
    .limit(500);
  if (invoiceError) fail('the unbatched invoices', invoiceError);
  const invoices = (invoiceData ?? []).filter(invoice => (invoice.payment_status ?? '').toLowerCase() !== 'cancelled');
  if (invoices.length === 0) return [];

  const patientIds = unique(invoices.map(invoice => invoice.patient_id));
  type MedicalAidRow = { patient_id: string | null; medical_aid_provider_id: string | null; provider: string | null };
  const medicalAid = await inChunks<MedicalAidRow>(patientIds, 'the patients medical aid details', chunk =>
    supabase
      .from('medical_aid_details')
      .select('patient_id, medical_aid_provider_id, provider')
      .in('patient_id', chunk) as unknown as PromiseLike<{ data: MedicalAidRow[] | null; error: { message: string } | null }>
  );
  const medicalAidByPatient = new Map(medicalAid.map(row => [row.patient_id ?? '', row]));
  const withMedicalAid = invoices.filter(invoice => medicalAidByPatient.has(invoice.patient_id));
  if (withMedicalAid.length === 0) return [];

  const patients = await inChunks<PatientRow>(unique(withMedicalAid.map(i => i.patient_id)), 'the patients', chunk =>
    supabase
      .from('patients')
      .select('id, first_name, last_name, date_of_birth, id_number, gender, system_patient_reference_number')
      .in('id', chunk) as unknown as PromiseLike<{ data: PatientRow[] | null; error: { message: string } | null }>
  );
  const visits = await inChunks<VisitRow>(unique(withMedicalAid.map(i => i.visit_id)), 'the visits', chunk =>
    supabase
      .from('visits')
      .select('id, visit_date, doctor_id, diagnosis')
      .in('id', chunk) as unknown as PromiseLike<{ data: VisitRow[] | null; error: { message: string } | null }>
  );
  type LineCountRow = { invoice_id: string };
  const lines = await inChunks<LineCountRow>(withMedicalAid.map(i => i.id), 'the invoice lines', chunk =>
    supabase.from('invoice_services').select('invoice_id').in('invoice_id', chunk) as unknown as PromiseLike<{
      data: LineCountRow[] | null;
      error: { message: string } | null;
    }>
  );
  const patientById = new Map(patients.map(row => [row.id, row]));
  const visitById = new Map(visits.map(row => [row.id, row]));
  const lineCount = lines.reduce<Map<string, number>>((counts, row) => counts.set(row.invoice_id, (counts.get(row.invoice_id) ?? 0) + 1), new Map());

  return withMedicalAid.map(invoice => {
    const aid = medicalAidByPatient.get(invoice.patient_id);
    const fund = findFund(funds, aid?.medical_aid_provider_id ?? null, aid?.provider ?? null);
    const patient = patientById.get(invoice.patient_id);
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      issueDate: invoice.issue_date,
      serviceDate: visitById.get(invoice.visit_id)?.visit_date ?? invoice.issue_date,
      patientName: [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || 'Unknown patient',
      fundReference: fund?.medical_aid_reference ?? null,
      fundName: fund?.name ?? aid?.provider ?? 'Unknown fund',
      total: Number(invoice.total ?? 0),
      lineCount: lineCount.get(invoice.id) ?? 0
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Writes: each runs only from an explicit, confirmed staff action.
// ---------------------------------------------------------------------------------------------

/** Saves the confirmed primary ICD-10 code on batch lines (batch_details.diagnostic_code). */
export async function saveLineDiagnoses(batchId: string, entries: Array<{ detailId: string; primary: string }>): Promise<void> {
  for (const entry of entries) {
    const { error } = await supabase
      .from('batch_details')
      .update({ diagnostic_code: entry.primary, diagnostic_code_type: 'D', updated_at: new Date().toISOString() })
      .eq('id', entry.detailId)
      .eq('batch_header_id', batchId);
    if (error) throw new Error(`Could not save the ICD-10 code for a batch line: ${error.message}`);
  }
}

/**
 * Adds invoices to the fund's open batch (created if there is none) using the database functions
 * the automatic batching uses, so the lines are filled in exactly the same way.
 */
export async function addInvoicesToFundBatch(
  practiceId: string,
  fundReference: string,
  invoiceIds: string[]
): Promise<{ batchId: string; added: string[]; failed: Array<{ invoiceId: string; message: string }> }> {
  const { data: batchId, error } = await supabase.rpc('get_or_create_active_batch_id', {
    p_practice_id: practiceId,
    p_medical_aid_reference: fundReference
  });
  if (error || !batchId) throw new Error(`Could not open a batch for ${fundReference}: ${error?.message ?? 'no batch returned'}`);

  const added: string[] = [];
  const failed: Array<{ invoiceId: string; message: string }> = [];
  for (const invoiceId of invoiceIds) {
    // add_invoice_to_batch() inserts every invoice line without checking for existing ones, and the
    // database also batches invoices automatically, so re-check right before adding: never twice.
    const { data: current, error: currentError } = await supabase
      .from('invoices_enhanced')
      .select('id, batch_id')
      .eq('id', invoiceId)
      .maybeSingle();
    if (currentError) {
      failed.push({ invoiceId, message: `could not be checked: ${currentError.message}` });
      continue;
    }
    if (!current) {
      failed.push({ invoiceId, message: 'not found' });
      continue;
    }
    if (current.batch_id) {
      failed.push({ invoiceId, message: 'already in a batch (it was batched automatically in the meantime)' });
      continue;
    }
    const { error: addError } = await supabase.rpc('add_invoice_to_batch', { p_batch_id: batchId, p_invoice_id: invoiceId });
    if (addError) failed.push({ invoiceId, message: addError.message });
    else added.push(invoiceId);
  }
  return { batchId, added, failed };
}

const DETAIL_AMOUNT_COLUMNS = 'invoice_number, service_amount, discount_amount';

const loadDetailAmounts = async (batchId: string): Promise<DetailAmountRow[] | null> => {
  const { data, error } = await supabase.from('batch_details').select(DETAIL_AMOUNT_COLUMNS).eq('batch_header_id', batchId);
  return error ? null : ((data ?? []) as unknown as DetailAmountRow[]);
};

const loadStoredTotals = async (batchId: string): Promise<StoredTotals | null> => {
  const { data, error } = await supabase.from('batch_headers').select('total_invoices, total_amount').eq('id', batchId).maybeSingle();
  return error || !data ? null : (data as StoredTotals);
};

/**
 * Takes one invoice out of an UNSENT batch so its billing can be corrected: deletes only that
 * invoice's lines in this batch and clears invoices_enhanced.batch_id. Header totals are left to the
 * database trigger and only written here when their basis is proven (see batchTotals.ts).
 * When the invoice's lines are saved again, the database normally adds it to the fund's open batch
 * again; otherwise staff add it from "Not yet batched".
 */
export async function removeInvoiceFromBatch(
  batch: Pick<BatchHeaderRow, 'id' | 'batch_number'>,
  invoiceId: string,
  invoiceNumber: string
): Promise<RemoveInvoiceResult> {
  const blocked = (message: string): RemoveInvoiceResult => ({ status: 'blocked', message, linesRemoved: 0, totals: 'not_recomputed' });

  const { data: header, error: headerError } = await supabase
    .from('batch_headers')
    .select('id, status, sent_at, total_invoices, total_amount')
    .eq('id', batch.id)
    .maybeSingle();
  if (headerError) return blocked(`Could not check batch ${batch.batch_number}: ${headerError.message}. Nothing was changed.`);
  if (!header) return blocked(`Batch ${batch.batch_number} no longer exists. Nothing was changed.`);
  if (!isOpenBatch(header)) {
    return blocked(`Batch ${batch.batch_number} has already been submitted, so invoice ${invoiceNumber} can no longer be removed from it.`);
  }
  const linesBefore = await loadDetailAmounts(batch.id);

  const { data: deleted, error: deleteError } = await supabase
    .from('batch_details')
    .delete()
    .eq('batch_header_id', batch.id)
    .eq('invoice_id', invoiceId)
    .select('id');
  if (deleteError) return blocked(`Could not remove invoice ${invoiceNumber}'s lines: ${deleteError.message}. Nothing was changed.`);
  const linesRemoved = (deleted ?? []).length;

  const { error: unlinkError } = await supabase
    .from('invoices_enhanced')
    .update({ batch_id: null, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('batch_id', batch.id);
  if (unlinkError) {
    return {
      status: 'partial',
      message:
        `Invoice ${invoiceNumber}'s ${linesRemoved} line(s) were removed from batch ${batch.batch_number}, but the invoice still ` +
        `points to the batch (${unlinkError.message}). Ask an administrator to clear its batch link; until then it will not be claimed.`,
      linesRemoved,
      totals: 'not_recomputed'
    };
  }

  let totals: RemoveInvoiceResult['totals'] = 'not_recomputed';
  const [storedAfter, linesAfter] = await Promise.all([loadStoredTotals(batch.id), loadDetailAmounts(batch.id)]);
  if (linesBefore && storedAfter && linesAfter) {
    const plan = planHeaderTotals({ storedBefore: header as StoredTotals, linesBefore, storedAfter, linesAfter });
    if (plan.action === 'none') {
      totals = 'database';
    } else if (plan.action === 'update') {
      const { error: totalsError } = await supabase
        .from('batch_headers')
        .update({ total_invoices: plan.totalInvoices, total_amount: plan.totalAmount, updated_at: new Date().toISOString() })
        .eq('id', batch.id)
        .is('sent_at', null);
      if (!totalsError) totals = 'recomputed';
    }
  }

  const totalsNote =
    totals === 'not_recomputed' ? ' The batch totals were not recalculated here; the claim file always uses the remaining lines.' : '';
  return {
    status: 'removed',
    message:
      `Invoice ${invoiceNumber} (${linesRemoved} line(s)) was removed from batch ${batch.batch_number}.${totalsNote} ` +
      'When its billing lines are saved again it is normally added to the fund\'s open batch automatically; otherwise add it from "Not yet batched".',
    linesRemoved,
    totals
  };
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Base64 of the (ASCII) claim file for the email attachment. */
export function toBase64(textContent: string): string {
  const bytes = new TextEncoder().encode(textContent);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export interface SubmitBatchParams {
  practice: PracticeInfo;
  batch: BatchHeaderRow;
  file: ClaimFile;
  recipientEmail: string;
  fundName: string;
  submittedBy: string | null;
}

/**
 * Emails the claim file to the fund through the centralized email gateway, records the attempt in
 * batch_submissions and marks the batch as sent. Re-checks the batch first so it is never sent twice.
 */
export async function submitBatch(params: SubmitBatchParams): Promise<SubmitBatchResult> {
  const { practice, batch, file, recipientEmail, fundName, submittedBy } = params;

  const { data: current, error: currentError } = await supabase
    .from('batch_headers')
    .select('id, status, sent_at')
    .eq('id', batch.id)
    .maybeSingle();
  if (currentError) return { status: 'blocked', message: `Could not check the batch before sending: ${currentError.message}` };
  if (!current) return { status: 'blocked', message: 'The batch no longer exists.' };
  if (!isOpenBatch(current)) {
    return { status: 'blocked', message: `Batch ${batch.batch_number} has already been submitted (status "${current.status ?? ''}"); it was not sent again.` };
  }

  const subject = `Medical claims ${file.fileName} - ${practice.name} (practice ${batch.practice_number})`;
  const total = formatNad(file.totalCents / 100);
  const htmlContent = `
    <p>Dear ${escapeHtml(fundName)} claims team,</p>
    <p>Please find attached the claim file <strong>${escapeHtml(file.fileName)}</strong>.</p>
    <table cellpadding="4" style="border-collapse:collapse">
      <tr><td>Practice</td><td>${escapeHtml(practice.name)}</td></tr>
      <tr><td>Practice number</td><td>${escapeHtml(batch.practice_number)}</td></tr>
      <tr><td>Batch number</td><td>${batch.batch_number}</td></tr>
      <tr><td>Claim lines</td><td>${file.lineCount}</td></tr>
      <tr><td>Total claimed</td><td>${escapeHtml(total)}</td></tr>
    </table>
    <p>Please reply to ${escapeHtml(practice.contact_email ?? 'the practice')} with any queries or rejections.</p>`;
  const textContent =
    `Dear ${fundName} claims team,\n\nPlease find attached the claim file ${file.fileName}.\n` +
    `Practice: ${practice.name} (${batch.practice_number})\nBatch: ${batch.batch_number}\n` +
    `Claim lines: ${file.lineCount}\nTotal claimed: ${total}\n`;

  const email = await communicationService.sendEmail({
    practiceId: practice.id,
    recipientEmail,
    recipientName: `${fundName} claims`,
    subject,
    htmlContent,
    textContent,
    emailType: 'custom',
    attachments: [{ filename: file.fileName, content: toBase64(file.content), type: 'application/octet-stream' }],
    metadata: { kind: 'claim_batch', batchId: batch.id, fundReference: batch.medical_aid_reference, lineCount: file.lineCount, totalCents: file.totalCents },
    tags: ['claims', batch.medical_aid_reference]
  });

  const now = new Date().toISOString();
  const { error: logError } = await supabase.from('batch_submissions').insert({
    batch_header_id: batch.id,
    file_name: file.fileName,
    file_size: file.content.length,
    file_format: 'EDI',
    recipient_email: recipientEmail,
    email_service: 'centralized-email-gateway',
    email_id: email.messageId ?? email.logId ?? null,
    email_subject: subject,
    status: email.success ? 'sent' : 'failed',
    submitted_at: now,
    sent_at: email.success ? now : null,
    submitted_by: submittedBy,
    practice_id: practice.id,
    medical_aid_reference: batch.medical_aid_reference,
    total_claims: file.lineCount,
    total_amount: file.totalCents / 100,
    error_details: email.success ? null : { message: email.error ?? 'unknown error' },
    provider_response: { logId: email.logId, messageId: email.messageId ?? null, status: email.status }
  });

  if (!email.success) {
    return {
      status: 'failed',
      message: `The claim file was not sent: ${email.error ?? 'unknown error'}. Nothing was submitted, so you can try again.${logError ? ' (The failed attempt could not be logged.)' : ''}`
    };
  }

  const { error: updateError } = await supabase
    .from('batch_headers')
    .update({ status: 'sent', sent_at: now, recipient_email: recipientEmail, generated_file_content: file.content, updated_at: now })
    .eq('id', batch.id)
    .is('sent_at', null);

  if (updateError || logError) {
    return {
      status: 'sent_not_recorded',
      message: `The claim file WAS emailed to ${recipientEmail}, but the batch could not be marked as sent (${(updateError ?? logError)?.message}). Do not send it again; ask an administrator to mark batch ${batch.batch_number} as sent.`
    };
  }
  return { status: 'sent', message: `Batch ${batch.batch_number} (${file.lineCount} lines, ${total}) was sent to ${fundName} at ${recipientEmail}.` };
}
