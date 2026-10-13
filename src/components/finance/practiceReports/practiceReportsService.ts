/**
 * Data for Finance > Reports' own reports: practice transactions (R5), cash flow per practitioner (R7), ICD-10
 * diagnoses (R30), the claims dashboard (G10), a claim line's story (F10) and who did what (R17, Q8), and the record of
 * every report download or print. Every read is scoped to the practice (by practice_id, or by ids that come from
 * practice-scoped rows); the report functions check again that the caller works in the practice and may open Finance
 * (who did what: is one of its administrators). Before a function exists the loaders say 'not_set_up'.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import {
  normalizeInvoice,
  toCents,
  type DateRange,
  type LedgerInvoice,
  type RawInvoiceRow
} from '../../../services/ledgerService';
import { lookupIcd10Codes } from '../../../services/icd10Service';
import { loadPracticeStaff } from '../../../services/invoiceContextService';
import { INVOICE_COLUMNS, isArNotSetUp } from '../receipts/arService';
import { loadLedgerEntries } from '../controls/controlsService';
import { errorText, fetchByIds, fetchPages, timed } from '../debtors/debtorsService';
import { loadBatches, loadOwedByBatch, loadPracticeInfo, loadSilentFundDays } from '../claims/claimsService';
import { silentBatches, silentFunds, type SilentFund } from '../claims/batchFollowUp';
import { normalizeCashPart, type CashPart, type RawCashPart } from './cashByPractitioner';
import type { TransactionSources } from './practiceTransactions';
import type { DiagnosisLineRow } from './diagnosisSummary';
import type { RawMonthFundRow, RejectionFact } from './claimsDashboard';
import type { RawStoryEvent } from './claimLineStory';
import type { RawActivityRow } from './userActivity';
import type { BatchInfo } from './invoicesPerFund';
import type { ReasonCategory } from '../../../utils/remittance/reasonCodes';

// The generated database types do not know the report functions and newer tables
const db = supabase as unknown as SupabaseClient;

export type ReportLoad<T> =
  | { state: 'ready'; data: T }
  | { state: 'not_set_up' }
  | { state: 'error'; error: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function assertRange(range: DateRange): void {
  if (!DATE_KEY.test(range.startKey) || !DATE_KEY.test(range.endKey)) throw new Error('The selected period is not a valid date range');
}

/** Runs a loader, turning "the function or table is not there yet" into not_set_up and anything else into its words */
async function settle<T>(label: string, task: () => Promise<T>): Promise<ReportLoad<T>> {
  try {
    return { state: 'ready', data: await task() };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up' };
    return { state: 'error', error: errorText(error, `Could not load ${label}`) };
  }
}

/** Every page of a report function's rows (PostgREST returns at most 1,000 per request) */
const rpcPages = <T>(label: string, name: string, args: Record<string, unknown>): Promise<T[]> =>
  timed(fetchPages<T>(label, (from, to) => db.rpc(name, args).range(from, to)), label);

/** Names of the practice's staff by user id (practitioners and everyone who posts) */
export async function loadStaffNames(practiceId: string): Promise<{ names: Record<string, string>; staff: Array<{ id: string; name: string; role: string | null; active: boolean }> }> {
  const members = await loadPracticeStaff(practiceId);
  const staff = members.map(member => ({
    id: member.id,
    name: member.full_name?.trim() || 'Staff member',
    role: member.role ?? null,
    active: member.is_active !== false
  }));
  return { names: Object.fromEntries(staff.map(member => [member.id, member.name])), staff };
}

