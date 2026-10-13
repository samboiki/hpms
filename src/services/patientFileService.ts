/**
 * Temporary patient files (booked with a name and cell number only), the patient's formal name and the file's numbers
 * (OneHealth reference, old file number), read and written for the booking form, the visit actions, the patient header
 * and the edit form. The rules live in src/utils/patients/temporaryPatient.ts, patientName.ts and patientNumbers.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingColumnError } from '../utils/diary/dbErrors';
import { formalPatientName } from '../utils/patients/patientName';
import { normalizeOldFileNumber } from '../utils/patients/patientNumbers';
import { patientFileStatus, temporaryPatientRow, type CallerDetails, type PatientFileStatus } from '../utils/patients/temporaryPatient';

// Untyped: the generated types require columns the database fills itself and do not know title and initials yet
const untypedDb = supabase as unknown as SupabaseClient;

export interface OpenedPatient {
  id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  cell_number: string | null;
}

/** Opens a temporary file for a caller: the name and cell number now, the rest when the patient arrives. */
export async function createTemporaryPatient(practiceId: string, caller: CallerDetails): Promise<OpenedPatient> {
  const { data, error } = await untypedDb
    .from('patients')
    .insert([temporaryPatientRow(caller, practiceId)])
    .select('id, first_name, last_name, id_number, cell_number')
    .single();
  if (error || !data) throw new Error(`Could not open a file for the new patient: ${error?.message ?? 'nothing was saved'}`);
  return data as OpenedPatient;
}

/** Whether the patient's file still has to be completed; null when the patient is not found. */
export async function loadPatientFileStatus(patientId: string): Promise<PatientFileStatus | null> {
  const { data, error } = await supabase.from('patients').select('id_number, date_of_birth, gender').eq('id', patientId).maybeSingle();
  if (error) throw new Error(`Could not read the patient's file: ${error.message}`);
  return data ? patientFileStatus(data) : null;
}

/** "Mrs N M Shilongo"; null when the file has no title or initials, or the columns are not there yet. */
export async function loadFormalName(patientId: string): Promise<string | null> {
  const { data, error } = await untypedDb.from('patients').select('title, initials, first_name, last_name').eq('id', patientId).maybeSingle();
  if (error) {
    if (isMissingColumnError(error)) return null;
    throw new Error(`Could not read the patient's title and initials: ${error.message}`);
  }
  return data ? formalPatientName(data as Parameters<typeof formalPatientName>[0]) : null;
}

/** The numbers a file is known by besides the ID number (src/utils/patients/patientNumbers.ts) */
export interface PatientFileNumbers {
  /** The OneHealth reference (patients.system_patient_reference_number) */
  reference: number | null;
  /** The old file number (patients.legacy_account_number); null when there is none */
  oldFileNumber: string | null;
  /** False before the column exists (proposals/2026-10-07-eminance-import.sql): no old number is shown or saved */
  oldFileNumberAvailable: boolean;
}

/** The file's OneHealth reference and old file number, for the patient file header and the edit form. */
export async function loadPatientFileNumbers(patientId: string): Promise<PatientFileNumbers> {
  const { data, error } = await untypedDb.from('patients').select('system_patient_reference_number, legacy_account_number').eq('id', patientId).maybeSingle();
  if (error && isMissingColumnError(error)) {
    const fallback = await untypedDb.from('patients').select('system_patient_reference_number').eq('id', patientId).maybeSingle();
    if (fallback.error) throw new Error(`Could not read the patient's reference number: ${fallback.error.message}`);
    const row = (fallback.data ?? {}) as { system_patient_reference_number?: number | null };
    return { reference: row.system_patient_reference_number ?? null, oldFileNumber: null, oldFileNumberAvailable: false };
  }
  if (error) throw new Error(`Could not read the patient's reference number: ${error.message}`);
  const row = (data ?? {}) as { system_patient_reference_number?: number | null; legacy_account_number?: string | null };
  return {
    reference: row.system_patient_reference_number ?? null,
    oldFileNumber: normalizeOldFileNumber(row.legacy_account_number) || null,
    oldFileNumberAvailable: true
  };
}
