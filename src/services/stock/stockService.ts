/**
 * Reads and writes for stock, suppliers and dispensing. The rules live in src/utils/stock (tested); this file only
 * talks to the database.
 *
 * - The tables and functions come from proposals/2026-10-07-dispensing-and-stock.sql. Until it is applied every
 *   call throws StockNotSetUpError and the screens say "Stock and dispensing are not set up yet".
 * - Every write goes through a stock_ function that checks the practice and the person's role, so the screens can
 *   never change the ledger directly: on hand is the sum of the movements and is never typed over.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { CANCELLED_ALIASES } from '../ledger/invoices';
import { normalizeStockItem, type StockItem, type StockItemRow } from '../../utils/stock/items';
import { priceRuleToJson, type PriceRule } from '../../utils/stock/pricing';
import { loadPricingRules } from './pricingRulesService';
import { loadVatSettings } from '../vatSettingsService';
import { isConsignmentColumnMissing } from './supplierLedgerService';
import type { DispensingRecord } from '../../utils/stock/repeats';
import {
  COUNT_COLUMNS,
  DISPENSING_COLUMNS,
  MOVEMENT_COLUMNS,
  normalizeCount,
  normalizeDelivery,
  normalizeDispensing,
  normalizeLevel,
  normalizeMovement,
  normalizeOrder,
  normalizeSettings,
  normalizeSupplier,
  normalizeValuation,
  type CountLineRow,
  type Delivery,
  type DeliveryRow,
  type DispensingRow,
  type ItemLevel,
  type ItemLevelRow,
  type StockCount,
  type StockCountRow,
  type StockMovement,
  type StockMovementRow,
  type StockSettings,
  type StockSettingsRow,
  type Supplier,
  type SupplierOrder,
  type SupplierOrderRow,
  type SupplierRow,
  type Valuation,
  type ValuationRow
} from '../../utils/stock/stockRows';

// The generated database types do not know these tables yet, so they are read with the untyped client and
// normalised (as quoteService and patientListService do).
const db = supabase as unknown as SupabaseClient;

export class StockNotSetUpError extends Error {
  constructor() {
    super('Stock and dispensing are not set up yet.');
    this.name = 'StockNotSetUpError';
  }
}

interface DbError {
  code?: string;
  message?: string;
}

const OWN_OBJECTS = /\b(stock_[a-z_]+|nappi_code|stock_item_id|item_group|max_level|pack_size|selling_price|is_scheduled|preferred_supplier_id)\b/i;

/** True when the stock tables, columns or functions are not in the database yet (only ours: any other is a real error) */
export function isStockNotSetUpError(error: unknown): boolean {
  if (error instanceof StockNotSetUpError) return true;
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!OWN_OBJECTS.test(message ?? '')) return false;
  if (code === '42P01' || code === '42703' || code === '42883' || code === 'PGRST202' || code === 'PGRST204' || code === 'PGRST205') return true;
  return /could not find the (table|function|.*column)|does not exist/i.test(message ?? '');
}

const fail = (error: DbError, fallback: string): never => {
  if (isStockNotSetUpError(error)) throw new StockNotSetUpError();
  throw new Error(error.message || fallback);
};

async function rpc<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) fail(error, fallback);
  return data as T;
}

const PAGE = 1000;

/** Every row of a query, a page at a time (the API returns at most 1000 at once) */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: DbError | null }>, fallback: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) fail(error, fallback);
    const pageRows = Array.isArray(data) ? (data as T[]) : [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE) return rows;
  }
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

export async function loadStockSettings(practiceId: string): Promise<StockSettings> {
  const [{ data, error }, pricing, vat] = await Promise.all([
    db
      .from('stock_settings')
      .select('dispensing_enabled, default_vat_rate, price_rule, script_valid_months, label_note')
      .eq('practice_id', practiceId)
      .maybeSingle(),
    // The medicine tiers, the material rule and the reference prices (pricingRulesService; never throws)
    loadPricingRules(practiceId),
    // Whether the practice is VAT registered (Settings > Practice; never throws: not registered when unreadable)
    loadVatSettings(practiceId)
  ]);
  if (error) fail(error, 'Could not read the stock settings');
  return {
    ...normalizeSettings((data as StockSettingsRow | null) ?? null),
    pricing: pricing.rules,
    pricingReadable: pricing.readable,
    pricingSetUp: pricing.setUp,
    referencePrices: pricing.referencePrices,
    vatRegistered: vat.registered
  };
}

