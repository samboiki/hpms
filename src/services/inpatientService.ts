/**
 * The Inpatient page's reads and saves (proposals/2026-10-13-inpatient-access.sql and inpatient-module.sql). Staff of
 * the practice read the wards, beds and stays; every change goes through a database function that checks the practice,
 * the role and the rule again (inpatient_*). Before the files are applied the loaders say "not set up" and nothing is
 * saved. The rules shown on screen: src/utils/inpatient/inpatientRules.ts (tested).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { looksTechnical, plainErrorMessage } from '../utils/plainErrors';
import type { DoseOutcome, DoseRecord } from '../utils/inpatient/inpatientRules';

// The new columns and functions are newer than src/types/database.types.ts
const db = supabase as unknown as SupabaseClient;

export const INPATIENT_NOT_SET_UP = 'The Inpatient page is not set up in this database yet. Please contact support.';

type DbError = { code?: string; message?: string };

const MISSING = /could not find the (table|function)|does not exist|schema cache/i;

/** True when a table, column or function of the inpatient files is not in the database yet */
export function isInpatientMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  return ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code ?? '') || MISSING.test(message ?? '');
}

export class InpatientNotSetUp extends Error {
  constructor() {
    super(INPATIENT_NOT_SET_UP);
  }
}

/** A refusal in plain words: the database function's own sentence for a rule, a plain one for anything technical */
function failure(error: DbError, fallback: string): Error {
  if (isInpatientMissing(error)) return new InpatientNotSetUp();
  const message = error.message?.trim() ?? '';
  if (message && !looksTechnical(message)) return new Error(message);
  return new Error(plainErrorMessage(error, fallback));
}

async function call<T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw failure(error, fallback);
  return data as T;
}

// ---------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------

export interface Ward {
  id: string;
  ward_name: string;
  ward_code: string | null;
  ward_type: string | null;
  floor_number: number | null;
  description: string | null;
  visiting_hours_start: string | null;
  visiting_hours_end: string | null;
  max_visitors_per_patient: number | null;
  is_active: boolean | null;
  bed_day_code: string | null;
  daily_codes: string[] | null;
}

export interface Bed {
  id: string;
  ward_id: string;
  bed_number: string;
  bed_code: string | null;
  bed_type: string | null;
  room_number: string | null;
  room_type: string | null;
  status: string | null;
  daily_rate: number | string | null;
  last_cleaned_at: string | null;
  notes: string | null;
  is_active: boolean | null;
}

export interface PatientName {
  first_name: string | null;
  last_name: string | null;
}

export interface Admission {
  id: string;
  admission_number: string;
  patient_id: string;
  visit_id: string | null;
  admission_date: string;
  expected_discharge_date: string | null;
  actual_discharge_date: string | null;
  admission_type: string;
  admission_source: string | null;
  attending_doctor_id: string | null;
  admitting_doctor_id: string | null;
  referring_doctor_name: string | null;
  referring_hospital: string | null;
  chief_complaint: string | null;
  primary_diagnosis: string | null;
  primary_diagnosis_code: string | null;
  secondary_diagnoses: string[] | null;
  secondary_diagnosis_codes: string[] | null;
  admission_status: string;
  patient_condition: string | null;
  pre_authorization_number: string | null;
  discharge_type: string | null;
  discharge_disposition: string | null;
  discharge_instructions: string | null;
  follow_up_date: string | null;
  special_requirements: string[] | null;
  isolation_required: boolean | null;
  isolation_type: string | null;
  fall_risk: boolean | null;
  allergy_alert: boolean | null;
  discharged_by: string | null;
  billed_invoice_id: string | null;
  billed_at: string | null;
  patients: PatientName | null;
}

export interface Allocation {
  id: string;
  admission_id: string;
  bed_id: string;
  ward_id: string;
  allocated_at: string;
  released_at: string | null;
  is_current: boolean | null;
}

export interface Transfer {
  id: string;
  from_bed_id: string | null;
  to_bed_id: string;
  from_ward_id: string | null;
  to_ward_id: string;
  transfer_datetime: string;
  transfer_reason: string;
  urgency: string | null;
  performed_by: string | null;
  notes: string | null;
}

export interface Round {
  id: string;
  doctor_id: string | null;
  round_datetime: string;
  round_type: string | null;
  patient_condition: string;
  consciousness_level: string | null;
  examination_findings: string | null;
  diagnosis_update: string | null;
  treatment_changes: string | null;
  new_orders: string[] | null;
  doctor_notes: string | null;
  discharge_planning_started: boolean | null;
  family_updated: boolean | null;
  next_review_date: string | null;
}

