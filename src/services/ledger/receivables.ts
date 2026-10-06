import { fromCents, shareOf, toCents } from './money';
import { dateKeyFrom, daysBetween, isInRange, type DateRange } from './dates';
import { invoiceDateKey, isOutstandingInvoice, isRevenueInvoice, splitCents, summarizeRevenue, type LedgerInvoice } from './invoices';

// ---------------------------------------------------------------------------------------------
// Accounts receivable aging
// ---------------------------------------------------------------------------------------------

export type AgingBucket = 'not_due' | 'days_0_30' | 'days_31_60' | 'days_61_90' | 'days_over_90';

export const AGING_BUCKETS: ReadonlyArray<{ key: AgingBucket; label: string; description: string }> = [
  { key: 'not_due', label: 'Not yet due', description: 'Due date has not passed' },
  { key: 'days_0_30', label: '0-30 days', description: '0 to 30 days past due' },
  { key: 'days_31_60', label: '31-60 days', description: '31 to 60 days past due' },
  { key: 'days_61_90', label: '61-90 days', description: '61 to 90 days past due' },
  { key: 'days_over_90', label: '90+ days', description: 'More than 90 days past due' }
];

export function agingBucketFor(daysPastDue: number): AgingBucket {
  if (daysPastDue < 0) return 'not_due';
  if (daysPastDue <= 30) return 'days_0_30';
  if (daysPastDue <= 60) return 'days_31_60';
  if (daysPastDue <= 90) return 'days_61_90';
  return 'days_over_90';
}

/** Aging runs from the due date; an invoice without one is treated as due when issued. */
export const agingDateKey = (invoice: Pick<LedgerInvoice, 'dueDate' | 'issueDate' | 'createdAt'>): string | null =>
  dateKeyFrom(invoice.dueDate) ?? invoiceDateKey(invoice);

export function daysPastDue(invoice: Pick<LedgerInvoice, 'dueDate' | 'issueDate' | 'createdAt'>, asOfKey: string): number | null {
  const key = agingDateKey(invoice);
  return key ? daysBetween(key, asOfKey) : null;
}

export interface AgingItem {
  invoice: LedgerInvoice;
  bucket: AgingBucket;
  /** null when the invoice has no usable date */
  daysPastDue: number | null;
  amount: number;
  medicalAid: number;
  patient: number;
}

export interface AgingBucketTotals {
  amount: number;
  medicalAid: number;
  patient: number;
  count: number;
}

export interface AgingReport {
  asOfKey: string;
  /** Oldest first */
  items: AgingItem[];
  byBucket: Record<AgingBucket, AgingBucketTotals>;
  total: number;
  medicalAid: number;
  patient: number;
  count: number;
  /** Everything whose due date has passed */
  pastDue: number;
  undatedCount: number;
}

/**
 * Receivables as at a date: every unpaid, uncancelled invoice with money on it, aged by days
 * past its due date and split by funder. An invoice with no usable date cannot be shown to be
 * recent, so it is aged in the oldest bucket and counted as undated.
 */
