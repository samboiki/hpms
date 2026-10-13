/**
 * Practice transactions (parity R5): every invoice, payment, credit note, write-off, correction and refund of a period,
 * and every reversal of one, as a detailed list and as totals by type and by practitioner.
 *
 * The entries, their days and their signs are the ledger's own (ledgerMovements: the rule of the day end, the month-end
 * control totals and the daybook), so the list adds up, type by type, to the month end's figures for the same days.
 * An amount is what the entry did to what patients and funds owe: invoices add, payments, credit notes and write-offs
 * take off (negative), and a reversal counts on the day it was made.
 *
 * Practitioner: an invoice and everything on it (credit notes, write-offs, corrections) counts for the treating
 * practitioner chosen on the invoice, as the month-end turnover does. A payment counts for the practitioner of the
 * invoices it was allocated to; one spread over several practitioners' invoices is "Several practitioners" (Cash flow
 * per practitioner splits it line by line), and one not allocated yet is said so.
 */
import {
  MOVEMENT_KINDS,
  invoiceDateKey,
  isInRange,
  ledgerMovements,
  payerLabel,
  type ArAdjustment,
  type ArReceipt,
  type DateRange,
  type LedgerInvoice,
  type MovementKind
} from '../../../services/ledgerService';
import type { CsvCell } from '../financeExport';
import { staffName, type LinkedReport, type ReportTarget, type StaffNames } from './reportTargets';

/** Practitioner keys besides a user id */
export const NO_PRACTITIONER = 'none';
export const SEVERAL_PRACTITIONERS = 'several';
export const NOT_ALLOCATED = 'unallocated';

export interface TransactionSources {
  /** Invoices dated in the period, and any invoice an entry of the period is on (for its number and practitioner) */
  invoices: readonly LedgerInvoice[];
  /** Receipts received or reversed in the period */
  receipts: readonly ArReceipt[];
  /** Credit notes, write-offs, corrections, refunds and shortfall moves dated or reversed in the period */
  adjustments: readonly ArAdjustment[];
  /** Per receipt: the treating practitioner of each invoice its standing allocations paid (null: none chosen) */
  allocatedPractitioners: ReadonlyMap<string, ReadonlyArray<string | null>>;
}

export interface TransactionRow {
  key: string;
  dateKey: string;
  kind: MovementKind;
  /** Invoice, receipt or credit-note number */
  document: string;
  /** The invoice an adjustment is on */
  onInvoice: string | null;
  patientId: string | null;
  /** Who paid, when it was not a patient (a fund's or someone else's payment) */
  payer: string | null;
  /** A user id, or NO_PRACTITIONER, SEVERAL_PRACTITIONERS, NOT_ALLOCATED */
  practitioner: string;
  /** What the entry did to what patients and funds owe: positive adds, negative takes off */
  cents: number;
  target: ReportTarget | null;
}

const KIND_ORDER = new Map(MOVEMENT_KINDS.map((kind, index) => [kind.key, index]));
export const kindLabel = (kind: MovementKind): string => MOVEMENT_KINDS.find(item => item.key === kind)?.label ?? kind;

/** The practitioner a payment counts for: the one practitioner its allocations paid, else several or not allocated */
export function receiptPractitioner(practitioners: ReadonlyArray<string | null> | undefined): string {
  const distinct = [...new Set((practitioners ?? []).map(id => id ?? NO_PRACTITIONER))];
  if (distinct.length === 0) return NOT_ALLOCATED;
  return distinct.length === 1 ? distinct[0] : SEVERAL_PRACTITIONERS;
}

