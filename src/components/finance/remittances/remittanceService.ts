import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { withTimeout } from '../../../services/financialKpiService';
import { buildClaimLines } from '../claims/buildClaimLines';
import { loadBatchLineSources, loadBatches, loadFunds, loadPracticeInfo } from '../claims/claimsService';
import type { FundProvider, PracticeInfo } from '../claims/types';
import { isArNotSetUp } from '../receipts/arService';
import { sentFileFields } from '../claims/claimReport';
import { isReversalTransactionType } from '../../../utils/billing/claimFile';
import { padPatientReference } from '../../../utils/billing/claimLine';
import { addDaysToKey, isValidDateKey, toDateKey } from '../../../utils/billing/dates';
import { toCents } from '../../../utils/billing/money';
import { fundAliases, sameFund } from '../../../utils/remittance/funds';
import type { ClaimCandidate, ClaimLineHistory, RejectionRef, RejectionStatus } from '../../../utils/remittance/matching';
import type { InvoiceBalance } from '../../../utils/remittance/posting';
import type { ReasonCategory, SuggestedAction } from '../../../utils/remittance/reasonCodes';
import type { LineStatus, RemittanceDocument } from '../../../utils/remittance/types';
import type { OpenRejectionRow } from '../../../utils/remittance/patientRejections';

/**
 * Supabase access for remittance import (tables and RPCs of proposals/2026-10-07-remittances.sql).
 * Reading and matching a file needs only the claim tables, so it works before that proposal is
 * applied; saving, posting and the rejection queue say 'not set up' until then (PostgREST 42P01 /
 * PGRST205, detected like the receipts screens do).
 */
const db = supabase as unknown as SupabaseClient;

const TIMEOUT_MS = 30000;
const ID_CHUNK = 100;
const BATCH_CONCURRENCY = 4;
/** Batches dated from this many days before the earliest service date on the document */
const WINDOW_BEFORE_DAYS = 10;
const WINDOW_AFTER_DAYS = 10;

export const REMITTANCES_NOT_SET_UP_MESSAGE =
  'Remittance import is not set up in this database yet (proposals/2026-10-07-remittances.sql, after the receipts proposal). You can already read a file and check its matches; saving, posting and the rejection queue start working once it is applied.';

export const isRemittanceNotSetUp = (error: unknown): boolean => isArNotSetUp(error);

const timed = <T>(task: PromiseLike<T>, label: string): Promise<T> =>
  withTimeout(Promise.resolve(task), TIMEOUT_MS, `${label} took too long. Check your connection and try again.`);

interface DbError {
  code?: string;
  message?: string;
}

const chunks = <T>(items: readonly T[], size = ID_CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

async function selectByIds<T>(table: string, columns: string, column: string, ids: readonly string[]): Promise<T[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows: T[] = [];
  for (const chunk of chunks(unique)) {
    const { data, error } = await db.from(table).select(columns).in(column, chunk);
    if (error) throw Object.assign(new Error(`Could not load ${table}: ${error.message}`), { code: (error as DbError).code });
    rows.push(...((data ?? []) as unknown as T[]));
  }
  return rows;
}

async function callRpc<T>(name: string, args: Record<string, unknown>, action: string): Promise<T> {
  const { data, error } = await timed(db.rpc(name, args), action);
  if (error) {
    if (isRemittanceNotSetUp(error)) throw new Error(REMITTANCES_NOT_SET_UP_MESSAGE);
    throw new Error(error.message || `${action} failed`);
  }
  return data as T;
}

// ---------------------------------------------------------------------------------------------
// Set-up and reference data
// ---------------------------------------------------------------------------------------------

export type SetupState = 'ready' | 'not_set_up';

export async function loadSetupState(practiceId: string): Promise<SetupState> {
  const { error } = await timed(db.from('remittance_documents').select('id').eq('practice_id', practiceId).limit(1), 'Checking remittance import');
  if (!error) return 'ready';
  if (isRemittanceNotSetUp(error)) return 'not_set_up';
  throw new Error(`Could not check remittance import: ${error.message}`);
}

export interface ImportContext {
  practice: PracticeInfo;
  funds: FundProvider[];
  /** The user may approve write-offs (admin or doctor) */
  canApproveWriteOffs: boolean;
}

export async function loadImportContext(practiceId: string, role: string | null | undefined): Promise<ImportContext> {
  const [practice, funds] = await Promise.all([loadPracticeInfo(practiceId), loadFunds()]);
  return { practice, funds, canApproveWriteOffs: role === 'admin' || role === 'doctor' };
}

/** The fund as the practice records it, for the receipt's payer name */
export function fundProviderName(funds: readonly FundProvider[], doc: Pick<RemittanceDocument, 'fundCode' | 'fundName'>): string {
  const provider = funds.find(fund => sameFund(fund.medical_aid_reference, doc.fundCode));
  return provider?.name ?? doc.fundName ?? doc.fundCode ?? 'Medical aid';
}

// ---------------------------------------------------------------------------------------------
// Claim lines to match against: what was sent to the fund, as it was sent
// ---------------------------------------------------------------------------------------------

/** The dates the claims of a document were batched in */
export function batchWindow(doc: RemittanceDocument): { from: string; to: string } | null {
  const dates = doc.lines.map(line => line.serviceDate).filter((date): date is string => isValidDateKey(date)).sort();
  if (dates.length === 0) return null;
  const last = [doc.documentDate, doc.paymentDate, dates[dates.length - 1]].filter((date): date is string => isValidDateKey(date)).sort();
  return { from: addDaysToKey(dates[0], -WINDOW_BEFORE_DAYS), to: addDaysToKey(last[last.length - 1], WINDOW_AFTER_DAYS) };
}

async function inBatches<T, R>(items: readonly T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) results.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  return results;
}

