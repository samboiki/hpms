/**
 * Data access for the claims module. Reads are scoped to one practice; every query checks its
 * error and throws a readable message instead of continuing with partial data.
 *
 * Writes (saving ICD-10 codes on batch lines, adding invoices to a batch, recording a submission)
 * only run when staff press the matching button and confirm.
 * Submission goes through communicationService (centralized email gateway); nothing is sent
 * automatically.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { plainWords } from '../../../utils/plainErrors';
import { supabase } from '../../../lib/supabase';
import { communicationService } from '../../../services/communicationService';
import { formatNad, toCents } from '../../../utils/billing/money';
import type { TariffRow } from '../../../utils/billing/pricing';
import { mergeOwnTariffs } from '../../../utils/billing/practiceTariffs';
import { isDentalPractice } from '../../../utils/billing/tariffRules';
import { loadOwnTariffs } from '../../../services/practiceTariffService';
import { isReversalTransactionType, joinDiagnosisCodes, type ClaimFile } from '../../../utils/billing/claimFile';
import type { DoNotClaimFlag } from '../../../utils/billing/claimLine';
import { normalizeAccountFlag, type RawAccountFlagRow } from '../../../services/ledger/accountFlags';
import type {
  BatchDetailRow,
  BatchHeaderRow,
  BatchLineSources,
  BatchSubmissionRow,
  DoctorRow,
  FundProvider,
  InvoiceServiceRow,
  MedicalAidRow,
  PatientRow,
  PracticeInfo,
  RemoveInvoiceResult,
  SubmitBatchResult,
  UnbatchedInvoice,
  VisitRow
} from './types';
import { planHeaderTotals, type DetailAmountRow, type StoredTotals } from './batchTotals';
import { isClaimLineOutcome, isOpenBatch, type ClaimLineOutcome } from './status';
import { SILENT_FUND_SETTING_KEY, parseSilentFundDays, silentFundDefaults, type SilentFundDays } from './batchFollowUp';
import { loadFundRules } from '../../../services/fundMasterService';
import type { InvoiceClaimPlace, InvoiceCodeCopy } from './reviewCodes';
import type { Json } from '../../../types/database.types';
import { loadInvoicingSetup } from '../../../services/invoicingSetup';
import { loadPractitionerBilling } from '../../../services/practitionerBillingService';
import { loadCodeRules } from '../../../services/codeRulesService';
import { isArNotSetUp } from '../receipts/arService';

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

/**
 * One batch of the practice by id, scoped as loadBatches is (its practice, or an older batch carrying only the
 * practice number); null when it is not the practice's or no longer exists. A link to a batch older than the newest
 * 300 that loadBatches reads (?batch=, from an invoice or a claim line) opens it this way.
 */
