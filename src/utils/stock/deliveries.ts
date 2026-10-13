/**
 * Deliveries from suppliers: the totals of a goods-received note the way supplier invoices show them (VAT per rate,
 * on the total of the lines at that rate), and the check that the lines match the supplier invoice before saving.
 * stock_receive (proposals/2026-10-07-dispensing-and-stock.sql) works the totals out the same way and refuses a
 * delivery whose lines do not add up to the total typed from the supplier invoice.
 */
import { percentOfCents } from '../billing/money';

export interface DeliveryLineDraft {
  /** Units received */
  quantity: number;
  /** What the supplier charged for the line, excluding VAT (cents) */
  lineCostCents: number;
  vatRate: number;
}

export interface DeliveryTotals {
  exclVatCents: number;
  vatCents: number;
  inclVatCents: number;
}

export function deliveryTotals(lines: readonly DeliveryLineDraft[]): DeliveryTotals {
  const byRate = new Map<number, number>();
  let excl = 0;
  for (const line of lines) {
    excl += line.lineCostCents;
    byRate.set(line.vatRate, (byRate.get(line.vatRate) ?? 0) + line.lineCostCents);
  }
  let vat = 0;
  for (const [rate, cents] of byRate) vat += percentOfCents(cents, rate);
  return { exclVatCents: excl, vatCents: vat, inclVatCents: excl + vat };
}

/** Cost per unit of a delivery line, to the cent (shown next to the line; the ledger keeps the exact line cost) */
export const unitCostOf = (line: Pick<DeliveryLineDraft, 'quantity' | 'lineCostCents'>): number | null =>
  line.quantity > 0 ? Math.round(line.lineCostCents / line.quantity) : null;

/** The difference between the supplier invoice total and the lines (0 = they match); null when no total was typed */
export const supplierTotalDifference = (totals: DeliveryTotals, supplierTotalCents: number | null): number | null =>
  supplierTotalCents === null ? null : supplierTotalCents - totals.inclVatCents;
