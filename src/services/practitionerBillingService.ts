/**
 * Each practitioner's own practice number and rate (parity D31): practitioner_billing,
 * proposals/2026-10-12-line-teeth-and-billing-practitioners.sql. Staff of the practice read its rows; only its
 * administrators change them, through set_practitioner_billing. Before the update exists every line is billed under
 * the practice's number at the price list, as before, and the settings say "not set up yet".
 * The rules themselves are in src/utils/billing/practitionerBilling.ts (tested).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { plainWords } from '../utils/plainErrors';
import { supabase } from '../lib/supabase';
import {
  NO_PRACTITIONER_BILLING,
  practitionerBillingFromRows,
  type PractitionerBilling,
  type PractitionerBillingMap,
  type PractitionerBillingRow
} from '../utils/billing/practitionerBilling';
import { isNotSetUpError } from './invoicingSetup';

// The generated database types do not know the table yet
const db = supabase as unknown as SupabaseClient;

export type PractitionerBillingLoad =
  | { status: 'ready'; billing: PractitionerBillingMap }
  | { status: 'not_set_up'; billing: PractitionerBillingMap }
  | { status: 'error'; message: string; billing: PractitionerBillingMap };

export const PRACTITIONER_BILLING_NOT_SET_UP =
  'Billing per practitioner is not set up yet: every line is billed under the practice number at the price list.';

/** The practice's practitioners with an own practice number or rate; empty (the practice's number, the list) otherwise. */
export async function loadPractitionerBilling(practiceId: string | null): Promise<PractitionerBillingLoad> {
  if (!practiceId) return { status: 'ready', billing: NO_PRACTITIONER_BILLING };
  try {
    const result = await db.from('practitioner_billing').select('user_id, practice_number, rate_percent').eq('practice_id', practiceId);
    const error = result?.error;
    if (error) {
      return isNotSetUpError(error)
        ? { status: 'not_set_up', billing: NO_PRACTITIONER_BILLING }
        : { status: 'error', message: error.message, billing: NO_PRACTITIONER_BILLING };
    }
    return { status: 'ready', billing: practitionerBillingFromRows((result?.data ?? []) as PractitionerBillingRow[]) };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? plainWords(error.message) : 'unknown error', billing: NO_PRACTITIONER_BILLING };
  }
}

export type OnePractitionerBillingLoad =
  | { status: 'ready'; value: PractitionerBilling }
  | { status: 'not_set_up' }
  | { status: 'error'; message: string };

/** One practitioner's own practice number and rate (rows of the signed-in user's practice only: RLS). */
export async function loadPractitionerBillingFor(userId: string): Promise<OnePractitionerBillingLoad> {
  try {
    const result = await db.from('practitioner_billing').select('user_id, practice_number, rate_percent').eq('user_id', userId);
    const error = result?.error;
    if (error) return isNotSetUpError(error) ? { status: 'not_set_up' } : { status: 'error', message: error.message };
    const value = practitionerBillingFromRows((result?.data ?? []) as PractitionerBillingRow[]).get(userId);
    return { status: 'ready', value: value ?? { practiceNumber: null, ratePercent: null } };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? plainWords(error.message) : 'unknown error' };
  }
}

/** Sets one practitioner's own practice number and rate (null: the practice's number, the price list). Administrators only. */
export async function savePractitionerBilling(userId: string, values: PractitionerBilling): Promise<PractitionerBilling> {
  const { error } = await db.rpc('set_practitioner_billing', {
    p_user_id: userId,
    p_practice_number: values.practiceNumber,
    p_rate_percent: values.ratePercent
  });
  if (error) {
    if (isNotSetUpError(error)) throw new Error(PRACTITIONER_BILLING_NOT_SET_UP);
    throw new Error(error.code === '42501' ? "Only the practice's administrators can change who bills under which number." : error.message);
  }
  return values;
}
