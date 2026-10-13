import { formatNad, fromCents } from '../../utils/billing/money';
import { dateKeyFrom } from './dates';
import { toCents } from './money';
import { isEffective, type ArReceipt } from './arModel';
import type { RuleResult } from './arRules';
import { AGE_BANDS, ageBandFor, type AgeBand, type AgingReport } from './receivables';
import type { AgeAnalysisRow, BandCents } from './ageAnalysis';
import type { AccountFlag, AccountFlagKind } from './accountFlags';

// ---------------------------------------------------------------------------------------------
// Credit control: contact notes, promises to pay, the collections work list, interest on overdue
// private accounts and the hand-over list for debt collectors. Everything is per account: whoever
// pays (a family account's holder, else the patient), so notes and promises are kept on the account
// holder's file and every family member's payment counts. Flags are in accountFlags.ts. All amounts
// are whole cents; the database keeps notes and promises append-only
// (proposals/2026-10-07-debtors-and-controls.sql).
// ---------------------------------------------------------------------------------------------

const ok: RuleResult = { ok: true, error: null };
const fail = (error: string): RuleResult => ({ ok: false, error });
const nad = (cents: number): string => formatNad(fromCents(cents));

// ---------------------------------------------------------------------------------------------
// Contact notes
// ---------------------------------------------------------------------------------------------

export type ContactChannel = 'call' | 'sms' | 'email' | 'in_person' | 'letter' | 'other';
export const CONTACT_CHANNELS: ReadonlyArray<{ value: ContactChannel; label: string }> = [
  { value: 'call', label: 'Phone call' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'in_person', label: 'In person' },
  { value: 'letter', label: 'Letter' },
  { value: 'other', label: 'Other' }
];

export interface ContactNote {
  id: string;
  /** The account the note is about: the account holder's patient id (the patient when they pay for themselves) */
  patientId: string;
  channel: ContactChannel;
  note: string;
  createdBy: string | null;
  createdAt: string;
}

