/**
 * Finance > Reports' "Medical aid age analysis" card opens Debtors > Age analysis grouped per fund on what the funds owe
 * (and "Age analysis" per account, everything): the same table the old card printed, with the filters, totals and the
 * rows that open accounts. Staff land on what they asked for, not on the default view. Invented data only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { buildAgingReport } from '../../../services/ledgerService';
import { invoice } from '../../../services/__tests__/ledgerTestUtils';
import type { FinanceWorkspace } from '../financeData';
import type { FinanceDerived } from '../deriveFinance';
import type { PeriodLabels } from '../financeNav';

const mocks = vi.hoisted(() => ({ loadAccountDirectory: vi.fn(), loadPatientNames: vi.fn(), loadMedicalAidPlans: vi.fn() }));
vi.mock('../debtors/debtorsService', async importOriginal => ({ ...(await importOriginal<typeof import('../debtors/debtorsService')>()), ...mocks }));

import { DebtorsTab } from '../debtors/DebtorsTab';

const labels: PeriodLabels = {
  ranges: { preset: 'this_month', current: { startKey: '2026-10-01', endKey: '2026-10-13' }, previous: { startKey: '2026-09-01', endKey: '2026-09-13' } },
  current: '1-13 Oct 2026',
  previous: '1-13 Sep 2026',
  today: '13 Oct 2026',
  todayKey: '2026-10-13'
};
const invoices = [invoice({ id: 'i1', patientId: 'p1', issueDate: '2026-08-01', total: 300, medicalAidTotal: 200 })];
const workspace = {
  practiceId: 'practice-1',
  patientNames: { p1: 'Example Patient' },
  doctorNames: {},
  schemeByPatient: { p1: 'Example Fund' },
  ar: { state: 'ready', error: null, receipts: [], refunds: [], balances: {} }
} as unknown as FinanceWorkspace;
const derived = { aging: buildAgingReport(invoices, '2026-10-13') } as unknown as FinanceDerived;

beforeEach(() => {
  mocks.loadPatientNames.mockResolvedValue({});
  mocks.loadMedicalAidPlans.mockResolvedValue({ fundByPatient: {}, optionByPatient: {} });
  mocks.loadAccountDirectory.mockResolvedValue({ state: 'ready', error: null, links: [], flags: [] });
});
afterEach(cleanup);

const renderDebtors = (agePreset: React.ComponentProps<typeof DebtorsTab>['agePreset']) =>
  render(
    <MemoryRouter>
      <DebtorsTab workspace={workspace} derived={derived} labels={labels} practiceName="Example Practice" onRefresh={() => undefined} agePreset={agePreset} />
    </MemoryRouter>
  );

describe('Debtors > Age analysis opened from a report card', () => {
  it('opens per medical aid fund on what the funds owe when the medical aid card opened it', async () => {
    renderDebtors({ filter: { grouping: 'fund', portion: 'medical_aid', excludeFlags: [] }, key: 1 });
    expect(await screen.findByLabelText('Group by')).toHaveValue('fund');
    expect(screen.getByRole('button', { name: 'Medical aids owe' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Example Fund')).toBeInTheDocument();
  });

  it('opens on its usual view (accounts, everything owed) without a card\'s grouping', async () => {
    renderDebtors(null);
    expect(await screen.findByLabelText('Group by')).toHaveValue('account');
    expect(screen.getByRole('button', { name: 'Everything' })).toHaveAttribute('aria-pressed', 'true');
  });
});
