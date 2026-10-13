/**
 * Gross profit per item, practitioner and month (parity R9; Eminance's gross profit report): what stock items were
 * billed for against what they cost. Sales are the stock lines of uncancelled invoices dated in the period, as in
 * Revenue by tariff code, with VAT taken off at the item's rate (else the practice's, Stock > Settings) the way the stock
 * price rule splits a VAT-inclusive price. Cost is what the stock ledger took off for each line (at the average cost,
 * excluding VAT), less anything that came back. A line whose stock came back in full (a full credit note) and a line
 * with no stock movement (billed before stock was tracked) have no known cost: they are left out of the margins and
 * counted in the notes, so the report still adds up to Revenue by tariff code. Whole cents.
 */
import {
  invoiceDateKey,
  isInRange,
  isRevenueInvoice,
  monthKeyOf,
  normalizeLineItem,
  toCents,
  type DateRange,
  type LedgerInvoice,
  type RawLineItemRow
} from '../../../services/ledgerService';
import { claimedPractitionerOf } from '../../../utils/billing/claimLine';
import type { StockItem } from '../../../utils/stock/items';
import { DEFAULT_PRICE_RULE, priceStockLine } from '../../../utils/stock/pricing';
import type { StockMovement } from '../../../utils/stock/stockRows';
import type { CsvCell } from '../financeExport';
import { formatMonthKey, formatNad, pluralize } from '../financeFormat';
import { stockGroupOf } from './stockMovement';
import type { LinkedReport } from './reportTargets';

/** An invoice line that names a stock item (invoice_services with stock_item_id) */
export interface RawStockLine extends RawLineItemRow {
  id: string;
  stock_item_id: string | null;
  practitioner_id?: string | null;
}

export const STOCK_LINE_COLUMNS = 'id, invoice_id, stock_item_id, code, description, quantity, unit_price, total_price, medical_aid_covered, patient_portion, practitioner_id';

/** counted: sold with a known cost; stock_back: its stock came back in full; no_movement: never taken off stock */
export type LineState = 'counted' | 'stock_back' | 'no_movement';

export interface SoldLine {
  lineId: string;
  invoiceId: string;
  invoiceNumber: string;
  dateKey: string;
  monthKey: string;
  itemId: string;
  itemName: string;
  groupLabel: string;
  practitionerId: string | null;
  units: number;
  /** As billed, VAT included */
  billedCents: number;
  vatRate: number;
  vatCents: number;
  /** Billed less VAT */
  salesCents: number;
  /** At cost, excluding VAT, from the stock ledger */
  costCents: number;
  profitCents: number;
  state: LineState;
}

/** The part of a VAT-inclusive amount without VAT, split as the stock price rule splits a fixed price (so they never disagree) */
export function withoutVat(cents: number, vatRate: number): number {
  if (cents === 0 || !(vatRate > 0)) return cents;
  const priced = priceStockLine({ quantity: 1, lineCostCents: null, vatRate, rule: DEFAULT_PRICE_RULE, fixedUnitPriceCents: Math.abs(cents) });
  const excl = priced ? priced.exclVatCents : Math.abs(cents);
  return cents < 0 ? -excl : excl;
}

const SALE_KINDS = ['sold', 'sale_reversed'];

