/**
 * The numbers a patient file is known by, besides the ID number:
 * - the OneHealth reference (patients.system_patient_reference_number): given by OneHealth to every file, shown on the
 *   file and in the Patients list, and written as 7 digits on claims (0001234, src/utils/billing/claimLine.ts);
 * - the old file number (patients.legacy_account_number): the paper file's number or the account number in the
 *   practice's previous system, brought over by the Eminance import or typed by staff for a patient not imported.
 * Both are searchable on the Patients page (src/utils/patientSearch.ts).
 */

/** Longest old file number accepted: Eminance account numbers have 7 digits, paper files a few letters and digits */
export const OLD_FILE_NUMBER_MAX_LENGTH = 30;

/** Window event (detail: the patient id) the edit form sends after saving a new old file number, so the open patient
 * file header shows it at once */
export const PATIENT_FILE_NUMBERS_CHANGED = 'patient-file-numbers-changed';

/** "1234" for the reference 1234; null when the file has none yet, so "Ref 0" or "Ref undefined" never shows */
export function patientReferenceLabel(reference: number | string | null | undefined): string | null {
  const text = reference === null || reference === undefined ? '' : String(reference).trim();
  return /^\d+$/.test(text) && Number(text) > 0 ? String(Number(text)) : null;
}

/** The old file number as saved: spaces at the ends dropped and inner runs of spaces made one; '' when blank */
export function normalizeOldFileNumber(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

/** Why the old file number cannot be saved, or null (blank is fine: most patients have none) */
export function oldFileNumberProblem(raw: string | null | undefined): string | null {
  const value = normalizeOldFileNumber(raw);
  if (!value) return null;
  if (value.length > OLD_FILE_NUMBER_MAX_LENGTH) return `An old file number has at most ${OLD_FILE_NUMBER_MAX_LENGTH} characters.`;
  if (!/^[A-Za-z0-9][A-Za-z0-9 ./-]*$/.test(value)) return 'Use letters, digits, spaces and . / - only, as on the old file.';
  return null;
}
