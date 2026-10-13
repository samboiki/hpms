/**
 * Database reads and writes for a practice's own tariff list (practice_own_tariffs, parity E13) and its default
 * portion per tariff code (practice_settings tariff_portions, parity D8). The rules live in
 * src/utils/billing/practiceTariffs.ts and lineSplit.ts (tested); this file only loads and saves.
 *
 * loadPracticeTariffRows is the one place the screens get the tariff rows they bill from: the shared list of the
 * practice type with the practice's own codes merged in (its own version wins), each code's default portion and each
 * code's rules (code_rules: authorisation, lab work, time, recall, place of service, linked codes; codeRules.ts). Before
 * proposals/2026-10-09-practice-own-tariffs.sql is applied the own list is empty, so billing is exactly as before; before
 * proposals/2026-10-13-tariff-code-rules.sql no code has rules.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { plainWords } from '../utils/plainErrors';
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';
import { mergeOwnTariffs, ownTariffPayload, withDefaultPortions, type OwnTariffDraft, type OwnTariffRow, type PracticeTariffLike } from '../utils/billing/practiceTariffs';
import { TARIFF_PORTIONS_SETTING_KEY, parseTariffPortions, tariffPortionsSetting, type PaidBy } from '../utils/billing/lineSplit';
import { withCodeRules } from '../utils/billing/codeRules';
import { loadCodeRules, type CodeRulesLoad } from './codeRulesService';

// The generated database types do not know the new table and functions yet
const db = supabase as unknown as SupabaseClient;

const OWN_COLUMNS = 'id, practice_id, code, description, price, can_be_multiplied, requires_tooth_number, effective_from, is_active, updated_at';
const OWN_OBJECTS = /\b(practice_own_tariffs|save_practice_tariff|remove_practice_tariff)\b/i;

interface DbError {
  code?: string;
  message?: string;
}

/** True when the own-tariff table or its functions are not in the database yet (the proposal is not applied). */
export function isOwnTariffsMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!OWN_OBJECTS.test(message ?? '')) return false;
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the (table|function)|does not exist|schema cache/i.test(message ?? '');
}

export interface OwnTariffsLoad {
  rows: OwnTariffRow[];
  /** False until the table exists */
  enabled: boolean;
}

/** Every version of the practice's own codes (active or removed); empty and not enabled before the table exists. */
export async function loadOwnTariffs(practiceId: string | null): Promise<OwnTariffsLoad> {
  if (!practiceId) return { rows: [], enabled: false };
  const { data, error } = await db.from('practice_own_tariffs').select(OWN_COLUMNS).eq('practice_id', practiceId).order('code').order('effective_from');
  if (error) {
    if (isOwnTariffsMissing(error)) return { rows: [], enabled: false };
    throw new Error(`Could not load the practice's own codes: ${error.message}`);
  }
  return { rows: (data ?? []) as OwnTariffRow[], enabled: true };
}

/** Adds the version of a code that starts on the draft's date, or changes it (practice administrators). */
export async function saveOwnTariff(practiceId: string, draft: OwnTariffDraft): Promise<void> {
  const { error } = await db.rpc('save_practice_tariff', ownTariffPayload(practiceId, draft));
  if (error) {
    if (isOwnTariffsMissing(error)) throw new Error("The practice's own codes are not set up yet (proposals/2026-10-09-practice-own-tariffs.sql).");
    throw new Error(error.message || 'The code could not be saved.');
  }
}

/** Switches the practice's own code off: the shared price, if the code has one, applies again. */
export async function removeOwnTariff(practiceId: string, code: string): Promise<void> {
  const { error } = await db.rpc('remove_practice_tariff', { p_practice_id: practiceId, p_code: code });
  if (error) throw new Error(error.message || 'The code could not be removed.');
}

/** The practice's default portion per tariff code; none when not set or unreadable (lines then follow the fund's rules). */
export async function loadTariffPortions(practiceId: string | null): Promise<{ portions: Map<string, PaidBy>; error: string | null }> {
  if (!practiceId) return { portions: new Map(), error: null };
  const { data, error } = await supabase
    .from('practice_settings')
    .select('setting_value')
    .eq('practice_id', practiceId)
    .eq('setting_key', TARIFF_PORTIONS_SETTING_KEY)
    .limit(1);
  if (error) return { portions: new Map(), error: error.message };
  return { portions: parseTariffPortions(data?.[0]?.setting_value ?? null), error: null };
}

/** Saves the default portions (practice administrators; RLS decides). */
export async function saveTariffPortions(practiceId: string, portions: ReadonlyMap<string, PaidBy>): Promise<void> {
  const { error } = await supabase.from('practice_settings').upsert(
    {
      practice_id: practiceId,
      setting_key: TARIFF_PORTIONS_SETTING_KEY,
      setting_value: tariffPortionsSetting(portions) as unknown as Json,
      setting_type: 'json',
      description: 'Who pays new lines of a tariff code: the medical aid all of it, or the patient all of it (never claimed)',
      is_public: false
    },
    { onConflict: 'practice_id,setting_key' }
  );
  if (error) throw new Error(`Could not save who pays the code: ${error.message}`);
}

export interface PracticeTariffRowsLoad {
  rows: PracticeTariffLike[];
  /** Parts that could not be read, in plain words (billing still works on the shared list) */
  problems: string[];
}

/**
 * The tariff rows a practice bills from (see the file comment), as the visit screens, quotes and the Tariffs page
 * read them. `columns` are the practice_tariffs_with_types columns to read ('*' by default).
 */
export async function loadPracticeTariffRows(practiceId: string | null, practiceType: string, columns = '*'): Promise<PracticeTariffRowsLoad> {
  const problems: string[] = [];
  const [shared, own, portions, rules] = await Promise.all([
    supabase.from('practice_tariffs_with_types').select(columns).eq('practice_type_name', practiceType).order('code', { ascending: true }),
    loadOwnTariffs(practiceId).catch((error: unknown) => {
      problems.push(`${error instanceof Error ? plainWords(error.message) : "The practice's own codes could not be read"}; the shared tariff list is used.`);
      return { rows: [], enabled: false } as OwnTariffsLoad;
    }),
    loadTariffPortions(practiceId),
    loadCodeRules(practiceId).catch(
      (error: unknown): CodeRulesLoad => ({ status: 'error', rules: new Map(), message: error instanceof Error ? plainWords(error.message) : 'The code rules could not be read' })
    )
  ]);
  if (shared.error) throw new Error(`Could not load the tariff list: ${shared.error.message}`);
  if (portions.error) problems.push(`Who pays each code could not be read (${portions.error}); lines follow the fund's rules.`);
  if (rules.status === 'error') problems.push(`${rules.message}; codes are billed without their rules.`);
  const sharedRows = ((shared.data ?? []) as unknown as PracticeTariffLike[]).filter(row => Boolean(row.id && row.code));
  return { rows: withCodeRules(withDefaultPortions(mergeOwnTariffs(sharedRows, own.rows), portions.portions), rules.rules), problems };
}
