import { format, isValid } from 'date-fns';
import { dateKeyFrom } from './dates';
import { toCents } from './money';
import { ADJUSTMENT_LABELS, PORTION_LABELS, RECEIPT_METHOD_LABELS, asPortion, type AdjustmentKind, type Portion, type ReceiptMethod } from './arModel';

// ---------------------------------------------------------------------------------------------
// Daybook: the numbered journal of every financial event, in the order it was recorded
// (daybook_entries in proposals/2026-10-07-debtors-and-controls.sql). The database numbers the
// entries without gaps per practice, refuses any change or deletion, and logs every print and
// export, so a printed page can always be reproduced and a reprint is always marked as one.
// ---------------------------------------------------------------------------------------------

export type DaybookKind =
  | 'invoice_raised'
  | 'invoice_amended'
  | 'invoice_cancelled'
  | 'invoice_reinstated'
  | 'invoice_deleted'
  | 'receipt'
  | 'receipt_reversed'
  | 'allocation'
  | 'allocation_reversed'
  | 'credit_note'
  | 'write_off'
  | 'journal'
  | 'refund'
  | 'shortfall_transfer'
  | 'adjustment_reversed'
  | 'discount';

export const DAYBOOK_KIND_LABELS: Record<DaybookKind, string> = {
  invoice_raised: 'Invoice',
  invoice_amended: 'Invoice changed',
  invoice_cancelled: 'Invoice cancelled',
  invoice_reinstated: 'Invoice reinstated',
  invoice_deleted: 'Invoice deleted',
  receipt: 'Payment received',
  receipt_reversed: 'Payment reversed',
  allocation: 'Payment allocated',
  allocation_reversed: 'Allocation reversed',
  credit_note: 'Credit note',
  write_off: 'Write-off',
  journal: 'Correction (journal)',
  refund: 'Refund',
  shortfall_transfer: 'Shortfall moved to patient',
  adjustment_reversed: 'Adjustment reversed',
  discount: 'Discount'
};

const KINDS = Object.keys(DAYBOOK_KIND_LABELS) as DaybookKind[];

export interface DaybookEntry {
  /** Gapless per practice, in the order the entries were recorded */
  number: number;
  /** When it was recorded (timestamp) */
  recordedAt: string;
  /** The daybook day it belongs to: the local day it was recorded */
  recordedOn: string;
  /** The day it counts on in the books (invoice date, receipt date, ...) */
  businessDate: string;
  kind: DaybookKind;
  /** For adjustment entries and their reversals */
  adjustmentKind: AdjustmentKind | null;
  documentNumber: string;
  /** The other document involved: the invoice an allocation or adjustment is on, the receipt a refund pays back */
  relatedDocument: string | null;
  invoiceId: string | null;
  receiptId: string | null;
  patientId: string | null;
  portion: Portion | null;
  method: ReceiptMethod | null;
  /** The document's amount, positive */
  amountCents: number;
  /** What it did to what debtors owe (positive = owe more); allocations and shortfall transfers move nothing */
  effectCents: number;
  actor: string | null;
}

export interface RawDaybookRow {
  entry_number?: number | string | null;
  recorded_at?: string | null;
  recorded_on?: string | null;
  business_date?: string | null;
  entry_type?: string | null;
  adjustment_kind?: string | null;
  document_number?: string | null;
  related_document?: string | null;
  invoice_id?: string | null;
  receipt_id?: string | null;
  patient_id?: string | null;
  portion?: string | null;
  method?: string | null;
  amount?: number | string | null;
  debtors_effect?: number | string | null;
  actor?: string | null;
}

const ADJUSTMENT_KINDS: readonly AdjustmentKind[] = ['credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer', 'discount'];
const METHODS: readonly ReceiptMethod[] = ['cash', 'card', 'eft', 'medical_aid', 'debit_order', 'other', 'not_recorded'];

