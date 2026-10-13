import { plainErrorReason } from '../../utils/plainErrors';

/**
 * The reason to show staff when a save or load fails, put after "Couldn't save the vitals: ".
 *
 * Owner decision 13 Oct 2026: plain words everywhere. This used to show the database's own wording on purpose
 * (a missing column, a permission problem) so it was not hidden behind "Unknown error"; now the plain-words rule in
 * src/utils/plainErrors.ts says what happened in words staff can act on, and the technical text goes to the console.
 * Supabase errors are plain objects ({ message, details, code }), not Error instances, so both shapes are read.
 */
export function errorMessage(error: unknown, fallback = 'Please try again.'): string {
  const reason = plainErrorReason(error);
  if (!reason && error) console.warn('[OneHealth] form error:', error);
  return reason ?? fallback;
}
