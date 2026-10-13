/**
 * Cash flow per practitioner (parity R7): the money received in a period, on the day it was received, for the
 * practitioner whose work it paid. The database splits each receipt (report_cash_by_practitioner,
 * proposals/2026-10-12-finance-reports.sql) by the practitioner stored with each part of the payment when it was
 * allocated (the invoice line's own, else the invoice's: proposals/2026-10-12-allocation-practitioner.sql), so the
 * report names the same practitioner as the receipt; money not allocated yet and money refunded later are kept apart.
 * A receipt's parts add up to its amount, so the total is what Collections shows for the same days. Reversed payments
 * never count.
 */
import { RECEIPT_METHOD_LABELS, TAKINGS_METHODS, payerLabel, toCents, type PayerType, type ReceiptMethod } from '../../../services/ledgerService';
import type { CsvCell } from '../financeExport';
import { staffName, type LinkedReport, type StaffNames } from './reportTargets';

export type CashBasis = 'line' | 'invoice' | 'unallocated' | 'refunded';

/** A row of report_cash_by_practitioner */
export interface RawCashPart {
  received_on: string | null;
  receipt_id: string | null;
  receipt_number: string | null;
  payer_type: string | null;
  patient_id: string | null;
  fund_name: string | null;
  method: string | null;
  practitioner_id: string | null;
  basis: string | null;
  amount: number | string | null;
}

export interface CashPart {
  receivedOn: string;
  receiptId: string;
  receiptNumber: string;
  payerType: PayerType;
  patientId: string | null;
  fundName: string | null;
  method: ReceiptMethod;
  practitionerId: string | null;
  basis: CashBasis;
  cents: number;
}

const BASES: readonly CashBasis[] = ['line', 'invoice', 'unallocated', 'refunded'];
const PAYERS: readonly PayerType[] = ['patient', 'medical_aid', 'other'];
const METHODS = Object.keys(RECEIPT_METHOD_LABELS) as ReceiptMethod[];

/** A row as the report uses it; null when it is not one this app understands (it is then left out, never guessed) */
export function normalizeCashPart(row: RawCashPart): CashPart | null {
  const basis = BASES.find(item => item === row.basis);
  if (!row.receipt_id || !row.received_on || !basis) return null;
  return {
    receivedOn: row.received_on.slice(0, 10),
    receiptId: row.receipt_id,
    receiptNumber: row.receipt_number?.trim() || row.receipt_id.slice(0, 8),
    payerType: PAYERS.find(item => item === row.payer_type) ?? 'patient',
    patientId: row.patient_id,
    fundName: row.fund_name,
    method: METHODS.find(item => item === row.method) ?? 'not_recorded',
    practitionerId: basis === 'unallocated' || basis === 'refunded' ? null : row.practitioner_id,
    basis,
    cents: toCents(row.amount)
  };
}

/** Keys besides a practitioner's user id */
export const CASH_NO_PRACTITIONER = 'none';
export const CASH_UNALLOCATED = 'unallocated';
export const CASH_REFUNDED = 'refunded';

/** Whom a part of a receipt counts for */
export const cashKey = (part: Pick<CashPart, 'basis' | 'practitionerId'>): string =>
  part.basis === 'unallocated' ? CASH_UNALLOCATED : part.basis === 'refunded' ? CASH_REFUNDED : part.practitionerId ?? CASH_NO_PRACTITIONER;

export function cashKeyLabel(key: string, names: StaffNames): string {
  if (key === CASH_NO_PRACTITIONER) return 'No practitioner recorded';
  if (key === CASH_UNALLOCATED) return 'Not allocated to an invoice yet';
  if (key === CASH_REFUNDED) return 'Refunded later';
  return staffName(key, names, 'Practitioner not on the staff list');
}

export interface CashPractitionerRow {
  key: string;
  byMethod: Record<ReceiptMethod, number>;
  totalCents: number;
  /** Payments (receipts) with money for this row */
  receipts: number;
}

export interface CashSummary {
  rows: CashPractitionerRow[];
  byMethod: Record<ReceiptMethod, number>;
  totalCents: number;
  receipts: number;
}

const zeroMethods = (): Record<ReceiptMethod, number> => Object.fromEntries(METHODS.map(method => [method, 0])) as Record<ReceiptMethod, number>;
const SPECIAL_LAST = [CASH_NO_PRACTITIONER, CASH_UNALLOCATED, CASH_REFUNDED];

