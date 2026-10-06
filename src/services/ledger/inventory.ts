import { fromCents, toAmount, toCents } from './money';
import { dateKeyFrom, daysBetween } from './dates';

// ---------------------------------------------------------------------------------------------
// Inventory and equipment
// ---------------------------------------------------------------------------------------------

export interface RawInventoryRow {
  id: string;
  name?: string | null;
  category?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unit_cost?: number | string | null;
  total_value?: number | string | null;
  reorder_level?: number | string | null;
  expiry_date?: string | null;
  location?: string | null;
}

export interface LedgerInventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  /** total_value as stored (quantity x unit cost when the item was last saved) */
  recordedValue: number;
  reorderLevel: number | null;
  expiryDate: string | null;
  location: string | null;
}

export function normalizeInventoryItem(row: RawInventoryRow): LedgerInventoryItem {
  const reorder = toAmount(row.reorder_level);
  return {
    id: row.id,
    name: row.name?.trim() || 'Unnamed item',
    category: row.category?.trim() || 'other',
    quantity: toAmount(row.quantity),
    unit: row.unit?.trim() || '',
    unitCost: toAmount(row.unit_cost),
    recordedValue: toAmount(row.total_value),
    reorderLevel: reorder > 0 ? reorder : null,
    expiryDate: dateKeyFrom(row.expiry_date),
    location: row.location?.trim() || null
  };
}

/**
 * Value at cost: quantity x unit cost (current stock), falling back to the stored total value
 * when no unit cost is recorded. Negative stock counts as none.
 */
export function inventoryItemValue(item: Pick<LedgerInventoryItem, 'quantity' | 'unitCost' | 'recordedValue'>): number {
  const quantity = Math.max(item.quantity, 0);
  if (item.unitCost > 0) return fromCents(Math.round(quantity * toCents(item.unitCost)));
  return Math.max(item.recordedValue, 0);
}

/** An item is usable on its expiry date and expired from the next day. */
export const isExpired = (item: Pick<LedgerInventoryItem, 'expiryDate'>, todayKey: string): boolean =>
  !!item.expiryDate && item.expiryDate < todayKey;

export function isExpiringSoon(item: Pick<LedgerInventoryItem, 'expiryDate'>, todayKey: string, withinDays = 30): boolean {
  if (!item.expiryDate || isExpired(item, todayKey)) return false;
  return daysBetween(todayKey, item.expiryDate) <= withinDays;
}

/** Low stock only when a reorder level is set and stock has fallen to it. */
export const isLowStock = (item: Pick<LedgerInventoryItem, 'quantity' | 'reorderLevel'>): boolean =>
  item.reorderLevel !== null && item.quantity <= item.reorderLevel;

export const EQUIPMENT_CATEGORY = 'equipment';

export interface InventoryCategoryRow {
  category: string;
  value: number;
  count: number;
  expiredValue: number;
  lowStockCount: number;
}

export interface InventoryValuation {
  total: number;
  count: number;
  /** Equipment (fixed assets such as computers) at cost */
  equipmentValue: number;
  /** Consumable stock (everything that is not equipment) at cost */
  stockValue: number;
  expiredValue: number;
  expiredCount: number;
  expiringSoonValue: number;
  expiringSoonCount: number;
  lowStockCount: number;
  byCategory: InventoryCategoryRow[];
}

export function valueInventory(items: LedgerInventoryItem[], todayKey: string): InventoryValuation {
  let total = 0, equipment = 0, expired = 0, expiringSoon = 0, expiredCount = 0, expiringSoonCount = 0, lowStockCount = 0;
  const categories = new Map<string, { cents: number; count: number; expired: number; lowStock: number }>();
  for (const item of items) {
    const cents = toCents(inventoryItemValue(item));
    const group = categories.get(item.category) ?? { cents: 0, count: 0, expired: 0, lowStock: 0 };
    total += cents;
    group.cents += cents;
    group.count += 1;
    if (item.category === EQUIPMENT_CATEGORY) equipment += cents;
    if (isExpired(item, todayKey)) {
      expired += cents;
      expiredCount += 1;
      group.expired += cents;
    } else if (isExpiringSoon(item, todayKey)) {
      expiringSoon += cents;
      expiringSoonCount += 1;
    }
    if (isLowStock(item)) {
      lowStockCount += 1;
      group.lowStock += 1;
    }
    categories.set(item.category, group);
  }
  return {
    total: fromCents(total),
    count: items.length,
    equipmentValue: fromCents(equipment),
    stockValue: fromCents(total - equipment),
    expiredValue: fromCents(expired),
    expiredCount,
    expiringSoonValue: fromCents(expiringSoon),
    expiringSoonCount,
    lowStockCount,
    byCategory: [...categories.entries()]
      .map(([category, group]) => ({
        category,
        value: fromCents(group.cents),
        count: group.count,
        expiredValue: fromCents(group.expired),
        lowStockCount: group.lowStock
      }))
      .sort((a, b) => b.value - a.value || a.category.localeCompare(b.category))
  };
}