export async function saveStockSettings(
  practiceId: string,
  settings: { dispensingEnabled: boolean; defaultVatRate: number; priceRule: PriceRule; scriptValidMonths: number; labelNote: string | null }
): Promise<void> {
  await rpc('stock_save_settings', {
    p_practice_id: practiceId,
    p_payload: {
      dispensing_enabled: settings.dispensingEnabled,
      default_vat_rate: settings.defaultVatRate,
      price_rule: priceRuleToJson(settings.priceRule),
      script_valid_months: settings.scriptValidMonths,
      label_note: settings.labelNote
    }
  }, 'Could not save the settings');
}

// ---------------------------------------------------------------------------------------------
// Items and their movements
// ---------------------------------------------------------------------------------------------

const ITEM_COLUMNS =
  'id, practice_id, name, description, category, sku, unit, nappi_code, barcode, item_group, tariff_code, vat_rate, selling_price, ' +
  'unit_cost, reorder_level, max_level, pack_size, preferred_supplier_id, location, notes, is_scheduled, schedule_label, ' +
  'default_directions, is_active, quantity, expiry_date';

export interface StockItemsLoad {
  items: StockItem[];
  levels: Map<string, ItemLevel>;
}

export async function loadStockItems(practiceId: string): Promise<StockItemsLoad> {
  const [rows, levelRows] = await Promise.all([
    fetchAll<StockItemRow>((from, to) => db.from('practice_inventory').select(ITEM_COLUMNS).eq('practice_id', practiceId).order('name').range(from, to),
      'Could not load the stock items'),
    fetchAll<ItemLevelRow>((from, to) => db.from('stock_item_levels').select('item_id, on_hand, value, last_movement_on, last_received_on')
      .eq('practice_id', practiceId).range(from, to), 'Could not load the stock levels')
  ]);
  return {
    items: rows.map(normalizeStockItem),
    levels: new Map(levelRows.map(row => [row.item_id, normalizeLevel(row)]))
  };
}

export async function saveStockItem(payload: Record<string, unknown>): Promise<string> {
  const result = await rpc<{ id: string }>('stock_save_item', { p_payload: payload }, 'Could not save the item');
  return result.id;
}

export const setStockItemActive = (itemId: string, active: boolean): Promise<unknown> =>
  rpc('stock_set_item_active', { p_item_id: itemId, p_active: active }, 'Could not change the item');

export const deleteStockItem = (itemId: string): Promise<unknown> =>
  rpc('stock_delete_item', { p_item_id: itemId }, 'Could not delete the item');

export async function loadItemMovements(itemId: string): Promise<StockMovement[]> {
  const rows = await fetchAll<StockMovementRow>((from, to) => db.from('stock_movements').select(MOVEMENT_COLUMNS).eq('item_id', itemId)
    .order('occurred_on').order('created_at').range(from, to), 'Could not load the item\'s history');
  return rows.flatMap(row => normalizeMovement(row) ?? []);
}

/** Movements of the practice in a period (both days included), optionally of some items only */
export async function loadMovements(practiceId: string, filter: { from?: string; to?: string; itemIds?: string[] } = {}): Promise<StockMovement[]> {
  const rows = await fetchAll<StockMovementRow>((from, to) => {
    let query = db.from('stock_movements').select(MOVEMENT_COLUMNS).eq('practice_id', practiceId);
    if (filter.from) query = query.gte('occurred_on', filter.from);
    if (filter.to) query = query.lte('occurred_on', filter.to);
    if (filter.itemIds) query = query.in('item_id', filter.itemIds);
    return query.order('occurred_on').order('created_at').range(from, to);
  }, 'Could not load the stock movements');
  return rows.flatMap(row => normalizeMovement(row) ?? []);
}

export const adjustStock = (payload: Record<string, unknown>): Promise<unknown> =>
  rpc('stock_adjust', { p_payload: payload }, 'Could not record the adjustment');

// ---------------------------------------------------------------------------------------------
// Suppliers, deliveries, orders
// ---------------------------------------------------------------------------------------------

export async function loadSuppliers(practiceId: string): Promise<Supplier[]> {
  const { data, error } = await db.from('stock_suppliers')
    .select('id, name, contact_name, phone, email, account_number, vat_number, payment_terms_days, notes, is_active')
    .eq('practice_id', practiceId).order('name');
  if (error) fail(error, 'Could not load the suppliers');
  return ((data ?? []) as SupplierRow[]).map(normalizeSupplier);
}

