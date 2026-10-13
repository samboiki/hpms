/**
 * Payments by the age of the debt they paid (parity R1; Eminance's allocations list): which age band the money received
 * in a period settled. Each part of a payment that was allocated to an invoice counts in the age band of that invoice
 * on the day the money came in (days since the invoice date, in the 30-day bands of the age analysis: current, 30, 60
 * ... 180+); money not allocated yet and money refunded are rows of their own, so the total is the money received in
 * the period, as in Collections. Reversed payments and allocations never count. Whole cents.
 */
import {
  AGE_BANDS,
  PORTION_LABELS,
  RECEIPT_METHOD_LABELS,
  ageBandFor,
  daysBetween,
  invoiceDateKey,
  isEffective,
  isInRange,
  payerLabel,
  type AgeBand,
  type ArAllocation,
  type ArReceipt,
  type DateRange,
  type LedgerInvoice,
  type Portion
} from '../../../services/ledgerService';
import type { CsvCell } from '../financeExport';
import type { LinkedReport } from './reportTargets';

/** A row of the summary: an age band, or money that paid no invoice */
export type AgeRowKey = AgeBand | 'unallocated' | 'refunded';

export type PaymentRef = Pick<ArReceipt, 'id' | 'number' | 'receivedOn' | 'payerType' | 'patientId' | 'fundName' | 'payerName' | 'method'>;

/** One part of one payment: an allocation to an invoice, or what is left on the payment or was refunded from it */
export interface PaymentPart {
  key: string;
  rowKey: AgeRowKey;
  payment: PaymentRef;
  /** The invoice an allocation paid; null for money on no invoice (and for an invoice that could not be read) */
  invoice: { id: string; number: string; dateKey: string | null } | null;
  /** Days from the invoice date to the day the money came in (0 for money paid before the invoice's date); null when undated */
  ageDays: number | null;
  portion: Portion | null;
  cents: number;
}

/**
 * The parts of the payments received in the range: every standing allocation of every standing payment, in the age
 * band of its invoice on the day the money came in, plus what each payment still holds and what was refunded from it.
 * An invoice with no usable date cannot be shown to be recent, so it counts in the oldest band (as in the age analysis).
 */
export function paymentParts(
  receipts: readonly ArReceipt[],
  allocations: readonly ArAllocation[],
  invoices: ReadonlyMap<string, Pick<LedgerInvoice, 'id' | 'invoiceNumber' | 'issueDate' | 'createdAt'>>,
  range: DateRange
): PaymentPart[] {
  const payments = new Map(
    receipts.filter(receipt => isEffective(receipt) && isInRange(receipt.receivedOn, range)).map(receipt => [receipt.id, receipt])
  );
  const parts: PaymentPart[] = [];
  for (const allocation of allocations) {
    const receipt = payments.get(allocation.receiptId);
    if (!receipt || !isEffective(allocation) || allocation.amountCents === 0) continue;
    const invoice = invoices.get(allocation.invoiceId);
    const dateKey = invoice ? invoiceDateKey(invoice) : null;
    const ageDays = dateKey && receipt.receivedOn ? Math.max(daysBetween(dateKey, receipt.receivedOn), 0) : null;
    parts.push({
      key: `allocation:${allocation.id}`,
      rowKey: ageBandFor(ageDays),
      payment: receipt,
      invoice: invoice ? { id: invoice.id, number: invoice.invoiceNumber, dateKey } : null,
      ageDays,
      portion: allocation.portion,
      cents: allocation.amountCents
    });
  }
  for (const receipt of payments.values()) {
    if (receipt.unallocatedCents > 0) {
      parts.push({ key: `unallocated:${receipt.id}`, rowKey: 'unallocated', payment: receipt, invoice: null, ageDays: null, portion: null, cents: receipt.unallocatedCents });
    }
    if (receipt.refundedCents > 0) {
      parts.push({ key: `refunded:${receipt.id}`, rowKey: 'refunded', payment: receipt, invoice: null, ageDays: null, portion: null, cents: receipt.refundedCents });
    }
  }
  return parts;
}

export interface AgeRow {
  key: AgeRowKey;
  medicalAidCents: number;
  patientCents: number;
  totalCents: number;
  /** Payments with money in this row */
  payments: number;
}

export const ROW_LABELS: Readonly<Record<AgeRowKey, string>> = {
  ...(Object.fromEntries(AGE_BANDS.map(band => [band.key, band.label])) as Record<AgeBand, string>),
  unallocated: 'Not allocated to an invoice yet',
  refunded: 'Refunded'
};

/** Every age band (empty ones too, so a practice sees that nothing paid old debt), then unallocated and refunded money when there is any */
export function ageRows(parts: readonly PaymentPart[]): AgeRow[] {
  const rows = new Map<AgeRowKey, AgeRow & { ids: Set<string> }>();
  const keys: AgeRowKey[] = [...AGE_BANDS.map(band => band.key), 'unallocated', 'refunded'];
  for (const key of keys) rows.set(key, { key, medicalAidCents: 0, patientCents: 0, totalCents: 0, payments: 0, ids: new Set() });
  for (const part of parts) {
    const row = rows.get(part.rowKey);
    if (!row) continue;
    if (part.portion === 'medical_aid') row.medicalAidCents += part.cents;
    if (part.portion === 'patient') row.patientCents += part.cents;
    row.totalCents += part.cents;
    row.ids.add(part.payment.id);
  }
  return keys
    .map(key => rows.get(key) as AgeRow & { ids: Set<string> })
    .filter(row => (row.key !== 'unallocated' && row.key !== 'refunded') || row.totalCents !== 0)
    .map(({ ids, ...row }) => ({ ...row, payments: ids.size }));
}

