/**
 * Radiology reports on imaging requests (parity C12; proposals/2026-10-13-imaging-reports.sql): add or change one
 * through save_imaging_report (practitioners, nurses and practice administrators; the database checks the rest), read a
 * patient's requests with their reports for the patient file, and what a request's label needs. The rules are in
 * src/utils/clinical/imagingReports.ts. Before the SQL is applied only report_text and radiologist_name exist: reads
 * fall back to those, and saving says adding a report is not set up yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingColumnError, isMissingFunctionError, isPermissionError } from '../utils/diary/dbErrors';
import type { ImagingReportDraft } from '../utils/clinical/imagingReports';
import type { PatientMergeSource } from '../utils/templates/mergeFields';

// The report columns are not in the generated database types yet: rows are read untyped and checked
const db = supabase as unknown as SupabaseClient;

export const IMAGING_REPORT_NOT_SET_UP_MESSAGE =
  'Adding a report is not set up yet. Your administrator needs to apply the imaging update first.';

/** The report columns of imaging_requests, and the two there before the update */
export const IMAGING_REPORT_COLUMNS = 'report_text, radiologist_name, reported_on, reported_at';
const REPORT_COLUMNS_BEFORE_UPDATE = 'report_text, radiologist_name';

export interface ReadResult<Row> {
  data: Row[] | null;
  error: unknown;
}

/**
 * Reads imaging requests with their reports: `read` puts the report columns it is given at the end of its select. When
 * the update is not applied yet it reads again with the columns there were before.
 */
export async function readWithReportColumns<Row>(read: (reportColumns: string) => PromiseLike<{ data: unknown; error: unknown }>): Promise<ReadResult<Row>> {
  let result = await read(IMAGING_REPORT_COLUMNS);
  if (result.error && isMissingColumnError(result.error)) result = await read(REPORT_COLUMNS_BEFORE_UPDATE);
  return { data: Array.isArray(result.data) ? (result.data as Row[]) : null, error: result.error ?? null };
}

export type ImagingReportWrite = { ok: true } | { ok: false; message: string; notSetUp?: boolean };

// The function's own refusals, worded for staff (who may not, a cancelled or unknown request, a check failed)
const PLAIN_REFUSALS = new Set(['22023', 'P0002']);

/** Adds or changes the report on a request; the request becomes completed */
export async function saveImagingReport(requestId: string, draft: ImagingReportDraft): Promise<ImagingReportWrite> {
  const { error } = await db.rpc('save_imaging_report', {
    p_request_id: requestId,
    p_report: draft.report.trim(),
    p_radiologist: draft.radiologist.replace(/\s+/g, ' ').trim() || null,
    p_reported_on: draft.reportedOn
  });
  if (!error) return { ok: true };
  if (isMissingFunctionError(error, 'save_imaging_report')) return { ok: false, notSetUp: true, message: IMAGING_REPORT_NOT_SET_UP_MESSAGE };
  if (isPermissionError(error) || PLAIN_REFUSALS.has(error.code ?? '')) return { ok: false, message: `${error.message || 'Not saved'}.` };
  console.error('Could not save the imaging report:', error);
  return { ok: false, message: 'The report could not be saved. Please try again.' };
}

/** A patient's imaging request, with its report and the visit it belongs to (the patient file's Imaging tab) */
export interface PatientImagingRequest {
  id: string;
  visit_id: string | null;
  imaging_type: string;
  body_part: string | null;
  request_date: string | null;
  status: string | null;
  facility_name: string | null;
  completed_date: string | null;
  report_text?: string | null;
  radiologist_name?: string | null;
  reported_on?: string | null;
  reported_at?: string | null;
  visit?: { visit_date: string | null; visit_number: number | null } | null;
}

export type PatientImagingLoad = { state: 'ready'; requests: PatientImagingRequest[] } | { state: 'error'; message: string };

const REQUEST_COLUMNS = 'id, visit_id, imaging_type, body_part, request_date, status, facility_name, completed_date';

/** The patient's imaging requests, newest first, with their reports. Never throws: the patient file opens without them */
export const loadPatientImagingRequests = (patientId: string): Promise<PatientImagingLoad> =>
  readPatientImagingRequests(patientId).catch((error: unknown): PatientImagingLoad => {
    console.error("Could not load the patient's imaging requests:", error);
    return { state: 'error', message: 'Could not load the imaging requests. Please try again.' };
  });

async function readPatientImagingRequests(patientId: string): Promise<PatientImagingLoad> {
  const { data, error } = await readWithReportColumns<PatientImagingRequest>((reportColumns) =>
    db
      .from('imaging_requests')
      .select(`${REQUEST_COLUMNS}, visit:visits!imaging_requests_visit_id_fkey(visit_date, visit_number), ${reportColumns}`)
      .eq('patient_id', patientId)
      .order('request_date', { ascending: false })
      .order('created_at', { ascending: false })
  );
  if (error) {
    console.error("Could not load the patient's imaging requests:", error);
    return { state: 'error', message: 'Could not load the imaging requests. Please try again.' };
  }
  return { state: 'ready', requests: data ?? [] };
}

export interface ImagingLabelSource {
  patient: PatientMergeSource;
  practiceName: string | null;
}

/** What a request's label prints about the patient and the practice (null when it cannot be read; never throws) */
export const loadImagingLabelSource = (patientId: string): Promise<ImagingLabelSource | null> =>
  readImagingLabelSource(patientId).catch((error: unknown) => {
    console.error('Could not load the patient for the label:', error);
    return null;
  });

async function readImagingLabelSource(patientId: string): Promise<ImagingLabelSource | null> {
  const { data: patient, error } = await db
    .from('patients')
    .select('title, initials, first_name, last_name, id_number, date_of_birth, practice_id')
    .eq('id', patientId)
    .maybeSingle();
  if (error || !patient) {
    if (error) console.error('Could not load the patient for the label:', error);
    return null;
  }
  const row = patient as Record<string, string | null>;
  let practiceName: string | null = null;
  if (row.practice_id) {
    const { data: practice, error: practiceError } = await db.from('practices').select('name').eq('id', row.practice_id).maybeSingle();
    if (practiceError) console.error('Could not load the practice name for the label:', practiceError);
    practiceName = (practice as { name?: string | null } | null)?.name ?? null;
  }
  return {
    patient: {
      title: row.title,
      initials: row.initials,
      firstName: row.first_name,
      lastName: row.last_name,
      idNumber: row.id_number,
      dateOfBirth: row.date_of_birth
    },
    practiceName
  };
}
