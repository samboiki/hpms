import { hasColumns, resetColumnCheck, useColumnsAvailable } from '../columnAvailability';

/**
 * Whether medical_aid_details.dependant_code exists (proposals/2026-10-07-dependant-code.sql). The forms show the
 * dependant code input and save it only when it does, so a save never fails before the SQL is applied. The check
 * itself is shared with other optional columns (../columnAvailability.ts).
 */
const TABLE = 'medical_aid_details';
const COLUMN = 'dependant_code';

export function hasDependantCodeColumn(): Promise<boolean> {
  return hasColumns(TABLE, COLUMN);
}

/** For tests: forget the answer. */
export function resetDependantCodeColumnCache(): void {
  resetColumnCheck(TABLE, COLUMN);
}

/** True once the column is known to exist; false before (and while checking). */
export function useDependantCodeColumn(): boolean {
  return useColumnsAvailable(TABLE, COLUMN);
}
