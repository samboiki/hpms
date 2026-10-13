/**
 * Data for Finance > Reports' payments by age of debt (R1) and year to date (R21), and the period's invoices that the
 * patient-spend, gross-profit and report-builder reports share. Every read is scoped to the practice (by practice_id,
 * or by ids that come from practice-scoped rows) and runs with the signed-in person's own rights. Before the receipts
 * tables exist the payments loader says 'not_set_up'.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import {
  invoiceDateKey,
  isInRange,
  isRevenueInvoice,
  normalizeAllocation,
  normalizeInvoice,
  normalizeLineItem,
  normalizeReceipt,
  normalizeVisit,
  type ArAllocation,
  type DateRange,
  type LedgerInvoice,
  type LedgerLineItem,
  type LedgerVisit,
  type RawAllocationRow,
  type RawInvoiceRow,
  type RawLineItemRow,
  type RawReceiptRow,
  type RawVisitRow
} from '../../../services/ledgerService';
import { ALLOCATION_COLUMNS, INVOICE_COLUMNS, RECEIPT_COLUMNS, isArNotSetUp } from '../receipts/arService';
import { errorText, fetchByIds, fetchPages, loadMedicalAidPlans, loadPatientNames, timed } from '../debtors/debtorsService';
import { LINE_ITEM_COLUMNS, VISIT_COLUMNS } from '../financeData';
import { paymentParts, type PaymentPart } from './allocationAges';
import type { ReportLoad } from './practiceReportsService';

// The generated database types do not know the receipts tables
const db = supabase as unknown as SupabaseClient;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Date keys go into PostgREST filter strings, so only plain yyyy-MM-dd values are accepted */
export function assertRange(range: DateRange): void {
  if (!DATE_KEY.test(range.startKey) || !DATE_KEY.test(range.endKey)) throw new Error('The selected period is not a valid date range');
}

/** Runs a loader, turning "the table is not there yet" into not_set_up and anything else into its words */
export async function settleReport<T>(label: string, task: () => Promise<T>, notSetUp: (error: unknown) => boolean = isArNotSetUp): Promise<ReportLoad<T>> {
  try {
    return { state: 'ready', data: await task() };
  } catch (error) {
    if (notSetUp(error)) return { state: 'not_set_up' };
    return { state: 'error', error: errorText(error, `Could not load ${label}`) };
  }
}

const unique = (ids: ReadonlyArray<string | null>): string[] => [...new Set(ids.filter((id): id is string => !!id))];

/**
 * The practice's invoices whose invoice date (issue date, else the day it was created) falls in the range, cancelled
 * ones included (the reports leave them out by Finance's own rule, isRevenueInvoice).
 */
export async function loadPeriodInvoices(practiceId: string, range: DateRange): Promise<LedgerInvoice[]> {
  assertRange(range);
  const createdFrom = startOfDay(parseISO(range.startKey)).toISOString();
  const createdTo = endOfDay(parseISO(range.endKey)).toISOString();
  const rows = await timed(fetchPages<RawInvoiceRow>('invoices', (from, to) => db
    .from('invoices_enhanced').select(INVOICE_COLUMNS).eq('practice_id', practiceId)
    .or(`and(issue_date.gte.${range.startKey},issue_date.lte.${range.endKey}),and(issue_date.is.null,created_at.gte.${createdFrom},created_at.lte.${createdTo})`)
    .order('id').range(from, to)), 'invoices');
  return rows.map(normalizeInvoice).filter(invoice => isInRange(invoiceDateKey(invoice), range));
}

/** The uncancelled invoices of the range: what Finance counts as billed */
export const billedInvoices = (invoices: readonly LedgerInvoice[], range: DateRange): LedgerInvoice[] =>
  invoices.filter(invoice => isRevenueInvoice(invoice) && isInRange(invoiceDateKey(invoice), range));

