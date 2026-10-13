import { formatNad, fromCents } from '../../utils/billing/money';
import { dateKeyFrom, isInRange, type DateRange } from './dates';
import { normalizePaymentMethod, type PaymentMethodKey } from './invoices';
import { toCents } from './money';
import { isEffective, type ArAdjustment, type ArReceipt, type ReceiptMethod } from './arModel';
import { TAKINGS_METHODS } from './takings';
import type { ControlSummary } from './ledgerMovements';
import type { RuleResult } from './arRules';

// ---------------------------------------------------------------------------------------------
// Cash-up (day end): what each cashier took, the till count, and the deposit slip for the bank.
// The rules here and in proposals/2026-10-07-debtors-and-controls.sql are the same; the database
// enforces them again. All amounts are whole cents.
// ---------------------------------------------------------------------------------------------

const ok: RuleResult = { ok: true, error: null };
const fail = (error: string): RuleResult => ({ ok: false, error });
const nad = (cents: number): string => formatNad(fromCents(cents));

// ---------------------------------------------------------------------------------------------
// Cashier report: receipts per person who captured them, by method
// ---------------------------------------------------------------------------------------------

export interface CashierLine {
  /** Who captured the receipts (auth user id); null for receipts with no recorded user */
  userId: string | null;
  /** Receipts still standing, per method */
  byMethod: Record<PaymentMethodKey, number>;
  receivedCents: number;
  receiptCount: number;
  /** Refunds this person paid out in the range (still standing) */
  refundCents: number;
  cashRefundCents: number;
  /** Receipts this person captured in the range that have been reversed (not counted above) */
  reversedCount: number;
  reversedCents: number;
  /** Cash to hand over: cash receipts less cash refunds */
  expectedCashCents: number;
  /** Received less refunds */
  netCents: number;
}

export interface CashierReport {
  range: DateRange;
  /** One line per cashier, most money first */
  lines: CashierLine[];
  totals: CashierLine;
}

const zeroByMethod = (): Record<PaymentMethodKey, number> =>
  Object.fromEntries(TAKINGS_METHODS.map(method => [method, 0])) as Record<PaymentMethodKey, number>;

const emptyLine = (userId: string | null): CashierLine => ({
  userId,
  byMethod: zeroByMethod(),
  receivedCents: 0,
  receiptCount: 0,
  refundCents: 0,
  cashRefundCents: 0,
  reversedCount: 0,
  reversedCents: 0,
  expectedCashCents: 0,
  netCents: 0
});

/**
 * Receipts dated in the range per person who captured them and per method, with the refunds each
 * paid out. A reversed receipt never counts (for example an EFT captured twice), as in daily
 * takings, but it is listed per person so a reversal cannot hide a missing payment.
 */
export function cashierReport(receipts: readonly ArReceipt[], refunds: readonly ArAdjustment[], range: DateRange): CashierReport {
  const lines = new Map<string, CashierLine>();
  const lineFor = (userId: string | null): CashierLine => {
    const key = userId ?? '';
    const line = lines.get(key) ?? emptyLine(userId);
    lines.set(key, line);
    return line;
  };
  const totals = emptyLine(null);

  for (const receipt of receipts) {
    if (!isInRange(receipt.receivedOn, range)) continue;
    const line = lineFor(receipt.createdBy);
    if (!isEffective(receipt)) {
      line.reversedCount += 1;
      line.reversedCents += receipt.amountCents;
      totals.reversedCount += 1;
      totals.reversedCents += receipt.amountCents;
      continue;
    }
    const method = normalizePaymentMethod(receipt.method);
    for (const target of [line, totals]) {
      target.byMethod[method] += receipt.amountCents;
      target.receivedCents += receipt.amountCents;
      target.receiptCount += 1;
      if (receipt.method === 'cash') target.expectedCashCents += receipt.amountCents;
    }
  }
  for (const refund of refunds) {
    if (refund.kind !== 'refund' || !isEffective(refund) || !isInRange(refund.effectiveOn, range)) continue;
    const line = lineFor(refund.createdBy);
    for (const target of [line, totals]) {
      target.refundCents += refund.amountCents;
      if (refund.method === 'cash') {
        target.cashRefundCents += refund.amountCents;
        target.expectedCashCents -= refund.amountCents;
      }
    }
  }
  for (const line of [...lines.values(), totals]) line.netCents = line.receivedCents - line.refundCents;

  return {
    range,
    lines: [...lines.values()].sort((a, b) => b.receivedCents - a.receivedCents || (a.userId ?? '').localeCompare(b.userId ?? '')),
    totals
  };
}

