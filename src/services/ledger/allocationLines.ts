import { formatNad, fromCents } from '../../utils/billing/money';
import { dateKeyFrom } from './dates';
import { toCents } from './money';
import { asPortion, type AllocationCover, type Portion, type PortionCents } from './arModel';

// ---------------------------------------------------------------------------------------------
// What a payment covers, line by line (receipt_allocation_lines and ar_invoice_line_balances in
// proposals/2026-10-09-allocation-lines.sql). An allocation still pays one invoice and portion; these
// rules spread it over the invoice's lines. The database splits every allocation that staff did not
// split by hand with the same rule (ar_split_allocation_over_lines), so the preview on screen is what
// is saved. Nothing here talks to the database.
// ---------------------------------------------------------------------------------------------

/** One invoice line with what is billed, paid and still unpaid on it (ar_invoice_line_balances) */
export interface InvoiceLineOpen {
  lineId: string;
  invoiceId: string;
  code: string;
  description: string;
  /** yyyy-MM-dd: the line's own date, else its invoice's; null when neither is known */
  dateKey: string | null;
  /** The order the line was added in (invoice_services.system_transaction_number) */
  order: number;
  billed: PortionCents;
  paid: PortionCents;
  /** Taken off by credit notes per line (credit_note_lines, proposals/2026-10-12-allocation-lines-credits.sql) */
  credited: PortionCents;
  /** Billed less paid and credited, both portions together */
  unpaidCents: number;
}

type Numeric = number | string | null | undefined;

export interface RawInvoiceLineBalanceRow {
  invoice_line_id: string;
  invoice_id?: string | null;
  code?: string | null;
  description?: string | null;
  line_date?: string | null;
  line_order?: number | null;
  billed?: Numeric;
  medical_aid_billed?: Numeric;
  patient_billed?: Numeric;
  medical_aid_paid?: Numeric;
  patient_paid?: Numeric;
  unpaid?: Numeric;
  medical_aid_credited?: Numeric;
  patient_credited?: Numeric;
}

export function normalizeInvoiceLineBalance(row: RawInvoiceLineBalanceRow): InvoiceLineOpen | null {
  if (!row.invoice_line_id || !row.invoice_id) return null;
  return {
    lineId: row.invoice_line_id,
    invoiceId: row.invoice_id,
    code: row.code?.trim() || '',
    description: row.description?.trim() || '',
    dateKey: dateKeyFrom(row.line_date),
    order: typeof row.line_order === 'number' ? row.line_order : 0,
    billed: { medical_aid: toCents(row.medical_aid_billed), patient: toCents(row.patient_billed) },
    paid: { medical_aid: toCents(row.medical_aid_paid), patient: toCents(row.patient_paid) },
    credited: { medical_aid: toCents(row.medical_aid_credited), patient: toCents(row.patient_credited) },
    unpaidCents: toCents(row.unpaid)
  };
}

export interface RawAllocationLineRow {
  id: string;
  allocation_id?: string | null;
  invoice_line_id?: string | null;
  portion?: string | null;
  amount?: Numeric;
  line_code?: string | null;
  line_description?: string | null;
  line_date?: string | null;
  source?: string | null;
  /** proposals/2026-10-12-allocation-practitioner.sql */
  practitioner_id?: string | null;
}

export function normalizeAllocationCover(row: RawAllocationLineRow): AllocationCover | null {
  const portion = asPortion(row.portion);
  if (!row.allocation_id || !portion) return null;
  return {
    allocationId: row.allocation_id,
    invoiceLineId: row.invoice_line_id ?? null,
    code: row.line_code?.trim() || null,
    description: row.line_description?.trim() || null,
    dateKey: dateKeyFrom(row.line_date),
    portion,
    amountCents: toCents(row.amount),
    chosen: row.source === 'chosen',
    practitionerId: row.practitioner_id ?? null
  };
}

/** Oldest first: by date (an undated line first, as undated invoices are), then in the order the lines were added */
export function sortLinesOldestFirst<T extends Pick<InvoiceLineOpen, 'dateKey' | 'order' | 'lineId'>>(lines: readonly T[]): T[] {
  return [...lines].sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      if (a.dateKey === null) return -1;
      if (b.dateKey === null) return 1;
      return a.dateKey.localeCompare(b.dateKey);
    }
    // Then by id as the database orders uuids (byte order, not the browser's collation)
    return a.order - b.order || (a.lineId < b.lineId ? -1 : a.lineId > b.lineId ? 1 : 0);
  });
}

/** A portion's own part of a line still open: billed, less paid and credited on that portion */
const openPart = (line: InvoiceLineOpen, portion: Portion): number =>
  Math.max(line.billed[portion] - line.paid[portion] - line.credited[portion], 0);

/**
 * What one line can still take on a portion: what is unpaid on it; a fund pays no more than its own
 * part of the line (a patient may pay the part the fund did not, once it was moved to them).
 */
export function lineRoomCents(line: InvoiceLineOpen, portion: Portion): number {
  const unpaid = Math.max(line.unpaidCents, 0);
  return portion === 'medical_aid' ? Math.min(unpaid, openPart(line, 'medical_aid')) : unpaid;
}

export interface LineAmount {
  lineId: string;
  amountCents: number;
}

export interface LineSplit {
  lines: LineAmount[];
  /** On the invoice but on none of its lines: interest, a correction, a total above its lines */
  offLineCents: number;
}

/**
 * The automatic split of a payment on one invoice and portion (the default): oldest line first, each
 * line's own portion first; a patient's payment then pays what is still unpaid on a line (the part a
 * fund did not pay, moved to the patient); what is left is on none of the lines.
 */
