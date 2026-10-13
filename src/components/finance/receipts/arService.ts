import type { SupabaseClient } from '@supabase/supabase-js';
import { plainWords } from '../../../utils/plainErrors';
import { supabase } from '../../../lib/supabase';
import { withTimeout } from '../../../services/financialKpiService';
import { readAllPages } from '../../../lib/pagedRows';
import { patientSearchFields, patientSearchRank, type PatientSearchRank } from '../../../utils/patientSearch';
import {
  coversByAllocation,
  normalizeAdjustment,
  normalizeAllocation,
  normalizeAllocationCover,
  normalizeInvoice,
  normalizeInvoiceBalance,
  normalizeInvoiceLineBalance,
  normalizeReceipt,
  type AllocationCover,
  type ArAdjustment,
  type ArAllocation,
  type ArInvoiceBalance,
  type ArReceipt,
  type InvoiceLineOpen,
  type LedgerInvoice,
  type RawAdjustmentRow,
  type RawAllocationLineRow,
  type RawAllocationRow,
  type RawInvoiceBalanceRow,
  type RawInvoiceLineBalanceRow,
  type RawInvoiceRow,
  type RawReceiptRow
} from '../../../services/ledgerService';
import { buildAdjustmentPayload, buildAllocationLines, buildReceiptPayload, type AdjustmentInput, type ReceiptInput } from './arPayloads';
import { fundOfClaim, type FundRecord } from './fundPaymentKeying';
import { invoicesBilledToAccounts } from '../../../services/accountBilledInvoices';
import { useAuthStore } from '../../../stores/authStore';
import { NO_DISCOUNTS_MESSAGE, adjustmentCorrection, moneyCorrectionRefusal, type MoneyCorrection } from '../../../services/ledger/moneyRights';

/**
 * Supabase access for receipts, allocations and adjustments. Reads go to the tables and views of
 * proposals/2026-10-07-receipts-and-allocations.sql (RLS: the user's practice); every write is one
 * RPC call, so a receipt and all its allocations are saved together or not at all. When the
 * tables do not exist yet, loaders say 'not_set_up' and the screens fall back to marking invoices paid.
 */
const db = supabase as unknown as SupabaseClient;

const TIMEOUT_MS = 25000;
const PAGE_SIZE = 1000;
const ID_CHUNK = 100;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const RECEIPT_COLUMNS =
  'receipt_id, practice_id, receipt_number, payer_type, patient_id, fund_name, payer_name, method, amount, received_on, reference, source, notes, created_by, created_at, reversed_at, reversed_by, reversal_reason, allocated, refunded, unallocated';
export const ALLOCATION_COLUMNS = 'id, receipt_id, invoice_id, portion, amount, created_by, created_at, reversed_at, reversed_by, reversal_reason';
export const ADJUSTMENT_COLUMNS =
  'id, adjustment_number, kind, invoice_id, receipt_id, patient_id, portion, amount, method, reason_code, reason, approved_by, effective_on, created_by, created_at, reversed_at, reversed_by, reversal_reason';
export const BALANCE_COLUMNS =
  'invoice_id, patient_id, invoice_number, issue_date, due_date, payment_status, batch_id, medical_aid_billed, patient_billed, medical_aid_allocated, patient_allocated, medical_aid_credited, patient_credited, medical_aid_written_off, patient_written_off, medical_aid_journals, patient_journals, shortfall_transferred, medical_aid_outstanding, patient_outstanding, has_activity, has_entries';
export const INVOICE_COLUMNS = 'id, invoice_number, patient_id, visit_id, practitioner_id, batch_id, issue_date, due_date, total, medical_aid_total, patient_total, payment_status, payment_method, updated_at, created_at';
export const ALLOCATION_LINE_COLUMNS = 'id, allocation_id, invoice_line_id, portion, amount, line_code, line_description, line_date, source';
export const INVOICE_LINE_BALANCE_COLUMNS =
  'invoice_line_id, invoice_id, code, description, line_date, line_order, billed, medical_aid_billed, patient_billed, medical_aid_paid, patient_paid, unpaid, medical_aid_credited, patient_credited';

interface DbError {
  code?: string;
  message?: string;
}

/** A Supabase error kept with its code, so a missing table can be told apart from a failure */
export class ArQueryError extends Error {
  readonly code: string | null;
  constructor(label: string, error: DbError) {
    super(`Could not load ${label}: ${error.message ?? 'unknown error'}`);
    this.code = error.code ?? null;
  }
}