async function loadPatientNames(practiceId: string, patientIds: readonly (string | null)[]): Promise<Record<string, string>> {
  const ids = [...new Set(patientIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return {};
  const rows = await timed(fetchByIds<{ id: string; first_name: string | null; last_name: string | null }>(ids, 'patients', (chunk, from, to) => db
    .from('patients').select('id, first_name, last_name').eq('practice_id', practiceId).in('id', chunk).order('id').range(from, to)), 'patients');
  return Object.fromEntries(rows.map(row => [row.id, [row.first_name, row.last_name].map(part => part?.trim()).filter(Boolean).join(' ') || 'Unnamed patient']));
}

// ---------------------------------------------------------------------------------------------
// R5 practice transactions
// ---------------------------------------------------------------------------------------------

export interface TransactionsData {
  sources: TransactionSources;
  patientNames: Record<string, string>;
}

/** The ledger entries of the period (the month end's loader), the invoices they are on, and whom each payment paid */
export const loadTransactions = (practiceId: string, range: DateRange): Promise<ReportLoad<TransactionsData>> =>
  settle('the transactions', async () => {
    assertRange(range);
    const entries = await loadLedgerEntries(practiceId, range);
    const standing = await timed(fetchByIds<{ receipt_id: string; invoice_id: string }>(entries.receipts.map(r => r.id), 'allocations', (chunk, from, to) => db
      .from('receipt_allocations').select('receipt_id, invoice_id').eq('practice_id', practiceId).is('reversed_at', null).in('receipt_id', chunk).order('id').range(from, to)), 'allocations');
    const known = new Map<string, LedgerInvoice>(entries.invoices.map(invoice => [invoice.id, invoice]));
    const missing = [...new Set([...standing.map(a => a.invoice_id), ...entries.adjustments.map(a => a.invoiceId)])]
      .filter((id): id is string => !!id && !known.has(id));
    const more = await timed(fetchByIds<RawInvoiceRow>(missing, 'invoices', (chunk, from, to) => db
      .from('invoices_enhanced').select(INVOICE_COLUMNS).eq('practice_id', practiceId).in('id', chunk).order('id').range(from, to)), 'invoices');
    more.map(normalizeInvoice).forEach(invoice => known.set(invoice.id, invoice));
    const allocatedPractitioners = new Map<string, Array<string | null>>();
    for (const allocation of standing) {
      const list = allocatedPractitioners.get(allocation.receipt_id) ?? [];
      list.push(known.get(allocation.invoice_id)?.practitionerId ?? null);
      allocatedPractitioners.set(allocation.receipt_id, list);
    }
    const invoices = [...known.values()];
    const patientNames = await loadPatientNames(practiceId, [
      ...invoices.map(i => i.patientId), ...entries.receipts.map(r => r.patientId), ...entries.adjustments.map(a => a.patientId)
    ]).catch(() => ({} as Record<string, string>));
    return { sources: { invoices, receipts: entries.receipts, adjustments: entries.adjustments, allocatedPractitioners }, patientNames };
  });

// ---------------------------------------------------------------------------------------------
// R7 cash flow per practitioner
// ---------------------------------------------------------------------------------------------

export const loadCashParts = (practiceId: string, range: DateRange): Promise<ReportLoad<{ parts: CashPart[]; patientNames: Record<string, string> }>> =>
  settle('the payments', async () => {
    assertRange(range);
    const rows = await rpcPages<RawCashPart>('the payments', 'report_cash_by_practitioner', { p_practice_id: practiceId, p_from: range.startKey, p_to: range.endKey });
    const parts = rows.map(normalizeCashPart).filter((part): part is CashPart => part !== null);
    const patientNames = await loadPatientNames(practiceId, parts.map(part => part.patientId)).catch(() => ({} as Record<string, string>));
    return { parts, patientNames };
  });

// ---------------------------------------------------------------------------------------------
// R18 invoices per fund: the claim batches of the period's invoices
// ---------------------------------------------------------------------------------------------

export async function loadBatchInfo(batchIds: readonly string[]): Promise<Map<string, BatchInfo>> {
  const rows = await timed(fetchByIds<{ id: string; batch_number: number | null; sent_at: string | null; medical_aid_reference: string | null }>(batchIds, 'claim batches', (chunk, from, to) => db
    .from('batch_headers').select('id, batch_number, sent_at, medical_aid_reference').in('id', chunk).order('id').range(from, to)), 'claim batches');
  return new Map(rows.map(row => [row.id, { id: row.id, number: row.batch_number, sentAt: row.sent_at, fundReference: row.medical_aid_reference }]));
}

// ---------------------------------------------------------------------------------------------
// R30 ICD-10 diagnoses
// ---------------------------------------------------------------------------------------------

export const loadDiagnosisLines = (practiceId: string, range: DateRange): Promise<ReportLoad<{ lines: DiagnosisLineRow[]; descriptions: Map<string, string> }>> =>
  settle('the diagnosis codes', async () => {
    assertRange(range);
    // The client reads the embedded invoice as a list; PostgREST returns the one invoice of a line as an object
    const lines = await timed(fetchPages<DiagnosisLineRow>('the diagnosis codes', (from, to) => db
      .from('invoice_services')
      .select('icd10_primary, icd10_secondary, practitioner_id, invoice:invoices_enhanced!inner(id, visit_id, patient_id, practitioner_id, payment_status, practice_id, issue_date)')
      .eq('invoice.practice_id', practiceId)
      .gte('invoice.issue_date', range.startKey)
      .lte('invoice.issue_date', range.endKey)
      // A line's other codes need a main one (the database checks it), so lines without one carry none
      .not('icd10_primary', 'is', null)
      .order('id')
      .range(from, to) as unknown as PromiseLike<{ data: DiagnosisLineRow[] | null; error: { code?: string; message?: string } | null }>), 'the diagnosis codes');
    const codes = lines.flatMap(line => [line.icd10_primary ?? '', ...(line.icd10_secondary ?? [])]).map(code => code.trim().toUpperCase()).filter(Boolean);
    const lookup = codes.length > 0 ? await lookupIcd10Codes(codes) : null;
    const descriptions = new Map<string, string>();
    lookup?.entries.forEach((entry, code) => descriptions.set(code, entry.description));
    return { lines, descriptions };
  });

// ---------------------------------------------------------------------------------------------
// G10 claims dashboard
// ---------------------------------------------------------------------------------------------

export interface ClaimsDashboardData {
  months: RawMonthFundRow[];
  rejections: RejectionFact[];
  silent: SilentFund[];
  /** Said beside the silent funds when what they owe could not be read */
  silentWarning: string | null;
}

const OPEN_REJECTION = ['open', 'waiting'];
const CATEGORIES: readonly ReasonCategory[] = ['info', 'duplicate', 'fixable', 'hold', 'patient_liable', 'write_off', 'rate_shortfall', 'review'];

export const loadClaimsDashboard = (practiceId: string, range: DateRange, todayKey: string): Promise<ReportLoad<ClaimsDashboardData>> =>
  settle('the claims dashboard', async () => {
    assertRange(range);
    const fromIso = new Date(`${range.startKey}T00:00:00`).toISOString();
    const toIso = new Date(`${range.endKey}T23:59:59.999`).toISOString();
    const [months, rejectionRows, practice] = await Promise.all([
      rpcPages<RawMonthFundRow>('the claims per month', 'report_claims_by_month', { p_practice_id: practiceId, p_from: range.startKey, p_to: range.endKey }),
      timed(fetchPages<{ id: string; claim_line_id: string | null; category: string; plain_reason: string; at_stake: number | string | null; status: string }>('the rejections', (from, to) => db
        .from('claim_rejections').select('id, claim_line_id, category, plain_reason, at_stake, status').eq('practice_id', practiceId)
        .gte('created_at', fromIso).lte('created_at', toIso).order('id').range(from, to)), 'the rejections'),
      loadPracticeInfo(practiceId)
    ]);
    // The silent funds are the claims screen's own alert, as at today (never the period's)
    const batches = await loadBatches(practice);
    const sent = batches.filter(batch => batch.sent_at);
    const [{ owed, warning }, { settings }] = await Promise.all([loadOwedByBatch(practiceId, sent.map(batch => batch.id)), loadSilentFundDays(practiceId)]);
    return {
      months,
      rejections: rejectionRows.map(row => ({
        id: row.id,
        claimLineId: row.claim_line_id,
        category: CATEGORIES.find(category => category === row.category) ?? 'review',
        plainReason: row.plain_reason,
        atStakeCents: toCents(row.at_stake),
        open: OPEN_REJECTION.includes(row.status)
      })),
      silent: silentFunds(silentBatches(sent, owed, todayKey, settings)),
      silentWarning: warning
    };
  });

export interface BatchListItem {
  id: string;
  number: number | null;
  fund: string | null;
  sentAt: string | null;
  totalCents: number;
  lines: number | null;
}

/** The batches behind a dashboard figure, newest first */
export async function loadBatchList(batchIds: readonly string[]): Promise<BatchListItem[]> {
  const rows = await timed(fetchByIds<{ id: string; batch_number: number | null; medical_aid_reference: string | null; sent_at: string | null; total_amount: number | string | null; total_invoices: number | null }>(batchIds, 'claim batches', (chunk, from, to) => db
    .from('batch_headers').select('id, batch_number, medical_aid_reference, sent_at, total_amount, total_invoices').in('id', chunk).order('id').range(from, to)), 'claim batches');
  return rows
    .map(row => ({ id: row.id, number: row.batch_number, fund: row.medical_aid_reference, sentAt: row.sent_at, totalCents: toCents(row.total_amount), lines: row.total_invoices }))
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''));
}