export interface CandidateLoad {
  candidates: ClaimCandidate[];
  batchCount: number;
  warnings: string[];
}

export async function loadClaimCandidates(context: ImportContext, doc: RemittanceDocument): Promise<CandidateLoad> {
  const window = batchWindow(doc);
  if (!window) return { candidates: [], batchCount: 0, warnings: ['The document has no service dates to look for claims with.'] };
  const aliases = fundAliases(doc.fundCode);
  // A credit file's lines take money back: a fund's payment or answer never matches them
  const batches = (await timed(loadBatches(context.practice), 'Loading claim batches')).filter(batch =>
    (aliases.length === 0 || aliases.includes((batch.medical_aid_reference ?? '').trim().toUpperCase()))
    && batch.batch_date >= window.from && batch.batch_date <= window.to
    && !isReversalTransactionType(batch.transaction_type));
  const warnings: string[] = [];
  const perBatch = await inBatches(batches, BATCH_CONCURRENCY, async batch => {
    const sources = await loadBatchLineSources(batch, context.practice);
    warnings.push(...sources.warnings);
    const sent = sentFileFields(batch);
    const lines = buildClaimLines(sources, {});
    const detailById = new Map(sources.details.map(detail => [detail.id, detail]));
    return lines.map(line => {
      const detail = detailById.get(line.key);
      const patient = detail?.patient_id ? sources.patients.get(detail.patient_id) : undefined;
      const aid = detail?.patient_id ? sources.medicalAid.get(detail.patient_id)?.find(row => (row.membership_number ?? '').trim() === line.membershipNumber) ?? sources.medicalAid.get(detail.patient_id)?.[0] : undefined;
      const file = sent.get(line.transactionNumber);
      const fileAmount = file ? Number(file[13]) : Number.NaN;
      const fileQuantity = file ? Number(file[17]) : Number.NaN;
      const candidate: ClaimCandidate = {
        claimLineId: line.key,
        batchId: batch.id,
        fundCode: batch.medical_aid_reference,
        invoiceId: line.invoiceId,
        invoiceNumber: line.invoiceNumber,
        patientId: detail?.patient_id ?? null,
        patientName: [patient?.first_name, patient?.last_name].map(part => (part ?? '').trim()).filter(Boolean).join(' ') || line.patientName,
        patientReference: (file?.[3] || padPatientReference(line.patientReference)).trim(),
        membershipNumber: (file?.[7] || line.membershipNumber).trim(),
        dependantCode: (aid?.dependant_code ?? '').trim() || null,
        serviceDate: toDateKey(file?.[16] ?? null) ?? line.serviceDate,
        tariffCode: (file?.[12] || line.tariffCode).trim(),
        quantity: Number.isFinite(fileQuantity) && fileQuantity > 0 ? fileQuantity : line.quantity,
        amountCents: Number.isFinite(fileAmount) ? toCents(fileAmount) : Number.isFinite(line.amount) ? toCents(line.amount) : 0,
        toothNumbers: (file?.[36] ?? line.toothNumbers ?? '').trim(),
        lineNumber: line.transactionNumber,
        history: null
      };
      return candidate;
    });
  });
  const candidates = perBatch.flat();
  if (batches.length === 0) warnings.push('No claim batches of this fund were found around these service dates.');
  return { candidates, batchCount: batches.length, warnings: [...new Set(warnings)] };
}