const MISSING_CODES = ['42P01', 'PGRST205', 'PGRST202', '42883'];
const MISSING_MESSAGE = /relation .* does not exist|could not find the (table|function)|schema cache/i;

/** True for errors that mean the receipts tables or functions are not in the database yet */
export function isArNotSetUp(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  return (!!code && MISSING_CODES.includes(code)) || (!!message && MISSING_MESSAGE.test(message));
}

export const AR_NOT_SET_UP_MESSAGE =
  'Receipts are not set up in this database yet (proposals/2026-10-07-receipts-and-allocations.sql). Until then, payments are recorded by marking invoices paid.';

type PageResult<T> = PromiseLike<{ data: T[] | null; error: DbError | null }>;

async function fetchPages<T>(label: string, build: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  return readAllPages(PAGE_SIZE, build, error => new ArQueryError(label, error));
}

const chunks = <T>(items: readonly T[], size = ID_CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

async function fetchByIds<T>(ids: readonly string[], label: string, build: (chunk: string[], from: number, to: number) => PageResult<T>): Promise<T[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const pages = await Promise.all(chunks(unique).map(chunk => fetchPages<T>(label, (from, to) => build(chunk, from, to))));
  return pages.flat();
}

const timed = <T>(task: Promise<T>, label: string): Promise<T> =>
  withTimeout(task, TIMEOUT_MS, `Loading ${label} took too long. Check your connection and try again.`);

const errorText = (error: unknown, fallback: string): string => (error instanceof Error && error.message ? plainWords(error.message) : fallback);

const toBalanceMap = (rows: RawInvoiceBalanceRow[]): Record<string, ArInvoiceBalance> =>
  Object.fromEntries(rows.map(row => [row.invoice_id, normalizeInvoiceBalance(row)]));

// ---------------------------------------------------------------------------------------------
// What each payment covered, line by line (proposals/2026-10-09-allocation-lines.sql). Until that
// table exists the screens show allocations per invoice, as before (null = not set up).
// ---------------------------------------------------------------------------------------------

/** With the practitioner each part paid (proposals/2026-10-12-allocation-practitioner.sql); a literal, so the query stays typed */
const ALLOCATION_LINE_COLUMNS_WITH_PRACTITIONER =
  'id, allocation_id, invoice_line_id, portion, amount, line_code, line_description, line_date, source, practitioner_id';

/** A column the query names is not in the database yet (Postgres undefined_column) */
const isMissingColumn = (error: unknown): boolean =>
  !!error && typeof error === 'object' &&
  ((error as DbError).code === '42703' || /column .* does not exist/i.test((error as DbError).message ?? ''));

/** What these allocations covered, by allocation id; null before allocation lines exist */
export async function loadAllocationCovers(allocationIds: readonly string[]): Promise<Map<string, AllocationCover[]> | null> {
  if (allocationIds.length === 0) return new Map();
  const readWithPractitioner = () => fetchByIds<RawAllocationLineRow>(allocationIds, 'what each payment covered', (ids, from, to) => db
    .from('receipt_allocation_lines').select(ALLOCATION_LINE_COLUMNS_WITH_PRACTITIONER).in('allocation_id', ids).order('created_at').order('id').range(from, to));
  const readWithoutPractitioner = () => fetchByIds<RawAllocationLineRow>(allocationIds, 'what each payment covered', (ids, from, to) => db
    .from('receipt_allocation_lines').select(ALLOCATION_LINE_COLUMNS).in('allocation_id', ids).order('created_at').order('id').range(from, to));
  try {
    let rows: RawAllocationLineRow[];
    try {
      rows = await readWithPractitioner();
    } catch (error) {
      // Before the practitioner column exists the covers still show, without practitioners
      if (!isMissingColumn(error)) throw error;
      rows = await readWithoutPractitioner();
    }
    return coversByAllocation(rows.map(normalizeAllocationCover).filter((row): row is AllocationCover => row !== null));
  } catch (error) {
    if (isArNotSetUp(error)) return null;
    throw error;
  }
}

/** The allocations with what each covered; unchanged before allocation lines exist or when they cannot be read */
export async function withCovers(allocations: ArAllocation[]): Promise<ArAllocation[]> {
  try {
    const covers = await loadAllocationCovers(allocations.map(allocation => allocation.id));
    return covers ? allocations.map(allocation => ({ ...allocation, covers: covers.get(allocation.id) ?? [] })) : allocations;
  } catch (error) {
    // The payments still show per invoice; only the line detail is missing
    console.warn('What each payment covered could not be loaded', error);
    return allocations;
  }
}

/** The lines of these invoices with what is billed, paid and unpaid on each, by invoice id; null before allocation lines exist */
export async function loadInvoiceLines(invoiceIds: readonly string[]): Promise<Record<string, InvoiceLineOpen[]> | null> {
  if (invoiceIds.length === 0) return {};
  try {
    const rows = await timed(fetchByIds<RawInvoiceLineBalanceRow>(invoiceIds, 'invoice lines', (ids, from, to) => db
      .from('ar_invoice_line_balances').select(INVOICE_LINE_BALANCE_COLUMNS).in('invoice_id', ids).order('invoice_line_id').range(from, to)), 'invoice lines');
    const byInvoice: Record<string, InvoiceLineOpen[]> = {};
    for (const line of rows.map(normalizeInvoiceLineBalance)) {
      if (line) byInvoice[line.invoiceId] = [...(byInvoice[line.invoiceId] ?? []), line];
    }
    return byInvoice;
  } catch (error) {
    if (isArNotSetUp(error)) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// Finance workspace: receipts of the period, refunds, and the balances of invoices with entries
// ---------------------------------------------------------------------------------------------

export interface ArWorkspace {
  state: 'ready' | 'not_set_up' | 'error';
  error: string | null;
  /** Receipts received since the window start, plus older ones with money still unallocated */
  receipts: ArReceipt[];
  /** Refunds paid since the window start */
  refunds: ArAdjustment[];
  /** Ledger balances of invoices that have entries (others still follow their status) */
  balances: Record<string, ArInvoiceBalance>;
}

export const emptyArWorkspace = (state: ArWorkspace['state'], error: string | null = null): ArWorkspace =>
  ({ state, error, receipts: [], refunds: [], balances: {} });

export async function loadArWorkspace(practiceId: string, windowStartKey: string): Promise<ArWorkspace> {
  if (!DATE_KEY.test(windowStartKey)) return emptyArWorkspace('error', 'The selected period is not a valid date range');
  try {
    const [receiptRows, refundRows, balanceRows] = await timed(Promise.all([
      fetchPages<RawReceiptRow>('receipts', (from, to) => db
        .from('ar_receipt_balances')
        .select(RECEIPT_COLUMNS)
        .eq('practice_id', practiceId)
        .or(`received_on.gte.${windowStartKey},unallocated.gt.0`)
        .order('received_on', { ascending: false })
        .order('receipt_id')
        .range(from, to)),
      fetchPages<RawAdjustmentRow>('refunds', (from, to) => db
        .from('invoice_adjustments')
        .select(ADJUSTMENT_COLUMNS)
        .eq('practice_id', practiceId)
        .eq('kind', 'refund')
        .gte('effective_on', windowStartKey)
        .order('id')
        .range(from, to)),
      // Invoices without entries follow their status, so only invoices with entries are read:
      // those issued in the window (collections) and older ones still owing or owed (aging)
      fetchPages<RawInvoiceBalanceRow>('invoice balances', (from, to) => db
        .from('ar_invoice_balances')
        .select(BALANCE_COLUMNS)
        .eq('practice_id', practiceId)
        .eq('has_entries', true)
        .or(`issue_date.gte.${windowStartKey},issue_date.is.null,outstanding.neq.0`)
        .order('invoice_id')
        .range(from, to))
    ]), 'receipts');
    return {
      state: 'ready',
      error: null,
      receipts: receiptRows.map(normalizeReceipt),
      refunds: refundRows.map(normalizeAdjustment).filter((row): row is ArAdjustment => row !== null),
      balances: toBalanceMap(balanceRows)
    };
  } catch (error) {
    if (isArNotSetUp(error)) return emptyArWorkspace('not_set_up');
    console.error('Finance: could not load receipts', error);
    return emptyArWorkspace('error', errorText(error, 'Could not load receipts'));
  }
}

// ---------------------------------------------------------------------------------------------
// One patient's account (patient file, Receive payment, statement)
// ---------------------------------------------------------------------------------------------

export interface PatientAccount {
  state: 'ready' | 'not_set_up';
  invoices: LedgerInvoice[];
  balances: Record<string, ArInvoiceBalance>;
  /** The patient's own receipts and the receipts (e.g. a fund's) that paid their invoices */
  receipts: ArReceipt[];
  allocations: ArAllocation[];
  adjustments: ArAdjustment[];
}

export async function loadPatientAccount(practiceId: string, patientId: string): Promise<PatientAccount> {
  const invoiceRows = await timed(fetchPages<RawInvoiceRow>('invoices', (from, to) => db
    .from('invoices_enhanced')
    .select(INVOICE_COLUMNS)
    .eq('practice_id', practiceId)
    .eq('patient_id', patientId)
    .order('issue_date', { ascending: true })
    .order('id')
    .range(from, to)), 'invoices');
  // Invoices billed to a company or fund account are the account's to pay, never the patient's (parity A14, A19)
  const allInvoices = invoiceRows.map(normalizeInvoice);
  const billedToAccounts = await invoicesBilledToAccounts(allInvoices);
  const invoices = allInvoices.filter(invoice => !billedToAccounts.has(invoice.id));
  const invoiceIds = invoices.map(invoice => invoice.id);

  try {
    const [allBalanceRows, ownReceiptRows, invoiceAllocations, invoiceAdjustments] = await timed(Promise.all([
      fetchPages<RawInvoiceBalanceRow>('balances', (from, to) => db
        .from('ar_invoice_balances').select(BALANCE_COLUMNS).eq('practice_id', practiceId).eq('patient_id', patientId).order('invoice_id').range(from, to)),
      fetchPages<RawReceiptRow>('receipts', (from, to) => db
        .from('ar_receipt_balances').select(RECEIPT_COLUMNS).eq('practice_id', practiceId).eq('patient_id', patientId).order('receipt_id').range(from, to)),
      fetchByIds<RawAllocationRow>(invoiceIds, 'allocations', (ids, from, to) => db
        .from('receipt_allocations').select(ALLOCATION_COLUMNS).in('invoice_id', ids).order('id').range(from, to)),
      fetchByIds<RawAdjustmentRow>(invoiceIds, 'adjustments', (ids, from, to) => db
        .from('invoice_adjustments').select(ADJUSTMENT_COLUMNS).in('invoice_id', ids).order('id').range(from, to))
    ]), 'the account');
    const balanceRows = allBalanceRows.filter(row => !billedToAccounts.has(row.invoice_id));

    const ownReceiptIds = ownReceiptRows.map(row => row.receipt_id ?? '').filter(Boolean);
    const knownAllocationIds = new Set(invoiceAllocations.map(row => row.id));
    const otherReceiptIds = [...new Set(invoiceAllocations.map(row => row.receipt_id ?? ''))].filter(id => id && !ownReceiptIds.includes(id));
    const [otherReceipts, ownReceiptAllocations, refunds] = await timed(Promise.all([
      fetchByIds<RawReceiptRow>(otherReceiptIds, 'receipts', (ids, from, to) => db
        .from('ar_receipt_balances').select(RECEIPT_COLUMNS).in('receipt_id', ids).order('receipt_id').range(from, to)),
      fetchByIds<RawAllocationRow>(ownReceiptIds, 'allocations', (ids, from, to) => db
        .from('receipt_allocations').select(ALLOCATION_COLUMNS).in('receipt_id', ids).order('id').range(from, to)),
      fetchByIds<RawAdjustmentRow>(ownReceiptIds, 'refunds', (ids, from, to) => db
        .from('invoice_adjustments').select(ADJUSTMENT_COLUMNS).eq('kind', 'refund').in('receipt_id', ids).order('id').range(from, to))
    ]), 'the account');

    // Each allocation with what it covered (statements say so)
    const allocations = await timed(withCovers([...invoiceAllocations, ...ownReceiptAllocations.filter(row => !knownAllocationIds.has(row.id))]
      .map(normalizeAllocation)
      .filter((row): row is ArAllocation => row !== null)), 'the account');
    return {
      state: 'ready',
      invoices,
      balances: toBalanceMap(balanceRows),
      receipts: [...ownReceiptRows, ...otherReceipts].map(normalizeReceipt),
      allocations,
      adjustments: [...invoiceAdjustments, ...refunds].map(normalizeAdjustment).filter((row): row is ArAdjustment => row !== null)
    };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up', invoices, balances: {}, receipts: [], allocations: [], adjustments: [] };
    throw error;
  }
}

/** Ledger balances of one patient's invoices (patient file summary); 'not_set_up' before receipts exist */
export async function loadPatientBalances(patientId: string, practiceId: string | null): Promise<{ state: 'ready' | 'not_set_up'; balances: Record<string, ArInvoiceBalance> }> {
  try {
    const rows = await timed(fetchPages<RawInvoiceBalanceRow>('balances', (from, to) => {
      let query = db.from('ar_invoice_balances').select(BALANCE_COLUMNS).eq('patient_id', patientId);
      if (practiceId) query = query.eq('practice_id', practiceId);
      return query.order('invoice_id').range(from, to);
    }), 'balances');
    return { state: 'ready', balances: toBalanceMap(rows) };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up', balances: {} };
    throw error;
  }
}

/** One patient's own receipts (patient file summary: credit and the last payment); 'not_set_up' before receipts exist */
export async function loadPatientReceipts(patientId: string, practiceId: string | null): Promise<{ state: 'ready' | 'not_set_up'; receipts: ArReceipt[] }> {
  try {
    const rows = await timed(fetchPages<RawReceiptRow>('receipts', (from, to) => {
      let query = db
        .from('ar_receipt_balances')
        .select('receipt_id, receipt_number, payer_type, patient_id, fund_name, amount, received_on, created_at, reversed_at, unallocated')
        .eq('patient_id', patientId);
      if (practiceId) query = query.eq('practice_id', practiceId);
      return query.order('receipt_id').range(from, to);
    }), 'receipts');
    return { state: 'ready', receipts: rows.map(normalizeReceipt) };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up', receipts: [] };
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// A medical aid fund's open claims (batch receipt)
// ---------------------------------------------------------------------------------------------

export interface FundClaim {
  invoiceId: string;
  invoiceNumber: string;
  patientId: string | null;
  patientName: string;
  /** yyyy-MM-dd invoice date */
  dateKey: string | null;
  /** The fund's claim-file code (MAG1 = PSEMAS, NMC1, NHPM, NAMM, PROS); null when the fund is not recorded or not recognised */
  fundCode: string | null;
  /** The fund's name from the fund list, or FUND_NOT_RECORDED */
  fund: string;
  medicalAidOwedCents: number;
  patientOwedCents: number;
  /** The claim batch the invoice is in (its lines are claim lines there) */
  batchId: string | null;
  inClaimBatch: boolean;
}

export interface FundSummary {
  /** What claims are grouped by: the fund's code, or FUND_NOT_RECORDED */
  key: string;
  fundCode: string | null;
  fund: string;
  claimCount: number;
  owedCents: number;
}

export const FUND_NOT_RECORDED = 'Medical aid not recorded';

/** The group a claim belongs to on the medical aid payment screens */
export const fundKeyOf = (claim: Pick<FundClaim, 'fundCode'>): string => claim.fundCode ?? FUND_NOT_RECORDED;

/**
 * Every invoice with a medical aid portion still owed, grouped by the fund's code (fundOfClaim: the batch the claim
 * was sent in, else the patient's fund on file by its id, else a known fund named on the file). Grouping by the
 * typed fund name split a fund whenever its name was typed differently, and those claims were not offered.
 */
export async function loadFundOpenClaims(practiceId: string): Promise<{ funds: FundSummary[]; claims: FundClaim[] }> {
  const rows = await timed(fetchPages<RawInvoiceBalanceRow & { batch_id?: string | null }>('open claims', (from, to) => db
    .from('ar_invoice_balances')
    .select(BALANCE_COLUMNS)
    .eq('practice_id', practiceId)
    .gt('medical_aid_outstanding', 0)
    .order('issue_date', { ascending: true })
    .order('invoice_id')
    .range(from, to)), 'open claims');
  const patientIds = [...new Set(rows.map(row => row.patient_id ?? '').filter(Boolean))];
  const batchIds = [...new Set(rows.map(row => row.batch_id ?? '').filter(Boolean))];
  const [aidRows, patientRows, fundRows, batchRows] = await timed(Promise.all([
    fetchByIds<{ patient_id: string | null; provider: string | null; medical_aid_provider_id: string | null }>(patientIds, 'medical aid details', (ids, from, to) => db
      .from('medical_aid_details').select('patient_id, provider, medical_aid_provider_id').in('patient_id', ids).order('patient_id').range(from, to)),
    fetchByIds<{ id: string; first_name: string | null; last_name: string | null }>(patientIds, 'patients', (ids, from, to) => db
      .from('patients').select('id, first_name, last_name').eq('practice_id', practiceId).in('id', ids).order('id').range(from, to)),
    fetchPages<FundRecord>('the medical aid funds', (from, to) => db
      .from('medical_aid_providers').select('id, name, short_name, medical_aid_reference').order('id').range(from, to)),
    fetchByIds<{ id: string; medical_aid_reference: string | null }>(batchIds, 'claim batches', (ids, from, to) => db
      .from('batch_headers').select('id, medical_aid_reference').in('id', ids).order('id').range(from, to))
  ]), 'open claims');
  const aidByPatient = new Map(aidRows.filter(row => row.patient_id).map(row => [row.patient_id as string, row]));
  const referenceByBatch = new Map(batchRows.map(row => [row.id, row.medical_aid_reference]));
  const nameByPatient = new Map(patientRows.map(row => [row.id, [row.first_name, row.last_name].map(part => part?.trim()).filter(Boolean).join(' ')]));

  const claims: FundClaim[] = rows.map(row => {
    const balance = normalizeInvoiceBalance(row);
    const aid = balance.patientId ? aidByPatient.get(balance.patientId) : undefined;
    const { fundCode, fund } = fundOfClaim({
      batchReference: (row.batch_id && referenceByBatch.get(row.batch_id)) || null,
      providerId: aid?.medical_aid_provider_id ?? null,
      providerName: aid?.provider ?? null
    }, fundRows);
    return {
      invoiceId: balance.invoiceId,
      invoiceNumber: balance.invoiceNumber,
      patientId: balance.patientId,
      patientName: (balance.patientId && nameByPatient.get(balance.patientId)) || 'Unknown patient',
      dateKey: balance.issueDate,
      fundCode,
      fund: fund ?? FUND_NOT_RECORDED,
      medicalAidOwedCents: Math.max(balance.outstanding.medical_aid, 0),
      patientOwedCents: Math.max(balance.outstanding.patient, 0),
      batchId: row.batch_id ?? null,
      inClaimBatch: !!row.batch_id
    };
  });
  const groups = new Map<string, FundSummary>();
  for (const claim of claims) {
    const key = fundKeyOf(claim);
    const group = groups.get(key) ?? { key, fundCode: claim.fundCode, fund: claim.fund, claimCount: 0, owedCents: 0 };
    group.claimCount += 1;
    group.owedCents += claim.medicalAidOwedCents;
    groups.set(key, group);
  }
  return { funds: [...groups.values()].sort((a, b) => b.owedCents - a.owedCents || a.fund.localeCompare(b.fund)), claims };
}

// ---------------------------------------------------------------------------------------------
// Entries of one invoice or one receipt (detail views)
// ---------------------------------------------------------------------------------------------

export interface InvoiceEntries {
  balance: ArInvoiceBalance | null;
  allocations: ArAllocation[];
  adjustments: ArAdjustment[];
  /** The receipts of those allocations, by id */
  receipts: Record<string, ArReceipt>;
}

export async function loadInvoiceEntries(invoiceId: string): Promise<InvoiceEntries> {
  const [balanceRows, allocationRows, adjustmentRows] = await timed(Promise.all([
    fetchPages<RawInvoiceBalanceRow>('balance', (from, to) => db.from('ar_invoice_balances').select(BALANCE_COLUMNS).eq('invoice_id', invoiceId).range(from, to)),
    fetchPages<RawAllocationRow>('allocations', (from, to) => db.from('receipt_allocations').select(ALLOCATION_COLUMNS).eq('invoice_id', invoiceId).order('created_at').range(from, to)),
    fetchPages<RawAdjustmentRow>('adjustments', (from, to) => db.from('invoice_adjustments').select(ADJUSTMENT_COLUMNS).eq('invoice_id', invoiceId).order('created_at').range(from, to))
  ]), 'the invoice payments');
  const plain = allocationRows.map(normalizeAllocation).filter((row): row is ArAllocation => row !== null);
  const [allocations, receiptRows] = await timed(Promise.all([
    withCovers(plain),
    fetchByIds<RawReceiptRow>(plain.map(a => a.receiptId), 'receipts', (ids, from, to) => db
      .from('ar_receipt_balances').select(RECEIPT_COLUMNS).in('receipt_id', ids).order('receipt_id').range(from, to))
  ]), 'receipts');
  return {
    balance: balanceRows[0] ? normalizeInvoiceBalance(balanceRows[0]) : null,
    allocations,
    adjustments: adjustmentRows.map(normalizeAdjustment).filter((row): row is ArAdjustment => row !== null),
    receipts: Object.fromEntries(receiptRows.map(row => normalizeReceipt(row)).map(receipt => [receipt.id, receipt]))
  };
}

export interface ReceiptEntries {
  receipt: ArReceipt | null;
  allocations: ArAllocation[];
  refunds: ArAdjustment[];
  /** Invoice number and patient of each allocated invoice */
  invoices: Record<string, { invoiceNumber: string; patientId: string | null }>;
}

export async function loadReceiptEntries(receiptId: string): Promise<ReceiptEntries> {
  const [receiptRows, allocationRows, refundRows] = await timed(Promise.all([
    fetchPages<RawReceiptRow>('receipt', (from, to) => db.from('ar_receipt_balances').select(RECEIPT_COLUMNS).eq('receipt_id', receiptId).range(from, to)),
    fetchPages<RawAllocationRow>('allocations', (from, to) => db.from('receipt_allocations').select(ALLOCATION_COLUMNS).eq('receipt_id', receiptId).order('created_at').range(from, to)),
    fetchPages<RawAdjustmentRow>('refunds', (from, to) => db.from('invoice_adjustments').select(ADJUSTMENT_COLUMNS).eq('receipt_id', receiptId).order('created_at').range(from, to))
  ]), 'the receipt');
  const plain = allocationRows.map(normalizeAllocation).filter((row): row is ArAllocation => row !== null);
  const [allocations, invoiceRows] = await timed(Promise.all([
    withCovers(plain),
    fetchByIds<{ id: string; invoice_number: string | null; patient_id: string | null }>(
      plain.map(a => a.invoiceId), 'invoices',
      (ids, from, to) => db.from('invoices_enhanced').select('id, invoice_number, patient_id').in('id', ids).order('id').range(from, to)
    )
  ]), 'invoices');
  return {
    receipt: receiptRows[0] ? normalizeReceipt(receiptRows[0]) : null,
    allocations,
    refunds: refundRows.map(normalizeAdjustment).filter((row): row is ArAdjustment => row !== null),
    invoices: Object.fromEntries(invoiceRows.map(row => [row.id, { invoiceNumber: row.invoice_number?.trim() || row.id.slice(0, 8), patientId: row.patient_id }]))
  };
}

// ---------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------

export interface PatientMatch {
  id: string;
  name: string;
  cellNumber: string | null;
  email: string | null;
  idNumber: string | null;
}

/**
 * Patients of the practice matching every word typed (name, ID number or cell number). The first
 * word goes to the database with characters that have a meaning in PostgREST filters removed.
 */
export async function searchPatients(practiceId: string, term: string): Promise<PatientMatch[]> {
  const words = term.trim().split(/\s+/).filter(Boolean);
  const first = (words[0] ?? '').replace(/[^\p{L}\p{N}'-]/gu, '');
  if (first.length < 2) return [];
  const { data, error } = await timed(Promise.resolve(db
    .from('patients')
    .select('id, first_name, last_name, cell_number, email, id_number')
    .eq('practice_id', practiceId)
    .or(`first_name.ilike.%${first}%,last_name.ilike.%${first}%,id_number.ilike.%${first}%,cell_number.ilike.%${first}%`)
    .order('last_name')
    .range(0, 49)), 'patients');
  if (error) throw new Error(`Could not search patients: ${error.message}`);
  // The shared patient search: exact matches first, then starts-with, then contains (surname order within each)
  return ((data ?? []) as Array<Record<string, string | null>>)
    .map(row => ({
      row,
      rank: patientSearchRank(
        patientSearchFields({ first_name: row.first_name, last_name: row.last_name, id_number: row.id_number, cell_number: row.cell_number, email: row.email }),
        term
      )
    }))
    .filter((entry): entry is { row: Record<string, string | null>; rank: PatientSearchRank } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 20)
    .map(({ row }) => ({
      id: row.id ?? '',
      name: [row.first_name, row.last_name].map(part => part?.trim()).filter(Boolean).join(' ') || 'Unnamed patient',
      cellNumber: row.cell_number?.trim() || null,
      email: row.email?.trim() || null,
      idNumber: row.id_number?.trim() || null
    }));
}

/** Contact details and fund of one patient (for a receipt SMS or email) */
export async function loadPatientContact(practiceId: string, patientId: string): Promise<{ name: string; cellNumber: string | null; email: string | null; fund: string | null }> {
  const [patient, aid] = await timed(Promise.all([
    Promise.resolve(db.from('patients').select('first_name, last_name, cell_number, email').eq('practice_id', practiceId).eq('id', patientId).range(0, 0)),
    Promise.resolve(db.from('medical_aid_details').select('provider').eq('patient_id', patientId).range(0, 0))
  ]), 'the patient');
  if (patient.error) throw new Error(`Could not load the patient: ${patient.error.message}`);
  const row = (patient.data?.[0] ?? {}) as Record<string, string | null>;
  const fund = ((aid.data?.[0] ?? {}) as Record<string, string | null>).provider?.trim() || null;
  return {
    name: [row.first_name, row.last_name].map(part => part?.trim()).filter(Boolean).join(' ') || 'Patient',
    cellNumber: row.cell_number?.trim() || null,
    email: row.email?.trim() || null,
    fund
  };
}

/** Staff names by user id (who recorded or reversed an entry) */
export async function loadStaffNames(practiceId: string, userIds: readonly (string | null)[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return {};
  const rows = await timed(fetchByIds<{ id: string; full_name: string | null }>(ids, 'staff', (chunk, from, to) => db
    .from('users').select('id, full_name').eq('practice_id', practiceId).in('id', chunk).order('id').range(from, to)), 'staff names');
  return Object.fromEntries(rows.map(row => [row.id, row.full_name?.trim() || 'Staff member']));
}

// ---------------------------------------------------------------------------------------------
// Writes (one RPC each; the database checks every limit again)
// ---------------------------------------------------------------------------------------------

async function callRpc<T>(name: string, args: Record<string, unknown>, action: string): Promise<T> {
  const { data, error } = await withTimeout(
    Promise.resolve(db.rpc(name, args)),
    TIMEOUT_MS,
    `${action} took too long. Check Finance before trying again: it may have been saved.`
  );
  if (error) {
    if (isArNotSetUp(error)) throw new Error(AR_NOT_SET_UP_MESSAGE);
    throw new Error(error.message || `${action} failed`);
  }
  return data as T;
}

export interface PostedReceipt {
  receipt_id: string;
  receipt_number: string;
  duplicate: boolean;
  allocated: number | string;
  unallocated: number | string;
  adjustments: Array<{ id: string; number: string; kind: string }>;
}

export const postReceipt = (input: ReceiptInput): Promise<PostedReceipt> =>
  callRpc<PostedReceipt>('ar_post_receipt', { p_payload: buildReceiptPayload(input) }, 'Saving the receipt');

export const allocateReceipt = (receiptId: string, lines: Parameters<typeof buildAllocationLines>[0]) =>
  callRpc<{ receipt_number: string; unallocated: number | string }>('ar_allocate_receipt', { p_receipt_id: receiptId, p_allocations: buildAllocationLines(lines) }, 'Allocating the credit');

/** Refunds, reversals and credit notes are for administrators only (owner, 13 Oct 2026); discounts are not given */
const refuseUnlessAllowed = (action: MoneyCorrection | null): Promise<void> => {
  if (!action) return Promise.resolve();
  const refusal = moneyCorrectionRefusal(action, useAuthStore.getState().user?.role);
  return refusal ? Promise.reject(new Error(refusal)) : Promise.resolve();
};

export const postAdjustment = (input: AdjustmentInput) =>
  input.kind === 'discount'
    ? Promise.reject(new Error(NO_DISCOUNTS_MESSAGE))
    : refuseUnlessAllowed(adjustmentCorrection(input.kind)).then(() =>
      callRpc<{ id: string; number: string; kind: string }>('ar_post_adjustment', { p_payload: buildAdjustmentPayload(input) }, 'Saving the adjustment'));

export const reverseReceipt = (receiptId: string, reason: string) =>
  refuseUnlessAllowed('reverse_receipt').then(() =>
    callRpc<{ receipt_number: string }>('ar_reverse_receipt', { p_receipt_id: receiptId, p_reason: reason }, 'Reversing the receipt'));

export const reverseAllocation = (allocationId: string, reason: string) =>
  refuseUnlessAllowed('reverse_allocation').then(() =>
    callRpc<{ allocation_id: string }>('ar_reverse_allocation', { p_allocation_id: allocationId, p_reason: reason }, 'Reversing the allocation'));

export const reverseAdjustment = (adjustmentId: string, reason: string) =>
  refuseUnlessAllowed('reverse_adjustment').then(() =>
    callRpc<{ number: string }>('ar_reverse_adjustment', { p_adjustment_id: adjustmentId, p_reason: reason }, 'Reversing the adjustment'));
