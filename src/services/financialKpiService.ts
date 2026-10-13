import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, getQuarter } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { readAllPages } from '../lib/pagedRows';
import { fromCents, toCents } from '../utils/billing/money';
import { isOpenBatch } from '../components/finance/claims/status';

/**
 * Finance KPI loader shared by the Finance page and the dashboard EnhancedFinancialModal.
 * Reads invoices_enhanced (written by invoiceService when a visit is billed), scoped to the
 * selected practice, and always settles: it resolves with data or rejects (incl. on timeout),
 * so callers can reliably clear their loading state.
 */

export type FinanceDateRange = '30d' | '3m' | '6m' | '12m';

export interface FinancialKPIs {
  totalBilledMTD: number;
  totalCollectedMTD: number;
  totalOutstanding: number;
  claimsInProgress: number;
  /** Number of invoices issued in the selected period (0 => show the empty state) */
  invoiceCount: number;
  monthlyRevenueTrend: { month: string; revenue: number; medical_aid: number; patient: number }[];
  invoiceVolumeTrend: { month: string; count: number }[];
  revenueByStatus: { name: string; value: number; color: string }[];
  topServices: { name: string; revenue: number; count: number; avg: number }[];
  medicalAidBreakdown: { provider: string; value: number; percentage: number }[];
  practitionerPerformance: { name: string; revenue: number; patients: number }[];
  /** Count and amount per payment status for invoices issued in the selected period */
  statusSummary: Record<InvoiceStatus, { count: number; amount: number }>;
  /** Newest invoices issued in the selected period */
  recentInvoices: InvoiceListItem[];
  /**
   * Paid invoices issued in the selected period, most recently updated first. There is no
   * payments table in the schema, so "paid" comes from invoices_enhanced.payment_status.
   */
  recentPaidInvoices: InvoiceListItem[];
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'cancelled';

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  status: string;
  issueDate: string | null;
  paymentMethod: string | null;
  updatedAt: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  total: number | string | null;
  medical_aid_total: number | string | null;
  patient_total: number | string | null;
  payment_status: string | null;
  payment_method: string | null;
  issue_date: string | null;
  updated_at: string | null;
  practitioner_id: string | null;
  patient_id: string | null;
}

/** Shape of the billing items PremiumBillingModal renders (one per invoice) */
export interface PatientBillingItem {
  id: string;
  date: string;
  type: 'invoice';
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  paymentMethod?: string;
  invoiceNumber?: string;
}

/** The invoices_enhanced columns needed to build a patient's billing items */
export interface PatientInvoiceRow {
  id: string;
  invoice_number?: string | null;
  issue_date?: string | null;
  created_at?: string | null;
  due_date?: string | null;
  total?: number | string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface ServiceRow {
  description: string | null;
  total_price: number | string | null;
  quantity: number | null;
  invoice_id: string | null;
}

export const FINANCE_KPI_TIMEOUT_MS = 20000;
/** Supabase (PostgREST) returns at most this many rows per request by default */
export const PAGE_SIZE = 1000;
const TREND_MONTHS = 6;
const ID_CHUNK_SIZE = 100;
const RECENT_LIMIT = 10;
const MONTHS_BACK: Record<FinanceDateRange, number> = { '30d': 1, '3m': 3, '6m': 6, '12m': 12 };
const STATUS_COLORS = { paid: '#10B981', pending: '#F59E0B', overdue: '#EF4444' };
const INVOICE_STATUSES: InvoiceStatus[] = ['paid', 'pending', 'overdue', 'cancelled'];

// Local calendar date (issue_date is a DATE column); toISOString() would shift to UTC.
export const toDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

/** Calendar quarter containing `now`, as local yyyy-MM-dd bounds for DATE columns */
export function getQuarterDateRange(now: Date): { quarter: number; startKey: string; endKey: string } {
  return {
    quarter: getQuarter(now),
    startKey: toDateKey(startOfQuarter(now)),
    endKey: toDateKey(endOfQuarter(now))
  };
}

/** Money is still owed on pending and overdue invoices; a missing status is treated as pending. */
export const isOutstandingStatus = (status: string | null | undefined): boolean =>
  !status || status === 'pending' || status === 'overdue';

/**
 * Read every row of a query, PAGE_SIZE rows at a time. A single request is silently capped at
 * 1000 rows, which undercounted totals for large practices. buildPage must apply a stable
 * order (ending in a unique column) so pages neither overlap nor skip rows.
 */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  label: string
): Promise<T[]> {
  // Pages after the first are read together (lib/pagedRows), not one round-trip after another
  return readAllPages(PAGE_SIZE, buildPage, error => new Error(`Failed to load ${label}: ${error.message}`));
}

const toAmount = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

