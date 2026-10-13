import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';
import { isNotSetUpError } from './invoicingSetup';
import {
  STANDARD_HOURS_SETTING_KEY,
  parseStandardHours,
  standardHoursProblem,
  type StandardHours
} from '../utils/hr/standardHours';

// Untyped: these tables and columns are newer than the generated types (src/types/database.types.ts)
const db = supabase as unknown as SupabaseClient;

export type StandardHoursLoad =
  | { status: 'ready'; hours: StandardHours | null }
  | { status: 'not_set_up' }
  | { status: 'error'; message: string };

/** The practice's saved standard day (null: none saved, so only the Labour Act decides overtime) */
export async function loadStandardHours(practiceId: string): Promise<StandardHoursLoad> {
  const { data, error } = await db
    .from('practice_settings')
    .select('setting_value')
    .eq('practice_id', practiceId)
    .eq('setting_key', STANDARD_HOURS_SETTING_KEY)
    .limit(1);
  if (error) {
    if (isNotSetUpError(error)) return { status: 'not_set_up' };
    console.error('Standard hours could not be loaded', error);
    return { status: 'error', message: 'The practice\'s standard hours could not be loaded.' };
  }
  return { status: 'ready', hours: parseStandardHours(data?.[0]?.setting_value ?? null) };
}

/** The standard day, or null when none is saved or it cannot be read (payroll then uses the Labour Act alone) */
export async function standardHoursOrNull(practiceId: string | null | undefined): Promise<StandardHours | null> {
  if (!practiceId) return null;
  const result = await loadStandardHours(practiceId);
  return result.status === 'ready' ? result.hours : null;
}

/** Saves the practice's standard day (the practice_settings policies let its administrators write it) */
export async function saveStandardHours(practiceId: string, hours: StandardHours): Promise<{ ok: true } | { ok: false; message: string }> {
  const problem = standardHoursProblem(hours);
  if (problem) return { ok: false, message: problem };
  const { data, error } = await db
    .from('practice_settings')
    .upsert(
      {
        practice_id: practiceId,
        setting_key: STANDARD_HOURS_SETTING_KEY,
        setting_value: { start: hours.start, end: hours.end } as unknown as Json,
        setting_type: 'json',
        description: 'Timesheets and payroll: the standard working day; hours above it are overtime',
        is_public: false
      },
      { onConflict: 'practice_id,setting_key' }
    )
    .select('practice_id');
  if (error || !data || data.length === 0) {
    console.error('Standard hours could not be saved', error);
    return {
      ok: false,
      message: isNotSetUpError(error)
        ? 'Practice settings are not set up yet, so the standard hours cannot be saved.'
        : 'The standard hours could not be saved. Only practice administrators can change them.'
    };
  }
  return { ok: true };
}
