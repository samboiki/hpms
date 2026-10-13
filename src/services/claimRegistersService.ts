/**
 * The referral and authorisation registers on a patient's file and a visit's claim details (parity C10, D15, F18, F19):
 * proposals/2026-10-12-referrals-and-authorisations.sql. Staff of the practice read the rows; every change goes through a
 * database function that checks the practice and the rules again (save_patient_referral, remove_patient_referral,
 * save_patient_authorisation, remove_patient_authorisation, save_visit_claim_details). Before that file is applied the
 * loaders say "not set up" and nothing is saved. The rules: src/utils/billing/referrals.ts, authorisations.ts and
 * visitClaimDetails.ts (tested).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { plainWords } from '../utils/plainErrors';
import { supabase } from '../lib/supabase';
import { normalizeInvoiceStatus } from './ledger/invoices';
import { isNotSetUpError } from './invoicingSetup';
import { RECORDS_BUCKET, recordPath } from './recordFiles';
import { authorisationUsageFrom, type AuthorisationUsage, type AuthorisationValues, type PatientAuthorisation } from '../utils/billing/authorisations';
import type { PatientReferral, ReferralValues } from '../utils/billing/referrals';
import type { VisitClaimDetails } from '../utils/billing/visitClaimDetails';

// The tables and functions are newer than src/types/database.types.ts
const db = supabase as unknown as SupabaseClient;

export const REGISTERS_NOT_SET_UP =
  'Referrals and authorisations are not set up in this database yet (proposals/2026-10-12-referrals-and-authorisations.sql).';

export type RegisterLoad<T> = { status: 'ready'; rows: T[] } | { status: 'not_set_up' } | { status: 'error'; message: string };

type DbError = { code?: string; message?: string };

/** A refusal in plain words: the database's own sentence for a rule, a plain one for the practice check */
function failure(error: DbError, action: string): Error {
  if (isNotSetUpError(error)) return new Error(REGISTERS_NOT_SET_UP);
  if (error.code === '42501') return new Error("Only staff of this patient's practice can change these records.");
  return new Error(error.message || `${action} failed. Try again.`);
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

// ---------------------------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------------------------

interface ReferralRow {
  id: string;
  patient_id: string;
  referring_name: string;
  referring_practice_number: string | null;
  referring_hpcna: string | null;
  referral_number: string | null;
  referral_date: string;
  valid_until: string | null;
  reason: string | null;
  letter_path: string | null;
  letter_name: string | null;
  removed_at: string | null;
  created_at: string | null;
}

const REFERRAL_COLUMNS =
  'id, patient_id, referring_name, referring_practice_number, referring_hpcna, referral_number, referral_date, valid_until, reason, letter_path, letter_name, removed_at, created_at';

const toReferral = (row: ReferralRow): PatientReferral => ({
  id: row.id,
  patientId: row.patient_id,
  referringName: row.referring_name,
  referringPracticeNumber: text(row.referring_practice_number),
  referringHpcna: text(row.referring_hpcna),
  referralNumber: text(row.referral_number),
  referralDate: row.referral_date,
  validUntil: row.valid_until,
  reason: text(row.reason),
  letterPath: text(row.letter_path),
  letterName: text(row.letter_name),
  removedAt: row.removed_at,
  createdAt: row.created_at
});

/** The patient's referrals, newest letter first (removed ones too: they stay for the record) */
export async function loadPatientReferrals(patientId: string): Promise<RegisterLoad<PatientReferral>> {
  try {
    const { data, error } = await db.from('patient_referrals').select(REFERRAL_COLUMNS).eq('patient_id', patientId)
      .order('referral_date', { ascending: false }).order('created_at', { ascending: false }).limit(200);
    if (error) return isNotSetUpError(error) ? { status: 'not_set_up' } : { status: 'error', message: `The referrals could not be loaded: ${error.message}` };
    return { status: 'ready', rows: ((data ?? []) as ReferralRow[]).map(toReferral) };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? plainWords(error.message) : 'The referrals could not be loaded.' };
  }
}

/** Saves a referral (new when `id` is null); returns its id */
export async function savePatientReferral(
  id: string | null,
  patientId: string,
  values: ReferralValues & { letterPath: string | null; letterName: string | null }
): Promise<string> {
  const { data, error } = await db.rpc('save_patient_referral', {
    p_id: id,
    p_patient_id: patientId,
    p_referral: {
      referring_name: values.referringName,
      referring_practice_number: values.referringPracticeNumber,
      referring_hpcna: values.referringHpcna,
      referral_number: values.referralNumber,
      referral_date: values.referralDate,
      valid_until: values.validUntil,
      reason: values.reason,
      letter_path: values.letterPath,
      letter_name: values.letterName
    }
  });
  if (error) throw failure(error, 'Saving the referral');
  return String(data);
}

