/**
 * Links into Finance land where they say: a tab chosen on the page stays in the address (an older ?tab= used to take
 * the page back to it whenever a report row opened an invoice), a link names a Debtors or Ledgers view and one company
 * account, and a company account's row on the age analysis opens that account. Invented data only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { buildAgingReport } from '../../../services/ledgerService';
import { invoice } from '../../../services/__tests__/ledgerTestUtils';
import { payersByInvoice, type PayerAccount } from '../../../utils/accounts/payerAccounts';
import { debtorsLink, payablesLink } from '../../billing/invoiceLinks';
import { isDebtorsView, isLedgerView } from '../financeNav';
import type { FinanceWorkspace } from '../financeData';
import type { FinanceDerived } from '../deriveFinance';
import type { PeriodLabels } from '../financeNav';

const mocks = vi.hoisted(() => ({
  loadAccountDirectory: vi.fn(),
  loadPatientNames: vi.fn(),
  loadMedicalAidPlans: vi.fn()
}));
vi.mock('../debtors/debtorsService', async importOriginal => ({
  ...(await importOriginal<typeof import('../debtors/debtorsService')>()),
  ...mocks
}));
// The company sheets open other services; these tests are about which one opens
vi.mock('../companies/PayerAccountSheet', () => ({ PayerAccountSheet: () => <div>Account form</div> }));
vi.mock('../companies/CompanyAccountSheet', () => ({ CompanyAccountSheet: ({ account }: { account: PayerAccount }) => <div>Sheet of {account.name}</div> }));

import { DebtorsTab } from '../debtors/DebtorsTab';

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadPatientNames.mockResolvedValue({});
  mocks.loadMedicalAidPlans.mockResolvedValue({ fundByPatient: {}, optionByPatient: {} });
  mocks.loadAccountDirectory.mockResolvedValue({ state: 'ready', error: null, links: [], flags: [] });
});

const account: PayerAccount = {
  id: 'acc-1',
  practiceId: 'practice-1',
  kind: 'employer',
  name: 'Test Builders',
  accountNumber: 'AC-0001',
  registrationNumber: null,
  vatNumber: null,
  contactName: null,
  phone: null,
  email: null,
  postalAddress: null,
  town: null,
  region: null,
  notes: null,
  createdAt: null,
  closedAt: null,
  closeReason: null
};
const invoices = [
  invoice({ id: 'i1', patientId: 'p1', visitId: 'v1', issueDate: '2026-08-01', total: 300, medicalAidTotal: 0 }),
  invoice({ id: 'i2', patientId: 'p1', visitId: 'v2', issueDate: '2026-09-20', total: 200, medicalAidTotal: 0 })
];
const visitPayers = [{ visitId: 'v1', accountId: 'acc-1', caseId: null }];
const labels: PeriodLabels = {
  ranges: { preset: 'this_month', current: { startKey: '2026-10-01', endKey: '2026-10-13' }, previous: { startKey: '2026-09-01', endKey: '2026-09-13' } },
  current: '1-13 Oct 2026',
  previous: '1-13 Sep 2026',
  today: '13 Oct 2026',
  todayKey: '2026-10-13'
};
const workspace = {
  practiceId: 'practice-1',
  patientNames: { p1: 'Example Patient' },
  doctorNames: {},
  schemeByPatient: {},
  ar: { state: 'ready', error: null, receipts: [], refunds: [], balances: {} },
  payers: { status: 'ready', accounts: [account], visitPayers, byInvoice: payersByInvoice(invoices, visitPayers, [account]), error: null }
} as unknown as FinanceWorkspace;
const derived = { aging: buildAgingReport(invoices, '2026-10-13') } as unknown as FinanceDerived;

const renderDebtors = (props: Partial<React.ComponentProps<typeof DebtorsTab>> = {}) =>
  render(
    <MemoryRouter>
      <DebtorsTab workspace={workspace} derived={derived} labels={labels} practiceName="Example Practice" onRefresh={() => undefined} {...props} />
    </MemoryRouter>
  );

describe('links into Finance name a view and an account', () => {
  it('the link builders write what Finance reads', () => {
    expect(payablesLink()).toBe('/finance?tab=ledgers&view=expenses');
    expect(debtorsLink('credit')).toBe('/finance?tab=debtors&view=credit');
    expect(debtorsLink('companies', 'acc-1')).toBe('/finance?tab=debtors&view=companies&account=acc-1');
    expect(isLedgerView('expenses')).toBe(true);
    expect(isDebtorsView('companies')).toBe(true);
    // An unknown or missing view is ignored: the tab opens as usual
    expect(isDebtorsView('everything')).toBe(false);
    expect(isLedgerView(null)).toBe(false);
  });
});

describe('Finance > Debtors: company and fund accounts', () => {
  // The company's own row on the age analysis looked clickable but did nothing
  it("a company account's row on the age analysis opens that account under Companies", async () => {
    renderDebtors();
    const row = (await screen.findByText(/Test Builders/)).closest('tr') as HTMLElement;
    fireEvent.click(row);
    expect(await screen.findByText('Sheet of Test Builders')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Companies/, selected: true })).toBeInTheDocument();
  });

  // The patient file's "Account in Finance" landed on the age analysis, leaving staff to find the account by hand
  it('a link to one account opens it straight away', async () => {
    renderDebtors({ view: 'companies', onViewChange: () => undefined, linkedCompanyId: 'acc-1' });
    expect(await screen.findByText('Sheet of Test Builders')).toBeInTheDocument();
  });
});

describe('Finance keeps the chosen tab in the address', () => {
  // The page's own screens are stand-ins: the content shows which tab it was given and can open an invoice the way
  // a report row does (adding ?invoice= to the address)
  vi.mock('../useFinancePage', () => ({
    useFinancePage: () => ({
      practiceId: 'practice-1',
      period: { preset: 'this_month' },
      setPeriod: () => undefined,
      labels: { ranges: {}, current: '', previous: '', today: '', todayKey: '2026-10-13' },
      workspace: null,
      derived: null,
      loading: false,
      error: null,
      refresh: () => undefined
    })
  }));
  vi.mock('../FinanceHeader', () => ({ FinanceHeader: () => null }));
  vi.mock('../FinanceTabContent', () => ({
    FinanceTabContent: ({ tab }: { tab: string }) => {
      const [, setSearchParams] = useSearchParams();
      return (
        <div>
          <p>Showing {tab}</p>
          <button type="button" onClick={() => setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('invoice', 'i1'); return next; })}>
            Open an invoice from a report row
          </button>
        </div>
      );
    }
  }));
  vi.mock('../claims/ClaimsBatches', () => ({ default: () => <p>Showing batches</p> }));
  vi.mock('../../quotes/QuotePanels', () => ({ QuotesTab: () => <p>Showing quotes</p> }));
  vi.mock('../remittances/RemittancesTab', () => ({ RemittancesTab: () => <p>Showing remittances</p> }));
  vi.mock('../../../stores/authStore', () => ({
    useAuthStore: () => ({ user: { id: 'user-1', practice_id: 'practice-1', practices: { name: 'Example Practice' } }, selectedPracticeId: null })
  }));
  vi.mock('../../../lib/supabase', () => {
    const query = (): unknown =>
      new Proxy({}, { get: (_target, key) => (key === 'then' ? (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) : () => query()) });
    return { supabase: { from: () => query(), rpc: () => query() } };
  });

  const Address = () => {
    const location = useLocation();
    return <output data-testid="address">{`${location.pathname}${location.search}`}</output>;
  };

  it('a report row opening an invoice no longer sends the page back to the tab of an older link', async () => {
    const { default: Finance } = await import('../../../pages/Finance');
    render(
      <MemoryRouter initialEntries={['/finance?tab=batch-management&batch=b1']}>
        <Routes>
          <Route path="/finance" element={<><Finance /><Address /></>} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Showing batches')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Finance sections' })).getByRole('tab', { name: /Reports/ }));
    expect(await screen.findByText('Showing reports')).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent(/^\/finance\?tab=reports$/);

    fireEvent.click(screen.getByRole('button', { name: 'Open an invoice from a report row' }));
    await waitFor(() => expect(screen.getByTestId('address')).toHaveTextContent('/finance?tab=reports&invoice=i1'));
    expect(screen.getByText('Showing reports')).toBeInTheDocument();
    expect(screen.queryByText('Showing batches')).not.toBeInTheDocument();
  });
});
