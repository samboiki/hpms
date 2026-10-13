/**
 * Saves made on Finance's tabs that load on their own (a quote made into an invoice, a fund payment posted, a rejection
 * written off, a claim batch sent) change the figures on Finance's other tabs: billed, collected, what is owed and by
 * whom. They now reload those figures at once; before, Overview and the reports went on showing the old numbers until
 * someone pressed Refresh. Invented data only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
const refresh = vi.hoisted(() => vi.fn());
const stores = vi.hoisted(() => ({ auth: { user: { id: 'user-1', role: 'admin', practice_id: 'practice-1', practices: { name: 'Example Practice' } }, selectedPracticeId: null } }));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof stores.auth) => unknown) => (selector ? selector(stores.auth) : stores.auth)
}));
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
    refresh
  })
}));
vi.mock('../FinanceHeader', () => ({ FinanceHeader: () => null }));
vi.mock('../FinanceTabContent', () => ({ FinanceTabContent: () => null }));
vi.mock('../claims/ClaimsBatches', () => ({
  default: ({ onChanged }: { onChanged?: () => void }) => <button type="button" onClick={onChanged}>Send the batch</button>
}));
vi.mock('../../quotes/QuotePanels', () => ({
  QuotesTab: ({ onChanged }: { onChanged?: () => void }) => <button type="button" onClick={onChanged}>Make the quote an invoice</button>
}));

// RemittancesTab is the real one: its sections are replaced by buttons that report their saves
const remittance = vi.hoisted(() => ({ loadSetupState: vi.fn(async () => 'ready'), loadImportContext: vi.fn(async () => ({ canApproveWriteOffs: true })) }));
vi.mock('../remittances/remittanceService', () => ({ ...remittance, REMITTANCES_NOT_SET_UP_MESSAGE: 'Not set up' }));
vi.mock('../../../services/fundMasterService', () => ({ loadFundRules: vi.fn(async () => undefined) }));
vi.mock('../remittances/ImportSection', () => ({
  ImportSection: ({ onPosted }: { onPosted: () => void }) => <button type="button" onClick={onPosted}>Post the payments</button>
}));
vi.mock('../remittances/PostedSection', () => ({
  PostedSection: ({ onChanged }: { onChanged?: () => void }) => <button type="button" onClick={onChanged}>Reverse the receipt</button>
}));
vi.mock('../remittances/RejectionsSection', () => ({
  RejectionsSection: ({ onChanged }: { onChanged?: () => void }) => <button type="button" onClick={onChanged}>Write the rejection off</button>
}));

import Finance from '../../../pages/Finance';

const renderFinance = (tab: string) =>
  render(
    <MemoryRouter initialEntries={[`/finance?tab=${tab}`]}>
      <Finance />
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe('saves on the self-loading tabs reload the Finance figures', () => {
  it('a claim batch sent or changed on Batches', () => {
    renderFinance('batch-management');
    fireEvent.click(screen.getByRole('button', { name: 'Send the batch' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a quote made into an invoice on Quotes', () => {
    renderFinance('quotes');
    fireEvent.click(screen.getByRole('button', { name: 'Make the quote an invoice' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a fund payment posted, a posted receipt changed or a rejection settled on Remittances', async () => {
    renderFinance('remittances');
    fireEvent.click(await screen.findByRole('button', { name: 'Post the payments' }));
    expect(refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('tab', { name: /Imported/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reverse the receipt' }));
    expect(refresh).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('tab', { name: /Rejections/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Write the rejection off' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(3));
  });
});
