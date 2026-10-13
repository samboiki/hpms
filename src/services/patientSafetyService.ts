/**
 * Allergies, "no known allergies", the clinical alert note, the problem list and allergy overrides
 * (proposals/2026-10-07-patient-safety.sql).
 *
 * Until that file is applied the tables do not exist: every call then throws SafetyNotSetUpError and
 * the screens say "not switched on yet" instead of failing. Who recorded, verified or removed a record
 * and when is stamped by the database from the signed-in user, never sent from here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingTableError } from '../utils/diary/dbErrors';
import type { ProblemStatus } from '../utils/clinical/problemList';

export const SAFETY_TABLES = ['patient_allergies', 'patient_clinical_profiles', 'patient_problems', 'patient_allergy_overrides'] as const;

export class SafetyNotSetUpError extends Error {
  constructor() {
    super('Allergy, alert and problem records are not switched on yet.');
    this.name = 'SafetyNotSetUpError';
  }
}

export function isSafetyNotSetUp(error: unknown): boolean {
  return error instanceof SafetyNotSetUpError || SAFETY_TABLES.some(table => isMissingTableError(error, table));
}

export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'unknown';
export type AllergyRemoval = 'resolved' | 'entered_in_error';

export const SEVERITY_LABELS: Readonly<Record<AllergySeverity, string>> = {
  severe: 'Severe',
  moderate: 'Moderate',
  mild: 'Mild',
  unknown: 'Severity not known'
};

export interface AllergyRecord {
  id: string;
  patientId: string;
  substance: string;
  reaction: string | null;
  severity: AllergySeverity;
  recordedByName: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  createdAt: string;
}

export interface ClinicalProfileRecord {
  noKnownAllergies: boolean;
  nkaConfirmedAt: string | null;
  nkaConfirmedByName: string | null;
  alertNote: string | null;
  alertUpdatedAt: string | null;
  alertUpdatedByName: string | null;
}

export interface ProblemRecord {
  id: string;
  patientId: string;
  description: string;
  icd10Code: string | null;
  status: ProblemStatus;
  chronic: boolean;
  onsetDate: string | null;
  resolvedDate: string | null;
  sourceVisitId: string | null;
  createdAt: string;
}

export interface PatientSafety {
  /** Active allergies, oldest first */
  allergies: AllergyRecord[];
  profile: ClinicalProfileRecord | null;
  /** Active and past problems (not those entered in error), oldest first */
  problems: ProblemRecord[];
}

interface DbError {
  code?: string;
  message?: string;
}

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const nameOf = (value: unknown): string | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? text((row as Row).full_name) : null;
};

const SEVERITIES: readonly AllergySeverity[] = ['mild', 'moderate', 'severe', 'unknown'];

export function toAllergyRecord(row: Row): AllergyRecord {
  const severity = SEVERITIES.includes(row.severity as AllergySeverity) ? (row.severity as AllergySeverity) : 'unknown';
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    substance: String(row.substance ?? ''),
    reaction: text(row.reaction),
    severity,
    recordedByName: nameOf(row.recorder),
    verifiedAt: text(row.verified_at),
    verifiedByName: nameOf(row.verifier),
    createdAt: String(row.created_at ?? '')
  };
}

export function toProfileRecord(row: Row | null): ClinicalProfileRecord | null {
  if (!row) return null;
  return {
    noKnownAllergies: row.no_known_allergies === true,
    nkaConfirmedAt: text(row.nka_confirmed_at),
    nkaConfirmedByName: nameOf(row.nka_user),
    alertNote: text(row.alert_note),
    alertUpdatedAt: text(row.alert_updated_at),
    alertUpdatedByName: nameOf(row.alert_user)
  };
}

export function toProblemRecord(row: Row): ProblemRecord {
  const status = row.status === 'past' || row.status === 'entered_in_error' ? row.status : 'active';
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    description: String(row.description ?? ''),
    icd10Code: text(row.icd10_code),
    status,
    chronic: row.chronic === true,
    onsetDate: text(row.onset_date),
    resolvedDate: text(row.resolved_date),
    sourceVisitId: text(row.source_visit_id),
    createdAt: String(row.created_at ?? '')
  };
}