export interface NursingRecord {
  id: string;
  nurse_id: string | null;
  shift_type: string;
  shift_start_time: string;
  shift_end_time: string | null;
  vital_signs_checked: boolean | null;
  vitals_ids: string[] | null;
  fluid_intake_ml: number | null;
  urine_output_ml: number | null;
  other_output_ml: number | null;
  patient_condition: string | null;
  pain_level: number | null;
  mobility_status: string | null;
  skin_condition: string | null;
  bathed: boolean | null;
  position_changed: boolean | null;
  nursing_notes: string | null;
  handover_notes: string | null;
}

export interface Medication {
  id: string;
  medication_name: string;
  generic_name: string | null;
  dosage: string;
  dosage_unit: string | null;
  route: string;
  frequency: string;
  start_datetime: string;
  end_datetime: string | null;
  prescribed_by: string | null;
  scheduled_times: string[] | null;
  administration_records: DoseRecord[] | null;
  indication: string | null;
  special_instructions: string | null;
  status: string | null;
  discontinuation_reason: string | null;
  discontinued_at: string | null;
}

export interface VisitorLog {
  id: string;
  visitor_name: string;
  relationship: string | null;
  contact_number: string | null;
  check_in_time: string;
  check_out_time: string | null;
  purpose: string | null;
  notes: string | null;
}

