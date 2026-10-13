/**
 * Finance > Reports: the older report cards drill down like the newer ones. A previewed row opens what it counts (an
 * unpaid invoice opens in Finance's invoice view; a payment method lists its payments, each opening its receipt). The two
 * age analysis cards that Debtors > Age analysis now does better stay where staff look for them and open it on their
 * grouping, once Debtors is in use; before that they preview as they always did. Invented data only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { normalizeInvoice, type ArReceipt } from '../../../services/ledgerService';
import { deriveFinance, type FinanceContext } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../controls/MonthEndPanel', () => ({ MonthEndPanel: () => null }));
vi.mock('../debtors/useAccountDirectory', () => ({ useAccountDirectory: () => ({ state: 'idle', holderNames: {}, links: [], flags: [], reload: () => undefined }) }));
const ar = vi.hoisted(() => ({ loadReceiptEntries: vi.fn() }));
vi.mock('../receipts/arService', async importOriginal => ({ ...(await importOriginal<typeof import('../receipts/arService')>()), ...ar }));
vi.mock('../receipts/ReceiptDetailModal', () => ({ ReceiptDetailModal: ({ receipt }: { receipt: ArReceipt }) => <p>Receipt view of {receipt.number}</p> }));

import { ReportsTab } from '../ReportsTab';

const context: FinanceContext = {
  ranges: { preset: 'this_month', current: { startKey: '2026-10-01', endKey: '2026-10-06' }, previous: { startKey: '2026-09-01', endKey: '2026-09-06' } },
  todayKey: '2026-10-06',
  trendMonths: ['2026-09', '2026-10']
};
const labels: PeriodLabels = { ranges: context.ranges, current: '1–6 Oct 2026', previous: '1–6 Sep 2026', today: '6 Oct 2026', todayKey: '2026-10-06' };

const card: ArReceipt = {
  id: 'rc-7', number: 'RC-000007', payerType: 'patient', patientId: 'pt1', fundName: null, payerName: null, method: 'card', amountCents: 24000,
  receivedOn: '2026-10-03', reference: null, source: 'manual', notes: null, createdBy: 'u1', createdAt: '2026-10-03T08:00:00Z', reversal: null,
  allocatedCents: 0, refundedCents: 0, unallocatedCents: 24000
};

const workspace = (receiptsReady: boolean): FinanceWorkspace => ({
  practiceId: 'practice-1',
  requestKey: 'k',
  invoices: { rows: [normalizeInvoice({ id: 'inv-9', invoice_number: 'INV-000009', patient_id: 'pt1', total: 300, medical_aid_total: 0, payment_status: 'pending', issue_date: '2026-09-02', due_date: '2026-09-30' })], error: null },
  lineItems: { rows: [], error: null },
  payslips: { rows: [], error: null },
  expenses: { rows: [], error: null },
  inventory: { rows: [], error: null },
  visits: { rows: [], error: null },
  payslipLines: { rows: [], error: null },
  claimBatches: { rows: [], error: null },
  patientNames: { pt1: 'Example Patient' },
  doctorNames: {},
  schemeByPatient: {},
  serviceDateByVisit: {},
  lookupWarnings: [],
  loadedAt: '2026-10-06T08:00:00Z',
  ...(receiptsReady ? { ar: { state: 'ready', error: null, receipts: [card], refunds: [], balances: {} } as unknown as FinanceWorkspace['ar'] } : {})
});

const Where = () => <p data-testid="where">{useLocation().search}</p>;
const renderReports = (receiptsReady: boolean, onNavigate = vi.fn()) => {
  const ws = workspace(receiptsReady);
  render(
    <MemoryRouter initialEntries={['/finance?tab=reports']}>
      <Routes>
        <Route path="*" element={<><ReportsTab derived={deriveFinance(ws, context)} workspace={ws} labels={labels} practiceName="Example Practice" onNavigate={onNavigate} /><Where /></>} />
      </Routes>
    </MemoryRouter>
  );
  return onNavigate;
};

/** The card holding a report's title */
const cardOf = (title: string): HTMLElement => {
  let node: HTMLElement | null = screen.getByRole('heading', { name: title });
  while (node && !within(node).queryAllByRole('button').length) node = node.parentElement;
  return node as HTMLElement;
};

afterEach(() => {
  cleanup();
  ar.loadReceiptEntries.mockReset();
});

describe('older report cards open their records', () => {
  it('an unpaid invoice in Accounts receivable aging opens in Finance\'s invoice view', () => {
    renderReports(false);
    fireEvent.click(within(cardOf('Accounts receivable aging')).getByRole('button', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('row', { name: 'Open invoice INV-000009' }));
    expect(screen.getByTestId('where').textContent).toContain('invoice=inv-9');
  });

  it('a payment method lists its payments, and each opens its receipt', async () => {
    ar.loadReceiptEntries.mockResolvedValue({ receipt: card, allocations: [], refunds: [], invoices: {} });
    renderReports(true);
    fireEvent.click(within(cardOf('Collections')).getByRole('button', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('row', { name: /Open the payments of .* \(Card\)/ }));

    fireEvent.click(await screen.findByRole('button', { name: /Receipt RC-000007/ }));
    expect(await screen.findByText('Receipt view of RC-000007')).toBeTruthy();
    expect(ar.loadReceiptEntries).toHaveBeenCalledWith('rc-7');
  });
});

describe('the two age analysis cards and Debtors > Age analysis', () => {
  it('open Debtors > Age analysis on their grouping once Debtors is in use, instead of a second copy of the table', () => {
    const onNavigate = renderReports(true);
    fireEvent.click(within(cardOf('Age analysis')).getByRole('button', { name: 'Open' }));
    expect(onNavigate).toHaveBeenLastCalledWith({ tab: 'debtors', debtorsView: 'ages', ageFilter: { grouping: 'account', portion: 'both' } });

    fireEvent.click(within(cardOf('Medical aid age analysis')).getByRole('button', { name: 'Open' }));
    expect(onNavigate).toHaveBeenLastCalledWith({
      tab: 'debtors',
      debtorsView: 'ages',
      ageFilter: { grouping: 'fund', portion: 'medical_aid', excludeFlags: [] }
    });
    expect(within(cardOf('Age analysis')).queryByRole('button', { name: 'Preview' })).toBeNull();
  });

  it('still preview, export and print as before when Debtors is not set up (nothing to open then)', () => {
    renderReports(false);
    expect(within(cardOf('Age analysis')).getByRole('button', { name: 'Preview' })).toBeTruthy();
    expect(within(cardOf('Medical aid age analysis')).getByRole('button', { name: 'CSV' })).toBeTruthy();
  });
});
