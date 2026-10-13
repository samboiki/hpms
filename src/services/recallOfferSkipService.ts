/**
 * Recall offers staff skipped (parity O2): remembered per visit and code in public.visit_recall_offer_skips, written
 * only through skip_visit_recall_offers() (proposals/2026-10-13-recall-offer-skips.sql), so saving the visit again on
 * any computer does not offer the same recall again. The offer itself is src/components/visits/recallOffer.tsx.
 * Before the proposal is applied nothing is remembered: the offer works as before and can come back on the next save.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// The generated database types do not include the table and function yet
const db = supabase as unknown as SupabaseClient;

const SKIP_OBJECTS = /\b(visit_recall_offer_skips|skip_visit_recall_offers)\b/i;

interface DbError {
  code?: string;
  message?: string;
}

/** True when the table or the function is not in the database yet (only ours: any other error is real). */
export function isRecallSkipsNotSetUp(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!SKIP_OBJECTS.test(message ?? '')) return false;
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the (table|function)|does not exist|schema cache/i.test(message ?? '');
}

/** The codes whose recall offer was skipped for this visit (upper case); none before the proposal is applied. */
export async function loadSkippedRecallOffers(visitId: string): Promise<Set<string>> {
  const { data, error } = await db.from('visit_recall_offer_skips').select('code').eq('visit_id', visitId);
  if (error) {
    if (isRecallSkipsNotSetUp(error)) return new Set();
    throw new Error(error.message || 'Could not read the skipped recall offers.');
  }
  return new Set(((data ?? []) as Array<{ code: string | null }>).map(row => (row.code ?? '').trim().toUpperCase()).filter(Boolean));
}

/**
 * Remembers that staff skipped the recall offer of these codes for the visit (a code already skipped stays as it is).
 * Returns false when it cannot be remembered yet (the proposal is not applied); throws on any other error.
 */
export async function skipRecallOffers(practiceId: string, visitId: string, codes: readonly string[]): Promise<boolean> {
  const { error } = await db.rpc('skip_visit_recall_offers', { p_practice_id: practiceId, p_visit_id: visitId, p_codes: [...codes] });
  if (error) {
    if (isRecallSkipsNotSetUp(error)) return false;
    throw new Error(error.message || 'Could not remember the skipped recall offer.');
  }
  return true;
}
