/**
 * Company (employer) accounts and the other accounts that pay for patients (parity A14, A19): what an account is, the
 * checks before it is saved, which invoices are billed to it, its age bands and how a payment from it is allocated.
 *
 * An account has no ledger of its own: a visit billed to it (visit_payers) bills every invoice of the visit to it, all
 * of each invoice in the patient portion (never claimed from the patient's medical aid), so the account owes what
 * those invoices still owe in the ar_* ledger. The database refuses the same things again
 * (proposals/2026-10-13-company-accounts-and-injury-cases.sql).
 */
import { toNamibianRegion, type NamibianRegion } from '../address/namibianTowns';
import { suggestAllocation, type OpenItem, type SuggestedAllocation } from '../../services/ledger/arAllocation';
import { zeroBands, type BandCents } from '../../services/ledger/ageAnalysis';
import { AGING_BUCKETS, type AgingBucket, type AgingReport } from '../../services/ledger/receivables';
import { fromCents, toCents } from '../../services/ledger/money';

export type PayerAccountKind = 'employer' | 'compensation_fund' | 'mva_fund' | 'other';

export const PAYER_ACCOUNT_KINDS: readonly PayerAccountKind[] = ['employer', 'compensation_fund', 'mva_fund', 'other'];

export const PAYER_KIND_LABELS: Record<PayerAccountKind, string> = {
  employer: 'Employer',
  compensation_fund: "Employees' Compensation Fund",
  mva_fund: 'MVA Fund',
  other: 'Other payer'
};

/** What each kind is for, in the words staff choose it by */
export const PAYER_KIND_HINTS: Record<PayerAccountKind, string> = {
  employer: 'A company that pays for its employees: medicals, staff visits, injuries on duty it pays itself.',
  compensation_fund: "The Social Security Commission's fund that pays injuries on duty and occupational diseases.",
  mva_fund: 'The Motor Vehicle Accident Fund, which pays for road accident injuries.',
  other: 'Another organisation that pays for patients, for example an insurer.'
};

/** Kinds that have employees on the account and can be billed for a visit directly (the funds go through a case) */
export const hasEmployees = (kind: PayerAccountKind): boolean => kind === 'employer' || kind === 'other';

export interface PayerAccount {
  id: string;
  practiceId: string;
  kind: PayerAccountKind;
  name: string;
  /** AC-0001 */
  accountNumber: string;
  registrationNumber: string | null;
  vatNumber: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  postalAddress: string | null;
  town: string | null;
  region: NamibianRegion | null;
  notes: string | null;
  createdAt: string | null;
  closedAt: string | null;
  closeReason: string | null;
}

export interface RawPayerAccountRow {
  id: string;
  practice_id?: string | null;
  kind?: string | null;
  name?: string | null;
  account_number?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  postal_address?: string | null;
  town?: string | null;
  region?: string | null;
  notes?: string | null;
  created_at?: string | null;
  closed_at?: string | null;
  close_reason?: string | null;
}

const text = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
};

export function normalizePayerAccount(row: RawPayerAccountRow): PayerAccount | null {
  const kind = PAYER_ACCOUNT_KINDS.find(item => item === row.kind);
  const name = text(row.name);
  if (!row.id || !kind || !name) return null;
  return {
    id: row.id,
    practiceId: row.practice_id ?? '',
    kind,
    name,
    accountNumber: text(row.account_number) ?? '',
    registrationNumber: text(row.registration_number),
    vatNumber: text(row.vat_number),
    contactName: text(row.contact_name),
    phone: text(row.phone),
    email: text(row.email),
    postalAddress: text(row.postal_address),
    town: text(row.town),
    region: toNamibianRegion(row.region),
    notes: text(row.notes),
    createdAt: row.created_at ?? null,
    closedAt: row.closed_at ?? null,
    closeReason: text(row.close_reason)
  };
}

/** "Kalahari Builders (Pty) Ltd (AC-0001)" */
export const describeAccount = (account: Pick<PayerAccount, 'name' | 'accountNumber'>): string =>
  account.accountNumber ? `${account.name} (${account.accountNumber})` : account.name;

