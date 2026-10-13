import { fromCents, shareOf } from './money';
import { isInRange, monthKeyOf, type DateRange } from './dates';
import {
  invoiceDateKey,
  isRevenueInvoice,
  normalizePaymentMethod,
  summarizeRevenue,
  type CollectionsSummary,
  type LedgerInvoice,
  type MethodCollections,
  type MonthlyRevenueRow,
  type PaymentMethodKey
} from './invoices';
import { billedPortions, collectedPortions } from './arBalances';
import { isEffective, type ArInvoiceBalance, type ArReceipt } from './arModel';

// ---------------------------------------------------------------------------------------------
// Finance figures once receipts are in use. The status-based versions in invoices.ts stay for
// practices whose database does not have the receipts tables yet.
// ---------------------------------------------------------------------------------------------

export interface ReceiptsSummary {
  /** Effective receipts dated in the range */
  received: number;
  count: number;
  fromMedicalAids: number;
  /** Patients and other payers */
  fromPatients: number;
  /** Of what was received in the range, still not allocated to an invoice */
  unallocated: number;
}

/** Money received in a range (cash basis), by who paid. Reversed receipts never count. */
export function summarizeReceipts(receipts: readonly ArReceipt[], range: DateRange): ReceiptsSummary {
  let received = 0, count = 0, fromMedicalAids = 0, unallocated = 0;
  for (const receipt of receipts) {
    if (!isEffective(receipt) || !isInRange(receipt.receivedOn, range)) continue;
    received += receipt.amountCents;
    count += 1;
    if (receipt.payerType === 'medical_aid') fromMedicalAids += receipt.amountCents;
    unallocated += Math.max(receipt.unallocatedCents, 0);
  }
  return {
    received: fromCents(received),
    count,
    fromMedicalAids: fromCents(fromMedicalAids),
    fromPatients: fromCents(received - fromMedicalAids),
    unallocated: fromCents(unallocated)
  };
}

/** Effective receipts with money not allocated to any invoice (credit and suspense), oldest first */
export function unallocatedReceipts(receipts: readonly ArReceipt[]): ArReceipt[] {
  return receipts
    .filter(receipt => isEffective(receipt) && receipt.unallocatedCents > 0)
    .sort((a, b) => (a.receivedOn ?? '').localeCompare(b.receivedOn ?? '') || a.number.localeCompare(b.number));
}

/** Receipts dated in the range by payment method, largest first (gross, before refunds) */
export function receiptsByMethod(receipts: readonly ArReceipt[], range: DateRange): MethodCollections[] {
  const groups = new Map<PaymentMethodKey, { cents: number; count: number }>();
  let totalCents = 0;
  for (const receipt of receipts) {
    if (!isEffective(receipt) || !isInRange(receipt.receivedOn, range)) continue;
    const method = normalizePaymentMethod(receipt.method);
    const group = groups.get(method) ?? { cents: 0, count: 0 };
    group.cents += receipt.amountCents;
    group.count += 1;
    totalCents += receipt.amountCents;
    groups.set(method, group);
  }
  return [...groups.entries()]
    .map(([method, group]) => ({ method, amount: fromCents(group.cents), count: group.count, share: totalCents === 0 ? null : group.cents / totalCents }))
    .sort((a, b) => b.amount - a.amount || a.method.localeCompare(b.method));
}

/**
 * Collections against the invoices issued in a range: the money allocated to them so far, part
 * payments included, split by portion. Invoices with no receipts yet still count in full when
 * they were marked paid before receipts existed. count = invoices that received anything.
 */
export function summarizeCollectionsFromLedger(
  invoices: readonly LedgerInvoice[],
  range: DateRange,
  balances: Readonly<Record<string, ArInvoiceBalance>>
): CollectionsSummary {
  let medicalAid = 0, patient = 0, count = 0;
  for (const invoice of invoices) {
    if (!isRevenueInvoice(invoice) || !isInRange(invoiceDateKey(invoice), range)) continue;
    const collected = collectedPortions(invoice, balances[invoice.id]);
    if (collected.medical_aid + collected.patient <= 0) continue;
    medicalAid += collected.medical_aid;
    patient += collected.patient;
    count += 1;
  }
  const billed = summarizeRevenue([...invoices], range).billed;
  const collected = fromCents(medicalAid + patient);
  return {
    collected,
    count,
    medicalAid: fromCents(medicalAid),
    patient: fromCents(patient),
    collectionRate: shareOf(collected, billed)
  };
}

/** monthlyRevenue with collected = money allocated to each month's invoices (part payments included) */
export function monthlyRevenueFromLedger(
  invoices: readonly LedgerInvoice[],
  monthKeys: string[],
  balances: Readonly<Record<string, ArInvoiceBalance>>
): MonthlyRevenueRow[] {
  const rows = new Map(monthKeys.map(key => [key, { billed: 0, medicalAid: 0, patient: 0, collected: 0, invoiceCount: 0 }]));
  for (const invoice of invoices) {
    const dateKey = invoiceDateKey(invoice);
    const row = dateKey ? rows.get(monthKeyOf(dateKey)) : undefined;
    if (!row || !isRevenueInvoice(invoice)) continue;
    const billed = billedPortions(invoice);
    const collected = collectedPortions(invoice, balances[invoice.id]);
    row.billed += billed.medical_aid + billed.patient;
    row.medicalAid += billed.medical_aid;
    row.patient += billed.patient;
    row.invoiceCount += 1;
    row.collected += collected.medical_aid + collected.patient;
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
