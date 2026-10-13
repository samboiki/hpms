/**
 * The reorder report: items at or below their minimum, how many to order to get back to the maximum (in whole packs),
 * grouped by the supplier they are usually bought from, ready to become a supplier order.
 */
import { isLowStock } from '../../services/ledger/inventory';

export interface ReorderItem {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  /** The minimum to hold (practice_inventory.reorder_level); none or 0 = never on the report */
  minimum: number | null;
  /** The most to hold; when there is none, an order fills up to twice the minimum */
  maximum: number | null;
  /** Units in a pack the supplier sells; orders are rounded up to whole packs */
  packSize: number | null;
  supplierId: string | null;
  /** Cost per unit (cents) for the order's estimate */
  unitCostCents: number;
  isActive: boolean;
}

export interface ReorderLine {
  item: ReorderItem;
  /** Units to order */
  quantity: number;
  packs: number | null;
  estimateCents: number;
}

/**
 * How many units to order, or 0 when the item is not low. Low is the rule the inventory screens already use
 * (isLowStock): a minimum above 0 is set and stock has fallen to it. The order fills up to the maximum, or twice the
 * minimum when there is no maximum, never less than one pack.
 */
export function reorderQuantity(item: Pick<ReorderItem, 'onHand' | 'minimum' | 'maximum' | 'packSize' | 'isActive'>): number {
  const minimum = item.minimum !== null && item.minimum > 0 ? item.minimum : null;
  if (!item.isActive || minimum === null || !isLowStock({ quantity: item.onHand, reorderLevel: minimum })) return 0;
  const target = item.maximum !== null && item.maximum > minimum ? item.maximum : minimum * 2;
  const units = Math.max(target - item.onHand, 1);
  const pack = item.packSize && item.packSize > 1 ? item.packSize : 1;
  return Math.ceil(units / pack) * pack;
}

export interface ReorderGroup {
  supplierId: string | null;
  lines: ReorderLine[];
  estimateCents: number;
}

/** Every low item, grouped by supplier (items without one last), lowest stock first within a supplier */
export function reorderReport(items: readonly ReorderItem[]): ReorderGroup[] {
  const groups = new Map<string, ReorderGroup>();
  for (const item of items) {
    const quantity = reorderQuantity(item);
    if (quantity <= 0) continue;
    const key = item.supplierId ?? '';
    const group = groups.get(key) ?? { supplierId: item.supplierId, lines: [], estimateCents: 0 };
    const estimateCents = quantity * Math.max(item.unitCostCents, 0);
    group.lines.push({ item, quantity, packs: item.packSize && item.packSize > 1 ? quantity / item.packSize : null, estimateCents });
    group.estimateCents += estimateCents;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(group => ({
      ...group,
      lines: [...group.lines].sort((a, b) => a.item.onHand - b.item.onHand || a.item.name.localeCompare(b.item.name))
    }))
    .sort((a, b) => (a.supplierId === null ? 1 : 0) - (b.supplierId === null ? 1 : 0));
}
