import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FinanceWorkspace } from '../financeData';
import type { FinanceDerived } from '../deriveFinance';

const controls = vi.hoisted(() => ({ loadCloses: vi.fn(), loadCashedUpDays: vi.fn() }));
vi.mock('../controls/controlsService', () => controls);
const credit = vi.hoisted(() => ({ loadCreditControl: vi.fn() }));
vi.mock('../debtors/debtorsService', () => credit);
vi.mock('../../billingExtras/PlanInstalmentsControlLine', () => ({ PlanInstalmentsControlLine: () => null }));

import { ControlsOverviewCard } from '../controls/ControlsOverviewCard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const workspace = { practiceId: 'practice-1', ar: { state: 'ready', error: null, receipts: [], refunds: [], balances: {} } } as unknown as FinanceWorkspace;
const derived = { aging: { items: [] } } as unknown as FinanceDerived;

describe("Finance > Overview's daily and month-end controls", () => {
  // A failed read left "Checking the month end..." on screen for ever
  it('says plainly when the checks could not be read', async () => {
    controls.loadCloses.mockRejectedValue(new Error('Failed to fetch'));
    render(<ControlsOverviewCard workspace={workspace} derived={derived} onNavigate={vi.fn()} onOpenDebtors={vi.fn()} />);
    expect(await screen.findByText(/could not be checked: refresh Finance to try again/)).toBeInTheDocument();
    expect(screen.queryByText('Checking the month end...')).toBeNull();
  });

  // "Follow up" on promises opened the age analysis; the promises are on the credit control work list
  it('opens the credit control work list to follow up promises to pay', async () => {
    controls.loadCloses.mockResolvedValue({ state: 'ready', closes: [] });
    controls.loadCashedUpDays.mockResolvedValue(new Set());
    credit.loadCreditControl.mockResolvedValue({
      promises: [{ id: 'p1', accountId: 'patient-1', amountCents: 10000, promisedOn: new Date().toISOString().slice(0, 10), createdAt: null, keptAt: null }]
    });
    const onOpenDebtors = vi.fn();
    render(<ControlsOverviewCard workspace={workspace} derived={derived} onNavigate={vi.fn()} onOpenDebtors={onOpenDebtors} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Follow up' }));
    expect(onOpenDebtors).toHaveBeenCalledWith('credit');
  });
});
