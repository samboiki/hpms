/**
 * Stock movement per stock group, with fast and slow movers (parity R8; Eminance's cost centre report). Built from the
 * stock ledger (stock_movements: every unit in or out at cost excluding VAT), so it agrees with Stock's own figures:
 * the value at the end of the period is today's ledger value less what moved after the period, and for every item and
 * group the value at the start + in - used + adjusted = the value at the end. Whole cents.
 *   in        deliveries less returns to suppliers (and opening balances, when stock was first counted)
 *   used      billed on invoices and dispensed, less what came back (positive: units out)
 *   adjusted  adjustments with a reason and stock-count differences (negative: losses)
 */
import { daysBetween, isInRange, type DateRange } from '../../../services/ledgerService';
import type { StockItem } from '../../../utils/stock/items';
import type { MovementKind } from '../../../utils/stock/ledger';
import type { ItemLevel, StockMovement } from '../../../utils/stock/stockRows';
import type { CsvCell } from '../financeExport';
import { inventoryCategoryLabel } from '../financeTheme';
import type { LinkedReport } from './reportTargets';

const IN_KINDS: readonly MovementKind[] = ['opening', 'received', 'returned', 'delivery_reversed'];
const USED_KINDS: readonly MovementKind[] = ['sold', 'sale_reversed', 'dispensed', 'dispense_reversed'];
const ADJUSTED_KINDS: readonly MovementKind[] = ['adjusted', 'counted'];
const ISSUE_KINDS: readonly MovementKind[] = ['sold', 'dispensed'];

/** An item's stock group: its group, else its category (said so, so a practice sees which items still need a group) */
export function stockGroupOf(item: Pick<StockItem, 'group' | 'category'> | undefined): { key: string; label: string } {
  if (item?.group) return { key: `group:${item.group.toLowerCase()}`, label: item.group };
  const category = item?.category ?? 'other';
  return { key: `category:${category}`, label: `${inventoryCategoryLabel(category)} (no stock group)` };
}

export interface ItemMovement {
  itemId: string;
  name: string;
  unit: string;
  groupKey: string;
  groupLabel: string;
  isActive: boolean;
  startUnits: number;
  inUnits: number;
  usedUnits: number;
  adjustedUnits: number;
  endUnits: number;
  startCents: number;
  inCents: number;
  usedCents: number;
  adjustedCents: number;
  endCents: number;
  /** The last day it was billed or dispensed since the period started; null when not since then */
  lastUsedOn: string | null;
  /** Whole days the stock at the end lasts at the period's rate of use; null when nothing was used */
  daysLeft: number | null;
}

/**
 * Every item's movement in the range, from today's levels and the movements from the start of the range to today.
 * Items that are not active, had no stock and did not move are left out.
 */
export function itemMovements(input: {
  items: readonly StockItem[];
  levels: ReadonlyMap<string, Pick<ItemLevel, 'onHand' | 'valueCents'>>;
  /** Every movement dated from the start of the range to today */
  movements: readonly StockMovement[];
  range: DateRange;
}): ItemMovement[] {
  const byItem = new Map<string, StockMovement[]>();
  for (const movement of input.movements) {
    if (movement.occurredOn < input.range.startKey) continue;
    const list = byItem.get(movement.itemId) ?? [];
    list.push(movement);
    byItem.set(movement.itemId, list);
  }
  const days = daysBetween(input.range.startKey, input.range.endKey) + 1;
  const rows: ItemMovement[] = [];
  for (const item of input.items) {
    const level = input.levels.get(item.id) ?? { onHand: 0, valueCents: 0 };
    const moves = byItem.get(item.id) ?? [];
    let afterUnits = 0, afterCents = 0;
    let inUnits = 0, inCents = 0, usedUnits = 0, usedCents = 0, adjustedUnits = 0, adjustedCents = 0;
    let lastUsedOn: string | null = null;
    for (const move of moves) {
      if (ISSUE_KINDS.includes(move.kind) && (!lastUsedOn || move.occurredOn > lastUsedOn)) lastUsedOn = move.occurredOn;
      if (move.occurredOn > input.range.endKey) {
        afterUnits += move.quantity;
        afterCents += move.valueCents;
      } else if (isInRange(move.occurredOn, input.range)) {
        if (IN_KINDS.includes(move.kind)) { inUnits += move.quantity; inCents += move.valueCents; }
        else if (USED_KINDS.includes(move.kind)) { usedUnits -= move.quantity; usedCents -= move.valueCents; }
        else if (ADJUSTED_KINDS.includes(move.kind)) { adjustedUnits += move.quantity; adjustedCents += move.valueCents; }
      }
    }
    const endUnits = level.onHand - afterUnits;
    const endCents = level.valueCents - afterCents;
    const startUnits = endUnits - inUnits + usedUnits - adjustedUnits;
    const startCents = endCents - inCents + usedCents - adjustedCents;
    if (!item.isActive && moves.length === 0 && startUnits === 0 && endUnits === 0) continue;
    const group = stockGroupOf(item);
    rows.push({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      groupKey: group.key,
      groupLabel: group.label,
      isActive: item.isActive,
      startUnits, inUnits, usedUnits, adjustedUnits, endUnits,
      startCents, inCents, usedCents, adjustedCents, endCents,
      lastUsedOn,
      daysLeft: usedUnits > 0 ? Math.floor(Math.max(endUnits, 0) / (usedUnits / days)) : null
    });
  }
  return rows;
}

