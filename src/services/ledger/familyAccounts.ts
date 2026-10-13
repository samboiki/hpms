import type { RuleResult } from './arRules';

// ---------------------------------------------------------------------------------------------
// Family (guarantor) accounts: one account holder pays for several patients, as a medical aid main
// member pays for the dependants. A patient with no account holder pays for themselves. One level
// only: an account holder is never someone else's dependant, so "who pays" is one lookup.
// (account_holder_links in proposals/2026-10-07-debtors-and-controls.sql)
// ---------------------------------------------------------------------------------------------

export type AccountRelationship = 'spouse' | 'child' | 'dependant' | 'other';

export const RELATIONSHIP_LABELS: Record<AccountRelationship, string> = {
  spouse: 'Spouse or partner',
  child: 'Child',
  dependant: 'Other dependant',
  other: 'Other'
};

export interface AccountHolderLink {
  id: string;
  /** The patient who is paid for */
  patientId: string;
  /** The patient who pays */
  holderId: string;
  relationship: AccountRelationship;
  linkedBy: string | null;
  linkedAt: string | null;
  unlinkedAt: string | null;
  unlinkReason: string | null;
}

export interface RawAccountHolderLinkRow {
  id: string;
  patient_id?: string | null;
  holder_patient_id?: string | null;
  relationship?: string | null;
  linked_by?: string | null;
  linked_at?: string | null;
  unlinked_at?: string | null;
  unlink_reason?: string | null;
}

const RELATIONSHIPS = Object.keys(RELATIONSHIP_LABELS) as AccountRelationship[];

export function normalizeAccountHolderLink(row: RawAccountHolderLinkRow): AccountHolderLink | null {
  if (!row.patient_id || !row.holder_patient_id || row.patient_id === row.holder_patient_id) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    holderId: row.holder_patient_id,
    relationship: RELATIONSHIPS.includes(row.relationship as AccountRelationship) ? (row.relationship as AccountRelationship) : 'other',
    linkedBy: row.linked_by ?? null,
    linkedAt: row.linked_at ?? null,
    unlinkedAt: row.unlinked_at ?? null,
    unlinkReason: row.unlink_reason?.trim() || null
  };
}

export interface FamilyAccounts {
  /** The account holder of a patient; null when the patient pays for themselves */
  holderOf: (patientId: string) => string | null;
  /** Who pays for a patient: the holder, else the patient */
  accountOf: (patientId: string) => string;
  /** The patients an account holder pays for (not the holder), with how they are related */
  membersOf: (holderId: string) => AccountHolderLink[];
  /** Every patient of an account: the holder first, then the members */
  everyoneOf: (accountId: string) => string[];
  /** The link in force for a patient */
  linkOf: (patientId: string) => AccountHolderLink | null;
}

/** Lookups over the links in force (unlinked ones are history) */
export function familyAccounts(links: readonly AccountHolderLink[]): FamilyAccounts {
  const byPatient = new Map<string, AccountHolderLink>();
  const byHolder = new Map<string, AccountHolderLink[]>();
  for (const link of links) {
    if (link.unlinkedAt) continue;
    byPatient.set(link.patientId, link);
    byHolder.set(link.holderId, [...(byHolder.get(link.holderId) ?? []), link]);
  }
  const holderOf = (patientId: string) => byPatient.get(patientId)?.holderId ?? null;
  return {
    holderOf,
    accountOf: patientId => holderOf(patientId) ?? patientId,
    membersOf: holderId => byHolder.get(holderId) ?? [],
    everyoneOf: accountId => [accountId, ...(byHolder.get(accountId) ?? []).map(link => link.patientId)],
    linkOf: patientId => byPatient.get(patientId) ?? null
  };
}

/** The account holder of each patient, for the age analysis (patients who pay for themselves are left out) */
export const holderByPatient = (links: readonly AccountHolderLink[]): Record<string, string> =>
  Object.fromEntries(links.filter(link => !link.unlinkedAt).map(link => [link.patientId, link.holderId]));

/**
 * Linking a patient to an account holder. One level only: the holder may not be paid for by
 * someone else, and a patient who pays for others cannot become a dependant (their family would
 * be left without a payer). A patient already on another account is moved by unlinking first.
 */
export function checkAccountLink(input: { patientId: string; holderId: string; relationship: AccountRelationship | null; links: readonly AccountHolderLink[] }): RuleResult {
  const family = familyAccounts(input.links);
  if (!input.holderId) return { ok: false, error: 'Choose who pays for this patient' };
  if (input.patientId === input.holderId) return { ok: false, error: 'A patient cannot be their own account holder' };
  if (!input.relationship) return { ok: false, error: 'Choose how the patient is related to the account holder' };
  const current = family.linkOf(input.patientId);
  if (current?.holderId === input.holderId) return { ok: false, error: 'This patient is already on that account' };
  if (current) return { ok: false, error: 'This patient is on another account. Remove them from it first.' };
  if (family.holderOf(input.holderId)) return { ok: false, error: 'That person is paid for by someone else, so they cannot hold an account. Choose who pays for them.' };
  if (family.membersOf(input.patientId).length > 0) return { ok: false, error: 'This patient pays for others. Move their family to the new account holder first.' };
  return { ok: true, error: null };
}

export function checkAccountUnlink(input: { link: AccountHolderLink | null; reason: string }): RuleResult {
  if (!input.link || input.link.unlinkedAt) return { ok: false, error: 'This patient is not on a family account' };
  if (input.reason.trim().length < 3) return { ok: false, error: 'Say why the patient leaves the account (it is kept with the account)' };
  return { ok: true, error: null };
}
