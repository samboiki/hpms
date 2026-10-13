import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { withTimeout } from '../../../services/financialKpiService';
import { normalizeCashierCashUp, type CashierCashUp, type RawCashierCashUpRow } from '../../../services/ledger/cashierCashUp';
import { centsToAmountText } from '../receipts/arPayloads';

/**
 * Cash-up per cashier (owner, 13 Oct 2026; proposals/2026-10-13-cashier-cash-ups.sql): the day's counts, and
 * recording the signed-in staff member's own count (cashier_record_cash_up works out what their receipts expect).
 * Before the proposal is applied the day says "not set up yet" and nothing breaks.
 */
const db = supabase as unknown as SupabaseClient;
const TIMEOUT_MS = 25000;

const COLUMNS =
  'id, business_date, cashier_id, float_in, float_out, expected_cash, expected_card, expected_eft, counted_cash, counted_card, counted_eft, notes, counted_at, superseded_at';

const MISSING_CODES = ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'];

export const CASHIER_CASH_UPS_NOT_SET_UP =
  'Cash-up per cashier is not set up in this database yet (proposals/2026-10-13-cashier-cash-ups.sql). Until then the administrator closes the day as before.';

export function isCashierCashUpNotSetUp(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: string | null; message?: string | null };
  return (!!code && MISSING_CODES.includes(code)) || /relation .* does not exist|could not find the (table|function)|schema cache/i.test(message ?? '');
}

export type CashierCountsLoad = { state: 'ready'; counts: CashierCashUp[] } | { state: 'not_set_up' } | { state: 'error'; message: string };

export async function loadCashierCounts(practiceId: string, dayKey: string): Promise<CashierCountsLoad> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(db.from('cashier_cash_ups').select(COLUMNS).eq('practice_id', practiceId).eq('business_date', dayKey).order('counted_at', { ascending: false }).limit(500)),
      TIMEOUT_MS,
      'Loading the cashier counts took too long. Check your connection and try again.'
    );
    if (error) {
      if (isCashierCashUpNotSetUp(error)) return { state: 'not_set_up' };
      console.error('Could not load the cashier counts:', error);
      return { state: 'error', message: 'The cashier counts could not be loaded. Please try again.' };
    }
    const counts = ((data ?? []) as RawCashierCashUpRow[]).map(normalizeCashierCashUp).filter((row): row is CashierCashUp => row !== null);
    return { state: 'ready', counts };
  } catch (error) {
    console.error('Could not load the cashier counts:', error);
    return { state: 'error', message: error instanceof Error ? error.message : 'The cashier counts could not be loaded. Please try again.' };
  }
}

export interface CashierCountInput {
  floatInCents: number;
  floatOutCents: number;
  counted: { cash: number; card: number; eft: number };
  notes: string;
  replaceReason: string;
}

/** Records the signed-in staff member's own count for the day */
export async function recordCashierCount(practiceId: string, dayKey: string, input: CashierCountInput): Promise<{ difference: number }> {
  const { data, error } = await withTimeout(
    Promise.resolve(db.rpc('cashier_record_cash_up', {
      p_practice_id: practiceId,
      p_day: dayKey,
      p_payload: {
        float_in: centsToAmountText(input.floatInCents),
        float_out: centsToAmountText(input.floatOutCents),
        counted_cash: centsToAmountText(input.counted.cash),
        counted_card: centsToAmountText(input.counted.card),
        counted_eft: centsToAmountText(input.counted.eft),
        notes: input.notes.trim() || null,
        replace_reason: input.replaceReason.trim() || null
      }
    })),
    TIMEOUT_MS,
    'Saving your cash-up took too long. Check Day end before trying again: it may have been saved.'
  );
  if (error) {
    if (isCashierCashUpNotSetUp(error)) throw new Error(CASHIER_CASH_UPS_NOT_SET_UP);
    console.error('Could not save the cash-up:', error);
    // The database's own messages here are written for staff (over or short, float, already counted)
    throw new Error(error.message || 'Your cash-up was not saved. Please try again.');
  }
  const result = (data ?? {}) as { difference?: number | string };
  return { difference: Number(result.difference ?? 0) };
}