/** A row of daybook_entries; null when it is not a daybook entry this app understands */
export function normalizeDaybookEntry(row: RawDaybookRow): DaybookEntry | null {
  const number = typeof row.entry_number === 'string' ? Number(row.entry_number) : row.entry_number;
  const kind = KINDS.includes(row.entry_type as DaybookKind) ? (row.entry_type as DaybookKind) : null;
  const recordedOn = dateKeyFrom(row.recorded_on) ?? dateKeyFrom(row.recorded_at);
  if (!kind || typeof number !== 'number' || !Number.isSafeInteger(number) || !recordedOn || !row.recorded_at) return null;
  return {
    number,
    recordedAt: row.recorded_at,
    recordedOn,
    businessDate: dateKeyFrom(row.business_date) ?? recordedOn,
    kind,
    adjustmentKind: ADJUSTMENT_KINDS.includes(row.adjustment_kind as AdjustmentKind) ? (row.adjustment_kind as AdjustmentKind) : null,
    documentNumber: row.document_number?.trim() || '—',
    relatedDocument: row.related_document?.trim() || null,
    invoiceId: row.invoice_id ?? null,
    receiptId: row.receipt_id ?? null,
    patientId: row.patient_id ?? null,
    portion: asPortion(row.portion),
    method: METHODS.includes(row.method as ReceiptMethod) ? (row.method as ReceiptMethod) : null,
    amountCents: toCents(row.amount),
    effectCents: toCents(row.debtors_effect),
    actor: row.actor ?? null
  };
}

/** True when the entry counts on another day than the one it was recorded (captured late) */
export const isBackdated = (entry: Pick<DaybookEntry, 'businessDate' | 'recordedOn'>): boolean => entry.businessDate < entry.recordedOn;

/** One line of description: what happened, on which document, to which portion, how it was paid */
export function describeDaybookEntry(entry: DaybookEntry): string {
  const portion = entry.portion ? `, ${PORTION_LABELS[entry.portion].toLowerCase()} portion` : '';
  const method = entry.method ? ` (${RECEIPT_METHOD_LABELS[entry.method].toLowerCase()})` : '';
  const allocation = entry.kind === 'allocation' || entry.kind === 'allocation_reversed';
  const related = entry.relatedDocument ? `${allocation ? ' to' : ' on'} ${entry.relatedDocument}` : '';
  if (entry.kind === 'adjustment_reversed') {
    return `${entry.adjustmentKind ? ADJUSTMENT_LABELS[entry.adjustmentKind] : 'Adjustment'} ${entry.documentNumber}${related} reversed${portion}`;
  }
  return `${DAYBOOK_KIND_LABELS[entry.kind]} ${entry.documentNumber}${related}${portion}${method}`;
}

export interface DaybookKindTotal {
  kind: DaybookKind;
  label: string;
  count: number;
  amountCents: number;
  effectCents: number;
}

export interface DaybookSummary {
  /** Per entry type, in the order of DAYBOOK_KIND_LABELS; types with no entries are left out */
  byKind: DaybookKindTotal[];
  /** Change in what debtors owe from these entries */
  netEffectCents: number;
  /** Money received less refunds paid (reversals included), for the banking reconciliation */
  netReceivedCents: number;
  /** Entries recorded on a later day than the day they count on */
  backdatedCount: number;
  firstNumber: number | null;
  lastNumber: number | null;
}

export function summarizeDaybook(entries: readonly DaybookEntry[]): DaybookSummary {
  const totals = new Map<DaybookKind, DaybookKindTotal>();
  let netEffectCents = 0, netReceivedCents = 0, backdatedCount = 0;
  let firstNumber: number | null = null, lastNumber: number | null = null;
  for (const entry of entries) {
    const total = totals.get(entry.kind) ?? { kind: entry.kind, label: DAYBOOK_KIND_LABELS[entry.kind], count: 0, amountCents: 0, effectCents: 0 };
    total.count += 1;
    total.amountCents += entry.amountCents;
    total.effectCents += entry.effectCents;
    totals.set(entry.kind, total);
    netEffectCents += entry.effectCents;
    if (entry.kind === 'receipt') netReceivedCents += entry.amountCents;
    if (entry.kind === 'receipt_reversed') netReceivedCents -= entry.amountCents;
    if (entry.kind === 'refund') netReceivedCents -= entry.amountCents;
    if (entry.kind === 'adjustment_reversed' && entry.adjustmentKind === 'refund') netReceivedCents += entry.amountCents;
    if (isBackdated(entry)) backdatedCount += 1;
    firstNumber = firstNumber === null ? entry.number : Math.min(firstNumber, entry.number);
    lastNumber = lastNumber === null ? entry.number : Math.max(lastNumber, entry.number);
  }
  return {
    byKind: KINDS.filter(kind => totals.has(kind)).map(kind => totals.get(kind) as DaybookKindTotal),
    netEffectCents,
    netReceivedCents,
    backdatedCount,
    firstNumber,
    lastNumber
  };
}