// ---------------------------------------------------------------------------------------------
// Cash-up: the day's figures as they were when the day was closed, and the till count
// ---------------------------------------------------------------------------------------------

/** The day's figures kept with the cash-up, to see later whether anything was added to that day */
export interface CashUpSnapshot {
  receiptCount: number;
  receiptsCents: number;
  refundsCents: number;
  receiptReversalsCents: number;
  invoicesBilledCents: number;
  netMovementCents: number;
  expectedCashCents: number;
}

export interface CashUpRecord {
  id: string;
  /** The business day closed (yyyy-MM-dd) */
  dateKey: string;
  expectedCashCents: number;
  countedCashCents: number;
  /** counted - expected: positive = more cash than expected */
  differenceCents: number;
  snapshot: CashUpSnapshot | null;
  notes: string | null;
  closedBy: string | null;
  closedAt: string | null;
  /** A later count of the same day replaced this one */
  supersededAt: string | null;
  supersededBy: string | null;
  supersedeReason: string | null;
}

export interface RawCashUpRow {
  id: string;
  business_date?: string | null;
  expected_cash?: number | string | null;
  counted_cash?: number | string | null;
  difference?: number | string | null;
  totals?: unknown;
  notes?: string | null;
  closed_by?: string | null;
  closed_at?: string | null;
  superseded_at?: string | null;
  superseded_by?: string | null;
  supersede_reason?: string | null;
}

const numberField = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** Snapshot stored as JSON: amounts in cents */
export function parseCashUpSnapshot(value: unknown): CashUpSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  return {
    receiptCount: numberField(row.receipt_count),
    receiptsCents: numberField(row.receipts_cents),
    refundsCents: numberField(row.refunds_cents),
    receiptReversalsCents: numberField(row.receipt_reversals_cents),
    invoicesBilledCents: numberField(row.invoices_billed_cents),
    netMovementCents: numberField(row.net_movement_cents),
    expectedCashCents: numberField(row.expected_cash_cents)
  };
}

/** The JSON stored with a cash-up (snake case, cents) */
export function snapshotJson(snapshot: CashUpSnapshot): Record<string, number> {
  return {
    receipt_count: snapshot.receiptCount,
    receipts_cents: snapshot.receiptsCents,
    refunds_cents: snapshot.refundsCents,
    receipt_reversals_cents: snapshot.receiptReversalsCents,
    invoices_billed_cents: snapshot.invoicesBilledCents,
    net_movement_cents: snapshot.netMovementCents,
    expected_cash_cents: snapshot.expectedCashCents
  };
}

export function normalizeCashUp(row: RawCashUpRow): CashUpRecord | null {
  const dateKey = dateKeyFrom(row.business_date);
  if (!dateKey) return null;
  return {
    id: row.id,
    dateKey,
    expectedCashCents: toCents(row.expected_cash),
    countedCashCents: toCents(row.counted_cash),
    differenceCents: toCents(row.difference),
    snapshot: parseCashUpSnapshot(row.totals),
    notes: row.notes?.trim() || null,
    closedBy: row.closed_by ?? null,
    closedAt: row.closed_at ?? null,
    supersededAt: row.superseded_at ?? null,
    supersededBy: row.superseded_by ?? null,
    supersedeReason: row.supersede_reason?.trim() || null
  };
}

/** The cash-up that counts for each day: the latest one not replaced */
export function activeCashUps(records: readonly CashUpRecord[]): Map<string, CashUpRecord> {
  const byDay = new Map<string, CashUpRecord>();
  for (const record of records) {
    if (record.supersededAt) continue;
    const current = byDay.get(record.dateKey);
    if (!current || (record.closedAt ?? '') > (current.closedAt ?? '')) byDay.set(record.dateKey, record);
  }
  return byDay;
}

export function snapshotOf(summary: ControlSummary): CashUpSnapshot {
  return {
    receiptCount: summary.receipts.count,
    receiptsCents: summary.receipts.cents,
    refundsCents: summary.refunds.cents,
    receiptReversalsCents: summary.receiptReversals.cents,
    invoicesBilledCents: summary.invoices.billedCents,
    netMovementCents: summary.netMovementCents,
    expectedCashCents: summary.cash.expectedCents
  };
}

export interface SnapshotChange {
  label: string;
  beforeCents: number;
  nowCents: number;
}

/**
 * What changed on a day since it was cashed up: a receipt captured later but dated that day, a
 * reversal, an invoice raised for that day. Empty when the day is as it was closed.
 */
