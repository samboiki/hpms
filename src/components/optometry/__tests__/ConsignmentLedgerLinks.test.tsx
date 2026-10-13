import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import type { ConsignmentLine } from '../../../utils/optometry/consignment';

// Invented frames, supplier and amounts. Nothing reaches the database.
const line = (overrides: Partial<ConsignmentLine>): ConsignmentLine => ({
  id: 'l1', itemId: 'frame-1', supplierId: 's1', kind: 'sold', quantity: 1, costEachCents: 40000, vatRate: 15, invoiceId: null, invoiceLineId: null,
  patientId: null, happenedOn: '2026-10-01', settledAt: null, expenseId: null, supplierReference: null, ...overrides
});
const reports = vi.hoisted(() => ({ loadConsignment: vi.fn() }));
const frames = vi.hoisted(() => ({ settleConsignment: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../../services/optometry/optometryReportsService', () => reports);
vi.mock('../../../services/optometry/frameUnitsService', () => frames);
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), toasts) }));
vi.mock('../reportParts', async () => ({ ...(await vi.importActual<object>('../reportParts')), ExportButtons: () => null }));

import ConsignmentView from '../ConsignmentView';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const data = (lines: ConsignmentLine[]) => ({
  status: 'ready',
  data: {
    frames: [{ itemId: 'frame-1', supplierId: 's1', costCents: 40000 }],
    onHand: new Map([['frame-1', 2]]),
    lines,
    suppliers: [{ id: 's1', name: 'Example Frames' }],
    payables: new Map([['e1', 'pending']]),
    catalogue: { frames: new Map([['frame-1', { name: 'Example C1' }]]), vatRates: new Map(), defaultVatRate: 15 }
  }
});

// The supplier's invoice for consignment frames sold is now on the supplier's account (Stock > Suppliers), where what
// is owed to the supplier is one figure and the invoice is paid: the consignment report must lead there
describe('consignment invoices and the supplier\'s account', () => {
  it('opens the supplier\'s account from an invoice recorded, and from "Not paid yet"', async () => {
    reports.loadConsignment.mockResolvedValue(data([line({ settledAt: '2026-10-02T09:00:00Z', expenseId: 'e1', supplierReference: 'F-77' })]));
    render(<MemoryRouter><ConsignmentView practiceId="practice-1" today="2026-10-13" /></MemoryRouter>);
    const recorded = await screen.findByRole('region', { name: 'Supplier invoices recorded' });
    expect(within(recorded).getByRole('link', { name: 'Example Frames' })).toHaveAttribute('href', '/stock?tab=suppliers&supplier=s1');
    expect(within(recorded).getByRole('link', { name: 'Not paid yet' })).toHaveAttribute('href', '/stock?tab=suppliers&supplier=s1');
  });

  it('says the invoice is owed on the supplier\'s account once it is recorded', async () => {
    reports.loadConsignment.mockResolvedValue(data([line({})]));
    frames.settleConsignment.mockResolvedValue({ expenseId: 'e2', totalCents: 46000, deliveryId: 'csg-1', number: 'CSG2026-0001' });
    render(<MemoryRouter><ConsignmentView practiceId="practice-1" today="2026-10-13" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Supplier.s invoice/ }));
    const sheet = await screen.findByRole('dialog');
    fireEvent.change(within(sheet).getByLabelText(/Supplier's invoice number/), { target: { value: 'F-78' } });
    fireEvent.click(within(sheet).getByRole('button', { name: /to payables/ }));
    await vi.waitFor(() => expect(toasts.success).toHaveBeenCalled());
    expect(toasts.success.mock.calls[0][0]).toMatch(/^CSG2026-0001 recorded: .*460\.00 owed to Example Frames on its account/);
  });
});
