import { resetColumnCheck, useColumnsAvailable } from './columnAvailability';

/**
 * patients.title and patients.initials (proposals/2026-10-08-patient-title-initials.sql). The registration and edit
 * forms show and save them only once both columns exist.
 */
const TABLE = 'patients';
export const PATIENT_TITLE_COLUMNS = 'title, initials';

/** True once the columns are known to exist; false before (and while checking). */
export function usePatientTitleColumns(): boolean {
  return useColumnsAvailable(TABLE, PATIENT_TITLE_COLUMNS);
}

/** For tests: forget the answer. */
export function resetPatientTitleColumnsCache(): void {
  resetColumnCheck(TABLE, PATIENT_TITLE_COLUMNS);
}