export async function loadBatchById(practice: PracticeInfo, batchId: string): Promise<BatchHeaderRow | null> {
  if (!UUID_PATTERN.test(batchId)) return null;
  const practiceNumber = (practice.practice_number ?? '').trim();
  const query = supabase.from('batch_headers').select(BATCH_COLUMNS).eq('id', batchId);
  const scoped = /^\d+$/.test(practiceNumber)
    ? query.or(`practice_id.eq.${practice.id},practice_number.eq.${practiceNumber}`)
    : query.eq('practice_id', practice.id);
  const { data, error } = await scoped.maybeSingle();
  if (error) fail('the claim batch', error);
  return (data ?? null) as unknown as BatchHeaderRow | null;
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

/** Patients of the practice whose file is marked "Do not claim" (account_flags in force), by patient id. */
async function loadDoNotClaim(practiceId: string, patientIds: string[]): Promise<Map<string, DoNotClaimFlag>> {
  // account_flags is newer than src/types/database.types.ts
  const rows = await inChunks<RawAccountFlagRow>(patientIds, 'the "Do not claim" flags', chunk =>
    (supabase as unknown as SupabaseClient)
      .from('account_flags')
      .select('id, patient_id, flag, reason, set_at, cleared_at')
      .eq('practice_id', practiceId)
      .eq('flag', 'no_claims')
      .is('cleared_at', null)
      .in('patient_id', chunk) as unknown as PromiseLike<{ data: RawAccountFlagRow[] | null; error: { message: string } | null }>
  );
  const flags = new Map<string, DoNotClaimFlag>();
  rows.forEach(row => {
    const flag = normalizeAccountFlag(row);
    if (flag) flags.set(flag.patientId, { since: flag.setAt, reason: flag.reason });
  });
  return flags;
}

/** The shared tariff columns that say which version of a code applies on a date and whether it needs a tooth. */
const TOOTH_RULE_COLUMNS = 'id, code, price, is_active, effective_from, effective_to, can_be_multiplied, requires_tooth_number';

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
  // A dependant is claimed under the main member's name. '*' so dependant_code is read once that column exists.
  let medicalAidRows: MedicalAidRow[] = [];
  try {
    medicalAidRows = await inChunks<MedicalAidRow>(unique(details.map(d => d.patient_id)), 'the medical aid records', chunk =>
      supabase
        .from('medical_aid_details')
        .select('*')
        .in('patient_id', chunk)
        .order('updated_at', { ascending: false }) as unknown as PromiseLike<{ data: MedicalAidRow[] | null; error: { message: string } | null }>
    );
  } catch (error) {
    warnings.push(`${error instanceof Error ? plainWords(error.message) : 'The medical aid records could not be read'}; member names come from the batch lines.`);
  }
  const medicalAid = new Map<string, MedicalAidRow[]>();
  medicalAidRows.forEach(row => {
    if (row.patient_id) medicalAid.set(row.patient_id, [...(medicalAid.get(row.patient_id) ?? []), row]);
  });
  // A line of a patient marked "Do not claim" is an error, so the batch cannot be sent with it
  let doNotClaim = new Map<string, DoNotClaimFlag>();
  try {
    doNotClaim = await loadDoNotClaim(practice.id, unique(details.map(d => d.patient_id)));
  } catch (error) {
    warnings.push(`${error instanceof Error ? plainWords(error.message) : 'The "Do not claim" flags could not be read'}; check that none of these patients is marked "Do not claim".`);
  }

  const visits = await inChunks<VisitRow>(unique(details.map(d => d.visit_id)), 'the visits', chunk =>
    supabase
      .from('visits')
      .select('id, visit_date, doctor_id, diagnosis')
      .in('id', chunk) as unknown as PromiseLike<{ data: VisitRow[] | null; error: { message: string } | null }>
  );
  // Each line's own date and treating practitioner, its ICD-10 codes, and its tooth surfaces and quadrant, once the
  // database updates have added them
  const { lineDetails, lineCodes, lineTeeth } = await loadInvoicingSetup();
  const invoiceServices = await inChunks<InvoiceServiceRow>(unique(details.map(d => d.invoice_id)), 'the invoice lines', chunk =>
    supabase
      .from('invoice_services')
      .select(
        `id, invoice_id, code, unit_price, quantity, total_price, tooth_number, system_transaction_number, notes${lineDetails ? ', service_date, practitioner_id' : ''}${lineCodes ? ', icd10_primary, icd10_secondary' : ''}${lineTeeth ? ', tooth_surfaces, tooth_quadrant' : ''}`
      )
      .in('invoice_id', chunk) as unknown as PromiseLike<{ data: InvoiceServiceRow[] | null; error: { message: string } | null }>
  );
  // A line is claimed under its own practitioner, else the invoice's (claimedPractitionerOf), as the database builds it
  const invoicePractitioners = await loadInvoicePractitioners(details.map(d => d.invoice_id));
  const doctors = await inChunks<DoctorRow>(unique([...invoiceServices.map(s => s.practitioner_id), ...invoicePractitioners.values()]), 'the treating practitioners', chunk =>
    supabase
      .from('users')
      .select('id, full_name, hpcsa_number')
      .in('id', chunk) as unknown as PromiseLike<{ data: DoctorRow[] | null; error: { message: string } | null }>
  );
  // Partners who bill under their own practice number (D31); before the update every line is the practice's
  const billing = await loadPractitionerBilling(practice.id);
  if (billing.status === 'error') {
    warnings.push(`The practitioners' own practice numbers could not be read (${billing.message}); each line keeps the practice number it was batched with.`);
  }
  // Codes the practice charges by time: their lines give the fund the minutes noted on them (claim field 18)
  const codeRules = await loadCodeRules(practice.id);
  if (codeRules.status === 'error') {
    warnings.push(`${codeRules.message}; lines of codes charged by time send their quantity, not the minutes.`);
  }
  const timeBasedCodes = new Set([...codeRules.rules].filter(([, rules]) => rules.timeBased).map(([code]) => code));

  // Whether a line needs a tooth: the practice's own flag for a code it overrides (Admin > Tariffs), else the shared
  // list's, as on the visit (toothRuleFor in buildClaimLines). Only dental practices number teeth.
  let tariffRows: TariffRow[] = [];
  if (!practice.practice_type) {
    warnings.push('The practice type is not set, so tooth numbers were not checked.');
  } else if (isDentalPractice(practice.practice_type)) {
    const [shared, own] = await Promise.all([
      supabase.from('practice_tariffs_with_types').select(TOOTH_RULE_COLUMNS).eq('practice_type_name', practice.practice_type),
      loadOwnTariffs(practice.id).catch((error: unknown) => {
        warnings.push(`${error instanceof Error ? plainWords(error.message) : "The practice's own codes could not be read"}; tooth numbers were checked against the shared tariff list.`);
        return { rows: [], enabled: false };
      })
    ]);
    if (shared.error) warnings.push(`The tariff list could not be read (${shared.error.message}), so tooth numbers were not checked.`);
    else tariffRows = mergeOwnTariffs(shared.data ?? [], own.rows);
  }

  return {
    details,
    patients: new Map(patients.map(row => [row.id, row])),
    medicalAid,
    visits: new Map(visits.map(row => [row.id, row])),
    doctors: new Map(doctors.map(row => [row.id, row])),
    invoiceServices,
    lineCodes,
    tariffRows,
    practiceType: practice.practice_type ?? null,
    doNotClaim,
    practitionerBilling: billing.billing,
    invoicePractitioners,
    timeBasedCodes,
    warnings
  };
}

