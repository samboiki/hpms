/**
 * A practice's usual ICD-10 code per tariff code (parity E8; proposals/2026-10-08-tariff-icd10-defaults.sql). The
 * visit's Billing tab and the tariff screen read them; practice administrators change them through
 * set_tariff_icd10_default, which checks the role in the database. Before the table exists nothing can be saved and
 * the tariff screen says so; billing keeps working with the built-in suggestions (src/utils/billing/icd10Defaults.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { plainWords } from '../utils/plainErrors';
import { supabase } from '../lib/supabase';
import { isNotSetUpError } from './invoicingSetup';
import { normalizeIcd10 } from '../utils/billing/icd10';
import { tariffCodeKey, toTariffIcd10Defaults } from '../utils/billing/icd10Defaults';

// The generated database types do not know the new table and function yet
const db = supabase as unknown as SupabaseClient;

export interface Icd10DefaultsLoad {
  /** not-set-up: the database update is not applied yet */
  status: 'ready' | 'not-set-up' | 'error';
  /** Tariff code -> ICD-10 code */
  defaults: Map<string, string>;
  /** What went wrong, in plain words (status 'error') */
  message: string | null;
}

/** The practice's usual ICD-10 codes; never throws, so billing works without them. */
export async function loadTariffIcd10Defaults(practiceId: string | null): Promise<Icd10DefaultsLoad> {
  if (!practiceId) return { status: 'ready', defaults: new Map(), message: null };
  try {
    const { data, error } = await db.from('tariff_icd10_defaults').select('tariff_code, icd10_code').eq('practice_id', practiceId);
    if (error) {
      if (isNotSetUpError(error)) return { status: 'not-set-up', defaults: new Map(), message: null };
      return { status: 'error', defaults: new Map(), message: `The practice's usual ICD-10 codes could not be read: ${error.message}` };
    }
    return { status: 'ready', defaults: toTariffIcd10Defaults((data ?? []) as { tariff_code: string | null; icd10_code: string | null }[]), message: null };
  } catch (error) {
    return { status: 'error', defaults: new Map(), message: `The practice's usual ICD-10 codes could not be read: ${error instanceof Error ? plainWords(error.message) : 'unknown error'}` };
  }
}

/** Sets the practice's usual ICD-10 code for one tariff code, or removes it (null or empty). Throws in plain words. */
export async function saveTariffIcd10Default(practiceId: string, tariffCode: string, icd10Code: string | null): Promise<void> {
  const { error } = await db.rpc('set_tariff_icd10_default', {
    p_practice_id: practiceId,
    p_tariff_code: tariffCodeKey(tariffCode),
    p_icd10_code: icd10Code?.trim() ? normalizeIcd10(icd10Code) : null
  });
  if (!error) return;
  if (isNotSetUpError(error)) throw new Error('Usual ICD-10 codes can be saved once the database update is applied.');
  throw new Error(error.message || 'The usual ICD-10 code could not be saved.');
}
