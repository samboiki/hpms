/**
 * Data for Finance > Reports' report builder (R22): the period's invoices, payments or visits, read from fixed columns
 * with the signed-in person's own rights (row level security keeps them to the practice), and the practice's saved
 * reports (report_queries, proposals/2026-10-13-report-builder.sql; saved and removed only through report_query_save
 * and report_query_archive, which check that the caller works in the practice and may open Finance). Before that file
 * is applied the builder works and says saving is not set up yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import {
  NO_SHOW_NOTE_MARKER,
  dateKeyFrom,
  isInRange,
  normalizeInvoiceBalance,
  normalizeReceipt,
  normalizeVisit,
  type ArInvoiceBalance,
  type DateRange,
  type RawInvoiceBalanceRow,
  type RawReceiptRow,
  type RawVisitRow
} from '../../../services/ledgerService';
import { BALANCE_COLUMNS, RECEIPT_COLUMNS, isArNotSetUp } from '../receipts/arService';
import { fetchByIds, fetchPages, loadMedicalAidPlans, loadPatientNames, timed } from '../debtors/debtorsService';
import { assertRange, loadPeriodInvoices, settleReport } from './periodReportsService';
import type { ReportLoad } from './practiceReportsService';
import { EXCLUDE_CARRIER_VISITS } from '../../../utils/carrierVisits';
import { parseDefinition, type BuilderInput, type BuilderSource, type BuilderVisit, type QueryDefinition } from './reportBuilder';

// The generated database types do not know the receipts and report tables
const db = supabase as unknown as SupabaseClient;

const unique = (ids: ReadonlyArray<string | null>): string[] => [...new Set(ids.filter((id): id is string => !!id))];
const names = (practiceId: string, ids: ReadonlyArray<string | null>) => loadPatientNames(practiceId, unique(ids)).catch(() => ({} as Record<string, string>));

/** What each invoice still owes once receipts are in use; before that, nothing (the invoice's status says it) */
async function loadBalances(practiceId: string, invoiceIds: readonly string[]): Promise<Record<string, ArInvoiceBalance>> {
  try {
    const rows = await timed(fetchByIds<RawInvoiceBalanceRow>(invoiceIds, 'invoice balances', (chunk, from, to) => db
      .from('ar_invoice_balances').select(BALANCE_COLUMNS).eq('practice_id', practiceId).eq('has_entries', true).in('invoice_id', chunk)
      .order('invoice_id').range(from, to)), 'invoice balances');
    return Object.fromEntries(rows.map(row => [row.invoice_id, normalizeInvoiceBalance(row)]));
  } catch (error) {
    if (isArNotSetUp(error)) return {};
    throw error;
  }
}

const VISIT_BUILDER_COLUMNS =
  'id, patient_id, doctor_id, visit_date, scheduled_date, scheduled_time, visit_time, visit_type, status, is_cancelled, is_checked_in, is_ready, is_handoff, is_from_website';

type RawBuilderVisit = RawVisitRow & {
  patient_id: string | null;
  scheduled_time: string | null;
  visit_time: string | null;
  visit_type: string | null;
  is_from_website: boolean | null;
};

async function loadVisits(practiceId: string, range: DateRange): Promise<{ visits: BuilderVisit[]; patientNames: Record<string, string> }> {
  const within = (column: string) => `and(${column}.gte.${range.startKey},${column}.lte.${range.endKey})`;
  const inPeriod = `${within('scheduled_date')},${within('visit_date')}`;
  const [rows, noShows] = await Promise.all([
    // Rows that only carry invoices (payment plans, packages, opening balances) are not visits
    timed(fetchPages<RawBuilderVisit>('visits', (from, to) => db
      .from('visits').select(VISIT_BUILDER_COLUMNS).eq('practice_id', practiceId).or(inPeriod).or(EXCLUDE_CARRIER_VISITS)
      .order('id').range(from, to)), 'visits'),
    // Missed appointments are saved as cancelled with a marker note (only their ids are read, never the notes)
    timed(fetchPages<{ id: string }>('missed appointments', (from, to) => db
      .from('visits').select('id').eq('practice_id', practiceId).like('notes', `${NO_SHOW_NOTE_MARKER.replace(/[:()]/g, '%')}%`).or(inPeriod)
      .order('id').range(from, to)), 'missed appointments')
  ]);
  const noShowIds = new Set(noShows.map(row => row.id));
  const visits = rows
    .map(row => {
      const visit = normalizeVisit(row, noShowIds);
      return {
        id: row.id,
        patientId: row.patient_id ?? null,
        doctorId: visit.doctorId,
        dateKey: visit.dateKey,
        time: (row.scheduled_time ?? row.visit_time)?.slice(0, 5) ?? null,
        type: row.visit_type ?? null,
        stage: visit.stage,
        bookedOnline: row.is_from_website === true
      };
    })
    .filter(visit => isInRange(visit.dateKey, range));
  return { visits, patientNames: await names(practiceId, visits.map(visit => visit.patientId)) };
}