interface HistoryLineRow {
  claim_line_id: string | null;
  claim_line_ids: string[] | null;
  allocated: number | string | null;
  line_status: LineStatus;
  posted_at: string | null;
}

interface RejectionRow {
  id: string;
  claim_line_id: string | null;
  resubmitted_line_id: string | null;
  status: RejectionStatus;
  adjustment_id: string | null;
  adjustment_kind: 'shortfall_transfer' | 'write_off' | null;
  created_at: string;
}

/**
 * What earlier imports did with these claim lines: paid so far, and the latest queue item (also for
 * a line that was resubmitted from it). Empty before the remittance tables exist.
 */
export async function attachHistory(candidates: ClaimCandidate[]): Promise<ClaimCandidate[]> {
  const ids = candidates.map(candidate => candidate.claimLineId);
  if (ids.length === 0) return candidates;
  try {
    const [posted, byLine, byResubmission] = await Promise.all([
      selectByIds<HistoryLineRow>('remittance_lines', 'claim_line_id, claim_line_ids, allocated, line_status, posted_at', 'claim_line_id', ids),
      selectByIds<RejectionRow>('claim_rejections', 'id, claim_line_id, resubmitted_line_id, status, adjustment_id, adjustment_kind, created_at', 'claim_line_id', ids),
      selectByIds<RejectionRow>('claim_rejections', 'id, claim_line_id, resubmitted_line_id, status, adjustment_id, adjustment_kind, created_at', 'resubmitted_line_id', ids)
    ]);
    const adjustmentIds = [...byLine, ...byResubmission].map(row => row.adjustment_id ?? '').filter(Boolean);
    const adjustments = await selectByIds<{ id: string; amount: number | string; reversed_at: string | null }>('invoice_adjustments', 'id, amount, reversed_at', 'id', adjustmentIds);
    const adjustmentById = new Map(adjustments.map(row => [row.id, row]));

    const history = new Map<string, ClaimLineHistory>();
    const entry = (id: string): ClaimLineHistory => {
      if (!history.has(id)) history.set(id, { paidCents: 0, lastStatus: null, rejection: null });
      return history.get(id) as ClaimLineHistory;
    };
    for (const row of posted) {
      if (!row.claim_line_id || !row.posted_at) continue;
      const item = entry(row.claim_line_id);
      item.paidCents += toCents(Number(row.allocated ?? 0));
      item.lastStatus = row.line_status;
    }
    const rejections = [...byLine, ...byResubmission].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const row of rejections) {
      const adjustment = row.adjustment_id ? adjustmentById.get(row.adjustment_id) : undefined;
      const ref: RejectionRef = {
        id: row.id,
        status: row.status,
        adjustmentId: adjustment && !adjustment.reversed_at ? row.adjustment_id : null,
        adjustmentKind: adjustment && !adjustment.reversed_at ? row.adjustment_kind : null,
        adjustmentCents: adjustment && !adjustment.reversed_at ? toCents(Number(adjustment.amount)) : 0
      };
      // The original line and the copy that was resubmitted share the queue item
      for (const id of [row.claim_line_id, row.resubmitted_line_id]) if (id) entry(id).rejection = ref;
    }
    return candidates.map(candidate => ({ ...candidate, history: history.get(candidate.claimLineId) ?? null }));
  } catch (error) {
    if (isRemittanceNotSetUp(error)) return candidates;
    throw error;
  }
}

/** What each invoice still owes per portion (ar_invoice_balances) */
export async function loadInvoiceBalances(invoiceIds: readonly string[]): Promise<Record<string, InvoiceBalance>> {
  const rows = await selectByIds<{ invoice_id: string; medical_aid_outstanding: number | string | null; patient_outstanding: number | string | null }>(
    'ar_invoice_balances', 'invoice_id, medical_aid_outstanding, patient_outstanding', 'invoice_id', invoiceIds
  );
  return Object.fromEntries(rows.map(row => [row.invoice_id, {
    medicalAidOutstandingCents: toCents(Number(row.medical_aid_outstanding ?? 0)),
    patientOutstandingCents: toCents(Number(row.patient_outstanding ?? 0))
  }]));
}

