import { fromCents, toCents } from './money';
import { dateKeyFrom, isInRange, type DateRange } from './dates';
import { isPaidInvoice, normalizePaymentMethod, type LedgerInvoice, type PaymentMethodKey } from './invoices';

// ---------------------------------------------------------------------------------------------
// Daily takings (day-end cash-up)
// ---------------------------------------------------------------------------------------------

/** Payment methods in cash-up order: the till first, then card and EFT, then medical aid */
export const TAKINGS_METHODS: readonly PaymentMethodKey[] = ['cash', 'card', 'eft', 'medical_aid', 'other', 'not_recorded'];

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