/** Every entry of the period, oldest first (by day, then in the ledger's type order, then by document) */
export function practiceTransactions(sources: TransactionSources, range: DateRange): TransactionRow[] {
  const invoiceById = new Map(sources.invoices.map(invoice => [invoice.id, invoice]));
  const receiptById = new Map(sources.receipts.map(receipt => [receipt.id, receipt]));
  const adjustmentById = new Map(sources.adjustments.map(adjustment => [adjustment.id, adjustment]));
  // Invoices loaded only for their number (an adjustment of the period on an older invoice) are not entries of the period
  const datedInvoices = sources.invoices.filter(invoice => isInRange(invoiceDateKey(invoice), range));
  const movements = ledgerMovements({ invoices: datedInvoices, receipts: sources.receipts, adjustments: sources.adjustments });

  const rows: TransactionRow[] = [];
  for (const movement of movements) {
    if (!isInRange(movement.dateKey, range)) continue;
    const base = { key: `${movement.kind}:${movement.sourceId}`, dateKey: movement.dateKey, kind: movement.kind, cents: movement.cents };
    const invoice = invoiceById.get(movement.sourceId);
    if (movement.kind === 'invoices' && invoice) {
      rows.push({
        ...base, document: invoice.invoiceNumber, onInvoice: null, patientId: invoice.patientId, payer: null,
        practitioner: invoice.practitionerId ?? NO_PRACTITIONER, target: { kind: 'invoice', id: invoice.id }
      });
      continue;
    }
    const receipt = receiptById.get(movement.sourceId);
    if ((movement.kind === 'receipts' || movement.kind === 'receipt_reversals') && receipt) {
      rows.push({
        ...base, document: receipt.number, onInvoice: null, patientId: receipt.patientId,
        payer: receipt.payerType === 'patient' ? null : payerLabel(receipt),
        practitioner: receiptPractitioner(sources.allocatedPractitioners.get(receipt.id)), target: { kind: 'receipt', id: receipt.id }
      });
      continue;
    }
    const adjustment = adjustmentById.get(movement.sourceId);
    if (!adjustment) continue;
    const onInvoice = adjustment.invoiceId ? invoiceById.get(adjustment.invoiceId) ?? null : null;
    rows.push({
      ...base,
      document: adjustment.number,
      onInvoice: onInvoice?.invoiceNumber ?? null,
      patientId: adjustment.patientId ?? onInvoice?.patientId ?? null,
      payer: null,
      // A refund pays back money that was not allocated (credit on the account)
      practitioner: adjustment.invoiceId ? onInvoice?.practitionerId ?? NO_PRACTITIONER : NOT_ALLOCATED,
      target: adjustment.invoiceId ? { kind: 'invoice', id: adjustment.invoiceId } : adjustment.receiptId ? { kind: 'receipt', id: adjustment.receiptId } : null
    });
  }
  return rows.sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey) || (KIND_ORDER.get(a.kind) ?? 0) - (KIND_ORDER.get(b.kind) ?? 0) || a.document.localeCompare(b.document));
}

export interface TransactionFilter {
  kind: MovementKind | null;
  practitioner: string | null;
}

export const filterTransactions = (rows: readonly TransactionRow[], filter: TransactionFilter): TransactionRow[] =>
  rows.filter(row => (!filter.kind || row.kind === filter.kind) && (!filter.practitioner || row.practitioner === filter.practitioner));

export interface KindTotal {
  kind: MovementKind;
  label: string;
  count: number;
  cents: number;
}

/** Totals per type, in the ledger's order (the month end's), only the types that occur */
export function totalsByKind(rows: readonly TransactionRow[]): KindTotal[] {
  const totals = new Map<MovementKind, KindTotal>();
  for (const row of rows) {
    const total = totals.get(row.kind) ?? { kind: row.kind, label: kindLabel(row.kind), count: 0, cents: 0 };
    total.count += 1;
    total.cents += row.cents;
    totals.set(row.kind, total);
  }
  return MOVEMENT_KINDS.filter(kind => totals.has(kind.key)).map(kind => totals.get(kind.key) as KindTotal);
}

export interface PractitionerTotal {
  practitioner: string;
  count: number;
  invoicedCents: number;
  /** Payments less payments reversed */
  paymentsCents: number;
  /** Credit notes, write-offs, corrections, refunds and their reversals */
  otherCents: number;
  netCents: number;
}

const SPECIAL_LAST = [NO_PRACTITIONER, SEVERAL_PRACTITIONERS, NOT_ALLOCATED];

/** Totals per practitioner: invoiced, payments and the rest, adding up to the net change of what is owed */
export function totalsByPractitioner(rows: readonly TransactionRow[]): PractitionerTotal[] {
  const totals = new Map<string, PractitionerTotal>();
  for (const row of rows) {
    const total = totals.get(row.practitioner) ?? { practitioner: row.practitioner, count: 0, invoicedCents: 0, paymentsCents: 0, otherCents: 0, netCents: 0 };
    total.count += 1;
    if (row.kind === 'invoices') total.invoicedCents += row.cents;
    else if (row.kind === 'receipts' || row.kind === 'receipt_reversals') total.paymentsCents += row.cents;
    else total.otherCents += row.cents;
    total.netCents += row.cents;
    totals.set(row.practitioner, total);
  }
  const rank = (key: string) => SPECIAL_LAST.indexOf(key);
  return [...totals.values()].sort((a, b) => rank(a.practitioner) - rank(b.practitioner) || b.invoicedCents - a.invoicedCents);
}

