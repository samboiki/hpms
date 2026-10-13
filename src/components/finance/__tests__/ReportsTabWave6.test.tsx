/**
 * Finance > Reports' new reports (parity R1, R8, R9, R21, R22, R26, R28) sit on the same grid of cards, each next to the
 * report it belongs with and saying in one sentence what it answers; opening one shows it below the cards, and a
 * report whose tables are missing says so in words. The database calls are replaced; invented data only.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { deriveFinance, type FinanceContext } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';

vi.mock('../practiceReports/stockReportsService', () => ({
  loadStockMovement: vi.fn().mockResolvedValue({ state: 'not_set_up' }),
  loadGrossProfit: vi.fn().mockResolvedValue({ state: 'not_set_up' })
}));
vi.mock('../practiceReports/practiceReportsService', async importOriginal => ({
  ...(await importOriginal<typeof import('../practiceReports/practiceReportsService')>()),
  loadStaffNames: vi.fn().mockResolvedValue({ names: {}, staff: [] })
}));

import { ReportsTab } from '../ReportsTab';

const context: FinanceContext = {
  ranges: { preset: 'this_month', current: { startKey: '2026-10-01', endKey: '2026-10-13' }, previous: { startKey: '2026-09-01', endKey: '2026-09-13' } },
  todayKey: '2026-10-13',
  trendMonths: ['2026-09', '2026-10']
};
const labels: PeriodLabels = { ranges: context.ranges, current: '1-13 Oct 2026', previous: '1-13 Sep 2026', today: '13 Oct 2026', todayKey: '2026-10-13' };

const workspace: FinanceWorkspace = {
  practiceId: 'p',
  requestKey: 'p|2025-11-01|2026-10-01|2026-10-13',
  invoices: { rows: [], error: null },
  lineItems: { rows: [], error: null },
  payslips: { rows: [], error: null },
  expenses: { rows: [], error: null },
  inventory: { rows: [], error: null },
  visits: { rows: [], error: null },
  payslipLines: { rows: [], error: null },
  claimBatches: { rows: [], error: null },
  patientNames: {},
  doctorNames: {},
  schemeByPatient: {},
  serviceDateByVisit: {},
  lookupWarnings: [],
  loadedAt: '2026-10-13T08:00:00Z'
};

const renderReports = () => render(
  <MemoryRouter>
    <ReportsTab derived={deriveFinance(workspace, context)} workspace={workspace} labels={labels} practiceName="Test Practice" />
  </MemoryRouter>
);

const NEW_REPORTS: Array<[string, string, string]> = [
  ['Payments by age of debt', 'Which age of debt did the money we received pay off?', 'Age analysis'],
  ['Year to date', 'What have we billed so far this year, month by month?', 'Payer mix'],
  ['Demographics and new patients', 'Who are our patients, and how many new ones did we gain?', 'Appointments and attendance'],
  ['Spend and patients by town', 'What does a patient spend on average, and where do our patients live?', 'Demographics and new patients'],
  ['Stock movement per group', 'Which stock moves fast, which sits on the shelf, and what did each group use?', 'Stock and equipment valuation'],
  ['Gross profit', 'What did we make on the stock we billed, per item, practitioner and month?', 'Stock movement per group'],
  ['Build a report', 'Which invoices, payments or visits match what I need, with only the columns I want?', 'Gross profit']
];

describe('Finance > Reports: the reports added on 13 October', () => {
  it('puts each new report right after the report it belongs with, saying what question it answers', () => {
    renderReports();
    const titles = screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent);
    for (const [title, question, after] of NEW_REPORTS) {
      const heading = screen.getByRole('heading', { name: title });
      expect(heading.parentElement && within(heading.parentElement).queryByText(question)).not.toBeNull();
      expect(titles.indexOf(title)).toBe(titles.indexOf(after) + 1);
    }
  });

  it('opens a report below the cards, and says in words when its tables are not set up yet', async () => {
    renderReports();
    const card = screen.getByRole('heading', { name: 'Stock movement per group' }).closest('div.flex.flex-col') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Open' }));
    expect(await screen.findByText(/Stock is not set up in this database yet/)).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Hide' })).toBeTruthy();
  });
});
