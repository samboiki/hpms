import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import type { StockContext } from '../stockContext';
import type { Delivery } from '../../../utils/stock/stockRows';

// An invented supplier invoice for consignment frames sold (Optometry > Reports > Consignment > Supplier's invoice)
const CSG: Delivery = {
  id: 'csg-1', number: 'CSG2026-0001', kind: 'received', supplierId: 's1', supplierReference: 'F-77', documentDate: '2026-10-01',
  exclVatCents: 40000, vatCents: 6000, inclVatCents: 46000, consignment: true, expenseId: 'e1', orderId: null, reason: null,
  notes: '1 consignment frame(s) sold', createdBy: null, createdAt: '2026-10-01T09:00:00Z', reversedAt: null, reversalReason: null
};
const stock = vi.hoisted(() => ({
  loadDeliveries: vi.fn(async () => [] as Delivery[]),
  loadDeliveriesByIds: vi.fn(async () => [] as Delivery[]),
  loadPayableStatuses: vi.fn(async () => new Map([['e1', { status: 'pending', dueDate: '2026-11-30' }]])),
  loadDeliveryMovements: vi.fn(async () => []),
  reverseDelivery: vi.fn()
}));
vi.mock('../../../services/stock/stockService', () => stock);
vi.mock('../DeliverySheet', () => ({ DeliverySheet: () => null }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { DeliveriesTab } from '../DeliveriesTab';

afterEach(cleanup);

const context = { practiceId: 'practice-1', role: 'admin', suppliers: [{ id: 's1', name: 'Example Frames' }], items: [], reload: vi.fn() } as unknown as StockContext;

// A consignment invoice is a supplier invoice on the supplier's account (it is owed and paid there), but no stock came
// in with it: Stock > Deliveries must say so and point to its frames, not show an empty delivery
describe('a consignment invoice on Stock > Deliveries', () => {
  it('says what it is, points to its frames, and says reversing it puts the frames back to owed', async () => {
    stock.loadDeliveries.mockResolvedValue([CSG]);
    render(
      <MemoryRouter>
        <DeliveriesTab context={context} openDeliveryId="csg-1" />
      </MemoryRouter>
    );
    const sheet = await screen.findByRole('dialog', { name: 'Consignment invoice CSG2026-0001' });
    expect(within(sheet).getByRole('link', { name: /The frames are in Optometry/ })).toHaveAttribute('href', '/optometry?tab=reports&report=consignment');
    fireEvent.click(within(sheet).getByRole('button', { name: /Reverse it/ }));
    expect(within(sheet).getByText(/Its frames are owed to the supplier again/)).toBeInTheDocument();
    expect(screen.getAllByText(/Consignment · F-77/).length).toBeGreaterThan(0);
  });
});
