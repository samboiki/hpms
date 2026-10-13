import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { StockContext } from '../stockContext';
import type { StockSettings, Supplier } from '../../../utils/stock/stockRows';
import type { LedgerDelivery, LedgerPayable, SupplierLedgerData } from '../../../utils/stock/supplierLedger';

const stock = vi.hoisted(() => ({
  loadDeliveries: vi.fn(),
  loadPayableStatuses: vi.fn(),
  saveSupplier: vi.fn()
}));
const ledgerService = vi.hoisted(() => ({
  loadSupplierLedger: vi.fn(),
  loadSupplierAddress: vi.fn(),
  paySupplier: vi.fn(),
  reverseSupplierPayment: vi.fn()
}));

vi.mock('../../../services/stock/stockService', () => stock);
vi.mock('../../../services/stock/supplierLedgerService', () => ({
  ...ledgerService,
  isSupplierLedgerNotSetUp: (error: unknown) => (error as { code?: string } | null)?.code === '42P01'
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// Icons load their drawings later; in a test that can land after the page is gone ("window is not defined")
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { SuppliersTab } from '../SuppliersTab';

// Invented supplier and documents
const supplier: Supplier = {
  id: 's1', name: 'Medi Wholesale', contactName: null, phone: null, email: null, accountNumber: null, vatNumber: null,
  paymentTermsDays: 30, notes: null, isActive: true
};
const invoice = (overrides: Partial<LedgerDelivery> = {}): LedgerDelivery => ({
  id: 'g1', number: 'GRV2026-0001', kind: 'received', supplierId: 's1', supplierReference: 'INV-77', documentDate: '2026-06-01',
  exclVatCents: 4000, vatCents: 600, inclVatCents: 4600, onAccount: true, expenseId: 'e1', createdAt: '2026-06-01T08:00:00Z',
  reversedAt: null, reversalReason: null, ...overrides
});
const ledger = (parts: Partial<SupplierLedgerData> = {}): SupplierLedgerData => ({
  deliveries: [invoice()], payables: new Map<string, LedgerPayable>(), payments: [], allocations: [], ...parts
});
const context = (role: string): StockContext => ({
  practiceId: 'practice-1',
  practiceName: 'Test Practice',
  role,
  settings: {} as StockSettings,
  items: [],
  levels: new Map(),
  suppliers: [supplier],
  staffNames: new Map(),
  stores: [],
  storeLevels: new Map(),
  userBranchId: null,
  reload: vi.fn(),
  reloadSettings: vi.fn()
});

const renderTab = (role = 'admin') =>
  render(<MemoryRouter><SuppliersTab context={context(role)} openSupplierId={null} /></MemoryRouter>);

const openSupplier = async () => {
  fireEvent.click(await screen.findByRole('row', { name: 'Open Medi Wholesale' }));
  return screen.findByRole('dialog');
};

describe('suppliers with the creditors ledger (L12)', () => {
  beforeEach(() => {
    stock.loadDeliveries.mockReset().mockResolvedValue([]);
    stock.loadPayableStatuses.mockReset().mockResolvedValue(new Map());
    stock.saveSupplier.mockReset().mockResolvedValue('s1');
    ledgerService.loadSupplierLedger.mockReset().mockResolvedValue(ledger());
    ledgerService.loadSupplierAddress.mockReset().mockResolvedValue('PO Box 1, Windhoek');
  });

  // The list answers "who do we owe, and is it late?" without opening each supplier
  it('shows what each supplier is owed and how much of it is past the supplier\'s terms', async () => {
    renderTab();
    const row = await screen.findByRole('row', { name: 'Open Medi Wholesale' });
    await waitFor(() => expect(within(row).getByText(/46\.00 overdue/)).toBeInTheDocument());
  });

  // Money out is for practice admins and doctors (the database refuses anyone else): the screen says so up front
  it('lets a receptionist see the account but not pay, and says who can', async () => {
    renderTab('receptionist');
    const sheet = await openSupplier();
    expect(await within(sheet).findByText('Unpaid invoices')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /^Pay$/ })).toBeDisabled();
    expect(within(sheet).getByText('Only a practice admin or doctor can do this.')).toBeInTheDocument();
  });

  // The database saves the address that comes with the details: a save without it would wipe the one on file
  it('refuses to save a supplier whose postal address could not be read, so the address on file is never wiped', async () => {
    ledgerService.loadSupplierAddress.mockRejectedValue(new Error('network'));
    renderTab();
    const sheet = await openSupplier();
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('could not be read');
    fireEvent.submit(sheet.querySelector('form#stock-supplier-form') as HTMLFormElement);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(stock.saveSupplier).not.toHaveBeenCalled();
  });

  it('sends the postal address back with the details, as read or as changed', async () => {
    renderTab();
    const sheet = await openSupplier();
    const address = await within(sheet).findByLabelText('Postal address');
    expect(address).toHaveValue('PO Box 1, Windhoek');
    fireEvent.change(address, { target: { value: 'PO Box 2, Swakopmund' } });
    fireEvent.submit(sheet.querySelector('form#stock-supplier-form') as HTMLFormElement);
    await waitFor(() => expect(stock.saveSupplier).toHaveBeenCalledTimes(1));
    expect(stock.saveSupplier).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', postal_address: 'PO Box 2, Swakopmund' }));
  });

  // Before the database update the old screen stays: deliveries and payables, no address field that could not be saved
  it('keeps the old supplier screen until the ledger is set up', async () => {
    ledgerService.loadSupplierLedger.mockRejectedValue({ code: '42P01', message: 'relation "stock_supplier_payments" does not exist' });
    ledgerService.loadSupplierAddress.mockRejectedValue({ code: '42P01', message: 'column stock_suppliers.postal_address does not exist' });
    renderTab();
    const sheet = await openSupplier();
    expect(await within(sheet).findByText('No deliveries from this supplier yet.')).toBeInTheDocument();
    expect(within(sheet).queryByLabelText('Postal address')).not.toBeInTheDocument();
    fireEvent.submit(sheet.querySelector('form#stock-supplier-form') as HTMLFormElement);
    await waitFor(() => expect(stock.saveSupplier).toHaveBeenCalledTimes(1));
    expect(stock.saveSupplier.mock.calls[0][0]).not.toHaveProperty('postal_address');
  });

  // Arriving from "Supplier details" opened the supplier; after closing it, saving any supplier reloaded the list and
  // the linked supplier popped up again
  it('opens a linked supplier once, not again after the list reloads', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <SuppliersTab context={context('admin')} openSupplierId="s1" />
      </MemoryRouter>
    );
    const sheet = await screen.findByRole('dialog');
    fireEvent.click(within(sheet).getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // A reload hands the tab a new list of the same suppliers
    rerender(
      <MemoryRouter>
        <SuppliersTab context={{ ...context('admin'), suppliers: [{ ...supplier }] }} openSupplierId="s1" />
      </MemoryRouter>
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
