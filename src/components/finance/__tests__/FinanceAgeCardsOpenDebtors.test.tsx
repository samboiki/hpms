/**
 * Finance > Reports' age analysis cards open Debtors > Age analysis on their grouping (the medical aid card per fund).
 * The grouping applies to that one opening: coming back to Debtors later through the tab bar shows its usual view, not
 * the card's. The tabs are stand-ins that show what they were given. Invented data only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { FinancePageState } from '../useFinancePage';
import type { NavigateFn } from '../financeNav';

vi.mock('../OverviewTab', () => ({ OverviewTab: () => <p>Overview</p> }));
vi.mock('../InvoiceDetailModal', () => ({ InvoiceDetailModal: () => null }));
vi.mock('../ReportsTab', () => ({
  ReportsTab: ({ onNavigate }: { onNavigate?: NavigateFn }) => (
    <button type="button" onClick={() => onNavigate?.({ tab: 'debtors', debtorsView: 'ages', ageFilter: { grouping: 'fund', portion: 'medical_aid', excludeFlags: [] } })}>
      Open the medical aid age analysis
    </button>
  )
}));
vi.mock('../debtors/DebtorsTab', () => ({
  DebtorsTab: ({ view, agePreset }: { view?: string; agePreset?: { filter: { grouping?: string } } | null }) => (
    <p>Debtors on {view}, grouped {agePreset?.filter.grouping ?? 'as usual'}</p>
  )
}));

import { FinanceTabContent } from '../FinanceTabContent';
import type { FinanceTab } from '../FinanceTabBar';

const page = {
  practiceId: 'practice-1',
  workspace: { practiceId: 'practice-1', invoices: { rows: [], error: null } },
  derived: {},
  labels: {},
  loading: false,
  error: null,
  refresh: () => undefined
} as unknown as FinancePageState;

/** Finance's tab bar, as far as these tests need it */
const Page: React.FC = () => {
  const [tab, setTab] = useState<Exclude<FinanceTab, 'batch-management'>>('reports');
  return (
    <>
      <button type="button" onClick={() => setTab('overview')}>Overview tab</button>
      <button type="button" onClick={() => setTab('debtors')}>Debtors tab</button>
      <FinanceTabContent tab={tab} page={page} practiceName="Example Practice" onTabChange={next => setTab(next as Exclude<FinanceTab, 'batch-management'>)} />
    </>
  );
};

afterEach(cleanup);

describe('an age analysis card opens Debtors', () => {
  it('on the card\'s grouping, once', () => {
    render(<Page />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole('button', { name: 'Open the medical aid age analysis' }));
    expect(screen.getByText('Debtors on ages, grouped fund')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Overview tab' }));
    fireEvent.click(screen.getByRole('button', { name: 'Debtors tab' }));
    expect(screen.getByText('Debtors on ages, grouped as usual')).toBeInTheDocument();
  });
});
