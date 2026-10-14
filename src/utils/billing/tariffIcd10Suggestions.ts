/**
 * ICD-10 suggestions for a billing line, chosen by the tariff code on it (owner, 14 Oct 2026: map the NAMAF codes to
 * ICD-10 "so that things are proper"). No official table from NAMAF or the funds ties a tariff code to ICD-10 codes
 * (proposals/2026-10-14-tariff-icd10-suggestions.sql says what was researched), and the diagnosis is the practitioner's
 * for the patient, so everything here is a suggestion that the practitioner picks. In this order, each code once:
 * 1. the practice's own usual code for the tariff code (Admin > Tariffs; tariff_icd10_defaults);
 * 2. the codes the practice itself billed most with the tariff code in the last 24 months (learned_tariff_icd10),
 *    at most 3;
 * 3. OneHealth's reviewed starter codes for tariff codes whose own NAMAF wording names the situation
 *    (namaf_tariff_icd10_suggestions), at most 3;
 * 4. "procedure" codes: the conditions a procedure is usually done for, from wording rules over the NAMAF description
 *    (namaf_icd10_rules, read one tariff code at a time by icd10_rule_suggestions), at most 5;
 * 5. "common" codes: the diagnoses most common in the practice's kind of practice (namaf_discipline_common_icd10, read by
 *    icd10_discipline_common), at most 5. They are what is left for a consultation, which no rule covers.
 * Nothing here fills a diagnosis in: the code box under the billing line offers these and the practitioner chooses.
 * A procedure or common code that a person has not reviewed shows its reason only; the "published list" note is added
 * only when the database passes on a source, which it does for reviewed rows alone.
 *
 * Pure (no database), so it is tested directly. Explicit .ts imports like the other billing rules.
 */
import { isExternalCauseCode, isValidIcd10Format, normalizeIcd10 } from './icd10.ts';
import { tariffCodeKey } from './icd10Defaults.ts';

export type TariffIcd10Source = 'practice' | 'learned' | 'starter' | 'procedure' | 'common';

/** One suggested code and why, in plain words (shown under the code in the code box). */
export interface TariffIcd10Suggestion {
  code: string;
  source: TariffIcd10Source;
  reason: string;
}

export interface LearnedCode {
  code: string;
  timesUsed: number;
}

/** A code and the reason it is suggested, in plain words (shown under the code). */
export interface ReasonedCode {
  code: string;
  reason: string;
}

export type StarterCode = ReasonedCode;

/** Everything the suggestions are made from, by tariff code (keys from tariffCodeKey). */
export interface TariffIcd10Data {
  /** The practice's usual code per tariff code */
  usual: ReadonlyMap<string, string>;
  /** The codes the practice billed most with each tariff code, most used first */
  learned: ReadonlyMap<string, readonly LearnedCode[]>;
  /** OneHealth's starter codes for the practice's NAMAF discipline, in their order */
  starter: ReadonlyMap<string, readonly StarterCode[]>;
  /** What the wording rules suggest for a tariff code (read for one code at a time), in the rules' order */
  procedure: ReadonlyMap<string, readonly ReasonedCode[]>;
  /** The diagnoses most common in the practice's discipline, most common first (the same for every tariff code) */
  common: readonly ReasonedCode[];
}

export const EMPTY_TARIFF_ICD10_DATA: TariffIcd10Data = { usual: new Map(), learned: new Map(), starter: new Map(), procedure: new Map(), common: [] };

/** How many of each kind are offered: the code box stays short. */
export const MAX_LEARNED_SUGGESTIONS = 3;
export const MAX_STARTER_SUGGESTIONS = 3;
export const MAX_PROCEDURE_SUGGESTIONS = 5;
export const MAX_COMMON_SUGGESTIONS = 5;

/** A row of learned_tariff_icd10 as it is read. */
export interface LearnedRow {
  tariff_code: string | null;
  icd10_code: string | null;
  times_used: number | string | null;
}

/** A row of namaf_tariff_icd10_suggestions as it is read. */
export interface StarterRow {
  code: string | null;
  icd10_code: string | null;
  sort_order: number | string | null;
  rationale: string | null;
  /** 'sa-standard': the link follows a published South African coding standard; otherwise OneHealth's own reasoning */
  source?: string | null;
}

/** A row of icd10_rule_suggestions as it is read: the database gives them closest rule first, each rule's codes in its own order. */
export interface RuleRow {
  icd10: string | null;
  reason: string | null;
}

/** A row of icd10_discipline_common as it is read. */
export interface CommonRow {
  icd10: string | null;
  reason: string | null;
  rank: number | string | null;
  /** The published list the row comes from: the database passes it on only for rows a person has reviewed */
  source?: string | null;
}

/** Said after the reason of a starter link that follows the South African ICD-10 Coding Standards (not a NAMAF rule). */
export const SA_STANDARD_NOTE = ' (South African coding standard)';

/** Said after the reason of a common diagnosis that comes from a published list a person has reviewed. */
export const PUBLISHED_LIST_NOTE = ' (published list)';

/** A code that can be the main code of a line: the ICD-10 shape, not an external cause code. */
const usableMainCode = (code: string): boolean => isValidIcd10Format(code) && !isExternalCauseCode(code);

/**
 * The learned rows by tariff code, in the order the database gave them (most used first). The same code twice for one
 * tariff code is counted once, with its times added; a row with nothing usable is left out.
 */
