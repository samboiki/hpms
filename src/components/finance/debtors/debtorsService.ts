import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { withTimeout } from '../../../services/financialKpiService';
import { readAllPages } from '../../../lib/pagedRows';
import {
  dateKeyFrom,
  normalizeAccountFlag,
  normalizeAccountHolderLink,
  normalizeAdjustment,
  normalizeAllocation,
  normalizeContactNote,
  normalizeInvoice,
  normalizeInvoiceBalance,
  normalizePromise,
  normalizeReceipt,
  parseStatementCriteria,
  SMALL_BALANCE_REASON_CODE,
  SMALL_BALANCE_REF_PATTERN,
  groupSmallBalanceRuns,
  smallBalanceRef,
  toCents,
  type AccountFlag,
  type AccountFlagKind,
  type AccountHolderLink,
  type AccountRelationship,
  type ArAdjustment,
  type ArAllocation,
  type ArInvoiceBalance,
  type ArReceipt,
  type ContactChannel,
  type ContactNote,
  type InterestSettings,
  type LedgerInvoice,
  type PaymentDetails,
  type PaymentPromise,
  type RawAccountFlagRow,
  type RawAccountHolderLinkRow,
  type RawAdjustmentRow,
  type RawAllocationRow,
  type RawContactNoteRow,
  type RawInvoiceBalanceRow,
  type RawInvoiceRow,
  type RawPromiseRow,
  type RawReceiptRow,
  type SmallBalanceLine,
  type SmallBalanceRun,
  type StatementCriteria
} from '../../../services/ledgerService';
import { centsToAmountText } from '../receipts/arPayloads';
import { invoicesBilledToAccounts } from '../../../services/accountBilledInvoices';
import {
  ADJUSTMENT_COLUMNS,
  ALLOCATION_COLUMNS,
  ArQueryError,
  BALANCE_COLUMNS,
  INVOICE_COLUMNS,
  RECEIPT_COLUMNS,
  isArNotSetUp,
  postAdjustment,
  withCovers
} from '../receipts/arService';

/**
 * Supabase access for debtors: family accounts, account flags, credit-control notes and promises,
 * interest and statement runs (proposals/2026-10-07-debtors-and-controls.sql). Reads go to the
 * tables (RLS: the user's practice); every write is one dc_ function call, which checks the
 * practice and the role again. Until the tables exist, loaders say 'not_set_up'.
 */
const db = supabase as unknown as SupabaseClient;

const TIMEOUT_MS = 25000;
const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

export const DEBTORS_NOT_SET_UP_MESSAGE =
  'Debtors and daily controls are not set up in this database yet (proposals/2026-10-07-debtors-and-controls.sql).';

export type LoadState = 'ready' | 'not_set_up' | 'error';

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>;

/** Every page of a query; a failure keeps its code so a missing table can be told apart */
export async function fetchPages<T>(label: string, build: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  return readAllPages(PAGE_SIZE, build, error => new ArQueryError(label, error));
}

/** A query run over chunks of ids (PostgREST URLs stay short) */
export async function fetchByIds<T>(ids: readonly string[], label: string, build: (chunk: string[], from: number, to: number) => PageResult<T>): Promise<T[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += ID_CHUNK) chunks.push(unique.slice(i, i + ID_CHUNK));
  const pages = await Promise.all(chunks.map(chunk => fetchPages<T>(label, (from, to) => build(chunk, from, to))));
  return pages.flat();
}

export const timed = <T>(task: Promise<T>, label: string): Promise<T> =>
  withTimeout(task, TIMEOUT_MS, `Loading ${label} took too long. Check your connection and try again.`);

export const errorText = (error: unknown, fallback: string): string => (error instanceof Error && error.message ? error.message : fallback);

/** One dc_ function call; "not set up" is said in words, every other message is the database's */
export async function callRpc<T>(name: string, args: Record<string, unknown>, action: string): Promise<T> {
  const { data, error } = await withTimeout(
    Promise.resolve(db.rpc(name, args)),
    TIMEOUT_MS,
    `${action} took too long. Check before trying again: it may have been saved.`
  );
  if (error) {
    if (isArNotSetUp(error)) throw new Error(DEBTORS_NOT_SET_UP_MESSAGE);
    throw new Error(error.message || `${action} failed`);
  }
  return data as T;
}

const nameOf = (row: { first_name?: string | null; last_name?: string | null }): string =>
  [row.first_name, row.last_name].map(part => part?.trim()).filter(Boolean).join(' ') || 'Unnamed patient';

// ---------------------------------------------------------------------------------------------
// Family accounts and flags of the practice
// ---------------------------------------------------------------------------------------------

