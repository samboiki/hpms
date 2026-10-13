/**
 * Which invoices are billed to a company or fund account (parity A14, A19). The patient's own account, statements,
 * payments and reminders leave them out: the account pays them, and its own statement and age bands show them
 * (Finance > Debtors > Companies). Before proposals/2026-10-13-company-accounts-and-injury-cases.sql is applied, none
 * are.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingTableError } from '../utils/diary/dbErrors';

// The generated database types do not know visit_payers yet
const db = supabase as unknown as SupabaseClient;

const ID_CHUNK = 100;

/**
 * The ids of these invoices whose visit is billed to an account (a case the patient pays is not). Never fails: when it
 * cannot tell, the patient's account shows every invoice, as before accounts existed.
 */
export async function invoicesBilledToAccounts(invoices: ReadonlyArray<{ id: string; visitId: string | null }>): Promise<Set<string>> {
  const visitIds = [...new Set(invoices.map(invoice => invoice.visitId).filter((id): id is string => Boolean(id)))];
  const billedVisits = new Set<string>();
  try {
    for (let i = 0; i < visitIds.length; i += ID_CHUNK) {
      // One row per visit: a chunk never needs a second page
      const { data, error } = await db
        .from('visit_payers')
        .select('visit_id')
        .in('visit_id', visitIds.slice(i, i + ID_CHUNK))
        .not('payer_account_id', 'is', null);
      if (error) {
        if (!isMissingTableError(error, 'visit_payers')) console.warn('Could not read which invoices are billed to company accounts:', error.message);
        return new Set();
      }
      for (const row of (data ?? []) as Array<{ visit_id: string }>) billedVisits.add(row.visit_id);
    }
  } catch (error) {
    console.warn('Could not read which invoices are billed to company accounts:', error);
    return new Set();
  }
  return new Set(invoices.filter(invoice => invoice.visitId && billedVisits.has(invoice.visitId)).map(invoice => invoice.id));
}
