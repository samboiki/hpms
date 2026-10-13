import { fromCents, toCents } from './money';
import { dateKeyFrom, isInRange, type DateRange } from './dates';
import { isPaidInvoice, normalizePaymentMethod, type LedgerInvoice, type PaymentMethodKey } from './invoices';
import { isEffective, type ArAdjustment, type ArReceipt } from './arModel';

// ---------------------------------------------------------------------------------------------
// Daily takings (day-end cash-up)
// ---------------------------------------------------------------------------------------------

/** Payment methods in cash-up order: the till first, then card, EFT and debit orders, then medical aid */
export const TAKINGS_METHODS: readonly PaymentMethodKey[] = ['cash', 'card', 'eft', 'debit_order', 'medical_aid', 'other', 'not_recorded'];

/**
 * The local day an invoice was marked paid. HPMS stores no payment date: marking an invoice paid
 * stamps its updated_at, so that is the payment time (a later edit of a paid invoice moves it).
 */
export const paidDateKey = (invoice: Pick<LedgerInvoice, 'updatedAt'>): string | null => dateKeyFrom(invoice.updatedAt);

export interface TakingsDay {
  dateKey: string;
  /** Amount per payment method; every method is present (zero when nothing was taken that way) */
  byMethod: Record<PaymentMethodKey, number>;
  total: number;
  count: number;
}

export interface DailyTakings {
  /** Days with at least one payment, most recent first */
  days: TakingsDay[];
  byMethod: Record<PaymentMethodKey, number>;
  total: number;
  count: number;
}

const zeroByMethod = (): Record<PaymentMethodKey, number> =>
  Object.fromEntries(TAKINGS_METHODS.map(method => [method, 0])) as Record<PaymentMethodKey, number>;

const centsToAmounts = (cents: Record<PaymentMethodKey, number>): Record<PaymentMethodKey, number> =>
  Object.fromEntries(TAKINGS_METHODS.map(method => [method, fromCents(cents[method])])) as Record<PaymentMethodKey, number>;

/**
 * Paid invoices per day they were marked paid, split by the payment method recorded. Unpaid and
 * cancelled invoices are never takings, whatever their dates. Each invoice counts in full under
 * its one recorded method (HPMS does not record part-payments).
 */
export function dailyTakings(invoices: LedgerInvoice[], range: DateRange): DailyTakings {
  const days = new Map<string, { byMethod: Record<PaymentMethodKey, number>; total: number; count: number }>();
  const byMethod = zeroByMethod();
  let total = 0, count = 0;
  for (const invoice of invoices) {
    if (!isPaidInvoice(invoice)) continue;
    const dateKey = paidDateKey(invoice);
    if (!dateKey || !isInRange(dateKey, range)) continue;
    const method = normalizePaymentMethod(invoice.paymentMethod);
    const cents = toCents(invoice.total);
    const day = days.get(dateKey) ?? { byMethod: zeroByMethod(), total: 0, count: 0 };
    day.byMethod[method] += cents;
    day.total += cents;
    day.count += 1;
    days.set(dateKey, day);
    byMethod[method] += cents;
    total += cents;
    count += 1;
  }
  return {
    days: [...days.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, day]) => ({ dateKey, byMethod: centsToAmounts(day.byMethod), total: fromCents(day.total), count: day.count })),
    byMethod: centsToAmounts(byMethod),
    total: fromCents(total),
    count
  };
}

export interface ReceiptTakingsDay extends TakingsDay {
  /** Refunds paid out that day (all methods); the day total is received less refunds */
  refunds: number;
  /** Of the refunds, paid from the till in cash */
  cashRefunds: number;
}

export interface ReceiptTakings {
  /** Days with a receipt or a refund, most recent first */
  days: ReceiptTakingsDay[];
  /** Received per method (before refunds) */
  byMethod: Record<PaymentMethodKey, number>;
  refunds: number;
  cashRefunds: number;
  /** Received less refunds */
  total: number;
  /** Receipts counted */
  count: number;
  /** Receipts dated in the period that were reversed (not counted) */
  reversedCount: number;
}

/**
 * Daily takings from receipts (cash basis): what was received each day by method, less refunds
 * paid out that day. A receipt counts on the day it was received, whichever invoices it paid
 * (part payments and unallocated money included). Reversed receipts and refunds are not money
 * taken, so they never count; the number of reversed receipts is reported.
 */
export function dailyTakingsFromReceipts(receipts: readonly ArReceipt[], refunds: readonly ArAdjustment[], range: DateRange): ReceiptTakings {
  type Day = { byMethod: Record<PaymentMethodKey, number>; total: number; count: number; refunds: number; cashRefunds: number };
  const days = new Map<string, Day>();
  const dayFor = (dateKey: string): Day => {
    const day = days.get(dateKey) ?? { byMethod: zeroByMethod(), total: 0, count: 0, refunds: 0, cashRefunds: 0 };
    days.set(dateKey, day);
    return day;
  };
  const byMethod = zeroByMethod();
  let total = 0, count = 0, refundTotal = 0, cashRefundTotal = 0, reversedCount = 0;

  for (const receipt of receipts) {
    if (!receipt.receivedOn || !isInRange(receipt.receivedOn, range)) continue;
    if (!isEffective(receipt)) {
      reversedCount += 1;
      continue;
    }
    const method = normalizePaymentMethod(receipt.method);
    const day = dayFor(receipt.receivedOn);
    day.byMethod[method] += receipt.amountCents;
    day.total += receipt.amountCents;
    day.count += 1;
    byMethod[method] += receipt.amountCents;
    total += receipt.amountCents;
    count += 1;
  }
  for (const refund of refunds) {
    if (refund.kind !== 'refund' || !isEffective(refund) || !refund.effectiveOn || !isInRange(refund.effectiveOn, range)) continue;
    const day = dayFor(refund.effectiveOn);
    day.refunds += refund.amountCents;
    day.total -= refund.amountCents;
    refundTotal += refund.amountCents;
    total -= refund.amountCents;
    if (refund.method === 'cash') {
      day.cashRefunds += refund.amountCents;
      cashRefundTotal += refund.amountCents;
    }
  }

  return {
    days: [...days.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, day]) => ({
        dateKey,
        byMethod: centsToAmounts(day.byMethod),
        total: fromCents(day.total),
        count: day.count,
        refunds: fromCents(day.refunds),
        cashRefunds: fromCents(day.cashRefunds)
      })),
    byMethod: centsToAmounts(byMethod),
    refunds: fromCents(refundTotal),
    cashRefunds: fromCents(cashRefundTotal),
    total: fromCents(total),
    count,
    reversedCount
  };
}
