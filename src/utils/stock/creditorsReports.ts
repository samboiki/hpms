/**
 * Creditors reports (R24) as report tables (shown, printed and exported as CSV like every Stock and Finance report):
 * the supplier age analysis, the transactions of a period, VAT on purchases and a supplier's statement. Built from
 * src/utils/stock/supplierLedger.ts.
 */
import type { ReportTable } from '../../components/finance/financeExport';
import { formatServiceDate } from '../billing/dates';
import { fromCents } from '../billing/money';
import { AGE_BANDS } from '../../services/ledger/receivables';
import {
  ENTRY_LABELS,
  paymentMethodLabel,
  type LedgerDelivery,
  type LedgerEntry,
  type Statement,
  type SupplierAgeAnalysis,
  type SupplierAllocation,
  type SupplierPayment,
  type VatMonth
} from './supplierLedger';

const money = (cents: number): number => fromCents(cents);
const period = (fromKey: string, toKey: string): string => `${formatServiceDate(fromKey)} to ${formatServiceDate(toKey)}`;
/** The supplier and its postal address on one line, for the line under a statement's or advice's title */
const addressed = (supplierName: string, address: string | null): string =>
  address?.trim() ? ` · ${supplierName}, ${address.trim().split(/\s*\n\s*/).filter(Boolean).join(', ')}` : '';

export function supplierAgeTable(analysis: SupplierAgeAnalysis, asOfKey: string): ReportTable {
  return {
    title: 'Supplier age analysis',
    basis: `As at ${formatServiceDate(asOfKey)}`,
    // What is owed and overdue first (seen without scrolling a wide table), then how old it is, then the credit
    columns: [
      { header: 'Supplier', type: 'text' },
      { header: 'Balance', type: 'money' },
      { header: 'Overdue', type: 'money' },
      ...AGE_BANDS.map(band => ({ header: band.label, type: 'money' as const })),
      { header: 'Credit', type: 'money' }
    ],
    rows: analysis.rows.map(row => [row.name, money(row.balanceCents), money(row.overdueCents), ...AGE_BANDS.map(band => money(row.bands[band.key])),
      money(-row.creditCents)]),
    totals: ['Total', money(analysis.totals.balanceCents), money(analysis.totals.overdueCents), ...AGE_BANDS.map(band => money(analysis.totals.bands[band.key])),
      money(-analysis.totals.creditCents)],
    notes: ['Balance: what the supplier invoices still owe less the credit. The age columns split what the invoices owe by the age of each invoice from its date.',
      'Credit: payments and credits for returned stock not yet set against an invoice. Overdue: owed on invoices past the supplier\'s payment terms.']
  };
}

export function creditorsTransactionsTable(entries: readonly LedgerEntry[], supplierName: (supplierId: string) => string, fromKey: string, toKey: string): ReportTable {
  const inPeriod = entries.filter(entry => entry.date >= fromKey && entry.date <= toKey)
    .sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
  return {
    title: 'Creditors transactions',
    basis: period(fromKey, toKey),
    columns: [
      { header: 'Date', type: 'date' },
      { header: 'Supplier', type: 'text' },
      { header: 'What', type: 'text' },
      { header: 'Document', type: 'text' },
      { header: 'Their number or reference', type: 'text' },
      { header: 'Owed more', type: 'money' },
      { header: 'Owed less', type: 'money' },
      { header: 'Note', type: 'text' }
    ],
    rows: inPeriod.map(entry => [entry.date, supplierName(entry.supplierId), ENTRY_LABELS[entry.kind], entry.document, entry.reference,
      entry.amountCents > 0 ? money(entry.amountCents) : null, entry.amountCents < 0 ? money(-entry.amountCents) : null, entry.note]),
    totals: ['Total', null, null, null, null,
      money(inPeriod.filter(entry => entry.amountCents > 0).reduce((sum, entry) => sum + entry.amountCents, 0)),
      money(-inPeriod.filter(entry => entry.amountCents < 0).reduce((sum, entry) => sum + entry.amountCents, 0)), null],
    notes: ['Invoices are deliveries received on account (with their supplier invoice) and supplier invoices for consignment frames sold; credits are stock returned. A reversal is its own line on the day it was made.']
  };
}

