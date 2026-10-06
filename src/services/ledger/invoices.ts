import { fromCents, shareOf, toAmount, toCents } from './money';
import { dateKeyFrom, isInRange, monthKeyOf, type DateRange } from './dates';

// ---------------------------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------------------------

export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'cancelled';
export type Funder = 'medical_aid' | 'patient';

export const INVOICE_STATUSES: InvoiceStatus[] = ['pending', 'overdue', 'paid', 'cancelled'];

/** invoices_enhanced columns the Finance page reads (numeric columns may arrive as strings) */
export interface RawInvoiceRow {
  id: string;
  invoice_number?: string | null;
  patient_id?: string | null;
  visit_id?: string | null;
  practitioner_id?: string | null;
  batch_id?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  total?: number | string | null;
  medical_aid_total?: number | string | null;
  patient_total?: number | string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface LedgerInvoice {
  id: string;
  invoiceNumber: string;
  patientId: string | null;
  visitId: string | null;
  practitionerId: string | null;
  batchId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  total: number;
  medicalAidTotal: number;
  patientTotal: number;
  status: InvoiceStatus;
  /** The stored payment_status, kept so unrecognised values can be reported */
  rawStatus: string | null;
  paymentMethod: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export const CANCELLED_ALIASES = ['cancelled', 'canceled', 'void', 'voided'];

/** Paid and cancelled are final; everything else (incl. missing or unknown) is still owed. */
export function normalizeInvoiceStatus(status: string | null | undefined): InvoiceStatus {
  const value = (status ?? '').trim().toLowerCase();
  if (value === 'paid') return 'paid';
  if (CANCELLED_ALIASES.includes(value)) return 'cancelled';
  if (value === 'overdue') return 'overdue';
  return 'pending';
}

/** True when the stored status is something other than a known status (or empty). */
export function hasUnrecognisedStatus(invoice: Pick<LedgerInvoice, 'rawStatus'>): boolean {
  const value = (invoice.rawStatus ?? '').trim().toLowerCase();
  return value !== '' && !['paid', 'pending', 'overdue', ...CANCELLED_ALIASES].includes(value);
}

export function normalizeInvoice(row: RawInvoiceRow): LedgerInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number?.trim() || row.id.slice(0, 8),
    patientId: row.patient_id ?? null,
    visitId: row.visit_id ?? null,
    practitionerId: row.practitioner_id ?? null,
    batchId: row.batch_id ?? null,
    issueDate: dateKeyFrom(row.issue_date),
    dueDate: dateKeyFrom(row.due_date),
    total: toAmount(row.total),
    medicalAidTotal: toAmount(row.medical_aid_total),
    patientTotal: toAmount(row.patient_total),
    status: normalizeInvoiceStatus(row.payment_status),
    rawStatus: row.payment_status ?? null,
    paymentMethod: row.payment_method?.trim() || null,
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null
  };
}

export const isRevenueInvoice = (invoice: Pick<LedgerInvoice, 'status'>): boolean => invoice.status !== 'cancelled';
export const isOutstandingInvoice = (invoice: Pick<LedgerInvoice, 'status'>): boolean =>
  invoice.status === 'pending' || invoice.status === 'overdue';
export const isPaidInvoice = (invoice: Pick<LedgerInvoice, 'status'>): boolean => invoice.status === 'paid';

/** The day an invoice belongs to for period reporting: its issue date, else its creation day. */
export const invoiceDateKey = (invoice: Pick<LedgerInvoice, 'issueDate' | 'createdAt'>): string | null =>
  dateKeyFrom(invoice.issueDate) ?? dateKeyFrom(invoice.createdAt);

export interface FunderSplitCents {
  totalCents: number;
  medicalAidCents: number;
  patientCents: number;
}

export function splitCents(invoice: Pick<LedgerInvoice, 'total' | 'medicalAidTotal'>): FunderSplitCents {
  const totalCents = toCents(invoice.total);
  if (totalCents <= 0) return { totalCents, medicalAidCents: 0, patientCents: totalCents };
  const medicalAidCents = Math.min(Math.max(toCents(invoice.medicalAidTotal), 0), totalCents);
  return { totalCents, medicalAidCents, patientCents: totalCents - medicalAidCents };
}

