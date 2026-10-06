/** Finance > Reports: each card says what it answers, and an empty period gets a helpful empty state */
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { normalizeInvoice } from '../../../services/ledgerService';
import { deriveFinance, type FinanceContext } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { ReportsTab } from '../ReportsTab';

const context: FinanceContext = {
  ranges: {
    preset: 'this_month',
    current: { startKey: '2026-10-01', endKey: '2026-10-06' },
    previous: { startKey: '2026-09-01', endKey: '2026-09-06' }
  },
  todayKey: '2026-10-06',
  trendMonths: ['2026-09', '2026-10']
};

const labels: PeriodLabels = { ranges: context.ranges, current: '1–6 Oct 2026', previous: '1–6 Sep 2026', today: '6 Oct 2026', todayKey: '2026-10-06' };

const emptyWorkspace: FinanceWorkspace = {
  practiceId: 'p',
  requestKey: 'p|2025-11-01|2026-10-01|2026-10-06',
  invoices: { rows: [], error: null },
  lineItems: { rows: [], error: null },
  payslips: { rows: [], error: null },
  expenses: { rows: [], error: null },
  inventory: { rows: [], error: null },
  claims: { count: 0, amount: 0, error: null },
  visits: { rows: [], error: null },
  payslipLines: { rows: [], error: null },
  claimBatches: { rows: [], error: null },
  patientNames: {},
  doctorNames: {},
  schemeByPatient: {},
  serviceDateByVisit: {},
  lookupWarnings: [],
  loadedAt: '2026-10-06T08:00:00Z'
};

const renderReports = (workspace: FinanceWorkspace) =>
  render(<ReportsTab derived={deriveFinance(workspace, context)} workspace={workspace} labels={labels} practiceName="Test Practice" />);

/** The report card (the nearest container of the title that has the card's buttons) */
function cardFor(title: string): HTMLElement {
  let node: HTMLElement | null = screen.getByRole('heading', { name: title });
  while (node && !within(node).queryByRole('button', { name: /preview|hide/i })) node = node.parentElement;
  if (!node) throw new Error(`No card for ${title}`);
  return node;
}

describe('ReportsTab', () => {
  it('says on each new report card, in one sentence, what question it answers', () => {
    renderReports(emptyWorkspace);
    const questions: Array<[string, string]> = [
      ['Daily takings (cash-up)', 'How much did we take each day, and how was it paid?'],
      ['Debtors by medical aid fund', 'What does each medical aid owe us, and has the claim been sent?'],
      ['Doctor productivity', 'How many patients did each doctor see, and what did they bill and collect?'],
      ['Appointments and attendance', 'How many patients came, did not show up, or cancelled?'],
      ['PAYE, Social Security and pension', 'How much PAYE, Social Security and pension do we pay over for each month?'],
      ['Expenses by category', 'What did we spend money on each month?'],
      ['Stock and equipment valuation', 'What are our stock and equipment worth today?']
    ];
    for (const [title, question] of questions) {
      expect(within(cardFor(title)).queryByText(question)).not.toBeNull();
    }
  });

  it('shows a helpful empty state, not a blank table, when a period has nothing to report', () => {
    renderReports(emptyWorkspace);
    const card = cardFor('Daily takings (cash-up)');
    expect(within(card).queryByText(/nothing to show/)).not.toBeNull();

    fireEvent.click(within(card).getByRole('button', { name: 'Preview' }));

    expect(screen.queryByText('No payments in this period')).not.toBeNull();
    expect(screen.queryByText(/marked paid on the patient's Billing tab/)).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('previews a report listed by day with its totals row', () => {
    const paidToday = normalizeInvoice({
      id: 'inv-1', invoice_number: 'INV-1', total: 150, payment_status: 'paid', payment_method: 'cash',
      issue_date: '2026-10-02', due_date: '2026-11-01', updated_at: new Date(2026, 9, 2, 9, 30).toISOString()
    });
    renderReports({ ...emptyWorkspace, invoices: { rows: [paidToday], error: null } });

    fireEvent.click(within(cardFor('Daily takings (cash-up)')).getByRole('button', { name: 'Preview' }));

    const table = screen.getByRole('table');
    expect(within(table).queryByText('2 Oct 2026')).not.toBeNull();
    expect(within(table).queryByText('Total')).not.toBeNull();
    expect(within(table).getAllByText('N$150.00')).toHaveLength(4); // cash and day total, in the row and the totals
  });

  it('marks a report unavailable instead of offering a preview of zeros when its data failed to load', () => {
    renderReports({ ...emptyWorkspace, visits: { rows: [], error: 'permission denied for table visits' } });
    const card = cardFor('Appointments and attendance');
    expect(within(card).queryByText('Unavailable: Visits could not be loaded.')).not.toBeNull();
    expect((within(card).getByRole('button', { name: 'Preview' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
