import { formatNad, fromCents } from '../../utils/billing/money';
import { formatDayKey } from './periodClose';
import type { ArReceipt } from './arModel';
import { creditByPayer } from './ageAnalysis';
import {
  lastAccountPayment,
  newestPromiseFirst,
  promiseStatus,
  type AccountOf,
  type PaymentPromise,
  type PromiseState
} from './creditControl';

// ---------------------------------------------------------------------------------------------
// The patient file's money at a glance: unallocated credit and the last payment on the Billing
// summary, and the account alerts beside the name when the file opens (a promise to pay that is
// still open or overdue, credit-control notes on record). The rules are the debtors' rules
// (creditByPayer, lastAccountPayment, promiseStatus), so the file and Finance > Debtors agree.
// ---------------------------------------------------------------------------------------------

export interface LastPayment {
  /** yyyy-MM-dd */
  receivedOn: string;
  amountCents: number;
  receiptNumber: string;
}

export interface PatientMoneySummary {
  /** Paid in on the patient's own receipts and not yet used on an invoice */
  creditCents: number;
  /** The latest payment by the patient or someone paying for them (a medical aid's payment is not the patient paying) */
  lastPayment: LastPayment | null;
}

/** Credit and the last payment of one patient, from their receipts (reversed ones never count) */
export function patientMoneySummary(receipts: readonly ArReceipt[], patientId: string): PatientMoneySummary {
  const last = lastAccountPayment(receipts, patientId);
  return {
    creditCents: Math.max(creditByPayer(receipts).byPatient[patientId] ?? 0, 0),
    lastPayment: last?.receivedOn ? { receivedOn: last.receivedOn, amountCents: last.amountCents, receiptNumber: last.number } : null
  };
}

/** The promise states worth an alert on open: still to be paid, due today, or overdue (broken) */
export type PromiseAlertState = Extract<PromiseState, 'open' | 'due_today' | 'broken'>;

export interface PromiseAlert {
  promisedOn: string;
  amountCents: number;
  state: PromiseAlertState;
  /** Still short of the promise */
  shortCents: number;
}

export interface AccountAlerts {
  /** The account's latest promise when it is open, due today or overdue; null when there is none or it was kept */
  promise: PromiseAlert | null;
  /** Credit-control notes exist on the account */
  hasNotes: boolean;
}

/** A promise made longer ago than this is history (the account sheet keeps it), not an alert on open */
export const ACCOUNT_ALERT_WINDOW_DAYS = 365;

/**
 * The alerts shown when a patient file opens. Promises and notes are kept on the account holder's
 * file (whoever pays), so `accountId` is the holder; payments of every family member count towards
 * the promise (accountOf). Only the latest promise matters: a newer promise replaces an older one.
 */
export function accountAlerts(input: {
  accountId: string;
  promises: readonly PaymentPromise[];
  receipts: readonly ArReceipt[];
  accountOf?: AccountOf;
  hasNotes: boolean;
  todayKey: string;
}): AccountAlerts {
  const latest = input.promises
    .filter(promise => promise.patientId === input.accountId && !promise.cancelledAt)
    .sort(newestPromiseFirst)[0] ?? null;
  if (!latest) return { promise: null, hasNotes: input.hasNotes };
  const status = promiseStatus(latest, input.receipts, input.todayKey, input.accountOf);
  const promise = status.state === 'open' || status.state === 'due_today' || status.state === 'broken'
    ? { promisedOn: latest.promisedOn, amountCents: latest.amountCents, state: status.state, shortCents: status.shortCents }
    : null;
  return { promise, hasNotes: input.hasNotes };
}

const nad = (cents: number): string => formatNad(fromCents(cents));

/** The words of the promise alert: what was promised and by when; an overdue one says how much is still short */
export function promiseAlertText(alert: PromiseAlert): string {
  if (alert.state === 'due_today') return `Promised ${nad(alert.amountCents)} today`;
  if (alert.state === 'broken') return `Promise overdue: ${nad(alert.shortCents)} not paid by ${formatDayKey(alert.promisedOn)}`;
  return `Promised ${nad(alert.amountCents)} by ${formatDayKey(alert.promisedOn)}`;
}