const LINK_COLUMNS = 'id, patient_id, holder_patient_id, relationship, linked_by, linked_at, unlinked_at, unlink_reason';
const FLAG_COLUMNS = 'id, patient_id, flag, amount, value, reason, set_by, set_at, cleared_at, cleared_by, clear_reason';
const NOTE_COLUMNS = 'id, patient_id, channel, note, created_by, created_at';
const PROMISE_COLUMNS = 'id, patient_id, made_on, promised_on, amount, note, created_by, created_at, cancelled_at, cancel_reason';

export interface AccountDirectory {
  state: LoadState;
  error: string | null;
  /** Links in force */
  links: AccountHolderLink[];
  /** Flags in force */
  flags: AccountFlag[];
}

/** Family links and flags in force for the whole practice (the age analysis, work list and statements need them) */
export async function loadAccountDirectory(practiceId: string): Promise<AccountDirectory> {
  try {
    const [linkRows, flagRows] = await timed(Promise.all([
      fetchPages<RawAccountHolderLinkRow>('family accounts', (from, to) => db
        .from('account_holder_links').select(LINK_COLUMNS).eq('practice_id', practiceId).is('unlinked_at', null).order('id').range(from, to)),
      fetchPages<RawAccountFlagRow>('account flags', (from, to) => db
        .from('account_flags').select(FLAG_COLUMNS).eq('practice_id', practiceId).is('cleared_at', null).order('id').range(from, to))
    ]), 'accounts');
    return {
      state: 'ready',
      error: null,
      links: linkRows.map(normalizeAccountHolderLink).filter((row): row is AccountHolderLink => row !== null),
      flags: flagRows.map(normalizeAccountFlag).filter((row): row is AccountFlag => row !== null)
    };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up', error: null, links: [], flags: [] };
    return { state: 'error', error: errorText(error, 'Could not load the accounts'), links: [], flags: [] };
  }
}

export interface CreditControlData {
  notes: ContactNote[];
  promises: PaymentPromise[];
}

/** Notes and promises of the practice since a day (the work list shows the latest of each account) */
export async function loadCreditControl(practiceId: string, sinceKey: string): Promise<CreditControlData> {
  const since = /^\d{4}-\d{2}-\d{2}$/.test(sinceKey) ? sinceKey : '2000-01-01';
  const [noteRows, promiseRows] = await timed(Promise.all([
    fetchPages<RawContactNoteRow>('contact notes', (from, to) => db
      .from('credit_control_notes').select(NOTE_COLUMNS).eq('practice_id', practiceId).gte('created_at', since).order('created_at', { ascending: false }).range(from, to)),
    fetchPages<RawPromiseRow>('promises to pay', (from, to) => db
      .from('payment_promises').select(PROMISE_COLUMNS).eq('practice_id', practiceId).gte('made_on', since).order('made_on', { ascending: false }).range(from, to))
  ]), 'credit control');
  return {
    notes: noteRows.map(normalizeContactNote).filter((row): row is ContactNote => row !== null),
    promises: promiseRows.map(normalizePromise).filter((row): row is PaymentPromise => row !== null)
  };
}

/** Everything on one account (notes, promises, and flags with their history), for the account sheet */
export async function loadAccountHistory(practiceId: string, patientIds: readonly string[]): Promise<{ notes: ContactNote[]; promises: PaymentPromise[]; flags: AccountFlag[]; links: AccountHolderLink[] }> {
  const [noteRows, promiseRows, flagRows, linkRows] = await timed(Promise.all([
    fetchByIds<RawContactNoteRow>(patientIds, 'contact notes', (ids, from, to) => db
      .from('credit_control_notes').select(NOTE_COLUMNS).eq('practice_id', practiceId).in('patient_id', ids).order('created_at', { ascending: false }).range(from, to)),
    fetchByIds<RawPromiseRow>(patientIds, 'promises to pay', (ids, from, to) => db
      .from('payment_promises').select(PROMISE_COLUMNS).eq('practice_id', practiceId).in('patient_id', ids).order('made_on', { ascending: false }).range(from, to)),
    fetchByIds<RawAccountFlagRow>(patientIds, 'account flags', (ids, from, to) => db
      .from('account_flags').select(FLAG_COLUMNS).eq('practice_id', practiceId).in('patient_id', ids).order('set_at', { ascending: false }).range(from, to)),
    fetchByIds<RawAccountHolderLinkRow>(patientIds, 'family accounts', (ids, from, to) => db
      .from('account_holder_links').select(LINK_COLUMNS).eq('practice_id', practiceId).or(`patient_id.in.(${ids.join(',')}),holder_patient_id.in.(${ids.join(',')})`).order('linked_at', { ascending: false }).range(from, to))
  ]), 'the account');
  return {
    notes: noteRows.map(normalizeContactNote).filter((row): row is ContactNote => row !== null),
    promises: promiseRows.map(normalizePromise).filter((row): row is PaymentPromise => row !== null),
    flags: flagRows.map(normalizeAccountFlag).filter((row): row is AccountFlag => row !== null),
    links: linkRows.map(normalizeAccountHolderLink).filter((row): row is AccountHolderLink => row !== null)
  };
}