export function changesSinceCashUp(snapshot: CashUpSnapshot | null, now: CashUpSnapshot): SnapshotChange[] {
  if (!snapshot) return [];
  const fields: Array<[string, keyof CashUpSnapshot]> = [
    ['Payments received', 'receiptsCents'],
    ['Refunds paid out', 'refundsCents'],
    ['Payments reversed', 'receiptReversalsCents'],
    ['Invoices raised', 'invoicesBilledCents'],
    ['Cash expected in the till', 'expectedCashCents']
  ];
  return fields
    .filter(([, key]) => snapshot[key] !== now[key])
    .map(([label, key]) => ({ label, beforeCents: snapshot[key], nowCents: now[key] }));
}

export type CashVariance = 'balanced' | 'over' | 'short';

export function cashVariance(expectedCents: number, countedCents: number): { differenceCents: number; status: CashVariance } {
  const differenceCents = countedCents - expectedCents;
  return { differenceCents, status: differenceCents === 0 ? 'balanced' : differenceCents > 0 ? 'over' : 'short' };
}

/**
 * A cash count before the day is closed: an amount in cents (zero is a valid count), a note when
 * the till is over or short (an unexplained difference is what an auditor asks about), and a
 * reason when it replaces an earlier count of the same day.
 */
export function checkCashCount(input: { countedCents: number | null; expectedCents: number; notes: string; replacing: boolean; replaceReason: string }): RuleResult {
  if (input.countedCents === null || !Number.isInteger(input.countedCents) || input.countedCents < 0) {
    return fail('Enter the cash counted in the till in N$ and cents (0 if there is none)');
  }
  const { differenceCents } = cashVariance(input.expectedCents, input.countedCents);
  if (differenceCents !== 0 && !input.notes.trim()) {
    return fail(`The till is ${differenceCents > 0 ? 'over' : 'short'} by ${nad(Math.abs(differenceCents))}. Say why in the note before closing the day.`);
  }
  if (input.replacing && !input.replaceReason.trim()) {
    return fail('This day was already cashed up. Say why it is counted again.');
  }
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Deposit slips: cash (and cheques, once receipts record them) taken to the bank
// ---------------------------------------------------------------------------------------------

/**
 * Receipt methods that end up in a bank deposit. Cards, EFTs, debit orders and medical aid
 * payments reach the bank by themselves. Receipts have no cheque method yet; add 'cheque' here
 * when they do.
 */
export const BANKABLE_METHODS: readonly ReceiptMethod[] = ['cash'];
export const isBankable = (method: ReceiptMethod): boolean => BANKABLE_METHODS.includes(method);

export type DepositStatus = 'prepared' | 'deposited' | 'cancelled';

export interface BankDeposit {
  id: string;
  number: string;
  status: DepositStatus;
  /** The day the slip was prepared */
  preparedOn: string | null;
  depositedOn: string | null;
  bankReference: string | null;
  receiptIds: string[];
  /** Cash refunds paid from the till before banking: they reduce the deposit */
  refundIds: string[];
  amountCents: number;
  notes: string | null;
  preparedBy: string | null;
  preparedAt: string | null;
  depositedBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface RawDepositRow {
  id: string;
  deposit_number?: string | null;
  status?: string | null;
  prepared_on?: string | null;
  deposited_on?: string | null;
  bank_reference?: string | null;
  amount?: number | string | null;
  notes?: string | null;
  prepared_by?: string | null;
  prepared_at?: string | null;
  deposited_by?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

export interface RawDepositItemRow {
  deposit_id: string;
  receipt_id?: string | null;
  refund_id?: string | null;
}

const DEPOSIT_STATUSES: readonly DepositStatus[] = ['prepared', 'deposited', 'cancelled'];

export function normalizeDeposit(row: RawDepositRow, items: readonly RawDepositItemRow[]): BankDeposit {
  const own = items.filter(item => item.deposit_id === row.id);
  return {
    id: row.id,
    number: row.deposit_number?.trim() || 'Unnumbered',
    status: DEPOSIT_STATUSES.includes(row.status as DepositStatus) ? (row.status as DepositStatus) : 'prepared',
    preparedOn: dateKeyFrom(row.prepared_on),
    depositedOn: dateKeyFrom(row.deposited_on),
    bankReference: row.bank_reference?.trim() || null,
    receiptIds: own.map(item => item.receipt_id ?? '').filter(Boolean),
    refundIds: own.map(item => item.refund_id ?? '').filter(Boolean),
    amountCents: toCents(row.amount),
    notes: row.notes?.trim() || null,
    preparedBy: row.prepared_by ?? null,
    preparedAt: row.prepared_at ?? null,
    depositedBy: row.deposited_by ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancelReason: row.cancel_reason?.trim() || null
  };
}

/** A deposit holds its receipts and refunds until it is cancelled */
const holds = (deposit: BankDeposit): boolean => deposit.status !== 'cancelled';

export interface DepositCandidates {
  receipts: ArReceipt[];
  refunds: ArAdjustment[];
  /** Cash to take to the bank: the receipts less the refunds */
  totalCents: number;
}

/**
 * What is waiting to be banked up to a day: standing bankable receipts and standing cash refunds
 * that are on no slip yet (a cancelled slip frees its entries). Oldest first.
 */
export function depositCandidates(receipts: readonly ArReceipt[], refunds: readonly ArAdjustment[], deposits: readonly BankDeposit[], upToKey: string): DepositCandidates {
  const onSlip = new Set(deposits.filter(holds).flatMap(deposit => [...deposit.receiptIds, ...deposit.refundIds]));
  const waitingReceipts = receipts
    .filter(receipt => isEffective(receipt) && isBankable(receipt.method) && !onSlip.has(receipt.id) && !!receipt.receivedOn && receipt.receivedOn <= upToKey)
    .sort((a, b) => (a.receivedOn ?? '').localeCompare(b.receivedOn ?? '') || a.number.localeCompare(b.number, undefined, { numeric: true }));
  const waitingRefunds = refunds
    .filter(refund => refund.kind === 'refund' && refund.method === 'cash' && isEffective(refund) && !onSlip.has(refund.id) && !!refund.effectiveOn && refund.effectiveOn <= upToKey)
    .sort((a, b) => (a.effectiveOn ?? '').localeCompare(b.effectiveOn ?? '') || a.number.localeCompare(b.number, undefined, { numeric: true }));
  return { receipts: waitingReceipts, refunds: waitingRefunds, totalCents: depositAmountCents(waitingReceipts, waitingRefunds) };
}

export const depositAmountCents = (receipts: ReadonlyArray<Pick<ArReceipt, 'amountCents'>>, refunds: ReadonlyArray<Pick<ArAdjustment, 'amountCents'>>): number =>
  receipts.reduce((sum, receipt) => sum + receipt.amountCents, 0) - refunds.reduce((sum, refund) => sum + refund.amountCents, 0);

/** A slip needs at least one receipt and a positive amount to bank */
export function checkDepositSlip(receipts: ReadonlyArray<Pick<ArReceipt, 'amountCents' | 'method' | 'reversal'>>, refunds: ReadonlyArray<Pick<ArAdjustment, 'amountCents'>>): RuleResult {
  if (receipts.length === 0) return fail('Choose the receipts that go to the bank');
  if (receipts.some(receipt => receipt.reversal)) return fail('A reversed receipt cannot be banked');
  if (receipts.some(receipt => !isBankable(receipt.method))) return fail('Only cash goes on a deposit slip; cards, EFTs and medical aid payments reach the bank by themselves');
  if (depositAmountCents(receipts, refunds) <= 0) return fail('The refunds are more than the cash: there is nothing to bank');
  return ok;
}

/** Marking a slip deposited: the bank's reference and the day it was banked (not in the future, not before the slip) */
export function checkMarkDeposited(input: { status: DepositStatus; bankReference: string; depositedOn: string; preparedOn: string | null; todayKey: string }): RuleResult {
  if (input.status === 'deposited') return fail('This slip is already marked deposited');
  if (input.status === 'cancelled') return fail('This slip was cancelled; prepare a new one');
  if (!input.bankReference.trim()) return fail('Enter the bank reference from the deposit slip or the bank app');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.depositedOn)) return fail('Choose the day the money was banked');
  if (input.depositedOn > input.todayKey) return fail('The deposit date cannot be in the future');
  if (input.preparedOn && input.depositedOn < input.preparedOn) return fail('The money cannot be banked before the slip was prepared');
  return ok;
}

/** Problems with a slip that is not banked yet: entries reversed after it was prepared */
export function depositWarnings(deposit: BankDeposit, receiptsById: ReadonlyMap<string, ArReceipt>, refundsById: ReadonlyMap<string, ArAdjustment>): string[] {
  if (deposit.status !== 'prepared') return [];
  const warnings: string[] = [];
  for (const id of deposit.receiptIds) {
    const receipt = receiptsById.get(id);
    if (receipt?.reversal) warnings.push(`Receipt ${receipt.number} was reversed after this slip was prepared. Cancel the slip and prepare it again.`);
  }
  for (const id of deposit.refundIds) {
    const refund = refundsById.get(id);
    if (refund?.reversal) warnings.push(`Refund ${refund.number} was reversed after this slip was prepared. Cancel the slip and prepare it again.`);
  }
  return warnings;
}