// invoiceService creates invoices as 'pending'; a missing status is treated the same way.
const statusOf = (invoice: InvoiceRow): string => invoice.payment_status || 'pending';

const sumTotals = (rows: InvoiceRow[], field: 'total' | 'medical_aid_total' | 'patient_total' = 'total'): number =>
  rows.reduce((sum, row) => sum + toAmount(row[field]), 0);

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchServicesForInvoices(invoiceIds: string[]): Promise<ServiceRow[]> {
  const rows: ServiceRow[] = [];
  for (const ids of chunk(invoiceIds, ID_CHUNK_SIZE)) {
    // 100 invoices can have more than 1000 line items, so page within each chunk too
    const chunkRows = await fetchAllRows<ServiceRow>(
      (from, to) => supabase
        .from('invoice_services')
        .select('description, total_price, quantity, invoice_id')
        .in('invoice_id', ids)
        .order('id')
        .range(from, to),
      'invoice services'
    );
    rows.push(...chunkRows);
  }
  return rows;
}

async function fetchPatientNames(practiceId: string | null, patientIds: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  if (patientIds.length === 0) return names;
  let query = supabase
    .from('patients')
    .select('id, first_name, last_name')
    .in('id', patientIds);
  if (practiceId) {
    query = query.eq('practice_id', practiceId);
  }
  const { data, error } = await query;
  // Names are display-only: keep the invoice figures if this lookup fails
  if (error) {
    console.warn('Patient names unavailable:', error.message);
    return names;
  }
  (data || []).forEach(patient => {
    names[patient.id] = [patient.first_name, patient.last_name].filter(Boolean).join(' ');
  });
  return names;
}

const toListItem = (invoice: InvoiceRow, names: Record<string, string>): InvoiceListItem => ({
  id: invoice.id,
  invoiceNumber: invoice.invoice_number || invoice.id.slice(0, 8),
  patientName: (invoice.patient_id && names[invoice.patient_id]) || 'Unknown patient',
  amount: toAmount(invoice.total),
  status: statusOf(invoice),
  issueDate: invoice.issue_date,
  paymentMethod: invoice.payment_method,
  updatedAt: invoice.updated_at
});

