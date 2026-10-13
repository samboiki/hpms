/**
 * Frame reports: every frame sold in a period (month to date by default) with its barcode, invoice, price, cost and
 * who sold it; the totals per salesperson; and every frame by barcode with its status. Sales come from the stock
 * ledger (so they agree with the stock figures), net of lines taken off invoices again; prices from the invoice
 * lines; the barcode and salesperson from the frame's record. Pure; tested in __tests__/frameReports.test.ts.
 */
import { daysBetweenKeys, toDateKey } from '../billing/dates';
import type { StockMovement } from '../stock/stockRows';
import { withoutVat } from './jobCosting';
import { isOnHandStatus, type FrameUnit, type FrameUnitStatus } from './frameUnits';

export interface FrameInfo {
  name: string;
  brand: string;
  /** The supplier who owns it until it is sold (consignment), else null */
  consignmentSupplierId: string | null;
}

export interface SoldLineInfo {
  totalCents: number;
  /** The stock line's VAT rate (its price includes VAT) */
  vatRate: number;
}

export interface FrameSaleLine {
  invoiceLineId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  patientId: string | null;
  soldOn: string;
  itemId: string;
  frame: string;
  brand: string;
  units: number;
  /** What the frames cost: the ledger's value, or what is owed to the supplier for a consignment frame */
  costCents: number;
  /** As invoiced (VAT included); null when the line cannot be read */
  priceCents: number | null;
  priceExclCents: number | null;
  profitCents: number | null;
  barcodes: string[];
  /** The salesperson: who reserved the frame for the patient or billed it (changeable on the frame) */
  sellerId: string | null;
  consignment: boolean;
}

type SaleMovement = Pick<StockMovement, 'itemId' | 'kind' | 'quantity' | 'valueCents' | 'invoiceLineId' | 'invoiceId' | 'documentRef' | 'patientId' | 'occurredOn' | 'createdBy' | 'createdAt'>;

/**
 * Frames billed in the period, one row per invoice line still billing them. A line taken off and saved again (a
 * visit's bill saved twice) nets to nothing and its new line counts once.
 */
export function frameSaleLines(
  movements: readonly SaleMovement[],
  frames: ReadonlyMap<string, FrameInfo>,
  options: {
    lines: ReadonlyMap<string, SoldLineInfo>;
    units: readonly Pick<FrameUnit, 'barcode' | 'invoiceLineId' | 'soldById' | 'status'>[];
    /** Owed to the supplier per invoice line, for consignment frames (excl VAT) */
    consignmentCost: ReadonlyMap<string, number>;
  }
): FrameSaleLine[] {
  const byLine = new Map<string, { first: SaleMovement; units: number; costCents: number }>();
  for (const movement of movements) {
    if ((movement.kind !== 'sold' && movement.kind !== 'sale_reversed') || !movement.invoiceLineId || !frames.has(movement.itemId)) continue;
    const entry = byLine.get(movement.invoiceLineId) ?? { first: movement, units: 0, costCents: 0 };
    // The sale itself names the day, the invoice and who billed it
    if (movement.kind === 'sold' && (entry.first.kind !== 'sold' || movement.createdAt < entry.first.createdAt)) entry.first = movement;
    entry.units -= movement.quantity;
    entry.costCents -= movement.valueCents;
    byLine.set(movement.invoiceLineId, entry);
  }
  const rows: FrameSaleLine[] = [];
  for (const [lineId, entry] of byLine) {
    if (entry.units <= 0) continue;
    const frame = frames.get(entry.first.itemId);
    if (!frame) continue;
    const line = options.lines.get(lineId) ?? null;
    const owed = options.consignmentCost.get(lineId) ?? 0;
    const costCents = entry.costCents + owed;
    const priceExclCents = line ? withoutVat(line.totalCents, line.vatRate) : null;
    const sold = options.units.filter(unit => unit.invoiceLineId === lineId && unit.status === 'sold');
    rows.push({
      invoiceLineId: lineId,
      invoiceId: entry.first.invoiceId,
      invoiceNumber: entry.first.documentRef,
      patientId: entry.first.patientId,
      soldOn: entry.first.occurredOn,
      itemId: entry.first.itemId,
      frame: frame.name,
      brand: frame.brand,
      units: entry.units,
      costCents,
      priceCents: line?.totalCents ?? null,
      priceExclCents,
      profitCents: priceExclCents === null ? null : priceExclCents - costCents,
      barcodes: sold.map(unit => unit.barcode),
      sellerId: sold.find(unit => unit.soldById)?.soldById ?? entry.first.createdBy,
      consignment: frame.consignmentSupplierId !== null
    });
  }
  return rows.sort((a, b) => a.soldOn.localeCompare(b.soldOn) || a.frame.localeCompare(b.frame));
}

export interface SalespersonRow {
  sellerId: string | null;
  frames: number;
  /** Excl VAT */
  salesCents: number;
  costCents: number;
  profitCents: number;
}

/** Frames sold per salesperson, most frames first (lines whose price cannot be read count their frames only) */
export function salesBySeller(lines: readonly FrameSaleLine[]): SalespersonRow[] {
  const bySeller = new Map<string, SalespersonRow>();
  for (const line of lines) {
    const key = line.sellerId ?? '';
    const row = bySeller.get(key) ?? { sellerId: line.sellerId, frames: 0, salesCents: 0, costCents: 0, profitCents: 0 };
    row.frames += line.units;
    row.salesCents += line.priceExclCents ?? 0;
    row.costCents += line.costCents;
    row.profitCents += line.profitCents ?? 0;
    bySeller.set(key, row);
  }
  return [...bySeller.values()].sort((a, b) => b.frames - a.frames || b.salesCents - a.salesCents);
}

export interface FrameStatusRow {
  unitId: string;
  barcode: string;
  itemId: string;
  frame: string;
  status: FrameUnitStatus;
  /** The day it got this status */
  since: string;
  by: string | null;
  patientId: string | null;
  invoiceId: string | null;
  /** Days since it came into stock, for frames still in the practice (slow sellers stand out) */
  daysInStock: number | null;
  consignmentSupplierId: string | null;
}

/** Every barcode with its status, frame by frame */
export function frameStatusRows(units: readonly FrameUnit[], frames: ReadonlyMap<string, FrameInfo>, today: string): FrameStatusRow[] {
  return units
    .map(unit => {
      const frame = frames.get(unit.itemId);
      const arrived = toDateKey(unit.createdAt);
      return {
        unitId: unit.id,
        barcode: unit.barcode,
        itemId: unit.itemId,
        frame: frame?.name ?? 'Frame',
        status: unit.status,
        since: unit.statusOn,
        by: unit.statusChangedBy,
        patientId: unit.patientId,
        invoiceId: unit.invoiceId,
        daysInStock: isOnHandStatus(unit.status) && arrived ? Math.max(daysBetweenKeys(arrived, today), 0) : null,
        consignmentSupplierId: frame?.consignmentSupplierId ?? null
      };
    })
    .sort((a, b) => a.frame.localeCompare(b.frame) || a.barcode.localeCompare(b.barcode));
}