export interface VitalsRow {
  id: string;
  created_at: string | null;
  blood_pressure: string | null;
  temperature: number | null;
  pulse_rate: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

const WARD_COLUMNS = 'id, ward_name, ward_code, ward_type, floor_number, description, visiting_hours_start, visiting_hours_end, max_visitors_per_patient, is_active, bed_day_code, daily_codes';
const BED_COLUMNS = 'id, ward_id, bed_number, bed_code, bed_type, room_number, room_type, status, daily_rate, last_cleaned_at, notes, is_active';
const ADMISSION_COLUMNS = 'id, admission_number, patient_id, visit_id, admission_date, expected_discharge_date, actual_discharge_date, admission_type, admission_source, attending_doctor_id, admitting_doctor_id, referring_doctor_name, referring_hospital, chief_complaint, primary_diagnosis, primary_diagnosis_code, secondary_diagnoses, secondary_diagnosis_codes, admission_status, patient_condition, pre_authorization_number, discharge_type, discharge_disposition, discharge_instructions, follow_up_date, special_requirements, isolation_required, isolation_type, fall_risk, allergy_alert, discharged_by, billed_invoice_id, billed_at, patients(first_name, last_name)';
const ALLOCATION_COLUMNS = 'id, admission_id, bed_id, ward_id, allocated_at, released_at, is_current';

export interface WardBoard {
  wards: Ward[];
  beds: Bed[];
  /** Stays not yet discharged */
  active: Admission[];
  /** The bed each active stay is in now */
  current: Allocation[];
}

/** The wards, their beds and who is in them now */
export async function loadWardBoard(practiceId: string): Promise<WardBoard> {
  const [wards, active, current] = await Promise.all([
    db.from('hospital_wards').select(WARD_COLUMNS).eq('practice_id', practiceId).order('ward_name'),
    db.from('patient_admissions').select(ADMISSION_COLUMNS).eq('practice_id', practiceId).eq('admission_status', 'active').order('admission_date'),
    db.from('bed_allocations').select(ALLOCATION_COLUMNS).eq('is_current', true)
  ]);
  for (const result of [wards, active, current]) {
    if (result.error) throw failure(result.error, 'Could not load the wards');
  }
  const wardRows = (wards.data ?? []) as Ward[];
  const beds = wardRows.length === 0
    ? { data: [], error: null }
    : await db.from('ward_beds').select(BED_COLUMNS).in('ward_id', wardRows.map(ward => ward.id)).order('bed_number');
  if (beds.error) throw failure(beds.error, 'Could not load the beds');
  return {
    wards: wardRows,
    beds: (beds.data ?? []) as Bed[],
    active: (active.data ?? []) as unknown as Admission[],
    current: (current.data ?? []) as Allocation[]
  };
}

/** Stays that ended, newest first */
export async function loadDischarged(practiceId: string, limit = 50): Promise<Admission[]> {
  const { data, error } = await db.from('patient_admissions').select(ADMISSION_COLUMNS).eq('practice_id', practiceId)
    .neq('admission_status', 'active').order('actual_discharge_date', { ascending: false }).limit(limit);
  if (error) throw failure(error, 'Could not load the discharged patients');
  return (data ?? []) as unknown as Admission[];
}

/** The patient's stay now, if any (the patient file and the visit screen show it) */
export async function loadActiveAdmission(patientId: string): Promise<Admission | null> {
  const { data, error } = await db.from('patient_admissions').select(ADMISSION_COLUMNS).eq('patient_id', patientId)
    .eq('admission_status', 'active').maybeSingle();
  if (error) {
    if (isInpatientMissing(error)) return null;
    throw failure(error, 'Could not check whether the patient is admitted');
  }
  return (data as unknown as Admission | null) ?? null;
}

export interface AdmissionDetail {
  admission: Admission;
  allocations: Allocation[];
  transfers: Transfer[];
  rounds: Round[];
  nursing: NursingRecord[];
  medications: Medication[];
  visitors: VisitorLog[];
}

/** Everything about one stay */
export async function loadAdmissionDetail(admissionId: string): Promise<AdmissionDetail> {
  const [admission, allocations, transfers, rounds, nursing, medications, visitors] = await Promise.all([
    db.from('patient_admissions').select(ADMISSION_COLUMNS).eq('id', admissionId).maybeSingle(),
    db.from('bed_allocations').select(ALLOCATION_COLUMNS).eq('admission_id', admissionId).order('allocated_at'),
    db.from('bed_transfer_history').select('id, from_bed_id, to_bed_id, from_ward_id, to_ward_id, transfer_datetime, transfer_reason, urgency, performed_by, notes')
      .eq('admission_id', admissionId).order('transfer_datetime', { ascending: false }),
    db.from('ward_rounds').select('id, doctor_id, round_datetime, round_type, patient_condition, consciousness_level, examination_findings, diagnosis_update, treatment_changes, new_orders, doctor_notes, discharge_planning_started, family_updated, next_review_date')
      .eq('admission_id', admissionId).order('round_datetime', { ascending: false }),
    db.from('nursing_care_records').select('id, nurse_id, shift_type, shift_start_time, shift_end_time, vital_signs_checked, vitals_ids, fluid_intake_ml, urine_output_ml, other_output_ml, patient_condition, pain_level, mobility_status, skin_condition, bathed, position_changed, nursing_notes, handover_notes')
      .eq('admission_id', admissionId).order('shift_start_time', { ascending: false }),
    db.from('inpatient_medications').select('id, medication_name, generic_name, dosage, dosage_unit, route, frequency, start_datetime, end_datetime, prescribed_by, scheduled_times, administration_records, indication, special_instructions, status, discontinuation_reason, discontinued_at')
      .eq('admission_id', admissionId).order('start_datetime'),
    db.from('visitor_logs').select('id, visitor_name, relationship, contact_number, check_in_time, check_out_time, purpose, notes')
      .eq('admission_id', admissionId).order('check_in_time', { ascending: false })
  ]);
  for (const result of [admission, allocations, transfers, rounds, nursing, medications, visitors]) {
    if (result.error) throw failure(result.error, 'Could not load the stay');
  }
  if (!admission.data) throw new Error('This stay was not found. It may belong to another practice.');
  return {
    admission: admission.data as unknown as Admission,
    allocations: (allocations.data ?? []) as Allocation[],
    transfers: (transfers.data ?? []) as Transfer[],
    rounds: (rounds.data ?? []) as Round[],
    nursing: (nursing.data ?? []) as NursingRecord[],
    medications: (medications.data ?? []) as Medication[],
    visitors: (visitors.data ?? []) as VisitorLog[]
  };
}

/** The vitals recorded on a visit, newest first (a nursing record links the ones taken in its shift) */
export async function loadVisitVitals(visitId: string): Promise<VitalsRow[]> {
  const { data, error } = await db.from('vitals').select('id, created_at, blood_pressure, temperature, pulse_rate, respiratory_rate, oxygen_saturation')
    .eq('visit_id', visitId).order('created_at', { ascending: false }).limit(20);
  if (error) throw failure(error, 'Could not load the vitals');
  return (data ?? []) as VitalsRow[];
}

export interface PatientChoice {
  id: string;
  first_name: string | null;
  last_name: string | null;
  id_number: string | null;
  date_of_birth: string | null;
}

/** Patients of the practice by name or ID number (for "Admit a patient") */
export async function searchPatients(practiceId: string, term: string): Promise<PatientChoice[]> {
  const words = term.replace(/[,()%*\\]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (words.length === 0) return [];
  let query = db.from('patients').select('id, first_name, last_name, id_number, date_of_birth').eq('practice_id', practiceId);
  for (const word of words) query = query.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%,id_number.ilike.%${word}%`);
  const { data, error } = await query.order('last_name').limit(20);
  if (error) throw failure(error, 'Could not search the patients');
  return (data ?? []) as PatientChoice[];
}

export async function loadPatientName(patientId: string): Promise<PatientChoice | null> {
  const { data, error } = await db.from('patients').select('id, first_name, last_name, id_number, date_of_birth').eq('id', patientId).maybeSingle();
  if (error) throw failure(error, 'Could not load the patient');
  return (data as PatientChoice | null) ?? null;
}

export interface VisitChoice {
  id: string;
  visit_date: string | null;
  scheduled_date: string | null;
  visit_type: string | null;
  status: string | null;
  chief_complaint: string | null;
}

/** The patient's latest visits (a stay is billed on one of them) */
export async function loadPatientVisits(patientId: string): Promise<VisitChoice[]> {
  const { data, error } = await db.from('visits').select('id, visit_date, scheduled_date, visit_type, status, chief_complaint')
    .eq('patient_id', patientId).neq('status', 'cancelled').order('visit_date', { ascending: false, nullsFirst: false }).limit(10);
  if (error) throw failure(error, 'Could not load the visits');
  return (data ?? []) as VisitChoice[];
}

// ---------------------------------------------------------------------------------------------
// Saves (each is one database function)
// ---------------------------------------------------------------------------------------------

export type Values = Record<string, unknown>;

export const saveWard = (id: string | null, ward: Values) =>
  call<string>('inpatient_save_ward', { p_id: id, p_ward: ward }, 'Could not save the ward');

export const saveBed = (id: string | null, wardId: string, bed: Values) =>
  call<string>('inpatient_save_bed', { p_id: id, p_ward_id: wardId, p_bed: bed }, 'Could not save the bed');

export const setBedStatus = (bedId: string, status: string) =>
  call<void>('inpatient_set_bed_status', { p_bed_id: bedId, p_status: status }, 'Could not change the bed');

export const admitPatient = (patientId: string, bedId: string, admission: Values) =>
  call<string>('inpatient_admit', { p_patient_id: patientId, p_bed_id: bedId, p_admission: admission }, 'Could not admit the patient');

export const updateAdmission = (admissionId: string, admission: Values) =>
  call<void>('inpatient_update_admission', { p_admission_id: admissionId, p_admission: admission }, 'Could not save the stay');

export const transferPatient = (admissionId: string, toBedId: string, reasonCode: string, reason: string, urgency: string) =>
  call<void>('inpatient_transfer', { p_admission_id: admissionId, p_to_bed_id: toBedId, p_reason_code: reasonCode, p_reason: reason, p_urgency: urgency },
    'Could not move the patient');

export const dischargePatient = (admissionId: string, discharge: Values) =>
  call<void>('inpatient_discharge', { p_admission_id: admissionId, p_discharge: discharge }, 'Could not discharge the patient');

export const saveRound = (admissionId: string, round: Values) =>
  call<string>('inpatient_save_round', { p_admission_id: admissionId, p_round: round }, 'Could not save the round');

export const saveNursingRecord = (id: string | null, admissionId: string, record: Values) =>
  call<string>('inpatient_save_nursing_record', { p_id: id, p_admission_id: admissionId, p_record: record }, 'Could not save the nursing record');

export const prescribe = (admissionId: string, medication: Values) =>
  call<string>('inpatient_prescribe', { p_admission_id: admissionId, p_medication: medication }, 'Could not add the medicine');

export const recordDose = (medicationId: string, dueAt: string, outcome: DoseOutcome, note: string | null) =>
  call<void>('inpatient_record_dose', { p_medication_id: medicationId, p_due_at: dueAt, p_outcome: outcome, p_note: note }, 'Could not record the dose');

export const stopMedication = (medicationId: string, reason: string) =>
  call<void>('inpatient_discontinue_medication', { p_medication_id: medicationId, p_reason: reason }, 'Could not stop the medicine');

export const checkInVisitor = (admissionId: string, visitor: Values) =>
  call<string>('inpatient_visitor_check_in', { p_admission_id: admissionId, p_visitor: visitor }, 'Could not sign the visitor in');

export const checkOutVisitor = (visitorLogId: string) =>
  call<void>('inpatient_visitor_check_out', { p_visitor_log_id: visitorLogId }, 'Could not sign the visitor out');

export const markStayBilled = (admissionId: string, invoiceId: string) =>
  call<void>('inpatient_mark_billed', { p_admission_id: admissionId, p_invoice_id: invoiceId }, 'Could not link the invoice to the stay');