/** Takes a referral off the register (it stays for the record; lines that named it go with the visit's referral) */
export async function removePatientReferral(id: string): Promise<void> {
  const { error } = await db.rpc('remove_patient_referral', { p_id: id });
  if (error) throw failure(error, 'Removing the referral');
}

/** Referral letters: a PDF or a photo of the letter, up to 10 MB */
export const REFERRAL_LETTER_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_REFERRAL_LETTER_BYTES = 10 * 1024 * 1024;

/** Why a file cannot be the referral letter; null when it can */
export function referralLetterProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(REFERRAL_LETTER_TYPES as readonly string[]).includes(file.type)) return 'Add the letter as a PDF, or a JPG or PNG photo of it.';
  if (file.size > MAX_REFERRAL_LETTER_BYTES) return 'The letter is larger than 10 MB: scan it at a lower resolution.';
  return null;
}

/** Stores a referral letter in the private records bucket, in the practice's folder; returns where it is */
export async function uploadReferralLetter(practiceId: string, patientId: string, file: File): Promise<{ path: string; name: string }> {
  const problem = referralLetterProblem(file);
  if (problem) throw new Error(problem);
  const path = recordPath(practiceId, 'patient-documents', patientId, 'referrals', `${Date.now()}_${file.name}`);
  const { error } = await supabase.storage.from(RECORDS_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) throw new Error(`The letter could not be stored: ${error.message}`);
  return { path, name: file.name.slice(0, 200) };
}

// ---------------------------------------------------------------------------------------------
// Authorisations
// ---------------------------------------------------------------------------------------------

interface AuthorisationRow {
  id: string;
  patient_id: string;
  fund_reference: string;
  authorisation_number: string;
  valid_from: string;
  valid_to: string;
  all_codes: boolean;
  codes: string[] | null;
  visits_allowed: number | null;
  note: string | null;
  quote_id: string | null;
  removed_at: string | null;
  created_at: string | null;
}

const AUTHORISATION_COLUMNS =
  'id, patient_id, fund_reference, authorisation_number, valid_from, valid_to, all_codes, codes, visits_allowed, note, quote_id, removed_at, created_at';

const toAuthorisation = (row: AuthorisationRow): PatientAuthorisation => ({
  id: row.id,
  patientId: row.patient_id,
  fundReference: row.fund_reference,
  number: row.authorisation_number,
  validFrom: row.valid_from,
  validTo: row.valid_to,
  allCodes: row.all_codes,
  codes: row.codes ?? [],
  visitsAllowed: row.visits_allowed,
  note: text(row.note),
  quoteId: row.quote_id,
  removedAt: row.removed_at,
  createdAt: row.created_at
});

/** The patient's authorisations, the latest window first (removed ones too) */
export async function loadPatientAuthorisations(patientId: string): Promise<RegisterLoad<PatientAuthorisation>> {
  try {
    const { data, error } = await db.from('patient_authorisations').select(AUTHORISATION_COLUMNS).eq('patient_id', patientId)
      .order('valid_to', { ascending: false }).order('created_at', { ascending: false }).limit(200);
    if (error) return isNotSetUpError(error) ? { status: 'not_set_up' } : { status: 'error', message: `The authorisations could not be loaded: ${error.message}` };
    return { status: 'ready', rows: ((data ?? []) as AuthorisationRow[]).map(toAuthorisation) };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? plainWords(error.message) : 'The authorisations could not be loaded.' };
  }
}

/**
 * The visits that already carry each authorisation number on this patient's invoices (cancelled invoices left out), for
 * "visits allowed". An empty map when the lines cannot be read: the database counts again when a number is applied.
 */
export async function loadAuthorisationUsage(patientId: string): Promise<AuthorisationUsage> {
  try {
    const { data, error } = await db
      .from('invoice_services')
      .select('authorisation_number, invoices_enhanced!inner(visit_id, patient_id, payment_status)')
      .eq('invoices_enhanced.patient_id', patientId)
      .not('authorisation_number', 'is', null)
      .limit(2000);
    if (error) return new Map();
    type Row = { authorisation_number: string | null; invoices_enhanced: { visit_id: string | null; payment_status: string | null } | null };
    return authorisationUsageFrom(((data ?? []) as unknown as Row[]).map(row => ({
      number: row.authorisation_number,
      visitId: row.invoices_enhanced?.visit_id ?? null,
      cancelled: normalizeInvoiceStatus(row.invoices_enhanced?.payment_status) === 'cancelled'
    })));
  } catch {
    return new Map();
  }
}

