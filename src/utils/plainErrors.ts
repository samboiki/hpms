/**
 * Plain words for every error staff see (owner decision 13 Oct 2026: "plain words everywhere").
 *
 * Supabase hands back the database's own wording ('new row violates row-level security policy for table "x"',
 * 'column "y" does not exist', 'Failed to fetch'). Staff cannot act on that, so it never reaches the screen: it goes
 * to the browser console for support, and the screen says what happened and what to do. This replaces the old rule
 * in src/components/forms/formErrors.ts that showed the database's words on purpose.
 *
 * Two kinds of message still pass through unchanged, because they were written for staff:
 * - errors the app throws itself (`throw new Error('Enter the date of the expense.')`), and
 * - refusals our own database functions raise in words (RAISE EXCEPTION, code P0001, or the practice's protected
 *   columns), unless they read like technical text.
 */

interface ErrorParts {
  message: string;
  code: string;
  hint: string;
  status: number | null;
  name: string;
  isAppError: boolean;
}

function partsOf(error: unknown): ErrorParts | null {
  if (typeof error === 'string') {
    const message = error.trim();
    return message ? { message, code: '', hint: '', status: null, name: '', isAppError: true } : null;
  }
  if (typeof error !== 'object' || error === null) return null;
  const record = error as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const message = text(record.message);
  const code = text(record.code);
  const status = typeof record.status === 'number' ? record.status : null;
  if (!message && !code && status === null) return null;
  return {
    message,
    code,
    hint: text(record.hint),
    status,
    name: text(record.name),
    // Supabase errors carry a code, details or hint; an Error without them is one the app threw on purpose
    isAppError: (error instanceof Error && record.name !== 'PostgrestError' && !code && !('details' in record) && !('hint' in record) && status === null)
      // Sign-in errors are worded for people ("Invalid login credentials")
      || /^Auth/.test(text(record.name))
  };
}

/** Database, network and programming wording staff should never read */
const TECHNICAL = new RegExp(
  [
    'relation "', 'column "', 'violates', 'constraint', 'syntax error', 'PGRST', 'JWT', 'jwt', 'duplicate key',
    'null value', 'invalid input', 'does not exist', 'schema cache', 'permission denied', 'row-level security',
    'non-2xx', 'Failed to fetch', 'NetworkError', 'Load failed', 'TypeError', 'Cannot read', 'is not a function',
    'undefined', 'SQLSTATE', 'Edge Function', 'FetchError', 'timeout', 'canceling statement', 'could not find',
    'PostgREST', 'supabase', 'RPC', 'uuid', 'cache lookup', 'plpgsql', 'internal error', '\\bat line\\b', '\\{', '\\}'
  ].join('|'),
  'i'
);

export function looksTechnical(message: string): boolean {
  return TECHNICAL.test(message);
}

/**
 * Why it failed, as a plain clause to put after "Couldn't save the vitals: " (lower case, ends with a full stop), or
 * a full sentence the app or our database functions wrote for staff. Null when there is nothing useful to say.
 */
export function plainErrorReason(error: unknown): string | null {
  const parts = partsOf(error);
  if (!parts) return null;
  const { message, code, hint, status } = parts;

  // Written for staff: the app's own errors and our database functions' refusals in words
  if ((parts.isAppError || code === 'P0001' || hint === 'practice_protected_columns') && message && !looksTechnical(message)) {
    return message;
  }
  // The app's own wrapper around a database error ("Could not load the remittances: relation ... does not exist"):
  // keep its plain lead-in, replace the database's part
  if (parts.isAppError && message && /^[^:;]{3,}[:;]s/.test(message) && !looksTechnical(message.split(/[:;]s/)[0])) {
    return plainWords(message);
  }
  return reasonFor(code, status, message);
}

