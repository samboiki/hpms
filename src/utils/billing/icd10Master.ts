/**
 * The medical aids' ICD-10 list: the South African ICD-10 Master Industry Table (SA MIT), which Namibian funds also
 * validate claims against (table icd10_codes, proposals/2026-10-12-icd10-master.sql, loaded by
 * scripts/db/load-icd10-mit.ts). One set of rules for the code search and claim review: a category heading is not a
 * diagnosis, an asterisk code never comes first, some codes may not be the main diagnosis, a discontinued code is no
 * longer accepted, and some codes are meant for one sex or an age range.
 *
 * Pure (no database), so it is tested directly. Explicit .ts imports: the claim scripts (Deno) load it unchanged.
 */
import { formatServiceDate, isValidDateKey } from './dates.ts';
import { extractIcd10Codes, isExternalCauseCode, isValidIcd10Format, normalizeIcd10 } from './icd10.ts';
import { ageOn } from '../patientLists/listDates.ts';

/** One code of the list, as the app uses it. */
export interface Icd10MasterEntry {
  code: string;
  description: string;
  /** False for a category heading: a more specific code exists, and the funds reject the heading */
  validClinicalUse: boolean;
  /** False when the code may not be the main (first) diagnosis */
  validPrimary: boolean;
  /** An asterisk (*) code says how a disease shows itself; it follows the code of its cause */
  isAsterisk: boolean;
  /** As the list writes it ("≤ 19 years"); null for any age */
  ageRange: string | null;
  /** The sex the code is meant for; null for either */
  gender: 'M' | 'F' | null;
  /** South Africa discontinued the code (it stays in the list) */
  discontinued: boolean;
  /** The day it ended (yyyy-MM-dd), when the list gives one */
  endDate: string | null;
}

/** The columns of icd10_codes the app reads. */
export const ICD10_MASTER_COLUMNS = 'code, description, valid_clinical_use, valid_primary, is_asterisk, age_range, gender, status, sa_end_date';

export interface Icd10MasterRow {
  code: string;
  description: string | null;
  valid_clinical_use: boolean | null;
  valid_primary: boolean | null;
  is_asterisk: boolean | null;
  age_range: string | null;
  gender: string | null;
  status: string | null;
  sa_end_date: string | null;
}

export function toIcd10MasterEntry(row: Icd10MasterRow): Icd10MasterEntry {
  const gender = (row.gender ?? '').trim().toUpperCase();
  return {
    code: row.code,
    description: (row.description ?? '').trim(),
    validClinicalUse: row.valid_clinical_use !== false,
    validPrimary: row.valid_primary !== false,
    isAsterisk: row.is_asterisk === true,
    ageRange: row.age_range?.trim() || null,
    gender: gender === 'M' || gender === 'F' ? gender : null,
    discontinued: (row.status ?? '').trim().toUpperCase() === 'D',
    endDate: isValidDateKey(row.sa_end_date) ? row.sa_end_date : null
  };
}

/** An age range in whole years on the service date, both ends included; null at an open end. */
export interface Icd10AgeRange {
  min: number | null;
  max: number | null;
}

