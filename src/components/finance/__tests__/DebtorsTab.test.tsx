/**
 * Finance > Debtors as staff meet it: it says plainly when the database changes are missing (and
 * makes no debtor calls before receipts exist), and a family shows as one account under whoever
 * pays. The database calls are replaced.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { normalizeInvoice } from '../../../services/ledgerService';
import { deriveFinance, type FinanceContext } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
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

import { DebtorsTab } from '../debtors/DebtorsTab';

const context: FinanceContext = {
  ranges: { preset: 'this_month', current: { startKey: '2026-10-01', endKey: '2026-10-07' }, previous: { startKey: '2026-09-01', endKey: '2026-09-07' } },
  todayKey: '2026-10-07',
  trendMonths: ['2026-09', '2026-10']
};
const labels: PeriodLabels = { ranges: context.ranges, current: '1-7 Oct 2026', previous: '1-7 Sep 2026', today: '7 Oct 2026', todayKey: '2026-10-07' };

const invoice = (id: string, patientId: string, total: number, issueDate: string) =>
  normalizeInvoice({ id, invoice_number: id.toUpperCase(), patient_id: patientId, total, medical_aid_total: 0, patient_total: total, payment_status: 'pending', issue_date: issueDate, due_date: '2026-12-31' });

const workspace = (overrides: Partial<FinanceWorkspace> = {}): FinanceWorkspace => ({
  practiceId: 'practice-1',
  requestKey: 'practice-1|test',
  invoices: { rows: [invoice('inv-1', 'mum', 300, '2026-08-01'), invoice('inv-2', 'kid', 200, '2026-09-20')], error: null },
  lineItems: { rows: [], error: null },
  payslips: { rows: [], error: null },
  expenses: { rows: [], error: null },
  inventory: { rows: [], error: null },
  visits: { rows: [], error: null },
  payslipLines: { rows: [], error: null },
  claimBatches: { rows: [], error: null },
  patientNames: { mum: 'Maria Testing', kid: 'Kim Testing' },
  doctorNames: {},
  schemeByPatient: {},
  serviceDateByVisit: {},
  lookupWarnings: [],
  ar: { state: 'ready', error: null, receipts: [], refunds: [], balances: {} },
  loadedAt: '2026-10-07T08:00:00Z',
  ...overrides
});

const renderTab = (data: FinanceWorkspace) => render(
  <MemoryRouter>
    <DebtorsTab workspace={data} derived={deriveFinance(data, context)} labels={labels} practiceName="Test Practice" onRefresh={() => undefined} />
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadPatientNames.mockResolvedValue({});
  mocks.loadMedicalAidPlans.mockResolvedValue({ fundByPatient: {}, optionByPatient: {} });
});

describe('DebtorsTab', () => {
  it('says what is missing before receipts exist, and asks the database nothing', () => {
    renderTab(workspace({ ar: { state: 'not_set_up', error: null, receipts: [], refunds: [], balances: {} } }));
    expect(screen.getByText('Debtors is not set up yet')).toBeTruthy();
    expect(mocks.loadAccountDirectory).not.toHaveBeenCalled();
  });

  it('says what is missing when receipts exist but the debtors changes are not applied', async () => {
    mocks.loadAccountDirectory.mockResolvedValue({ state: 'not_set_up', error: null, links: [], flags: [] });
    renderTab(workspace());
    expect(await screen.findByText('Debtors is not set up yet')).toBeTruthy();
    expect(screen.getByText(/debtors-and-controls\.sql/)).toBeTruthy();
  });

  it('shows a family as one account under whoever pays, with both patients behind it', async () => {
    mocks.loadAccountDirectory.mockResolvedValue({
      state: 'ready',
      error: null,
      links: [{ id: 'l1', patientId: 'kid', holderId: 'mum', relationship: 'child', linkedBy: null, linkedAt: null, unlinkedAt: null, unlinkReason: null }],
      flags: []
    });
    renderTab(workspace());
    await waitFor(() => expect(screen.getByText('Maria Testing')).toBeTruthy());
    expect(screen.queryByText('Kim Testing')).toBeNull();
    expect(screen.getByText(/2 patients/)).toBeTruthy();
    expect(screen.getAllByText('N$ 500.00').length).toBeGreaterThan(0);
  });
});