// ---------------------------------------------------------------------------------------------
// Saving and posting (one RPC each)
// ---------------------------------------------------------------------------------------------

export interface SavedDocument {
  document_id: string;
  duplicate: boolean;
  status: 'imported' | 'posted' | 'duplicate';
  posted_from: string | null;
  lines: Array<{ seq: number; id: string }>;
}

export const saveDocument = (payload: Record<string, unknown>) =>
  callRpc<SavedDocument>('remittance_save_document', { p_payload: payload }, 'Saving the remittance');

export const saveMatches = (documentId: string, matches: Array<Record<string, unknown>>) =>
  callRpc<{ saved: number }>('remittance_save_matches', { p_document_id: documentId, p_matches: matches }, 'Saving the matches');

export interface PostResult {
  document_id: string;
  already_posted: boolean;
  receipt_id: string | null;
  receipt_number: string | null;
  allocated: number | string | null;
  unallocated: number | string | null;
  rejections_created: number;
  resolved: number;
  /** The day the money was posted on: the fund's date, or the first open day when that month is closed */
  posted_on?: string | null;
  /** The closed month's name when the date had to move (e.g. "August 2026"), else null */
  closed_month?: string | null;
}

export const postDocument = (documentId: string, payload: Record<string, unknown>) =>
  callRpc<PostResult>('remittance_post_document', { p_document_id: documentId, p_post: payload }, 'Posting the remittance');

// ---------------------------------------------------------------------------------------------
// Imported documents
// ---------------------------------------------------------------------------------------------

export interface DocumentRow {
  id: string;
  file_name: string;
  format: RemittanceDocument['format'];
  kind: RemittanceDocument['kind'];
  fund_code: string | null;
  fund_name: string | null;
  payment_reference: string | null;
  statement_number: string | null;
  payment_date: string | null;
  document_date: string | null;
  total_paid: number | string | null;
  reconciled: boolean;
  status: 'imported' | 'posted' | 'duplicate';
  receipt_id: string | null;
  posted_at: string | null;
  created_at: string;
}

export interface DocumentSummary extends DocumentRow {
  lineCount: number;
  matched: number;
  queued: number;
  receiptNumber: string | null;
  allocatedCents: number;
  unallocatedCents: number;
}

const DOCUMENT_COLUMNS = 'id, file_name, format, kind, fund_code, fund_name, payment_reference, statement_number, payment_date, document_date, total_paid, reconciled, status, receipt_id, posted_at, created_at';

export async function loadDocuments(practiceId: string): Promise<DocumentSummary[]> {
  const { data, error } = await timed(db.from('remittance_documents').select(DOCUMENT_COLUMNS).eq('practice_id', practiceId).order('created_at', { ascending: false }).limit(200), 'Loading remittances');
  if (error) throw Object.assign(new Error(`Could not load the remittances: ${error.message}`), { code: (error as DbError).code });
  const documents = (data ?? []) as unknown as DocumentRow[];
  const ids = documents.map(doc => doc.id);
  const [lines, receipts] = await Promise.all([
    selectByIds<{ document_id: string; match_status: string; posting_status: string }>('remittance_lines', 'document_id, match_status, posting_status', 'document_id', ids),
    selectByIds<{ receipt_id: string; receipt_number: string; allocated: number | string; unallocated: number | string }>('ar_receipt_balances', 'receipt_id, receipt_number, allocated, unallocated', 'receipt_id', documents.map(doc => doc.receipt_id ?? ''))
  ]);
  const receiptById = new Map(receipts.map(row => [row.receipt_id, row]));
  return documents.map(doc => {
    const own = lines.filter(line => line.document_id === doc.id);
    const receipt = doc.receipt_id ? receiptById.get(doc.receipt_id) : undefined;
    return {
      ...doc,
      lineCount: own.length,
      matched: own.filter(line => line.match_status !== 'unmatched').length,
      queued: own.filter(line => line.posting_status === 'queued' || line.posting_status === 'held').length,
      receiptNumber: receipt?.receipt_number ?? null,
      allocatedCents: toCents(Number(receipt?.allocated ?? 0)),
      unallocatedCents: toCents(Number(receipt?.unallocated ?? 0))
    };
  });
}

