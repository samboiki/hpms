/**
 * Database errors the diary treats as "not set up yet" instead of failures, so the diary keeps working
 * before proposals/2026-10-07-diary.sql is applied. (patientListService.ts and smsRepliesService.ts each
 * have their own copy of this check for their tables.)
 */
interface DbError {
  code?: string | null;
  message?: string | null;
}

const errorParts = (error: unknown): DbError =>
  error && typeof error === 'object' ? (error as DbError) : {};

/**
 * The table is not in the database (Postgres 42P01) or not in PostgREST's schema cache (PGRST205).
 * Only for the named table: another missing relation is a real error and must be shown as one.
 */
export function isMissingTableError(error: unknown, table: string): boolean {
  const { code, message } = errorParts(error);
  const text = (message ?? '').toLowerCase();
  const namesTable = text.includes(table.toLowerCase());
  if (code === '42P01' || code === 'PGRST205') return namesTable || text === '';
  return namesTable && (text.includes('does not exist') || text.includes('could not find the table'));
}

/** A selected column does not exist (42703), or PostgREST does not know it (PGRST204). */
export function isMissingColumnError(error: unknown): boolean {
  const { code } = errorParts(error);
  return code === '42703' || code === 'PGRST204';
}

/** The named database function is not there yet: Postgres 42883, or PostgREST PGRST202 (not in its schema cache). */
export function isMissingFunctionError(error: unknown, name: string): boolean {
  const { code, message } = errorParts(error);
  const text = (message ?? '').toLowerCase();
  return (code === '42883' || code === 'PGRST202') && (text === '' || text.includes(name.toLowerCase()));
}

/** The database refused the user (Postgres 42501, raised by the diary functions with a plain message). */
export function isPermissionError(error: unknown): boolean {
  return errorParts(error).code === '42501';
}