/** The period's records of one source, as the builder needs them */
export const loadBuilderInput = (practiceId: string, source: BuilderSource, range: DateRange): Promise<ReportLoad<BuilderInput>> =>
  settleReport('the records', async (): Promise<BuilderInput> => {
    assertRange(range);
    if (source === 'invoices') {
      const invoices = await loadPeriodInvoices(practiceId, range);
      const patientIds = unique(invoices.map(invoice => invoice.patientId));
      const [balances, patientNames, plans] = await Promise.all([
        loadBalances(practiceId, invoices.map(invoice => invoice.id)),
        names(practiceId, patientIds),
        loadMedicalAidPlans(patientIds)
      ]);
      return { source, invoices, balances, patientNames, fundByPatient: plans.fundByPatient };
    }
    if (source === 'payments') {
      const rows = await timed(fetchPages<RawReceiptRow>('payments', (from, to) => db
        .from('ar_receipt_balances').select(RECEIPT_COLUMNS).eq('practice_id', practiceId).is('reversed_at', null)
        .gte('received_on', range.startKey).lte('received_on', range.endKey).order('receipt_id').range(from, to)), 'payments');
      const receipts = rows.map(normalizeReceipt);
      return { source, receipts, patientNames: await names(practiceId, receipts.map(receipt => receipt.patientId)) };
    }
    return { source, ...(await loadVisits(practiceId, range)) };
  });

// ---------------------------------------------------------------------------------------------
// Saved reports
// ---------------------------------------------------------------------------------------------

export interface SavedQuery {
  id: string;
  name: string;
  /** null when the stored definition can no longer be read (it is then offered for removal only) */
  definition: QueryDefinition | null;
  updatedAt: string | null;
}

export const SAVED_NOT_SET_UP = 'Saving reports is not set up in this database yet (proposals/2026-10-13-report-builder.sql). The builder works; its choices are not kept.';

export const loadSavedQueries = (practiceId: string): Promise<ReportLoad<SavedQuery[]>> =>
  settleReport('the saved reports', async () => {
    const rows = await timed(fetchPages<{ id: string; name: string | null; definition: unknown; updated_at: string | null; created_at: string | null }>('saved reports', (from, to) => db
      .from('report_queries').select('id, name, definition, updated_at, created_at').eq('practice_id', practiceId).is('archived_at', null)
      .order('name').range(from, to)), 'saved reports');
    return rows.map(row => ({
      id: row.id,
      name: row.name?.trim() || 'Saved report',
      definition: parseDefinition(row.definition),
      updatedAt: dateKeyFrom(row.updated_at ?? row.created_at)
    }));
  });

/** The database's refusal in plain words */
function saveError(error: { code?: string; message?: string }, action: string): Error {
  if (isArNotSetUp(error)) return new Error(SAVED_NOT_SET_UP);
  if (error.code === '42501') return new Error('Only staff who open Finance in this practice can save or remove its reports.');
  if (error.code === '23505') return new Error('The practice already has a saved report with that name. Choose another name.');
  return new Error(error.message || `${action} failed`);
}

/** Saves a report under a name (a new one, or the one with this id); returns its id */
export async function saveQuery(practiceId: string, id: string | null, name: string, definition: Record<string, unknown>): Promise<string> {
  const { data, error } = await timed(Promise.resolve(db.rpc('report_query_save', { p_practice_id: practiceId, p_id: id, p_name: name.trim(), p_definition: definition })), 'saving the report');
  if (error) throw saveError(error, 'Saving the report');
  return String(data);
}

/** Removes a saved report from the list (it is kept in the database, marked removed) */
export async function removeQuery(id: string): Promise<void> {
  const { error } = await timed(Promise.resolve(db.rpc('report_query_archive', { p_id: id })), 'removing the report');
  if (error) throw saveError(error, 'Removing the report');
}

