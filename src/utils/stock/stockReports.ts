/**
 * Stock reports (R33): the price list, what was sold and used in a period, goods received and returned, and the
 * transfers between stores. Each is a report table that the Stock page shows, prints and exports as CSV (the count
 * sheet is countSheetTable in src/components/stock/stockDocuments.ts). Pure: built from the stock ledger's movements
 * and documents; money in cents (in the tables as N$ amounts).
 */
import type { ReportTable } from '../../components/finance/financeExport';
import { daysBetweenKeys, formatServiceDate } from '../billing/dates';
import { fromCents } from '../billing/money';
import type { LedgerDelivery } from './supplierLedger';
import type { StockMovement } from './stockRows';
import { TRANSFER_STATUS_LABELS, type StockTransfer } from './stores';

export interface ReportItem {
  id: string;
  name: string;
  unit: string;
  group: string | null;
  category: string;
  code: string | null;
  isActive: boolean;
}

const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name);
const period = (fromKey: string, toKey: string): string => `${formatServiceDate(fromKey)} to ${formatServiceDate(toKey)}`;

// ---------------------------------------------------------------------------------------------
// Price list
// ---------------------------------------------------------------------------------------------

export interface PriceListRow {
  item: ReportItem;
  /** "box of 30" or the unit */
  sellsAs: string;
  /** Selling price for that, incl. VAT; null when the item has no price */
  priceCents: number | null;
  /** Per unit, incl. VAT */
  unitPriceCents: number | null;
}

/** Items in use by group, then name; their selling price as the bill would charge it */
export function priceListTable(rows: readonly PriceListRow[], basis: string): ReportTable {
  // Items without a group come after the groups
  const sorted = rows.filter(row => row.item.isActive)
    .sort((a, b) => Number(a.item.group === null) - Number(b.item.group === null)
      || (a.item.group ?? '').localeCompare(b.item.group ?? '') || byName(a.item, b.item));
  return {
    title: 'Price list',
    basis,
    columns: [
      { header: 'Item', type: 'text' },
      { header: 'Group', type: 'text' },
      { header: 'Code', type: 'text' },
      { header: 'Sold as', type: 'text' },
      { header: 'Price (incl. VAT)', type: 'money' },
      { header: 'Per unit', type: 'money' }
    ],
    rows: sorted.map(row => [row.item.name, row.item.group, row.item.code, row.sellsAs,
      row.priceCents === null ? null : fromCents(row.priceCents), row.unitPriceCents === null ? null : fromCents(row.unitPriceCents)]),
    notes: ['Prices from each item\'s own price or the practice\'s price rule (Stock > Settings), including VAT. Items without a price show a dash.']
  };
}

// ---------------------------------------------------------------------------------------------
// Sales and usage
// ---------------------------------------------------------------------------------------------

export interface UsageRow {
  item: ReportItem;
  /** Units billed on invoices (less lines taken back) */
  billed: number;
  /** Units handed out without billing (less cancelled) */
  dispensed: number;
  usedInPractice: number;
  /** Broken, expired or lost */
  writtenOff: number;
  /** Count differences and the other adjustments (samples, corrections, found): positive when stock went */
  other: number;
  total: number;
  /** Cost of what went (excl. VAT), at the average cost */
  costCents: number;
  /** Cost of the units billed */
  billedCostCents: number;
  invoices: number;
}

const WRITTEN_OFF = new Set(['damaged', 'expired', 'lost']);

/**
 * What went out of stock per item in the movements given (the caller loads one period): billed, dispensed, used in the
 * practice, written off and the rest. Transfers between stores, deliveries and returns to suppliers are not usage.
 */
