import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { FinancePageState } from '../useFinancePage';

// The tabs are stand-ins showing what they were given; the database knows no invoice
vi.mock('../OverviewTab', () => ({ OverviewTab: () => <p>Overview</p> }));
vi.mock('../InvoicingTab', () => ({ InvoicingTab: () => <p>Invoicing</p> }));
vi.mock('../PaymentsTab', () => ({ PaymentsTab: () => <p>Payments</p> }));
vi.mock('../ReportsTab', () => ({ ReportsTab: () => <p>Reports</p> }));
vi.mock('../InvoiceDetailModal', () => ({ InvoiceDetailModal: () => null }));
vi.mock('../debtors/DebtorsTab', () => ({
  DebtorsTab: ({ view, linkedCompanyId }: { view?: string; linkedCompanyId?: string | null }) => (
    <p>
      Debtors on {view} {linkedCompanyId ? `with account ${linkedCompanyId}` : ''}
    </p>
  )
}));
vi.mock('../LedgersTab', () => ({ LedgersTab: ({ view }: { view: string }) => <p>Ledgers on {view}</p> }));
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }
}));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast }));

import { FinanceTabContent } from '../FinanceTabContent';
import type { FinanceTab } from '../FinanceTabBar';

afterEach(() => {
  cleanup();
  toast.error.mockReset();
});

const page = {
  practiceId: 'practice-1',
  workspace: { practiceId: 'practice-1', invoices: { rows: [], error: null } },
  derived: {},
  labels: {},
  loading: false,
  error: null,
  refresh: () => undefined
} as unknown as FinancePageState;

const Address = () => {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
};

const renderAt = (address: string, tab: Exclude<FinanceTab, 'batch-management'>) =>
  render(
    <MemoryRouter initialEntries={[address]}>
      <Routes>
        <Route path="/finance" element={<><FinanceTabContent tab={tab} page={page} practiceName="Example Practice" onTabChange={vi.fn()} /><Address /></>} />
      </Routes>
    </MemoryRouter>
  );

describe('links into a part of Finance', () => {
  // The patient file's "Account in Finance" opened the age analysis, leaving staff to find the company by hand
  it('a link to a company account opens Debtors > Companies on that account', async () => {
    renderAt('/finance?tab=debtors&view=companies&account=acc-1', 'debtors');
    expect(await screen.findByText('Debtors on companies with account acc-1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('address')).toHaveTextContent(/^\?tab=debtors$/));
  });

  // "Payables in Finance" from Stock opened the ledgers' summary, not the expenses where the supplier's invoice is
  it('a link to the payables opens Ledgers > Expenses', async () => {
    renderAt('/finance?tab=ledgers&view=expenses', 'ledgers');
    expect(await screen.findByText('Ledgers on expenses')).toBeInTheDocument();
  });

  // Followed while Finance shows another tab, the link waits for the page to switch instead of being used up
  it('keeps a link for the tab it names until the page shows that tab', async () => {
    const view = (tab: 'overview' | 'debtors') => (
      <MemoryRouter initialEntries={['/finance?tab=debtors&view=companies&account=acc-1']}>
        <Routes>
          <Route path="/finance" element={<><FinanceTabContent tab={tab} page={page} practiceName="Example Practice" onTabChange={vi.fn()} /><Address /></>} />
        </Routes>
      </MemoryRouter>
    );
    const { rerender } = render(view('overview'));
    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent('account=acc-1');
    rerender(view('debtors'));
    expect(await screen.findByText('Debtors on companies with account acc-1')).toBeInTheDocument();
  });

  // A link to an invoice that is not there said nothing at all
  it('says so when a linked invoice cannot be found', async () => {
    renderAt('/finance?tab=invoicing&invoice=missing-1', 'invoicing');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/^That invoice could not be found/)));
  });
});