// ---------------------------------------------------------------------------------------------
// R1 payments by the age of the debt they paid
// ---------------------------------------------------------------------------------------------

export interface PaymentAgeData {
  parts: PaymentPart[];
  patientNames: Record<string, string>;
}

export const loadPaymentAges = (practiceId: string, range: DateRange): Promise<ReportLoad<PaymentAgeData>> =>
  settleReport('the payments', async () => {
    assertRange(range);
    const receiptRows = await timed(fetchPages<RawReceiptRow>('payments', (from, to) => db
      .from('ar_receipt_balances').select(RECEIPT_COLUMNS).eq('practice_id', practiceId).is('reversed_at', null)
      .gte('received_on', range.startKey).lte('received_on', range.endKey).order('receipt_id').range(from, to)), 'payments');
    const receipts = receiptRows.map(normalizeReceipt);
    const allocationRows = await timed(fetchByIds<RawAllocationRow>(receipts.map(receipt => receipt.id), 'allocations', (chunk, from, to) => db
      .from('receipt_allocations').select(ALLOCATION_COLUMNS).eq('practice_id', practiceId).is('reversed_at', null)
      .in('receipt_id', chunk).order('id').range(from, to)), 'allocations');
    const allocations = allocationRows.map(normalizeAllocation).filter((row): row is ArAllocation => row !== null);
    const invoiceRows = await timed(fetchByIds<RawInvoiceRow>(allocations.map(allocation => allocation.invoiceId), 'invoices', (chunk, from, to) => db
      .from('invoices_enhanced').select(INVOICE_COLUMNS).eq('practice_id', practiceId).in('id', chunk).order('id').range(from, to)), 'invoices');
    const invoices = new Map(invoiceRows.map(normalizeInvoice).map(invoice => [invoice.id, invoice]));
    const parts = paymentParts(receipts, allocations, invoices, range);
    const patientNames = await loadPatientNames(practiceId, unique(receipts.map(receipt => receipt.patientId))).catch(() => ({} as Record<string, string>));
    return { parts, patientNames };
  });

// ---------------------------------------------------------------------------------------------
// R21 year to date
// ---------------------------------------------------------------------------------------------

export interface YearToDateData {
  invoices: LedgerInvoice[];
  lines: LedgerLineItem[];
  visits: LedgerVisit[];
  /** Medical aid (provider) per patient, as Finance's payer mix has it */
  schemeByPatient: Record<string, string>;
}

/** The year's invoices, the lines of those billed, the visits of the year (the treating doctor) and each patient's fund */
export const loadYearToDate = (practiceId: string, range: DateRange): Promise<ReportLoad<YearToDateData>> =>
  settleReport('the year to date', async () => {
    assertRange(range);
    const invoices = await loadPeriodInvoices(practiceId, range);
    const billed = billedInvoices(invoices, range);
    const within = (column: string) => `and(${column}.gte.${range.startKey},${column}.lte.${range.endKey})`;
    const [lineRows, visitRows, plans] = await Promise.all([
      timed(fetchByIds<RawLineItemRow>(billed.map(invoice => invoice.id), 'invoice lines', (chunk, from, to) => db
        .from('invoice_services').select(LINE_ITEM_COLUMNS).in('invoice_id', chunk).order('id').range(from, to)), 'invoice lines'),
      timed(fetchPages<RawVisitRow>('visits', (from, to) => db
        .from('visits').select(VISIT_COLUMNS).eq('practice_id', practiceId).or(`${within('scheduled_date')},${within('visit_date')}`)
        .order('id').range(from, to)), 'visits'),
      loadMedicalAidPlans(unique(billed.map(invoice => invoice.patientId)))
    ]);
    return {
      invoices,
      lines: lineRows.map(normalizeLineItem).filter((line): line is LedgerLineItem => line !== null),
      visits: visitRows.map(row => normalizeVisit(row)),
      schemeByPatient: plans.fundByPatient
    };
  });
