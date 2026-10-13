import {
  ADJUSTMENT_LABELS,
  RECEIPT_METHOD_LABELS,
  UNKNOWN_SCHEME,
  inventoryItemValue,
  invoiceDateKey,
  isEffective,
  isExpenseCost,
  isInRange,
  isPaidInvoice,
  isPayrollCost,
  isRevenueInvoice,
  monthKeyOf,
  normalizePaymentMethod,
  paidDateKey,
  payerLabel,
  payslipDateKey,
  revenueInvoiceIds,
  splitCents,
  toCents,
  treatingDoctorId,
  type ArAdjustment,
  type ArReceipt,
  type DateRange,
  type LedgerInvoice,
  type PaymentMethodKey,
  type TariffRevenueRow
} from '../../services/ledgerService';
import { payrollLink, practiceInventoryLink, practiceOverheadLink, stockItemLink } from '../billing/invoiceLinks';
import type { FinanceWorkspace } from './financeData';
import { formatCount, formatDateKey, formatMonthKey } from './financeFormat';
import type { FundDebtorItem } from './fundDebtors';
import type { RecordItem, ReportTarget } from './practiceReports/reportTargets';

/**
 * What the rows of Finance > Reports' fixed reports open (every report row opens what it counts, as the newer reports'
 * rows do). Each builder walks the same records with the same rules as the figure the row shows (the ledger's own
 * exported rules: isEffective, paidDateKey, revenueInvoiceIds, treatingDoctorId, ...), so the list behind a row is
 * exactly what makes up its figure. Pure: built from the Finance workspace already loaded, nothing is read again.
 */

/** Where expenses are kept and changed (as Ledgers > Expenses' "Manage expenses"): Settings > Practice > Practice Overhead */
export const EXPENSES_HREF = practiceOverheadLink();
/** The old inventory list, before the stock update: Settings > Practice > Inventory */
const INVENTORY_LIST_HREF = practiceInventoryLink();

/** A list target, or nothing when no record is behind the row */
export const recordsTarget = (label: string, items: RecordItem[]): ReportTarget | null => (items.length > 0 ? { kind: 'records', label, items } : null);

const byDateThenNumber = <T>(dateOf: (row: T) => string, numberOf: (row: T) => string) => (a: T, b: T): number =>
  dateOf(a).localeCompare(dateOf(b)) || numberOf(a).localeCompare(numberOf(b));

/** An invoice in a list: number, patient and date, the amount the row counts of it */
export function invoiceRecord(invoice: LedgerInvoice, patientNames: Readonly<Record<string, string>>, amount: number = invoice.total): RecordItem {
  const patient = (invoice.patientId && patientNames[invoice.patientId]) || 'Unknown patient';
  return {
    key: `invoice-${invoice.id}`,
    title: `Invoice ${invoice.invoiceNumber}`,
    detail: `${patient} · ${formatDateKey(invoiceDateKey(invoice))}`,
    amount,
    target: { kind: 'invoice', id: invoice.id }
  };
}

/** A receipt in a list: number, who paid, how and when */
export function receiptRecord(receipt: ArReceipt, patientNames: Readonly<Record<string, string>>): RecordItem {
  return {
    key: `receipt-${receipt.id}`,
    title: `Receipt ${receipt.number}`,
    detail: `${payerLabel(receipt, { ...patientNames })} · ${RECEIPT_METHOD_LABELS[receipt.method]} · ${formatDateKey(receipt.receivedOn)}`,
    amount: receipt.amountCents / 100,
    target: { kind: 'receipt', id: receipt.id }
  };
}

/** A refund in a list: money paid out, opening the receipt it paid back */
export function refundRecord(refund: ArAdjustment): RecordItem {
  return {
    key: `refund-${refund.id}`,
    title: `${ADJUSTMENT_LABELS.refund} ${refund.number}`,
    detail: `${refund.method ? `${RECEIPT_METHOD_LABELS[refund.method]} · ` : ''}${formatDateKey(refund.effectiveOn)}`,
    amount: -refund.amountCents / 100,
    target: refund.receiptId ? { kind: 'receipt', id: refund.receiptId } : null
  };
}

