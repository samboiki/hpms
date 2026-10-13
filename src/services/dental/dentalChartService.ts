/**
 * Reads and writes for the dental chart (proposals/2026-10-07-dental-chart.sql) and the billed history it is built on.
 *
 * - The billed history (invoice lines with tooth numbers) needs nothing new and always loads.
 * - Until the proposal is applied the chart tables and functions do not exist: loadChart says 'not_set_up' and the
 *   Teeth view says charting is not set up yet, while still showing the billed history.
 * - Every write goes through the database functions, which check that the signed-in user is staff of the patient's
 *   practice (and a practitioner, nurse or practice admin for clinical changes) and stamp who and when.
 * - Prices and quotes come from the quotes module (loadTariffSet, billableOn, loadPatientFund, saveQuote and the line
 *   builder): the plan is priced, and its quote saved, exactly as a quote made by hand.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { loadInvoicingSetup } from '../invoicingSetup';
import { isMissingFunctionError, isMissingTableError } from '../../utils/diary/dbErrors';
import { todayKey } from '../../utils/billing/dates';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import type { LineContext } from '../../components/quotes/billingLines';
import { defaultValidUntil, effectiveQuoteStatus, estimateQuote, fundRatesFromTariffs, servicesToQuoteLines } from '../../components/quotes/quotes';
import {
  billableOn,
  isQuotesNotEnabledError,
  loadPatientFund,
  loadQuotes,
  loadTariffSet,
  saveQuote,
  type PatientFund,
  type TariffSet
} from '../../components/quotes/quoteService';
import type { VisitTariff } from '../../components/visits/visitBillingLines';
import {
  toBilledLines,
  type BilledLine,
  type ChartChange,
  type ChartEntry,
  type EntryStatus,
  type InvoiceLineRow,
  type InvoiceRow,
  type PlanItem,
  type QuoteRef,
  type VisitDateRow
} from '../../utils/dental/chart';
import type { PlanPlace } from '../../utils/dental/plan';
import { priceVisit, type PricedVisit } from '../../utils/dental/planPricing';
import type { DentalWork } from '../../utils/dental/workTypes';

// The generated database types do not know the chart tables and functions yet
const db = supabase as unknown as SupabaseClient;

export const DENTAL_CHART_TABLES = ['dental_chart_entries', 'dental_chart_changes'] as const;
export const DENTAL_CHART_FUNCTIONS = ['dental_chart_add', 'dental_chart_set_status', 'dental_chart_void', 'dental_plan_arrange', 'dental_plan_link_quote'] as const;

export class DentalChartNotSetUpError extends Error {
  constructor() {
    super('Charting is not set up yet.');
    this.name = 'DentalChartNotSetUpError';
  }
}

/** True when the chart's tables or functions are not in the database yet (only ours: another missing object is a real error). */
export function isDentalChartNotSetUp(error: unknown): boolean {
  return (
    error instanceof DentalChartNotSetUpError ||
    DENTAL_CHART_TABLES.some(table => isMissingTableError(error, table)) ||
    DENTAL_CHART_FUNCTIONS.some(name => isMissingFunctionError(error, name))
  );
}

interface DbError {
  code?: string;
  message?: string;
}

/** The database's own message (its functions say in plain words why a change was refused). */
const fail = (error: DbError, fallback: string): never => {
  if (isDentalChartNotSetUp(error)) throw new DentalChartNotSetUpError();
  throw new Error(error.message || fallback);
};

// ---------------------------------------------------------------------------------------------------
// The practice type (the chart is for dental practices only)
// ---------------------------------------------------------------------------------------------------

const practiceTypes = new Map<string, Promise<string | null>>();

/** The practice's type, read once per practice and session (it does not change while someone works). */
export function loadPracticeType(practiceId: string): Promise<string | null> {
  const known = practiceTypes.get(practiceId);
  if (known) return known;
  const pending = (async () => {
    const { data, error } = await supabase.from('practices').select('practice_type').eq('id', practiceId).maybeSingle();
    if (error) throw new Error(`Could not read the practice: ${error.message}`);
    return data?.practice_type ?? null;
  })();
  // A failed read is asked again next time
  pending.catch(() => practiceTypes.delete(practiceId));
  practiceTypes.set(practiceId, pending);
  return pending;
}

