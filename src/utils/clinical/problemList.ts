/**
 * The patient's problem list: active and past conditions, coded with ICD-10 where possible, so the
 * practitioner sees "Hypertension (I10), diabetes (E11.9)" at the top of every visit instead of
 * reading old notes, and a claim can reuse the codes.
 *
 * A visit's diagnosis is free text that may contain ICD-10 codes ("URTI J06.9, HPT I10"). Each code
 * in it becomes a one-tap suggestion; text without a code is offered as it is.
 */
import { describeIcd10, extractIcd10Codes, isValidIcd10Format, normalizeIcd10 } from '../billing/icd10';

export type ProblemStatus = 'active' | 'past' | 'entered_in_error';

export interface ProblemLike {
  description: string;
  icd10Code: string | null;
  status: ProblemStatus;
}

export interface ProblemSuggestion {
  description: string;
  icd10Code: string | null;
}

export const MAX_PROBLEM_DESCRIPTION = 200;

const sameText = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** True when the active list already has this problem (same code, or same words when uncoded). */
export function isAlreadyActive(suggestion: ProblemSuggestion, problems: readonly ProblemLike[]): boolean {
  return problems.some(problem =>
    problem.status === 'active' &&
    (suggestion.icd10Code ? problem.icd10Code === suggestion.icd10Code : sameText(problem.description, suggestion.description))
  );
}

/** "URTI J06.9, HPT I10" -> "URTI, HPT": the diagnosis words without its codes */
const withoutCodes = (text: string): string =>
  text
    .replace(/\b[A-Z][0-9]{2}(?:\.[0-9]{1,2})?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;])/g, '$1')
    .replace(/^[\s,;/-]+|[\s,;/-]+$/g, '')
    .trim();

/** One-tap additions from a visit diagnosis that are not on the active list yet. */
export function suggestProblemsFromDiagnosis(diagnosis: string | null | undefined, problems: readonly ProblemLike[]): ProblemSuggestion[] {
  const text = (diagnosis ?? '').trim();
  if (!text) return [];
  const codes = extractIcd10Codes(text);
  const suggestions: ProblemSuggestion[] =
    codes.length > 0
      ? codes.map(code => ({ icd10Code: code, description: describeIcd10(code) ?? (codes.length === 1 ? withoutCodes(text) || code : code) }))
      : [{ icd10Code: null, description: text.slice(0, MAX_PROBLEM_DESCRIPTION) }];
  return suggestions.filter(suggestion => suggestion.description && !isAlreadyActive(suggestion, problems));
}

/** Checks a problem before it is saved; returns the tidied values or a message. */
export function validateProblemInput(input: { description: string; icd10Code: string }):
  | { ok: true; value: ProblemSuggestion }
  | { ok: false; error: string } {
  const description = input.description.replace(/\s+/g, ' ').trim();
  const code = normalizeIcd10(input.icd10Code ?? '');
  if (!description && !code) return { ok: false, error: 'Describe the problem or enter its ICD-10 code.' };
  if (code && !isValidIcd10Format(code)) return { ok: false, error: `"${code}" is not an ICD-10 code (example: I10 or E11.9).` };
  if (description.length > MAX_PROBLEM_DESCRIPTION) return { ok: false, error: `Keep the description under ${MAX_PROBLEM_DESCRIPTION} characters.` };
  const finalDescription = description || describeIcd10(code) || code;
  return { ok: true, value: { description: finalDescription, icd10Code: code || null } };
}

/** "Hypertension, Type 2 diabetes +2 more" for the alert strip (active problems, in list order). */
export function summarizeActiveProblems(problems: readonly ProblemLike[], max = 2): string | null {
  const active = problems.filter(problem => problem.status === 'active');
  if (active.length === 0) return null;
  const shown = active.slice(0, max).map(problem => problem.description);
  const rest = active.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} +${rest} more` : shown.join(', ');
}
