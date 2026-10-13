/**
 * A patient's price rate (parity R28): read from public.patient_price_rates and written only through
 * set_patient_price_rate() (proposals/2026-10-13-patient-price-rates.sql). The rules are in
 * src/utils/billing/patientRates.ts. Before the proposal is applied every patient reads as having no rate (priced as
 * before) and saving says price rates are not set up yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { plainWords } from '../utils/plainErrors';
import { supabase } from '../lib/supabase';
import { patientRateFromRow, type PatientRate } from '../utils/billing/patientRates';

// The generated database types do not include the table and function yet
const db = supabase as unknown as SupabaseClient;

const RATE_OBJECTS = /\b(patient_price_rates|set_patient_price_rate)\b/i;

interface DbError {
  code?: string;
  message?: string;
}

/** True when the table or the function is not in the database yet (only ours: any other error is real). */
export function isPatientRatesNotSetUp(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!RATE_OBJECTS.test(message ?? '')) return false;
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the (table|function)|does not exist|schema cache/i.test(message ?? '');
}

export type PatientRateLoad =
  | { status: 'ready'; rate: PatientRate | null; setAt: string | null }
  | { status: 'not_set_up'; rate: null; setAt: null }
  | { status: 'error'; rate: null; setAt: null; message: string };

/**
 * The patient's rate (null: none); 'not_set_up' before the proposal is applied, 'error' when it cannot be read. Never
 * throws: the billing screens decide what an unreadable rate means.
 */
export async function loadPatientRate(patientId: string | null | undefined): Promise<PatientRateLoad> {
  if (!patientId) return { status: 'ready', rate: null, setAt: null };
  try {
    const { data, error } = await db.from('patient_price_rates').select('kind, percent, set_at').eq('patient_id', patientId).maybeSingle();
    if (error) {
      if (isPatientRatesNotSetUp(error)) return { status: 'not_set_up', rate: null, setAt: null };
      return { status: 'error', rate: null, setAt: null, message: error.message || "The patient's price rate could not be read." };
    }
    const row = data as { kind?: unknown; percent?: unknown; set_at?: string | null } | null;
    return { status: 'ready', rate: patientRateFromRow(row), setAt: row?.set_at ?? null };
  } catch (error) {
    return { status: 'error', rate: null, setAt: null, message: error instanceof Error ? plainWords(error.message) : "The patient's price rate could not be read." };
  }
}

/** Sets the patient's rate, or removes it (null): practice administrators and practitioners. */
export async function savePatientRate(practiceId: string, patientId: string, rate: PatientRate | null): Promise<void> {
  const { error } = await db.rpc('set_patient_price_rate', {
    p_practice_id: practiceId,
    p_patient_id: patientId,
    p_kind: rate?.kind ?? null,
    p_percent: rate?.percent ?? null
  });
  if (error) {
    if (isPatientRatesNotSetUp(error)) throw new Error('Price rates are not set up in this database yet.');
    throw new Error(error.message || "The patient's price rate could not be saved.");
  }
}
