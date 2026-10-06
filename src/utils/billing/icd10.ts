/**
 * ICD-10 diagnosis codes for claims.
 *
 * NAMAF rule: no ICD-10, no payment. Every claim line needs one primary ICD-10 code and may
 * carry up to 9 secondary codes. Codes follow the WHO ICD-10 format used in Namibia: a letter,
 * two digits and an optional dot with one or two digits (A00, J06.9, S52.50).
 * External cause codes (V01-Y98) describe how an injury happened and may never be the primary
 * code; an injury code (S00-T98) is expected to be followed by an external cause code.
 */

export interface Icd10Entry {
  code: string;
  description: string;
  group: 'General practice' | 'Dental';
}

export interface Icd10Selection {
  primary: string;
  secondary: string[];
}

export const MAX_SECONDARY_ICD10 = 9;

/** A new, empty selection (no codes yet). */
export const emptyIcd10Selection = (): Icd10Selection => ({ primary: '', secondary: [] });

const ICD10_PATTERN = /^[A-Z][0-9]{2}(?:\.[0-9]{1,2})?$/;

/** A short built-in list of common GP and dental codes for quick picking. Free entry is also allowed. */
export const COMMON_ICD10_CODES: readonly Icd10Entry[] = [
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', group: 'General practice' },
  { code: 'J00', description: 'Acute nasopharyngitis (common cold)', group: 'General practice' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified', group: 'General practice' },
  { code: 'J03.9', description: 'Acute tonsillitis, unspecified', group: 'General practice' },
  { code: 'J01.9', description: 'Acute sinusitis, unspecified', group: 'General practice' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', group: 'General practice' },
  { code: 'J18.9', description: 'Pneumonia, unspecified', group: 'General practice' },
  { code: 'J45.9', description: 'Asthma, unspecified', group: 'General practice' },
  { code: 'J30.4', description: 'Allergic rhinitis, unspecified', group: 'General practice' },
  { code: 'H66.9', description: 'Otitis media, unspecified', group: 'General practice' },
  { code: 'H10.9', description: 'Conjunctivitis, unspecified', group: 'General practice' },
  { code: 'I10', description: 'Essential (primary) hypertension', group: 'General practice' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', group: 'General practice' },
  { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', group: 'General practice' },
  { code: 'E78.5', description: 'Hyperlipidaemia, unspecified', group: 'General practice' },
  { code: 'E66.9', description: 'Obesity, unspecified', group: 'General practice' },
  { code: 'K29.7', description: 'Gastritis, unspecified', group: 'General practice' },
  { code: 'K21.9', description: 'Gastro-oesophageal reflux disease without oesophagitis', group: 'General practice' },
  { code: 'A09.9', description: 'Gastroenteritis and colitis of unspecified origin', group: 'General practice' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', group: 'General practice' },
  { code: 'M54.5', description: 'Low back pain', group: 'General practice' },
  { code: 'R50.9', description: 'Fever, unspecified', group: 'General practice' },
  { code: 'R51', description: 'Headache', group: 'General practice' },
  { code: 'R05', description: 'Cough', group: 'General practice' },
  { code: 'R10.4', description: 'Other and unspecified abdominal pain', group: 'General practice' },
  { code: 'B34.9', description: 'Viral infection, unspecified', group: 'General practice' },
  { code: 'L30.9', description: 'Dermatitis, unspecified', group: 'General practice' },
  { code: 'L01.0', description: 'Impetigo', group: 'General practice' },
  { code: 'F41.1', description: 'Generalized anxiety disorder', group: 'General practice' },
  { code: 'F32.9', description: 'Depressive episode, unspecified', group: 'General practice' },
  { code: 'G43.9', description: 'Migraine, unspecified', group: 'General practice' },
  { code: 'Z00.0', description: 'General medical examination', group: 'General practice' },
  { code: 'Z76.0', description: 'Issue of repeat prescription', group: 'General practice' },
  { code: 'Z01.2', description: 'Dental examination', group: 'Dental' },
  { code: 'K02.1', description: 'Caries of dentine', group: 'Dental' },
  { code: 'K02.9', description: 'Dental caries, unspecified', group: 'Dental' },
  { code: 'K04.0', description: 'Pulpitis', group: 'Dental' },
  { code: 'K04.7', description: 'Periapical abscess without sinus', group: 'Dental' },
  { code: 'K05.1', description: 'Chronic gingivitis', group: 'Dental' },
  { code: 'K05.3', description: 'Chronic periodontitis', group: 'Dental' },
  { code: 'K03.6', description: 'Deposits (accretions) on teeth', group: 'Dental' },
  { code: 'K01.1', description: 'Impacted teeth', group: 'Dental' },
  { code: 'K08.8', description: 'Other specified disorders of teeth and supporting structures', group: 'Dental' },
  { code: 'K12.0', description: 'Recurrent oral aphthae', group: 'Dental' },
  { code: 'S02.5', description: 'Fracture of tooth', group: 'Dental' }
];

/**
 * Tidies typed input: upper case, no spaces, dagger/asterisk markers removed, a missing dot
 * added ("j069" -> "J06.9", "S5250" -> "S52.50") and a trailing dot dropped ("I10." -> "I10").
 * The result still has to pass isValidIcd10Format.
 */
export function normalizeIcd10(input: string): string {
  let code = String(input ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[*†+]/g, '');
  if (code.endsWith('.')) code = code.slice(0, -1);
  if (/^[A-Z][0-9]{2}[0-9]{1,2}$/.test(code)) code = `${code.slice(0, 3)}.${code.slice(3)}`;
  return code;
}

/** True when the code has the ICD-10 shape (after normalising). */
export function isValidIcd10Format(code: string): boolean {
  return ICD10_PATTERN.test(code);
}

/** External cause codes (V01-Y98): never the primary diagnosis. */
export function isExternalCauseCode(code: string): boolean {
  return /^[VWXY]/.test(code);
}

/** Injury codes (S00-T98): need an external cause code as a secondary code. */
export function isInjuryCode(code: string): boolean {
  return /^[ST]/.test(code);
}

/** Validates one line's codes; codes are normalised first. */
export function validateIcd10Selection(selection: Icd10Selection): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const primary = normalizeIcd10(selection.primary ?? '');
  const secondary = (selection.secondary ?? []).map(normalizeIcd10).filter(Boolean);

  if (!primary) {
    errors.push('An ICD-10 diagnosis code is required (no ICD-10, no payment).');
  } else if (!isValidIcd10Format(primary)) {
    errors.push(`"${primary}" is not a valid ICD-10 code (example: J06.9).`);
  } else if (isExternalCauseCode(primary)) {
    errors.push(`${primary} is an external cause code and cannot be the primary diagnosis.`);
  }

  if (secondary.length > MAX_SECONDARY_ICD10) {
    errors.push(`At most ${MAX_SECONDARY_ICD10} secondary ICD-10 codes are allowed per line.`);
  }
  secondary
    .filter(code => !isValidIcd10Format(code))
    .forEach(code => errors.push(`"${code}" is not a valid ICD-10 code (example: J06.9).`));

  const all = [primary, ...secondary].filter(Boolean);
  const duplicates = all.filter((code, index) => all.indexOf(code) !== index);
  [...new Set(duplicates)].forEach(code => errors.push(`${code} is listed more than once.`));

  const injury = all.find(code => isValidIcd10Format(code) && isInjuryCode(code));
  if (injury && !all.some(code => isValidIcd10Format(code) && isExternalCauseCode(code))) {
    warnings.push(`Injury code ${injury} usually needs an external cause code (V01-Y98) as a secondary code.`);
  }
  return { errors, warnings };
}

/** Searches the built-in list by code or description. */
export function searchIcd10(query: string, entries: readonly Icd10Entry[] = COMMON_ICD10_CODES): Icd10Entry[] {
  const text = query.trim().toLowerCase();
  if (!text) return [...entries];
  const words = text.split(/\s+/);
  return entries
    .filter(entry => words.every(word => entry.code.toLowerCase().includes(word) || entry.description.toLowerCase().includes(word)))
    .sort((a, b) => {
      const aCode = a.code.toLowerCase().startsWith(text) ? 0 : 1;
      const bCode = b.code.toLowerCase().startsWith(text) ? 0 : 1;
      return aCode - bCode || a.code.localeCompare(b.code);
    });
}

/** Looks up the description of a built-in code. */
export function describeIcd10(code: string): string | null {
  const normalized = normalizeIcd10(code);
  return COMMON_ICD10_CODES.find(entry => entry.code === normalized)?.description ?? null;
}

/**
 * Finds ICD-10-shaped codes in free text such as a visit diagnosis ("URTI J06.9, HPT I10").
 * Only upper-case codes are picked up to avoid noise; results are suggestions a doctor must confirm.
 */
export function extractIcd10Codes(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/\b[A-Z][0-9]{2}(?:\.[0-9]{1,2})?\b/g) ?? [];
  return [...new Set(matches.map(normalizeIcd10).filter(isValidIcd10Format))];
}
