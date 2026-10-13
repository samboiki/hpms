/**
 * Encounters > Analytics: the rows behind each card, read only and always scoped to the signed-in practice
 * (src/utils/encounters/encounterAnalytics.ts turns them into figures). One light read per card: the period's visits,
 * the invoice lines that carry ICD-10 codes, the visits that asked for a follow-up; plus the staff list for names.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchAllRows } from './financialKpiService';
import { loadPracticeStaff } from './invoiceContextService';
import { lookupIcd10Codes } from './icd10Service';
import { EXCLUDE_CARRIER_VISITS } from '../utils/carrierVisits';
import {
  followUpsDue,
  topDiagnoses,
  type AnalyticsVisitRow,
  type DiagnosisCount,
  type DiagnosisLineRow,
  type DueFollowUp,
  type FollowUpVisitRow,
  type PeriodRange,
  type PractitionerName
} from '../utils/encounters/encounterAnalytics';

// The rows are typed by the figures' module: the generated database types do not know every live column, and the
// client's reading of a nested select string does not match the rows PostgREST returns
const db = supabase as unknown as SupabaseClient;
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

const VISIT_COLUMNS = 'id, patient_id, doctor_id, scheduled_date, visit_date, status, is_cancelled, is_checked_in, is_ready, visit_type';

/** Booked in the period, or (walk-ins without a booked date) seen in it: the day the diary shows a visit on */
export const periodFilter = (range: PeriodRange): string =>
  `and(scheduled_date.gte.${range.from},scheduled_date.lte.${range.to}),` +
  `and(scheduled_date.is.null,visit_date.gte.${range.from},visit_date.lte.${range.to})`;

/** The practice's staff for names; null when the list cannot be read (names then show as not loaded) */
const staffNames = (practiceId: string): Promise<PractitionerName[] | null> => loadPracticeStaff(practiceId).catch(() => null);

export interface PeriodVisits {
  rows: AnalyticsVisitRow[];
  staff: PractitionerName[] | null;
}

/** The Visits view: every visit of the period (rows that only carry invoices are not visits). */
export async function loadPeriodVisits(practiceId: string, range: PeriodRange): Promise<PeriodVisits> {
  const [rows, staff] = await Promise.all([
    fetchAllRows<AnalyticsVisitRow>(
      (from, to) =>
        db.from('visits').select(VISIT_COLUMNS).eq('practice_id', practiceId).or(periodFilter(range)).or(EXCLUDE_CARRIER_VISITS)
          .order('id').range(from, to) as unknown as Page<AnalyticsVisitRow>,
      'the visits of the period'
    ),
    staffNames(practiceId)
  ]);
  return { rows, staff };
}

export interface TopDiagnoses {
  rows: DiagnosisCount[];
  /** The codes' names from the medical aids' ICD-10 list; a code missing here shows on its own */
  descriptions: Map<string, string>;
}

/** Top diagnoses: the ICD-10 codes on the lines of the practice's invoices dated in the period. */
export async function loadTopDiagnoses(practiceId: string, range: PeriodRange): Promise<TopDiagnoses> {
  const lines = await fetchAllRows<DiagnosisLineRow>(
    (from, to) =>
      db
        .from('invoice_services')
        .select('id, icd10_primary, icd10_secondary, invoice:invoices_enhanced!inner(visit_id, payment_status, practice_id, issue_date)')
        .eq('invoice.practice_id', practiceId)
        .gte('invoice.issue_date', range.from)
        .lte('invoice.issue_date', range.to)
        // A line's other codes need a main one (the database checks it), so lines without one carry none
        .not('icd10_primary', 'is', null)
        .order('id')
        .range(from, to) as unknown as Page<DiagnosisLineRow>,
    'the diagnosis codes of the period'
  );
  const rows = topDiagnoses(lines);
  const lookup = rows.length > 0 ? await lookupIcd10Codes(rows.map((row) => row.code)) : null;
  const descriptions = new Map<string, string>();
  lookup?.entries.forEach((entry, code) => descriptions.set(code, entry.description));
  return { rows, descriptions };
}

export interface FollowUpsDueLoad {
  items: DueFollowUp[];
  staff: PractitionerName[] | null;
}

/** Follow-up visits due: visits whose follow-up date fell in the period up to today, with the patient's other visits. */
export async function loadFollowUpsDue(practiceId: string, range: PeriodRange, todayKey: string): Promise<FollowUpsDueLoad> {
  const [rows, staff] = await Promise.all([
    fetchAllRows<FollowUpVisitRow>(
      (from, to) =>
        db
          .from('visits')
          .select(
            `${VISIT_COLUMNS}, follow_up_date, patient:patients!visits_patient_id_fkey(first_name, last_name, ` +
              'visits!visits_patient_id_fkey(id, scheduled_date, visit_date, status, is_cancelled, is_checked_in, is_ready))'
          )
          .eq('practice_id', practiceId)
          .eq('follow_up_required', true)
          .gte('follow_up_date', range.from)
          .lte('follow_up_date', todayKey)
          .order('id')
          .range(from, to) as unknown as Page<FollowUpVisitRow>,
      'the follow-ups of the period'
    ),
    staffNames(practiceId)
  ]);
  return { items: followUpsDue(rows, range, todayKey), staff };
}
