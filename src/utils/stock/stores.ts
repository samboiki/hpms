/**
 * Where stock is (L10): a practice's main store and any other stores (a branch's dispensary, a store room), and the
 * transfers between them. The database keeps the store on every movement (proposals/2026-10-13-stock-stores-and-
 * suppliers.sql: NULL is the main store); these are the rules the screens use to show stock per store. A practice
 * with no other store sees none of it.
 */
import { toCents } from '../../services/ledger/money';

/** The main store has no row: its key in maps, and the value of "the main store" in a store picker */
export const MAIN_STORE = '';
export const MAIN_STORE_NAME = 'Main store';
export const ON_THE_WAY_NAME = 'On the way';

export interface StockStore {
  id: string;
  name: string;
  kind: 'store' | 'transit';
  /** The branch whose sales and dispensing come from this store */
  branchId: string | null;
  isActive: boolean;
}

export interface StockStoreRow {
  id: string;
  name: string | null;
  kind: string | null;
  branch_id?: string | null;
  is_active?: boolean | null;
}

export const normalizeStore = (row: StockStoreRow): StockStore => ({
  id: row.id,
  name: row.name?.trim() || 'Store',
  kind: row.kind === 'transit' ? 'transit' : 'store',
  branchId: row.branch_id ?? null,
  isActive: row.is_active !== false
});

/** True when the practice keeps stock in more than one place: only then do the screens show stores and transfers */
export const usesStores = (stores: readonly StockStore[]): boolean => stores.some(store => store.kind === 'store' && store.isActive);

/** A store's key in maps and pickers ('' = the main store) */
export const storeKey = (locationId: string | null | undefined): string => locationId ?? MAIN_STORE;

/** The location id saved for a picker's value (null = the main store) */
export const locationIdOf = (key: string): string | null => (key === MAIN_STORE ? null : key);

/** The main store in a link's address (?store=main): it has no id */
export const MAIN_STORE_PARAM = 'main';

/** A store in a link's address: its id, or "main" for the main store */
export const storeParam = (locationId: string | null | undefined): string => locationId || MAIN_STORE_PARAM;

/**
 * The store a link names (?store=), as a picker key ('' = the main store), or null when the link names none or a
 * store the practice does not have (the screen then shows every store, as without the link)
 */
export function storeFromParam(param: string | null | undefined, stores: readonly StockStore[]): string | null {
  if (!param) return null;
  if (param === MAIN_STORE_PARAM) return MAIN_STORE;
  return stores.some(store => store.id === param && store.kind === 'store') ? param : null;
}

export function storeName(stores: readonly StockStore[], locationId: string | null | undefined): string {
  if (!locationId) return MAIN_STORE_NAME;
  const store = stores.find(entry => entry.id === locationId);
  if (!store) return 'Another store';
  return store.kind === 'transit' ? ON_THE_WAY_NAME : store.name;
}

/** The stores stock can be put into or taken from: the main store first, then the stores in use by name */
export function storeChoices(stores: readonly StockStore[], keep: string | null = null): Array<{ value: string; label: string }> {
  const others = stores
    .filter(store => store.kind === 'store' && (store.isActive || store.id === keep))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [{ value: MAIN_STORE, label: MAIN_STORE_NAME }, ...others.map(store => ({ value: store.id, label: store.name }))];
}

/** Where a staff member works: the store of their branch when it has one, else the main store */
export function defaultStoreFor(stores: readonly StockStore[], branchId: string | null | undefined): string {
  if (!branchId) return MAIN_STORE;
  const store = stores.find(entry => entry.kind === 'store' && entry.isActive && entry.branchId === branchId);
  return store ? store.id : MAIN_STORE;
}

export interface StoreLevel {
  onHand: number;
  valueCents: number;
}

export interface StoreLevelRow {
  location_id: string | null;
  item_id: string;
  on_hand: number | string | null;
  value: number | string | null;
}

/** On hand per store and item: store key -> item id -> level ("On the way" is its own key) */
export function buildStoreLevels(rows: readonly StoreLevelRow[]): Map<string, Map<string, StoreLevel>> {
  const byStore = new Map<string, Map<string, StoreLevel>>();
  for (const row of rows) {
    const key = storeKey(row.location_id);
    const items = byStore.get(key) ?? new Map<string, StoreLevel>();
    const onHand = typeof row.on_hand === 'number' ? row.on_hand : parseInt(row.on_hand ?? '0', 10) || 0;
    const previous = items.get(row.item_id) ?? { onHand: 0, valueCents: 0 };
    items.set(row.item_id, { onHand: previous.onHand + onHand, valueCents: previous.valueCents + toCents(row.value) });
    byStore.set(key, items);
  }
  return byStore;
}