export interface StoredLine {
  id: string;
  seq: number;
  patient_name: string | null;
  member_number: string | null;
  practice_reference: string | null;
  service_date: string | null;
  tariff_code: string | null;
  claimed: number | string | null;
  paid: number | string;
  line_status: LineStatus;
  reason_codes: string[];
  reason_texts: string[];
  match_status: string;
  match_rule: string | null;
  invoice_id: string | null;
  posting_status: string;
  allocated: number | string;
  shortfall: number | string;
  written_off: number | string;
}

export async function loadDocumentLines(documentId: string): Promise<StoredLine[]> {
  const { data, error } = await timed(db
    .from('remittance_lines')
    .select('id, seq, patient_name, member_number, practice_reference, service_date, tariff_code, claimed, paid, line_status, reason_codes, reason_texts, match_status, match_rule, invoice_id, posting_status, allocated, shortfall, written_off')
    .eq('document_id', documentId)
    .order('seq'), 'Loading the lines');
  if (error) throw new Error(`Could not load the lines: ${error.message}`);
  return (data ?? []) as unknown as StoredLine[];
}

/** Whether these files were imported before (by fingerprint) */
export async function loadImportedHashes(practiceId: string, hashes: readonly string[]): Promise<Record<string, { status: string; fileName: string }>> {
  if (hashes.length === 0) return {};
  try {
    const rows = await selectByIds<{ practice_id: string; file_sha256: string; status: string; file_name: string }>('remittance_documents', 'practice_id, file_sha256, status, file_name', 'file_sha256', hashes);
    return Object.fromEntries(rows.filter(row => row.practice_id === practiceId).map(row => [row.file_sha256, { status: row.status, fileName: row.file_name }]));
  } catch (error) {
    if (isRemittanceNotSetUp(error)) return {};
    throw error;
  }
}