const readyAr = (workspace: Pick<FinanceWorkspace, 'ar'>) => (workspace.ar?.state === 'ready' ? workspace.ar : null);

/**
 * Daily takings, per day (in the days' order): the receipts that came in that day and the refunds paid out (receipts in
 * use), or the invoices marked paid that day (before receipts). A day's total is received less refunds.
 */
export function takingsDayTargets(workspace: Pick<FinanceWorkspace, 'ar' | 'invoices' | 'patientNames'>, dateKeys: readonly string[]): Array<ReportTarget | null> {
  const ar = readyAr(workspace);
  const byDay = new Map<string, RecordItem[]>(dateKeys.map(key => [key, []]));
  const add = (dateKey: string | null | undefined, record: RecordItem) => {
    if (dateKey) byDay.get(dateKey)?.push(record);
  };
  if (ar) {
    ar.receipts
      .filter(isEffective)
      .sort(byDateThenNumber(receipt => receipt.receivedOn ?? '', receipt => receipt.number))
      .forEach(receipt => add(receipt.receivedOn, receiptRecord(receipt, workspace.patientNames)));
    ar.refunds.filter(refund => refund.kind === 'refund' && isEffective(refund)).forEach(refund => add(refund.effectiveOn, refundRecord(refund)));
  } else {
    workspace.invoices.rows.filter(isPaidInvoice).forEach(invoice => add(paidDateKey(invoice), invoiceRecord(invoice, workspace.patientNames)));
  }
  return dateKeys.map(dateKey =>
    recordsTarget(ar ? `payments of ${formatDateKey(dateKey)}` : `invoices marked paid on ${formatDateKey(dateKey)}`, byDay.get(dateKey) ?? []));
}

/** Collections, one payment method: its receipts of the period (receipts in use), or its paid invoices of the period */
export function methodTarget(workspace: Pick<FinanceWorkspace, 'ar' | 'invoices' | 'patientNames'>, method: PaymentMethodKey, range: DateRange, label: string): ReportTarget | null {
  const ar = readyAr(workspace);
  if (ar) {
    const receipts = ar.receipts
      .filter(receipt => isEffective(receipt) && isInRange(receipt.receivedOn, range) && normalizePaymentMethod(receipt.method) === method)
      .sort(byDateThenNumber(receipt => receipt.receivedOn ?? '', receipt => receipt.number));
    return recordsTarget(label, receipts.map(receipt => receiptRecord(receipt, workspace.patientNames)));
  }
  const invoices = workspace.invoices.rows.filter(invoice =>
    isPaidInvoice(invoice) && isInRange(invoiceDateKey(invoice), range) && normalizePaymentMethod(invoice.paymentMethod) === method);
  return recordsTarget(label, invoices.map(invoice => invoiceRecord(invoice, workspace.patientNames)));
}

/** Revenue by tariff code, per code (in the rows' order): the period's invoices carrying it, with what the code billed on each */
export function tariffTargets(
  workspace: Pick<FinanceWorkspace, 'invoices' | 'lineItems' | 'patientNames'>,
  rows: ReadonlyArray<Pick<TariffRevenueRow, 'code' | 'description'>>,
  range: DateRange
): Array<ReportTarget | null> {
  const eligible = revenueInvoiceIds(workspace.invoices.rows, range);
  // The grouping of revenueByTariffCode: the code, or a code-less line's description
  const keyOf = (line: { code: string; description: string }) => line.code || `desc:${line.description.toLowerCase()}`;
  const billed = new Map<string, Map<string, number>>();
  for (const line of workspace.lineItems.rows) {
    if (!eligible.has(line.invoiceId)) continue;
    const perInvoice = billed.get(keyOf(line)) ?? new Map<string, number>();
    perInvoice.set(line.invoiceId, (perInvoice.get(line.invoiceId) ?? 0) + toCents(line.total));
    billed.set(keyOf(line), perInvoice);
  }
  const invoiceById = new Map(workspace.invoices.rows.map(invoice => [invoice.id, invoice]));
  return rows.map(row => {
    const perInvoice = billed.get(keyOf({ code: row.code, description: row.description === 'No description' ? '' : row.description })) ?? new Map<string, number>();
    const items = [...perInvoice.keys()]
      .flatMap(id => invoiceById.get(id) ?? [])
      .sort(byDateThenNumber(invoice => invoiceDateKey(invoice) ?? '', invoice => invoice.invoiceNumber))
      .map(invoice => invoiceRecord(invoice, workspace.patientNames, (perInvoice.get(invoice.id) ?? 0) / 100));
    return recordsTarget(`invoices with ${row.code ? `code ${row.code}` : `"${row.description}"`}`, items);
  });
}

