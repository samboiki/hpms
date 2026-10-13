/**
 * Database reads and writes for fund tariff schedules (fund_tariffs, fund_tariff_contracts) and the practice's
 * 8109 staff count. The pricing rules live in src/utils/billing/fundPricing.ts (tested); this file only loads and
 * saves.
 *
 * The tables come from proposals/2026-10-07-fund-tariffs.sql. Until it is applied the tables are missing: the price
 * book is then empty, so every patient is billed the practice tariff exactly as before, with no error shown.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  EMPTY_PRICE_BOOK,
  resolveFundReference,
  type FundContractRow,
  type FundPriceBook,
  type FundProviderRow,
  type FundTariffRow,
  type PatientFundKey
} from '../utils/billing/fundPricing';
import { getFundRule } from '../utils/billing/fundRules';
import { DEFAULT_INFECTION_CONTROL_STAFF, infectionControlStaffCount } from '../utils/billing/tariffRules';

// The generated database types do not know the new tables yet, so they are read with the untyped client
const db = supabase as unknown as SupabaseClient;

export const INFECTION_CONTROL_STAFF_SETTING = 'infection_control_staff';

const FUND_OBJECTS = /\b(fund_tariffs|fund_tariffs_with_types|fund_tariff_contracts)\b/i;

interface DbError {
  code?: string;
  message?: string;
}

/** True when the fund schedule tables are not in the database yet (the proposal is not applied). */
export function isFundTablesMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  // Only our own objects: any other missing table is a real error
  if (!FUND_OBJECTS.test(message ?? '')) return false;
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST200') return true;
  return /could not find the table|does not exist|schema cache/i.test(message ?? '');
}

const ROW_COLUMNS = 'id, practice_id, fund_reference, plan_option, code, description, unit_price, effective_from, effective_to, is_active';
const CONTRACT_COLUMNS = 'id, practice_id, fund_reference, plan_option, base_fund_reference, percent, effective_from, effective_to, is_active, notes';

export interface PriceBookLoad {
  book: FundPriceBook;
  /** False until the fund tables exist */
  enabled: boolean;
  /** Set when the tables exist but could not be read: fund prices are unknown */
  error: string | null;
}

/**
 * The fund prices of a practice: its practice type's fund_tariffs rows (shared and its own) and its contracts. Rows of
 * other practices are dropped here as well as by RLS.
 */
export async function loadFundPriceBook(practiceId: string | null, practiceType: string | null): Promise<PriceBookLoad> {
  if (!practiceType?.trim()) return { book: EMPTY_PRICE_BOOK, enabled: false, error: null };
  const [rows, contracts] = await Promise.all([
    db.from('fund_tariffs_with_types').select(ROW_COLUMNS).eq('practice_type_name', practiceType.trim()),
    practiceId
      ? db.from('fund_tariff_contracts').select(CONTRACT_COLUMNS).eq('practice_id', practiceId)
      : Promise.resolve({ data: [] as FundContractRow[], error: null })
  ]);
  const failure = rows?.error ?? contracts?.error ?? (rows && contracts ? null : { message: 'no answer from the database' });
  if (failure) {
    if (isFundTablesMissing(failure)) return { book: EMPTY_PRICE_BOOK, enabled: false, error: null };
    return { book: EMPTY_PRICE_BOOK, enabled: true, error: failure.message || 'unknown error' };
  }
  const ownOrShared = (row: { practice_id?: string | null }) => (row.practice_id ?? null) === null || row.practice_id === practiceId;
  return {
    book: {
      rows: ((rows.data ?? []) as FundTariffRow[]).filter(ownOrShared),
      contracts: ((contracts.data ?? []) as FundContractRow[]).filter(contract => contract.practice_id === practiceId)
    },
    enabled: true,
    error: null
  };
}

/** A fund known by its name in the deadline rules (e.g. "PSEMAS" is MAG1 on claims). */
const knownFundCode = (providerName: string): string | null => {
  const rule = getFundRule(null, providerName);
  return rule.configured ? rule.references[0] ?? null : null;
};

export interface PatientFundLoad {
  /** null when the medical aid record could not be read */
  hasMedicalAid: boolean | null;
  /** null: no medical aid, or the record could not be read */
  fund: PatientFundKey | null;
  error: string | null;
}