/** A practitioner key in words */
export function practitionerLabel(key: string, names: StaffNames): string {
  if (key === NO_PRACTITIONER) return 'No practitioner recorded';
  if (key === SEVERAL_PRACTITIONERS) return 'Several practitioners';
  if (key === NOT_ALLOCATED) return 'Not allocated to an invoice yet';
  return staffName(key, names, 'Practitioner not on the staff list');
}

const amount = (cents: number): number => cents / 100;

export const TRANSACTION_NOTES = [
  'Amounts are what each entry did to what patients and funds owe: invoices add; payments, credit notes and write-offs take off (shown negative). A reversal counts on the day it was made.',
  'An invoice, and every credit note, write-off and correction on it, counts for the practitioner chosen on the invoice. A payment counts for the practitioner of the invoices it paid; one spread over several practitioners is under "Several practitioners" (Cash flow per practitioner splits it).'
];

export interface TransactionTableInput {
  rows: readonly TransactionRow[];
  periodLabel: string;
  patientNames: Readonly<Record<string, string>>;
  staffNames: StaffNames;
}

/** The detailed list: one row per entry, each opening its invoice or payment */
export function transactionDetailTable({ rows, periodLabel, patientNames, staffNames }: TransactionTableInput): LinkedReport {
  const total = rows.reduce((sum, row) => sum + row.cents, 0);
  return {
    table: {
      title: 'Practice transactions',
      basis: `Entries dated ${periodLabel}`,
      columns: [
        { header: 'Day', type: 'date' },
        { header: 'Type', type: 'text' },
        { header: 'Document', type: 'text' },
        { header: 'On invoice', type: 'text' },
        { header: 'Patient or payer', type: 'text' },
        { header: 'Practitioner', type: 'text' },
        { header: 'Amount', type: 'money' }
      ],
      rows: rows.map(row => [
        row.dateKey,
        kindLabel(row.kind),
        row.document,
        row.onInvoice ?? '',
        row.payer ?? ((row.patientId && patientNames[row.patientId]) || (row.patientId ? 'Patient' : '')),
        practitionerLabel(row.practitioner, staffNames),
        amount(row.cents)
      ] as CsvCell[]),
      totals: ['Total', `${rows.length} entries`, '', '', '', '', amount(total)],
      notes: TRANSACTION_NOTES
    },
    targets: rows.map(row => row.target),
    names: rows.map(row => row.target?.kind === 'invoice' && row.onInvoice ? row.onInvoice : row.document)
  };
}

/** The summary by type (in the month end's order) */
export function transactionTypeTable(rows: readonly TransactionRow[], periodLabel: string): LinkedReport {
  const totals = totalsByKind(rows);
  return {
    table: {
      title: 'Practice transactions by type',
      basis: `Entries dated ${periodLabel}`,
      columns: [{ header: 'Type', type: 'text' }, { header: 'Entries', type: 'count' }, { header: 'Amount', type: 'money' }],
      rows: totals.map(total => [total.label, total.count, amount(total.cents)] as CsvCell[]),
      totals: ['Net change in what is owed', rows.length, amount(rows.reduce((sum, row) => sum + row.cents, 0))],
      notes: TRANSACTION_NOTES
    },
    targets: totals.map(() => null)
  };
}

/** The summary by practitioner: invoiced, payments, the rest and the net change */
export function transactionPractitionerTable(rows: readonly TransactionRow[], periodLabel: string, staffNames: StaffNames): LinkedReport {
  const totals = totalsByPractitioner(rows);
  const sum = (pick: (total: PractitionerTotal) => number) => amount(totals.reduce((acc, total) => acc + pick(total), 0));
  return {
    table: {
      title: 'Practice transactions by practitioner',
      basis: `Entries dated ${periodLabel}`,
      columns: [
        { header: 'Practitioner', type: 'text' },
        { header: 'Entries', type: 'count' },
        { header: 'Invoiced', type: 'money' },
        { header: 'Payments', type: 'money' },
        { header: 'Credits, write-offs and other', type: 'money' },
        { header: 'Net change', type: 'money' }
      ],
      rows: totals.map(total => [
        practitionerLabel(total.practitioner, staffNames), total.count, amount(total.invoicedCents), amount(total.paymentsCents),
        amount(total.otherCents), amount(total.netCents)
      ] as CsvCell[]),
      totals: ['Total', rows.length, sum(t => t.invoicedCents), sum(t => t.paymentsCents), sum(t => t.otherCents), sum(t => t.netCents)],
      notes: TRANSACTION_NOTES
    },
    targets: totals.map(() => null)
  };
}
