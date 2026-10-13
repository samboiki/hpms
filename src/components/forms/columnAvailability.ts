import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { isMissingColumnError } from '../../utils/diary/dbErrors';

// Untyped: the generated types do not know a column before its proposal is applied
const untypedDb = supabase as unknown as SupabaseClient;

/**
 * Whether optional columns a proposal adds already exist (e.g. medical_aid_details.dependant_code, patients.title and
 * initials). The forms show and save such fields only when they do, so a save never fails before the SQL is applied.
 * One cheap select per page load; an unclear answer (no connection) is asked again next time instead of remembered.
 */
const cache = new Map<string, Promise<boolean>>();

/** True when every one of `columns` (comma-separated, as in a select) exists on `table`. */
export function hasColumns(table: string, columns: string): Promise<boolean> {
  const key = `${table}:${columns}`;
  let answer = cache.get(key);
  if (!answer) {
    answer = (async () => {
      try {
        const { error } = await untypedDb.from(table).select(columns).limit(1);
        if (!error) return true;
        if (!isMissingColumnError(error)) cache.delete(key);
        return false;
      } catch {
        cache.delete(key);
        return false;
      }
    })();
    cache.set(key, answer);
  }
  return answer;
}

/** For tests: forget the answer for these columns. */
export function resetColumnCheck(table: string, columns: string): void {
  cache.delete(`${table}:${columns}`);
}

/** True once the columns are known to exist; false before (and while checking). */
export function useColumnsAvailable(table: string, columns: string): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void hasColumns(table, columns).then(result => {
      if (active) setAvailable(result);
    });
    return () => {
      active = false;
    };
  }, [table, columns]);
  return available;
}
