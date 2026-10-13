/**
 * A temporary patient file: opened with a name and cell number only, so reception can book a caller (or the practice
 * website can take a booking request) before the patient is registered in full. patients.id_number, date_of_birth and
 * gender must be filled in, so such a file holds placeholders until reception completes it when the patient arrives:
 *   id_number      "TEMP-<milliseconds>-<9 random characters>": the marker (unique, and never a real ID number)
 *   date_of_birth  1990-01-01
 *   gender         other
 * The website booking function writes the same values (supabase/functions/submit-booking/index.ts, a Deno copy that
 * cannot import this file): change both together.
 * Claims refuse a temporary file (src/utils/billing/claimValidation.ts), and the placeholders are never shown as the
 * patient's age, birthday or gender (patientFileStatus).
 */

export const TEMPORARY_ID_PREFIX = 'TEMP-';
export const TEMPORARY_BIRTH_DATE = '1990-01-01';
export const TEMPORARY_GENDER = 'other';

/** True for the placeholder ID number of a file opened with a name and cell number only. */
export function isTemporaryIdNumber(idNumber: string | null | undefined): boolean {
  return String(idNumber ?? '').trim().toUpperCase().startsWith(TEMPORARY_ID_PREFIX);
}

/** A new placeholder ID number, in the website booking function's format. */
export function newTemporaryIdNumber(now: number = Date.now(), random: () => number = Math.random): string {
  return `${TEMPORARY_ID_PREFIX}${now}-${random().toString(36).slice(2, 11)}`;
}

export interface CallerDetails {
  firstName: string;
  lastName: string;
  cellNumber: string;
}

const tidy = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** The patients row for a caller booked with a name and cell number only. */
export function temporaryPatientRow(caller: CallerDetails, practiceId: string, idNumber: string = newTemporaryIdNumber()) {
  return {
    first_name: tidy(caller.firstName),
    last_name: tidy(caller.lastName),
    cell_number: caller.cellNumber.trim(),
    id_number: idNumber,
    date_of_birth: TEMPORARY_BIRTH_DATE,
    gender: TEMPORARY_GENDER,
    practice_id: practiceId
  };
}

export type MissingDetail = 'ID number' | 'date of birth' | 'gender';

export interface PatientFileStatus {
  /** Opened with a name and cell number only, and not completed yet */
  incomplete: boolean;
  /** What reception still has to add, in the order the form asks for it */
  missing: MissingDetail[];
  /** The date of birth to show and count the age from: null while it is the placeholder */
  dateOfBirth: string | null;
  /** The gender to show: null while it is the placeholder */
  gender: string | null;
}

export interface PatientFileFields {
  id_number?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
}

/**
 * Whether a file still has to be completed, and its real date of birth and gender. A temporary file whose date of
 * birth or gender reception already corrected keeps them; only the untouched placeholders are hidden.
 */
export function patientFileStatus(patient: PatientFileFields | null | undefined): PatientFileStatus {
  const incomplete = isTemporaryIdNumber(patient?.id_number);
  const dateOfBirth = patient?.date_of_birth ?? null;
  const gender = patient?.gender ?? null;
  const placeholderBirthDate = incomplete && (dateOfBirth ?? '').slice(0, 10) === TEMPORARY_BIRTH_DATE;
  const placeholderGender = incomplete && gender === TEMPORARY_GENDER;
  const missing: MissingDetail[] = [];
  if (incomplete) missing.push('ID number');
  if (placeholderBirthDate) missing.push('date of birth');
  if (placeholderGender) missing.push('gender');
  return {
    incomplete,
    missing,
    dateOfBirth: placeholderBirthDate ? null : dateOfBirth,
    gender: placeholderGender ? null : gender
  };
}

/** "ID number, date of birth and gender" */
export function describeMissing(missing: readonly MissingDetail[]): string {
  if (missing.length <= 1) return missing[0] ?? '';
  return `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
}