export interface GroupMovement {
  key: string;
  label: string;
  items: number;
  /** Items billed or dispensed in the period */
  itemsUsed: number;
  startCents: number;
  inCents: number;
  usedCents: number;
  adjustedCents: number;
  endCents: number;
}

/** Per stock group, the most used (at cost) first */
export function groupMovements(items: readonly ItemMovement[]): GroupMovement[] {
  const groups = new Map<string, GroupMovement>();
  for (const item of items) {
    const group = groups.get(item.groupKey) ?? { key: item.groupKey, label: item.groupLabel, items: 0, itemsUsed: 0, startCents: 0, inCents: 0, usedCents: 0, adjustedCents: 0, endCents: 0 };
    group.items += 1;
    if (item.usedUnits > 0) group.itemsUsed += 1;
    group.startCents += item.startCents;
    group.inCents += item.inCents;
    group.usedCents += item.usedCents;
    group.adjustedCents += item.adjustedCents;
    group.endCents += item.endCents;
    groups.set(item.groupKey, group);
  }
  return [...groups.values()].sort((a, b) => b.usedCents - a.usedCents || b.endCents - a.endCents || a.label.localeCompare(b.label));
}

/** Fast movers: the items used in the period, the most used first */
export const fastMovers = (items: readonly ItemMovement[]): ItemMovement[] =>
  items.filter(item => item.usedUnits > 0).sort((a, b) => b.usedUnits - a.usedUnits || b.usedCents - a.usedCents || a.name.localeCompare(b.name));

/** Slow movers: items with stock at the end of the period; not used at all first (the most money tied up first), then the longest-lasting */
export const slowMovers = (items: readonly ItemMovement[]): ItemMovement[] =>
  items.filter(item => item.endUnits > 0).sort((a, b) =>
    Number(b.daysLeft === null) - Number(a.daysLeft === null) ||
    (a.daysLeft === null ? b.endCents - a.endCents : (b.daysLeft ?? 0) - (a.daysLeft ?? 0) || b.endCents - a.endCents) ||
    a.name.localeCompare(b.name));

const amount = (cents: number): number => cents / 100;

export const STOCK_MOVEMENT_NOTES = [
  'From the stock ledger, at cost excluding VAT. In: deliveries less returns to suppliers (and opening balances). Used: billed on invoices and dispensed, less what came back. Adjusted: adjustments with a reason and stock-count differences (losses are negative).',
  'For every group and item, the value at the start + in - used + adjusted = the value at the end; the end is today\'s stock value less what moved after the period. An item without a stock group is shown under its category.',
  'This is the practice\'s stock in every store together: moving stock between stores (a transfer) changes neither, so transfers are not shown.'
];

const itemName = (item: ItemMovement): string => `${item.name}${item.isActive ? '' : ' (not active)'}`;