export interface AccountAlertData {
  /** Promises not cancelled, made since the day asked for */
  promises: PaymentPromise[];
  /** Standing payments of the account's patients since that day (medical aid payments left out) */
  receipts: ArReceipt[];
  /** Credit-control notes exist on the account holder's file */
  hasNotes: boolean;
}

interface AccountAlertRow {
  id: string;
  payment_promises?: RawPromiseRow[] | null;
  credit_control_notes?: Array<{ id: string }> | null;
  receipts?: RawReceiptRow[] | null;
}

/**
 * What the patient file's alerts need, in one request: the account's promises, whether it has
 * credit-control notes, and its patients' payments since `sinceKey` (they decide whether a promise
 * was kept). Read through each patient row, so RLS keeps it to the practice.
 */
export async function loadAccountAlerts(practiceId: string, accountId: string, patientIds: readonly string[], sinceKey: string): Promise<AccountAlertData> {
  const ids = [...new Set([accountId, ...patientIds].filter(Boolean))];
  const since = /^\d{4}-\d{2}-\d{2}$/.test(sinceKey) ? sinceKey : '2000-01-01';
  const { data, error } = await timed(Promise.resolve(db
    .from('patients')
    .select(
      `id, payment_promises!payment_promises_patient_id_fkey(${PROMISE_COLUMNS}), ` +
      'credit_control_notes!credit_control_notes_patient_id_fkey(id), ' +
      'receipts!receipts_patient_id_fkey(id, receipt_number, patient_id, payer_type, amount, received_on, created_at, reversed_at)'
    )
    .eq('practice_id', practiceId)
    .in('id', ids)
    .eq('payment_promises.practice_id', practiceId)
    .is('payment_promises.cancelled_at', null)
    .gte('payment_promises.made_on', since)
    .eq('credit_control_notes.practice_id', practiceId)
    .limit(1, { referencedTable: 'credit_control_notes' })
    .eq('receipts.practice_id', practiceId)
    .is('receipts.reversed_at', null)
    .neq('receipts.payer_type', 'medical_aid')
    .gte('receipts.received_on', since)), 'the account alerts');
  if (error) throw new ArQueryError('the account alerts', error);
  const rows = (data ?? []) as unknown as AccountAlertRow[];
  return {
    promises: rows.flatMap(row => row.payment_promises ?? []).map(normalizePromise).filter((row): row is PaymentPromise => row !== null),
    receipts: rows.flatMap(row => row.receipts ?? []).map(normalizeReceipt),
    hasNotes: (rows.find(row => row.id === accountId)?.credit_control_notes ?? []).length > 0
  };
}

// ---------------------------------------------------------------------------------------------
// Small-balance write-off runs
// ---------------------------------------------------------------------------------------------

/** One balance of a run: a write-off of the patient portion, tagged with the run (a retry never writes it off twice) */
export const writeOffSmallBalance = (input: { practiceId: string; runId: string; line: SmallBalanceLine; reason: string }) =>
  postAdjustment({
    practiceId: input.practiceId,
    kind: 'write_off',
    invoiceId: input.line.invoiceId,
    portion: 'patient',
    amountCents: input.line.amountCents,
    reason: input.reason,
    reasonCode: SMALL_BALANCE_REASON_CODE,
    externalRef: smallBalanceRef(input.runId, input.line.invoiceId)
  });

interface SmallBalanceRow extends RawAdjustmentRow {
  external_ref?: string | null;
  invoice?: { invoice_number: string | null } | null;
  patient?: { first_name: string | null; last_name: string | null } | null;
}

/** The latest small-balance runs (their last 1,000 write-offs), with invoice numbers and patient names */
export async function loadSmallBalanceRuns(practiceId: string): Promise<{ runs: SmallBalanceRun[]; patientNames: Record<string, string> }> {
  const { data, error } = await timed(Promise.resolve(db
    .from('invoice_adjustments')
    .select(
      `${ADJUSTMENT_COLUMNS}, external_ref, ` +
      'invoice:invoices_enhanced!invoice_adjustments_invoice_id_fkey(invoice_number), ' +
      'patient:patients!invoice_adjustments_patient_id_fkey(first_name, last_name)'
    )
    .eq('practice_id', practiceId)
    .eq('kind', 'write_off')
    .eq('reason_code', SMALL_BALANCE_REASON_CODE)
    .like('external_ref', SMALL_BALANCE_REF_PATTERN)
    .order('created_at', { ascending: false })
    .range(0, 999)), 'small-balance runs');
  if (error) throw new ArQueryError('small-balance runs', error);
  const rows = (data ?? []) as unknown as SmallBalanceRow[];
  const patientNames: Record<string, string> = {};
  for (const row of rows) if (row.patient_id && row.patient) patientNames[row.patient_id] = nameOf(row.patient);
  const runs = groupSmallBalanceRuns(rows.flatMap(row => {
    const adjustment = normalizeAdjustment(row);
    return adjustment ? [{ adjustment, externalRef: row.external_ref ?? null, invoiceNumber: row.invoice?.invoice_number ?? null }] : [];
  }));
  return { runs, patientNames };
}