/**
 * Who owes an invoice: the medical aid owes its recorded portion (capped at the total) and the
 * patient owes the rest, so medicalAid + patient always equals the invoice total.
 */
export function splitByFunder(invoice: Pick<LedgerInvoice, 'total' | 'medicalAidTotal'>): { medicalAid: number; patient: number } {
  const { medicalAidCents, patientCents } = splitCents(invoice);
  return { medicalAid: fromCents(medicalAidCents), patient: fromCents(patientCents) };
}

export interface RevenueSummary {
  billed: number;
  medicalAid: number;
  patient: number;
  invoiceCount: number;
  averageInvoice: number;
  cancelledCount: number;
  cancelledAmount: number;
}

/** Revenue billed in a range (by invoice date). Cancelled invoices are reported, never counted. */
export function summarizeRevenue(invoices: LedgerInvoice[], range: DateRange): RevenueSummary {
  let billed = 0, medicalAid = 0, patient = 0, invoiceCount = 0, cancelledCount = 0, cancelledAmount = 0;
  for (const invoice of invoices) {
    if (!isInRange(invoiceDateKey(invoice), range)) continue;
    if (!isRevenueInvoice(invoice)) {
      cancelledCount += 1;
      cancelledAmount += toCents(invoice.total);
      continue;
    }
    const split = splitCents(invoice);
    billed += split.totalCents;
    medicalAid += split.medicalAidCents;
    patient += split.patientCents;
    invoiceCount += 1;
  }
  return {
    billed: fromCents(billed),
    medicalAid: fromCents(medicalAid),
    patient: fromCents(patient),
    invoiceCount,
    averageInvoice: invoiceCount > 0 ? fromCents(Math.round(billed / invoiceCount)) : 0,
    cancelledCount,
    cancelledAmount: fromCents(cancelledAmount)
  };
}

export interface CollectionsSummary {
  collected: number;
  count: number;
  medicalAid: number;
  patient: number;
  /** collected / billed for the same range; null when nothing was billed */
  collectionRate: number | null;
}

/**
 * Collections = invoices marked paid, grouped by invoice date. HPMS stores no payment date or
 * part-payments, so this is the paid share of what was billed in the range.
 */
export function summarizeCollections(invoices: LedgerInvoice[], range: DateRange): CollectionsSummary {
  let collected = 0, medicalAid = 0, patient = 0, count = 0;
  for (const invoice of invoices) {
    if (!isPaidInvoice(invoice) || !isInRange(invoiceDateKey(invoice), range)) continue;
    const split = splitCents(invoice);
    collected += split.totalCents;
    medicalAid += split.medicalAidCents;
    patient += split.patientCents;
    count += 1;
  }
  const billed = summarizeRevenue(invoices, range).billed;
  return {
    collected: fromCents(collected),
    count,
    medicalAid: fromCents(medicalAid),
    patient: fromCents(patient),
    collectionRate: shareOf(fromCents(collected), billed)
  };
}

export interface MonthlyRevenueRow {
  monthKey: string;
  billed: number;
  medicalAid: number;
  patient: number;
  collected: number;
  invoiceCount: number;
}

/** One row per requested month (zero rows included), by invoice date, cancelled excluded. */
export function monthlyRevenue(invoices: LedgerInvoice[], monthKeys: string[]): MonthlyRevenueRow[] {
  const rows = new Map(monthKeys.map(key => [key, { billed: 0, medicalAid: 0, patient: 0, collected: 0, invoiceCount: 0 }]));
  for (const invoice of invoices) {
    const dateKey = invoiceDateKey(invoice);
    const row = dateKey ? rows.get(monthKeyOf(dateKey)) : undefined;
    if (!row || !isRevenueInvoice(invoice)) continue;
    const split = splitCents(invoice);
    row.billed += split.totalCents;
    row.medicalAid += split.medicalAidCents;
    row.patient += split.patientCents;
    row.invoiceCount += 1;
    if (isPaidInvoice(invoice)) row.collected += split.totalCents;
  }
  return monthKeys.map(monthKey => {
    const row = rows.get(monthKey)!;
    return {
      monthKey,
      billed: fromCents(row.billed),
      medicalAid: fromCents(row.medicalAid),
      patient: fromCents(row.patient),
      collected: fromCents(row.collected),
      invoiceCount: row.invoiceCount
    };
  });
}