export async function saveSupplier(payload: Record<string, unknown>): Promise<string> {
  const result = await rpc<{ id: string }>('stock_save_supplier', { p_payload: payload }, 'Could not save the supplier');
  return result.id;
}

const DELIVERY_BASE_COLUMNS =
  'id, number, kind, supplier_id, supplier_reference, document_date, total_excl_vat, vat_amount, total_incl_vat, expense_id, order_id, ' +
  'reason, notes, created_by, created_at, reversed_at, reversal_reason';
/** With whether each is a consignment invoice (proposals/2026-10-13-consignment-supplier-ledger.sql) */
const DELIVERY_COLUMNS = `${DELIVERY_BASE_COLUMNS}, consignment`;

/** A read of deliveries, again without the consignment column while the database does not have it yet */
async function readDeliveries(
  query: (columns: string) => PromiseLike<{ data: unknown; error: DbError | null }>
): Promise<{ data: unknown; error: DbError | null }> {
  const result = await query(DELIVERY_COLUMNS);
  return result.error && isConsignmentColumnMissing(result.error) ? query(DELIVERY_BASE_COLUMNS) : result;
}

export async function loadDeliveries(practiceId: string, filter: { supplierId?: string; limit?: number } = {}): Promise<Delivery[]> {
  const { data, error } = await readDeliveries(columns => {
    let query = db.from('stock_deliveries').select(columns).eq('practice_id', practiceId);
    if (filter.supplierId) query = query.eq('supplier_id', filter.supplierId);
    return query.order('document_date', { ascending: false }).order('created_at', { ascending: false }).limit(filter.limit ?? 200);
  });
  if (error) fail(error, 'Could not load the deliveries');
  return ((data ?? []) as unknown as DeliveryRow[]).map(normalizeDelivery);
}

/** Deliveries by id (for naming the supplier of each receipt in the register) */
export async function loadDeliveriesByIds(ids: string[]): Promise<Delivery[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  const { data, error } = await readDeliveries(columns => db.from('stock_deliveries').select(columns).in('id', unique.slice(0, 500)));
  if (error) fail(error, 'Could not load the deliveries');
  return ((data ?? []) as unknown as DeliveryRow[]).map(normalizeDelivery);
}

export async function loadDeliveryMovements(deliveryId: string): Promise<StockMovement[]> {
  const { data, error } = await db.from('stock_movements').select(MOVEMENT_COLUMNS).eq('delivery_id', deliveryId).order('created_at');
  if (error) fail(error, 'Could not load the delivery\'s lines');
  return ((data ?? []) as unknown as StockMovementRow[]).flatMap(row => normalizeMovement(row) ?? []);
}

export const receiveDelivery = (payload: Record<string, unknown>): Promise<{ id: string; number: string; expense_id: string | null }> =>
  rpc('stock_receive', { p_payload: payload }, 'Could not record the delivery');

export const returnToSupplier = (payload: Record<string, unknown>): Promise<{ id: string; number: string; credit_expected: number }> =>
  rpc('stock_return_to_supplier', { p_payload: payload }, 'Could not record the return');

export const reverseDelivery = (deliveryId: string, reason: string): Promise<{ number: string; payable_already_paid: boolean }> =>
  rpc('stock_reverse_delivery', { p_delivery_id: deliveryId, p_reason: reason }, 'Could not reverse the delivery');

/** The status of the payables deliveries created (pending, paid, overdue, cancelled) */
export async function loadPayableStatuses(expenseIds: string[]): Promise<Map<string, { status: string; dueDate: string | null }>> {
  if (expenseIds.length === 0) return new Map();
  const { data, error } = await db.from('practice_expenses').select('id, status, due_date').in('id', expenseIds);
  if (error) throw new Error(error.message || 'Could not read the payables');
  return new Map(((data ?? []) as Array<{ id: string; status: string | null; due_date: string | null }>).map(row => [
    row.id, { status: (row.status ?? 'pending').toLowerCase(), dueDate: row.due_date }
  ]));
}