// ---------------------------------------------------------------------------------------------
// Patients: names, contacts, medical aid plans
// ---------------------------------------------------------------------------------------------

export interface PatientContact {
  id: string;
  name: string;
  cellNumber: string | null;
  email: string | null;
  idNumber: string | null;
  address: string | null;
  /** The patient's reference number, used as the payment reference */
  reference: string | null;
  /** Replied STOP (patients.sms_opt_out); null when the column does not exist yet */
  smsOptOut: boolean | null;
}

const CONTACT_COLUMNS = 'id, first_name, last_name, cell_number, email, id_number, home_address, postal_address, postal_code, system_patient_reference_number';

type ContactRow = Record<string, string | number | boolean | null>;

const toContact = (row: ContactRow, smsOptOut: boolean | null): PatientContact => {
  const text = (key: string) => (typeof row[key] === 'string' ? (row[key] as string).trim() || null : null);
  const postal = [text('postal_address'), text('postal_code')].filter(Boolean).join(' ');
  return {
    id: String(row.id),
    name: nameOf({ first_name: text('first_name'), last_name: text('last_name') }),
    cellNumber: text('cell_number'),
    email: text('email'),
    idNumber: text('id_number'),
    address: text('home_address') ?? (postal || null),
    reference: row.system_patient_reference_number === null || row.system_patient_reference_number === undefined ? null : String(row.system_patient_reference_number),
    smsOptOut
  };
};

/** Contact details of patients of the practice (for statements, reminders and the hand-over list) */
export async function loadPatientContacts(practiceId: string, patientIds: readonly string[]): Promise<Record<string, PatientContact>> {
  if (patientIds.length === 0) return {};
  // The columns are one of two fixed lists; typed as the shorter one so the untyped client keeps plain rows
  const query = (columns: string) => fetchByIds<ContactRow>(patientIds, 'patients', (ids, from, to) => db
    .from('patients').select(columns as typeof CONTACT_COLUMNS).eq('practice_id', practiceId).in('id', ids).order('id').range(from, to));
  let rows: ContactRow[];
  let optOutKnown = true;
  try {
    rows = await timed(query(`${CONTACT_COLUMNS}, sms_opt_out`), 'patients');
  } catch (error) {
    // The SMS opt-out column comes with the two-way SMS proposal; without it, read the rest
    if (!(error instanceof ArQueryError) || error.code !== '42703') throw error;
    optOutKnown = false;
    rows = await timed(query(CONTACT_COLUMNS), 'patients');
  }
  return Object.fromEntries(rows.map(row => [String(row.id), toContact(row, optOutKnown ? row.sms_opt_out === true : null)]));
}

/** Names of patients by id (holders and family members who may owe nothing) */
export async function loadPatientNames(practiceId: string, patientIds: readonly string[]): Promise<Record<string, string>> {
  if (patientIds.length === 0) return {};
  const rows = await timed(fetchByIds<{ id: string; first_name: string | null; last_name: string | null }>(patientIds, 'patients', (ids, from, to) => db
    .from('patients').select('id, first_name, last_name').eq('practice_id', practiceId).in('id', ids).order('id').range(from, to)), 'patients');
  return Object.fromEntries(rows.map(row => [row.id, nameOf(row)]));
}

/** Medical aid fund and plan option per patient (medical_aid_details) */
export async function loadMedicalAidPlans(patientIds: readonly string[]): Promise<{ fundByPatient: Record<string, string>; optionByPatient: Record<string, string> }> {
  const rows = await timed(fetchByIds<{ patient_id: string | null; provider: string | null; plan_type: string | null }>(patientIds, 'medical aid details', (ids, from, to) => db
    .from('medical_aid_details').select('patient_id, provider, plan_type').in('patient_id', ids).order('patient_id').range(from, to)), 'medical aid details');
  const fundByPatient: Record<string, string> = {};
  const optionByPatient: Record<string, string> = {};
  for (const row of rows) {
    if (!row.patient_id) continue;
    if (row.provider?.trim()) fundByPatient[row.patient_id] = row.provider.trim();
    if (row.plan_type?.trim()) optionByPatient[row.patient_id] = row.plan_type.trim();
  }
  return { fundByPatient, optionByPatient };
}

export interface PracticeDetails {
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  payment: PaymentDetails;
}