export function vatOnPurchasesTable(months: readonly VatMonth[], total: VatMonth, fromKey: string, toKey: string): ReportTable {
  const monthName = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${year}`;
  };
  return {
    title: 'VAT on purchases',
    basis: period(fromKey, toKey),
    columns: [
      { header: 'Month', type: 'text' },
      { header: 'Purchases excl. VAT', type: 'money' },
      { header: 'VAT on purchases', type: 'money' },
      { header: 'Returns excl. VAT', type: 'money' },
      { header: 'VAT on returns', type: 'money' },
      { header: 'Net VAT paid', type: 'money' }
    ],
    rows: months.map(row => [monthName(row.month), money(row.purchasesExclCents), money(row.purchasesVatCents), money(row.creditsExclCents),
      money(row.creditsVatCents), money(row.netVatCents)]),
    totals: ['Total', money(total.purchasesExclCents), money(total.purchasesVatCents), money(total.creditsExclCents), money(total.creditsVatCents),
      money(total.netVatCents)],
    notes: ['VAT as typed from supplier invoices and credit notes on Stock > Deliveries, and on supplier invoices for consignment frames sold (input VAT). Patient invoices do not record VAT yet, so this is not a VAT return.']
  };
}

export function supplierStatementTable(statement: Statement, supplierName: string, address: string | null = null): ReportTable {
  return {
    title: `Statement: ${supplierName}`,
    basis: `${period(statement.fromKey, statement.toKey)}${addressed(supplierName, address)}`,
    columns: [
      { header: 'Date', type: 'date' },
      { header: 'What', type: 'text' },
      { header: 'Document', type: 'text' },
      { header: 'Their number or reference', type: 'text' },
      { header: 'Owed more', type: 'money' },
      { header: 'Owed less', type: 'money' },
      { header: 'Balance', type: 'money' }
    ],
    rows: [
      [statement.fromKey, 'Balance brought forward', null, null, null, null, money(statement.openingCents)],
      ...statement.lines.map(line => [line.date, ENTRY_LABELS[line.kind], line.document, line.reference,
        line.amountCents > 0 ? money(line.amountCents) : null, line.amountCents < 0 ? money(-line.amountCents) : null, money(line.balanceCents)])
    ],
    totals: ['Balance owed', null, null, null, null, null, money(statement.closingCents)],
    notes: [`Invoiced ${formatServiceDate(statement.fromKey)} to ${formatServiceDate(statement.toKey)}: N$ ${money(statement.invoicedCents).toFixed(2)}; credits N$ ${money(statement.creditedCents).toFixed(2)}; paid N$ ${money(statement.paidCents).toFixed(2)}.`,
      'Compare with the supplier\'s own statement: a difference is an invoice or payment one side has not recorded.']
  };
}

/**
 * A payment advice for the supplier: which of their invoices a payment paid (and what stays on account), to send with
 * the payment so they allocate it the same way.
 */
export function paymentAdviceTable(
  payment: SupplierPayment,
  allocations: readonly SupplierAllocation[],
  deliveries: readonly LedgerDelivery[],
  supplierName: string,
  address: string | null = null
): ReportTable {
  const paid = allocations.filter(row => row.paymentId === payment.id && !row.reversedAt);
  const invoiceOf = new Map(deliveries.map(row => [row.id, row]));
  const allocated = paid.reduce((sum, row) => sum + row.amountCents, 0);
  return {
    title: `Payment advice ${payment.number}: ${supplierName}`,
    basis: `Paid ${formatServiceDate(payment.paidOn)} by ${paymentMethodLabel(payment.method)}${payment.reference ? `, reference ${payment.reference}` : ''}${addressed(supplierName, address)}`,
    columns: [
      { header: 'Your invoice', type: 'text' },
      { header: 'Invoice date', type: 'date' },
      { header: 'Our delivery', type: 'text' },
      { header: 'Paid', type: 'money' }
    ],
    rows: paid.map(row => {
      const invoice = invoiceOf.get(row.invoiceId);
      return [invoice?.supplierReference ?? '', invoice?.documentDate ?? null, invoice?.number ?? '', money(row.amountCents)];
    }),
    totals: ['Total paid', null, null, money(payment.amountCents)],
    notes: [
      ...(payment.amountCents > allocated ? [`N$ ${money(payment.amountCents - allocated).toFixed(2)} is on account (not yet set against an invoice).`] : []),
      ...(payment.reversedAt ? ['This payment was reversed.'] : [])
    ]
  };
}