export type PayerRow = { kind: 'medical_aid' } | { kind: 'scheme'; scheme: string } | { kind: 'patient' };

/** Payer mix, one row: the period's invoices with a medical aid portion (of one fund), or with a patient portion */
export function payerTarget(workspace: Pick<FinanceWorkspace, 'invoices' | 'patientNames' | 'schemeByPatient'>, row: PayerRow, range: DateRange): ReportTarget | null {
  const items: RecordItem[] = [];
  const invoices = workspace.invoices.rows
    .filter(invoice => isRevenueInvoice(invoice) && isInRange(invoiceDateKey(invoice), range))
    .sort(byDateThenNumber(invoice => invoiceDateKey(invoice) ?? '', invoice => invoice.invoiceNumber));
  for (const invoice of invoices) {
    const { medicalAidCents, patientCents } = splitCents(invoice);
    if (row.kind === 'patient') {
      if (patientCents !== 0) items.push(invoiceRecord(invoice, workspace.patientNames, patientCents / 100));
      continue;
    }
    if (medicalAidCents <= 0) continue;
    const scheme = (invoice.patientId && workspace.schemeByPatient[invoice.patientId]) || UNKNOWN_SCHEME;
    if (row.kind === 'scheme' && scheme !== row.scheme) continue;
    items.push(invoiceRecord(invoice, workspace.patientNames, medicalAidCents / 100));
  }
  const label = row.kind === 'patient' ? 'invoices with a patient portion' : row.kind === 'scheme' ? `invoices billed to ${row.scheme}` : 'invoices billed to a medical aid';
  return recordsTarget(label, items);
}

/**
 * Practitioner productivity, one practitioner: the period's invoices that count for them (the practitioner on the
 * invoice's visit, else whoever made it); one who only completed visits opens those visits.
 */
export function practitionerTarget(workspace: Pick<FinanceWorkspace, 'invoices' | 'visits' | 'patientNames'>, doctorId: string | null, name: string, range: DateRange): ReportTarget | null {
  const doctorByVisit = new Map<string, string>();
  workspace.visits.rows.forEach(visit => {
    if (visit.doctorId) doctorByVisit.set(visit.id, visit.doctorId);
  });
  const invoices = workspace.invoices.rows
    .filter(invoice => isRevenueInvoice(invoice) && isInRange(invoiceDateKey(invoice), range) && treatingDoctorId(invoice, doctorByVisit) === doctorId)
    .sort(byDateThenNumber(invoice => invoiceDateKey(invoice) ?? '', invoice => invoice.invoiceNumber));
  if (invoices.length > 0) return recordsTarget(`invoices of ${name}`, invoices.map(invoice => invoiceRecord(invoice, workspace.patientNames)));
  const visitIds = workspace.visits.rows.filter(visit => visit.stage === 'completed' && isInRange(visit.dateKey, range) && visit.doctorId === doctorId).map(visit => visit.id);
  return visitIds.length > 0 ? { kind: 'visits', ids: visitIds, label: `visits completed by ${name}` } : null;
}