export function toLearnedMap(rows: readonly LearnedRow[]): Map<string, LearnedCode[]> {
  const byTariff = new Map<string, Map<string, number>>();
  rows.forEach(row => {
    const tariff = tariffCodeKey(row.tariff_code);
    const code = normalizeIcd10(row.icd10_code ?? '');
    const times = Math.floor(Number(row.times_used));
    if (!tariff || !usableMainCode(code) || !Number.isFinite(times) || times < 1) return;
    const codes = byTariff.get(tariff) ?? new Map<string, number>();
    codes.set(code, (codes.get(code) ?? 0) + times);
    byTariff.set(tariff, codes);
  });
  const learned = new Map<string, LearnedCode[]>();
  byTariff.forEach((codes, tariff) => {
    learned.set(
      tariff,
      [...codes.entries()].map(([code, timesUsed]) => ({ code, timesUsed })).sort((a, b) => b.timesUsed - a.timesUsed || a.code.localeCompare(b.code))
    );
  });
  return learned;
}

/** The starter rows by tariff code, in their own order (sort_order, then code); a row without a usable code or reason is left out. */
export function toStarterMap(rows: readonly StarterRow[]): Map<string, StarterCode[]> {
  const ordered = rows
    .map(row => ({
      tariff: tariffCodeKey(row.code),
      code: normalizeIcd10(row.icd10_code ?? ''),
      order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 9,
      reason: (row.rationale ?? '').trim(),
      standard: row.source === 'sa-standard'
    }))
    .filter(row => row.tariff && usableMainCode(row.code) && row.reason)
    .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
  const starter = new Map<string, StarterCode[]>();
  ordered.forEach(row => {
    const list = starter.get(row.tariff) ?? [];
    if (!list.some(item => item.code === row.code)) starter.set(row.tariff, [...list, { code: row.code, reason: row.standard ? `${row.reason}${SA_STANDARD_NOTE}` : row.reason }]);
  });
  return starter;
}

/**
 * What the wording rules suggest for one tariff code, in the order the database gave them (the rule written for the
 * discipline itself first); a row without a usable code or a reason is left out, and a code is kept once.
 */
export function toProcedureCodes(rows: readonly RuleRow[]): ReasonedCode[] {
  const found: ReasonedCode[] = [];
  rows.forEach(row => {
    const code = normalizeIcd10(row.icd10 ?? '');
    const reason = (row.reason ?? '').trim();
    if (usableMainCode(code) && reason && !found.some(item => item.code === code)) found.push({ code, reason });
  });
  return found;
}

const rankOf = (value: number | string | null): number => {
  const rank = value === null || value === '' ? NaN : Number(value);
  return Number.isFinite(rank) ? rank : 99;
};

/**
 * The common diagnoses of the practice's discipline, most common first (rank, then code); a row without a usable code or a
 * reason is left out. The "published list" note goes only on a row the database passed a source for.
 */
export function toCommonCodes(rows: readonly CommonRow[]): ReasonedCode[] {
  const ordered = rows
    .map(row => ({
      code: normalizeIcd10(row.icd10 ?? ''),
      rank: rankOf(row.rank),
      reason: (row.reason ?? '').trim(),
      published: Boolean((row.source ?? '').trim())
    }))
    .filter(row => usableMainCode(row.code) && row.reason)
    .sort((a, b) => a.rank - b.rank || a.code.localeCompare(b.code));
  const found: ReasonedCode[] = [];
  ordered.forEach(row => {
    if (!found.some(item => item.code === row.code)) found.push({ code: row.code, reason: row.published ? `${row.reason}${PUBLISHED_LIST_NOTE}` : row.reason });
  });
  return found;
}

/** "Billed with 0102 14 times in the last 2 years": what the practice has done, in plain words. */
export function learnedReason(tariffCode: string, timesUsed: number): string {
  const times = timesUsed === 1 ? 'once' : `${timesUsed} times`;
  return `Billed with ${tariffCode.trim()} ${times} in the last 2 years`;
}

/** "Your practice's usual code for 0190": the code set under Admin > Tariffs. */
export const practiceReason = (tariffCode: string): string => `Your practice's usual code for ${tariffCode.trim()}`;

/** The suggestions for a line billed with `tariffCode`, in the order of the file comment; empty when there are none. */
export function suggestionsForTariff(tariffCode: string, data: TariffIcd10Data): TariffIcd10Suggestion[] {
  const key = tariffCodeKey(tariffCode);
  if (!key) return [];
  const found: TariffIcd10Suggestion[] = [];
  const add = (code: string, source: TariffIcd10Source, reason: string) => {
    const tidy = normalizeIcd10(code);
    if (usableMainCode(tidy) && !found.some(item => item.code === tidy)) found.push({ code: tidy, source, reason });
  };

  // Up to `limit` new codes from one kind; a code already offered by a stronger kind does not use up a place
  const addUpTo = <T extends { code: string }>(items: readonly T[], limit: number, source: TariffIcd10Source, reasonOf: (item: T) => string) => {
    let added = 0;
    items.forEach(item => {
      if (added >= limit) return;
      const before = found.length;
      add(item.code, source, reasonOf(item));
      if (found.length > before) added += 1;
    });
  };

  const usual = data.usual.get(key);
  if (usual) add(usual, 'practice', practiceReason(key));
  addUpTo(data.learned.get(key) ?? [], MAX_LEARNED_SUGGESTIONS, 'learned', item => learnedReason(key, item.timesUsed));
  addUpTo(data.starter.get(key) ?? [], MAX_STARTER_SUGGESTIONS, 'starter', item => item.reason);
  addUpTo(data.procedure.get(key) ?? [], MAX_PROCEDURE_SUGGESTIONS, 'procedure', item => item.reason);
  addUpTo(data.common, MAX_COMMON_SUGGESTIONS, 'common', item => item.reason);
  return found;
}