/**
 * Saves an authorisation (new when `id` is null). The database also puts its number on the patient's lines already
 * billed in its window that have none (not on lines a fund was sent): `applied` says how many.
 */
export async function savePatientAuthorisation(id: string | null, patientId: string, values: AuthorisationValues): Promise<{ id: string; applied: number }> {
  const { data, error } = await db.rpc('save_patient_authorisation', {
    p_id: id,
    p_patient_id: patientId,
    p_authorisation: {
      fund_reference: values.fundReference,
      authorisation_number: values.number,
      valid_from: values.validFrom,
      valid_to: values.validTo,
      all_codes: values.allCodes,
      codes: values.codes,
      visits_allowed: values.visitsAllowed,
      note: values.note,
      quote_id: values.quoteId
    }
  });
  if (error) throw failure(error, 'Saving the authorisation');
  const result = (data ?? {}) as { id?: string; applied?: number };
  return { id: String(result.id ?? ''), applied: Number(result.applied ?? 0) };
}

/** Takes an authorisation off the register; lines that carry its number keep it */
export async function removePatientAuthorisation(id: string): Promise<void> {
  const { error } = await db.rpc('remove_patient_authorisation', { p_id: id });
  if (error) throw failure(error, 'Removing the authorisation');
}

// ---------------------------------------------------------------------------------------------
// A visit's claim details
// ---------------------------------------------------------------------------------------------

interface ClaimDetailsRow {
  referral_id: string | null;
  referring_name: string | null;
  referring_practice_number: string | null;
  referring_hpcna: string | null;
  referral_number: string | null;
  in_hospital: boolean;
  admission_date: string | null;
  discharge_date: string | null;
  place_of_service: string | null;
}

export type ClaimDetailsLoad =
  | { status: 'ready'; details: VisitClaimDetails | null }
  | { status: 'not_set_up' }
  | { status: 'error'; message: string };

/** A visit's referral, hospital stay and place of service; null when it has none */
export async function loadVisitClaimDetails(visitId: string): Promise<ClaimDetailsLoad> {
  try {
    const { data, error } = await db
      .from('visit_claim_details')
      .select('referral_id, referring_name, referring_practice_number, referring_hpcna, referral_number, in_hospital, admission_date, discharge_date, place_of_service')
      .eq('visit_id', visitId)
      .maybeSingle();
    if (error) return isNotSetUpError(error) ? { status: 'not_set_up' } : { status: 'error', message: `The visit's claim details could not be loaded: ${error.message}` };
    const row = data as ClaimDetailsRow | null;
    return {
      status: 'ready',
      details: row
        ? {
            referralId: row.referral_id,
            referringName: text(row.referring_name),
            referringPracticeNumber: text(row.referring_practice_number),
            referringHpcna: text(row.referring_hpcna),
            referralNumber: text(row.referral_number),
            inHospital: row.in_hospital,
            admissionDate: row.admission_date,
            dischargeDate: row.discharge_date,
            placeOfService: text(row.place_of_service)
          }
        : null
    };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? plainWords(error.message) : "The visit's claim details could not be loaded." };
  }
}

/**
 * Saves a visit's claim details (all empty removes them); the visit's lines in an open claim batch are claimed with them
 * at once, a sent batch never changes. True when the visit now has details.
 */
export async function saveVisitClaimDetails(visitId: string, details: VisitClaimDetails): Promise<boolean> {
  const { data, error } = await db.rpc('save_visit_claim_details', {
    p_visit_id: visitId,
    p_details: {
      referral_id: details.referralId,
      referring_name: details.referringName,
      referring_practice_number: details.referringPracticeNumber,
      referring_hpcna: details.referringHpcna,
      referral_number: details.referralNumber,
      in_hospital: details.inHospital,
      admission_date: details.admissionDate,
      discharge_date: details.dischargeDate,
      place_of_service: details.placeOfService
    }
  });
  if (error) throw failure(error, "Saving the visit's claim details");
  return Boolean((data as { saved?: boolean } | null)?.saved);
}
