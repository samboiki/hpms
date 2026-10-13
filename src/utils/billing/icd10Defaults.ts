/**
 * The ICD-10 codes a billing line starts with: one rule for the visit Billing tab (the codes a line is given until
 * someone changes them) and claim review (what it suggests for a claim line without saved codes).
 *
 * The first of these that gives a code wins:
 * 1. the practice's own usual code for the tariff code (Admin > Tariffs > Practice tariff; table
 *    tariff_icd10_defaults, proposals/2026-10-08-tariff-icd10-defaults.sql);
 * 2. dental practices: the code's usual diagnosis on the lines the funds accepted (USUAL_ICD10_BY_CODE);
 * 3. the ICD-10 codes written in the visit's diagnosis, at most 5 (what a claim line carries);
 * 4. dental practices: the owner's code sheet (DENTAL_ICD10_BY_CODE).
 * A code's usual diagnosis (1 or 2) stands alone: the funds paid those lines with that one code, even when the notes
 * name other conditions. GP and specialist practices get their own usual codes and the visit's, never the built-in
 * lists (NAMAF dental codes).
 *
 * Pure (no database), so it is tested directly. Explicit .ts imports: the claim scripts (Deno) load it unchanged.
 */
import { CLAIM_FIELD_MAX } from './claimLine.ts';
import { extractIcd10Codes, isExternalCauseCode, isValidIcd10Format, normalizeIcd10 } from './icd10.ts';
import { USUAL_ICD10_BY_CODE } from './tariffRules.ts';
import { DENTAL_ICD10_BY_CODE } from './dentalIcd10Map.ts';

export type Icd10SuggestionSource = 'practice-default' | 'usual-for-code' | 'visit-notes' | 'code-default' | 'none';

export interface Icd10Suggestion {
  /** Main code first; empty when there is nothing to go on */
  codes: string[];
  source: Icd10SuggestionSource;
}

/** A practice's usual ICD-10 code per tariff code (keys from tariffCodeKey). */
export type TariffIcd10Defaults = ReadonlyMap<string, string>;

export interface Icd10SuggestionContext {
  /** The practice's own usual codes; null or empty when it has none (or they could not be read) */
  practiceDefaults?: TariffIcd10Defaults | null;
  /** isDentalPractice(practice type): the built-in dental lists apply */
  dental: boolean;
  /** The visit's diagnosis as typed */
  diagnosis?: string | null;
}

/** "0190 " and "0190" are the same tariff code. */
export const tariffCodeKey = (code: string | null | undefined): string => (code ?? '').trim().toUpperCase();

/** Why a code cannot be a tariff code's usual diagnosis (it becomes the main code of a line); null when it can. */
export function usualIcd10Problem(code: string): string | null {
  const normalized = normalizeIcd10(code);
  if (!normalized) return 'Type an ICD-10 code, for example J06.9.';
  if (!isValidIcd10Format(normalized)) return `"${normalized}" is not an ICD-10 code (example: J06.9).`;
  if (isExternalCauseCode(normalized)) return `${normalized} says how an injury happened, so it cannot be the main code of a line.`;
  return null;
}

/** The practice's usual codes from its saved rows; a row with a code that cannot be used is left out. */
export function toTariffIcd10Defaults(rows: readonly { tariff_code: string | null; icd10_code: string | null }[]): Map<string, string> {
  const defaults = new Map<string, string>();
  rows.forEach(row => {
    const code = tariffCodeKey(row.tariff_code);
    const icd10 = normalizeIcd10(row.icd10_code ?? '');
    if (code && usualIcd10Problem(icd10) === null) defaults.set(code, icd10);
  });
  return defaults;
}

/** A tariff code's own usual diagnosis: the practice's, else (dental practices) the built-in one; null without one. */
export function usualIcd10ForCode(
  code: string,
  context: Pick<Icd10SuggestionContext, 'practiceDefaults' | 'dental'>
): { code: string; source: 'practice-default' | 'usual-for-code' } | null {
  const key = tariffCodeKey(code);
  const own = context.practiceDefaults?.get(key);
  if (own) return { code: own, source: 'practice-default' };
  const builtIn = context.dental ? USUAL_ICD10_BY_CODE[key] : undefined;
  return builtIn ? { code: builtIn, source: 'usual-for-code' } : null;
}

/** The codes a line for the tariff code `code` starts with (see the file comment). */
export function suggestLineIcd10(code: string, context: Icd10SuggestionContext): Icd10Suggestion {
  const usual = usualIcd10ForCode(code, context);
  if (usual) return { codes: [usual.code], source: usual.source };
  // An external cause code (how an injury happened) may not be the main code, so it moves after the others
  const written = extractIcd10Codes(context.diagnosis);
  const fromNotes = [...written.filter(item => !isExternalCauseCode(item)), ...written.filter(isExternalCauseCode)];
  if (fromNotes.length > 0) return { codes: fromNotes.slice(0, CLAIM_FIELD_MAX.diagnosisCodes), source: 'visit-notes' };
  const fromSheet = context.dental ? DENTAL_ICD10_BY_CODE[tariffCodeKey(code)] : undefined;
  return fromSheet ? { codes: [fromSheet], source: 'code-default' } : { codes: [], source: 'none' };
}

/** Where suggested codes came from, in plain words for the billing line; null when nothing was suggested. */
export function describeIcd10Source(source: Icd10SuggestionSource, tariffCode: string): string | null {
  const code = tariffCode.trim();
  switch (source) {
    case 'practice-default':
      return `the practice's usual code for ${code}`;
    case 'usual-for-code':
      return `usual for ${code}`;
    case 'visit-notes':
      return 'from the visit diagnosis';
    case 'code-default':
      return `suggested for ${code}`;
    default:
      return null;
  }
}