/** Open accounts first, then A to Z */
export function sortAccounts<T extends Pick<PayerAccount, 'name' | 'closedAt'>>(accounts: readonly T[]): T[] {
  return [...accounts].sort((a, b) => Number(Boolean(a.closedAt)) - Number(Boolean(b.closedAt)) || a.name.localeCompare(b.name));
}

// ---- Saving an account ------------------------------------------------------------------------------------------------

export interface PayerAccountDraft {
  kind: PayerAccountKind;
  name: string;
  registrationNumber: string;
  vatNumber: string;
  contactName: string;
  phone: string;
  email: string;
  postalAddress: string;
  town: string;
  region: string;
  notes: string;
}

export type PayerAccountField = keyof PayerAccountDraft;

export const emptyPayerAccountDraft = (kind: PayerAccountKind = 'employer'): PayerAccountDraft => ({
  kind,
  name: '',
  registrationNumber: '',
  vatNumber: '',
  contactName: '',
  phone: '',
  email: '',
  postalAddress: '',
  town: '',
  region: '',
  notes: ''
});

export const draftOfPayerAccount = (account: PayerAccount): PayerAccountDraft => ({
  kind: account.kind,
  name: account.name,
  registrationNumber: account.registrationNumber ?? '',
  vatNumber: account.vatNumber ?? '',
  contactName: account.contactName ?? '',
  phone: account.phone ?? '',
  email: account.email ?? '',
  postalAddress: account.postalAddress ?? '',
  town: account.town ?? '',
  region: account.region ?? '',
  notes: account.notes ?? ''
});

/** The longest each field may be (the database's checks) */
export const PAYER_FIELD_LIMITS: Readonly<Record<Exclude<PayerAccountField, 'kind' | 'region'>, number>> = {
  name: 120,
  registrationNumber: 40,
  vatNumber: 30,
  contactName: 100,
  phone: 30,
  email: 200,
  postalAddress: 300,
  town: 80,
  notes: 1000
};