/** Money per practitioner and payment method; practitioners with most first, the rest (unallocated, refunded) last */
export function cashByPractitioner(parts: readonly CashPart[]): CashSummary {
  const rows = new Map<string, CashPractitionerRow & { receiptIds: Set<string> }>();
  const byMethod = zeroMethods();
  const receiptIds = new Set<string>();
  let totalCents = 0;
  for (const part of parts) {
    const key = cashKey(part);
    const row = rows.get(key) ?? { key, byMethod: zeroMethods(), totalCents: 0, receipts: 0, receiptIds: new Set<string>() };
    row.byMethod[part.method] += part.cents;
    row.totalCents += part.cents;
    row.receiptIds.add(part.receiptId);
    rows.set(key, row);
    byMethod[part.method] += part.cents;
    totalCents += part.cents;
    receiptIds.add(part.receiptId);
  }
  const rank = (key: string) => SPECIAL_LAST.indexOf(key);
  return {
    rows: [...rows.values()]
      .map(({ receiptIds: ids, ...row }) => ({ ...row, receipts: ids.size }))
      .sort((a, b) => rank(a.key) - rank(b.key) || b.totalCents - a.totalCents),
    byMethod,
    totalCents,
    receipts: receiptIds.size
  };
}

const amount = (cents: number): number => cents / 100;

export const CASH_NOTES = [
  'A payment counts on the day it was received, for the practitioner of what it paid, as the payment recorded it: each invoice line\'s own practitioner, else the invoice\'s. One payment for several practitioners\' work is split between them.',
  'Money not allocated to an invoice yet, and money refunded later, are shown on their own rows. Reversed payments never count. The total is the money received in these days, as in Collections.'
];

/** The payment methods that carry money in the period, in the till's order (cash first) */
const methodsUsed = (summary: CashSummary): ReceiptMethod[] =>
  (TAKINGS_METHODS as readonly string[]).filter(method => summary.byMethod[method as ReceiptMethod] !== 0) as ReceiptMethod[];

/** One row per practitioner with a column per payment method; a row opens that practitioner's payments */
export function cashSummaryTable(summary: CashSummary, periodLabel: string, names: StaffNames): LinkedReport & { keys: string[] } {
  const methods = methodsUsed(summary);
  return {
    table: {
      title: 'Cash flow per practitioner',
      basis: `Payments received ${periodLabel}, by the day received`,
      columns: [
        { header: 'Practitioner', type: 'text' },
        ...methods.map(method => ({ header: RECEIPT_METHOD_LABELS[method], type: 'money' as const })),
        { header: 'Total', type: 'money' },
        { header: 'Payments', type: 'count' }
      ],
      rows: summary.rows.map(row => [
        cashKeyLabel(row.key, names), ...methods.map(method => amount(row.byMethod[method])), amount(row.totalCents), row.receipts
      ] as CsvCell[]),
      totals: ['Total', ...methods.map(method => amount(summary.byMethod[method])), amount(summary.totalCents), summary.receipts],
      notes: CASH_NOTES
    },
    // The summary's rows filter the payments list instead of leaving the report
    targets: summary.rows.map(() => null),
    keys: summary.rows.map(row => row.key)
  };
}

export const BASIS_LABELS: Record<CashBasis, string> = {
  line: 'Paid invoice lines',
  invoice: 'Paid an invoice (no particular line)',
  unallocated: 'Not allocated yet',
  refunded: 'Refunded later'
};

/** Every part of every payment: day, payment, payer, method, practitioner and amount; each opens its payment */
export function cashDetailTable(parts: readonly CashPart[], periodLabel: string, names: StaffNames, patientNames: Readonly<Record<string, string>>): LinkedReport {
  const sorted = [...parts].sort((a, b) => a.receivedOn.localeCompare(b.receivedOn) || a.receiptNumber.localeCompare(b.receiptNumber));
  return {
    table: {
      title: 'Cash flow per practitioner: payments',
      basis: `Payments received ${periodLabel}`,
      columns: [
        { header: 'Day', type: 'date' },
        { header: 'Payment', type: 'text' },
        { header: 'Paid by', type: 'text' },
        { header: 'Method', type: 'text' },
        { header: 'Practitioner', type: 'text' },
        { header: 'What it paid', type: 'text' },
        { header: 'Amount', type: 'money' }
      ],
      rows: sorted.map(part => [
        part.receivedOn,
        part.receiptNumber,
        payerLabel({ ...part, payerName: null }, { ...patientNames }),
        RECEIPT_METHOD_LABELS[part.method],
        cashKeyLabel(cashKey(part), names),
        BASIS_LABELS[part.basis],
        amount(part.cents)
      ] as CsvCell[]),
      totals: ['Total', '', '', '', '', '', amount(sorted.reduce((sum, part) => sum + part.cents, 0))],
      notes: CASH_NOTES
    },
    targets: sorted.map(part => ({ kind: 'receipt' as const, id: part.receiptId })),
    names: sorted.map(part => part.receiptNumber)
  };
}