/** The practice's name, contact and banking details (statements and reminders say how to pay) */
export async function loadPracticeDetails(practiceId: string): Promise<PracticeDetails> {
  const { data, error } = await timed(Promise.resolve(db
    .from('practices')
    .select('name, contact_phone, contact_email, bank_name, account_holder_name, account_number, branch_code')
    .eq('id', practiceId)
    .range(0, 0)), 'the practice');
  if (error) throw new Error(`Could not load the practice: ${error.message}`);
  const row = ((data ?? [])[0] ?? {}) as Record<string, string | null>;
  const text = (value: string | null | undefined) => value?.trim() || null;
  return {
    name: text(row.name) ?? 'The practice',
    contactPhone: text(row.contact_phone),
    contactEmail: text(row.contact_email),
    payment: { bankName: text(row.bank_name), accountHolder: text(row.account_holder_name), accountNumber: text(row.account_number), branchCode: text(row.branch_code) }
  };
}

// ---------------------------------------------------------------------------------------------
// Interest
// ---------------------------------------------------------------------------------------------

export interface InterestRun {
  id: string;
  monthKey: string;
  runOn: string | null;
  annualRatePercent: number;
  totalCents: number;
  lineCount: number;
  createdBy: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
}

export async function loadInterestSettings(practiceId: string): Promise<InterestSettings | null> {
  const { data, error } = await timed(Promise.resolve(db
    .from('debtor_settings')
    .select('interest_enabled, interest_annual_rate, interest_min_age_days, interest_on_medical_aid, interest_minimum')
    .eq('practice_id', practiceId)
    .range(0, 0)), 'interest settings');
  if (error) throw new ArQueryError('interest settings', error);
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    enabled: row.interest_enabled === true,
    annualRatePercent: Number(row.interest_annual_rate ?? 0),
    minAgeDays: Number(row.interest_min_age_days ?? 60),
    includeMedicalAidPortion: row.interest_on_medical_aid === true,
    minimumChargeCents: toCents(row.interest_minimum ?? 1)
  };
}

export async function loadInterestRuns(practiceId: string): Promise<InterestRun[]> {
  const rows = await timed(fetchPages<Record<string, unknown>>('interest runs', (from, to) => db
    .from('interest_runs')
    .select('id, period_month, run_on, annual_rate, total, line_count, created_by, reversed_at, reversal_reason')
    .eq('practice_id', practiceId)
    .order('period_month', { ascending: false })
    .range(from, to)), 'interest runs');
  return rows.map(row => ({
    id: String(row.id),
    monthKey: (dateKeyFrom(row.period_month as string) ?? '').slice(0, 7),
    runOn: dateKeyFrom(row.run_on as string),
    annualRatePercent: Number(row.annual_rate ?? 0),
    totalCents: toCents(row.total),
    lineCount: Number(row.line_count ?? 0),
    createdBy: (row.created_by as string | null) ?? null,
    reversedAt: (row.reversed_at as string | null) ?? null,
    reversalReason: (row.reversal_reason as string | null) ?? null
  }));
}

/** Interest still standing per invoice (correction journals with reason code "interest") */
export async function loadInterestCharged(invoiceIds: readonly string[]): Promise<Record<string, number>> {
  const rows = await timed(fetchByIds<RawAdjustmentRow>(invoiceIds, 'interest charged', (ids, from, to) => db
    .from('invoice_adjustments').select(ADJUSTMENT_COLUMNS).eq('kind', 'journal').eq('reason_code', 'interest').is('reversed_at', null).in('invoice_id', ids).order('id').range(from, to)), 'interest charged');
  const byInvoice: Record<string, number> = {};
  for (const adjustment of rows.map(normalizeAdjustment)) {
    if (!adjustment?.invoiceId) continue;
    byInvoice[adjustment.invoiceId] = (byInvoice[adjustment.invoiceId] ?? 0) + adjustment.amountCents;
  }
  return byInvoice;
}

// ---------------------------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------------------------

export interface SavedStatementCriteria {
  id: string;
  criteria: StatementCriteria;
  updatedAt: string | null;
}

export async function loadStatementCriteria(practiceId: string): Promise<SavedStatementCriteria[]> {
  const rows = await timed(fetchPages<{ id: string; name: string | null; criteria: unknown; updated_at: string | null }>('saved statement runs', (from, to) => db
    .from('statement_criteria').select('id, name, criteria, updated_at').eq('practice_id', practiceId).is('archived_at', null).order('name').range(from, to)), 'saved statement runs');
  return rows.map(row => ({ id: row.id, criteria: parseStatementCriteria(row.criteria, row.name), updatedAt: row.updated_at }));
}

export interface StatementRunRecord {
  id: string;
  name: string;
  asAtKey: string | null;
  startedAt: string;
  finishedAt: string | null;
  planned: Record<string, number>;
  results: Record<string, unknown> | null;
}

