/**
 * Reads and writes for stores and transfers between them (L10; proposals/2026-10-13-stock-stores-and-suppliers.sql).
 * The rules are in src/utils/stock/stores.ts. Before that file is applied a practice simply has one store: loadStoreSetup
 * returns no stores, and the screens show nothing about stores or transfers.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  TRANSFER_COLUMNS,
  buildStoreLevels,
  normalizeStore,
  normalizeTransfer,
  type StockStore,
  type StockStoreRow,
  type StockTransfer,
  type StockTransferRow,
  type StoreLevel,
  type StoreLevelRow
} from '../../utils/stock/stores';

// The generated database types do not know these tables yet (as in stockService)
const db = supabase as unknown as SupabaseClient;

interface DbError {
  code?: string;
  message?: string;
}

const MISSING = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205']);

/** True when this file's tables, columns or functions are not in the database yet */
export function isStoresNotSetUp(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!/stock_locations|stock_transfers|stock_location_levels|location_id|transfer_id|stock_save_location|stock_send_transfer|stock_receive_transfer|stock_cancel_transfer|stock_start_count/i.test(message ?? '')) {
    return false;
  }
  return MISSING.has(code ?? '') || /could not find|does not exist/i.test(message ?? '');
}

const fail = (error: DbError, fallback: string): never => {
  throw new Error(isStoresNotSetUp(error) ? 'Stores are not set up yet.' : error.message || fallback);
};

async function rpc<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) fail(error, fallback);
  return data as T;
}

export interface StoreSetup {
  stores: StockStore[];
  /** store key ('' = main) -> item id -> on hand and value */
  levels: Map<string, Map<string, StoreLevel>>;
  /** The signed-in staff member's branch (their default store) */
  userBranchId: string | null;
}

export const NO_STORES: StoreSetup = { stores: [], levels: new Map(), userBranchId: null };

/** The practice's stores and the stock in each; no stores (one place) before the database update */
export async function loadStoreSetup(practiceId: string, userId: string | null): Promise<StoreSetup> {
  const { data, error } = await db.from('stock_locations').select('id, name, kind, branch_id, is_active').eq('practice_id', practiceId).order('name');
  if (error) {
    if (isStoresNotSetUp(error)) return NO_STORES;
    throw new Error(error.message || 'Could not load the stores');
  }
  const stores = ((data ?? []) as StockStoreRow[]).map(normalizeStore);
  if (stores.length === 0) return NO_STORES;

  const rows: StoreLevelRow[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await db.from('stock_location_levels').select('location_id, item_id, on_hand, value').eq('practice_id', practiceId).range(from, from + 999);
    if (page.error) fail(page.error, 'Could not load the stock per store');
    const batch = (page.data ?? []) as StoreLevelRow[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  let userBranchId: string | null = null;
  if (userId) {
    const me = await db.from('users').select('branch_id').eq('id', userId).maybeSingle();
    userBranchId = ((me.data ?? {}) as { branch_id?: string | null }).branch_id ?? null;
  }
  return { stores, levels: buildStoreLevels(rows), userBranchId };
}

/** The practice's branches, to link a store to one (the branch's sales and dispensing come from that store) */
export async function loadBranches(practiceId: string): Promise<Array<{ id: string; name: string; isActive: boolean }>> {
  const { data, error } = await db.from('branches').select('id, name, is_active').eq('practice_id', practiceId).order('name');
  if (error) return [];
  return ((data ?? []) as Array<{ id: string; name: string | null; is_active: boolean | null }>).map(row => ({
    id: row.id,
    name: row.name?.trim() || 'Branch',
    isActive: row.is_active !== false
  }));
}

export const saveStore = (payload: { id?: string | null; practice_id: string; name: string; branch_id: string | null; is_active: boolean }): Promise<{ id: string }> =>
  rpc('stock_save_location', { p_payload: payload }, 'Could not save the store');

export async function loadTransfers(practiceId: string, limit = 200): Promise<StockTransfer[]> {
  const { data, error } = await db.from('stock_transfers').select(TRANSFER_COLUMNS).eq('practice_id', practiceId)
    .order('sent_at', { ascending: false }).limit(limit);
  if (error) fail(error, 'Could not load the transfers');
  return ((data ?? []) as unknown as StockTransferRow[]).map(normalizeTransfer);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One transfer by its id or TRF number (a link to one older than the newest 200); null when the practice has none such */
export async function loadTransfer(practiceId: string, idOrNumber: string): Promise<StockTransfer | null> {
  const { data, error } = await db.from('stock_transfers').select(TRANSFER_COLUMNS).eq('practice_id', practiceId)
    .eq(UUID.test(idOrNumber) ? 'id' : 'number', idOrNumber).maybeSingle();
  if (error) fail(error, 'Could not load the transfer');
  return data ? normalizeTransfer(data as unknown as StockTransferRow) : null;
}

/** Transfers sent in a period (Windhoek days, UTC+2, both included), oldest first: the transfers report (R33) */
export async function loadTransfersSent(practiceId: string, fromKey: string, toKey: string): Promise<StockTransfer[]> {
  const rows: StockTransferRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('stock_transfers').select(TRANSFER_COLUMNS).eq('practice_id', practiceId)
      .gte('sent_at', `${fromKey}T00:00:00+02:00`).lte('sent_at', `${toKey}T23:59:59.999+02:00`)
      .order('sent_at').range(from, from + 999);
    if (error) fail(error, 'Could not load the transfers');
    const batch = (data ?? []) as unknown as StockTransferRow[];
    rows.push(...batch);
    if (batch.length < 1000) return rows.map(normalizeTransfer);
  }
}

export const sendTransfer = (payload: {
  practice_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  notes: string | null;
  lines: Array<{ item_id: string; quantity: number }>;
}): Promise<{ id: string; number: string }> => rpc('stock_send_transfer', { p_payload: payload }, 'Could not send the stock');

export const receiveTransfer = (transferId: string): Promise<{ number: string }> =>
  rpc('stock_receive_transfer', { p_transfer_id: transferId }, 'Could not receive the transfer');

export const cancelTransfer = (transferId: string, reason: string): Promise<{ number: string }> =>
  rpc('stock_cancel_transfer', { p_transfer_id: transferId, p_reason: reason }, 'Could not cancel the transfer');

/** Start a stock count of one store (null = the main store) */
export const startCountInStore = (practiceId: string, group: string | null, note: string | null, locationId: string | null): Promise<{ id: string; number: string }> =>
  rpc('stock_start_count', { p_practice_id: practiceId, p_item_group: group, p_note: note, p_location_id: locationId }, 'Could not start the count');

/** Which store each stock count is of (count id -> location id, null = the main store) */
export async function loadCountStores(practiceId: string): Promise<Map<string, string | null>> {
  const { data, error } = await db.from('stock_counts').select('id, location_id').eq('practice_id', practiceId).order('started_at', { ascending: false }).limit(50);
  if (error) {
    if (isStoresNotSetUp(error)) return new Map();
    throw new Error(error.message || 'Could not load the stock counts');
  }
  return new Map(((data ?? []) as Array<{ id: string; location_id: string | null }>).map(row => [row.id, row.location_id ?? null]));
}