/**
 * The patient's fund for pricing: the first medical_aid_details record (the one invoiceService checks), its fund
 * code (provider id, provider name, or a known fund name) and its plan option and scheme names.
 */
export async function loadPatientFundKey(source: { patientId?: string | null; medicalAidDetailsId?: string | null }): Promise<PatientFundLoad> {
  if (!source.patientId && !source.medicalAidDetailsId) return { hasMedicalAid: false, fund: null, error: null };
  try {
    let query = supabase.from('medical_aid_details').select('id, provider, scheme, plan_type, medical_aid_provider_id');
    query = source.medicalAidDetailsId ? query.eq('id', source.medicalAidDetailsId) : query.eq('patient_id', source.patientId as string);
    const { data, error } = await query.limit(1);
    if (error) return { hasMedicalAid: null, fund: null, error: error.message };
    const record = data?.[0];
    if (!record) return { hasMedicalAid: false, fund: null, error: null };
    const { data: providers, error: providerError } = await supabase
      .from('medical_aid_providers')
      .select('id, name, short_name, medical_aid_reference');
    if (providerError) return { hasMedicalAid: true, fund: null, error: providerError.message };
    const providerRows = (providers ?? []) as FundProviderRow[];
    const reference = resolveFundReference(record, providerRows, knownFundCode);
    const provider = providerRows.find(row => row.id === record.medical_aid_provider_id);
    return {
      hasMedicalAid: true,
      fund: {
        reference,
        planOptions: [record.plan_type, record.scheme].filter((value): value is string => Boolean(value?.trim())),
        name: provider?.name?.trim() || record.provider?.trim() || null
      },
      error: null
    };
  } catch (error) {
    return { hasMedicalAid: null, fund: null, error: error instanceof Error ? error.message : 'unknown error' };
  }
}

/** The practice's 8109 clinical staff count (practice_settings); one staff member when it is not set or unreadable. */
export async function loadInfectionControlStaff(practiceId: string | null): Promise<number> {
  if (!practiceId) return DEFAULT_INFECTION_CONTROL_STAFF;
  try {
    const result = await supabase
      .from('practice_settings')
      .select('setting_value')
      .eq('practice_id', practiceId)
      .eq('setting_key', INFECTION_CONTROL_STAFF_SETTING)
      .limit(1);
    if (!result || result.error) return DEFAULT_INFECTION_CONTROL_STAFF;
    return infectionControlStaffCount(result.data?.[0]?.setting_value ?? null);
  } catch {
    // The setting is only a default: staff can still change the quantity on the line
    return DEFAULT_INFECTION_CONTROL_STAFF;
  }
}

// -------------------------------------------------------------------------------------------------------------------
// Administration (Tariffs page)
// -------------------------------------------------------------------------------------------------------------------

/** A fund_tariffs row as the Tariffs page lists it. */
export interface FundTariffRecord extends FundTariffRow {
  id: string;
  source?: string | null;
}

export interface FundContractRecord extends FundContractRow {
  id: string;
  notes?: string | null;
}

/** Every fund_tariffs row of a practice type the user may see (all versions, for the schedule view). */
export async function loadFundTariffRecords(practiceType: string): Promise<{ rows: FundTariffRecord[]; enabled: boolean }> {
  const { data, error } = await db
    .from('fund_tariffs_with_types')
    .select(`${ROW_COLUMNS}, source`)
    .eq('practice_type_name', practiceType)
    .order('code', { ascending: true });
  if (error) {
    if (isFundTablesMissing(error)) return { rows: [], enabled: false };
    throw new Error(`Could not load the fund schedules: ${error.message}`);
  }
  return { rows: (data ?? []) as FundTariffRecord[], enabled: true };
}

export async function loadFundContractRecords(practiceId: string): Promise<FundContractRecord[]> {
  const { data, error } = await db.from('fund_tariff_contracts').select(CONTRACT_COLUMNS).eq('practice_id', practiceId).order('effective_from');
  if (error) {
    if (isFundTablesMissing(error)) return [];
    throw new Error(`Could not load the contracts: ${error.message}`);
  }
  return (data ?? []) as FundContractRecord[];
}