/** A message for the screen; our own database rules already speak plainly. */
export function safetyErrorMessage(error: unknown, fallback: string): string {
  if (isSafetyNotSetUp(error)) return new SafetyNotSetUpError().message;
  const { code, message } = (error && typeof error === 'object' ? error : {}) as DbError;
  if (code === '23514' || code === '42501') return message || fallback;
  return fallback;
}

const fail = (error: DbError, fallback: string): never => {
  if (isSafetyNotSetUp(error)) throw new SafetyNotSetUpError();
  const failure = new Error(safetyErrorMessage(error, fallback)) as Error & { code?: string };
  failure.code = error.code;
  throw failure;
};

// The generated database types do not include these tables until the file is applied, so rows are read
// with the untyped client and normalised above (same approach as patientListService.ts)
const db = supabase as unknown as SupabaseClient;

export async function loadPatientSafety(patientId: string): Promise<PatientSafety> {
  const [allergies, profile, problems] = await Promise.all([
    db
      .from('patient_allergies')
      .select(
        'id, patient_id, substance, reaction, severity, verified_at, created_at, ' +
          'verifier:users!patient_allergies_verified_by_fkey(full_name), recorder:users!patient_allergies_recorded_by_fkey(full_name)'
      )
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
    db
      .from('patient_clinical_profiles')
      .select(
        'patient_id, no_known_allergies, nka_confirmed_at, alert_note, alert_updated_at, ' +
          'nka_user:users!patient_clinical_profiles_nka_confirmed_by_fkey(full_name), ' +
          'alert_user:users!patient_clinical_profiles_alert_updated_by_fkey(full_name)'
      )
      .eq('patient_id', patientId)
      .maybeSingle(),
    db
      .from('patient_problems')
      .select('id, patient_id, description, icd10_code, status, chronic, onset_date, resolved_date, source_visit_id, created_at')
      .eq('patient_id', patientId)
      .neq('status', 'entered_in_error')
      .order('created_at', { ascending: true })
  ]);
  for (const result of [allergies, profile, problems]) {
    if (result.error) fail(result.error, 'Could not load the allergies and alerts.');
  }
  return {
    // The select strings are joined from parts, so the client cannot type the rows: normalised here
    allergies: ((allergies.data ?? []) as unknown as Row[]).map(toAllergyRecord),
    profile: toProfileRecord((profile.data ?? null) as unknown as Row | null),
    problems: ((problems.data ?? []) as unknown as Row[]).map(toProblemRecord)
  };
}

/**
 * The allergy line printed on a prescription, for the pharmacist who dispenses it: the recorded
 * allergies, or "No known allergies", or null when allergies were never recorded (nothing is printed
 * rather than something that reads like a clean bill).
 */
export function printedAllergyLine(safety: PatientSafety | null): string | null {
  if (!safety) return null;
  if (safety.allergies.length > 0) return `Allergies: ${safety.allergies.map(allergyLabel).join(', ')}`;
  return safety.profile?.noKnownAllergies ? 'No known allergies' : null;
}

/** "Penicillin (severe)" or "Latex": the short form on the alert strip and the prescription */
export function allergyLabel(allergy: Pick<AllergyRecord, 'substance' | 'severity'>): string {
  return allergy.severity === 'severe' || allergy.severity === 'moderate' ? `${allergy.substance} (${allergy.severity})` : allergy.substance;
}

export interface NewAllergy {
  substance: string;
  reaction: string;
  severity: AllergySeverity;
  /** Recorded and verified in one step (practitioners, nurses, admins) */
  verified: boolean;
}

