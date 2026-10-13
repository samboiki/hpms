/**
 * The practice's default period for the Practice Overhead tiles (src/components/settings/overheadPeriod.ts): one
 * practice_settings row, as the document and claim settings are. Every staff member reads it; the table's policies let
 * only administrators change it.
 */
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';
import { OVERHEAD_PERIOD_SETTING_KEY, parseOverheadPeriod, type OverheadPeriodKind } from '../components/settings/overheadPeriod';
import { plainErrorMessage } from '../utils/plainErrors';

/** The saved default; this month when none is saved or it cannot be read (the tiles never wait on it) */
export async function loadOverheadDefaultPeriod(practiceId: string): Promise<OverheadPeriodKind> {
  try {
    const { data, error } = await supabase
      .from('practice_settings')
      .select('setting_value')
      .eq('practice_id', practiceId)
      .eq('setting_key', OVERHEAD_PERIOD_SETTING_KEY)
      .limit(1);
    if (error) {
      console.warn('[OneHealth] overhead default period not read:', error);
      return 'month';
    }
    return parseOverheadPeriod(data?.[0]?.setting_value ?? null);
  } catch (error) {
    console.warn('[OneHealth] overhead default period not read:', error);
    return 'month';
  }
}

/** Saves it (practice administrators: the database refuses anyone else, said in plain words) */
export async function saveOverheadDefaultPeriod(practiceId: string, period: OverheadPeriodKind): Promise<void> {
  const { error } = await supabase.from('practice_settings').upsert(
    {
      practice_id: practiceId,
      setting_key: OVERHEAD_PERIOD_SETTING_KEY,
      setting_value: { period } as unknown as Json,
      setting_type: 'json',
      description: 'Practice Overhead: the period the expense tiles open on (month, financial_year or all)',
      is_public: false
    },
    { onConflict: 'practice_id,setting_key' }
  );
  if (error) throw new Error(plainErrorMessage(error, 'The default period was not saved'));
}
