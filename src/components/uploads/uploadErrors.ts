/**
 * What staff read when an upload to a patient's record fails. The storage's and the database's own wording ("Database
 * insert failed: ...", "schema mismatch", a policy name) stays in the console; the screen says what happened and what
 * to do, in plain words.
 */

interface DbError {
  code?: string | null;
}

/** The file could not be put in the records storage. */
export const STORAGE_UPLOAD_FAILED = 'The file could not be uploaded. Check the connection and try again.';

/** A column or table this upload needs is not there yet (PGRST204 / 42703 / 42P01 / PGRST205). */
export const RECORD_NOT_SET_UP = 'Files of this kind cannot be kept on the record yet: OneHealth support needs to switch this on.';

/** The file was uploaded but its entry on the record could not be saved (it is removed again). */
export const RECORD_SAVE_FAILED = 'The file could not be saved to the record. Please try again.';

/** The message for a failed record entry after an upload. */
export function recordSaveError(error: DbError | null | undefined): string {
  const code = error?.code ?? '';
  return ['PGRST204', '42703', '42P01', 'PGRST205'].includes(code) ? RECORD_NOT_SET_UP : RECORD_SAVE_FAILED;
}