export async function addAllergy(practiceId: string, patientId: string, allergy: NewAllergy): Promise<void> {
  const substance = allergy.substance.replace(/\s+/g, ' ').trim();
  const { error } = await db.from('patient_allergies').insert({
    practice_id: practiceId,
    patient_id: patientId,
    substance,
    reaction: allergy.reaction.trim() || null,
    severity: allergy.severity,
    verified_at: allergy.verified ? new Date().toISOString() : null
  });
  if (error) {
    if (error.code === '23505') throw new Error(`${substance} is already on the allergy list.`);
    fail(error, 'Could not save the allergy.');
  }
}

export async function verifyAllergy(allergyId: string): Promise<void> {
  const { error } = await db.from('patient_allergies').update({ verified_at: new Date().toISOString() }).eq('id', allergyId);
  if (error) fail(error, 'Could not verify the allergy.');
}

export async function removeAllergy(allergyId: string, reason: AllergyRemoval): Promise<void> {
  const { error } = await db.from('patient_allergies').update({ status: reason }).eq('id', allergyId);
  if (error) fail(error, 'Could not remove the allergy.');
}

/** Saves "no known allergies" (true) or takes the statement back (false). */
export async function setNoKnownAllergies(practiceId: string, patientId: string, value: boolean): Promise<void> {
  const { error } = await db
    .from('patient_clinical_profiles')
    .upsert({ practice_id: practiceId, patient_id: patientId, no_known_allergies: value }, { onConflict: 'patient_id' });
  if (error) fail(error, 'Could not save "no known allergies".');
}

export const MAX_ALERT_NOTE = 200;

export async function saveAlertNote(practiceId: string, patientId: string, note: string): Promise<void> {
  const trimmed = note.replace(/\s+/g, ' ').trim().slice(0, MAX_ALERT_NOTE);
  const { error } = await db
    .from('patient_clinical_profiles')
    .upsert({ practice_id: practiceId, patient_id: patientId, alert_note: trimmed || null }, { onConflict: 'patient_id' });
  if (error) fail(error, 'Could not save the alert.');
}

export interface NewProblem {
  description: string;
  icd10Code: string | null;
  chronic: boolean;
  onsetDate: string | null;
  sourceVisitId: string | null;
}

export async function addProblem(practiceId: string, patientId: string, problem: NewProblem): Promise<void> {
  const { error } = await db.from('patient_problems').insert({
    practice_id: practiceId,
    patient_id: patientId,
    description: problem.description,
    icd10_code: problem.icd10Code,
    chronic: problem.chronic,
    onset_date: problem.onsetDate,
    source_visit_id: problem.sourceVisitId
  });
  if (error) {
    if (error.code === '23505') throw new Error(`${problem.icd10Code ?? problem.description} is already on the active problem list.`);
    fail(error, 'Could not save the problem.');
  }
}

export async function setProblemStatus(problemId: string, status: ProblemStatus): Promise<void> {
  const { error } = await db.from('patient_problems').update({ status }).eq('id', problemId);
  if (error) {
    if (error.code === '23505') throw new Error('This problem is already on the active list.');
    fail(error, 'Could not update the problem.');
  }
}

export interface AllergyOverride {
  practiceId: string;
  patientId: string;
  visitId: string | null;
  allergyId: string;
  allergySubstance: string;
  medicine: string;
  reason: string;
}

/** Keeps the decision to prescribe despite an allergy warning, with the reason. */
export async function recordAllergyOverride(override: AllergyOverride): Promise<void> {
  const { error } = await db.from('patient_allergy_overrides').insert({
    practice_id: override.practiceId,
    patient_id: override.patientId,
    visit_id: override.visitId,
    allergy_id: override.allergyId,
    allergy_substance: override.allergySubstance,
    medicine: override.medicine.trim(),
    reason: override.reason.trim()
  });
  if (error) fail(error, 'Could not record the reason. The medicine was not added.');
}

export const patientSafetyService = {
  loadPatientSafety,
  addAllergy,
  verifyAllergy,
  removeAllergy,
  setNoKnownAllergies,
  saveAlertNote,
  addProblem,
  setProblemStatus,
  recordAllergyOverride
};
