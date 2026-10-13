import { resetColumnCheck, useColumnsAvailable } from './columnAvailability';

/**
 * patients.town and patients.region (proposals/2026-10-13-patient-town.sql). The registration and edit forms show and
 * save the town picker only once both columns exist.
 */
const TABLE = 'patients';
export const PATIENT_TOWN_COLUMNS = 'town, region';

/** True once the columns are known to exist; false before (and while checking). */
export function usePatientTownColumns(): boolean {
  return useColumnsAvailable(TABLE, PATIENT_TOWN_COLUMNS);
}

/** For tests: forget the answer. */
export function resetPatientTownColumnsCache(): void {
  resetColumnCheck(TABLE, PATIENT_TOWN_COLUMNS);
}