export function buildAgingReport(invoices: LedgerInvoice[], asOfKey: string): AgingReport {
  const buckets = Object.fromEntries(
    AGING_BUCKETS.map(({ key }) => [key, { amount: 0, medicalAid: 0, patient: 0, count: 0 }])
  ) as Record<AgingBucket, AgingBucketTotals>;
  const items: AgingItem[] = [];
  let total = 0, medicalAid = 0, patient = 0, undatedCount = 0;

  for (const invoice of invoices) {
    if (!isOutstandingInvoice(invoice)) continue;
    const split = splitCents(invoice);
    if (split.totalCents === 0) continue; // nothing is owed on a zero invoice
    const days = daysPastDue(invoice, asOfKey);
    if (days === null) undatedCount += 1;
    const bucket = days === null ? 'days_over_90' : agingBucketFor(days);
    buckets[bucket].amount += split.totalCents;
    buckets[bucket].medicalAid += split.medicalAidCents;
    buckets[bucket].patient += split.patientCents;
    buckets[bucket].count += 1;
    total += split.totalCents;
    medicalAid += split.medicalAidCents;
    patient += split.patientCents;
    items.push({
      invoice,
      bucket,
      daysPastDue: days,
      amount: fromCents(split.totalCents),
      medicalAid: fromCents(split.medicalAidCents),
      patient: fromCents(split.patientCents)
    });
  }

  const byBucket = Object.fromEntries(
    AGING_BUCKETS.map(({ key }) => [key, {
      amount: fromCents(buckets[key].amount),
      medicalAid: fromCents(buckets[key].medicalAid),
      patient: fromCents(buckets[key].patient),
      count: buckets[key].count
    }])
  ) as Record<AgingBucket, AgingBucketTotals>;

  items.sort((a, b) => (b.daysPastDue ?? Infinity) - (a.daysPastDue ?? Infinity) || b.amount - a.amount);

  return {
    asOfKey,
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

export interface SchemeReceivable {
  scheme: string;
  amount: number;
  count: number;
  oldestDaysPastDue: number | null;
}

export const UNKNOWN_SCHEME = 'Scheme not recorded';

/** The medical aid portion of receivables per scheme (who to chase), largest first. */
export function receivablesByScheme(report: AgingReport, schemeByPatient: Record<string, string>): SchemeReceivable[] {
  const groups = new Map<string, { cents: number; count: number; oldest: number | null }>();
  for (const item of report.items) {
    if (item.medicalAid <= 0) continue;
    const scheme = (item.invoice.patientId && schemeByPatient[item.invoice.patientId]) || UNKNOWN_SCHEME;
    const group = groups.get(scheme) ?? { cents: 0, count: 0, oldest: null };
    group.cents += toCents(item.medicalAid);
    group.count += 1;
    if (item.daysPastDue !== null) group.oldest = Math.max(group.oldest ?? item.daysPastDue, item.daysPastDue);
    groups.set(scheme, group);
  }
  return [...groups.entries()]
    .map(([scheme, group]) => ({ scheme, amount: fromCents(group.cents), count: group.count, oldestDaysPastDue: group.oldest }))
    .sort((a, b) => b.amount - a.amount || a.scheme.localeCompare(b.scheme));
}

// ---------------------------------------------------------------------------------------------
// Payer mix
// ---------------------------------------------------------------------------------------------

export interface PayerMix {
  total: number;
  medicalAid: number;
  patient: number;
  medicalAidShare: number | null;
  patientShare: number | null;
  /** Medical aid revenue per scheme, largest first; share is of the medical aid total */
  schemes: { scheme: string; amount: number; share: number | null; invoiceCount: number }[];
}

export function payerMix(invoices: LedgerInvoice[], range: DateRange, schemeByPatient: Record<string, string> = {}): PayerMix {
  const revenue = summarizeRevenue(invoices, range);
  const schemes = new Map<string, { cents: number; invoiceCount: number }>();
  for (const invoice of invoices) {
    if (!isRevenueInvoice(invoice) || !isInRange(invoiceDateKey(invoice), range)) continue;
    const { medicalAidCents } = splitCents(invoice);
    if (medicalAidCents <= 0) continue;
    const scheme = (invoice.patientId && schemeByPatient[invoice.patientId]) || UNKNOWN_SCHEME;
    const group = schemes.get(scheme) ?? { cents: 0, invoiceCount: 0 };
    group.cents += medicalAidCents;
    group.invoiceCount += 1;
    schemes.set(scheme, group);
  }
  return {
    total: revenue.billed,
    medicalAid: revenue.medicalAid,
    patient: revenue.patient,
    medicalAidShare: shareOf(revenue.medicalAid, revenue.billed),
    patientShare: shareOf(revenue.patient, revenue.billed),
    schemes: [...schemes.entries()]
      .map(([scheme, group]) => ({
        scheme,
        amount: fromCents(group.cents),
        share: shareOf(fromCents(group.cents), revenue.medicalAid),
        invoiceCount: group.invoiceCount
      }))
      .sort((a, b) => b.amount - a.amount || a.scheme.localeCompare(b.scheme))
  };
}
