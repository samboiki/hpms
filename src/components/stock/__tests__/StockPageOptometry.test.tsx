/**
 * Owner decision (13 Oct 2026): the Optometry page is merged into Stock. An optometry practice finds its frames and its
 * lens orders to the lab as tabs of Stock, and the optometry reports under Stock > Reports; a GP, dental or specialist
 * practice never sees them (nothing optometry leaks into other disciplines). The tabs' own screens are stand-ins here.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

const state = vi.hoisted(() => ({ optometry: true as boolean | null }));

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (select?: (value: unknown) => unknown) => {
    const value = { user: { id: 'u1', role: 'admin', practice_id: 'practice-1', practices: { name: 'Test Practice' } } };
    return select ? select(value) : value;
  }
}));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../../layout/PageHeader', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>
}));
vi.mock('../useStockSettings', () => ({
  useStockSettings: () => ({ status: 'ready', settings: { dispensingEnabled: false, defaultVatRate: 15 }, reload: vi.fn() })
}));
vi.mock('../stockContext', () => ({
  useStockData: () => ({ status: 'ready', data: { items: [], levels: new Map(), suppliers: [], staffNames: {} }, reload: vi.fn() })
}));
vi.mock('../useStockStores', () => ({ useStockStores: () => ({ stores: [], levels: new Map(), userBranchId: null, reload: vi.fn() }) }));
vi.mock('../../optometry/useOptometryPractice', () => ({ useOptometryPractice: () => state.optometry }));
vi.mock('../StockItemsTab', () => ({ StockItemsTab: () => <p>The items</p> }));
vi.mock('../DeliveriesTab', () => ({ DeliveriesTab: () => null }));
vi.mock('../StockTakeTab', () => ({ StockTakeTab: () => null }));
vi.mock('../StockReportsTab', () => ({ StockReportsTab: () => <p>The stock reports</p> }));
vi.mock('../SuppliersTab', () => ({ SuppliersTab: () => null }));
vi.mock('../StockSettingsTab', () => ({ StockSettingsTab: () => null }));
vi.mock('../TransfersTab', () => ({ TransfersTab: () => null }));
vi.mock('../../optometry/PracticeLabOrders', () => ({ default: () => <p>The open lens orders</p> }));
vi.mock('../../optometry/FramesPanel', () => ({ default: () => <p>The frames</p> }));
vi.mock('../../optometry/OptometryReport', () => ({ default: ({ initialView }: { initialView: string | null }) => <p>The optometry reports ({initialView ?? 'summary'})</p> }));
vi.mock('../../optometry/FundNotesPanel', () => ({ default: () => <p>The benefit notes</p> }));

import { StockPage } from '../StockPage';

const open = (address: string) => render(<MemoryRouter initialEntries={[address]}><StockPage /></MemoryRouter>);

beforeEach(() => {
  state.optometry = true;
});

describe('optometry in Stock', () => {
  it('gives an optometry practice Frames and Lens orders tabs', () => {
    open('/stock');
    expect(screen.getByRole('tab', { name: /Frames/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Lens orders/ })).toBeInTheDocument();
  });

  it('opens the lens orders with the benefit notes, where an old Optometry link now lands', () => {
    open('/stock?tab=lenses');
    expect(screen.getByText('The open lens orders')).toBeInTheDocument();
    expect(screen.getByText('The benefit notes')).toBeInTheDocument();
    expect(screen.getByText(/A new order is made in the patient's file/)).toBeInTheDocument();
  });

  it('shows the optometry reports under Stock > Reports, opening the one a link asks for', () => {
    open('/stock?tab=reports&report=consignment');
    expect(screen.getByText('The stock reports')).toBeInTheDocument();
    expect(screen.getByText('The optometry reports (consignment)')).toBeInTheDocument();
  });

  it('shows nothing optometry to a practice of another discipline, even from an old link', () => {
    state.optometry = false;
    open('/stock?tab=frames');
    expect(screen.queryByRole('tab', { name: /Frames/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Lens orders/ })).toBeNull();
    expect(screen.getByText('The items')).toBeInTheDocument();
    expect(screen.queryByText('The frames')).toBeNull();
  });
});