export async function loadOrders(practiceId: string): Promise<SupplierOrder[]> {
  const { data, error } = await db.from('stock_orders')
    .select('id, number, supplier_id, ordered_on, lines, notes, status, received_delivery_id, cancel_reason, created_at')
    .eq('practice_id', practiceId).order('created_at', { ascending: false }).limit(200);
  if (error) fail(error, 'Could not load the orders');
  return ((data ?? []) as SupplierOrderRow[]).map(normalizeOrder);
}

export const saveOrder = (payload: Record<string, unknown>): Promise<{ id: string; number: string }> =>
  rpc('stock_save_order', { p_payload: payload }, 'Could not save the order');

export const cancelOrder = (orderId: string, reason: string): Promise<unknown> =>
  rpc('stock_cancel_order', { p_order_id: orderId, p_reason: reason }, 'Could not cancel the order');

// ---------------------------------------------------------------------------------------------
// Stock counts and valuations
// ---------------------------------------------------------------------------------------------

export async function loadCounts(practiceId: string): Promise<StockCount[]> {
  const { data, error } = await db.from('stock_counts')
    .select(COUNT_COLUMNS)
    .eq('practice_id', practiceId).order('started_at', { ascending: false }).limit(50);
  if (error) fail(error, 'Could not load the stock counts');
  return ((data ?? []) as StockCountRow[]).map(normalizeCount);
}

/** One stock count (a link to one older than the newest 50); null when it is not there */
export async function loadCount(countId: string): Promise<StockCount | null> {
  const { data, error } = await db.from('stock_counts').select(COUNT_COLUMNS).eq('id', countId).maybeSingle();
  if (error) fail(error, 'Could not load the stock count');
  return data ? normalizeCount(data as StockCountRow) : null;
}

/** What posting a count changed: its "counted" movements, each item's difference valued as it was posted */
export async function loadCountMovements(countId: string): Promise<StockMovement[]> {
  const rows = await fetchAll<StockMovementRow>((from, to) => db.from('stock_movements').select(MOVEMENT_COLUMNS).eq('count_id', countId)
    .order('created_at').range(from, to), 'Could not load what the count changed');
  return rows.flatMap(row => normalizeMovement(row) ?? []);
}

export async function loadCountLines(countId: string): Promise<Map<string, { expected: number; counted: number }>> {
  const rows = await fetchAll<CountLineRow>((from, to) => db.from('stock_count_lines').select('item_id, expected, counted, counted_at')
    .eq('count_id', countId).range(from, to), 'Could not load the counts');
  return new Map(rows.map(row => [row.item_id, { expected: Number(row.expected) || 0, counted: Number(row.counted) || 0 }]));
}

export const startCount = (practiceId: string, group: string | null, note: string | null): Promise<{ id: string; number: string }> =>
  rpc('stock_start_count', { p_practice_id: practiceId, p_item_group: group, p_note: note }, 'Could not start the count');

export const recordCounts = (countId: string, lines: Array<{ item_id: string; counted: number | null }>): Promise<unknown> =>
  rpc('stock_record_counts', { p_count_id: countId, p_lines: lines }, 'Could not save the counts');

export const postCount = (countId: string): Promise<{ changed: number; value_change: number }> =>
  rpc('stock_post_count', { p_count_id: countId }, 'Could not post the count');

export const cancelCount = (countId: string, reason: string): Promise<unknown> =>
  rpc('stock_cancel_count', { p_count_id: countId, p_reason: reason }, 'Could not cancel the count');

export async function loadValuations(practiceId: string): Promise<Valuation[]> {
  const { data, error } = await db.from('stock_valuations').select('id, as_at, kind, total_value, item_count, lines, taken_at')
    .eq('practice_id', practiceId).order('as_at', { ascending: false }).order('taken_at', { ascending: false }).limit(60);
  if (error) fail(error, 'Could not load the stock valuations');
  return ((data ?? []) as ValuationRow[]).map(normalizeValuation);
}

export const takeValuation = (practiceId: string, asAt: string): Promise<{ id: string; total_value: number }> =>
  rpc('stock_take_valuation', { p_practice_id: practiceId, p_as_at: asAt }, 'Could not keep the valuation');

// ---------------------------------------------------------------------------------------------
// Dispensing
// ---------------------------------------------------------------------------------------------

