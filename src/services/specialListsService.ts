/**
 * The special lists of Messages > Lists (parity R29): accounts handed over to a collector (the "Handed over" account
 * flag) and patients referred to the practice (the referral register). Injury and accident cases come from
 * payerAccountService.loadPracticeCases, due dates from pregnancyService. Read only; each list says "not set up yet"
 * before its table exists.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingTableError } from '../utils/diary/dbErrors';
import { loadPatientNames } from './payerAccountService';

// The generated database types do not know these tables yet
const db = supabase as unknown as SupabaseClient;

export class ListNotSetUpError extends Error {
  constructor(what: string) {
    super(`${what} are not set up in this database yet.`);
    this.name = 'ListNotSetUpError';
  }
}

const ID_CHUNK = 100;
const MAX_ROWS = 1000;

const chunks = (ids: readonly string[]): string[][] => {
  const unique = [...new Set(ids.filter(Boolean))];
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += ID_CHUNK) out.push(unique.slice(i, i + ID_CHUNK));
  return out;
};

export interface HandedOverAccount {
  /** The account holder's file (the flag is on whoever pays for the family) */
  patientId: string;
  name: string;
  /** When it was handed over */
  setAt: string;
  reason: string;
  /**
   * What the account (the holder and everyone they pay for) still owes itself, in cents; null when not known. From
   * ar_patient_balances, which leaves out invoices a company or fund account pays (company-accounts-followup.sql)
   */
  owedCents: number | null;
  /** How many patients the account pays for, the holder included */
  people: number;
}

/** Accounts flagged "Handed over" (not cleared), the most recent first, with what each still owes */
export async function loadHandedOverAccounts(practiceId: string): Promise<HandedOverAccount[]> {
  const { data, error } = await db
    .from('account_flags')
    .select('patient_id, set_at, reason')
    .eq('practice_id', practiceId)
    .eq('flag', 'handed_over')
    .is('cleared_at', null)
    .order('set_at', { ascending: false })
    .range(0, MAX_ROWS - 1);
  if (error) {
    if (isMissingTableError(error, 'account_flags')) throw new ListNotSetUpError('Account flags');
    throw new Error(`Could not load the accounts handed over: ${error.message}`);
  }
  const flags = (data ?? []) as Array<{ patient_id: string; set_at: string; reason: string | null }>;
  if (flags.length === 0) return [];
  const holders = flags.map(flag => flag.patient_id);

  // The family each holder pays for (account_holder_links), so the amount is the whole account's
  const membersOf = new Map<string, string[]>();
  for (const ids of chunks(holders)) {
    const { data: links, error: linkError } = await db
      .from('account_holder_links')
      .select('patient_id, holder_patient_id')
      .eq('practice_id', practiceId)
      .in('holder_patient_id', ids)
      .is('unlinked_at', null);
    if (linkError) break;
    for (const link of (links ?? []) as Array<{ patient_id: string; holder_patient_id: string }>) {
      membersOf.set(link.holder_patient_id, [...(membersOf.get(link.holder_patient_id) ?? []), link.patient_id]);
    }
  }
  const everyone = [...new Set([...holders, ...[...membersOf.values()].flat()])];
  let owedOf: Map<string, number> | null = new Map();
  for (const ids of chunks(everyone)) {
    const { data: balances, error: balanceError } = await db
      .from('ar_patient_balances')
      .select('patient_id, patient_owed')
      .eq('practice_id', practiceId)
      .in('patient_id', ids);
    if (balanceError) {
      owedOf = null;
      break;
    }
    for (const row of (balances ?? []) as Array<{ patient_id: string; patient_owed: number | string | null }>) {
      owedOf.set(row.patient_id, Math.round(Number(row.patient_owed ?? 0) * 100));
    }
  }
  const names = await loadPatientNames(holders);
  return flags.map(flag => {
    const people = [flag.patient_id, ...(membersOf.get(flag.patient_id) ?? [])];
    return {
      patientId: flag.patient_id,
      name: names[flag.patient_id] ?? 'Patient',
      setAt: flag.set_at,
      reason: flag.reason?.trim() ?? '',
      owedCents: owedOf ? people.reduce((sum, id) => sum + Math.max(owedOf?.get(id) ?? 0, 0), 0) : null,
      people: people.length
    };
  });
}

export interface ReferredPatient {
  referralId: string;
  patientId: string;
  name: string;
  referringName: string;
  /** yyyy-MM-dd */
  referralDate: string;
  validUntil: string | null;
  reason: string | null;
}

/** Referral letters on the practice's files (not removed) dated in the period, the latest first */
export async function loadReferredPatients(practiceId: string, range: { from: string; to: string }): Promise<{ patients: ReferredPatient[]; more: boolean }> {
  const { data, error } = await db
    .from('patient_referrals')
    .select('id, patient_id, referring_name, referral_date, valid_until, reason')
    .eq('practice_id', practiceId)
    .is('removed_at', null)
    .gte('referral_date', range.from)
    .lte('referral_date', range.to)
    .order('referral_date', { ascending: false })
    .order('id')
    .range(0, MAX_ROWS);
  if (error) {
    if (isMissingTableError(error, 'patient_referrals')) throw new ListNotSetUpError('Referrals');
    throw new Error(`Could not load the referred patients: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{ id: string; patient_id: string; referring_name: string; referral_date: string; valid_until: string | null; reason: string | null }>;
  const shown = rows.slice(0, MAX_ROWS);
  const names = await loadPatientNames(shown.map(row => row.patient_id));
  return {
    patients: shown.map(row => ({
      referralId: row.id,
      patientId: row.patient_id,
      name: names[row.patient_id] ?? 'Patient',
      referringName: row.referring_name,
      referralDate: row.referral_date,
      validUntil: row.valid_until,
      reason: row.reason?.trim() || null
    })),
    more: rows.length > MAX_ROWS
  };
}