/** Every stock line billed in the range, with its sales, VAT, cost and profit (cancelled invoices are not sales) */
export function soldLines(input: {
  lines: readonly RawStockLine[];
  invoices: ReadonlyMap<string, LedgerInvoice>;
  /** The sold and sale_reversed movements of these lines */
  movements: readonly StockMovement[];
  items: ReadonlyMap<string, StockItem>;
  defaultVatRate: number;
  range: DateRange;
}): SoldLine[] {
  const byLine = new Map<string, { units: number; cents: number; count: number }>();
  for (const movement of input.movements) {
    if (!movement.invoiceLineId || !SALE_KINDS.includes(movement.kind)) continue;
    const line = byLine.get(movement.invoiceLineId) ?? { units: 0, cents: 0, count: 0 };
    line.units -= movement.quantity;
    line.cents -= movement.valueCents;
    line.count += 1;
    byLine.set(movement.invoiceLineId, line);
  }
  const sold: SoldLine[] = [];
  for (const row of input.lines) {
    const invoice = row.invoice_id ? input.invoices.get(row.invoice_id) : undefined;
    const dateKey = invoice ? invoiceDateKey(invoice) : null;
    const line = normalizeLineItem(row);
    if (!invoice || !line || !row.stock_item_id || !dateKey || !isRevenueInvoice(invoice) || !isInRange(dateKey, input.range)) continue;
    const item = input.items.get(row.stock_item_id);
    const stock = byLine.get(row.id);
    const billedCents = toCents(line.total);
    const vatRate = item?.vatRate ?? input.defaultVatRate;
    const salesCents = withoutVat(billedCents, vatRate);
    const costCents = stock?.cents ?? 0;
    sold.push({
      lineId: row.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      dateKey,
      monthKey: monthKeyOf(dateKey),
      itemId: row.stock_item_id,
      itemName: item?.name ?? (line.description || line.code || 'Stock item'),
      groupLabel: stockGroupOf(item).label,
      practitionerId: claimedPractitionerOf(row.practitioner_id, invoice.practitionerId),
      units: line.quantity,
      billedCents,
      vatRate,
      vatCents: billedCents - salesCents,
      salesCents,
      costCents,
      profitCents: salesCents - costCents,
      state: !stock || stock.count === 0 ? 'no_movement' : stock.units <= 0 ? 'stock_back' : 'counted'
    });
  }
  return sold;
}

export interface ProfitGroup {
  key: string;
  label: string;
  lines: number;
  units: number;
  billedCents: number;
  vatCents: number;
  salesCents: number;
  costCents: number;
  profitCents: number;
}

/** Counted lines per item, practitioner or month; the most profit first (months in order) */
export function profitBy(lines: readonly SoldLine[], keyOf: (line: SoldLine) => { key: string; label: string }, inOrder = false): ProfitGroup[] {
  const groups = new Map<string, ProfitGroup>();
  for (const line of lines) {
    if (line.state !== 'counted') continue;
    const { key, label } = keyOf(line);
    const group = groups.get(key) ?? { key, label, lines: 0, units: 0, billedCents: 0, vatCents: 0, salesCents: 0, costCents: 0, profitCents: 0 };
    group.lines += 1;
    group.units += line.units;
    group.billedCents += line.billedCents;
    group.vatCents += line.vatCents;
    group.salesCents += line.salesCents;
    group.costCents += line.costCents;
    group.profitCents += line.profitCents;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (inOrder ? a.key.localeCompare(b.key) : b.profitCents - a.profitCents || a.label.localeCompare(b.label)));
}

/** Gross profit as a share of sales excluding VAT; null without sales */
export const marginOf = (profitCents: number, salesCents: number): number | null => (salesCents !== 0 ? profitCents / salesCents : null);

const amount = (cents: number): number => cents / 100;

/** What the notes say about the lines left out of the margins, and stock given out without a bill */
export function profitNotes(lines: readonly SoldLine[], extras: { defaultVatRate: number; dispensedCostCents: number }): string[] {
  const left = (state: LineState) => lines.filter(line => line.state === state);
  const back = left('stock_back');
  const none = left('no_movement');
  const billed = (list: readonly SoldLine[]) => formatNad(amount(list.reduce((sum, line) => sum + line.billedCents, 0)));
  return [
    'Stock items billed on uncancelled invoices dated in the period (the lines in Revenue by tariff code). Cost is what the stock ledger took off for each line at the average cost, excluding VAT, less anything that came back.',
    `VAT is taken off what was billed at the item's VAT rate, else the practice's (Stock > Settings: ${extras.defaultVatRate} %). A practice that is not registered for VAT sets 0 % there.`,
    ...(back.length > 0 ? [`Left out: ${pluralize(back.length, 'line')} (${billed(back)} billed) whose stock came back after a full credit note.`] : []),
    ...(none.length > 0 ? [`Left out: ${pluralize(none.length, 'line')} (${billed(none)} billed) never taken off stock, so their cost is not known (billed before stock was tracked).`] : []),
    ...(extras.dispensedCostCents !== 0 ? [`Medicine dispensed without a bill in the period cost ${formatNad(amount(extras.dispensedCostCents))} (Stock > Reports > Dispensing).`] : [])
  ];
}