export async function loadDispensings(filter: { practiceId: string; patientId?: string; visitId?: string; since?: string }): Promise<DispensingRecord[]> {
  let query = db.from('stock_dispensings').select(DISPENSING_COLUMNS).eq('practice_id', filter.practiceId);
  if (filter.patientId) query = query.eq('patient_id', filter.patientId);
  if (filter.visitId) query = query.eq('visit_id', filter.visitId);
  if (filter.since) query = query.gte('dispensed_on', filter.since);
  const { data, error } = await query.order('dispensed_on', { ascending: false }).order('created_at', { ascending: false }).limit(500);
  if (error) fail(error, 'Could not load the medicines dispensed');
  return ((data ?? []) as unknown as DispensingRow[]).map(normalizeDispensing);
}

export const dispenseMedicine = (payload: Record<string, unknown>): Promise<{ id: string; number: string; on_hand: number; billed: boolean }> =>
  rpc('stock_dispense', { p_payload: payload }, 'Could not record the dispensing');

export const cancelDispensing = (dispensingId: string, reason: string): Promise<{ stock_returned: number; billed: boolean }> =>
  rpc('stock_cancel_dispensing', { p_dispensing_id: dispensingId, p_reason: reason }, 'Could not cancel the dispensing');

/** For each visit: its invoice number and the stock units on it per item (to check that dispensed medicine was billed) */
export async function loadBilledStockByVisit(visitIds: string[]): Promise<Map<string, { invoiceId: string; invoiceNumber: string; units: Map<string, number> }>> {
  const result = new Map<string, { invoiceId: string; invoiceNumber: string; units: Map<string, number> }>();
  const unique = [...new Set(visitIds)].filter(Boolean);
  for (let start = 0; start < unique.length; start += 200) {
    const { data: invoices, error } = await db.from('invoices_enhanced').select('id, visit_id, invoice_number, payment_status').in('visit_id', unique.slice(start, start + 200));
    if (error) throw new Error(error.message || 'Could not read the visits\' invoices');
    const rows = ((invoices ?? []) as Array<{ id: string; visit_id: string; invoice_number: string | null; payment_status: string | null }>)
      .filter(row => !CANCELLED_ALIASES.includes((row.payment_status ?? '').trim().toLowerCase()));
    if (rows.length === 0) continue;
    const { data: lines, error: linesError } = await db.from('invoice_services').select('invoice_id, stock_item_id, quantity')
      .in('invoice_id', rows.map(row => row.id)).not('stock_item_id', 'is', null);
    if (linesError) fail(linesError, 'Could not read the invoice lines');
    for (const row of rows) result.set(row.visit_id, { invoiceId: row.id, invoiceNumber: row.invoice_number ?? '', units: new Map() });
    const byInvoice = new Map(rows.map(row => [row.id, row.visit_id]));
    for (const line of (lines ?? []) as Array<{ invoice_id: string; stock_item_id: string; quantity: number | null }>) {
      const visitId = byInvoice.get(line.invoice_id);
      const entry = visitId ? result.get(visitId) : undefined;
      if (entry) entry.units.set(line.stock_item_id, (entry.units.get(line.stock_item_id) ?? 0) + (line.quantity ?? 1));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Names for display (staff, patients, the practice on labels)
// ---------------------------------------------------------------------------------------------

export async function loadStaffNames(practiceId: string): Promise<Map<string, string>> {
  const { data, error } = await db.from('users').select('id, full_name, email').eq('practice_id', practiceId);
  if (error) return new Map();
  return new Map(((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(user => [user.id, user.full_name || user.email || 'Staff member']));
}

export async function loadPatientNames(patientIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(patientIds)].filter(Boolean);
  const names = new Map<string, string>();
  for (let start = 0; start < ids.length; start += 200) {
    const { data, error } = await db.from('patients').select('id, first_name, last_name').in('id', ids.slice(start, start + 200));
    if (error) break;
    for (const row of (data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>) {
      names.set(row.id, `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Patient');
    }
  }
  return names;
}

export interface PracticeHeading {
  name: string;
  phone: string | null;
  address: string | null;
}

export async function loadPracticeHeading(practiceId: string): Promise<PracticeHeading> {
  const { data } = await db.from('practices').select('name, contact_phone, address, city').eq('id', practiceId).maybeSingle();
  const row = (data ?? {}) as { name?: string | null; contact_phone?: string | null; address?: string | null; city?: string | null };
  const address = [row.address, row.city].filter(part => part && part.trim()).join(', ');
  return { name: row.name?.trim() || 'Practice', phone: row.contact_phone?.trim() || null, address: address || null };
}
