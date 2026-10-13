import { describe, expect, it } from 'vitest';
import { MAIN_STORE, findTransfer, storeFromParam, storeParam, transfersOfStore, type StockStore, type StockTransfer } from '../stores';
import { consignmentLink, stockCountLink, stockStoreLink, stockStoreTransfersLink, stockTransferLink } from '../../../components/billing/invoiceLinks';

// Invented stores and transfers. A transfer has two sides, the store that sent it and the store that received it, and
// an item it moved: each side must open the others (bi-directional links), whichever one staff start from.
const store = (overrides: Partial<StockStore>): StockStore => ({ id: 'branch', name: 'Branch dispensary', kind: 'store', branchId: null, isActive: true, ...overrides });
const stores = [store({}), store({ id: 'room', name: 'Store room' }), store({ id: 'transit', name: 'On the way', kind: 'transit' })];
const transfer = (overrides: Partial<StockTransfer>): StockTransfer => ({
  id: 't-1', number: 'TRF2026-0001', fromLocationId: null, toLocationId: 'branch', lines: [], notes: null, status: 'sent', sentBy: null,
  sentAt: '2026-10-01T08:00:00Z', receivedBy: null, receivedAt: null, cancelledBy: null, cancelledAt: null, cancelReason: null, ...overrides
});

describe('a store in a link', () => {
  it('names the main store "main" (it has no id) and reads it back as the main store', () => {
    expect(storeParam(null)).toBe('main');
    expect(storeFromParam('main', stores)).toBe(MAIN_STORE);
    expect(storeParam('branch')).toBe('branch');
    expect(storeFromParam('branch', stores)).toBe('branch');
  });

  it('ignores a link to a store the practice does not have, or to "On the way" (not a store): the screen shows every store', () => {
    expect(storeFromParam('another-practices-store', stores)).toBeNull();
    expect(storeFromParam('transit', stores)).toBeNull();
    expect(storeFromParam(null, stores)).toBeNull();
  });
});

describe('a store\'s transfers', () => {
  const transfers = [
    transfer({}),
    transfer({ id: 't-2', number: 'TRF2026-0002', fromLocationId: 'branch', toLocationId: 'room' }),
    transfer({ id: 't-3', number: 'TRF2026-0003', fromLocationId: 'room', toLocationId: null })
  ];

  it('lists what the store sent and what it received, so the sending and the receiving store both find it', () => {
    expect(transfersOfStore(transfers, 'branch').map(row => row.number)).toEqual(['TRF2026-0001', 'TRF2026-0002']);
    expect(transfersOfStore(transfers, MAIN_STORE).map(row => row.number)).toEqual(['TRF2026-0001', 'TRF2026-0003']);
  });

  it('finds a transfer by its id, or by the TRF number an item\'s history shows', () => {
    expect(findTransfer(transfers, 't-2')?.number).toBe('TRF2026-0002');
    expect(findTransfer(transfers, 'TRF2026-0003')?.id).toBe('t-3');
    expect(findTransfer(transfers, 'TRF2026-0099')).toBeNull();
  });
});

describe('the links between stock documents', () => {
  it('opens a transfer, a store\'s stock, a store\'s transfers and a count from anywhere in the app', () => {
    expect(stockTransferLink('TRF2026-0001')).toBe('/stock?tab=transfers&transfer=TRF2026-0001');
    expect(stockStoreLink(null)).toBe('/stock?tab=items&store=main');
    expect(stockStoreLink('branch')).toBe('/stock?tab=items&store=branch');
    expect(stockStoreTransfersLink('room')).toBe('/stock?tab=transfers&store=room');
    expect(stockCountLink('k1')).toBe('/stock?tab=count&count=k1');
  });

  it('opens the consignment report from a consignment invoice', () => {
    expect(consignmentLink()).toBe('/stock?tab=reports&report=consignment');
  });
});
