/**
 * The reason to show staff when a save or load fails.
 *
 * Supabase hands back errors as plain objects ({ message, details, code }), not Error instances, so
 * the usual `error instanceof Error ? error.message : 'Unknown error'` hid the real reason
 * (a missing column, a permission problem) behind "Unknown error" or "[object Object]".
 */
export function errorMessage(error: unknown, fallback = 'Please try again.'): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