/** One row per stock group; a row lists its fast movers */
export function groupMovementTable(groups: readonly GroupMovement[], basis: string): LinkedReport & { keys: string[] } {
  const sum = (pick: (group: GroupMovement) => number) => groups.reduce((total, group) => total + pick(group), 0);
  return {
    table: {
      title: 'Stock movement per group',
      basis,
      columns: [
        { header: 'Stock group', type: 'text' },
        { header: 'Items', type: 'count' },
        { header: 'Value at the start', type: 'money' },
        { header: 'In', type: 'money' },
        { header: 'Used', type: 'money' },
        { header: 'Adjusted', type: 'money' },
        { header: 'Value at the end', type: 'money' },
        { header: 'Items used', type: 'count' }
      ],
      rows: groups.map(group => [group.label, group.items, amount(group.startCents), amount(group.inCents), amount(group.usedCents), amount(group.adjustedCents), amount(group.endCents), group.itemsUsed] as CsvCell[]),
      totals: ['Total', sum(g => g.items), amount(sum(g => g.startCents)), amount(sum(g => g.inCents)), amount(sum(g => g.usedCents)), amount(sum(g => g.adjustedCents)), amount(sum(g => g.endCents)), sum(g => g.itemsUsed)],
      notes: STOCK_MOVEMENT_NOTES
    },
    targets: groups.map(() => null),
    keys: groups.map(group => group.key)
  };
}

const daysLeftText = (item: ItemMovement): string => (item.daysLeft === null ? 'Not used in the period' : `${item.daysLeft}`);

/** The items used in the period, the most used first: how much, at what cost, what is left and how long it lasts */
export function fastMoversTable(items: readonly ItemMovement[], basis: string): LinkedReport & { ids: string[] } {
  return {
    table: {
      title: 'Fast movers',
      basis,
      columns: [
        { header: 'Item', type: 'text' },
        { header: 'Stock group', type: 'text' },
        { header: 'Units used', type: 'count' },
        { header: 'Cost of what was used', type: 'money' },
        { header: 'On hand at the end', type: 'count' },
        { header: 'Days of stock left', type: 'text' }
      ],
      rows: items.map(item => [itemName(item), item.groupLabel, item.usedUnits, amount(item.usedCents), item.endUnits, daysLeftText(item)] as CsvCell[]),
      totals: ['Total', '', items.reduce((sum, item) => sum + item.usedUnits, 0), amount(items.reduce((sum, item) => sum + item.usedCents, 0)), null, ''],
      notes: ['Days of stock left: what is on hand at the end of the period divided by the units used per day in the period.', ...STOCK_MOVEMENT_NOTES]
    },
    targets: items.map(() => null),
    ids: items.map(item => item.itemId),
    names: items.map(item => item.name)
  };
}

/** Items with stock at the end of the period, the slowest first: money tied up and when each was last used */
export function slowMoversTable(items: readonly ItemMovement[], basis: string, sinceLabel: string): LinkedReport & { ids: string[] } {
  return {
    table: {
      title: 'Slow movers',
      basis,
      columns: [
        { header: 'Item', type: 'text' },
        { header: 'Stock group', type: 'text' },
        { header: 'Units used', type: 'count' },
        { header: 'On hand at the end', type: 'count' },
        { header: 'Value at cost', type: 'money' },
        { header: 'Days of stock left', type: 'text' },
        { header: `Last used since ${sinceLabel}`, type: 'date' }
      ],
      rows: items.map(item => [itemName(item), item.groupLabel, item.usedUnits, item.endUnits, amount(item.endCents), daysLeftText(item), item.lastUsedOn ?? 'Not since then'] as CsvCell[]),
      totals: ['Total', '', items.reduce((sum, item) => sum + item.usedUnits, 0), null, amount(items.reduce((sum, item) => sum + item.endCents, 0)), '', ''],
      notes: ['Items not used at all in the period come first, the most money tied up first; then the items whose stock lasts longest at the period\'s rate of use.', ...STOCK_MOVEMENT_NOTES]
    },
    targets: items.map(() => null),
    ids: items.map(item => item.itemId),
    names: items.map(item => item.name)
  };
}