/** Whether the practice is a dental practice (isDentalPractice); false when its type cannot be read. */
export async function loadIsDentalPractice(practiceId: string): Promise<boolean> {
  try {
    return isDentalPractice(await loadPracticeType(practiceId));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------
// The billed history and the patient
// ---------------------------------------------------------------------------------------------------

export interface BilledHistory {
  lines: BilledLine[];
  /** Lines whose tooth number is not a tooth (not drawn on the chart) */
  unplaced: number;
}

const ID_CHUNK = 200;

function chunks<T>(items: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / ID_CHUNK) }, (_, index) => items.slice(index * ID_CHUNK, (index + 1) * ID_CHUNK));
}

/** Every invoice line of the patient that carries a tooth number, dated by its service. */
export async function loadBilledToothLines(patientId: string): Promise<BilledHistory> {
  const { data: invoices, error } = await supabase
    .from('invoices_enhanced')
    .select('id, invoice_number, visit_id, issue_date, created_at, payment_status')
    .eq('patient_id', patientId);
  if (error) throw new Error(`Could not read the patient's invoices: ${error.message}`);
  const invoiceRows = (invoices ?? []) as InvoiceRow[];
  if (invoiceRows.length === 0) return { lines: [], unplaced: 0 };

  // The line's own service date exists once the invoicing update is applied
  const setup = await loadInvoicingSetup();
  const columns = `id, invoice_id, code, description, tooth_number${setup.lineDetails ? ', service_date' : ''}`;
  const lineRows: InvoiceLineRow[] = [];
  for (const ids of chunks(invoiceRows.map(invoice => invoice.id))) {
    const { data, error: lineError } = await db.from('invoice_services').select(columns).in('invoice_id', ids).not('tooth_number', 'is', null);
    if (lineError) throw new Error(`Could not read the invoice lines: ${lineError.message}`);
    lineRows.push(...((data ?? []) as unknown as InvoiceLineRow[]));
  }

  const visitIds = [...new Set(invoiceRows.flatMap(invoice => (invoice.visit_id ? [invoice.visit_id] : [])))];
  const visitRows: VisitDateRow[] = [];
  for (const ids of chunks(visitIds)) {
    const { data, error: visitError } = await supabase.from('visits').select('id, visit_date').in('id', ids);
    if (visitError) throw new Error(`Could not read the visits: ${visitError.message}`);
    visitRows.push(...((data ?? []) as VisitDateRow[]));
  }
  return toBilledLines(invoiceRows, lineRows, visitRows);
}

/** The patient's date of birth (yyyy-MM-dd), which decides whether the chart opens on milk or permanent teeth. */
export async function loadPatientBirthDate(patientId: string): Promise<string | null> {
  const { data, error } = await supabase.from('patients').select('date_of_birth').eq('id', patientId).maybeSingle();
  if (error) return null;
  return data?.date_of_birth ?? null;
}

// ---------------------------------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------------------------------

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const nameOf = (value: unknown): string | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? text((row as Row).full_name) : null;
};

const STATUSES: readonly EntryStatus[] = ['existing', 'defective', 'planned', 'done', 'removed'];
const WORK: readonly DentalWork[] = ['filling', 'crown', 'root_canal', 'implant', 'bridge', 'extraction', 'missing', 'other'];
const ACTIONS: readonly ChartChange['action'][] = ['recorded', 'status', 'quote', 'error'];

const statusOf = (value: unknown): EntryStatus | null => (STATUSES.includes(value as EntryStatus) ? (value as EntryStatus) : null);

export function toChartEntry(row: Row): ChartEntry {
  return {
    id: String(row.id),
    tooth: String(row.tooth ?? ''),
    surfaces: text(row.surfaces),
    // The database allows only known values; anything else is never drawn as work on a tooth (history only)
    work: WORK.includes(row.work as DentalWork) ? (row.work as DentalWork) : 'other',
    status: statusOf(row.status) ?? 'removed',
    tariffCode: text(row.tariff_code),
    planVisit: count(row.plan_visit),
    planOrder: count(row.plan_order),
    quoteId: text(row.quote_id),
    visitId: text(row.visit_id),
    invoiceId: text(row.invoice_id),
    note: text(row.note),
    recordedBy: nameOf(row.recorder),
    recordedAt: String(row.recorded_at ?? ''),
    statusChangedAt: text(row.status_changed_at),
    voidedAt: text(row.voided_at),
    voidedBy: nameOf(row.voider),
    voidReason: text(row.void_reason)
  };
}