const amount = (cents: number): number => cents / 100;

export const AGE_NOTES = [
  'Each part of a payment that was allocated to an invoice counts in the age band of that invoice on the day the money came in: days since the invoice date, in the 30-day bands of the age analysis. Money paid before an invoice\'s date (a deposit) counts as current; an invoice without a date counts as 180+ days.',
  'Money not allocated to an invoice yet and money refunded are on their own rows, so the total is the money received in these days, as in Collections. Reversed payments and allocations never count.'
];

/** One row per age band (and unallocated, refunded) with the medical aid and patient portions; a row lists its allocations */
export function ageSummaryTable(parts: readonly PaymentPart[], periodLabel: string): LinkedReport & { keys: AgeRowKey[] } {
  const rows = ageRows(parts);
  const allocated = rows.filter(row => row.key !== 'unallocated' && row.key !== 'refunded').reduce((sum, row) => sum + row.totalCents, 0);
  const total = rows.reduce((sum, row) => ({ ma: sum.ma + row.medicalAidCents, patient: sum.patient + row.patientCents, all: sum.all + row.totalCents }), { ma: 0, patient: 0, all: 0 });
  const payments = new Set(parts.map(part => part.payment.id)).size;
  const onInvoice = (key: AgeRowKey) => key !== 'unallocated' && key !== 'refunded';
  return {
    table: {
      title: 'Payments by age of debt',
      basis: `Payments received ${periodLabel}, by the age of the invoices they paid`,
      columns: [
        { header: 'Age of the debt', type: 'text' },
        { header: 'Medical aid portion', type: 'money' },
        { header: 'Patient portion', type: 'money' },
        { header: 'Total', type: 'money' },
        { header: 'Share of what was allocated', type: 'percent' },
        { header: 'Payments', type: 'count' }
      ],
      rows: rows.map(row => [
        ROW_LABELS[row.key],
        onInvoice(row.key) ? amount(row.medicalAidCents) : null,
        onInvoice(row.key) ? amount(row.patientCents) : null,
        amount(row.totalCents),
        onInvoice(row.key) && allocated !== 0 ? row.totalCents / allocated : null,
        row.payments
      ] as CsvCell[]),
      totals: ['Total received', amount(total.ma), amount(total.patient), amount(total.all), allocated !== 0 ? 1 : null, payments],
      notes: AGE_NOTES
    },
    // A summary row lists its allocations instead of leaving the report
    targets: rows.map(() => null),
    keys: rows.map(row => row.key)
  };
}

/** Every part: day received, payment, payer, invoice, its date and age, band, portion and amount; each opens its payment */
export function agePartsTable(parts: readonly PaymentPart[], periodLabel: string, patientNames: Readonly<Record<string, string>>): LinkedReport {
  const order = (part: PaymentPart) => [...AGE_BANDS.map(band => band.key), 'unallocated', 'refunded'].indexOf(part.rowKey);
  const sorted = [...parts].sort((a, b) =>
    (a.payment.receivedOn ?? '').localeCompare(b.payment.receivedOn ?? '') || a.payment.number.localeCompare(b.payment.number) || order(a) - order(b) || a.key.localeCompare(b.key));
  return {
    table: {
      title: 'Payments by age of debt: every allocation',
      basis: `Payments received ${periodLabel}`,
      columns: [
        { header: 'Day received', type: 'date' },
        { header: 'Payment', type: 'text' },
        { header: 'Paid by', type: 'text' },
        { header: 'Method', type: 'text' },
        { header: 'Invoice', type: 'text' },
        { header: 'Invoice date', type: 'date' },
        { header: 'Days old', type: 'count' },
        { header: 'Age of the debt', type: 'text' },
        { header: 'Portion', type: 'text' },
        { header: 'Amount', type: 'money' }
      ],
      rows: sorted.map(part => [
        part.payment.receivedOn,
        part.payment.number,
        payerLabel(part.payment, { ...patientNames }),
        RECEIPT_METHOD_LABELS[part.payment.method],
        part.invoice?.number ?? (part.rowKey === 'unallocated' || part.rowKey === 'refunded' ? '' : 'Invoice not found'),
        part.invoice?.dateKey ?? null,
        part.ageDays,
        ROW_LABELS[part.rowKey],
        part.portion ? PORTION_LABELS[part.portion] : '',
        amount(part.cents)
      ] as CsvCell[]),
      totals: ['Total', '', '', '', '', '', null, '', '', amount(sorted.reduce((sum, part) => sum + part.cents, 0))],
      notes: AGE_NOTES
    },
    targets: sorted.map(part => ({ kind: 'receipt' as const, id: part.payment.id })),
    names: sorted.map(part => part.payment.number)
  };
}
