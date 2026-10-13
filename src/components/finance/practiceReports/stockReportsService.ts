/**
 * Data for Finance > Reports' stock movement per group (R8) and gross profit (R9): the practice's stock items and their
 * levels, the stock ledger's movements, the stock lines billed in the period and what the ledger took off for them.
 * Reads go through Stock's own loaders where they exist (src/services/stock/stockService.ts) and run with the signed-in
 * person's own rights. Before stock is set up (proposals/2026-10-07-dispensing-and-stock.sql) the loaders say
 * 'not_set_up'.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import type { DateRange, LedgerInvoice } from '../../../services/ledgerService';
import { isStockNotSetUpError, loadMovements, loadStockItems, loadStockSettings } from '../../../services/stock/stockService';
import type { StockItem } from '../../../utils/stock/items';
import { MOVEMENT_COLUMNS, normalizeMovement, type ItemLevel, type StockMovement, type StockMovementRow } from '../../../utils/stock/stockRows';
import { isArNotSetUp } from '../receipts/arService';
import { fetchByIds, timed } from '../debtors/debtorsService';
import { STOCK_LINE_COLUMNS, type RawStockLine } from './grossProfit';
import { assertRange, billedInvoices, loadPeriodInvoices, settleReport } from './periodReportsService';
import type { ReportLoad } from './practiceReportsService';

// The generated database types do not know the stock tables
const db = supabase as unknown as SupabaseClient;

// The movement columns are one joined string, so the client cannot type the rows itself
type Page<T> = PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>;

const stockNotSetUp = (error: unknown): boolean => isStockNotSetUpError(error) || isArNotSetUp(error);

// ---------------------------------------------------------------------------------------------
// R8 stock movement per group
// ---------------------------------------------------------------------------------------------

export interface StockMovementData {
  items: StockItem[];
  levels: Map<string, ItemLevel>;
  /** Every movement from the start of the period to today (the end of the period is today's level less what came after) */
  movements: StockMovement[];
}

export const loadStockMovement = (practiceId: string, range: DateRange): Promise<ReportLoad<StockMovementData>> =>
  settleReport('the stock movement', async () => {
    assertRange(range);
    const [{ items, levels }, movements] = await Promise.all([loadStockItems(practiceId), loadMovements(practiceId, { from: range.startKey })]);
    return { items, levels, movements };
  }, stockNotSetUp);

// ---------------------------------------------------------------------------------------------
// R9 gross profit
// ---------------------------------------------------------------------------------------------

export interface GrossProfitData {
  invoices: Map<string, LedgerInvoice>;
  lines: RawStockLine[];
  /** The sold and sale_reversed movements of those lines, whenever they happened */
  saleMovements: StockMovement[];
  items: Map<string, StockItem>;
  defaultVatRate: number;
  /** Settings > Practice > VAT */
  vatRegistered: boolean;
  /** Cost of medicine dispensed without a bill in the period (dispensed less cancelled), cents */
  dispensedCostCents: number;
}

export const loadGrossProfit = (practiceId: string, range: DateRange): Promise<ReportLoad<GrossProfitData>> =>
  settleReport('the gross profit', async () => {
    assertRange(range);
    const [invoices, stock, settings, periodMovements] = await Promise.all([
      loadPeriodInvoices(practiceId, range),
      loadStockItems(practiceId),
      loadStockSettings(practiceId),
      loadMovements(practiceId, { from: range.startKey, to: range.endKey })
    ]);
    const billed = billedInvoices(invoices, range);
    const lines = await timed(fetchByIds<RawStockLine>(billed.map(invoice => invoice.id), 'stock lines', (chunk, from, to) => db
      .from('invoice_services').select(STOCK_LINE_COLUMNS).in('invoice_id', chunk).not('stock_item_id', 'is', null).order('id').range(from, to)), 'stock lines');
    const movementRows = await timed(fetchByIds<StockMovementRow>(lines.map(line => line.id), 'stock taken off for the lines', (chunk, from, to) => db
      .from('stock_movements').select(MOVEMENT_COLUMNS).eq('practice_id', practiceId).in('invoice_line_id', chunk).in('kind', ['sold', 'sale_reversed'])
      .order('id').range(from, to) as unknown as Page<StockMovementRow>), 'stock taken off for the lines');
    // Issues are negative in the ledger: the cost of what went out is their value with the sign turned
    const dispensedCostCents = periodMovements
      .filter(movement => movement.kind === 'dispensed' || movement.kind === 'dispense_reversed')
      .reduce((sum, movement) => sum - movement.valueCents, 0);
    return {
      invoices: new Map(billed.map(invoice => [invoice.id, invoice])),
      lines,
      saleMovements: movementRows.flatMap(row => normalizeMovement(row) ?? []),
      items: new Map(stock.items.map(item => [item.id, item])),
      defaultVatRate: settings.defaultVatRate,
      vatRegistered: settings.vatRegistered === true,
      dispensedCostCents
    };
  }, stockNotSetUp);