export function toChartChange(row: Row): ChartChange {
  return {
    id: String(row.id),
    entryId: String(row.entry_id),
    action: ACTIONS.includes(row.action as ChartChange['action']) ? (row.action as ChartChange['action']) : 'status',
    fromStatus: statusOf(row.from_status),
    toStatus: statusOf(row.to_status),
    quoteId: text(row.quote_id),
    reason: text(row.reason),
    changedBy: nameOf(row.changer),
    changedAt: String(row.changed_at ?? '')
  };
}

const ENTRY_COLUMNS =
  'id, tooth, surfaces, work, status, tariff_code, plan_visit, plan_order, quote_id, visit_id, invoice_id, note, recorded_at, ' +
  'status_changed_at, voided_at, void_reason, recorder:users!dental_chart_entries_recorded_by_fkey(full_name), ' +
  'voider:users!dental_chart_entries_voided_by_fkey(full_name)';
const CHANGE_COLUMNS =
  'id, entry_id, action, from_status, to_status, quote_id, reason, changed_at, changer:users!dental_chart_changes_changed_by_fkey(full_name)';

export type ChartLoad = { status: 'ready'; entries: ChartEntry[]; changes: ChartChange[] } | { status: 'not_set_up' };

/** What was charted for the patient and its audit trail, oldest first; 'not_set_up' before the proposal is applied. */
export async function loadChart(patientId: string): Promise<ChartLoad> {
  const [entries, changes] = await Promise.all([
    db.from('dental_chart_entries').select(ENTRY_COLUMNS).eq('patient_id', patientId).order('recorded_at', { ascending: true }),
    db.from('dental_chart_changes').select(CHANGE_COLUMNS).eq('patient_id', patientId).order('changed_at', { ascending: true })
  ]);
  if (entries.error) {
    if (isDentalChartNotSetUp(entries.error)) return { status: 'not_set_up' };
    throw new Error(`Could not read the dental chart: ${entries.error.message}`);
  }
  if (changes.error) {
    if (isDentalChartNotSetUp(changes.error)) return { status: 'not_set_up' };
    throw new Error(`Could not read the chart history: ${changes.error.message}`);
  }
  return {
    status: 'ready',
    entries: ((entries.data ?? []) as unknown as Row[]).map(toChartEntry),
    changes: ((changes.data ?? []) as unknown as Row[]).map(toChartChange)
  };
}

/** The patient's quotes as plan items refer to them (an expired draft shows as expired); none before quotes exist. */
export async function loadQuoteRefs(practiceId: string, patientId: string): Promise<QuoteRef[]> {
  try {
    const quotes = await loadQuotes({ practiceId, patientId });
    const today = todayKey();
    return quotes.map(quote => ({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: effectiveQuoteStatus(quote.status, quote.validUntil, today),
      convertedInvoiceId: quote.convertedInvoiceId
    }));
  } catch (error) {
    if (isQuotesNotEnabledError(error)) return [];
    throw error;
  }
}

export interface NewChartEntry {
  tooth: string;
  work: DentalWork;
  status: 'existing' | 'defective' | 'planned';
  surfaces?: string | null;
  tariffCode?: string | null;
  planVisit?: number | null;
  visitId?: string | null;
  note?: string | null;
}

/** Records work found on teeth or plans work (dental_chart_add); returns the new ids. */
export async function addChartEntries(patientId: string, entries: readonly NewChartEntry[]): Promise<string[]> {
  const { data, error } = await db.rpc('dental_chart_add', {
    p_patient_id: patientId,
    p_entries: entries.map(entry => ({
      tooth: entry.tooth,
      work: entry.work,
      status: entry.status,
      surfaces: entry.surfaces || null,
      tariff_code: entry.tariffCode || null,
      plan_visit: entry.planVisit ?? null,
      visit_id: entry.visitId || null,
      note: entry.note?.trim() || null
    }))
  });
  if (error) fail(error, 'Could not save the chart');
  return ((data ?? []) as unknown[]).map(String);
}

/** Changes the status of entries (dental_chart_set_status); a visit given with "done" is stored with its invoice. */
export async function setChartStatus(entryIds: readonly string[], status: EntryStatus, visitId: string | null = null): Promise<number> {
  const { data, error } = await db.rpc('dental_chart_set_status', { p_entry_ids: [...entryIds], p_status: status, p_visit_id: visitId });
  if (error) fail(error, 'Could not change the chart');
  return Number(data ?? 0);
}

