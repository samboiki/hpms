import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  creditLimitStatus,
  effectiveFlags,
  flagKindsByPatient,
  flagSummaryText,
  normalizeAccountFlag,
  normalizeAccountHolderLink,
  toCents,
  type AccountFlag,
  type AccountHolderLink,
  type AccountRelationship,
  type CreditLimitStatus,
  type EffectiveFlag,
  type RawAccountFlagRow,
  type RawAccountHolderLinkRow
} from '../../../services/ledgerService';
import { isArNotSetUp } from '../receipts/arService';
import { errorText, fetchByIds, fetchPages, loadPatientNames, timed } from './debtorsService';

const db = supabase as unknown as SupabaseClient;

export interface AccountPerson {
  id: string;
  name: string;
  relationship: AccountRelationship;
}

export interface PatientAccountFlags {
  state: 'idle' | 'loading' | 'ready' | 'not_set_up' | 'error';
  error: string | null;
  /** The flags that apply to the patient: their own, the account holder's account flags, and the SMS opt-out */
  flags: EffectiveFlag[];
  /** Who pays for the patient; null when they pay for themselves */
  holder: AccountPerson | null;
  /** The patients this patient pays for */
  members: AccountPerson[];
  /** Who pays: the account holder, else the patient (null until loaded) */
  accountId: string | null;
  /** Every patient on the account: the account holder first, then the family members */
  familyIds: string[];
  /** The account's credit limit and what it owes; null without a limit (or before receipts are set up) */
  creditLimit: CreditLimitStatus | null;
  /** Replied STOP (patients.sms_opt_out); null when the column does not exist yet */
  smsOptOut: boolean | null;
  /** Flags in force on the patient's file and the account holder's */
  stored: AccountFlag[];
  reload: () => void;
}

interface Loaded {
  flags: EffectiveFlag[];
  holder: AccountPerson | null;
  members: AccountPerson[];
  accountId: string | null;
  familyIds: string[];
  creditLimit: CreditLimitStatus | null;
  smsOptOut: boolean | null;
  stored: AccountFlag[];
}

const LINK_COLUMNS = 'id, patient_id, holder_patient_id, relationship, linked_by, linked_at, unlinked_at, unlink_reason';
const FLAG_COLUMNS = 'id, patient_id, flag, amount, value, reason, set_by, set_at, cleared_at, cleared_by, clear_reason';

async function loadSmsOptOut(practiceId: string, patientId: string): Promise<boolean | null> {
  const { data, error } = await db.from('patients').select('sms_opt_out').eq('practice_id', practiceId).eq('id', patientId).range(0, 0);
  if (error) return null; // the column comes with the two-way SMS proposal
  const row = (data ?? [])[0] as { sms_opt_out?: boolean | null } | undefined;
  return row ? row.sms_opt_out === true : null;
}

/** What the account owes on patient portions, less its unallocated credit; null before receipts are set up */
async function loadAccountOwed(patientIds: readonly string[]): Promise<number | null> {
  try {
    const rows = await fetchByIds<{ patient_owed: number | string | null; unallocated_credit: number | string | null }>(patientIds, 'balances', (ids, from, to) => db
      .from('ar_patient_balances').select('patient_owed, unallocated_credit').in('patient_id', ids).order('patient_id').range(from, to));
    return rows.reduce((sum, row) => sum + toCents(row.patient_owed) - toCents(row.unallocated_credit), 0);
  } catch (error) {
    if (isArNotSetUp(error)) return null;
    throw error;
  }
}