const AGE_LIMIT = /^(<=|>=|≤|≥|<|>)\s*(\d{1,3})\s*years?$/i;
const AGE_SPAN = /^(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\s*years?$/i;

/**
 * The list's age range in whole years: "≤ 19 years" is 19 or younger, "> 19 years" is 20 or older. Null when there is
 * none, or when the text is not understood (the load script refuses a list with a range it does not understand).
 */
export function parseIcd10AgeRange(text: string | null | undefined): Icd10AgeRange | null {
  const value = (text ?? '').trim();
  const limit = AGE_LIMIT.exec(value);
  if (limit) {
    const years = Number(limit[2]);
    if (limit[1] === '<') return { min: null, max: years - 1 };
    if (limit[1] === '≤' || limit[1] === '<=') return { min: null, max: years };
    if (limit[1] === '>') return { min: years + 1, max: null };
    return { min: years, max: null };
  }
  const span = AGE_SPAN.exec(value);
  if (span && Number(span[1]) <= Number(span[2])) return { min: Number(span[1]), max: Number(span[2]) };
  return null;
}

const describeAgeRange = (range: Icd10AgeRange): string => {
  if (range.min !== null && range.max !== null) return `aged ${range.min} to ${range.max}`;
  return range.max !== null ? `aged ${range.max} or younger` : `aged ${range.min} or older`;
};

/** What was typed in the code search. */
export interface Icd10Query {
  /** The start of a code, tidied ("a000" -> "A00.0"); null when the text is not the start of a code */
  code: string | null;
  /** Words that must each start a word of the description: lower case, letters and digits */
  words: string[];
}

/** Fewer characters than this find too much to be useful. */
export const ICD10_SEARCH_MIN_LENGTH = 2;
const CODE_START = /^[A-Z][0-9]{1,2}(?:\.[0-9]{1,2})?$/;
const MAX_WORDS = 8;
const wordsOf = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * One code-like token ("j06", "a000", "J06.9") is searched as the start of a code and as a word (vitamin "B12");
 * anything else as words.
 */
export function parseIcd10Query(text: string): Icd10Query {
  const tokens = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const words = [...new Set(tokens.flatMap(wordsOf))].slice(0, MAX_WORDS);
  const code = tokens.length === 1 ? normalizeIcd10(tokens[0]) : '';
  return { code: CODE_START.test(code) ? code : null, words };
}

/** True when an entry answers the query the way the database search does: the start of its code, or every word. */
export function matchesIcd10Query(entry: { code: string; description: string }, query: Icd10Query): boolean {
  if (query.code && entry.code.startsWith(query.code)) return true;
  if (query.words.length === 0) return false;
  const described = wordsOf(entry.description);
  return query.words.every(word => described.some(item => item.startsWith(word)));
}

/** One option under the code search. */
export interface Icd10Option {
  code: string;
  /** Null when the list could not be read: the code is shown on its own */
  entry: Icd10MasterEntry | null;
  /** The line's suggested codes and the practice's usual codes */
  suggested: boolean;
  /** Why a suggested code is offered, in plain words (shown under its description); none for the other options */
  hint?: string;
}

/**
 * The options under the code search. Nothing typed: the suggestions. Otherwise the exact code first, then the
 * suggestions that match, then the other results. Each code once.
 */
export function icd10Options(
  query: string,
  suggestions: readonly Icd10Option[],
  results: readonly Icd10MasterEntry[],
  limit = 30
): Icd10Option[] {
  const parsed = parseIcd10Query(query);
  const typed = parsed.code !== null || parsed.words.length > 0;
  const matching = typed
    ? suggestions.filter(option => (option.entry ? matchesIcd10Query(option.entry, parsed) : parsed.code !== null && option.code.startsWith(parsed.code)))
    : suggestions;
  const found = typed ? results.map(entry => ({ code: entry.code, entry, suggested: false })) : [];
  const exact = [...matching, ...found].filter(option => option.code === parsed.code);
  const byCode = new Map<string, Icd10Option>();
  [...exact, ...matching, ...found].forEach(option => {
    const kept = byCode.get(option.code);
    if (!kept) byCode.set(option.code, option);
    else if (!kept.entry && option.entry) byCode.set(option.code, { ...kept, entry: option.entry });
  });
  return [...byCode.values()].slice(0, limit);
}

/**
 * The visit diagnosis with a chosen code added on a line of its own ("J06.9 Acute upper respiratory infection,
 * unspecified"), where the billing lines (icd10Defaults.ts) and the problem list find it; unchanged when the code is
 * already written in it.
 */
export function addIcd10ToDiagnosis(diagnosis: string | null | undefined, code: string, description?: string | null): string {
  const text = (diagnosis ?? '').replace(/\s+$/, '');
  if (extractIcd10Codes(text).includes(code)) return diagnosis ?? '';
  const line = description?.trim() ? `${code} ${description.trim()}` : code;
  return text ? `${text}\n${line}` : line;
}

/** Where a code goes: first on a claim line (the main diagnosis) or after it. */
export type Icd10Position = 'main' | 'other';

type EntryIssue = 'discontinued' | 'heading' | 'asterisk-first' | 'not-primary';

/** A discontinued code was still valid on a service date up to the day it ended. */
const endedBy = (entry: Icd10MasterEntry, serviceDate?: string | null): boolean =>
  entry.discontinued && !(entry.endDate && isValidDateKey(serviceDate) && serviceDate <= entry.endDate);

/** The first thing wrong with using the code in that place, whoever the patient is; null when nothing is. */
function entryIssue(entry: Icd10MasterEntry, position: Icd10Position, serviceDate?: string | null): EntryIssue | null {
  if (endedBy(entry, serviceDate)) return 'discontinued';
  if (!entry.validClinicalUse) return 'heading';
  if (position === 'main' && entry.isAsterisk) return 'asterisk-first';
  if (position === 'main' && !entry.validPrimary) return 'not-primary';
  return null;
}

const OPTION_NOTES: Record<EntryIssue, string> = {
  discontinued: 'No longer valid',
  heading: 'Category heading: choose a code under it',
  'asterisk-first': 'Asterisk code: not the main code',
  'not-primary': 'Not the main diagnosis'
};

/** A short note on an option in the code search; null when the code can be used in that place. */
export function icd10OptionNote(entry: Icd10MasterEntry, position: Icd10Position): string | null {
  const issue = entryIssue(entry, position);
  return issue ? OPTION_NOTES[issue] : null;
}

export interface Icd10ListProblem {
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface Icd10ListContext {
  /** The day of the service (yyyy-MM-dd): ages and end dates count on it */
  serviceDate?: string | null;
  patient?: { gender: string | null; dateOfBirth: string | null } | null;
}

const named = (entry: Icd10MasterEntry): string => (entry.description ? `${entry.code} (${entry.description})` : entry.code);
const sexWord = (gender: 'M' | 'F'): string => (gender === 'F' ? 'female' : 'male');

/**
 * What the medical aids' list says about one line's codes (main code first), in plain words: each is a reason a fund
 * rejects or questions the line. `master` holds the codes that were looked up; a code missing from it is not in the
 * list. A code without the ICD-10 shape, and an external cause code first, are validateIcd10Selection's to report.
 */
export function icd10ListProblems(
  codes: readonly string[],
  master: ReadonlyMap<string, Icd10MasterEntry>,
  context: Icd10ListContext = {}
): Icd10ListProblem[] {
  const problems: Icd10ListProblem[] = [];
  const seen = new Set<string>();
  const add = (code: string, severity: Icd10ListProblem['severity'], message: string) => problems.push({ code, severity, message });
  const patientGender = (context.patient?.gender ?? '').trim().toUpperCase();
  const age = context.patient?.dateOfBirth && context.serviceDate ? ageOn(context.patient.dateOfBirth, context.serviceDate) : null;

  codes.forEach((raw, index) => {
    const code = normalizeIcd10(raw ?? '');
    if (!isValidIcd10Format(code) || seen.has(code)) return;
    seen.add(code);
    const entry = master.get(code);
    if (!entry) {
      add(code, 'error', `${code} is not in the medical aids' ICD-10 list: check the code.`);
      return;
    }
    const issue = entryIssue(entry, index === 0 ? 'main' : 'other', context.serviceDate);
    if (issue === 'discontinued') {
      const ended = entry.endDate ? ` ended on ${formatServiceDate(entry.endDate)} and` : '';
      add(code, 'error', `${named(entry)}${ended} is no longer accepted: choose a current code.`);
      return;
    }
    if (issue === 'heading') {
      add(code, 'error', `${named(entry)} is a category heading, not a diagnosis: choose a more specific code that starts with ${code}.`);
      return;
    }
    if (issue === 'asterisk-first') {
      add(code, 'error', `${code} is an asterisk (*) code: it says how a disease shows itself and may not be the main code. Put the code of the underlying disease first.`);
    } else if (issue === 'not-primary' && !isExternalCauseCode(code)) {
      add(code, 'warning', `${named(entry)} may not be the main diagnosis: put the code of the condition treated first.`);
    }

    if (entry.gender && (patientGender === 'M' || patientGender === 'F') && entry.gender !== patientGender) {
      add(code, 'warning', `${named(entry)} is meant for ${sexWord(entry.gender)} patients, and this patient is ${sexWord(patientGender)}: check the code or the patient's gender.`);
    }
    const range = parseIcd10AgeRange(entry.ageRange);
    if (range && age !== null && ((range.min !== null && age < range.min) || (range.max !== null && age > range.max))) {
      add(code, 'warning', `${named(entry)} is meant for patients ${describeAgeRange(range)}; this patient was ${age} on the service date: check the code.`);
    }
  });
  return problems;
}