/** Marks an entry as entered in error, with the reason (dental_chart_void). */
export async function markEnteredInError(entryId: string, reason: string): Promise<void> {
  const { error } = await db.rpc('dental_chart_void', { p_entry_id: entryId, p_reason: reason.trim() });
  if (error) fail(error, 'Could not mark the entry as a mistake');
}

/** Stores where planned work sits: its planned visit and its order (dental_plan_arrange). */
export async function arrangePlan(patientId: string, places: readonly PlanPlace[]): Promise<void> {
  if (places.length === 0) return;
  const { error } = await db.rpc('dental_plan_arrange', {
    p_patient_id: patientId,
    p_places: places.map(place => ({ id: place.id, plan_visit: place.planVisit, plan_order: place.planOrder }))
  });
  if (error) fail(error, 'Could not save the order of the plan');
}

/** Records the quote planned work was put on (dental_plan_link_quote). */
export async function linkPlanToQuote(entryIds: readonly string[], quoteId: string): Promise<void> {
  const { error } = await db.rpc('dental_plan_link_quote', { p_entry_ids: [...entryIds], p_quote_id: quoteId });
  if (error) fail(error, 'Could not link the plan to its quote');
}

// ---------------------------------------------------------------------------------------------------
// Prices and quotes
// ---------------------------------------------------------------------------------------------------

export interface PlanPricing {
  tariffSet: TariffSet;
  fund: PatientFund;
  /** The tariffs that may be billed on the service date, priced for the patient's fund */
  billable: VisitTariff[];
  context: LineContext;
  serviceDate: string;
}

/** The practice's tariffs and the patient's fund, as a quote made today would use them. */
export async function loadPlanPricing(practiceId: string, patientId: string, serviceDate: string = todayKey()): Promise<PlanPricing> {
  const [tariffSet, fund] = await Promise.all([loadTariffSet(practiceId), loadPatientFund(patientId)]);
  // At the patient's own price rate too, as the quote and the visit price the work
  const billable = billableOn(tariffSet, serviceDate, fund.pricingFund, fund.patientRate ?? null);
  return {
    tariffSet,
    fund,
    billable,
    serviceDate,
    context: {
      tariffs: billable,
      hasMedicalAid: fund.hasMedicalAid,
      autoInfectionControl: isDentalPractice(tariffSet.practiceType),
      infectionControlStaff: tariffSet.infectionControlStaff
    }
  };
}

export interface PlanQuoteResult {
  quoteId: string;
  /** Set when the quote was saved but the plan could not be linked to it */
  linkError: string | null;
  /** The practice's linked codes the quote holds with the planned work ("0201 x2" with "8201"), to tell staff */
  linked: PricedVisit['linked'];
}

/**
 * Makes a draft quote of one planned visit's work, priced as the visit will be billed, through the quotes' own
 * save_quote (the quote's totals are the sums of its lines), then links the plan items to it.
 */
export async function makePlanQuote(params: {
  practiceId: string;
  patientId: string;
  visit: number;
  items: readonly PlanItem[];
  pricing: PlanPricing;
}): Promise<PlanQuoteResult> {
  const { pricing } = params;
  const priced = priceVisit(params.visit, params.items, pricing.context);
  const problems = [...priced.items.values()].flatMap(item => (item.problem ? [item.problem] : []));
  if (problems.length > 0) throw new Error(`Fix the plan before making the quote: ${problems.join(' ')}`);
  if (priced.lines.length === 0) throw new Error('There is no work to quote in this visit.');
  const estimate = estimateQuote(priced.lines, {
    hasMedicalAid: pricing.fund.hasMedicalAid,
    fundName: pricing.fund.fundName,
    rates: fundRatesFromTariffs(pricing.billable)
  });
  const quoteId = await saveQuote({
    id: null,
    practiceId: params.practiceId,
    patientId: params.patientId,
    status: 'draft',
    quoteDate: pricing.serviceDate,
    validUntil: defaultValidUntil(pricing.serviceDate),
    fund: pricing.fund,
    estimate,
    preauthNumber: '',
    fundReference: '',
    notes: `Treatment plan, visit ${params.visit}.`,
    lines: servicesToQuoteLines(priced.lines, estimate)
  });
  try {
    await linkPlanToQuote(params.items.map(item => item.entry.id), quoteId);
    return { quoteId, linkError: null, linked: priced.linked };
  } catch (error) {
    return { quoteId, linkError: error instanceof Error ? error.message : 'unknown error', linked: priced.linked };
  }
}
