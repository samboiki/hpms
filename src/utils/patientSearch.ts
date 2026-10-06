/**
 * True when every word of the query appears in at least one of the patient's searchable fields.
 * Matching word by word lets staff type a full name ("John Smith" or "Smith John"),
 * which a whole-query match against first_name or last_name alone can never find.
 */
export function matchesPatientSearch(fields: Array<string | null | undefined>, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.filter(Boolean).join(' ').toLowerCase();
  return words.every(word => haystack.includes(word));
}