/** The latest 50 statement runs */
export async function loadStatementRuns(practiceId: string): Promise<StatementRunRecord[]> {
  const { data, error } = await timed(Promise.resolve(db
    .from('statement_runs').select('id, name, as_at, started_at, finished_at, planned, results').eq('practice_id', practiceId).order('started_at', { ascending: false }).range(0, 49)), 'statement runs');
  if (error) throw new ArQueryError('statement runs', error);
  return ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
    id: String(row.id),
    name: String(row.name ?? 'Statements'),
    asAtKey: dateKeyFrom(row.as_at as string),
    startedAt: String(row.started_at),
    finishedAt: (row.finished_at as string | null) ?? null,
    planned: (row.planned && typeof row.planned === 'object' ? row.planned : {}) as Record<string, number>,
    results: row.results && typeof row.results === 'object' ? (row.results as Record<string, unknown>) : null
  }));
}

/** What a statement needs of an account: its patients' invoices and every entry on them */
export interface StatementAccountData {
  invoices: LedgerInvoice[];
  balances: Record<string, ArInvoiceBalance>;
  receipts: ArReceipt[];
  allocations: ArAllocation[];
  adjustments: ArAdjustment[];
  /** Invoice id -> the funds' authorisation numbers on its lines (parity D15) */
  authorisations: Record<string, string[]>;
}

/**
 * The funds' authorisation numbers on the lines of these invoices (invoice_services.authorisation_number, filled from
 * the patient's authorisation register), per invoice. A statement shows them with the invoice; when they cannot be
 * read the statement goes out without them rather than not at all.
 */
export async function loadInvoiceAuthorisations(invoiceIds: readonly string[]): Promise<Record<string, string[]>> {
  try {
    const rows = await timed(fetchByIds<{ invoice_id: string; authorisation_number: string | null }>(invoiceIds, 'authorisation numbers', (ids, from, to) => db
      .from('invoice_services').select('invoice_id, authorisation_number').in('invoice_id', ids).not('authorisation_number', 'is', null).order('id').range(from, to)), 'authorisation numbers');
    const byInvoice: Record<string, string[]> = {};
    for (const row of rows) {
      const number = row.authorisation_number?.trim();
      if (!number) continue;
      const list = byInvoice[row.invoice_id] ?? [];
      if (!list.includes(number)) list.push(number);
      byInvoice[row.invoice_id] = list;
    }
    return byInvoice;
  } catch {
    return {};
  }
}

/**
 * The entries of many accounts at once (a statement run): the invoices of every patient, their
 * balances, allocations and adjustments, the patients' own receipts, the receipts that paid their
 * invoices, refunds, and the authorisation numbers on the invoices' lines. Grouped by the caller per account.
 */
export async function loadStatementData(practiceId: string, patientIds: readonly string[]): Promise<StatementAccountData> {
  const invoiceRows = await timed(fetchByIds<RawInvoiceRow>(patientIds, 'invoices', (ids, from, to) => db
    .from('invoices_enhanced').select(INVOICE_COLUMNS).eq('practice_id', practiceId).in('patient_id', ids).order('id').range(from, to)), 'invoices');
  // Invoices billed to a company or fund account are on that account's statement, never the patient's (parity A14, A19)
  const allInvoices = invoiceRows.map(normalizeInvoice);
  const billedToAccounts = await invoicesBilledToAccounts(allInvoices);
  const invoices = allInvoices.filter(invoice => !billedToAccounts.has(invoice.id));
  const invoiceIds = invoices.map(invoice => invoice.id);
  const [balanceRows, ownReceiptRows, allocationRows, adjustmentRows, authorisations] = await timed(Promise.all([
    fetchByIds<RawInvoiceBalanceRow>(invoiceIds, 'balances', (ids, from, to) => db
      .from('ar_invoice_balances').select(BALANCE_COLUMNS).in('invoice_id', ids).order('invoice_id').range(from, to)),
    fetchByIds<RawReceiptRow>(patientIds, 'receipts', (ids, from, to) => db
      .from('ar_receipt_balances').select(RECEIPT_COLUMNS).eq('practice_id', practiceId).in('patient_id', ids).order('receipt_id').range(from, to)),
    fetchByIds<RawAllocationRow>(invoiceIds, 'allocations', (ids, from, to) => db
      .from('receipt_allocations').select(ALLOCATION_COLUMNS).in('invoice_id', ids).order('id').range(from, to)),
    fetchByIds<RawAdjustmentRow>(invoiceIds, 'adjustments', (ids, from, to) => db
      .from('invoice_adjustments').select(ADJUSTMENT_COLUMNS).in('invoice_id', ids).order('id').range(from, to)),
    loadInvoiceAuthorisations(invoiceIds)
  ]), 'statements');
  const ownReceiptIds = ownReceiptRows.map(row => row.receipt_id ?? '').filter(Boolean);
  const otherReceiptIds = [...new Set(allocationRows.map(row => row.receipt_id ?? ''))].filter(id => id && !ownReceiptIds.includes(id));
  const knownAllocations = new Set(allocationRows.map(row => row.id));
  const [otherReceipts, ownAllocations, refunds] = await timed(Promise.all([
    fetchByIds<RawReceiptRow>(otherReceiptIds, 'receipts', (ids, from, to) => db
      .from('ar_receipt_balances').select(RECEIPT_COLUMNS).in('receipt_id', ids).order('receipt_id').range(from, to)),
    fetchByIds<RawAllocationRow>(ownReceiptIds, 'allocations', (ids, from, to) => db
      .from('receipt_allocations').select(ALLOCATION_COLUMNS).in('receipt_id', ids).order('id').range(from, to)),
    fetchByIds<RawAdjustmentRow>(ownReceiptIds, 'refunds', (ids, from, to) => db
      .from('invoice_adjustments').select(ADJUSTMENT_COLUMNS).eq('kind', 'refund').in('receipt_id', ids).order('id').range(from, to))
  ]), 'statements');
  // Each payment with the invoice lines it covered (the statement says so)
  const allocations = await timed(withCovers([...allocationRows, ...ownAllocations.filter(row => !knownAllocations.has(row.id))]
    .map(normalizeAllocation).filter((row): row is ArAllocation => row !== null)), 'statements');
  return {
    invoices,
    balances: Object.fromEntries(balanceRows.map(row => [row.invoice_id, normalizeInvoiceBalance(row)])),
    receipts: [...ownReceiptRows, ...otherReceipts].map(normalizeReceipt),
    allocations,
    adjustments: [...adjustmentRows, ...refunds].map(normalizeAdjustment).filter((row): row is ArAdjustment => row !== null),
    authorisations
  };
}