export function suggestLineSplit(amountCents: number, portion: Portion, lines: readonly InvoiceLineOpen[]): LineSplit {
  let left = Math.max(Math.trunc(amountCents), 0);
  const taken = new Map<string, number>();
  const ordered = sortLinesOldestFirst(lines);
  const take = (lineId: string, room: number) => {
    const cents = Math.min(left, Math.max(room - (taken.get(lineId) ?? 0), 0));
    if (cents <= 0) return;
    taken.set(lineId, (taken.get(lineId) ?? 0) + cents);
    left -= cents;
  };
  for (const line of ordered) {
    if (left <= 0) break;
    take(line.lineId, Math.min(Math.max(line.unpaidCents, 0), openPart(line, portion)));
  }
  if (portion === 'patient') {
    for (const line of ordered) {
      if (left <= 0) break;
      take(line.lineId, Math.max(line.unpaidCents, 0));
    }
  }
  return {
    lines: ordered.filter(line => (taken.get(line.lineId) ?? 0) > 0).map(line => ({ lineId: line.lineId, amountCents: taken.get(line.lineId) ?? 0 })),
    offLineCents: left
  };
}

export interface LineSplitCheck {
  ok: boolean;
  /** What is wrong with the lines as a whole */
  error: string | null;
  /** What is wrong with a line, by line id */
  lineErrors: Record<string, string>;
  totalCents: number;
}

const nad = (cents: number): string => formatNad(fromCents(cents));

/**
 * Lines chosen by staff for one invoice and portion: each an amount the line can still take, and
 * together exactly what is paid on the invoice (the database checks the same, ar_insert_allocation_lines).
 */
export function checkLineSplit(amountCents: number, portion: Portion, lines: readonly InvoiceLineOpen[], chosen: readonly LineAmount[]): LineSplitCheck {
  const lineErrors: Record<string, string> = {};
  let totalCents = 0;
  const byId = new Map(lines.map(line => [line.lineId, line]));
  for (const entry of chosen) {
    if (entry.amountCents === 0) continue;
    const line = byId.get(entry.lineId);
    if (!line) {
      lineErrors[entry.lineId] = 'Not a line of this invoice';
      continue;
    }
    if (!Number.isInteger(entry.amountCents) || entry.amountCents < 0) {
      lineErrors[entry.lineId] = 'Enter an amount in N$ and cents';
      continue;
    }
    const room = lineRoomCents(line, portion);
    if (entry.amountCents > room) lineErrors[entry.lineId] = `More than the ${nad(room)} still unpaid on this line`;
    totalCents += entry.amountCents;
  }
  let error: string | null = null;
  if (totalCents === 0) error = 'Enter what each line is paid';
  else if (totalCents !== amountCents) error = `The lines add up to ${nad(totalCents)}, not the ${nad(amountCents)} paid on this invoice`;
  return { ok: error === null && Object.keys(lineErrors).length === 0, error, lineErrors, totalCents };
}

/** A split before it is saved, as covers (so the screen and the receipt word it as a saved one) */
export function splitCovers(split: LineSplit, lines: readonly InvoiceLineOpen[], portion: Portion): AllocationCover[] {
  const byId = new Map(lines.map(line => [line.lineId, line]));
  const covers: AllocationCover[] = split.lines.map(entry => {
    const line = byId.get(entry.lineId);
    return { allocationId: '', invoiceLineId: entry.lineId, code: line?.code || null, description: line?.description || null, dateKey: line?.dateKey ?? null, portion, amountCents: entry.amountCents, chosen: false };
  });
  return split.offLineCents > 0
    ? [...covers, { allocationId: '', invoiceLineId: null, code: null, description: null, dateKey: null, portion, amountCents: split.offLineCents, chosen: false }]
    : covers;
}

/** "0190 Consultation", or the words for money on none of the lines */
export const coverLabel = (cover: Pick<AllocationCover, 'invoiceLineId' | 'code' | 'description'>): string =>
  cover.invoiceLineId === null && !cover.code
    ? 'Not on a line (interest or a correction)'
    : [cover.code, cover.description].filter(Boolean).join(' ') || 'Invoice line';

/**
 * "0190 Consultation (Dr A Shikongo)": the line and whose work it paid (parity H4), when the practitioner is known;
 * a practitioner removed from the practice since reads "Former practitioner"
 */
export function coverLabelWithPractitioner(
  cover: Pick<AllocationCover, 'invoiceLineId' | 'code' | 'description' | 'practitionerId'>,
  nameOf?: (practitionerId: string) => string | null
): string {
  if (!cover.practitionerId || !nameOf) return coverLabel(cover);
  return `${coverLabel(cover)} (${nameOf(cover.practitionerId) ?? 'Former practitioner'})`;
}

/**
 * "0190 Consultation N$ 200.00 · 8101 Dressing N$ 100.00" (receipts and the invoice's payments); with `nameOf`, each line
 * also names its practitioner: "0190 Consultation (Dr A Shikongo) N$ 200.00"
 */
export const coverSummary = (covers: readonly AllocationCover[], nameOf?: (practitionerId: string) => string | null): string =>
  covers.map(cover => `${coverLabelWithPractitioner(cover, nameOf)} ${nad(cover.amountCents)}`).join(' · ');

/** The codes a payment covered, each once, for a statement line: "0190, 8101" */
export function coverCodes(covers: readonly AllocationCover[]): string {
  const codes: string[] = [];
  for (const cover of covers) {
    const code = cover.code ?? (cover.invoiceLineId === null ? 'other' : null);
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes.join(', ');
}

/** The covers of each allocation, by allocation id */
export function coversByAllocation(covers: readonly AllocationCover[]): Map<string, AllocationCover[]> {
  const map = new Map<string, AllocationCover[]>();
  for (const cover of covers) map.set(cover.allocationId, [...(map.get(cover.allocationId) ?? []), cover]);
  return map;
}
