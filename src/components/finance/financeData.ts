import type { SupabaseClient } from '@supabase/supabase-js';
import { endOfDay, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { fetchAllRows, withTimeout } from '../../services/financialKpiService';
import {
  dateKeyFrom,
  invoiceDateKey,
  isInRange,
  isOutstandingInvoice,
  isPayrollCost,
  isRevenueInvoice,
  NO_SHOW_NOTE_MARKER,
  normalizeExpense,
  normalizeInventoryItem,
  normalizeInvoice,
  normalizeLineItem,
  normalizePayslip,
  normalizeVisit,
  payslipDateKey,
  payslipLinesFrom,
  splitCents,
  toCents,
  fromCents,
  type DateRange,
  type LedgerExpense,
  type LedgerInventoryItem,
  type LedgerInvoice,
  type LedgerLineItem,
  type LedgerPayslip,
  type LedgerPayslipLine,
  type LedgerVisit,
  type RawExpenseRow,
  type RawInventoryRow,
  type RawInvoiceRow,
  type RawLineItemRow,
  type RawPayslipDetailsRow,
  type RawPayslipItemRow,
  type RawPayslipRow,
  type RawVisitRow
} from '../../services/ledgerService';
import { normalizeClaimBatch, type ClaimBatchState, type RawClaimBatchRow } from './fundDebtors';

/**
 * Read-only loaders for the Finance page. Every query is scoped to the practice: directly by
 * practice_id, by the payslip owner's practice, or (line items, payslip lines, claim batches,
 * medical aid details) by ids that come from the practice-scoped invoice and payslip queries. Each
 * source settles on its own, so one failing table produces an error for that section instead of
 * zeros, and never blocks the others.
 *
 * The generated database types are out of date for some finance tables, so rows are read with
 * the untyped client and normalised at runtime by ledgerService.
 */
const db = supabase as unknown as SupabaseClient;

export const FINANCE_SOURCE_TIMEOUT_MS = 25000;
const ID_CHUNK_SIZE = 100;
const CHUNK_CONCURRENCY = 4;

const INVOICE_COLUMNS =
  'id, invoice_number, patient_id, visit_id, practitioner_id, batch_id, issue_date, due_date, total, medical_aid_total, patient_total, payment_status, payment_method, updated_at, created_at';
const LINE_ITEM_COLUMNS = 'invoice_id, code, description, quantity, unit_price, total_price, medical_aid_covered, patient_portion';
const VISIT_COLUMNS = 'id, doctor_id, visit_date, scheduled_date, status, is_cancelled, is_checked_in, is_ready, is_handoff';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface SourceResult<T> {
  rows: T[];
  error: string | null;
}

export interface FinanceLoadRequest {
  practiceId: string;
  /** Earliest invoice/payslip date needed (comparison period and trend window) */
  windowStartKey: string;
  /** The selected period: line items, visits and payslip lines are read for it */
  lineItemRange: DateRange;
}

/** Identifies what a workspace was loaded for; figures are only shown for a matching request */
export const financeRequestKey = (request: FinanceLoadRequest): string =>
  [request.practiceId, request.windowStartKey, request.lineItemRange.startKey, request.lineItemRange.endKey].join('|');

export interface FinanceWorkspace {
  practiceId: string;
  requestKey: string;
  invoices: SourceResult<LedgerInvoice>;
  lineItems: SourceResult<LedgerLineItem>;
  payslips: SourceResult<LedgerPayslip>;
  expenses: SourceResult<LedgerExpense>;
  inventory: SourceResult<LedgerInventoryItem>;
  /** Claim batches sent to medical aids and not yet confirmed paid */
  claims: { count: number; amount: number; error: string | null };
  /** Visits (appointments and walk-ins) whose day may fall in the selected period */
  visits: SourceResult<LedgerVisit>;
  /** Lines (earnings, deductions, employer contributions) of the selected period's payslips */
  payslipLines: SourceResult<LedgerPayslipLine>;
  /** The claim batches that unpaid medical aid invoices belong to */
  claimBatches: SourceResult<ClaimBatchState>;
  patientNames: Record<string, string>;
  doctorNames: Record<string, string>;
  /** Medical aid (provider) per patient, from medical_aid_details */
  schemeByPatient: Record<string, string>;
  /** Visit (service) date per visit id, for unpaid medical aid invoices (claim deadlines) */
  serviceDateByVisit: Record<string, string>;
  /** Display lookups that failed; their figures are unaffected */
  lookupWarnings: string[];
  loadedAt: string;
}

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

async function settle<T>(label: string, task: () => Promise<T[]>): Promise<SourceResult<T>> {
  try {
    const rows = await withTimeout(task(), FINANCE_SOURCE_TIMEOUT_MS, `Loading ${label} took too long. Check your connection and try again.`);
    return { rows, error: null };
  } catch (error) {
    console.error(`Finance: could not load ${label}`, error);
    return { rows: [], error: errorMessage(error, `Could not load ${label}`) };
  }
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const uniqueIds = (values: (string | null)[]): string[] => [...new Set(values.filter((id): id is string => !!id))];

/** Date keys are interpolated into PostgREST filter strings, so only plain yyyy-MM-dd values are accepted */
function assertDateKeys(...keys: string[]): void {
  if (!keys.every(key => DATE_KEY_PATTERN.test(key))) throw new Error('The selected period is not a valid date range');
}

async function loadInvoices(practiceId: string, windowStartKey: string, period: DateRange): Promise<LedgerInvoice[]> {
  assertDateKeys(windowStartKey, period.startKey, period.endKey);
  const [windowRows, unpaidRows, paidInPeriodRows] = await Promise.all([
    fetchAllRows<RawInvoiceRow>(
      (from, to) => db
        .from('invoices_enhanced')
        .select(INVOICE_COLUMNS)
        .eq('practice_id', practiceId)
        .gte('issue_date', windowStartKey)
        .order('issue_date', { ascending: false })
        .order('id')
        .range(from, to),
      'invoices'
    ),
    // Receivables are owed whatever their age, so unpaid invoices are read without a date limit
    fetchAllRows<RawInvoiceRow>(
      (from, to) => db
        .from('invoices_enhanced')
        .select(INVOICE_COLUMNS)
        .eq('practice_id', practiceId)
        .or('payment_status.is.null,payment_status.not.in.(paid,cancelled)')
        .order('id')
        .range(from, to),
      'unpaid invoices'
    ),
    // Takings follow the time an invoice was marked paid (updated_at), so older invoices paid in the
    // selected period are read too; invoices issued since the window start are already in the first query
    fetchAllRows<RawInvoiceRow>(
      (from, to) => db
        .from('invoices_enhanced')
        .select(INVOICE_COLUMNS)
        .eq('practice_id', practiceId)
        .eq('payment_status', 'paid')
        .or(`issue_date.is.null,issue_date.lt.${windowStartKey}`)
        .gte('updated_at', parseISO(period.startKey).toISOString())
        .lte('updated_at', endOfDay(parseISO(period.endKey)).toISOString())
        .order('id')
        .range(from, to),
      'invoices paid in the period'
    )
  ]);
  const byId = new Map<string, LedgerInvoice>();
  [...windowRows, ...unpaidRows, ...paidInPeriodRows].forEach(row => byId.set(row.id, normalizeInvoice(row)));
  return [...byId.values()];
}

async function loadLineItems(invoiceIds: string[]): Promise<LedgerLineItem[]> {
  const pages = await mapWithConcurrency(chunk(invoiceIds, ID_CHUNK_SIZE), CHUNK_CONCURRENCY, ids =>
    fetchAllRows<RawLineItemRow>(
      (from, to) => db.from('invoice_services').select(LINE_ITEM_COLUMNS).in('invoice_id', ids).order('id').range(from, to),
      'invoice line items'
    )
  );
  return pages.flat().map(normalizeLineItem).filter((line): line is LedgerLineItem => line !== null);
}

async function loadPayslips(practiceId: string, windowStartKey: string): Promise<LedgerPayslip[]> {
  // payslips has no practice_id: scope through the employee's practice (as Settings > Payroll does)
  const rows = await fetchAllRows<RawPayslipRow>(
    (from, to) => db
      .from('payslips')
      .select('id, user_id, pay_period_start, pay_period_end, payment_date, gross_earnings, total_deductions, net_pay, status, user:user_id!inner(full_name, practice_id)')
      .eq('user.practice_id', practiceId)
      .gte('pay_period_start', windowStartKey)
      .order('pay_period_start', { ascending: false })
      .order('id')
      .range(from, to),
    'payroll'
  );
  return rows.map(normalizePayslip);
}

/** The lines of the given (practice-scoped) payslips: payslip_items rows, or the JSON details of older payslips */
async function loadPayslipLines(payslipIds: string[]): Promise<LedgerPayslipLine[]> {
  const chunks = chunk(payslipIds, ID_CHUNK_SIZE);
  const [items, details] = await Promise.all([
    mapWithConcurrency(chunks, CHUNK_CONCURRENCY, ids =>
      fetchAllRows<RawPayslipItemRow>(
        (from, to) => db.from('payslip_items').select('payslip_id, component_name, type, amount').in('payslip_id', ids).order('id').range(from, to),
        'payslip lines'
      )
    ),
    mapWithConcurrency(chunks, CHUNK_CONCURRENCY, ids =>
      fetchAllRows<RawPayslipDetailsRow>(
        (from, to) => db.from('payslips').select('id, earnings_details, deductions_details').in('id', ids).order('id').range(from, to),
        'payslip details'
      )
    )
  ]);
  return payslipLinesFrom(items.flat(), details.flat());
}

/**
 * Visits whose day (scheduled date, else visit date) may fall in the period: either date in it.
 * normalizeVisit picks the day, so a visit rescheduled out of the period is filtered out later.
 * Missed appointments are saved as cancelled with a marker note; only their ids are read (never
 * the clinical notes), with the marker's PostgREST-reserved characters (: and parentheses) matched by %.
 */
async function loadVisits(practiceId: string, period: DateRange): Promise<LedgerVisit[]> {
  assertDateKeys(period.startKey, period.endKey);
  const within = (column: string) => `and(${column}.gte.${period.startKey},${column}.lte.${period.endKey})`;
  const inPeriod = `${within('scheduled_date')},${within('visit_date')}`;
  const [rows, noShowNotes] = await Promise.all([
    fetchAllRows<RawVisitRow>(
      (from, to) => db.from('visits').select(VISIT_COLUMNS).eq('practice_id', practiceId).or(inPeriod).order('id').range(from, to),
      'visits'
    ),
    fetchAllRows<{ id: string }>(
      (from, to) => db
        .from('visits')
        .select('id')
        .eq('practice_id', practiceId)
        .like('notes', `${NO_SHOW_NOTE_MARKER.replace(/[:()]/g, '%')}%`)
        .or(inPeriod)
        .order('id')
        .range(from, to),
      'missed appointments'
    )
  ]);
  const noShowNoteIds = new Set(noShowNotes.map(row => row.id));
  return rows.map(row => normalizeVisit(row, noShowNoteIds));
}

/**
 * The batches unpaid invoices belong to, by id (the ids come from practice-scoped invoices; older
 * batches may only carry the practice number, so they are not filtered by practice_id).
 */
async function loadClaimBatches(batchIds: string[]): Promise<ClaimBatchState[]> {
  const pages = await mapWithConcurrency(chunk(batchIds, ID_CHUNK_SIZE), CHUNK_CONCURRENCY, ids =>
    fetchAllRows<RawClaimBatchRow>(
      (from, to) => db.from('batch_headers').select('id, status, sent_at, medical_aid_reference').in('id', ids).order('id').range(from, to),
      'claim batches of unpaid invoices'
    )
  );
  return pages.flat().map(normalizeClaimBatch);
}

async function loadExpenses(practiceId: string): Promise<LedgerExpense[]> {
  // All dates: unpaid expenses of any age are payables
  const rows = await fetchAllRows<RawExpenseRow>(
    (from, to) => db
      .from('practice_expenses')
      .select('id, name, expense_type, expense_category, amount, expense_date, due_date, paid_date, status, vendor_name, payment_method, is_recurring')
      .eq('practice_id', practiceId)
      .order('expense_date', { ascending: false })
      .order('id')
      .range(from, to),
    'practice expenses'
  );
  return rows.map(normalizeExpense);
}

async function loadInventory(practiceId: string): Promise<LedgerInventoryItem[]> {
  const rows = await fetchAllRows<RawInventoryRow>(
    (from, to) => db
      .from('practice_inventory')
      .select('id, name, category, quantity, unit, unit_cost, total_value, reorder_level, expiry_date, location')
      .eq('practice_id', practiceId)
      .order('name')
      .order('id')
      .range(from, to),
    'inventory'
  );
  return rows.map(normalizeInventoryItem);
}

async function loadClaims(practiceId: string): Promise<{ count: number; amount: number; error: string | null }> {
  const result = await settle('claim batches', () =>
    fetchAllRows<{ total_amount: number | string | null }>(
      (from, to) => db.from('batch_headers').select('id, total_amount').eq('practice_id', practiceId).eq('status', 'sent').order('id').range(from, to),
      'claim batches'
    )
  );
  return {
    count: result.rows.length,
    amount: fromCents(result.rows.reduce((sum, row) => sum + toCents(row.total_amount), 0)),
    error: result.error
  };
}

/** Run a lookup over chunks of ids and merge the resulting maps */
async function lookupByIds(
  ids: string[],
  query: (chunkIds: string[]) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>,
  toEntry: (row: Record<string, unknown>) => [string, string] | null
): Promise<Record<string, string>> {
  const results = await mapWithConcurrency(chunk(ids, ID_CHUNK_SIZE), CHUNK_CONCURRENCY, async chunkIds => {
    const { data, error } = await query(chunkIds);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const map: Record<string, string> = {};
  results.flat().forEach(row => {
    const entry = toEntry(row);
    if (entry) map[entry[0]] = entry[1];
  });
  return map;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

async function lookup(label: string, warnings: string[], task: () => Promise<Record<string, string>>): Promise<Record<string, string>> {
  try {
    return await withTimeout(task(), FINANCE_SOURCE_TIMEOUT_MS, `Loading ${label} took too long`);
  } catch (error) {
    console.warn(`Finance: ${label} unavailable`, error);
    warnings.push(`${label} could not be loaded (${errorMessage(error, 'unknown error')})`);
    return {};
  }
}

/** Load everything the Finance page shows for one practice. Never rejects for a single source. */
export async function loadFinanceWorkspace(request: FinanceLoadRequest): Promise<FinanceWorkspace> {
  const { practiceId, windowStartKey, lineItemRange } = request;
  const [invoices, payslips, expenses, inventory, claims, visits] = await Promise.all([
    settle('invoices', () => loadInvoices(practiceId, windowStartKey, lineItemRange)),
    settle('payroll', () => loadPayslips(practiceId, windowStartKey)),
    settle('practice expenses', () => loadExpenses(practiceId)),
    settle('inventory', () => loadInventory(practiceId)),
    loadClaims(practiceId),
    settle('visits', () => loadVisits(practiceId, lineItemRange))
  ]);

  const periodInvoiceIds = invoices.rows
    .filter(inv => isRevenueInvoice(inv) && isInRange(invoiceDateKey(inv), lineItemRange))
    .map(inv => inv.id);
  const patientIds = uniqueIds(invoices.rows.map(inv => inv.patientId));
  const doctorIds = uniqueIds([...invoices.rows.map(inv => inv.practitionerId), ...visits.rows.map(visit => visit.doctorId)]);
  // Unpaid invoices with a medical aid portion: their claim batches and visit dates show where each claim stands
  const unpaidMedicalAid = invoices.rows.filter(inv => isOutstandingInvoice(inv) && splitCents(inv).medicalAidCents > 0);
  const claimBatchIds = uniqueIds(unpaidMedicalAid.map(inv => inv.batchId));
  const claimVisitIds = uniqueIds(unpaidMedicalAid.map(inv => inv.visitId));
  const periodPayslipIds = payslips.rows
    .filter(payslip => isPayrollCost(payslip) && isInRange(payslipDateKey(payslip), lineItemRange))
    .map(payslip => payslip.id);
  const lookupWarnings: string[] = [];

  const [lineItems, payslipLines, claimBatches, patientNames, doctorNames, schemeByPatient, serviceDateByVisit] = await Promise.all([
    periodInvoiceIds.length > 0
      ? settle('invoice line items', () => loadLineItems(periodInvoiceIds))
      : Promise.resolve<SourceResult<LedgerLineItem>>({ rows: [], error: null }),
    periodPayslipIds.length > 0
      ? settle('payslip lines', () => loadPayslipLines(periodPayslipIds))
      : Promise.resolve<SourceResult<LedgerPayslipLine>>({ rows: [], error: null }),
    claimBatchIds.length > 0
      ? settle('claim batches of unpaid invoices', () => loadClaimBatches(claimBatchIds))
      : Promise.resolve<SourceResult<ClaimBatchState>>({ rows: [], error: null }),
    lookup('Patient names', lookupWarnings, () => lookupByIds(
      patientIds,
      ids => db.from('patients').select('id, first_name, last_name').eq('practice_id', practiceId).in('id', ids),
      row => [text(row.id), [text(row.first_name), text(row.last_name)].filter(Boolean).join(' ')]
    )),
    lookup('Doctor names', lookupWarnings, () => lookupByIds(
      doctorIds,
      ids => db.from('users').select('id, full_name').eq('practice_id', practiceId).in('id', ids),
      row => [text(row.id), text(row.full_name)]
    )),
    lookup('Medical aid details', lookupWarnings, () => lookupByIds(
      patientIds,
      ids => db.from('medical_aid_details').select('patient_id, provider').in('patient_id', ids),
      row => (text(row.patient_id) && text(row.provider) ? [text(row.patient_id), text(row.provider)] : null)
    )),
    // The claim deadline runs from the visit (service) date, as on the claims screen
    lookup('Visit dates for claim deadlines', lookupWarnings, () => lookupByIds(
      claimVisitIds,
      ids => db.from('visits').select('id, visit_date').eq('practice_id', practiceId).in('id', ids),
      row => {
        const visitDate = dateKeyFrom(text(row.visit_date));
        return text(row.id) && visitDate ? [text(row.id), visitDate] : null;
      }
    ))
  ]);

  return {
    practiceId,
    requestKey: financeRequestKey(request),
    invoices,
    lineItems,
    payslips,
    expenses,
    inventory,
    claims,
    visits,
    payslipLines,
    claimBatches,
    patientNames,
    doctorNames,
    schemeByPatient,
    serviceDateByVisit,
    lookupWarnings,
    loadedAt: new Date().toISOString()
  };
}

/** Line items of one invoice (for the invoice drill-down); the invoice comes from a practice-scoped list */
export async function fetchInvoiceLineItems(invoiceId: string): Promise<LedgerLineItem[]> {
  const { data, error } = await withTimeout(
    Promise.resolve(db.from('invoice_services').select(LINE_ITEM_COLUMNS).eq('invoice_id', invoiceId).order('id')),
    FINANCE_SOURCE_TIMEOUT_MS,
    'Loading the invoice lines took too long'
  );
  if (error) throw new Error(`Could not load the invoice lines: ${error.message}`);
  return ((data ?? []) as RawLineItemRow[]).map(normalizeLineItem).filter((line): line is LedgerLineItem => line !== null);
}
