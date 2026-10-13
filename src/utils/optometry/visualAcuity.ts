/**
 * Visual acuity as optometrists write it: Snellen in metres ("6/6", "6/9+2", "6/12-1") or in feet ("20/20"), decimal
 * ("1.0", "0.5"), or the low-vision steps CF (counts fingers), HM (hand movements), LP (light perception) and NLP (no
 * light perception). Kept as text; the database checks the same pattern (VA_PATTERN in
 * proposals/2026-10-08-optometry.sql).
 */

/** The stored form: the database's optometry_va_ok() uses this same expression. */
export const VA_PATTERN = /^((6|20)\/[1-9][0-9]{0,2}([+-][1-5])?|0\.(0[1-9]|[1-9][0-9]?)|1\.[0-9]{1,2}|2\.00?|CF|HM|LP|NLP)$/;

export const LOW_VISION_LABELS: Readonly<Record<'CF' | 'HM' | 'LP' | 'NLP', string>> = {
  CF: 'Counts fingers',
  HM: 'Hand movements',
  LP: 'Light perception',
  NLP: 'No light perception'
};

/** Other ways the same low-vision steps are written. */
const SYNONYMS: Readonly<Record<string, string>> = { PL: 'LP', NPL: 'NLP', PLP: 'LP' };

/**
 * The acuity as it is stored ("6/9+2", "CF", "1.0"), or null when it is not one: upper case, no spaces, a decimal
 * comma read as a point, "1" read as "1.0".
 */
export function normaliseVisualAcuity(text: string): string | null {
  let cleaned = text.trim().toUpperCase().replace(/\s+/g, '').replace(/,/g, '.');
  if (!cleaned) return null;
  cleaned = SYNONYMS[cleaned] ?? cleaned;
  if (cleaned === '1' || cleaned === '2') cleaned = `${cleaned}.0`;
  return VA_PATTERN.test(cleaned) ? cleaned : null;
}
