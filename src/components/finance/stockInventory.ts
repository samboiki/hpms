import type { LedgerInventoryItem } from '../../services/ledgerService';
import { fromCents } from '../../utils/billing/money';
import type { StockItem } from '../../utils/stock/items';
import type { ItemLevel } from '../../utils/stock/stockRows';

/**
 * Where Finance's stock and equipment figures come from. 'stock_ledger': Stock's own ledger (on hand and value per item
 * from stock_item_levels), the figures Stock > Reports > Stock value shows. 'inventory_list': before the stock update,
 * the quantities typed on the old inventory list at their unit cost.
 */
export type InventorySource = 'stock_ledger' | 'inventory_list';

/**
 * Finance's inventory rows from Stock's ledger: each item's on hand and its value at the average cost of what is on
 * hand, excluding VAT, exactly as the ledger has it (never re-multiplied from a rounded unit cost), so Ledgers >
 * Inventory, the stock valuation report and the month-end pack agree with Stock > Reports to the cent. Equipment is a
 * stock item like any other (category "equipment"). An item no longer in use is left out unless it still holds stock
 * or value: that is still the practice's.
 */
export function inventoryFromStockLedger(items: readonly StockItem[], levels: ReadonlyMap<string, ItemLevel>): LedgerInventoryItem[] {
  return items.flatMap(item => {
    const onHand = levels.get(item.id)?.onHand ?? 0;
    const valueCents = levels.get(item.id)?.valueCents ?? 0;
    if (!item.isActive && onHand === 0 && valueCents === 0) return [];
    return [{
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: onHand,
      unit: item.unit,
      // The average cost of what is on hand; the item's own cost while none is
      unitCost: onHand > 0 ? fromCents(Math.round(valueCents / onHand)) : fromCents(item.unitCostCents),
      recordedValue: fromCents(valueCents),
      ledgerValue: fromCents(valueCents),
      reorderLevel: item.minimum,
      expiryDate: item.expiryDate,
      location: item.location
    }];
  });
}

/** How the value of each item is worked out, for the screens and reports that show it */
export const inventoryBasis = (source: InventorySource | undefined): string =>
  source === 'stock_ledger'
    ? 'the stock ledger at the average cost of what is on hand, excluding VAT (as Stock > Reports shows)'
    : 'quantity x unit cost (stored value where no unit cost is set)';