/** Whether this payment was posted before, from any file */
export async function isPaymentPosted(practiceId: string, paymentKey: string | null): Promise<boolean> {
  if (!paymentKey) return false;
  try {
    const { data, error } = await timed(db.from('remittance_documents').select('id').eq('practice_id', practiceId).eq('payment_key', paymentKey).eq('status', 'posted').not('receipt_id', 'is', null).limit(1), 'Checking the payment');
    if (error) throw Object.assign(new Error(error.message), { code: (error as DbError).code });
    return (data ?? []).length > 0;
  } catch (error) {
    if (isRemittanceNotSetUp(error)) return false;
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// The rejection queue
// ---------------------------------------------------------------------------------------------

export interface RejectionItem {
  id: string;
  document_id: string;
  remittance_line_id: string;
  claim_line_id: string | null;
  invoice_id: string | null;
  patient_id: string | null;
  fund_code: string | null;
  service_date: string | null;
  tariff_code: string | null;
  claimed: number | string;
  paid: number | string;
  at_stake: number | string;
  reason_codes: string[];
  fund_reason: string | null;
  category: ReasonCategory;
  plain_reason: string;
  suggested_action: SuggestedAction;
  fix_hint: string | null;
  needs_approval: boolean;
  status: RejectionStatus;
  follow_up_on: string | null;
  resubmit_by: string | null;
  resubmitted_batch_id: string | null;
  resubmission_flag: string | null;
  adjustment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  /** Added after loading */
  patientName: string;
  invoiceNumber: string | null;
  linePatientName: string | null;
}

const REJECTION_COLUMNS = 'id, document_id, remittance_line_id, claim_line_id, invoice_id, patient_id, fund_code, service_date, tariff_code, claimed, paid, at_stake, reason_codes, fund_reason, category, plain_reason, suggested_action, fix_hint, needs_approval, status, follow_up_on, resubmit_by, resubmitted_batch_id, resubmission_flag, adjustment_id, notes, created_at, updated_at, resolved_at';

/** One patient's open and waiting rejections, for the notice in the patient file; null while the queue is not set up. */
export async function loadPatientOpenRejections(practiceId: string, patientId: string): Promise<OpenRejectionRow[] | null> {
  const { data, error } = await timed(db
    .from('claim_rejections')
    .select('at_stake, resubmit_by')
    .eq('practice_id', practiceId)
    .eq('patient_id', patientId)
    .in('status', ['open', 'waiting'])
    .limit(200), "Loading the patient's rejected claims");
  if (error) {
    if (isRemittanceNotSetUp(error)) return null;
    throw new Error(`Could not load the patient's rejected claims: ${error.message}`);
  }
  return (data ?? []) as unknown as OpenRejectionRow[];
}

export async function loadRejections(practiceId: string, scope: 'open' | 'done'): Promise<RejectionItem[]> {
  const statuses = scope === 'open' ? ['open', 'waiting'] : ['resubmitted', 'billed_patient', 'written_off', 'resolved_by_payment', 'closed'];
  const { data, error } = await timed(db
    .from('claim_rejections')
    .select(REJECTION_COLUMNS)
    .eq('practice_id', practiceId)
    .in('status', statuses)
    .order(scope === 'open' ? 'resubmit_by' : 'updated_at', { ascending: scope === 'open', nullsFirst: false })
    .limit(500), 'Loading the rejection queue');
  if (error) throw Object.assign(new Error(`Could not load the rejection queue: ${error.message}`), { code: (error as DbError).code });
  const rows = (data ?? []) as unknown as Array<Omit<RejectionItem, 'patientName' | 'invoiceNumber' | 'linePatientName'>>;
  const [patients, invoices, lines] = await Promise.all([
    selectByIds<{ id: string; first_name: string | null; last_name: string | null }>('patients', 'id, first_name, last_name', 'id', rows.map(row => row.patient_id ?? '')),
    selectByIds<{ id: string; invoice_number: string | null }>('invoices_enhanced', 'id, invoice_number', 'id', rows.map(row => row.invoice_id ?? '')),
    selectByIds<{ id: string; patient_name: string | null }>('remittance_lines', 'id, patient_name', 'id', rows.map(row => row.remittance_line_id))
  ]);
  const nameById = new Map(patients.map(row => [row.id, [row.first_name, row.last_name].map(part => (part ?? '').trim()).filter(Boolean).join(' ')]));
  const invoiceById = new Map(invoices.map(row => [row.id, row.invoice_number]));
  const lineName = new Map(lines.map(row => [row.id, row.patient_name]));
  return rows.map(row => ({
    ...row,
    patientName: (row.patient_id && nameById.get(row.patient_id)) || 'Not matched to a patient',
    invoiceNumber: row.invoice_id ? invoiceById.get(row.invoice_id) ?? null : null,
    linePatientName: lineName.get(row.remittance_line_id) ?? null
  }));
}

export interface ClaimLineDetail {
  tooth_numbers: string | null;
  diagnostic_code: string | null;
  authorisation_number: string | null;
  medical_aid_membership_number: string | null;
  bhf_tariff_code: string | null;
  free_text: string | null;
}

export async function loadClaimLineDetail(claimLineId: string): Promise<ClaimLineDetail | null> {
  const { data, error } = await timed(db
    .from('batch_details')
    .select('tooth_numbers, diagnostic_code, authorisation_number, medical_aid_membership_number, bhf_tariff_code, free_text')
    .eq('id', claimLineId)
    .maybeSingle(), 'Loading the claim line');
  if (error) throw new Error(`Could not load the claim line: ${error.message}`);
  return (data ?? null) as ClaimLineDetail | null;
}

export interface RejectionEvent {
  id: number;
  action: string;
  note: string | null;
  actor: string | null;
  occurred_at: string;
}

export async function loadRejectionEvents(rejectionId: string): Promise<RejectionEvent[]> {
  const { data, error } = await timed(db.from('claim_rejection_events').select('id, action, note, actor, occurred_at').eq('rejection_id', rejectionId).order('occurred_at'), 'Loading the history');
  if (error) throw new Error(`Could not load the history: ${error.message}`);
  return (data ?? []) as unknown as RejectionEvent[];
}

export type RejectionAction = 'resubmit' | 'bill_patient' | 'write_off' | 'wait' | 'reopen' | 'close' | 'note';

export const actOnRejection = (rejectionId: string, action: RejectionAction, payload: Record<string, unknown>) =>
  callRpc<{ id: string; status: string }>('claim_rejection_act', { p_rejection_id: rejectionId, p_action: action, p_payload: payload }, 'Saving the action');