/**
 * Each invoice's treating practitioner (invoices_enhanced.practitioner_id), by invoice id: a line without its own
 * practitioner is claimed under it (claimedPractitionerOf), in the claim file and in "Correct and send again".
 */
export async function loadInvoicePractitioners(invoiceIds: ReadonlyArray<string | null>): Promise<Map<string, string>> {
  type InvoicePractitionerRow = { id: string; practitioner_id: string | null };
  const rows = await inChunks<InvoicePractitionerRow>(unique([...invoiceIds]), "the invoices' practitioners", chunk =>
    supabase.from('invoices_enhanced').select('id, practitioner_id').in('id', chunk) as unknown as PromiseLike<{
      data: InvoicePractitionerRow[] | null;
      error: { message: string } | null;
    }>
  );
  return new Map(rows.flatMap(row => (row.practitioner_id ? [[row.id, row.practitioner_id] as const] : [])));
}

/** What the fund answered on one claim line (the claim_line_outcomes view of proposals/2026-10-08-claims-follow-up.sql) */
export interface LineOutcomeRow {
  claimLineId: string;
  outcome: ClaimLineOutcome;
  /** What the fund paid on the line, all answers together */
  paidCents: number;
  /** yyyy-MM-dd of the latest answer */
  answeredOn: string | null;
  answers: number;
  /** The latest remittance or response that answered it, or the keyed payment's receipt */
  documentId: string | null;
  receiptId: string | null;
}

interface RawOutcomeRow {
  claim_line_id: string;
  outcome: string;
  paid: number | string | null;
  answered_on: string | null;
  answers: number | null;
  document_id: string | null;
  receipt_id: string | null;
}

const amountCents = (value: number | string | null): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? toCents(number) : 0;
};

/**
 * The funds' answers on the lines of these batches, by claim line id. Null while the view is not in the database
 * (the screens then show no answers rather than fail).
 */
export async function loadLineOutcomes(batchIds: string[]): Promise<Map<string, LineOutcomeRow> | null> {
  try {
    // claim_line_outcomes is newer than src/types/database.types.ts
    const rows = await inChunks<RawOutcomeRow>(unique(batchIds), "the funds' answers", chunk =>
      (supabase as unknown as SupabaseClient)
        .from('claim_line_outcomes')
        .select('claim_line_id, outcome, paid, answered_on, answers, document_id, receipt_id')
        .in('batch_id', chunk) as unknown as PromiseLike<{ data: RawOutcomeRow[] | null; error: { message: string } | null }>
    );
    return new Map(
      rows
        .filter(row => isClaimLineOutcome(row.outcome))
        .map(row => [row.claim_line_id, {
          claimLineId: row.claim_line_id,
          outcome: row.outcome as ClaimLineOutcome,
          paidCents: amountCents(row.paid),
          answeredOn: row.answered_on,
          answers: row.answers ?? 0,
          documentId: row.document_id,
          receiptId: row.receipt_id
        }] as const)
    );
  } catch (error) {
    if (isArNotSetUp(error)) return null;
    throw error;
  }
}