/** Appointments and attendance, one month: every visit booked on a day of it in the period (Encounters lists them) */
export function attendanceMonthTarget(workspace: Pick<FinanceWorkspace, 'visits'>, monthKey: string, range: DateRange): ReportTarget | null {
  const ids = workspace.visits.rows
    .filter(visit => !!visit.dateKey && isInRange(visit.dateKey, range) && monthKeyOf(visit.dateKey) === monthKey)
    .map(visit => visit.id);
  return ids.length > 0 ? { kind: 'visits', ids, label: `appointments in ${formatMonthKey(monthKey, 'MMMM yyyy')}` } : null;
}

/** Payroll, one month: its uncancelled payslips (counted in the month the pay period starts), each opening payroll */
export function payslipMonthTarget(workspace: Pick<FinanceWorkspace, 'payslips'>, monthKey: string, range?: DateRange): ReportTarget | null {
  const items = workspace.payslips.rows
    .filter(payslip => {
      const dateKey = payslipDateKey(payslip);
      return isPayrollCost(payslip) && !!dateKey && monthKeyOf(dateKey) === monthKey && (!range || isInRange(dateKey, range));
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
    .map((payslip): RecordItem => ({
      key: `payslip-${payslip.id}`,
      title: payslip.employeeName,
      detail: `Pay period ${formatDateKey(payslip.periodStart)} to ${formatDateKey(payslip.periodEnd)}`,
      amount: payslip.gross,
      target: { kind: 'link', href: payrollLink() }
    }));
  return recordsTarget(`payslips of ${formatMonthKey(monthKey, 'MMMM yyyy')}`, items);
}

/** Expenses by category, one category: its expenses of the period, each opening where expenses are kept */
export function expenseTypeTarget(workspace: Pick<FinanceWorkspace, 'expenses'>, type: string, label: string, range: DateRange): ReportTarget | null {
  const items = workspace.expenses.rows
    .filter(expense => isExpenseCost(expense) && !!expense.expenseDate && isInRange(expense.expenseDate, range) && expense.type === type)
    .sort(byDateThenNumber(expense => expense.expenseDate ?? '', expense => expense.name))
    .map((expense): RecordItem => ({
      key: `expense-${expense.id}`,
      title: expense.name,
      detail: [expense.vendor, formatDateKey(expense.expenseDate), expense.status].filter(Boolean).join(' · '),
      amount: expense.amount,
      target: { kind: 'link', href: EXPENSES_HREF }
    }));
  return recordsTarget(`expenses for ${label}`, items);
}

/** Stock and equipment, one category: its items, highest value first, each opening on the Stock page (its history) */
export function inventoryCategoryTarget(workspace: Pick<FinanceWorkspace, 'inventory'>, category: string, label: string): ReportTarget | null {
  const fromLedger = workspace.inventory.source === 'stock_ledger';
  const items = workspace.inventory.rows
    .filter(item => item.category === category)
    .sort((a, b) => inventoryItemValue(b) - inventoryItemValue(a) || a.name.localeCompare(b.name))
    .map((item): RecordItem => ({
      key: `item-${item.id}`,
      title: item.name,
      detail: `${formatCount(item.quantity)}${item.unit ? ` ${item.unit}` : ''} on hand${item.expiryDate ? ` · expires ${formatDateKey(item.expiryDate)}` : ''}`,
      amount: inventoryItemValue(item),
      target: { kind: 'link', href: fromLedger ? stockItemLink(item.id) : INVENTORY_LIST_HREF }
    }));
  return recordsTarget(`items in ${label}`, items);
}

/** Debtors by medical aid fund, one fund: its unpaid invoices with what the fund still owes on each */
export function fundDebtorTarget(workspace: Pick<FinanceWorkspace, 'patientNames'>, debtorItems: readonly FundDebtorItem[], fund: string): ReportTarget | null {
  const items = debtorItems
    .filter(debtor => debtor.fund === fund)
    .sort(byDateThenNumber(debtor => invoiceDateKey(debtor.item.invoice) ?? '', debtor => debtor.item.invoice.invoiceNumber))
    .map(debtor => invoiceRecord(debtor.item.invoice, workspace.patientNames, debtor.cents / 100));
  return recordsTarget(`unpaid invoices for ${fund}`, items);
}