/** The flags, family links and credit limit of one patient's account */
export async function loadPatientAccountFlags(practiceId: string, patientId: string): Promise<Loaded> {
  const linkRows = await timed(fetchPages<RawAccountHolderLinkRow>('family accounts', (from, to) => db
    .from('account_holder_links').select(LINK_COLUMNS).eq('practice_id', practiceId).is('unlinked_at', null)
    .or(`patient_id.eq.${patientId},holder_patient_id.eq.${patientId}`).order('id').range(from, to)), 'the account');
  const links = linkRows.map(normalizeAccountHolderLink).filter((row): row is AccountHolderLink => row !== null);
  const ownLink = links.find(link => link.patientId === patientId) ?? null;
  const holderId = ownLink?.holderId ?? null;
  const accountId = holderId ?? patientId;

  // A dependant's account is the holder's: the holder's own family is needed for the balance
  const holderLinks = holderId
    ? (await timed(fetchPages<RawAccountHolderLinkRow>('family accounts', (from, to) => db
      .from('account_holder_links').select(LINK_COLUMNS).eq('practice_id', practiceId).is('unlinked_at', null)
      .eq('holder_patient_id', holderId).order('id').range(from, to)), 'the account'))
      .map(normalizeAccountHolderLink).filter((row): row is AccountHolderLink => row !== null)
    : links.filter(link => link.holderId === patientId);

  const [flagRows, smsOptOut] = await timed(Promise.all([
    fetchPages<RawAccountFlagRow>('account flags', (from, to) => db
      .from('account_flags').select(FLAG_COLUMNS).eq('practice_id', practiceId).is('cleared_at', null)
      .in('patient_id', holderId ? [patientId, holderId] : [patientId]).order('id').range(from, to)),
    loadSmsOptOut(practiceId, patientId)
  ]), 'the account');
  const stored = flagRows.map(normalizeAccountFlag).filter((row): row is AccountFlag => row !== null);
  const flags = effectiveFlags({ patientId, holderId, flags: stored, smsOptOut: smsOptOut === true });

  const ownMembers = links.filter(link => link.holderId === patientId);
  const names = await loadPatientNames(practiceId, [...new Set([...(holderId ? [holderId] : []), ...ownMembers.map(link => link.patientId)])]);
  const hasLimit = flags.some(flag => flag.kind === 'credit_limit');
  const owed = hasLimit ? await loadAccountOwed([accountId, ...holderLinks.map(link => link.patientId)]) : null;

  return {
    flags,
    holder: ownLink ? { id: ownLink.holderId, name: names[ownLink.holderId] ?? 'Account holder', relationship: ownLink.relationship } : null,
    members: ownMembers.map(link => ({ id: link.patientId, name: names[link.patientId] ?? 'Patient', relationship: link.relationship }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    accountId,
    familyIds: [accountId, ...holderLinks.map(link => link.patientId).filter(id => id !== accountId)],
    creditLimit: owed === null ? null : creditLimitStatus(flags, owed),
    smsOptOut,
    stored
  };
}

const EMPTY: Loaded = { flags: [], holder: null, members: [], accountId: null, familyIds: [], creditLimit: null, smsOptOut: null, stored: [] };

/**
 * The account flags of a patient, for any screen: the patient header badge, the Billing tab, the
 * visit screens. Quiet until there is something to show: 'not_set_up' before the debtors proposal
 * is applied, never an error banner on a patient file.
 */
export function useAccountFlags(patientId: string | null | undefined, practiceId: string | null | undefined): PatientAccountFlags {
  const [state, setState] = useState<PatientAccountFlags['state']>(patientId && practiceId ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!patientId || !practiceId) {
      setState('idle');
      setLoaded(EMPTY);
      return;
    }
    let cancelled = false;
    setState(current => (current === 'ready' ? current : 'loading'));
    loadPatientAccountFlags(practiceId, patientId)
      .then(result => {
        if (cancelled) return;
        setLoaded(result);
        setError(null);
        setState('ready');
      })
      .catch(loadError => {
        if (cancelled) return;
        setLoaded(EMPTY);
        if (isArNotSetUp(loadError)) {
          setState('not_set_up');
          return;
        }
        console.warn('Account flags unavailable', loadError);
        setError(errorText(loadError, 'Could not load the account flags'));
        setState('error');
      });
    return () => { cancelled = true; };
  }, [patientId, practiceId, reloadKey]);

  const reload = useCallback(() => setReloadKey(key => key + 1), []);
  return { state, error, ...loaded, reload };
}

/**
 * The flags that matter for billing on many patients' accounts at once (diary cards): each patient's own
 * flags and their account holder's account flags, as one text per patient ("Account: Cash only, In
 * dispute"). Two requests for the whole screen; patients without such a flag are left out.
 */
export async function loadAccountFlagSummaries(practiceId: string, patientIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(patientIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const linkRows = await timed(fetchByIds<RawAccountHolderLinkRow>(ids, 'family accounts', (chunk, from, to) => db
    .from('account_holder_links').select(LINK_COLUMNS).eq('practice_id', practiceId).is('unlinked_at', null)
    .in('patient_id', chunk).order('id').range(from, to)), 'account flags');
  const holderOf = new Map(linkRows.map(normalizeAccountHolderLink).filter((link): link is AccountHolderLink => link !== null)
    .map(link => [link.patientId, link.holderId]));
  const flagRows = await timed(fetchByIds<RawAccountFlagRow>([...ids, ...holderOf.values()], 'account flags', (chunk, from, to) => db
    .from('account_flags').select(FLAG_COLUMNS).eq('practice_id', practiceId).is('cleared_at', null)
    .in('patient_id', chunk).order('id').range(from, to)), 'account flags');
  const flags = flagRows.map(normalizeAccountFlag).filter((flag): flag is AccountFlag => flag !== null);
  const summaries = new Map<string, string>();
  for (const [patientId, kinds] of Object.entries(flagKindsByPatient({ patientIds: ids, holderOf: id => holderOf.get(id) ?? null, flags }))) {
    const text = flagSummaryText(kinds);
    if (text) summaries.set(patientId, text);
  }
  return summaries;
}

/** The account-flag summaries of the patients on screen; empty while loading and before the debtors proposal is applied */
export function useAccountFlagSummaries(patientIds: readonly string[], practiceId: string | null | undefined): Map<string, string> {
  const [summaries, setSummaries] = useState<Map<string, string>>(() => new Map());
  const key = [...new Set(patientIds.filter(Boolean))].sort().join(',');
  useEffect(() => {
    if (!practiceId || !key) {
      setSummaries(new Map());
      return;
    }
    let cancelled = false;
    loadAccountFlagSummaries(practiceId, key.split(','))
      .then(result => { if (!cancelled) setSummaries(result); })
      .catch(loadError => {
        if (cancelled) return;
        // A diary never shows an error for this: the cards simply carry no flag icon
        if (!isArNotSetUp(loadError)) console.warn('Account flags for the diary unavailable', loadError);
        setSummaries(new Map());
      });
    return () => { cancelled = true; };
  }, [key, practiceId]);
  return summaries;
}
