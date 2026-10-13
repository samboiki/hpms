/**
 * The one ICD-10 code search (parity E14) for every screen that chooses a code: the options under the code box while a
 * practitioner types (the line's suggested codes and the practice's usual codes first), and the descriptions and flags
 * of codes already chosen. Nothing is read until the box is used or a code is shown.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { knownIcd10Codes, lookupIcd10Codes, practiceUsualIcd10Codes, searchIcd10Codes, type Icd10ListStatus } from '../services/icd10Service';
import { isValidIcd10Format, normalizeIcd10 } from '../utils/billing/icd10';
import { ICD10_SEARCH_MIN_LENGTH, icd10Options, type Icd10MasterEntry, type Icd10Option } from '../utils/billing/icd10Master';

const SEARCH_DELAY_MS = 200;
const LOOKUP_DELAY_MS = 150;
const NO_CODES: readonly string[] = [];
const NO_ENTRIES: ReadonlyMap<string, Icd10MasterEntry> = new Map();

export interface Icd10Entries {
  /** loading: the look-up is under way (or waits for typing to pause) */
  status: 'loading' | Icd10ListStatus;
  entries: ReadonlyMap<string, Icd10MasterEntry>;
}

const READY_EMPTY: Icd10Entries = { status: 'ready', entries: NO_ENTRIES };

/** The list's entries for these codes (descriptions and flags); codes without the ICD-10 shape are left out. */
export function useIcd10Entries(codes: readonly string[], enabled = true): Icd10Entries {
  const key = [...new Set(codes.map(code => normalizeIcd10(code ?? '')).filter(isValidIcd10Format))].sort().join(' ');
  const [state, setState] = useState<{ key: string; result: Icd10Entries }>({ key: '', result: READY_EMPTY });

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void lookupIcd10Codes(key.split(' ')).then(lookup => {
        if (!cancelled) setState({ key, result: lookup });
      });
    }, LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, enabled]);

  return useMemo<Icd10Entries>(() => {
    if (!enabled || !key) return READY_EMPTY;
    if (state.key === key) return state.result;
    // Codes looked up before are known at once, so claim review does not flicker while a code is edited
    const known = knownIcd10Codes(key.split(' '));
    return known ? { status: 'ready', entries: known } : { status: 'loading', entries: state.result.entries };
  }, [enabled, key, state]);
}

export interface Icd10SearchState {
  options: Icd10Option[];
  /** idle: too little typed to search; searching; ready; not-set-up: the list is not in this database yet; error */
  status: 'idle' | 'searching' | Icd10ListStatus;
}

/** What the code search shows for `query` while `enabled` (the box is open). */
export function useIcd10Search(
  query: string,
  { enabled, suggestedCodes = NO_CODES }: { enabled: boolean; suggestedCodes?: readonly string[] }
): Icd10SearchState {
  const practiceId = useAuthStore(state => state.selectedPracticeId || state.user?.practice_id || null);
  const [usual, setUsual] = useState<string[]>([]);
  const [search, setSearch] = useState<{ query: string; status: Icd10SearchState['status']; entries: Icd10MasterEntry[] }>({
    query: '',
    status: 'idle',
    entries: []
  });
  const text = query.trim();
  const searchable = text.length >= ICD10_SEARCH_MIN_LENGTH;

  // The practice's usual codes, once the box is opened
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void practiceUsualIcd10Codes(practiceId).then(codes => {
      if (!cancelled) setUsual(codes);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, practiceId]);

  // The list, once typing pauses
  useEffect(() => {
    if (!enabled || !searchable) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchIcd10Codes(text).then(result => {
        if (!cancelled) setSearch({ query: text, status: result.status, entries: result.entries });
      });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, enabled, searchable]);

  const suggestionCodes = useMemo(
    () => [...new Set([...suggestedCodes, ...usual].map(code => normalizeIcd10(code)).filter(isValidIcd10Format))],
    [suggestedCodes, usual]
  );
  const described = useIcd10Entries(suggestionCodes, enabled);

  return useMemo<Icd10SearchState>(() => {
    const suggestions = suggestionCodes.map(code => ({ code, entry: described.entries.get(code) ?? null, suggested: true }));
    if (!searchable) {
      // One letter: the suggestions whose code starts with it
      const start = text.toUpperCase();
      return { options: icd10Options('', start ? suggestions.filter(option => option.code.startsWith(start)) : suggestions, []), status: 'idle' };
    }
    const current = search.query === text;
    return { options: icd10Options(text, suggestions, current ? search.entries : []), status: current ? search.status : 'searching' };
  }, [suggestionCodes, described.entries, searchable, search, text]);
}