export function usageByItem(movements: readonly StockMovement[], items: readonly ReportItem[]): UsageRow[] {
  const rows = new Map<string, UsageRow & { invoiceIds: Set<string> }>();
  const itemOf = new Map(items.map(item => [item.id, item]));
  for (const movement of movements) {
    const item = itemOf.get(movement.itemId);
    if (!item) continue;
    const out = -movement.quantity;
    const row = rows.get(item.id) ?? {
      item, billed: 0, dispensed: 0, usedInPractice: 0, writtenOff: 0, other: 0, total: 0, costCents: 0, billedCostCents: 0, invoices: 0,
      invoiceIds: new Set<string>()
    };
    let counted = true;
    if (movement.kind === 'sold' || movement.kind === 'sale_reversed') {
      row.billed += out;
      row.billedCostCents += -movement.valueCents;
      if (movement.kind === 'sold' && movement.invoiceId) row.invoiceIds.add(movement.invoiceId);
    } else if (movement.kind === 'dispensed' || movement.kind === 'dispense_reversed') {
      row.dispensed += out;
    } else if (movement.kind === 'adjusted' && movement.reasonCode === 'used_in_practice') {
      row.usedInPractice += out;
    } else if (movement.kind === 'adjusted' && movement.reasonCode && WRITTEN_OFF.has(movement.reasonCode)) {
      row.writtenOff += out;
    } else if (movement.kind === 'adjusted' || movement.kind === 'counted') {
      row.other += out;
    } else {
      counted = false;
    }
    if (!counted) continue;
    row.total += out;
    row.costCents += -movement.valueCents;
    rows.set(item.id, row);
  }
  return [...rows.values()]
    .map(({ invoiceIds, ...row }) => ({ ...row, invoices: invoiceIds.size }))
    .filter(row => row.billed !== 0 || row.dispensed !== 0 || row.usedInPractice !== 0 || row.writtenOff !== 0 || row.other !== 0)
    .sort((a, b) => b.total - a.total || byName(a.item, b.item));
}

/** Months in a period, for "per month" (30.44 days a month), at least one */
export const monthsIn = (fromKey: string, toKey: string): number => Math.max((daysBetweenKeys(fromKey, toKey) + 1) / 30.4375, 1);

export function salesTable(rows: readonly UsageRow[], fromKey: string, toKey: string): ReportTable {
  const sold = rows.filter(row => row.billed !== 0).sort((a, b) => b.billed - a.billed || byName(a.item, b.item));
  const cost = (row: UsageRow) => row.billedCostCents;
  return {
    title: 'Sales',
    basis: `Billed ${period(fromKey, toKey)}`,
    columns: [
      { header: 'Item', type: 'text' },
      { header: 'Group', type: 'text' },
      { header: 'Unit', type: 'text' },
      { header: 'Units billed', type: 'count' },
      { header: 'Invoices', type: 'count' },
      { header: 'Cost (excl. VAT)', type: 'money' }
    ],
    rows: sold.map(row => [row.item.name, row.item.group, row.item.unit, row.billed, row.invoices, fromCents(cost(row))]),
    totals: ['Total', null, null, sold.reduce((sum, row) => sum + row.billed, 0), null, fromCents(sold.reduce((sum, row) => sum + cost(row), 0))],
    notes: ['From the stock ledger: units taken off stock by invoice lines, less lines removed, cancelled or credited in full. At cost; what was charged is on the invoices (Finance).']
  };
}

export function usageTable(rows: readonly UsageRow[], fromKey: string, toKey: string): ReportTable {
  const months = monthsIn(fromKey, toKey);
  return {
    title: 'Stock usage',
    basis: `Used ${period(fromKey, toKey)}`,
    columns: [
      { header: 'Item', type: 'text' },
      { header: 'Unit', type: 'text' },
      { header: 'Billed', type: 'count' },
      { header: 'Dispensed, not billed', type: 'count' },
      { header: 'Used in the practice', type: 'count' },
      { header: 'Written off', type: 'count' },
      { header: 'Counts and other', type: 'count' },
      { header: 'Total used', type: 'count' },
      { header: 'Per month', type: 'count' },
      { header: 'Cost (excl. VAT)', type: 'money' }
    ],
    rows: rows.map(row => [row.item.name, row.item.unit, row.billed, row.dispensed, row.usedInPractice, row.writtenOff, row.other, row.total,
      Math.round((row.total / months) * 10) / 10, fromCents(row.costCents)]),
    totals: ['Total', null, null, null, null, null, null, null, null, fromCents(rows.reduce((sum, row) => sum + row.costCents, 0))],
    notes: ['Written off: broken, expired or lost. Counts and other: stock-take differences, samples and corrections (a negative number is stock found).',
      'Transfers between stores, deliveries and returns to suppliers are not usage.']
  };
}

// ---------------------------------------------------------------------------------------------
// Goods received and returned
// ---------------------------------------------------------------------------------------------

