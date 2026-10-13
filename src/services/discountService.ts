/**
 * Discounts on one invoice with the percentage they were given as (parity D19). The shared loaders read adjustments
 * without the percentage (ADJUSTMENT_COLUMNS), so they work before proposals/2026-10-13-discounts-and-statements.sql;
 * this one reads it and finds none (never an error) before that file is applied.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normalizeAdjustment, type ArAdjustment, type RawAdjustmentRow } from './ledgerService';

// The generated database types do not know the percent column
const db = supabase as unknown as SupabaseClient;

export const DISCOUNT_COLUMNS =
  'id, adjustment_number, kind, invoice_id, receipt_id, patient_id, portion, amount, method, reason_code, reason, approved_by, effective_on, created_by, created_at, reversed_at, reversed_by, reversal_reason, percent';

/** Every discount on the invoice (taken-back ones too, with their reversal), oldest first; none when they cannot be read */
export async function loadInvoiceDiscounts(invoiceId: string): Promise<ArAdjustment[]> {
  try {
    const { data, error } = await db
      .from('invoice_adjustments')
      .select(DISCOUNT_COLUMNS)
      .eq('invoice_id', invoiceId)
      .eq('kind', 'discount')
      .order('created_at');
    if (error) return [];
    return ((data ?? []) as RawAdjustmentRow[]).map(normalizeAdjustment).filter((row): row is ArAdjustment => row !== null);
  } catch {
    return [];
  }
}
