import { describe, expect, it } from 'vitest';
import {
  MAIN_STORE,
  buildStoreLevels,
  defaultStoreFor,
  itemByStore,
  locationIdOf,
  normalizeTransfer,
  storeChoices,
  storeName,
  transferProblem,
  usesStores,
  type StockStore
} from '../stores';

const store = (overrides: Partial<StockStore>): StockStore => ({ id: 's1', name: 'Branch dispensary', kind: 'store', branchId: null, isActive: true, ...overrides });
const transit = store({ id: 't1', name: 'On the way', kind: 'transit' });

describe('stores', () => {
  it('shows stores only to a practice that keeps stock in more than one place, so a one-place practice sees no change', () => {
    expect(usesStores([])).toBe(false);
    // The "On the way" place alone, or a store no longer used, is not a second place to keep stock
    expect(usesStores([transit, store({ isActive: false })])).toBe(false);
    expect(usesStores([store({})])).toBe(true);
  });

  it('names the main store and the place stock is on the way, so movements and pickers read plainly', () => {
    const stores = [store({}), transit];
    expect(storeName(stores, null)).toBe('Main store');
    expect(storeName(stores, 's1')).toBe('Branch dispensary');
    expect(storeName(stores, 't1')).toBe('On the way');
    expect(locationIdOf(MAIN_STORE)).toBeNull();
    expect(locationIdOf('s1')).toBe('s1');
  });

  it('offers the main store first and only stores in use (never "On the way"), keeping a store already chosen', () => {
    const stores = [store({ id: 'b', name: 'Zeta room' }), store({ id: 'a', name: 'Alpha room' }), store({ id: 'x', name: 'Old', isActive: false }), transit];
    expect(storeChoices(stores).map(choice => choice.label)).toEqual(['Main store', 'Alpha room', 'Zeta room']);
    expect(storeChoices(stores, 'x').map(choice => choice.value)).toContain('x');
  });

  it('starts a staff member at the store of their branch, else the main store, as the database places their sales', () => {
    const stores = [store({ id: 's1', branchId: 'branch-1' })];
    expect(defaultStoreFor(stores, 'branch-1')).toBe('s1');
    expect(defaultStoreFor(stores, 'branch-2')).toBe(MAIN_STORE);
    expect(defaultStoreFor(stores, null)).toBe(MAIN_STORE);
  });

  it('adds up on hand per store from the ledger view, and lists where an item is with "On the way" last', () => {
    const levels = buildStoreLevels([
      { location_id: null, item_id: 'i1', on_hand: 20, value: '40.00' },
      { location_id: 's1', item_id: 'i1', on_hand: '5', value: '10.00' },
      { location_id: 't1', item_id: 'i1', on_hand: 3, value: '6.00' },
      { location_id: 's1', item_id: 'i2', on_hand: 0, value: '0' }
    ]);
    expect(levels.get(MAIN_STORE)?.get('i1')).toEqual({ onHand: 20, valueCents: 4000 });
    const where = itemByStore('i1', levels, [store({}), transit]);
    expect(where.map(row => [row.name, row.onHand, row.onTheWay])).toEqual([['Main store', 20, false], ['Branch dispensary', 5, false], ['On the way', 3, true]]);
    // A store that holds none of the item is not listed
    expect(itemByStore('i2', levels, [store({})])).toEqual([]);
  });
});

describe('transfers', () => {
  const held = (itemId: string) => (itemId === 'i1' ? 5 : 0);
  const name = (itemId: string) => (itemId === 'i1' ? 'Gloves' : 'Swabs');

  it('refuses a transfer the database would refuse, with the reason in plain words', () => {
    expect(transferProblem({ from: '', to: '', lines: [{ itemId: 'i1', quantity: 1 }] }, held, name)).toBe('Choose two different stores.');
    expect(transferProblem({ from: '', to: 's1', lines: [] }, held, name)).toBe('Add at least one item.');
    expect(transferProblem({ from: '', to: 's1', lines: [{ itemId: 'i1', quantity: 1 }, { itemId: 'i1', quantity: 1 }] }, held, name)).toMatch(/listed twice/);
    expect(transferProblem({ from: '', to: 's1', lines: [{ itemId: 'i1', quantity: 6 }] }, held, name)).toBe('Line 1: only 5 of Gloves are in the sending store.');
    expect(transferProblem({ from: '', to: 's1', lines: [{ itemId: 'i1', quantity: 2.5 }] }, held, name)).toBe('Line 1: type how many.');
    expect(transferProblem({ from: '', to: 's1', lines: [{ itemId: 'i1', quantity: 5 }] }, held, name)).toBeNull();
  });

  it('reads a transfer as the database keeps it, values in cents', () => {
    const transfer = normalizeTransfer({
      id: 'tr', number: 'TRF2026-0001', from_location_id: null, to_location_id: 's1', status: 'received', sent_at: '2026-10-13T08:00:00Z',
      received_at: '2026-10-13T12:00:00Z', lines: [{ item_id: 'i1', name: 'Gloves', unit: 'box', quantity: 5, value: '12.50' }, { bad: true }]
    });
    expect(transfer.status).toBe('received');
    expect(transfer.lines).toEqual([{ itemId: 'i1', name: 'Gloves', unit: 'box', quantity: 5, valueCents: 1250 }]);
  });
});