export type StatusSummary = Record<InvoiceStatus, { count: number; amount: number }>;

export function summarizeByStatus(invoices: LedgerInvoice[]): StatusSummary {
  const cents: Record<InvoiceStatus, { count: number; amount: number }> = {
    paid: { count: 0, amount: 0 }, pending: { count: 0, amount: 0 }, overdue: { count: 0, amount: 0 }, cancelled: { count: 0, amount: 0 }
  };
  invoices.forEach(invoice => {
    cents[invoice.status].count += 1;
    cents[invoice.status].amount += toCents(invoice.total);
  });
  return Object.fromEntries(
    INVOICE_STATUSES.map(status => [status, { count: cents[status].count, amount: fromCents(cents[status].amount) }])
  ) as StatusSummary;
}

// ---------------------------------------------------------------------------------------------
// Collections by payment method
// ---------------------------------------------------------------------------------------------

export type PaymentMethodKey = 'medical_aid' | 'card' | 'eft' | 'cash' | 'other' | 'not_recorded';

const PAYMENT_METHOD_ALIASES: Record<string, PaymentMethodKey> = {
  medical_aid: 'medical_aid',
  medicalaid: 'medical_aid',
  card: 'card',
  credit_card: 'card',
  debit_card: 'card',
  eft: 'eft',
  bank_transfer: 'eft',
  cash: 'cash'
};

export function normalizePaymentMethod(method: string | null | undefined): PaymentMethodKey {
  const value = (method ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!value) return 'not_recorded';
  return PAYMENT_METHOD_ALIASES[value] ?? 'other';
}

export interface MethodCollections {
  method: PaymentMethodKey;
  amount: number;
  count: number;
  share: number | null;
}

/** Paid invoices in the range grouped by payment method, largest first. */
export function collectionsByMethod(invoices: LedgerInvoice[], range: DateRange): MethodCollections[] {
  const groups = new Map<PaymentMethodKey, { cents: number; count: number }>();
  let totalCents = 0;
  for (const invoice of invoices) {
    if (!isPaidInvoice(invoice) || !isInRange(invoiceDateKey(invoice), range)) continue;
    const method = normalizePaymentMethod(invoice.paymentMethod);
    const group = groups.get(method) ?? { cents: 0, count: 0 };
    const cents = toCents(invoice.total);
    group.cents += cents;
    group.count += 1;
    totalCents += cents;
    groups.set(method, group);
  }
  return [...groups.entries()]
    .map(([method, group]) => ({
      method,
      amount: fromCents(group.cents),
      count: group.count,
      share: totalCents === 0 ? null : group.cents / totalCents
    }))
    .sort((a, b) => b.amount - a.amount || a.method.localeCompare(b.method));
}

// ---------------------------------------------------------------------------------------------
// Invoice list filtering
// ---------------------------------------------------------------------------------------------

export interface InvoiceFilter {
  status: 'all' | InvoiceStatus;
  funder: 'all' | Funder;
  search: string;
  /** null = all dates */
  range: DateRange | null;
}

/**
 * Filter the invoice list. A funder filter keeps invoices on which that funder owes something,
 * so an invoice split between medical aid and patient appears under both.
 */
export function filterInvoices(invoices: LedgerInvoice[], filter: InvoiceFilter, patientNames: Record<string, string> = {}): LedgerInvoice[] {
  const search = filter.search.trim().toLowerCase();
  return invoices
    .filter(invoice => {
      if (filter.status !== 'all' && invoice.status !== filter.status) return false;
      if (filter.range && !isInRange(invoiceDateKey(invoice), filter.range)) return false;
      if (filter.funder !== 'all') {
        const split = splitByFunder(invoice);
        if ((filter.funder === 'medical_aid' ? split.medicalAid : split.patient) <= 0) return false;
      }
      if (search) {
        const name = (invoice.patientId && patientNames[invoice.patientId]) || '';
        if (!invoice.invoiceNumber.toLowerCase().includes(search) && !name.toLowerCase().includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) =>
      (invoiceDateKey(b) ?? '').localeCompare(invoiceDateKey(a) ?? '') || b.invoiceNumber.localeCompare(a.invoiceNumber)
    );
}
