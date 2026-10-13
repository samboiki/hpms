import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { StockContext } from '../stockContext';
import type { Delivery } from '../../../utils/stock/stockRows';

// An invented delivery older than the newest 200 the list holds
const OLD: Delivery = {
  id: 'old-1',
  number: 'GRV2025-0042',
  kind: 'received',
  supplierId: 's1',
  supplierReference: 'INV-9',
  documentDate: '2025-11-02',
  exclVatCents: 4000,
  vatCents: 600,
  inclVatCents: 4600,
  expenseId: null,
  orderId: null,
  reason: null,
  notes: null,
  createdBy: null,
  createdAt: '2025-11-02T08:00:00Z',
  reversedAt: null,
  reversalReason: null
};
const stock = vi.hoisted(() => ({
  loadDeliveries: vi.fn(async () => []),
  loadDeliveriesByIds: vi.fn(async () => [] as Delivery[]),
  loadPayableStatuses: vi.fn(async () => new Map()),
  loadDeliveryMovements: vi.fn(async () => []),
  reverseDelivery: vi.fn()
}));
vi.mock('../../../services/stock/stockService', () => stock);
vi.mock('../DeliverySheet', () => ({ DeliverySheet: () => null }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { DeliveriesTab } from '../DeliveriesTab';

afterEach(cleanup);

const context = { practiceId: 'practice-1', role: 'admin', suppliers: [{ id: 's1', name: 'Example Wholesale' }], items: [], reload: vi.fn() } as unknown as StockContext;

describe('Stock > Deliveries opened from a link', () => {
  // A supplier's invoice, an item's history or a frame's return note link to their delivery; one older than the newest
  // 200 opened nothing at all
  it('opens a delivery older than the list, reading it on its own', async () => {
    stock.loadDeliveriesByIds.mockResolvedValue([OLD]);
    render(
      <MemoryRouter>
        <DeliveriesTab context={context} openDeliveryId="old-1" />
      </MemoryRouter>
    );
    expect((await screen.findAllByText(/GRV2025-0042/)).length).toBeGreaterThan(0);
    expect(stock.loadDeliveriesByIds).toHaveBeenCalledWith(['old-1']);
  });
});