export interface ClaimLineListItem {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  tariffCode: string | null;
  serviceDate: string | null;
  amountCents: number;
  batchNumber: number | null;
  flag: string | null;
}

/** Claim lines by id (a refusal reason's lines), or every claim line of one invoice */
export async function loadClaimLines(filter: { ids: readonly string[] } | { invoiceId: string }): Promise<ClaimLineListItem[]> {
  type Row = { id: string; invoice_id: string | null; invoice_number: string | null; bhf_tariff_code: string | null; service_date: string | null; service_amount: number | string | null; resubmission_flag: string | null; batch: { batch_number: number | null; sent_at: string | null } | null };
  const columns = 'id, invoice_id, invoice_number, bhf_tariff_code, service_date, service_amount, resubmission_flag, batch:batch_headers!inner(batch_number, sent_at)';
  // The embedded batch is one row per line (the client types it as a list)
  type Page = PromiseLike<{ data: Row[] | null; error: { code?: string; message?: string } | null }>;
  const rows = 'ids' in filter
    ? await timed(fetchByIds<Row>(filter.ids, 'claim lines', (chunk, from, to) => db.from('batch_details').select(columns).in('id', chunk).order('id').range(from, to) as unknown as Page), 'claim lines')
    : await timed(fetchPages<Row>('claim lines', (from, to) => db.from('batch_details').select(columns).eq('invoice_id', filter.invoiceId).order('id').range(from, to) as unknown as Page), 'claim lines');
  // In the order they were sent (lines still waiting in an open batch last)
  const sentAt = (row: Row) => row.batch?.sent_at ?? '9999';
  return [...rows]
    .sort((a, b) => sentAt(a).localeCompare(sentAt(b)) || (a.bhf_tariff_code ?? '').localeCompare(b.bhf_tariff_code ?? ''))
    .map(row => ({
      id: row.id,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number?.trim() || null,
      tariffCode: row.bhf_tariff_code,
      serviceDate: row.service_date,
      amountCents: toCents(row.service_amount),
      batchNumber: row.batch?.batch_number ?? null,
      flag: row.resubmission_flag?.trim() || null
    }));
}

