/**
 * Consignment frames: frames a supplier leaves in the practice and still owns until they are sold. They are on the
 * shelf and sold like any frame, but carry no stock value and no payable when they arrive; each one sold (or lost)
 * becomes an amount owed to the supplier at the agreed cost, which the practice settles when the supplier's invoice
 * comes (optometry_consignment_lines in proposals/2026-10-13-optometry-frames-and-exam.sql). Pure; tested in
 * __tests__/consignment.test.ts.
 */
import { toDateKey, isValidDateKey } from '../billing/dates';
import { percentOfCents, toCents } from '../billing/money';

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** A frame item the supplier owns until sold, with what the practice pays per frame then (excl VAT) */
export interface ConsignmentFrame {
  itemId: string;
  supplierId: string | null;
  costCents: number;
}

export interface ConsignmentLine {
  id: string;
  itemId: string;
  supplierId: string | null;
  /** The stock movement it follows: sold, back from an invoice, lost or found */
  kind: string;
  /** Frames owed (+) or no longer owed (-) */
  quantity: number;
  costEachCents: number;
  vatRate: number;
  invoiceId: string | null;
  invoiceLineId: string | null;
  patientId: string | null;
  happenedOn: string;
  settledAt: string | null;
  expenseId: string | null;
  supplierReference: string | null;
}

export const CONSIGNMENT_LINE_COLUMNS =
  'id, item_id, supplier_id, kind, quantity, cost_each, vat_rate, invoice_id, invoice_line_id, patient_id, happened_on, settled_at, ' +
  'expense_id, supplier_reference';

export function toConsignmentLine(row: Row): ConsignmentLine {
  return {
    id: String(row.id),
    itemId: String(row.item_id ?? ''),
    supplierId: text(row.supplier_id),
    kind: text(row.kind) ?? 'sold',
    quantity: num(row.quantity) ?? 0,
    costEachCents: toCents(num(row.cost_each) ?? 0),
    vatRate: num(row.vat_rate) ?? 0,
    invoiceId: text(row.invoice_id),
    invoiceLineId: text(row.invoice_line_id),
    patientId: text(row.patient_id),
    happenedOn: typeof row.happened_on === 'string' ? toDateKey(row.happened_on) ?? '' : '',
    settledAt: text(row.settled_at),
    expenseId: text(row.expense_id),
    supplierReference: text(row.supplier_reference)
  };
}

export interface LineAmounts {
  exclCents: number;
  vatCents: number;
  inclCents: number;
}

/** A line's amount: frames times the agreed cost, VAT on that per line (as the database works it out) */
export function lineAmounts(line: Pick<ConsignmentLine, 'quantity' | 'costEachCents' | 'vatRate'>): LineAmounts {
  const exclCents = line.quantity * line.costEachCents;
  const vatCents = Math.sign(exclCents) * percentOfCents(Math.abs(exclCents), line.vatRate);
  return { exclCents, vatCents, inclCents: exclCents + vatCents };
}

export const LINE_KIND_LABELS: Readonly<Record<string, string>> = {
  sold: 'Sold',
  sale_reversed: 'Back from an invoice',
  dispensed: 'Given out',
  dispense_reversed: 'Given back',
  adjusted: 'Lost, damaged or found',
  counted: 'Stock count difference'
};

export interface SupplierOwed {
  supplierId: string | null;
  /** Lines not settled yet, oldest first */
  lines: ConsignmentLine[];
  frames: number;
  exclCents: number;
  vatCents: number;
  inclCents: number;
}

/** What the practice owes each supplier for consignment frames sold or lost and not settled yet; largest first */
export function owedBySupplier(lines: readonly ConsignmentLine[]): SupplierOwed[] {
  const bySupplier = new Map<string, SupplierOwed>();
  for (const line of lines) {
    if (line.settledAt) continue;
    const key = line.supplierId ?? '';
    const entry = bySupplier.get(key) ?? { supplierId: line.supplierId, lines: [], frames: 0, exclCents: 0, vatCents: 0, inclCents: 0 };
    const amounts = lineAmounts(line);
    entry.lines.push(line);
    entry.frames += line.quantity;
    entry.exclCents += amounts.exclCents;
    entry.vatCents += amounts.vatCents;
    entry.inclCents += amounts.inclCents;
    bySupplier.set(key, entry);
  }
  return [...bySupplier.values()]
    .map(entry => ({ ...entry, lines: [...entry.lines].sort((a, b) => a.happenedOn.localeCompare(b.happenedOn)) }))
    .filter(entry => entry.lines.length > 0)
    .sort((a, b) => b.inclCents - a.inclCents);
}

export interface SupplierShelf {
  supplierId: string | null;
  frames: number;
  /** At the agreed cost (excl VAT): what the practice would owe if all were sold */
  costCents: number;
}

/** The supplier's frames still on the practice's shelf (on hand from the stock ledger), per supplier */
export function onConsignment(frames: readonly ConsignmentFrame[], onHand: ReadonlyMap<string, number>): SupplierShelf[] {
  const bySupplier = new Map<string, SupplierShelf>();
  for (const frame of frames) {
    const count = Math.max(onHand.get(frame.itemId) ?? 0, 0);
    if (count === 0) continue;
    const key = frame.supplierId ?? '';
    const entry = bySupplier.get(key) ?? { supplierId: frame.supplierId, frames: 0, costCents: 0 };
    entry.frames += count;
    entry.costCents += count * frame.costCents;
    bySupplier.set(key, entry);
  }
  return [...bySupplier.values()].sort((a, b) => b.costCents - a.costCents);
}

export interface SettleDraft {
  supplierReference: string;
  documentDate: string;
}

/**
 * Settling turns the chosen lines into the supplier's payable (Finance > Ledgers > Expenses), the way a delivery's
 * supplier invoice is recorded. Their total must be something owed.
 */
export function validateSettle(
  draft: SettleDraft,
  options: { practiceId: string; supplierId: string | null; lines: readonly ConsignmentLine[]; today: string }
): { ok: true; payload: Record<string, unknown>; inclCents: number } | { ok: false; errors: Partial<Record<keyof SettleDraft | 'lines', string>> } {
  const errors: Partial<Record<keyof SettleDraft | 'lines', string>> = {};
  const reference = draft.supplierReference.trim();
  if (!options.supplierId) errors.lines = 'These frames have no supplier named: name it on the frame first.';
  if (!reference) errors.supplierReference = 'Type the number on the supplier\'s invoice.';
  else if (reference.length > 60) errors.supplierReference = 'Keep the number to 60 characters.';
  if (!isValidDateKey(draft.documentDate) || draft.documentDate > options.today) errors.documentDate = 'The invoice date, today or earlier.';
  const open = options.lines.filter(line => !line.settledAt);
  const inclCents = open.reduce((sum, line) => sum + lineAmounts(line).inclCents, 0);
  if (open.length === 0) errors.lines = 'Choose the frames this invoice is for.';
  else if (inclCents <= 0) errors.lines = 'Nothing is owed on these lines.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    inclCents,
    payload: {
      practice_id: options.practiceId,
      supplier_id: options.supplierId,
      supplier_reference: reference,
      document_date: draft.documentDate,
      line_ids: open.map(line => line.id)
    }
  };
}