export function goodsReceivedTable(
  deliveries: readonly LedgerDelivery[],
  supplierName: (supplierId: string) => string,
  fromKey: string,
  toKey: string
): ReportTable {
  const inPeriod = deliveries.filter(row => row.documentDate >= fromKey && row.documentDate <= toKey)
    .sort((a, b) => a.documentDate.localeCompare(b.documentDate) || a.number.localeCompare(b.number));
  const standing = inPeriod.filter(row => !row.reversedAt);
  const signed = (row: LedgerDelivery, cents: number) => (row.kind === 'returned' ? -cents : cents);
  const sum = (pick: (row: LedgerDelivery) => number) => standing.reduce((total, row) => total + signed(row, pick(row)), 0);
  return {
    title: 'Goods received and returned',
    basis: `Documents dated ${period(fromKey, toKey)}`,
    columns: [
      { header: 'Date', type: 'date' },
      { header: 'Document', type: 'text' },
      { header: 'Received or returned', type: 'text' },
      { header: 'Supplier', type: 'text' },
      { header: 'Their number', type: 'text' },
      { header: 'Excl. VAT', type: 'money' },
      { header: 'VAT', type: 'money' },
      { header: 'Total', type: 'money' },
      { header: 'Note', type: 'text' }
    ],
    rows: inPeriod.map(row => [row.documentDate, row.number, row.kind === 'received' ? 'Received' : 'Returned', supplierName(row.supplierId),
      row.supplierReference, fromCents(signed(row, row.exclVatCents)), fromCents(signed(row, row.vatCents)), fromCents(signed(row, row.inclVatCents)),
      row.reversedAt ? `Reversed: ${row.reversalReason ?? ''}`.trim() : row.kind === 'received' && !row.onAccount ? 'Not on account' : null]),
    totals: ['Total', null, null, null, null, fromCents(sum(row => row.exclVatCents)), fromCents(sum(row => row.vatCents)), fromCents(sum(row => row.inclVatCents)), null],
    notes: ['Returns are negative. Reversed documents are listed but left out of the totals.']
  };
}

// ---------------------------------------------------------------------------------------------
// Transfers between stores
// ---------------------------------------------------------------------------------------------

export function transfersTable(
  transfers: readonly StockTransfer[],
  storeName: (locationId: string | null) => string,
  staffName: (userId: string | null) => string,
  fromKey: string,
  toKey: string,
  dayOf: (timestamp: string) => string
): ReportTable {
  const inPeriod = transfers.filter(row => {
    const sent = dayOf(row.sentAt);
    return sent >= fromKey && sent <= toKey;
  }).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const units = (row: StockTransfer) => row.lines.reduce((sum, line) => sum + line.quantity, 0);
  const value = (row: StockTransfer) => row.lines.reduce((sum, line) => sum + line.valueCents, 0);
  const standing = inPeriod.filter(row => row.status !== 'cancelled');
  return {
    title: 'Transfers between stores',
    basis: `Sent ${period(fromKey, toKey)}`,
    columns: [
      { header: 'Sent', type: 'date' },
      { header: 'Transfer', type: 'text' },
      { header: 'From', type: 'text' },
      { header: 'To', type: 'text' },
      { header: 'Items', type: 'count' },
      { header: 'Units', type: 'count' },
      { header: 'Value (excl. VAT)', type: 'money' },
      { header: 'Status', type: 'text' },
      { header: 'Sent by', type: 'text' },
      { header: 'Received or cancelled', type: 'text' }
    ],
    rows: inPeriod.map(row => [dayOf(row.sentAt), row.number, storeName(row.fromLocationId), storeName(row.toLocationId), row.lines.length, units(row),
      fromCents(value(row)), TRANSFER_STATUS_LABELS[row.status], staffName(row.sentBy),
      row.status === 'received' && row.receivedAt ? `${formatServiceDate(dayOf(row.receivedAt))} by ${staffName(row.receivedBy)}`
        : row.status === 'cancelled' && row.cancelledAt ? `Cancelled ${formatServiceDate(dayOf(row.cancelledAt))}: ${row.cancelReason ?? ''}`.trim() : null]),
    totals: ['Total', null, null, null, null, standing.reduce((sum, row) => sum + units(row), 0), fromCents(standing.reduce((sum, row) => sum + value(row), 0)), null, null, null],
    notes: ['Values at the average cost when sent. Cancelled transfers are listed but left out of the totals.']
  };
}
