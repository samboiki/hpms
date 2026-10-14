/**
 * Which practice_types.name a practice's type text means, and which types work like a dental practice. Pure and without
 * imports, so the claim rules (an edge function runs them too) and the screens read the same lists.
 */

/**
 * Type texts the app reads as another type; the practice's own text is never changed (owner, 14 Oct 2026). One practice
 * holds 'dental_practice', which matches no practice_types row: the app treats it as a dental practice.
 */
const PRACTICE_TYPE_ALIASES: Readonly<Record<string, string>> = { dental_practice: 'dental' };

/** practices.practice_type as the app reads it: trimmed, lower case, an alias read as the type it stands for ('' when not set). */
export function normalisePracticeType(practiceType: unknown): string {
  const key = typeof practiceType === 'string' ? practiceType.trim().toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(PRACTICE_TYPE_ALIASES, key) ? PRACTICE_TYPE_ALIASES[key] : key;
}

/**
 * Dental and the dental specialists (owner, 14 Oct 2026: "dental specialists are their own practice types that work
 * like dental"): the tooth chart, the dental claim checks, the quote's tooth column, dental lab orders and the dental
 * code rules. Each bills from its own NAMAF list (orthodontist 064, periodontist 092 ...), not the dentist's. The dental
 * technician's laboratory is not here: it has no tooth chart. A test keeps this list the same as is_dental_practice_type
 * in proposals/2026-10-14-more-practice-types.sql, which lets these practices order lab work.
 */
export const DENTAL_PRACTICE_TYPES: readonly string[] = [
  'dental',
  'orthodontist',
  'maxillofacial_oral_surgeon',
  'periodontist',
  'prosthodontist',
  'dental_therapist'
];