function reasonFor(code: string, status: number | null, message: string): string | null {
  if (/Failed to fetch|NetworkError|Load failed|network request failed/i.test(message)) {
    return 'there is no connection to OneHealth. Check the internet connection and try again.';
  }
  if (code === 'PGRST301' || status === 401 || /JWT expired|invalid JWT|not authenticated/i.test(message)) {
    return 'your sign-in has expired. Please sign in again.';
  }
  if (['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)
    || /does not exist|schema cache|could not find the (table|function)/i.test(message)) {
    return 'this part of OneHealth is not set up yet. Please contact support.';
  }
  if (code === '42501' || status === 403 || /row-level security|permission denied/i.test(message)) {
    return 'your account is not permitted to make this change.';
  }
  if (code === '23505' || /duplicate key|already exists/i.test(message)) {
    return 'a record with these details already exists.';
  }
  if (code === '23503' || /foreign key/i.test(message)) {
    return /still referenced|update or delete/i.test(message)
      ? 'other records still use it, so it cannot be removed.'
      : 'a record it refers to no longer exists. Reload the page and try again.';
  }
  if (code === '23502' || /null value/i.test(message)) return 'a required detail is missing.';
  if (code === '23514' || /check constraint/i.test(message)) return 'one of the values is not allowed.';
  if (['22P02', '22007', '22008', '22003', '22001'].includes(code) || /invalid input|out of range|too long/i.test(message)) {
    return 'one of the values is not in the right format.';
  }
  if (code === 'PGRST116') return 'the record was not found. It may have been removed; reload the page.';
  if (code === '57014' || /timeout|canceling statement/i.test(message)) return 'it took too long. Please try again.';
  if (code === '40001' || code === '40P01') return 'someone else was saving at the same moment. Please try again.';
  if (status !== null && status >= 500) return 'OneHealth could not finish this just now. Please try again.';
  return null;
}

/**
 * The whole message for a toast or banner: "Failed to save expense: your account is not permitted to make this
 * change." The technical text goes to the console for support. `fallback` alone when there is no plain reason.
 */
export function plainErrorMessage(error: unknown, fallback: string): string {
  const reason = plainErrorReason(error);
  const parts = partsOf(error);
  if (parts && (!reason || reason !== parts.message)) {
    // Kept for support; never shown to staff
    console.warn(`[OneHealth] ${fallback}:`, error);
  }
  if (!reason) return fallback;
  if (parts && reason === parts.message) return reason;
  return `${fallback.replace(/[.:\s]+$/, '')}: ${reason}`;
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const withStop = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

/**
 * Plain words for a message that may carry the database's wording inside it, as the app's services often build them:
 * "Could not load the remittances: relation "x" does not exist" becomes "Could not load the remittances: this part of
 * OneHealth is not set up yet. Please contact support." and "Earlier answers could not be read (permission denied for
 * table x), so the checks were skipped." keeps everything but the bracket. Plain text comes back unchanged.
 * Used for every toast (src/utils/plainToast.ts) and wherever a screen shows an error's message.
 */
export function plainWords(text: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof text !== 'string' || !text.trim()) return fallback;
  let rest = text.trim();
  if (!looksTechnical(rest)) return rest;
  // Messages are often put inside a longer sentence ("Could not load the list: <message>."): end as the original did
  const endsWithStop = /[.!?]$/.test(rest);
  const finish = (plain: string) => (endsWithStop ? withStop(plain) : plain.replace(/\.$/, ''));

  // A technical aside in brackets is dropped; the sentence around it stays
  rest = rest.replace(/\s*\(([^()]*)\)/g, (whole, inner: string) => (looksTechnical(inner) ? '' : whole)).trim();
  if (!looksTechnical(rest)) return finish(rest);

  // Clauses split at ": ", "; " and ". ". The first technical clause becomes the plain reason; what a colon adds to it
  // is more of the same detail and goes too; later plain clauses stay
  const pieces = rest.split(/(:\s+|;\s+|\.\s+)/);
  const out: string[] = [];
  let replaced = false;
  let inTechnical = false;
  for (let i = 0; i < pieces.length; i += 2) {
    const clause = pieces[i];
    const separator = i > 0 ? pieces[i - 1] : '';
    if (inTechnical && separator.startsWith(':')) continue;
    inTechnical = false;
    if (!looksTechnical(clause)) {
      if (clause) out.push(separator, clause);
      continue;
    }
    inTechnical = true;
    if (replaced) continue;
    replaced = true;
    const reason = (reasonFor('', null, rest) ?? 'please try again.').replace(/\.$/, '');
    out.push(separator, out.length === 0 ? capitalise(reason) : reason);
  }
  const result = out.join('').replace(/^(:\s+|;\s+|\.\s+)/, '').trim();
  return result ? finish(capitalise(result)) : fallback;
}

/**
 * For screens that showed `error instanceof Error ? error.message : fallback`: the same choice, in plain words.
 * The technical text goes to the console.
 */
export function plainErrorText(error: unknown, fallback: string): string {
  const reason = plainErrorReason(error);
  if (error) {
    const parts = partsOf(error);
    if (!parts || reason !== parts.message) console.warn(`[OneHealth] ${fallback}:`, error);
  }
  if (!reason) return fallback;
  return /^[a-z]/.test(reason) ? capitalise(reason) : reason;
}