const FIELD_LABELS: Readonly<Record<keyof typeof PAYER_FIELD_LIMITS, string>> = {
  name: 'The name',
  registrationNumber: 'The registration number',
  vatNumber: 'The VAT number',
  contactName: 'The contact person',
  phone: 'The phone number',
  email: 'The email address',
  postalAddress: 'The postal address',
  town: 'The town',
  notes: 'The notes'
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const oneLine = (value: string): string => value.trim().replace(/\s+/g, ' ');

/** What save_payer_account receives */
export interface PayerAccountPayload {
  kind: PayerAccountKind;
  name: string;
  registration_number: string | null;
  vat_number: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  postal_address: string | null;
  town: string | null;
  region: NamibianRegion | null;
  notes: string | null;
}

export type PayerAccountCheck =
  | { ok: true; value: PayerAccountPayload }
  | { ok: false; errors: Partial<Record<PayerAccountField, string>> };

/** The checks of save_payer_account, before anything is sent (one plain sentence per field) */
export function validatePayerAccountDraft(draft: PayerAccountDraft): PayerAccountCheck {
  const errors: Partial<Record<PayerAccountField, string>> = {};
  const name = oneLine(draft.name);
  if (name.length < 2) errors.name = 'Give the account its name';
  for (const field of Object.keys(PAYER_FIELD_LIMITS) as Array<keyof typeof PAYER_FIELD_LIMITS>) {
    const value = field === 'postalAddress' || field === 'notes' ? draft[field].trim() : oneLine(draft[field]);
    if (value.length > PAYER_FIELD_LIMITS[field]) errors[field] = `${FIELD_LABELS[field]} is too long (at most ${PAYER_FIELD_LIMITS[field]} characters)`;
  }
  const email = draft.email.trim().toLowerCase();
  if (email && !EMAIL.test(email) && !errors.email) errors.email = 'The email address is not valid';
  const region = draft.region.trim() ? toNamibianRegion(draft.region) : null;
  if (draft.region.trim() && !region) errors.region = 'Choose the region from the list';
  if (!PAYER_ACCOUNT_KINDS.includes(draft.kind)) errors.kind = 'Choose what kind of account it is';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const optional = (value: string, keepLines = false): string | null => {
    const cleaned = keepLines ? value.trim() : oneLine(value);
    return cleaned ? cleaned : null;
  };
  return {
    ok: true,
    value: {
      kind: draft.kind,
      name,
      registration_number: optional(draft.registrationNumber),
      vat_number: optional(draft.vatNumber),
      contact_name: optional(draft.contactName),
      phone: optional(draft.phone),
      email: email || null,
      postal_address: optional(draft.postalAddress, true),
      town: optional(draft.town),
      region,
      notes: optional(draft.notes, true)
    }
  };
}

// ---- Employees on an account ------------------------------------------------------------------------------------------

export interface PayerMember {
  id: string;
  accountId: string;
  patientId: string;
  employeeNumber: string | null;
  linkedAt: string | null;
  unlinkedAt: string | null;
  unlinkReason: string | null;
}

export interface RawPayerMemberRow {
  id: string;
  payer_account_id?: string | null;
  patient_id?: string | null;
  employee_number?: string | null;
  linked_at?: string | null;
  unlinked_at?: string | null;
  unlink_reason?: string | null;
}

export function normalizePayerMember(row: RawPayerMemberRow): PayerMember | null {
  if (!row.id || !row.payer_account_id || !row.patient_id) return null;
  return {
    id: row.id,
    accountId: row.payer_account_id,
    patientId: row.patient_id,
    employeeNumber: text(row.employee_number),
    linkedAt: row.linked_at ?? null,
    unlinkedAt: row.unlinked_at ?? null,
    unlinkReason: text(row.unlink_reason)
  };
}

/** Employee and claim numbers: letters, digits, spaces, / . and - (the database's check) */
export const REFERENCE_NUMBER = /^[A-Za-z0-9/. -]{1,30}$/;

/** Why an employee or claim number would be refused; null when it is fine or empty */
export function referenceNumberProblem(value: string, label: string): string | null {
  const cleaned = oneLine(value);
  if (!cleaned) return null;
  if (cleaned.length > 30) return `${label} is too long (at most 30 characters)`;
  if (!REFERENCE_NUMBER.test(cleaned)) return `${label} has letters, digits, spaces, / . or - only`;
  return null;
}

// ---- Who pays for a visit, and the invoices billed to an account ------------------------------------------------------

export interface VisitPayer {
  visitId: string;
  /** null: a visit of a case the patient pays */
  accountId: string | null;
  caseId: string | null;
}

export interface RawVisitPayerRow {
  visit_id?: string | null;
  payer_account_id?: string | null;
  injury_case_id?: string | null;
}

export function normalizeVisitPayer(row: RawVisitPayerRow): VisitPayer | null {
  if (!row.visit_id || (!row.payer_account_id && !row.injury_case_id)) return null;
  return { visitId: row.visit_id, accountId: row.payer_account_id ?? null, caseId: row.injury_case_id ?? null };
}

/** The age analysis's rows of payer accounts (defined with the age analysis, which groups them) */
export { PAYER_ROW_PREFIX, payerRowKey, accountIdOfRowKey } from '../../services/ledger/ageAnalysis';

export interface InvoicePayer {
  accountId: string;
  /** "Kalahari Builders (Pty) Ltd" */
  name: string;
}

/**
 * The account each invoice is billed to, through its visit (invoices of visits the patient pays are absent). An account
 * that is not in `accounts` (closed and not loaded, another practice's) still bills the invoice, under a plain name.
 */
export function payersByInvoice(
  invoices: ReadonlyArray<{ id: string; visitId: string | null }>,
  visitPayers: readonly VisitPayer[],
  accounts: ReadonlyArray<Pick<PayerAccount, 'id' | 'name'>>
): Record<string, InvoicePayer> {
  const accountOfVisit = new Map(visitPayers.filter(row => row.accountId).map(row => [row.visitId, row.accountId as string]));
  const names = new Map(accounts.map(account => [account.id, account.name]));
  const result: Record<string, InvoicePayer> = {};
  for (const invoice of invoices) {
    const accountId = invoice.visitId ? accountOfVisit.get(invoice.visitId) : undefined;
    if (accountId) result[invoice.id] = { accountId, name: names.get(accountId) ?? 'Payer account' };
  }
  return result;
}

/** The invoice ids billed to one account */
export const invoicesOfAccount = (payerByInvoice: Readonly<Record<string, InvoicePayer>>, accountId: string): Set<string> =>
  new Set(Object.entries(payerByInvoice).filter(([, payer]) => payer.accountId === accountId).map(([invoiceId]) => invoiceId));

/**
 * The receivables without the invoices accounts pay, totals worked out again: what the patients' own work lists,
 * statement runs, interest and small-balance write-offs act on, so no patient is chased for their employer's debt.
 */
export function withoutAccountInvoices(report: AgingReport, payerByInvoice: Readonly<Record<string, InvoicePayer>>): AgingReport {
  if (!report.items.some(item => payerByInvoice[item.invoice.id])) return report;
  const items = report.items.filter(item => !payerByInvoice[item.invoice.id]);
  const buckets = Object.fromEntries(AGING_BUCKETS.map(({ key }) => [key, { amount: 0, medicalAid: 0, patient: 0, count: 0 }])) as Record<
    AgingBucket,
    { amount: number; medicalAid: number; patient: number; count: number }
  >;
  let total = 0;
  let medicalAid = 0;
  let patient = 0;
  let undatedCount = 0;
  for (const item of items) {
    const cents = { amount: toCents(item.amount), medicalAid: toCents(item.medicalAid), patient: toCents(item.patient) };
    buckets[item.bucket].amount += cents.amount;
    buckets[item.bucket].medicalAid += cents.medicalAid;
    buckets[item.bucket].patient += cents.patient;
    buckets[item.bucket].count += 1;
    total += cents.amount;
    medicalAid += cents.medicalAid;
    patient += cents.patient;
    if (item.daysPastDue === null) undatedCount += 1;
  }
  const byBucket = Object.fromEntries(
    AGING_BUCKETS.map(({ key }) => [key, { amount: fromCents(buckets[key].amount), medicalAid: fromCents(buckets[key].medicalAid), patient: fromCents(buckets[key].patient), count: buckets[key].count }])
  ) as AgingReport['byBucket'];
  return {
    ...report,
    items,
    byBucket,
    total: fromCents(total),
    medicalAid: fromCents(medicalAid),
    patient: fromCents(patient),
    count: items.length,
    pastDue: fromCents(total - buckets.not_due.amount),
    undatedCount
  };
}

export interface AccountAges {
  /** Owed per band (cents), current to 180+ days, by the invoice date */
  bands: BandCents;
  owedCents: number;
  invoiceCount: number;
  /** Days since the oldest invoice still owing; null when nothing is owed or that invoice has no date */
  oldestAgeDays: number | null;
}

/**
 * What an account owes by the age of the debt, from the receivables report (the same balances the age analysis uses):
 * every portion of its invoices counts, since the account pays all of each.
 */
export function accountAges(report: Pick<AgingReport, 'items'>, invoiceIds: ReadonlySet<string>): AccountAges {
  const bands = zeroBands();
  let owedCents = 0;
  let invoiceCount = 0;
  let oldestAgeDays: number | null = null;
  let undated = false;
  for (const item of report.items) {
    if (!invoiceIds.has(item.invoice.id)) continue;
    const cents = toCents(item.patient) + toCents(item.medicalAid);
    if (cents === 0) continue;
    bands[item.ageBand] += cents;
    owedCents += cents;
    invoiceCount += 1;
    if (item.ageDays === null) undated = true;
    else oldestAgeDays = Math.max(oldestAgeDays ?? item.ageDays, item.ageDays);
  }
  return { bands, owedCents, invoiceCount, oldestAgeDays: undated ? null : oldestAgeDays };
}

/**
 * How a payment from an account is allocated: oldest invoice first, to what each still owes, never more than was paid;
 * what is left stays on the receipt as the account's credit (the same rule as every receipt, arAllocation.ts).
 */
export function planAccountPayment(amountCents: number, owing: ReadonlyArray<Omit<OpenItem, 'portion'>>): SuggestedAllocation {
  return suggestAllocation(amountCents, owing.map(item => ({ ...item, portion: 'patient' as const })), ['patient']);
}
