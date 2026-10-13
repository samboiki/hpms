import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import type { StockContext } from '../stockContext';
import { DEFAULT_STOCK_SETTINGS, type StockMovement } from '../../../utils/stock/stockRows';
import { normalizeStockItem } from '../../../utils/stock/items';
import type { StockStore, StockTransfer } from '../../../utils/stock/stores';

// Invented stores, items and transfers. Nothing reaches the database.
const stores: StockStore[] = [
  { id: 'branch', name: 'Branch dispensary', kind: 'store', branchId: null, isActive: true },
  { id: 'room', name: 'Store room', kind: 'store', branchId: null, isActive: true },
  { id: 'transit', name: 'On the way', kind: 'transit', branchId: null, isActive: true }
];
const transfer = (overrides: Partial<StockTransfer>): StockTransfer => ({
  id: 't-1', number: 'TRF2026-0001', fromLocationId: null, toLocationId: 'branch',
  lines: [{ itemId: 'gloves', name: 'Gloves', unit: 'box', quantity: 5, valueCents: 6000 }], notes: null, status: 'sent', sentBy: 'u-1',
  sentAt: '2026-10-01T08:00:00Z', receivedBy: null, receivedAt: null, cancelledBy: null, cancelledAt: null, cancelReason: null, ...overrides
});
const movement = (overrides: Partial<StockMovement>): StockMovement => ({
  id: 'm1', itemId: 'gloves', kind: 'transfer_out', quantity: -5, valueCents: -6000, vatCents: null, batchNo: null, expiryDate: null, reasonCode: null,
  reason: 'Sent to Branch dispensary', occurredOn: '2026-10-01', documentRef: 'TRF2026-0001', deliveryId: null, invoiceId: null, invoiceLineId: null,
  creditNoteId: null, patientId: null, practitionerId: null, dispensingId: null, countId: null, createdBy: 'u-1', createdAt: '2026-10-01T08:00:00Z',
  ...overrides
});

const stores$ = vi.hoisted(() => ({
  loadTransfers: vi.fn(async () => [] as StockTransfer[]),
  loadTransfer: vi.fn(async () => null as StockTransfer | null),
  sendTransfer: vi.fn(),
  receiveTransfer: vi.fn(),
  cancelTransfer: vi.fn()
}));
const stock = vi.hoisted(() => ({
  loadItemMovements: vi.fn(async () => [] as StockMovement[]),
  loadPatientNames: vi.fn(async () => new Map()),
  deleteStockItem: vi.fn(),
  setStockItemActive: vi.fn()
}));
vi.mock('../../../services/stock/storeService', () => stores$);
vi.mock('../../../services/stock/stockService', () => stock);
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { TransfersTab } from '../TransfersTab';
import { ItemDetailSheet } from '../ItemDetailSheet';
import { StockItemsTab } from '../StockItemsTab';

const gloves = normalizeStockItem({ id: 'gloves', practice_id: 'practice-1', name: 'Gloves', unit: 'box', category: 'consumables', unit_cost: 12, is_active: true });
const context = {
  practiceId: 'practice-1',
  practiceName: 'Example Practice',
  role: 'admin',
  settings: DEFAULT_STOCK_SETTINGS,
  items: [gloves],
  levels: new Map([['gloves', { onHand: 20, valueCents: 24000, lastMovementOn: null, lastReceivedOn: null }]]),
  suppliers: [],
  staffNames: new Map([['u-1', 'Reception Example']]),
  stores,
  storeLevels: new Map([['', new Map([['gloves', { onHand: 15, valueCents: 18000 }]])], ['transit', new Map([['gloves', { onHand: 5, valueCents: 6000 }]])]]),
  userBranchId: null,
  reload: vi.fn(),
  reloadSettings: vi.fn()
} as unknown as StockContext;

