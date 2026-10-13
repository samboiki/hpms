/**
 * The medical aids' ICD-10 list (table icd10_codes, proposals/2026-10-12-icd10-master.sql, parity E14): the one search
 * every screen that chooses a code uses (search_icd10_codes), and the look-up of chosen codes' descriptions and flags
 * for the code picker and claim review (one query for all the codes on a batch). Never throws: before the list is set
 * up the picker works as free entry and claim review checks codes by their shape only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isNotSetUpError } from './invoicingSetup';
import { loadTariffIcd10Defaults } from './icd10DefaultsService';
import { isValidIcd10Format, normalizeIcd10 } from '../utils/billing/icd10';
import { ICD10_MASTER_COLUMNS, parseIcd10Query, toIcd10MasterEntry, type Icd10MasterEntry, type Icd10MasterRow } from '../utils/billing/icd10Master';

// The generated database types do not know the new table and function yet
const db = supabase as unknown as SupabaseClient;

/** not-set-up: the list is not in this database yet */
export type Icd10ListStatus = 'ready' | 'not-set-up' | 'error';

export interface Icd10Search {
  status: Icd10ListStatus;
  entries: Icd10MasterEntry[];
}

export interface Icd10Lookup {
  status: Icd10ListStatus;
  /** The codes found; a code asked for and missing here is not in the list (status 'ready') */
  entries: Map<string, Icd10MasterEntry>;
}

export const ICD10_SEARCH_LIMIT = 30;
/** Codes per look-up request: keeps the request address short */
const LOOKUP_CHUNK = 150;
/** The practice's usual codes are read again after this long, so a code an administrator just set shows up */
const USUAL_CODES_MAX_AGE_MS = 5 * 60 * 1000;

/** Codes looked up before: the entry, or null when the code is not in the list (the list changes once a year at most). */
const known = new Map<string, Icd10MasterEntry | null>();
let listMissing = false;
const usualByPractice = new Map<string, { at: number; codes: Promise<string[]> }>();

const statusOf = (error: unknown): Icd10ListStatus => {
  if (!isNotSetUpError(error)) return 'error';
  listMissing = true;
  return 'not-set-up';
};

/** The codes and description words a practitioner typed ("j069", "acute sinusitis"), best match first. */
export async function searchIcd10Codes(text: string, limit = ICD10_SEARCH_LIMIT): Promise<Icd10Search> {
  const query = parseIcd10Query(text);
  if (!query.code && query.words.length === 0) return { status: 'ready', entries: [] };
  if (listMissing) return { status: 'not-set-up', entries: [] };
  try {
    const { data, error } = await db
      .rpc('search_icd10_codes', { p_code: query.code, p_words: query.words, p_limit: limit })
      .select(ICD10_MASTER_COLUMNS);
    if (error) return { status: statusOf(error), entries: [] };
    const entries = ((data ?? []) as Icd10MasterRow[]).map(toIcd10MasterEntry);
    entries.forEach(entry => known.set(entry.code, entry));
    return { status: 'ready', entries };
  } catch {
    return { status: 'error', entries: [] };
  }
}

/** The list's entries for these codes (tidied first; codes without the ICD-10 shape are left out), in one query. */
export async function lookupIcd10Codes(codes: readonly string[]): Promise<Icd10Lookup> {
  const wanted = [...new Set(codes.map(code => normalizeIcd10(code ?? '')).filter(isValidIcd10Format))];
  const missing = wanted.filter(code => !known.has(code));
  if (missing.length > 0) {
    if (listMissing) return { status: 'not-set-up', entries: new Map() };
    try {
      for (let start = 0; start < missing.length; start += LOOKUP_CHUNK) {
        const chunk = missing.slice(start, start + LOOKUP_CHUNK);
        const { data, error } = await db.from('icd10_codes').select(ICD10_MASTER_COLUMNS).in('code', chunk);
        if (error) return { status: statusOf(error), entries: new Map() };
        const found = new Map(((data ?? []) as Icd10MasterRow[]).map(row => [row.code, toIcd10MasterEntry(row)]));
        chunk.forEach(code => known.set(code, found.get(code) ?? null));
      }
    } catch {
      return { status: 'error', entries: new Map() };
    }
  }
  const entries = new Map<string, Icd10MasterEntry>();
  wanted.forEach(code => {
    const entry = known.get(code);
    if (entry) entries.set(code, entry);
  });
  return { status: 'ready', entries };
}

/** The entries for these codes when every one was looked up before (no request); null when one was not. */
export function knownIcd10Codes(codes: readonly string[]): Map<string, Icd10MasterEntry> | null {
  const wanted = [...new Set(codes.map(code => normalizeIcd10(code ?? '')).filter(isValidIcd10Format))];
  if (!wanted.every(code => known.has(code))) return null;
  const entries = new Map<string, Icd10MasterEntry>();
  wanted.forEach(code => {
    const entry = known.get(code);
    if (entry) entries.set(code, entry);
  });
  return entries;
}

/** The practice's usual ICD-10 codes (Admin > Tariffs), the ones on most tariff codes first; empty when it has none. */
export function practiceUsualIcd10Codes(practiceId: string | null): Promise<string[]> {
  if (!practiceId) return Promise.resolve([]);
  const cached = usualByPractice.get(practiceId);
  if (cached && Date.now() - cached.at < USUAL_CODES_MAX_AGE_MS) return cached.codes;
  const codes = loadTariffIcd10Defaults(practiceId).then(load => {
    const counts = new Map<string, number>();
    load.defaults.forEach(code => counts.set(code, (counts.get(code) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code);
  });
  usualByPractice.set(practiceId, { at: Date.now(), codes });
  return codes;
}

/** For tests: forget what was looked up and whether the list exists. */
export function forgetIcd10Lookups(): void {
  known.clear();
  usualByPractice.clear();
  listMissing = false;
}
