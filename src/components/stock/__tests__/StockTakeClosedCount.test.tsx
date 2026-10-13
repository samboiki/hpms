import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import type { StockContext } from '../stockContext';
import type { StockCount, StockMovement } from '../../../utils/stock/stockRows';

// Invented counts, items and staff. Nothing reaches the database.
const POSTED: StockCount = {
  id: 'count-posted', number: 'CNT2026-0003', group: null, note: null, status: 'posted', startedAt: '2026-10-01T06:30:00Z',
  startedBy: 'u-count', closedAt: '2026-10-01T13:05:00Z', closedBy: 'u-post', cancelReason: null, valueChangeCents: -2400
};
const CANCELLED: StockCount = {
  ...POSTED, id: 'count-cancelled', number: 'CNT2026-0002', status: 'cancelled', closedBy: 'u-count', cancelReason: 'Counted the wrong shelf',
  valueChangeCents: null
};
const counted = (overrides: Partial<StockMovement>): StockMovement => ({
  id: 'm1', itemId: 'gloves', kind: 'counted', quantity: -2, valueCents: -2400, vatCents: null, batchNo: null, expiryDate: null, reasonCode: null,
  reason: 'Counted 8, expected 10', occurredOn: '2026-10-01', documentRef: 'CNT2026-0003', deliveryId: null, invoiceId: null, invoiceLineId: null,
  creditNoteId: null, patientId: null, practitionerId: null, dispensingId: null, countId: 'count-posted', createdBy: 'u-post', createdAt: '2026-10-01T13:05:00Z',
  ...overrides
});

const stock = vi.hoisted(() => ({
  loadCounts: vi.fn(async () => [] as StockCount[]),
  loadCount: vi.fn(async () => null as StockCount | null),
  loadCountLines: vi.fn(async () => new Map<string, { expected: number; counted: number }>()),
  loadCountMovements: vi.fn(async () => [] as StockMovement[]),
  cancelCount: vi.fn(),
  postCount: vi.fn(),
  recordCounts: vi.fn(),
  startCount: vi.fn()
}));
vi.mock('../../../services/stock/stockService', () => stock);
vi.mock('../../../services/stock/storeService', () => ({ loadCountStores: vi.fn(async () => new Map()), startCountInStore: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { StockTakeTab } from '../StockTakeTab';

const item = (id: string, name: string, unit: string) => ({ id, name, unit, isActive: true, group: null, location: null, unitCostCents: 1200 });
const context = {
  practiceId: 'practice-1',
  practiceName: 'Example Practice',
  role: 'admin',
  items: [item('gloves', 'Gloves', 'box'), item('tape', 'Tape', 'roll')],
  levels: new Map(),
  suppliers: [],
  staffNames: new Map([['u-count', 'Reception Example'], ['u-post', 'Doctor Example']]),
  stores: [],
  storeLevels: new Map(),
  userBranchId: null,
  reload: vi.fn(),
  reloadSettings: vi.fn()
} as unknown as StockContext;

const renderTab = (openCountId: string | null = null) =>
  render(
    <MemoryRouter>
      <StockTakeTab context={context} openCountId={openCountId} />
    </MemoryRouter>
  );

beforeEach(() => {
  stock.loadCounts.mockResolvedValue([POSTED, CANCELLED]);
  stock.loadCountLines.mockResolvedValue(new Map([['gloves', { expected: 10, counted: 8 }], ['tape', { expected: 3, counted: 3 }]]));
  stock.loadCountMovements.mockResolvedValue([counted({})]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// L6: once posted, a count could not be opened again: nobody could see what was counted, by whom, or what posting it
// changed, so a loss on the shelf could not be traced back to its count
describe('a posted stock count opens again, read only', () => {
  it('shows its lines, the differences valued as posted, and who started and posted it when', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Open stock count CNT2026-0003' }));
    const sheet = await screen.findByRole('dialog', { name: 'Stock count CNT2026-0003' });
    expect(await within(sheet).findByText('expected 10 boxes, counted 8')).toBeInTheDocument();
    expect(within(sheet).getByText('-2')).toBeInTheDocument();
    expect(within(sheet).getByText(/Stock value changed by/)).toHaveTextContent('-N$ 24.00');
    expect(within(sheet).getByText(/by Doctor Example/)).toBeInTheDocument();
    expect(within(sheet).getByText(/by Reception Example/)).toBeInTheDocument();
    // Read only: nothing in it can change a count that is posted
    expect(within(sheet).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(sheet).queryByRole('button', { name: /Post|Save|Cancel count/ })).not.toBeInTheDocument();
    expect(stock.loadCountMovements).toHaveBeenCalledWith('count-posted');
  });

  it('opens from a link (an item\'s history), also a count older than the newest 50 in the list', async () => {
    stock.loadCount.mockResolvedValue({ ...POSTED, id: 'count-old', number: 'CNT2025-0001' });
    renderTab('count-old');
    expect(await screen.findByRole('dialog', { name: 'Stock count CNT2025-0001' })).toBeInTheDocument();
    expect(stock.loadCount).toHaveBeenCalledWith('count-old');
  });

  it('says who cancelled a count and why, and that it changed nothing', async () => {
    renderTab('count-cancelled');
    const sheet = await screen.findByRole('dialog', { name: 'Stock count CNT2026-0002' });
    expect(within(sheet).getByText(/by Reception Example: Counted the wrong shelf/)).toBeInTheDocument();
    expect(await within(sheet).findByText(/nothing was changed on the shelf/)).toBeInTheDocument();
    expect(stock.loadCountMovements).not.toHaveBeenCalled();
  });
});