const inRouter = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
  stores$.loadTransfers.mockResolvedValue([
    transfer({}),
    transfer({ id: 't-2', number: 'TRF2026-0002', fromLocationId: 'room', toLocationId: null, status: 'received' })
  ]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// L10: a transfer linked only one way (to its items). Each side of it must open the others: the item's history opens
// the transfer, the transfer opens the sending and the receiving store's stock, and a store's stock opens its transfers
describe('transfers link both ways', () => {
  it('opens the transfer an item\'s history names by its TRF number, with both stores as links to their stock', async () => {
    inRouter(<TransfersTab context={context} openTransfer="TRF2026-0001" />);
    const sheet = await screen.findByRole('dialog', { name: 'Transfer TRF2026-0001' });
    expect(within(sheet).getByRole('link', { name: 'Main store' })).toHaveAttribute('href', '/stock?tab=items&store=main');
    expect(within(sheet).getByRole('link', { name: 'Branch dispensary' })).toHaveAttribute('href', '/stock?tab=items&store=branch');
    expect(within(sheet).getByRole('link', { name: 'Gloves' })).toHaveAttribute('href', '/stock?tab=items&item=gloves');
  });

  it('reads a transfer older than the newest 200 on its own, so its link still opens it', async () => {
    stores$.loadTransfer.mockResolvedValue(transfer({ id: 't-old', number: 'TRF2025-0007' }));
    inRouter(<TransfersTab context={context} openTransfer="TRF2025-0007" />);
    expect(await screen.findByRole('dialog', { name: 'Transfer TRF2025-0007' })).toBeInTheDocument();
    expect(stores$.loadTransfer).toHaveBeenCalledWith('practice-1', 'TRF2025-0007');
  });

  it('shows one store\'s transfers (what it sent and received) when opened from that store, and every store again on request', async () => {
    inRouter(<TransfersTab context={context} storeFilter="room" />);
    expect(await screen.findByText('TRF2026-0002')).toBeInTheDocument();
    expect(screen.queryByText('TRF2026-0001')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show every store' })).toBeInTheDocument();
  });

  // Receiving a transfer reads the stores again: the link must not bring its store back after staff asked for all
  it('keeps every store shown once asked, also after the stores are read again', async () => {
    const { rerender } = inRouter(<TransfersTab context={context} storeFilter="room" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show every store' }));
    expect(await screen.findByText('TRF2026-0001')).toBeInTheDocument();
    rerender(<MemoryRouter><TransfersTab context={{ ...context, stores: [...stores] }} storeFilter="room" /></MemoryRouter>);
    expect(screen.getByText('TRF2026-0001')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show every store' })).not.toBeInTheDocument();
  });

  it('links a transfer and a stock count in an item\'s history to the transfer and the count', async () => {
    stock.loadItemMovements.mockResolvedValue([
      movement({}),
      movement({ id: 'm2', kind: 'counted', quantity: -1, valueCents: -1200, documentRef: 'CNT2026-0003', countId: 'count-1', createdAt: '2026-10-02T08:00:00Z', occurredOn: '2026-10-02' })
    ]);
    inRouter(<ItemDetailSheet context={context} item={gloves} open onClose={vi.fn()} onEdit={vi.fn()} onAdjust={vi.fn()} onChanged={vi.fn()} />);
    expect(await screen.findByRole('link', { name: 'TRF2026-0001' })).toHaveAttribute('href', '/stock?tab=transfers&transfer=TRF2026-0001');
    expect(screen.getByRole('link', { name: 'CNT2026-0003' })).toHaveAttribute('href', '/stock?tab=count&count=count-1');
    // What is on the way opens the transfers; a store opens its own stock
    expect(screen.getByRole('link', { name: 'On the way' })).toHaveAttribute('href', '/stock?tab=transfers');
    expect(screen.getByRole('link', { name: 'Main store' })).toHaveAttribute('href', '/stock?tab=items&store=main');
  });

  it('opens on a store\'s stock from a link, which links back to that store\'s transfers', () => {
    inRouter(<StockItemsTab context={context} openItemId={null} openStore="branch" />);
    expect(screen.getByRole('combobox', { name: 'Whose stock the list shows' })).toHaveValue('branch');
    expect(screen.getByRole('link', { name: 'Transfers to and from this store' })).toHaveAttribute('href', '/stock?tab=transfers&store=branch');
  });
});