/** The id of a practice type by its name (practices.practice_type holds the name). */
export async function loadPracticeTypeId(practiceType: string): Promise<string | null> {
  const { data, error } = await supabase.from('practice_types').select('id, name');
  if (error) throw new Error(`Could not read the practice types: ${error.message}`);
  const wanted = practiceType.trim().toLowerCase();
  return (data ?? []).find(type => (type.name ?? '').trim().toLowerCase() === wanted)?.id ?? null;
}

export interface NewFundTariff {
  practice_type_id: string;
  practice_id: string | null;
  fund_reference: string;
  plan_option: string | null;
  code: string;
  description: string | null;
  unit_price: number;
  effective_from: string;
  effective_to: string | null;
  source: string | null;
}

const CHUNK = 200;

/** Inserts imported fund prices in chunks; returns how many were saved. */
export async function insertFundTariffs(rows: readonly NewFundTariff[]): Promise<number> {
  let saved = 0;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const { error } = await db.from('fund_tariffs').insert(chunk);
    if (error) {
      if (isFundTablesMissing(error)) throw new Error('Fund schedules are not switched on yet (proposals/2026-10-07-fund-tariffs.sql).');
      throw new Error(`Saved ${saved} of ${rows.length} prices, then the database refused the rest: ${error.message}`);
    }
    saved += chunk.length;
  }
  return saved;
}

/** Ends fund prices on a date (they stay as history for older visits). */
export async function endFundTariffs(ids: readonly string[], endDate: string): Promise<void> {
  for (let start = 0; start < ids.length; start += CHUNK) {
    const { error } = await db.from('fund_tariffs').update({ effective_to: endDate }).in('id', ids.slice(start, start + CHUNK));
    if (error) throw new Error(`Could not end the prices: ${error.message}`);
  }
}

export interface NewPracticeTariff {
  practice_type_id: string;
  code: string;
  description: string | null;
  price: number;
  unit: string | null;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  can_be_multiplied: string;
  requires_tooth_number: string;
  business_rule_formula: string | null;
  example_calculation: string | null;
  notes: string | null;
}

/**
 * Adds a new version of the practice tariff (e.g. next year's NAMAF benchmark) from its start date. Existing rows are
 * never changed: older visits keep the prices of their date.
 */
export async function insertPracticeTariffVersions(rows: readonly NewPracticeTariff[]): Promise<number> {
  let saved = 0;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const { error } = await supabase.from('practice_tariffs').insert(chunk);
    if (error) throw new Error(`Saved ${saved} of ${rows.length} tariff codes, then the database refused the rest: ${error.message}`);
    saved += chunk.length;
  }
  return saved;
}

export interface NewFundContract {
  practice_id: string;
  fund_reference: string;
  plan_option: string | null;
  base_fund_reference: string | null;
  percent: number;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

export async function insertFundContract(contract: NewFundContract): Promise<void> {
  const { error } = await db.from('fund_tariff_contracts').insert(contract);
  if (error) {
    if (isFundTablesMissing(error)) throw new Error('Fund contracts are not switched on yet (proposals/2026-10-07-fund-tariffs.sql).');
    throw new Error(`Could not save the contract: ${error.message}`);
  }
}

export async function endFundContract(id: string, endDate: string): Promise<void> {
  const { error } = await db.from('fund_tariff_contracts').update({ effective_to: endDate }).eq('id', id);
  if (error) throw new Error(`Could not end the contract: ${error.message}`);
}

/** The practice's 8109 staff count setting (practice admins). */
export async function saveInfectionControlStaff(practiceId: string, staffCount: number): Promise<void> {
  const { error } = await supabase.from('practice_settings').upsert(
    {
      practice_id: practiceId,
      setting_key: INFECTION_CONTROL_STAFF_SETTING,
      setting_value: infectionControlStaffCount(staffCount),
      setting_type: 'number',
      description: '8109 infection control: clinical staff billed per visit (1-3)',
      is_public: false
    },
    { onConflict: 'practice_id,setting_key' }
  );
  if (error) throw new Error(`Could not save the infection control setting: ${error.message}`);
}