// ---------------------------------------------------------------------------------------------
// F10 one claim line's story
// ---------------------------------------------------------------------------------------------

export const loadClaimLineStory = (claimLineId: string): Promise<ReportLoad<RawStoryEvent[]>> =>
  settle('the claim line\'s story', () => rpcPages<RawStoryEvent>('the claim line\'s story', 'claim_line_story', { p_claim_line_id: claimLineId }));

// ---------------------------------------------------------------------------------------------
// R17, Q8 who did what
// ---------------------------------------------------------------------------------------------

export const loadUserActivity = (practiceId: string, userId: string, range: DateRange): Promise<ReportLoad<{ rows: RawActivityRow[]; patientNames: Record<string, string> }>> =>
  settle('who did what', async () => {
    assertRange(range);
    const rows = await rpcPages<RawActivityRow>('who did what', 'report_user_activity', { p_practice_id: practiceId, p_user_id: userId, p_from: range.startKey, p_to: range.endKey });
    const patientNames = await loadPatientNames(practiceId, rows.map(row => row.patient_id)).catch(() => ({} as Record<string, string>));
    return { rows, patientNames };
  });

// ---------------------------------------------------------------------------------------------
// Downloads and prints are recorded (Q8)
// ---------------------------------------------------------------------------------------------

export interface ReportExport {
  report: string;
  format: 'csv' | 'print';
  range: DateRange | null;
  rows: number;
  /** Ids and choices only (a fund code, a type, a practitioner's or user's id), never names or amounts */
  filters?: Record<string, string | number | boolean | null>;
}

/**
 * Records a download or print of a Finance report (report_exports). Never blocks or fails the download: when it cannot
 * be recorded (not set up yet, offline) the report still downloads and the reason goes to the console.
 */
export async function logReportExport(practiceId: string, entry: ReportExport): Promise<void> {
  try {
    const { error } = await db.rpc('log_report_export', {
      p_practice_id: practiceId,
      p_report: entry.report,
      p_format: entry.format,
      p_from: entry.range?.startKey ?? null,
      p_to: entry.range?.endKey ?? null,
      p_rows: entry.rows,
      p_filters: entry.filters ?? {}
    });
    if (error && !isArNotSetUp(error)) console.warn('Reports: the download was not recorded', error.message);
  } catch (error) {
    console.warn('Reports: the download was not recorded', error);
  }
}