export interface RawContactNoteRow {
  id: string;
  patient_id?: string | null;
  channel?: string | null;
  note?: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

export function normalizeContactNote(row: RawContactNoteRow): ContactNote | null {
  if (!row.patient_id || !row.created_at || !row.note?.trim()) return null;
  const channel = CONTACT_CHANNELS.some(option => option.value === row.channel) ? (row.channel as ContactChannel) : 'other';
  return { id: row.id, patientId: row.patient_id, channel, note: row.note.trim(), createdBy: row.created_by ?? null, createdAt: row.created_at };
}

export const NOTE_MAX_LENGTH = 2000;

export function checkContactNote(note: string): RuleResult {
  const text = note.trim();
  if (text.length < 3) return fail('Write what was said or agreed');
  if (text.length > NOTE_MAX_LENGTH) return fail(`Keep the note under ${NOTE_MAX_LENGTH} characters`);
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Promises to pay
// ---------------------------------------------------------------------------------------------

export interface PaymentPromise {
  id: string;
  /** The account that promised: the account holder's patient id (the patient when they pay for themselves) */
  patientId: string;
  /** The day the promise was made */
  madeOn: string;
  /** The day the money was promised by */
  promisedOn: string;
  amountCents: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface RawPromiseRow {
  id: string;
  patient_id?: string | null;
  made_on?: string | null;
  promised_on?: string | null;
  amount?: number | string | null;
  note?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

export function normalizePromise(row: RawPromiseRow): PaymentPromise | null {
  const madeOn = dateKeyFrom(row.made_on) ?? dateKeyFrom(row.created_at);
  const promisedOn = dateKeyFrom(row.promised_on);
  if (!row.patient_id || !madeOn || !promisedOn) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    madeOn,
    promisedOn,
    amountCents: toCents(row.amount),
    note: row.note?.trim() || null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancelReason: row.cancel_reason?.trim() || null
  };
}

export type PromiseState = 'open' | 'due_today' | 'kept' | 'broken' | 'cancelled';

export const PROMISE_STATE_LABELS: Record<PromiseState, string> = {
  open: 'Promised',
  due_today: 'Due today',
  kept: 'Kept',
  broken: 'Broken',
  cancelled: 'Cancelled'
};

export interface PromiseStatus {
  state: PromiseState;
  /** Paid on the account from the day of the promise to the promised day */
  paidCents: number;
  /** Paid after the promised day (a broken promise paid late) */
  paidLateCents: number;
  /** Still short of the promise by the promised day */
  shortCents: number;
}

/** Who pays for a patient (accountOf from familyAccounts); by default every patient pays for themselves */
export type AccountOf = (patientId: string) => string;
const selfPaying: AccountOf = patientId => patientId;

/**
 * Payments that count for an account: standing receipts of any patient on it (the holder or a
 * family member), paid by them or by someone else on their behalf; a medical aid's payment is not
 * the account paying.
 */
export const accountPayments = (receipts: readonly ArReceipt[], accountId: string, accountOf: AccountOf = selfPaying): ArReceipt[] =>
  receipts.filter(receipt => isEffective(receipt) && !!receipt.patientId && accountOf(receipt.patientId) === accountId && receipt.payerType !== 'medical_aid' && !!receipt.receivedOn);

/** The account's last payment: the latest day, and on one day the payment recorded last (work list and patient file) */
export const lastAccountPayment = (receipts: readonly ArReceipt[], accountId: string, accountOf: AccountOf = selfPaying): ArReceipt | null =>
  accountPayments(receipts, accountId, accountOf)
    .sort((a, b) => (b.receivedOn ?? '').localeCompare(a.receivedOn ?? '') || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0] ?? null;

/** Newest promise first: when it was recorded, else the day it was made (the latest promise is the one in force) */
export const newestPromiseFirst = (a: Pick<PaymentPromise, 'createdAt' | 'madeOn'>, b: Pick<PaymentPromise, 'createdAt' | 'madeOn'>): number =>
  (b.createdAt ?? b.madeOn).localeCompare(a.createdAt ?? a.madeOn);

/**
 * Whether a promise was kept: money paid on the account from the day of the promise up to the
 * promised day counts. Before the day passes it is open (or due today); after it, kept when the
 * payments reached the amount, else broken, even if paid later (paid late is shown, the broken
 * promise stays on record: it is what escalation counts).
 */
export function promiseStatus(promise: PaymentPromise, receipts: readonly ArReceipt[], todayKey: string, accountOf: AccountOf = selfPaying): PromiseStatus {
  const payments = accountPayments(receipts, promise.patientId, accountOf);
  const paidCents = payments.filter(receipt => receipt.receivedOn! >= promise.madeOn && receipt.receivedOn! <= promise.promisedOn).reduce((sum, r) => sum + r.amountCents, 0);
  const paidLateCents = payments.filter(receipt => receipt.receivedOn! > promise.promisedOn && receipt.receivedOn! <= todayKey).reduce((sum, r) => sum + r.amountCents, 0);
  const shortCents = Math.max(promise.amountCents - paidCents, 0);
  let state: PromiseState;
  if (promise.cancelledAt) state = 'cancelled';
  else if (shortCents === 0) state = 'kept';
  else if (todayKey > promise.promisedOn) state = 'broken';
  else if (todayKey === promise.promisedOn) state = 'due_today';
  else state = 'open';
  return { state, paidCents, paidLateCents, shortCents };
}

/** A new promise: an amount up to what the account owes, by a day from today on */
export function checkPromise(input: { amountCents: number | null; promisedOn: string; todayKey: string; owedCents: number }): RuleResult {
  if (input.amountCents === null || !Number.isInteger(input.amountCents) || input.amountCents <= 0) return fail('Enter the amount promised in N$ and cents');
  if (input.amountCents > Math.max(input.owedCents, 0)) return fail(`The account owes ${nad(Math.max(input.owedCents, 0))}; a promise cannot be for more`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.promisedOn)) return fail('Choose the day the money was promised by');
  if (input.promisedOn < input.todayKey) return fail('The promised day cannot be in the past');
  return ok;
}

/** How hard to chase: 0 no broken promise, 1 first, 2 second, 3 three or more (consider handing over) */
export type Escalation = 0 | 1 | 2 | 3;
export const ESCALATION_LABELS: Record<Escalation, string> = {
  0: '',
  1: 'First broken promise',
  2: 'Second broken promise',
  3: 'Three or more broken promises: consider handing over'
};

// ---------------------------------------------------------------------------------------------
// Collections work list
// ---------------------------------------------------------------------------------------------

export interface WorkListRow {
  /** The account: the account holder's patient id (the patient when they pay for themselves) */
  patientId: string;
  name: string;
  /** Patients on the account with something owed (family members included) */
  memberIds: string[];
  /** What the account owes in the chosen portion, per band and in total */
  bands: BandCents;
  owedCents: number;
  unallocatedCents: number;
  oldestAgeDays: number | null;
  oldestBand: AgeBand;
  flags: AccountFlagKind[];
  /** The latest promise that is not cancelled, with its status */
  promise: { promise: PaymentPromise; status: PromiseStatus } | null;
  brokenPromises: number;
  escalation: Escalation;
  lastNote: ContactNote | null;
  lastPaymentOn: string | null;
  lastPaymentCents: number;
  /** Days since anyone last noted a contact; null when never */
  daysSinceContact: number | null;
}

export type WorkListView = 'all' | 'broken' | 'due_today' | 'no_recent_contact' | 'disputes' | 'handed_over';

export interface WorkListFilter {
  view: WorkListView;
  /** Only accounts owing something at least this old */
  minAgeDays: number;
  minBalanceCents: number;
  search: string;
}

export const DEFAULT_WORK_LIST_FILTER: WorkListFilter = { view: 'all', minAgeDays: 30, minBalanceCents: 0, search: '' };

/** Days without a contact after which an overdue account shows under "no recent contact" */
export const CONTACT_DUE_DAYS = 30;

const daysFrom = (fromKey: string, toKey: string): number =>
  Math.round((Date.parse(`${toKey}T12:00:00Z`) - Date.parse(`${fromKey}T12:00:00Z`)) / 86400000);

/**
 * The collections clerk's list: accounts that owe money, with what was last said, the promise in
 * force and how often promises were broken. Sorted so the day's work is on top: broken promises,
 * then promises due today, then the oldest and largest debts. Handed-over accounts are only shown
 * in their own view (the collector works them).
 */
export function buildWorkList(input: {
  /** Age analysis rows grouped by account (usually the patient portion) */
  accounts: readonly AgeAnalysisRow[];
  /** Notes and promises of these accounts (kept on the account holder) */
  notes: readonly ContactNote[];
  promises: readonly PaymentPromise[];
  /** Receipts of the accounts' patients (for promises and the last payment) */
  receipts: readonly ArReceipt[];
  /** Who pays for each patient (familyAccounts(...).accountOf) */
  accountOf?: AccountOf;
  todayKey: string;
  filter: WorkListFilter;
}): WorkListRow[] {
  const accountOf = input.accountOf ?? selfPaying;
  const notesByPatient = new Map<string, ContactNote[]>();
  for (const note of input.notes) notesByPatient.set(note.patientId, [...(notesByPatient.get(note.patientId) ?? []), note]);
  const promisesByPatient = new Map<string, PaymentPromise[]>();
  for (const promise of input.promises) promisesByPatient.set(promise.patientId, [...(promisesByPatient.get(promise.patientId) ?? []), promise]);

  const rows: WorkListRow[] = [];
  for (const account of input.accounts) {
    const patientId = account.accountId;
    if (!patientId) continue;
    const promises = (promisesByPatient.get(patientId) ?? []).filter(promise => !promise.cancelledAt);
    const statuses = promises.map(promise => ({ promise, status: promiseStatus(promise, input.receipts, input.todayKey, accountOf) }));
    const brokenPromises = statuses.filter(item => item.status.state === 'broken').length;
    const latest = [...statuses].sort((a, b) => newestPromiseFirst(a.promise, b.promise))[0] ?? null;
    const notes = [...(notesByPatient.get(patientId) ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const lastNote = notes[0] ?? null;
    const lastPayment = lastAccountPayment(input.receipts, patientId, accountOf);
    const lastContactKey = lastNote ? dateKeyFrom(lastNote.createdAt) : null;
    rows.push({
      patientId,
      name: account.label,
      memberIds: account.patientIds,
      bands: account.bands,
      owedCents: account.owedCents,
      unallocatedCents: account.unallocatedCents,
      oldestAgeDays: account.oldestAgeDays,
      oldestBand: ageBandFor(account.oldestAgeDays),
      flags: account.flags,
      promise: latest,
      brokenPromises,
      escalation: (Math.min(brokenPromises, 3) as Escalation),
      lastNote,
      lastPaymentOn: lastPayment?.receivedOn ?? null,
      lastPaymentCents: lastPayment?.amountCents ?? 0,
      daysSinceContact: lastContactKey ? daysFrom(lastContactKey, input.todayKey) : null
    });
  }

  const { filter } = input;
  const term = filter.search.trim().toLowerCase();
  const minBandIndex = AGE_BANDS.findIndex(band => band.key === ageBandFor(filter.minAgeDays));
  const visible = rows.filter(row => {
    if (row.owedCents <= 0 || row.owedCents < filter.minBalanceCents) return false;
    if (filter.minAgeDays > 0 && !AGE_BANDS.slice(minBandIndex).some(band => row.bands[band.key] > 0)) return false;
    if (term && !row.name.toLowerCase().includes(term)) return false;
    const handedOver = row.flags.includes('handed_over');
    switch (filter.view) {
      case 'handed_over':
        return handedOver;
      case 'disputes':
        return row.flags.includes('dispute');
      case 'broken':
        return !handedOver && row.promise?.status.state === 'broken';
      case 'due_today':
        return !handedOver && row.promise?.status.state === 'due_today';
      case 'no_recent_contact':
        return !handedOver && (row.daysSinceContact === null || row.daysSinceContact >= CONTACT_DUE_DAYS);
      case 'all':
        return !handedOver;
    }
  });

  const urgency = (row: WorkListRow): number =>
    row.promise?.status.state === 'broken' ? 0 : row.promise?.status.state === 'due_today' ? 1 : 2;
  const age = (row: WorkListRow): number => (row.oldestAgeDays === null ? Infinity : row.oldestAgeDays);
  return visible.sort((a, b) => urgency(a) - urgency(b) || age(b) - age(a) || b.owedCents - a.owedCents || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------
// Interest on overdue private (patient) balances
// ---------------------------------------------------------------------------------------------

export interface InterestSettings {
  /** Off unless the practice turns it on */
  enabled: boolean;
  /** Yearly rate in percent, e.g. 10.5; charged monthly at a twelfth */
  annualRatePercent: number;
  /** Only debts at least this many days old (by invoice date) */
  minAgeDays: number;
  /** Also charge on medical aid portions the fund has not paid (to the patient). Off unless turned on */
  includeMedicalAidPortion: boolean;
  /** Interest below this per invoice is not charged */
  minimumChargeCents: number;
}

export const DEFAULT_INTEREST_SETTINGS: InterestSettings = {
  enabled: false,
  annualRatePercent: 0,
  minAgeDays: 60,
  includeMedicalAidPortion: false,
  minimumChargeCents: 100
};

/** The rate in hundredths of a percent (10.5% -> 1050); null when not a rate with at most 2 decimals between 0 and 100 */
export function rateBasisPoints(percent: number): number | null {
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
  const points = Math.round(percent * 100);
  return Math.abs(points - percent * 100) < 1e-6 ? points : null;
}

/** One month's interest on a balance at a yearly rate, rounded to the cent (half up) */
export function monthlyInterestCents(baseCents: number, annualBasisPoints: number): number {
  if (baseCents <= 0 || annualBasisPoints <= 0) return 0;
  // base x (bp / 10000) / 12, in integers: half up
  return Math.floor((baseCents * annualBasisPoints + 60000) / 120000);
}

export function checkInterestSettings(settings: InterestSettings): RuleResult {
  if (!settings.enabled) return ok;
  if (rateBasisPoints(settings.annualRatePercent) === null) return fail('Enter a yearly interest rate above 0% and at most 100%, with at most 2 decimals');
  if (!Number.isInteger(settings.minAgeDays) || settings.minAgeDays < 30) return fail('Interest starts on debts at least 30 days old');
  if (!Number.isInteger(settings.minimumChargeCents) || settings.minimumChargeCents < 0) return fail('Enter the smallest charge in N$ and cents');
  return ok;
}

export interface InterestInvoice {
  invoiceId: string;
  invoiceNumber: string;
  patientId: string | null;
  /** Days since the invoice date; null when undated */
  ageDays: number | null;
  patientOwedCents: number;
  medicalAidOwedCents: number;
  /** Interest already charged on this invoice that still stands */
  interestChargedCents: number;
}

/** The invoices an interest run looks at: the aging report (what each portion still owes) and the interest still standing on each */
export const interestInvoices = (report: AgingReport, chargedByInvoice: Readonly<Record<string, number>>): InterestInvoice[] =>
  report.items.map(item => ({
    invoiceId: item.invoice.id,
    invoiceNumber: item.invoice.invoiceNumber,
    patientId: item.invoice.patientId,
    ageDays: item.ageDays,
    patientOwedCents: toCents(item.patient),
    medicalAidOwedCents: toCents(item.medicalAid),
    interestChargedCents: chargedByInvoice[item.invoice.id] ?? 0
  }));

export interface InterestLine {
  invoiceId: string;
  invoiceNumber: string;
  patientId: string;
  /** The capital interest is charged on */
  baseCents: number;
  interestCents: number;
  /** Less than a full month's interest because interest may not exceed the capital (in duplum) */
  capped: boolean;
}

export type InterestExclusionReason =
  | 'interest_off'
  | 'no_patient'
  | 'disputed'
  | 'handed_over'
  | 'lay_bye'
  | 'no_interest'
  | 'too_recent'
  | 'nothing_owed'
  | 'cap_reached'
  | 'below_minimum';

export const INTEREST_EXCLUSION_LABELS: Record<InterestExclusionReason, string> = {
  interest_off: 'Interest is turned off',
  no_patient: 'No patient on the invoice',
  disputed: 'Account in dispute',
  handed_over: 'Handed over (the collector charges)',
  lay_bye: 'Lay-bye (paid off as agreed)',
  no_interest: 'Account marked "No interest"',
  too_recent: 'Not old enough',
  nothing_owed: 'Nothing owed by the patient',
  cap_reached: 'Interest already equals the amount owed',
  below_minimum: 'Below the smallest charge'
};

export interface InterestPlan {
  lines: InterestLine[];
  excluded: Array<{ invoiceId: string; invoiceNumber: string; patientId: string | null; reason: InterestExclusionReason }>;
  totalCents: number;
}

/**
 * One month's interest run. Interest is simple (never on interest already charged), only on what
 * the patient owes (medical aid portions only when the practice turned that on, and then charged
 * to the patient), only on debts at least minAgeDays old, never on disputed, handed-over, lay-bye
 * or "No interest" accounts (dc_post_interest_run refuses the same), and never more in total than
 * the capital still owed (the in duplum rule).
 */
export function planInterestRun(invoices: readonly InterestInvoice[], settings: InterestSettings, flagsByPatient: Readonly<Record<string, readonly AccountFlagKind[]>>): InterestPlan {
  const plan: InterestPlan = { lines: [], excluded: [], totalCents: 0 };
  const points = rateBasisPoints(settings.annualRatePercent);
  for (const invoice of invoices) {
    const exclude = (reason: InterestExclusionReason) => plan.excluded.push({ invoiceId: invoice.invoiceId, invoiceNumber: invoice.invoiceNumber, patientId: invoice.patientId, reason });
    if (!settings.enabled || points === null) { exclude('interest_off'); continue; }
    if (!invoice.patientId) { exclude('no_patient'); continue; }
    const flags = flagsByPatient[invoice.patientId] ?? [];
    if (flags.includes('dispute')) { exclude('disputed'); continue; }
    if (flags.includes('handed_over')) { exclude('handed_over'); continue; }
    if (flags.includes('lay_bye')) { exclude('lay_bye'); continue; }
    if (flags.includes('no_interest')) { exclude('no_interest'); continue; }
    if (invoice.ageDays !== null && invoice.ageDays < settings.minAgeDays) { exclude('too_recent'); continue; }
    const patientOwed = Math.max(invoice.patientOwedCents, 0);
    // Interest already charged and not paid is part of what the patient owes, never capital
    const unpaidInterest = Math.min(Math.max(invoice.interestChargedCents, 0), patientOwed);
    const capital = patientOwed - unpaidInterest + (settings.includeMedicalAidPortion ? Math.max(invoice.medicalAidOwedCents, 0) : 0);
    if (capital <= 0) { exclude('nothing_owed'); continue; }
    const room = capital - unpaidInterest;
    if (room <= 0) { exclude('cap_reached'); continue; }
    const full = monthlyInterestCents(capital, points);
    const interestCents = Math.min(full, room);
    if (interestCents <= 0 || interestCents < settings.minimumChargeCents) { exclude('below_minimum'); continue; }
    plan.lines.push({ invoiceId: invoice.invoiceId, invoiceNumber: invoice.invoiceNumber, patientId: invoice.patientId, baseCents: capital, interestCents, capped: interestCents < full });
    plan.totalCents += interestCents;
  }
  return plan;
}

// ---------------------------------------------------------------------------------------------
// Hand-over list for debt collectors
// ---------------------------------------------------------------------------------------------

export interface HandOverContact {
  name: string;
  idNumber: string | null;
  cellNumber: string | null;
  email: string | null;
  address: string | null;
  reference: string | null;
}

export interface HandOverRow {
  patientId: string;
  contact: HandOverContact;
  owedCents: number;
  bands: BandCents;
  oldestInvoiceAgeDays: number | null;
  lastPaymentOn: string | null;
  lastPaymentCents: number;
  brokenPromises: number;
  handedOverOn: string | null;
  reason: string;
}

/** Accounts flagged handed over, with what the collector needs; largest first */
export function handOverRows(input: {
  workList: readonly WorkListRow[];
  flags: readonly AccountFlag[];
  contacts: Readonly<Record<string, HandOverContact>>;
}): HandOverRow[] {
  const handedOver = new Map(input.flags.filter(flag => flag.flag === 'handed_over' && !flag.clearedAt).map(flag => [flag.patientId, flag]));
  return input.workList
    .filter(row => handedOver.has(row.patientId))
    .map(row => {
      const flag = handedOver.get(row.patientId)!;
      return {
        patientId: row.patientId,
        contact: input.contacts[row.patientId] ?? { name: row.name, idNumber: null, cellNumber: null, email: null, address: null, reference: null },
        owedCents: row.owedCents,
        bands: row.bands,
        oldestInvoiceAgeDays: row.oldestAgeDays,
        lastPaymentOn: row.lastPaymentOn,
        lastPaymentCents: row.lastPaymentCents,
        brokenPromises: row.brokenPromises,
        handedOverOn: dateKeyFrom(flag.setAt),
        reason: flag.reason
      };
    })
    .sort((a, b) => b.owedCents - a.owedCents || a.contact.name.localeCompare(b.contact.name));
}