/** One item's stock in each place that holds (or owes) some, the main store first, then by name, "On the way" last */
export function itemByStore(
  itemId: string,
  levels: ReadonlyMap<string, ReadonlyMap<string, StoreLevel>>,
  stores: readonly StockStore[]
): Array<{ key: string; name: string; onTheWay: boolean; onHand: number; valueCents: number }> {
  const rows: Array<{ key: string; name: string; onTheWay: boolean; onHand: number; valueCents: number }> = [];
  for (const [key, items] of levels) {
    const level = items.get(itemId);
    if (!level || (level.onHand === 0 && level.valueCents === 0)) continue;
    const store = stores.find(entry => entry.id === key);
    rows.push({ key, name: storeName(stores, locationIdOf(key)), onTheWay: store?.kind === 'transit', onHand: level.onHand, valueCents: level.valueCents });
  }
  const rank = (row: { key: string; onTheWay: boolean }) => (row.key === MAIN_STORE ? 0 : row.onTheWay ? 2 : 1);
  return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------------------------

export type TransferStatus = 'sent' | 'received' | 'cancelled';

export interface TransferLine {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  valueCents: number;
}

export interface StockTransfer {
  id: string;
  number: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  lines: TransferLine[];
  notes: string | null;
  status: TransferStatus;
  sentBy: string | null;
  sentAt: string;
  receivedBy: string | null;
  receivedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface StockTransferRow {
  id: string;
  number: string;
  from_location_id?: string | null;
  to_location_id?: string | null;
  lines: unknown;
  notes?: string | null;
  status: string;
  sent_by?: string | null;
  sent_at: string;
  received_by?: string | null;
  received_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

export const TRANSFER_COLUMNS =
  'id, number, from_location_id, to_location_id, lines, notes, status, sent_by, sent_at, received_by, received_at, cancelled_by, cancelled_at, cancel_reason';

export function normalizeTransfer(row: StockTransferRow): StockTransfer {
  const lines = Array.isArray(row.lines) ? row.lines : [];
  return {
    id: row.id,
    number: row.number,
    fromLocationId: row.from_location_id ?? null,
    toLocationId: row.to_location_id ?? null,
    lines: lines.flatMap((line: Record<string, unknown>): TransferLine[] =>
      typeof line?.item_id === 'string'
        ? [{
            itemId: line.item_id,
            name: typeof line.name === 'string' ? line.name : 'Item',
            unit: typeof line.unit === 'string' ? line.unit : '',
            quantity: typeof line.quantity === 'number' ? line.quantity : parseInt(String(line.quantity ?? '0'), 10) || 0,
            valueCents: toCents(line.value)
          }]
        : []),
    notes: row.notes?.trim() || null,
    status: row.status === 'received' || row.status === 'cancelled' ? row.status : 'sent',
    sentBy: row.sent_by ?? null,
    sentAt: row.sent_at,
    receivedBy: row.received_by ?? null,
    receivedAt: row.received_at ?? null,
    cancelledBy: row.cancelled_by ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancelReason: row.cancel_reason?.trim() || null
  };
}

export const TRANSFER_STATUS_LABELS: Readonly<Record<TransferStatus, string>> = {
  sent: 'On the way',
  received: 'Received',
  cancelled: 'Cancelled'
};

/** The transfers a store sent or received (key '' = the main store): that store's side of each transfer */
export const transfersOfStore = (transfers: readonly StockTransfer[], key: string): StockTransfer[] =>
  transfers.filter(transfer => storeKey(transfer.fromLocationId) === key || storeKey(transfer.toLocationId) === key);

/**
 * The transfer a link names: by id, or by its TRF number (an item's history knows a transfer by the number on its
 * movements). Numbers are unique per practice.
 */
export const findTransfer = (transfers: readonly StockTransfer[], idOrNumber: string): StockTransfer | null =>
  transfers.find(transfer => transfer.id === idOrNumber) ?? transfers.find(transfer => transfer.number === idOrNumber) ?? null;

export interface TransferDraftLine {
  itemId: string | null;
  quantity: number | null;
}

/**
 * What stops a transfer before it is sent (the database checks the same): two different stores, at least one line,
 * each item once with a whole quantity no more than the sending store holds. null when it can go.
 */
export function transferProblem(
  draft: { from: string; to: string; lines: readonly TransferDraftLine[] },
  heldAtSource: (itemId: string) => number,
  nameOf: (itemId: string) => string
): string | null {
  if (draft.from === draft.to) return 'Choose two different stores.';
  if (draft.lines.length === 0) return 'Add at least one item.';
  const seen = new Set<string>();
  for (const [index, line] of draft.lines.entries()) {
    if (!line.itemId) return `Line ${index + 1}: choose the item.`;
    if (seen.has(line.itemId)) return `${nameOf(line.itemId)} is listed twice: put its whole quantity on one line.`;
    seen.add(line.itemId);
    if (!line.quantity || line.quantity < 1 || !Number.isInteger(line.quantity)) return `Line ${index + 1}: type how many.`;
    const held = heldAtSource(line.itemId);
    if (line.quantity > held) return `Line ${index + 1}: only ${Math.max(held, 0)} of ${nameOf(line.itemId)} are in the sending store.`;
  }
  return null;
}