/**
 * Numbers missing between the first and last entry shown. The database numbers without gaps, so
 * a gap means a page is missing from what was loaded (or something went wrong): it is shown, never
 * silently skipped.
 */
export function sequenceGaps(entries: readonly Pick<DaybookEntry, 'number'>[]): Array<{ from: number; to: number }> {
  const numbers = [...new Set(entries.map(entry => entry.number))].sort((a, b) => a - b);
  const gaps: Array<{ from: number; to: number }> = [];
  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i] > numbers[i - 1] + 1) gaps.push({ from: numbers[i - 1] + 1, to: numbers[i] - 1 });
  }
  return gaps;
}

// ---------------------------------------------------------------------------------------------
// Prints and exports: the first is the original, every later one is a marked reprint
// ---------------------------------------------------------------------------------------------

export interface DaybookPrint {
  id: string;
  /** The daybook day printed */
  dayKey: string;
  kind: 'print' | 'export';
  /** 1 for the first print or export of that day, then 2, 3 ... */
  copyNumber: number;
  fromNumber: number | null;
  toNumber: number | null;
  printedBy: string | null;
  printedAt: string;
}

export interface RawDaybookPrintRow {
  id: string;
  day?: string | null;
  kind?: string | null;
  copy_number?: number | string | null;
  from_number?: number | string | null;
  to_number?: number | string | null;
  printed_by?: string | null;
  printed_at?: string | null;
}

const optionalNumber = (value: number | string | null | undefined): number | null => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isSafeInteger(number) ? number : null;
};

export function normalizeDaybookPrint(row: RawDaybookPrintRow): DaybookPrint | null {
  const dayKey = dateKeyFrom(row.day);
  const copyNumber = optionalNumber(row.copy_number);
  if (!dayKey || copyNumber === null || copyNumber < 1 || !row.printed_at) return null;
  return {
    id: row.id,
    dayKey,
    kind: row.kind === 'export' ? 'export' : 'print',
    copyNumber,
    fromNumber: optionalNumber(row.from_number),
    toNumber: optionalNumber(row.to_number),
    printedBy: row.printed_by ?? null,
    printedAt: row.printed_at
  };
}

const formatStamp = (value: string): string => {
  const date = new Date(value);
  return isValid(date) ? format(date, 'd MMM yyyy, HH:mm') : value;
};

/**
 * The banner of a printed or exported daybook. The first copy is the original; any later copy
 * says it is a reprint, which copy it is, and when and by whom the original was made, and points
 * out entries that were not on the original (recorded after it was printed).
 */
export function printBanner(copy: Pick<DaybookPrint, 'copyNumber' | 'fromNumber' | 'toNumber'>, previous: readonly DaybookPrint[], staffNames: Readonly<Record<string, string>> = {}): string {
  if (copy.copyNumber <= 1) return 'Original';
  const original = [...previous].sort((a, b) => a.copyNumber - b.copyNumber)[0];
  const by = original?.printedBy ? ` by ${staffNames[original.printedBy] ?? 'a staff member'}` : '';
  const first = original ? ` First printed ${formatStamp(original.printedAt)}${by}.` : '';
  const newer = original?.toNumber !== null && original?.toNumber !== undefined && copy.toNumber !== null && copy.toNumber > original.toNumber
    ? ` Entries ${original.toNumber + 1} to ${copy.toNumber} were recorded after the original.`
    : '';
  return `REPRINT, copy ${copy.copyNumber}.${first}${newer}`;
}
