/**
 * Finance > Ledgers > Inventory, the stock valuation report and the month-end pack value stock from Stock's own ledger
 * (stock_item_levels), the same figures Stock > Reports > Stock value shows. Before, Finance re-multiplied the copied
 * quantity by a unit cost rounded to the cent, so the two pages could disagree, and anything typed on the old list
 * counted. Invented items and amounts only.
 */
import { describe, expect, it } from 'vitest';
import { valueInventory } from '../../../services/ledgerService';
import { normalizeStockItem, type StockItem } from '../../../utils/stock/items';
import type { ItemLevel } from '../../../utils/stock/stockRows';
import { inventoryBasis, inventoryFromStockLedger } from '../stockInventory';

const TODAY = '2026-10-13';

const stockItem = (id: string, overrides: Partial<Parameters<typeof normalizeStockItem>[0]> = {}): StockItem =>
  normalizeStockItem({ id, practice_id: 'practice-1', name: `Item ${id}`, category: 'medications', unit: 'tablet', unit_cost: 1.5, ...overrides });

const level = (onHand: number, valueCents: number): ItemLevel => ({ onHand, valueCents, lastMovementOn: '2026-10-01', lastReceivedOn: null });

/** What Stock > Reports > Stock value adds up (ValuationReport: items with stock, their ledger value) */
const stockPageTotalCents = (items: StockItem[], levels: Map<string, ItemLevel>): number =>
  items.reduce((sum, item) => {
    const itemLevel = levels.get(item.id);
    return itemLevel && (itemLevel.onHand !== 0 || itemLevel.valueCents !== 0) ? sum + itemLevel.valueCents : sum;
  }, 0);

describe('Finance values stock from Stock\'s ledger', () => {
  it('takes each item\'s ledger value as it is, so Finance and Stock > Reports agree to the cent', () => {
    // 3 tablets bought for N$ 100.00 in all: the average is 33.333..., which a unit cost rounded to the cent would
    // turn into N$ 99.99
    const items = [stockItem('a'), stockItem('b', { category: 'disposables' })];
    const levels = new Map([['a', level(3, 10000)], ['b', level(7, 2345)]]);

    const rows = inventoryFromStockLedger(items, levels);
    const valuation = valueInventory(rows, TODAY);

    expect(rows.find(row => row.id === 'a')).toMatchObject({ quantity: 3, unitCost: 33.33, ledgerValue: 100 });
    expect(Math.round(valuation.total * 100)).toBe(stockPageTotalCents(items, levels));
    expect(valuation.total).toBe(123.45);
  });

  it('counts what the ledger says is on hand, not the quantity once typed on the old inventory list', () => {
    // practice_inventory.quantity still says 50; the ledger knows only 2 are left, at or below the reorder level of 5
    const items = [stockItem('a', { quantity: 50, reorder_level: 5 })];
    const rows = inventoryFromStockLedger(items, new Map([['a', level(2, 300)]]));

    expect(rows[0].quantity).toBe(2);
    expect(valueInventory(rows, TODAY)).toMatchObject({ total: 3, lowStockCount: 1 });
  });

  it('values equipment kept as a stock item and shows it apart from consumable stock', () => {
    const items = [stockItem('laptop', { category: 'equipment', unit_cost: 12000 }), stockItem('gloves', { category: 'disposables' })];
    const levels = new Map([['laptop', level(1, 1200000)], ['gloves', level(4, 10000)]]);

    const valuation = valueInventory(inventoryFromStockLedger(items, levels), TODAY);

    expect(valuation).toMatchObject({ equipmentValue: 12000, stockValue: 100, total: 12100 });
  });

  it('leaves out items no longer in use with nothing left, but keeps one that still holds stock (it is still the practice\'s)', () => {
    const items = [
      stockItem('gone', { is_active: false }),
      stockItem('stopped-with-stock', { is_active: false }),
      stockItem('never-moved')
    ];
    const rows = inventoryFromStockLedger(items, new Map([['stopped-with-stock', level(1, 250)]]));

    expect(rows.map(row => row.id)).toEqual(['stopped-with-stock', 'never-moved']);
    // An item with no movements yet has nothing on hand: its own cost shows, its value is nothing
    expect(rows[1]).toMatchObject({ quantity: 0, unitCost: 1.5, ledgerValue: 0 });
  });

  it('says on screen how the value is worked out, for the ledger and for the old list', () => {
    expect(inventoryBasis('stock_ledger')).toMatch(/stock ledger.*average cost.*excluding VAT/);
    expect(inventoryBasis('inventory_list')).toMatch(/quantity x unit cost/);
  });
});