/**
 * What the funds still owe (medical aid portion) on the invoices of these batches, by batch id. `owed` is null with
 * a warning when the amounts could not be read: the silent-fund alert then lists batches without amounts.
 */
export async function loadOwedByBatch(practiceId: string, batchIds: string[]): Promise<{ owed: Map<string, number> | null; warning: string | null }> {
  if (batchIds.length === 0) return { owed: new Map(), warning: null };
  try {
    type Row = { batch_id: string | null; medical_aid_outstanding: number | string | null };
    const rows = await inChunks<Row>(unique(batchIds), 'what the funds still owe', chunk =>
      (supabase as unknown as SupabaseClient)
        .from('ar_invoice_balances')
        .select('batch_id, medical_aid_outstanding')
        .eq('practice_id', practiceId)
        .gt('medical_aid_outstanding', 0)
        .in('batch_id', chunk) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
    );
    const owed = new Map<string, number>();
    rows.forEach(row => {
      if (row.batch_id) owed.set(row.batch_id, (owed.get(row.batch_id) ?? 0) + amountCents(row.medical_aid_outstanding));
    });
    return { owed, warning: null };
  } catch (error) {
    return {
      owed: null,
      warning: isArNotSetUp(error)
        ? 'Receipts are not set up yet, so the amounts the funds still owe are not shown.'
        : `${error instanceof Error ? plainWords(error.message) : 'What the funds still owe could not be read'}; the amounts are not shown.`
    };
  }
}

/**
 * How long each fund may take to answer before its batches are flagged (practice_settings silent_fund_days); when the
 * practice has not set it, the funds' payment terms. Reading it also puts the fund master's rules in force for the
 * claims screens (once per session), so their deadlines and checks are the fund master's from the first render.
 */
export async function loadSilentFundDays(practiceId: string): Promise<{ settings: SilentFundDays; error: string | null }> {
  const [{ data, error }] = await Promise.all([
    supabase.from('practice_settings').select('setting_value').eq('practice_id', practiceId).eq('setting_key', SILENT_FUND_SETTING_KEY).limit(1),
    loadFundRules()
  ]);
  const defaults = silentFundDefaults();
  if (error) return { settings: parseSilentFundDays(null, defaults), error: error.message };
  return { settings: parseSilentFundDays(data?.[0]?.setting_value ?? null, defaults), error: null };
}

