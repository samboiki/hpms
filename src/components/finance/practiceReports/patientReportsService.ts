/**
 * Data for Finance > Reports' demographics and new patients (R26) and spend and patients by town (R28): the practice's
 * patient files (merged files left out), the patients with a referral letter or a website booking, and the period's
 * invoices. Every read is scoped to the practice and runs with the signed-in person's own rights. The patient's town and
 * region columns are read when the database has them; otherwise the town comes from the address (patientTowns.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import type { DateRange, LedgerInvoice } from '../../../services/ledgerService';
import { isArNotSetUp } from '../receipts/arService';
import { fetchPages, timed } from '../debtors/debtorsService';
import type { PatientRecord } from './patientDemographics';
import { assertRange, loadPeriodInvoices, settleReport } from './periodReportsService';
import type { ReportLoad } from './practiceReportsService';

// The generated database types do not know the newer patient columns
const db = supabase as unknown as SupabaseClient;

const PATIENT_COLUMNS = 'id, first_name, last_name, home_language, home_address, postal_address, created_at, legacy_account_number';

interface RawPatientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  home_language: string | null;
  home_address: string | null;
  postal_address: string | null;
  created_at: string | null;
  legacy_account_number: string | null;
  town?: string | null;
  region?: string | null;
}

/** "There is no such column": the town and region columns before the database has them */
const isMissingColumn = (error: unknown): boolean => {
  const { code, message } = (error ?? {}) as { code?: string | null; message?: string };
  return code === '42703' || code === 'PGRST204' || /column .* does not exist/i.test(message ?? '');
};

type Page<T> = PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>;

// The column list is built at run time (with or without town), so the client cannot type the rows itself
const readPatients = (practiceId: string, columns: string) =>
  timed(fetchPages<RawPatientRow>('patient files', (from, to) => db
    .from('patients').select(columns).eq('practice_id', practiceId).is('merged_into_patient_id', null).order('id').range(from, to) as unknown as Page<RawPatientRow>), 'patient files');

export interface PatientFiles {
  records: PatientRecord[];
  /** True when the patients table has the town and region columns (the town on the file is then used first) */
  townField: boolean;
}

/** Every patient file of the practice, with the town and region columns when the database has them */
export async function loadPatientFiles(practiceId: string): Promise<PatientFiles> {
  let rows: RawPatientRow[];
  let townField = true;
  try {
    rows = await readPatients(practiceId, `${PATIENT_COLUMNS}, town, region`);
  } catch (error) {
    if (!isMissingColumn(error)) throw error;
    townField = false;
    rows = await readPatients(practiceId, PATIENT_COLUMNS);
  }
  return {
    townField,
    records: rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      homeLanguage: row.home_language,
      homeAddress: row.home_address,
      postalAddress: row.postal_address,
      town: row.town ?? null,
      region: row.region ?? null,
      createdAt: row.created_at,
      legacyAccountNumber: row.legacy_account_number
    }))
  };
}

/** Patient ids from a practice-scoped query of one column; a table that is not there yet gives none */
async function patientIdsOf(label: string, build: (from: number, to: number) => PromiseLike<{ data: Array<{ patient_id: string | null }> | null; error: { code?: string; message?: string } | null }>): Promise<Set<string>> {
  try {
    const rows = await timed(fetchPages(label, build), label);
    return new Set(rows.map(row => row.patient_id).filter((id): id is string => !!id));
  } catch (error) {
    if (isArNotSetUp(error)) return new Set();
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// R26 demographics and new patients
// ---------------------------------------------------------------------------------------------

export interface DemographicsData extends PatientFiles {
  /** Patients with a referral letter on file (not removed) */
  referred: Set<string>;
  /** Patients with a booking made on the practice's website */
  bookedOnline: Set<string>;
}

export const loadDemographics = (practiceId: string): Promise<ReportLoad<DemographicsData>> =>
  settleReport('the patient files', async () => {
    const [files, referred, bookedOnline] = await Promise.all([
      loadPatientFiles(practiceId),
      patientIdsOf('referral letters', (from, to) => db
        .from('patient_referrals').select('patient_id').eq('practice_id', practiceId).is('removed_at', null).order('id').range(from, to)),
      patientIdsOf('online bookings', (from, to) => db
        .from('visits').select('patient_id').eq('practice_id', practiceId).eq('is_from_website', true).order('id').range(from, to))
    ]);
    return { ...files, referred, bookedOnline };
  });

// ---------------------------------------------------------------------------------------------
// R28 spend and patients by town
// ---------------------------------------------------------------------------------------------

export interface PatientSpendData extends PatientFiles {
  invoices: LedgerInvoice[];
}

export const loadPatientSpend = (practiceId: string, range: DateRange): Promise<ReportLoad<PatientSpendData>> =>
  settleReport('the spend per patient', async () => {
    assertRange(range);
    const [invoices, files] = await Promise.all([loadPeriodInvoices(practiceId, range), loadPatientFiles(practiceId)]);
    return { invoices, ...files };
  });