async function fetchProviderByPatient(patientIds: string[]): Promise<Record<string, string>> {
  const providerByPatient: Record<string, string> = {};
  for (const ids of chunk(patientIds, ID_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('medical_aid_details')
      .select('patient_id, provider')
      .in('patient_id', ids);
    // Breakdown is optional: keep the rest of the dashboard if this lookup fails
    if (error) {
      console.warn('Medical aid breakdown unavailable:', error.message);
      return providerByPatient;
    }
    (data || []).forEach(item => {
      if (item.patient_id) providerByPatient[item.patient_id] = item.provider;
    });
  }
  return providerByPatient;
}

const MISSING_TABLE = /relation .* does not exist|could not find the table|schema cache/i;

/**
 * "Claims in progress": what the medical aids still owe on claims already sent to them, i.e. the medical-aid portion
 * still outstanding on invoices whose claim batch is no longer open (claims/status.ts isOpenBatch). It falls when a
 * fund pays (a keyed payment or a remittance), the rest moves to the patient or a claim is written off. It used to
 * add up the totals of every batch with status "sent", which only grew. Before receipts are set up
 * (ar_invoice_balances missing) there is nothing else to go on, so it falls back to the sent batches' totals.
 */
async function loadClaimsInProgress(practiceId: string | null): Promise<number> {
  // ar_invoice_balances is newer than src/types/database.types.ts
  const db = supabase as unknown as SupabaseClient;
  type BalanceRow = { invoice_id: string; batch_id: string | null; medical_aid_outstanding: number | string | null };
  let balances: BalanceRow[];
  try {
    balances = await fetchAllRows<BalanceRow>((from, to) => {
      let query = db.from('ar_invoice_balances').select('invoice_id, batch_id, medical_aid_outstanding').gt('medical_aid_outstanding', 0);
      if (practiceId) query = query.eq('practice_id', practiceId);
      return query.order('invoice_id').range(from, to);
    }, 'claims in progress');
  } catch (error) {
    if (!(error instanceof Error && MISSING_TABLE.test(error.message))) throw error;
    const sent = await fetchAllRows<{ total_amount: number | string | null }>((from, to) => {
      let query = supabase.from('batch_headers').select('total_amount').eq('status', 'sent');
      if (practiceId) query = query.eq('practice_id', practiceId);
      return query.order('id').range(from, to);
    }, 'claim batches');
    return sent.reduce((sum, batch) => sum + toAmount(batch.total_amount), 0);
  }

  const claimed = balances.filter(row => row.batch_id);
  const batchIds = [...new Set(claimed.map(row => row.batch_id as string))];
  const batches = (await Promise.all(chunk(batchIds, ID_CHUNK_SIZE).map(ids =>
    fetchAllRows<{ id: string; status: string | null; sent_at: string | null }>(
      (from, to) => supabase.from('batch_headers').select('id, status, sent_at').in('id', ids).order('id').range(from, to),
      'claim batches'
    )
  ))).flat();
  const sentIds = new Set(batches.filter(batch => !isOpenBatch(batch)).map(batch => batch.id));
  return fromCents(claimed
    .filter(row => sentIds.has(row.batch_id as string))
    .reduce((sum, row) => sum + toCents(toAmount(row.medical_aid_outstanding)), 0));
}

async function loadFinancialKPIs(
  practiceId: string | null,
  dateRange: FinanceDateRange,
  now: Date
): Promise<FinancialKPIs> {
  const periodStartKey = toDateKey(subMonths(now, MONTHS_BACK[dateRange]));
  const monthStartKey = toDateKey(startOfMonth(now));
  const trendStartKey = toDateKey(startOfMonth(subMonths(now, TREND_MONTHS - 1)));
  // Fetch enough history for both the selected period and the fixed 6-month trend chart
  const fetchStartKey = periodStartKey < trendStartKey ? periodStartKey : trendStartKey;

  const buildInvoicePage = (from: number, to: number) => {
    let query = supabase
      .from('invoices_enhanced')
      .select('id, invoice_number, total, medical_aid_total, patient_total, payment_status, payment_method, issue_date, updated_at, practitioner_id, patient_id')
      .gte('issue_date', fetchStartKey);
    if (practiceId) {
      query = query.eq('practice_id', practiceId);
    }
    return query.order('issue_date', { ascending: false }).order('id').range(from, to);
  };
  const [fetchedInvoices, claimsInProgress] = await Promise.all([
    fetchAllRows<InvoiceRow>(buildInvoicePage, 'invoices'),
    loadClaimsInProgress(practiceId)
  ]);

  const invoices = fetchedInvoices.filter(inv => !!inv.issue_date && inv.issue_date >= periodStartKey);

  const mtdInvoices = fetchedInvoices.filter(inv => !!inv.issue_date && inv.issue_date >= monthStartKey);
  // A cancelled invoice is void: it was never revenue, so it must not inflate billed totals or the trend
  const isBillable = (inv: InvoiceRow) => statusOf(inv) !== 'cancelled';
  const totalBilledMTD = sumTotals(mtdInvoices.filter(isBillable));
  const totalCollectedMTD = sumTotals(mtdInvoices.filter(inv => statusOf(inv) === 'paid'));

  const pendingInvoices = invoices.filter(inv => statusOf(inv) === 'pending');
  const overdueInvoices = invoices.filter(inv => statusOf(inv) === 'overdue');
  const totalOutstanding = sumTotals(pendingInvoices) + sumTotals(overdueInvoices);

  const monthlyRevenueTrend: FinancialKPIs['monthlyRevenueTrend'] = [];
  const invoiceVolumeTrend: FinancialKPIs['invoiceVolumeTrend'] = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const month = subMonths(now, i);
    const startKey = toDateKey(startOfMonth(month));
    const endKey = toDateKey(endOfMonth(month));
    const monthInvoices = fetchedInvoices.filter(
      inv => !!inv.issue_date && inv.issue_date >= startKey && inv.issue_date <= endKey && isBillable(inv)
    );
    const label = format(month, 'MMM yyyy');

    monthlyRevenueTrend.push({
      month: label,
      revenue: sumTotals(monthInvoices),
      medical_aid: sumTotals(monthInvoices, 'medical_aid_total'),
      patient: sumTotals(monthInvoices, 'patient_total')
    });
    invoiceVolumeTrend.push({ month: label, count: monthInvoices.length });
  }

  const revenueByStatus = [
    { name: 'Paid', value: sumTotals(invoices.filter(inv => statusOf(inv) === 'paid')), color: STATUS_COLORS.paid },
    { name: 'Pending', value: sumTotals(pendingInvoices), color: STATUS_COLORS.pending },
    { name: 'Overdue', value: sumTotals(overdueInvoices), color: STATUS_COLORS.overdue }
  ].filter(item => item.value > 0);

  const services = await fetchServicesForInvoices(invoices.map(inv => inv.id));
  const serviceGroups = services.reduce((acc, service) => {
    const key = service.description || 'Unknown Service';
    if (!acc[key]) {
      acc[key] = { name: key, revenue: 0, count: 0 };
    }
    acc[key].revenue += toAmount(service.total_price);
    acc[key].count += service.quantity || 1;
    return acc;
  }, {} as Record<string, { name: string; revenue: number; count: number }>);

  const topServices = Object.values(serviceGroups)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(service => ({
      ...service,
      avg: service.count > 0 ? service.revenue / service.count : 0
    }));

  const patientIds = [...new Set(invoices.map(inv => inv.patient_id).filter((id): id is string => !!id))];
  let medicalAidBreakdown: FinancialKPIs['medicalAidBreakdown'] = [];
  if (patientIds.length > 0) {
    const providerByPatient = await fetchProviderByPatient(patientIds);
    const medicalAidGroups = invoices.reduce((acc, inv) => {
      const provider = inv.patient_id ? providerByPatient[inv.patient_id] : undefined;
      if (provider) {
        acc[provider] = (acc[provider] || 0) + toAmount(inv.medical_aid_total);
      }
      return acc;
    }, {} as Record<string, number>);

    const totalMedicalAid = Object.values(medicalAidGroups).reduce((sum, value) => sum + value, 0);
    medicalAidBreakdown = Object.entries(medicalAidGroups)
      .map(([provider, value]) => ({
        provider,
        value,
        percentage: totalMedicalAid > 0 ? (value / totalMedicalAid) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  const practitionerGroups = invoices.reduce((acc, inv) => {
    if (!inv.practitioner_id) return acc;
    if (!acc[inv.practitioner_id]) {
      acc[inv.practitioner_id] = { revenue: 0, patients: new Set<string>() };
    }
    acc[inv.practitioner_id].revenue += toAmount(inv.total);
    if (inv.patient_id) {
      acc[inv.practitioner_id].patients.add(inv.patient_id);
    }
    return acc;
  }, {} as Record<string, { revenue: number; patients: Set<string> }>);

  const practitionerPerformance = Object.entries(practitionerGroups)
    .map(([id, data]) => ({
      name: `Practitioner ${id.slice(0, 8)}`,
      revenue: data.revenue,
      patients: data.patients.size
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const statusSummary = Object.fromEntries(
    INVOICE_STATUSES.map(status => {
      const rows = invoices.filter(inv => statusOf(inv) === status);
      return [status, { count: rows.length, amount: sumTotals(rows) }];
    })
  ) as FinancialKPIs['statusSummary'];

  // invoices are already newest-first (issue_date desc)
  const recentInvoiceRows = invoices.slice(0, RECENT_LIMIT);
  const recentPaidRows = invoices
    .filter(inv => statusOf(inv) === 'paid')
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, RECENT_LIMIT);
  const listPatientIds = [...new Set(
    [...recentInvoiceRows, ...recentPaidRows].map(inv => inv.patient_id).filter((id): id is string => !!id)
  )];
  const patientNames = await fetchPatientNames(practiceId, listPatientIds);

  return {
    totalBilledMTD,
    totalCollectedMTD,
    totalOutstanding,
    claimsInProgress,
    invoiceCount: invoices.length,
    monthlyRevenueTrend,
    invoiceVolumeTrend,
    revenueByStatus,
    topServices,
    medicalAidBreakdown,
    practitionerPerformance,
    statusSummary,
    recentInvoices: recentInvoiceRows.map(inv => toListItem(inv, patientNames)),
    recentPaidInvoices: recentPaidRows.map(inv => toListItem(inv, patientNames))
  };
}

/**
 * Map a patient's invoices_enhanced rows to PremiumBillingModal items, one per invoice, so the
 * modal's totals are the invoice totals. Cancelled invoices are excluded (nothing was spent and
 * nothing is owed); a missing or unrecognised status counts as pending, i.e. still owed.
 */
export function toPatientBillingItems(invoices: PatientInvoiceRow[] | null | undefined): PatientBillingItem[] {
  return (invoices || [])
    .filter(invoice => invoice.payment_status !== 'cancelled')
    .map(invoice => ({
      id: invoice.id,
      date: invoice.issue_date || invoice.created_at || invoice.due_date || '',
      type: 'invoice' as const,
      description: invoice.notes?.trim() || 'Visit invoice',
      amount: toAmount(invoice.total),
      status: invoice.payment_status === 'paid' || invoice.payment_status === 'overdue'
        ? invoice.payment_status
        : 'pending',
      paymentMethod: invoice.payment_method || undefined,
      invoiceNumber: invoice.invoice_number || undefined
    }));
}

export const financialKpiService = {
  /**
   * Load finance KPIs for a practice. practiceId null falls back to RLS scoping only
   * (e.g. super admins without a selected practice), matching previous behaviour.
   */
  getFinancialKPIs(
    practiceId: string | null,
    dateRange: FinanceDateRange,
    now: Date = new Date()
  ): Promise<FinancialKPIs> {
    return withTimeout(
      loadFinancialKPIs(practiceId, dateRange, now),
      FINANCE_KPI_TIMEOUT_MS,
      'Financial data took too long to load. Check your connection and try again.'
    );
  }
};
