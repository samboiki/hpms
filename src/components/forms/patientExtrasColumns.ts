import { hasColumns, resetColumnCheck, useColumnsAvailable } from './columnAvailability';

/**
 * patients.photo_path, and patients.referral_source with referral_source_other
 * (proposals/2026-10-13-patient-photo-and-referral-source.sql). Until they exist the photo controls and the
 * "How did you hear about us?" question are not shown, and nothing is saved to them.
 */
const TABLE = 'patients';
export const PATIENT_PHOTO_COLUMN = 'photo_path';
export const REFERRAL_SOURCE_COLUMNS = 'referral_source, referral_source_other';

export const usePatientPhotoColumn = (): boolean => useColumnsAvailable(TABLE, PATIENT_PHOTO_COLUMN);
export const hasPatientPhotoColumn = (): Promise<boolean> => hasColumns(TABLE, PATIENT_PHOTO_COLUMN);

export const useReferralSourceColumns = (): boolean => useColumnsAvailable(TABLE, REFERRAL_SOURCE_COLUMNS);
export const hasReferralSourceColumns = (): Promise<boolean> => hasColumns(TABLE, REFERRAL_SOURCE_COLUMNS);

/** For tests: forget the answers. */
export function resetPatientExtrasColumnsCache(): void {
  resetColumnCheck(TABLE, PATIENT_PHOTO_COLUMN);
  resetColumnCheck(TABLE, REFERRAL_SOURCE_COLUMNS);
}