const PROFIT_COLUMNS = [
  { header: 'Units', type: 'count' as const },
  { header: 'Billed (with VAT)', type: 'money' as const },
  { header: 'VAT', type: 'money' as const },
  { header: 'Sales without VAT', type: 'money' as const },
  { header: 'Cost', type: 'money' as const },
  { header: 'Gross profit', type: 'money' as const },
  { header: 'Margin', type: 'percent' as const }
];

const figures = (row: Pick<ProfitGroup, 'units' | 'billedCents' | 'vatCents' | 'salesCents' | 'costCents' | 'profitCents'>): CsvCell[] => [
  row.units, amount(row.billedCents), amount(row.vatCents), amount(row.salesCents), amount(row.costCents), amount(row.profitCents), marginOf(row.profitCents, row.salesCents)
];

const totalOf = (rows: ReadonlyArray<Pick<ProfitGroup, 'units' | 'billedCents' | 'vatCents' | 'salesCents' | 'costCents' | 'profitCents'>>) =>
  rows.reduce((sum, row) => ({
    units: sum.units + row.units,
    billedCents: sum.billedCents + row.billedCents,
    vatCents: sum.vatCents + row.vatCents,
    salesCents: sum.salesCents + row.salesCents,
    costCents: sum.costCents + row.costCents,
    profitCents: sum.profitCents + row.profitCents
  }), { units: 0, billedCents: 0, vatCents: 0, salesCents: 0, costCents: 0, profitCents: 0 });

/** One row per item, practitioner or month; a row lists its lines */
export function profitGroupTable(groups: readonly ProfitGroup[], input: { title: string; header: string; basis: string; notes: string[] }): LinkedReport & { keys: string[] } {
  return {
    table: {
      title: input.title,
      basis: input.basis,
      columns: [{ header: input.header, type: 'text' }, ...PROFIT_COLUMNS],
      rows: groups.map(group => [group.label, ...figures(group)]),
      totals: ['Total', ...figures(totalOf(groups))],
      notes: input.notes
    },
    targets: groups.map(() => null),
    keys: groups.map(group => group.key)
  };
}

/** Every counted line: day, invoice, item, practitioner and its figures; each opens its invoice */
export function profitLineTable(lines: readonly SoldLine[], input: { basis: string; notes: string[]; practitionerName: (id: string | null) => string }): LinkedReport {
  const counted = lines.filter(line => line.state === 'counted')
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.invoiceNumber.localeCompare(b.invoiceNumber) || a.lineId.localeCompare(b.lineId));
  return {
    table: {
      title: 'Gross profit: every line',
      basis: input.basis,
      columns: [
        { header: 'Day', type: 'date' },
        { header: 'Invoice', type: 'text' },
        { header: 'Item', type: 'text' },
        { header: 'Practitioner', type: 'text' },
        ...PROFIT_COLUMNS
      ],
      rows: counted.map(line => [line.dateKey, line.invoiceNumber, line.itemName, input.practitionerName(line.practitionerId), ...figures(line)]),
      totals: ['Total', '', '', '', ...figures(totalOf(counted))],
      notes: input.notes
    },
    targets: counted.map(line => ({ kind: 'invoice' as const, id: line.invoiceId })),
    names: counted.map(line => line.invoiceNumber)
  };
}

export const monthGroup = (line: SoldLine) => ({ key: line.monthKey, label: formatMonthKey(line.monthKey, 'MMMM yyyy') });
export const itemGroup = (line: SoldLine) => ({ key: line.itemId, label: line.itemName });