// ---------------------------------------------------------------------------------------------
// Writes (one dc_ function each)
// ---------------------------------------------------------------------------------------------

export const linkAccountHolder = (practiceId: string, patientId: string, holderId: string, relationship: AccountRelationship) =>
  callRpc<{ id: string }>('dc_link_account_holder', { p_practice_id: practiceId, p_patient_id: patientId, p_holder_id: holderId, p_relationship: relationship }, 'Linking the account holder');

export const unlinkAccountHolder = (practiceId: string, patientId: string, reason: string) =>
  callRpc<{ id: string }>('dc_unlink_account_holder', { p_practice_id: practiceId, p_patient_id: patientId, p_reason: reason.trim() }, 'Removing the patient from the account');

/** What dc_move_account_holder answers: how many patients moved; already = it moved before; nothing = no family account */
export interface AccountMoveResult {
  moved: number;
  already?: boolean;
  nothing?: boolean;
}

/**
 * Moves the whole family account of `fromHolderId` to `toPatientId` in one step (proposals/2026-10-12-family-account-move.sql):
 * every old link closed with the reason, the old holder (as `relationship`) and the rest of the family linked to the new one.
 */
export const moveAccountHolder = (practiceId: string, fromHolderId: string, toPatientId: string, relationship: AccountRelationship, reason: string) =>
  callRpc<AccountMoveResult>('dc_move_account_holder', {
    p_practice_id: practiceId,
    p_from_holder_id: fromHolderId,
    p_to_patient_id: toPatientId,
    p_relationship: relationship,
    p_reason: reason.trim()
  }, 'Moving the family account');

