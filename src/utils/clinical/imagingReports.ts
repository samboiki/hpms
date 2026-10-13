/**
 * Radiology reports on imaging requests (parity C12): the radiologist's report kept on the request
 * (imaging_requests.report_text, radiologist_name, reported_on, and who entered it: reported_at, reported_by), shown on
 * the visit and the patient file, and the request's label for the film packet or envelope, printed through the
 * practice's label printer (src/components/labels). The database checks the same rules
 * (proposals/2026-10-13-imaging-reports.sql, save_imaging_report). PACS is not part of this.
 */
import { formatDiaryDate, formatDiaryTimestamp } from '../diary/diaryTime';
import { patientMergeValues, type PatientMergeSource } from '../templates/mergeFields';

/** imaging_requests_imaging_type_check, in words. (ImagingRequestSimple.tsx and ImagingTabContentSimple.tsx keep their own copies.) */
export const IMAGING_TYPE_LABELS: Readonly<Record<string, string>> = {
  x_ray: 'X-Ray',
  ct_scan: 'CT Scan',
  mri: 'MRI',
  ultrasound: 'Ultrasound',
  mammography: 'Mammography',
  nuclear_medicine: 'Nuclear Medicine',
  dental_x_ray: 'Dental X-Ray',
  panoramic_x_ray: 'Panoramic X-Ray',
  cbct: 'CBCT',
  other: 'Other imaging'
};

export const imagingTypeLabel = (type: string | null | undefined): string => (type && IMAGING_TYPE_LABELS[type]) || 'Imaging';

/** Same limits as save_imaging_report */
export const IMAGING_REPORT_MAX = 20000;
export const RADIOLOGIST_NAME_MAX = 120;

/** Who may write a report: practitioners, nurses and practice administrators (save_imaging_report says the same) */
export const IMAGING_REPORT_ROLES: readonly string[] = ['doctor', 'nurse', 'admin'];
export const canWriteImagingReport = (role: string | null | undefined): boolean => !!role && IMAGING_REPORT_ROLES.includes(role);

export interface ImagingReport {
  text: string | null;
  radiologist: string | null;
  /** The date on the radiologist's report ('yyyy-MM-dd') */
  reportedOn: string | null;
  /** When it was entered or last changed (ISO) */
  reportedAt: string | null;
}

/** The report's columns on imaging_requests (reported_on and reported_at are missing before the update) */
export interface ImagingReportColumns {
  report_text?: string | null;
  radiologist_name?: string | null;
  reported_on?: string | null;
  reported_at?: string | null;
  completed_date?: string | null;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The report on an imaging_requests row (null when it has none) */
export function imagingReportFromRow(row: ImagingReportColumns): ImagingReport | null {
  const report = text(row.report_text);
  if (!report) return null;
  return {
    text: report,
    radiologist: text(row.radiologist_name),
    reportedOn: text(row.reported_on)?.slice(0, 10) ?? text(row.completed_date)?.slice(0, 10) ?? null,
    reportedAt: text(row.reported_at)
  };
}

/** "Report of 12 Oct 2026 by Dr A Example, entered 13 Oct 2026, 09:12" */
export function describeImagingReport(report: ImagingReport): string {
  const parts = [`Report${report.reportedOn ? ` of ${formatDiaryDate(report.reportedOn)}` : ''}${report.radiologist ? ` by ${report.radiologist}` : ''}`];
  const entered = formatDiaryTimestamp(report.reportedAt);
  if (entered) parts.push(`entered ${entered}`);
  return parts.join(', ');
}

export interface ImagingReportDraft {
  report: string;
  radiologist: string;
  /** 'yyyy-MM-dd' */
  reportedOn: string;
}

/** What stops the report from being saved, in plain words (the database checks the same) */
export function checkImagingReport(draft: ImagingReportDraft, request: { requestDate: string | null; status: string | null }, today: string): string[] {
  const problems: string[] = [];
  if (request.status === 'cancelled') problems.push('This request was cancelled.');
  const report = draft.report.trim();
  if (!report) problems.push('Write the report.');
  else if (report.length > IMAGING_REPORT_MAX) problems.push(`Keep the report to ${IMAGING_REPORT_MAX.toLocaleString('en-ZA')} characters.`);
  if (draft.radiologist.replace(/\s+/g, ' ').trim().length > RADIOLOGIST_NAME_MAX) problems.push(`Keep the radiologist's name to ${RADIOLOGIST_NAME_MAX} characters.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.reportedOn)) problems.push('Choose the date on the report.');
  else if (draft.reportedOn > today) problems.push('The report date cannot be in the future.');
  else if (request.requestDate && draft.reportedOn < request.requestDate.slice(0, 10)) problems.push('The report cannot be dated before the request.');
  return problems;
}

/** "IR-1A2B3C4D": a short reference for a request, the same on its label and on the screen */
export const imagingRequestReference = (id: string): string => `IR-${id.replace(/[^0-9a-f]/gi, '').slice(0, 8).toUpperCase()}`;

/**
 * The lines of a request's label (a film packet or an envelope): the patient (formal name; their ID number, else their
 * date of birth, never a temporary one), the examination, the day it was requested, the reference and the practice.
 */
export function imagingLabelLines(input: {
  patient: PatientMergeSource;
  todayKey: string;
  imagingType: string | null;
  bodyPart: string | null;
  requestDate: string | null;
  requestId: string;
  practiceName: string | null;
}): string[] {
  const values = patientMergeValues(input.patient, input.todayKey);
  const name = values.patientFormalName ?? values.patientName ?? 'Patient';
  const identity = values.patientIdNumber ? `ID ${values.patientIdNumber}` : values.patientDateOfBirth ? `Born ${values.patientDateOfBirth}` : null;
  const bodyPart = text(input.bodyPart);
  const exam = `${imagingTypeLabel(input.imagingType)}${bodyPart && bodyPart !== 'Not specified' ? `: ${bodyPart}` : ''}`;
  return [
    name,
    ...(identity ? [identity] : []),
    exam,
    `${input.requestDate ? `Requested ${formatDiaryDate(input.requestDate.slice(0, 10))}` : 'Requested'}, ${imagingRequestReference(input.requestId)}`,
    ...(text(input.practiceName) ? [text(input.practiceName) as string] : [])
  ];
}
