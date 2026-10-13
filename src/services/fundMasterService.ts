/**
 * The fund master's reads and saves (proposals/2026-10-12-fund-master.sql, parity E10): the funds' claim rules, read
 * once per session and put in force for the claim checks (src/utils/billing/fundRules.ts), and the Medical aid funds
 * screen's data, saves and change history. The rules are in fundRules.ts and fundMaster.ts (tested); this file only
 * reads and writes. Before the tables exist the claim checks keep the built-in rules and the screen says the fund
 * rules are not set up yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fundRulesFromRows, getFundRule, setFundRulesInForce, type FundRule, type FundRuleRow } from '../utils/billing/fundRules';
import { describeFundChange, saveFundRuleArgs, type FundSave } from '../utils/billing/fundMaster';
import {
  SILENT_FUND_SETTING_KEY,
  parseSilentFundDays,
  silentFundDefaults,
  type SilentFundDays
} from '../components/finance/claims/batchFollowUp';

// The generated database types do not know the fund master's tables and functions yet
const db = supabase as unknown as SupabaseClient;

const RULE_COLUMNS =
  'medical_aid_reference, claim_deadline_days, claim_deadline_months, deadline_confirmed, claims_portal_url, membership_digits, membership_hint, dependant_code_required, payment_terms_days, updated_by, updated_at';
const FUND_MASTER_OBJECTS = /\b(medical_aid_fund_rules|medical_aid_fund_rule_changes|practice_fund_notes|save_fund_rule|save_practice_fund_note)\b/i;

export const FUND_MASTER_NOT_SET_UP =
  'The fund rules are not set up in this database yet (proposals/2026-10-12-fund-master.sql); claims use the built-in rules.';

interface DbError {
  code?: string;
  message?: string;
}

/** True when the fund master's tables or functions are not in the database yet (the proposal is not applied). */
export function isFundMasterMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!FUND_MASTER_OBJECTS.test(message ?? '')) return false;
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the (table|function)|does not exist|schema cache/i.test(message ?? '');
}

interface StoredRule extends FundRuleRow {
  updated_by: string | null;
  updated_at: string | null;
}

interface ProviderRow {
  id: string;
  name: string;
  short_name: string | null;
  email: string | null;
  medical_aid_reference: string | null;
  logo_url: string | null;
}

const codeOf = (reference: string | null | undefined): string => (reference ?? '').trim().toUpperCase();

/** The rule rows; null before the table exists. Throws when they cannot be read. */
async function readRuleRows(): Promise<StoredRule[] | null> {
  const { data, error } = await db.from('medical_aid_fund_rules').select(RULE_COLUMNS);
  if (error) {
    if (isFundMasterMissing(error)) return null;
    throw new Error(`Could not read the fund rules: ${error.message}`);
  }
  return (data ?? []) as StoredRule[];
}

/** Puts the rows in force for this session's claim checks; funds the app does not know are named by their provider */
function putInForce(rows: readonly StoredRule[], providers: readonly Pick<ProviderRow, 'name' | 'medical_aid_reference'>[]): void {
  const names = new Map(providers.filter(row => codeOf(row.medical_aid_reference)).map(row => [codeOf(row.medical_aid_reference), row.name] as const));
  setFundRulesInForce(fundRulesFromRows(rows, names));
}

export type FundRulesStatus = 'ready' | 'not_set_up' | 'error';

let inForce: Promise<FundRulesStatus> | null = null;

/**
 * The fund master's rules, read once per session and put in force for the claim checks, claims and remittance
 * screens (the containers await it before they show). Before the table exists the built-in rules stay in force; when
 * the rules cannot be read they stay too, and the next screen that needs them tries again.
 */
export function loadFundRules(): Promise<FundRulesStatus> {
  inForce ??= (async (): Promise<FundRulesStatus> => {
    try {
      const [rows, providers] = await Promise.all([
        readRuleRows(),
        supabase.from('medical_aid_providers').select('name, medical_aid_reference')
      ]);
      if (!rows) return 'not_set_up';
      putInForce(rows, providers.error ? [] : ((providers.data ?? []) as ProviderRow[]));
      return 'ready';
    } catch (error) {
      console.warn('Fund rules could not be read; the built-in rules apply', error);
      inForce = null;
      return 'error';
    }
  })();
  return inForce;
}

/** Reads the rules again (after OneHealth support saved a change), so this session's claim checks use the change */
export function reloadFundRules(): Promise<FundRulesStatus> {
  inForce = null;
  return loadFundRules();
}

export interface PracticeFundNote {
  text: string;
  updatedAt: string | null;
}

export interface FundEntry {
  providerId: string;
  name: string;
  shortName: string | null;
  /** The fund's claim code (medical_aid_reference); null when it has none */
  code: string | null;
  claimsEmail: string | null;
  logoUrl: string | null;
  /** In force for this fund: its row in the table, else the built-in rule (the default when it has no rule) */
  rule: FundRule;
  /** When a person last changed it; null while it holds the values the app used before */
  changedAt: string | null;
  /** The practice's own note on the fund */
  note: PracticeFundNote | null;
}

