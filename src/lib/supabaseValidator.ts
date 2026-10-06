// Local stub for the unfinished supabaseValidator module.
// Original was never committed; only validatePracticeId is consumed today.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validatePracticeId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id);
}