/** Saves it (practice administrators: the practice_settings admin-only policies decide) */
export async function saveSilentFundDays(practiceId: string, settings: SilentFundDays): Promise<SilentFundDays> {
  const clean = parseSilentFundDays(settings);
  const { error } = await supabase.from('practice_settings').upsert(
    {
      practice_id: practiceId,
      setting_key: SILENT_FUND_SETTING_KEY,
      setting_value: clean as unknown as Json,
      setting_type: 'json',
      description: 'Claims: days a fund may take to answer a sent batch before it is flagged (default, and per fund code)',
      is_public: false
    },
    { onConflict: 'practice_id,setting_key' }
  );
  if (error) throw new Error(`Could not save when to warn about funds: ${error.message}`);
  return clean;
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

/** Why a medical aid invoice is in no batch until the patient's file is put right; the second is the database's own words (claim_invoice_into_batch) */
export const NO_MEDICAL_AID_REASON = "The patient has no medical aid on file any more: add it on the patient's file, or bill the patient";
export const FUND_NOT_LINKED_REASON = "The patient's medical aid details are not linked to a fund with a claim code: choose the fund on the patient's file first";

/**
 * Billed invoices of medical aid patients (last 12 months) that are in no batch yet: the database
 * normally batches them automatically, so anything listed here was missed and would never be claimed.
 * An invoice the batches cannot take until the patient's file names a fund again (the database takes it out of its
 * open batch) is listed too, with the reason, so it never disappears from both this list and the batches.
 */
export async function loadUnbatchedInvoices(practiceId: string, funds: readonly FundProvider[], since: string): Promise<UnbatchedInvoice[]> {
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices_enhanced')
    .select('id, invoice_number, issue_date, visit_id, patient_id, total, medical_aid_total, payment_status')
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
  // Patients marked "Do not claim" are left out of batches on purpose, so their invoices were not missed. If the flags
  // cannot be read the invoices stay listed: the batch review still refuses a flagged patient's lines.
  const doNotClaim = await loadDoNotClaim(practiceId, patientIds).catch(() => new Map<string, DoNotClaimFlag>());
  // A patient with a medical aid record; or a medical aid portion billed to a patient who has none any more
  const withMedicalAid = invoices.filter(invoice => !doNotClaim.has(invoice.patient_id)
    && (medicalAidByPatient.has(invoice.patient_id) || Number(invoice.medical_aid_total ?? 0) > 0));
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

  // An invoice without lines has nothing to claim (e.g. an opening balance brought over from Eminance), so it was not missed
  return withMedicalAid.filter(invoice => (lineCount.get(invoice.id) ?? 0) > 0).map(invoice => {
    const aid = medicalAidByPatient.get(invoice.patient_id);
    const fund = findFund(funds, aid?.medical_aid_provider_id ?? null, aid?.provider ?? null);
    // A batch claims from the fund the record is linked to, by its claim code, as the database looks it up: a name alone
    // is not enough
    const linked = aid?.medical_aid_provider_id ? funds.find(item => item.id === aid.medical_aid_provider_id) : undefined;
    const patient = patientById.get(invoice.patient_id);
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      issueDate: invoice.issue_date,
      serviceDate: visitById.get(invoice.visit_id)?.visit_date ?? invoice.issue_date,
      patientId: invoice.patient_id,
      patientName: [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || 'Unknown patient',
      fundReference: fund?.medical_aid_reference ?? null,
      fundName: fund?.name ?? aid?.provider ?? 'Unknown fund',
      total: Number(invoice.total ?? 0),
      lineCount: lineCount.get(invoice.id) ?? 0,
      notClaimableReason: !aid ? NO_MEDICAL_AID_REASON : linked?.medical_aid_reference?.trim() ? null : FUND_NOT_LINKED_REASON
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Writes: each runs only from an explicit, confirmed staff action.
// ---------------------------------------------------------------------------------------------

/** Saves the confirmed primary ICD-10 code on batch lines (batch_details.diagnostic_code). */
/** batch_details.diagnostic_code is VARCHAR(20) until proposals/2026-10-07-claim-diagnoses.sql widens it to 64. */
export const NARROW_DIAGNOSIS_COLUMN = 20;

/**
 * Saves each line's ICD-10 codes the way the claim writes them ("K02.1/K04.0"), so secondary codes survive. While the
 * column is still 20 characters (Postgres 22001, value too long), the line keeps the codes that fit; the result counts
 * those lines so the screen can say so.
 */
export async function saveLineDiagnoses(
  batchId: string,
  entries: Array<{ detailId: string; primary: string; secondary: readonly string[] }>
): Promise<{ shortened: number }> {
  let shortened = 0;
  for (const entry of entries) {
    const save = (codes: string) =>
      supabase
        .from('batch_details')
        .update({ diagnostic_code: codes, diagnostic_code_type: 'D', updated_at: new Date().toISOString() })
        .eq('id', entry.detailId)
        .eq('batch_header_id', batchId);
    const all = joinDiagnosisCodes(entry.primary, entry.secondary);
    let { error } = await save(all);
    if (error?.code === '22001') {
      const fitting = joinDiagnosisCodes(entry.primary, entry.secondary, NARROW_DIAGNOSIS_COLUMN);
      ({ error } = await save(fitting));
      if (!error && fitting !== all) shortened += 1;
    }
    if (error) throw new Error(`Could not save the ICD-10 codes for a batch line: ${error.message}`);
  }
  return { shortened };
}

/** Where each invoice's claim lines are, so reviewCodes.ts can tell which invoices may take ICD-10 codes. */
export async function loadInvoiceClaimPlaces(invoiceIds: string[]): Promise<Map<string, InvoiceClaimPlace>> {
  type Rows<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
  const ids = unique(invoiceIds);
  const invoices = await inChunks<{ id: string; batch_id: string | null }>(ids, 'the invoices', chunk =>
    supabase.from('invoices_enhanced').select('id, batch_id').in('id', chunk) as unknown as Rows<{ id: string; batch_id: string | null }>
  );
  const claimLines = await inChunks<{ invoice_id: string | null; batch_header_id: string | null }>(ids, 'the claim lines of the invoices', chunk =>
    supabase.from('batch_details').select('invoice_id, batch_header_id').in('invoice_id', chunk) as unknown as Rows<{ invoice_id: string | null; batch_header_id: string | null }>
  );
  type BatchState = Pick<BatchHeaderRow, 'id' | 'status' | 'sent_at'>;
  const batches = await inChunks<BatchState>(unique(invoices.map(row => row.batch_id)), 'the batches of the invoices', chunk =>
    supabase.from('batch_headers').select('id, status, sent_at').in('id', chunk) as unknown as Rows<BatchState>
  );
  const batchById = new Map(batches.map(row => [row.id, row]));
  const places = new Map<string, InvoiceClaimPlace>();
  invoices.forEach(invoice => {
    const ownBatch = invoice.batch_id ? batchById.get(invoice.batch_id) : null;
    // A batch the invoice names but that could not be read is not known to be safe: the invoice is left out
    if (ownBatch === undefined) return;
    places.set(invoice.id, { ownBatch, batchIds: unique(claimLines.filter(line => line.invoice_id === invoice.id).map(line => line.batch_header_id)) });
  });
  return places;
}

/**
 * Puts ICD-10 codes on invoice lines (those two columns only), invoice by invoice, as planned by reviewCodes.ts. A
 * change to an invoice line makes the database batch the invoice again (sync_invoice_to_batch): `left` lists invoices
 * whose claim lines are then no longer in this batch (the patient's fund or "Do not claim" no longer matches it). A
 * line the database did not change counts as failed and the rest of that invoice is left alone.
 */
export async function saveInvoiceLineCodes(
  batchId: string,
  copies: readonly InvoiceCodeCopy[]
): Promise<{ copied: number; failed: Array<{ invoiceNumber: string; message: string }>; left: string[] }> {
  // The generated database types do not know the ICD-10 columns yet
  const db = supabase as unknown as SupabaseClient;
  const result = { copied: 0, failed: [] as Array<{ invoiceNumber: string; message: string }>, left: [] as string[] };
  for (const copy of copies) {
    let written = 0;
    for (const line of copy.lines) {
      const { data, error } = await db
        .from('invoice_services')
        .update({ icd10_primary: line.primary, icd10_secondary: line.secondary, updated_at: new Date().toISOString() })
        .eq('id', line.invoiceLineId)
        .eq('invoice_id', copy.invoiceId)
        .select('id');
      if (error || !data || data.length === 0) {
        result.failed.push({ invoiceNumber: copy.invoiceNumber, message: error?.message ?? 'the invoice line was not changed' });
        break;
      }
      written += 1;
    }
    result.copied += written;
    if (written === 0 || !copy.rebuildsClaim) continue;
    const { data: stillHere, error } = await supabase.from('batch_details').select('id').eq('batch_header_id', batchId).eq('invoice_id', copy.invoiceId);
    if (!error && (stillHere ?? []).length === 0) result.left.push(copy.invoiceNumber);
  }
  return result;
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

  // A credit file (header transaction type C) takes back lines claimed before: the email says so
  const reversal = isReversalTransactionType(batch.transaction_type);
  const what = reversal ? 'credit file (reversals of earlier claims)' : 'claim file';
  const linesLabel = reversal ? 'Reversal lines' : 'Claim lines';
  const totalLabel = reversal ? 'Total credited' : 'Total claimed';
  const subject = `${reversal ? 'Claim reversals' : 'Medical claims'} ${file.fileName} - ${practice.name} (practice ${batch.practice_number})`;
  const total = formatNad(file.totalCents / 100);
  const htmlContent = `
    <p>Dear ${escapeHtml(fundName)} claims team,</p>
    <p>Please find attached the ${what} <strong>${escapeHtml(file.fileName)}</strong>.</p>
    <table cellpadding="4" style="border-collapse:collapse">
      <tr><td>Practice</td><td>${escapeHtml(practice.name)}</td></tr>
      <tr><td>Practice number</td><td>${escapeHtml(batch.practice_number)}</td></tr>
      <tr><td>Batch number</td><td>${batch.batch_number}</td></tr>
      <tr><td>${linesLabel}</td><td>${file.lineCount}</td></tr>
      <tr><td>${totalLabel}</td><td>${escapeHtml(total)}</td></tr>
    </table>
    <p>Please reply to ${escapeHtml(practice.contact_email ?? 'the practice')} with any queries or rejections.</p>`;
  const textContent =
    `Dear ${fundName} claims team,\n\nPlease find attached the ${what} ${file.fileName}.\n` +
    `Practice: ${practice.name} (${batch.practice_number})\nBatch: ${batch.batch_number}\n` +
    `${linesLabel}: ${file.lineCount}\n${totalLabel}: ${total}\n`;

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
  return { status: 'sent', message: `${reversal ? 'Credit file' : 'Batch'} ${batch.batch_number} (${file.lineCount} lines, ${total}) was sent to ${fundName} at ${recipientEmail}.` };
}