export interface FundMasterData {
  /** False before proposals/2026-10-12-fund-master.sql is applied: the built-in rules are shown */
  setUp: boolean;
  funds: FundEntry[];
  /** The practice's own waits before "Funds that have not answered" (they win); null when it has not set them */
  practiceWaits: SilentFundDays | null;
  /** Parts that could not be read, in plain words (the rest of the page still works) */
  problems: string[];
}

/** Everything the Medical aid funds screen shows for a practice (notes and waits only when a practice is chosen) */
export async function loadFundMaster(practiceId: string | null): Promise<FundMasterData> {
  const [providers, rows, notes, waits] = await Promise.all([
    supabase.from('medical_aid_providers').select('id, name, short_name, email, medical_aid_reference, logo_url').order('name'),
    readRuleRows(),
    practiceId
      ? db.from('practice_fund_notes').select('medical_aid_reference, note, updated_at').eq('practice_id', practiceId)
      : Promise.resolve({ data: [], error: null }),
    practiceId
      ? supabase.from('practice_settings').select('setting_value').eq('practice_id', practiceId).eq('setting_key', SILENT_FUND_SETTING_KEY).limit(1)
      : Promise.resolve({ data: [], error: null })
  ]);
  // The page says "The medical aid funds could not be loaded:" in front of this (not twice)
  if (providers.error) throw new Error(providers.error.message);
  const providerRows = (providers.data ?? []) as ProviderRow[];
  const problems: string[] = [];

  if (rows) {
    putInForce(rows, providerRows);
    inForce = Promise.resolve('ready');
  }
  const changedAt = new Map((rows ?? []).filter(row => row.updated_by).map(row => [codeOf(row.medical_aid_reference), row.updated_at] as const));

  const noteRows = notes.error ? [] : ((notes.data ?? []) as Array<{ medical_aid_reference: string; note: string; updated_at: string | null }>);
  if (notes.error && !isFundMasterMissing(notes.error)) problems.push(`Your practice's notes could not be read (${notes.error.message}).`);
  const noteByCode = new Map(noteRows.map(row => [codeOf(row.medical_aid_reference), { text: row.note, updatedAt: row.updated_at }] as const));

  let practiceWaits: SilentFundDays | null = null;
  if (waits.error) problems.push(`Your practice's wait before "Funds that have not answered" could not be read (${waits.error.message}).`);
  else if (waits.data?.[0]) practiceWaits = parseSilentFundDays(waits.data[0].setting_value, silentFundDefaults());

  const funds = providerRows.map((row): FundEntry => {
    const code = codeOf(row.medical_aid_reference) || null;
    const rule = getFundRule(code, row.name);
    return {
      providerId: row.id,
      name: row.name,
      shortName: row.short_name,
      code,
      claimsEmail: row.email,
      logoUrl: row.logo_url,
      rule,
      changedAt: (code && changedAt.get(rule.key)) || null,
      note: (code && noteByCode.get(code)) || null
    };
  });
  return { setUp: rows !== null, funds, practiceWaits, problems };
}

const errorFrom = (error: DbError, fallback: string): Error =>
  new Error(isFundMasterMissing(error) ? FUND_MASTER_NOT_SET_UP : error.message || fallback);

/** Saves a fund's details and rules (OneHealth support; save_fund_rule records the change) and puts them in force */
export async function saveFundDetails(providerId: string, save: FundSave): Promise<void> {
  const { error } = await db.rpc('save_fund_rule', saveFundRuleArgs(providerId, save));
  if (error) throw errorFrom(error, 'The fund could not be saved.');
  await reloadFundRules();
}

/** Saves the practice's note on a fund (its administrators); an empty note removes it. Returns the note as saved. */
export async function savePracticeFundNote(practiceId: string, fundCode: string, note: string): Promise<string | null> {
  const { data, error } = await db.rpc('save_practice_fund_note', { p_practice_id: practiceId, p_fund_code: fundCode, p_note: note });
  if (error) throw errorFrom(error, 'The note could not be saved.');
  return typeof data === 'string' ? data : null;
}

export interface FundChange {
  changedAt: string;
  changedBy: string;
  /** "Claim deadline: 120 days to 90 days", one per detail that changed */
  lines: string[];
}

/** The latest changes to a fund (OneHealth support reads them), newest first, with who made them */
export async function loadFundChanges(fundCode: string, limit = 10): Promise<FundChange[]> {
  const { data, error } = await db
    .from('medical_aid_fund_rule_changes')
    .select('changed_at, changed_by, old_values, new_values')
    .eq('medical_aid_reference', fundCode)
    .order('changed_at', { ascending: false })
    .limit(limit);
  if (error) throw errorFrom(error, 'The changes could not be read.');
  const rows = (data ?? []) as Array<{ changed_at: string; changed_by: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> }>;
  const ids = [...new Set(rows.map(row => row.changed_by).filter((id): id is string => Boolean(id)))];
  const { data: people } = ids.length > 0 ? await supabase.from('users').select('id, full_name').in('id', ids) : { data: [] };
  const names = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map(person => [person.id, person.full_name?.trim() || ''] as const));
  return rows.map(row => ({
    changedAt: row.changed_at,
    changedBy: (row.changed_by && names.get(row.changed_by)) || 'OneHealth support',
    lines: describeFundChange(row.old_values, row.new_values)
  }));
}
