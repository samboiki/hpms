/**
 * Database reads and writes for the practice's rules per tariff code (practice_tariff_rules, parity E9, D13, O2) and
 * the yearly increase of its prices (apply_practice_tariff_increase, parity E3): proposals/2026-10-13-tariff-code-rules.sql.
 * The rules live in src/utils/billing/codeRules.ts and tariffIncrease.ts (tested); this file only loads and saves.
 * Before the proposal is applied, the rules read as none ("not set up yet") and billing works as before.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { codeRulesMap, codeRulesPayload, type CodeRules, type CodeRulesRow } from '../utils/billing/codeRules';
import { increasePayload, type IncreaseItem } from '../utils/billing/tariffIncrease';

// The generated database types do not know the new table and functions yet
const db = supabase as unknown as SupabaseClient;

const RULE_COLUMNS = 'code, needs_authorisation, lab_work, time_based, recall_months, recall_reason, place_of_service, linked_codes';
const RULE_OBJECTS = /\b(practice_tariff_rules|save_practice_tariff_rules|apply_practice_tariff_increase)\b/i;

interface DbError {
  code?: string;
  message?: string;
}

/** True when the rules table or its functions are not in the database yet (the proposal is not applied). */
export function isCodeRulesMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!RULE_OBJECTS.test(message ?? '')) return false;
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the (table|function)|does not exist|schema cache/i.test(message ?? '');
}

export type CodeRulesLoad =
  | { status: 'ready'; rules: Map<string, CodeRules> }
  | { status: 'not-set-up'; rules: Map<string, CodeRules> }
  | { status: 'error'; rules: Map<string, CodeRules>; message: string };

/** The practice's rules by code; none (with why) when they cannot be read. */
export async function loadCodeRules(practiceId: string | null): Promise<CodeRulesLoad> {
  if (!practiceId) return { status: 'ready', rules: new Map() };
  const { data, error } = await db.from('practice_tariff_rules').select(RULE_COLUMNS).eq('practice_id', practiceId);
  if (error) {
    if (isCodeRulesMissing(error)) return { status: 'not-set-up', rules: new Map() };
    return { status: 'error', rules: new Map(), message: `Could not read what happens when codes are billed: ${error.message}` };
  }
  return { status: 'ready', rules: codeRulesMap((data ?? []) as CodeRulesRow[]) };
}

/** Saves one code's rules (practice administrators); rules with nothing set remove the code's row. */
export async function saveCodeRules(practiceId: string, code: string, rules: CodeRules): Promise<void> {
  const { error } = await db.rpc('save_practice_tariff_rules', { p_practice_id: practiceId, p_code: code, p_rules: codeRulesPayload(rules) });
  if (error) {
    if (isCodeRulesMissing(error)) throw new Error('What happens when a code is billed is not set up yet (proposals/2026-10-13-tariff-code-rules.sql).');
    throw new Error(error.message || 'The rules could not be saved.');
  }
}

/** Saves the new prices of the codes ticked, all from one date, in one step; returns how many codes changed. */
export async function applyTariffIncrease(practiceId: string, fromDate: string, items: readonly IncreaseItem[]): Promise<number> {
  const { data, error } = await db.rpc('apply_practice_tariff_increase', {
    p_practice_id: practiceId,
    p_from: fromDate,
    p_items: increasePayload(items)
  });
  if (error) {
    if (isCodeRulesMissing(error)) throw new Error('The yearly increase is not set up yet (proposals/2026-10-13-tariff-code-rules.sql).');
    throw new Error(error.message || 'The new prices could not be saved.');
  }
  return typeof data === 'number' ? data : 0;
}