/** The links in force (not unlinked) where these patients pay or are paid for; [] before the debtors proposal */
export async function loadOpenAccountLinks(practiceId: string, patientIds: readonly string[]): Promise<AccountHolderLink[]> {
  const ids = [...new Set(patientIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const list = ids.join(',');
  try {
    const rows = await fetchPages<RawAccountHolderLinkRow>('family accounts', (from, to) => db
      .from('account_holder_links').select('id, patient_id, holder_patient_id, relationship, linked_by, linked_at, unlinked_at, unlink_reason')
      .eq('practice_id', practiceId).is('unlinked_at', null)
      .or(`patient_id.in.(${list}),holder_patient_id.in.(${list})`).order('id').range(from, to));
    return rows.map(normalizeAccountHolderLink).filter((row): row is AccountHolderLink => row !== null);
  } catch (error) {
    if (isArNotSetUp(error)) return [];
    throw error;
  }
}

/** The JSON dc_set_account_flag takes: the amount as exact 2-decimal text, the value and reason trimmed */
export function flagPayload(input: { kind: AccountFlagKind; amountCents?: number | null; value?: string | null; reason: string }): Record<string, string> {
  const payload: Record<string, string> = { reason: input.reason.trim() };
  if (input.kind === 'credit_limit' && input.amountCents !== null && input.amountCents !== undefined) payload.amount = centsToAmountText(input.amountCents);
  if ((input.kind === 'statement_language' || input.kind === 'alert' || input.kind === 'statement_message') && input.value?.trim()) payload.value = input.value.trim();
  return payload;
}

export const setAccountFlag = (practiceId: string, patientId: string, input: Parameters<typeof flagPayload>[0]) =>
  callRpc<{ id: string; patient_id: string }>('dc_set_account_flag', { p_practice_id: practiceId, p_patient_id: patientId, p_flag: input.kind, p_payload: flagPayload(input) }, 'Saving the flag');

export const clearAccountFlag = (practiceId: string, patientId: string, kind: AccountFlagKind, reason: string) =>
  callRpc<{ id: string }>('dc_clear_account_flag', { p_practice_id: practiceId, p_patient_id: patientId, p_flag: kind, p_reason: reason.trim() }, 'Clearing the flag');

/**
 * A practice administrator invoices above the account's credit limit: their reason is kept on the account as a
 * credit-control note (proposals/2026-10-09-account-flags-billing.sql; the database checks the role again)
 */
export const recordCreditLimitOverride = (practiceId: string, patientId: string, invoiceCents: number, reason: string) =>
  callRpc<{ id: string }>('dc_record_credit_limit_override', {
    p_practice_id: practiceId,
    p_patient_id: patientId,
    p_payload: { invoice_amount: centsToAmountText(invoiceCents), reason: reason.trim() }
  }, 'Recording the reason');

export const setSmsOptOut = (practiceId: string, patientId: string, optOut: boolean) =>
  callRpc<{ sms_opt_out: boolean }>('dc_set_sms_opt_out', { p_practice_id: practiceId, p_patient_id: patientId, p_opt_out: optOut }, 'Saving the SMS choice');

export const addContactNote = (practiceId: string, patientId: string, channel: ContactChannel, note: string) =>
  callRpc<{ id: string }>('dc_add_contact_note', { p_practice_id: practiceId, p_patient_id: patientId, p_channel: channel, p_note: note.trim() }, 'Saving the note');

export const recordPromise = (practiceId: string, patientId: string, input: { amountCents: number; promisedOn: string; note: string }) =>
  callRpc<{ id: string; replaced: number }>('dc_record_promise', {
    p_practice_id: practiceId,
    p_patient_id: patientId,
    p_payload: { amount: centsToAmountText(input.amountCents), promised_on: input.promisedOn, note: input.note.trim() || null }
  }, 'Saving the promise');

export const cancelPromise = (promiseId: string, reason: string) =>
  callRpc<{ id: string }>('dc_cancel_promise', { p_promise_id: promiseId, p_reason: reason.trim() }, 'Cancelling the promise');

export const saveInterestSettings = (practiceId: string, settings: InterestSettings) =>
  callRpc<{ practice_id: string }>('dc_save_debtor_settings', {
    p_practice_id: practiceId,
    p_payload: {
      interest_enabled: settings.enabled,
      interest_annual_rate: settings.annualRatePercent,
      interest_min_age_days: settings.minAgeDays,
      interest_on_medical_aid: settings.includeMedicalAidPortion,
      interest_minimum: centsToAmountText(settings.minimumChargeCents)
    }
  }, 'Saving the interest settings');

export const postInterestRun = (practiceId: string, lines: ReadonlyArray<{ invoiceId: string; interestCents: number }>) =>
  callRpc<{ id: string; total: number | string; line_count: number }>('dc_post_interest_run', {
    p_practice_id: practiceId,
    p_payload: { lines: lines.map(line => ({ invoice_id: line.invoiceId, interest: centsToAmountText(line.interestCents) })) }
  }, 'Charging the interest');

export const reverseInterestRun = (runId: string, reason: string) =>
  callRpc<{ id: string }>('dc_reverse_interest_run', { p_run_id: runId, p_reason: reason.trim() }, 'Reversing the interest');

export const saveStatementCriteria = (practiceId: string, id: string | null, criteria: StatementCriteria, json: Record<string, unknown>) =>
  callRpc<{ id: string }>('dc_save_statement_criteria', { p_practice_id: practiceId, p_id: id, p_name: criteria.name.trim(), p_criteria: json }, 'Saving the statement run');

export const archiveStatementCriteria = (id: string) =>
  callRpc<{ id: string }>('dc_archive_statement_criteria', { p_id: id }, 'Removing the saved run');

export const startStatementRun = (practiceId: string, payload: Record<string, unknown>) =>
  callRpc<{ id: string }>('dc_start_statement_run', { p_practice_id: practiceId, p_payload: payload }, 'Starting the statement run');

export const finishStatementRun = (runId: string, results: Record<string, unknown>) =>
  callRpc<{ id: string }>('dc_finish_statement_run', { p_run_id: runId, p_results: results }, 'Recording the statement run');
