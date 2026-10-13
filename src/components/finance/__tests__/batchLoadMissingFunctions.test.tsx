/**
 * Loading the claim batches no longer calls three database functions that do not exist (get_practice_batches_simple,
 * get_practice_batches_with_doctors, get_practice_batches): each load made three failed requests and logged them
 * before the direct query that always answered. The dashboard's finance window still makes that query; the Finance
 * page's old batch screen, which made it too, is gone. Invented data only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const MISSING = ['get_practice_batches_simple', 'get_practice_batches_with_doctors', 'get_practice_batches'];

// Every read answers "nothing"; the functions called and the tables read are noted
const calls = vi.hoisted(() => ({ rpc: [] as string[], tables: [] as string[] }));
vi.mock('../../../lib/supabase', () => {
  const query = (): unknown =>
    new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'then' ? (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) : () => query()
      }
    );
  return {
    supabase: {
      from: (table: string) => {
        calls.tables.push(table);
        return query();
      },
      rpc: (name: string) => {
        calls.rpc.push(name);
        return query();
      }
    }
  };
});
// The same objects on every render, as the real stores give (a new user object each time re-runs the loaders for ever)
const stores = vi.hoisted(() => ({
  auth: { user: { id: 'user-1', practice_id: 'practice-1', practices: { name: 'Example Practice' } }, selectedPracticeId: null },
  theme: { currentTheme: { gradients: {} } }
}));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => stores.auth }));
vi.mock('../../../stores/themeStore', () => ({ useTheme: () => stores.theme }));
vi.mock('../../../services/financialKpiService', () => ({ financialKpiService: { getFinancialKPIs: vi.fn(async () => null) } }));
// The Finance page's own screens are not what this is about
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
vi.mock('../FinanceTabContent', () => ({ FinanceTabContent: () => null }));
vi.mock('../claims/ClaimsBatches', () => ({ default: () => <p>The claims screen</p> }));
vi.mock('../../quotes/QuotePanels', () => ({ QuotesTab: () => null }));
vi.mock('../remittances/RemittancesTab', () => ({ RemittancesTab: () => null }));

// The charts size themselves with a ResizeObserver, which jsdom lacks
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  calls.rpc.length = 0;
  calls.tables.length = 0;
});

describe('loading claim batches', () => {
  // The page's old batch screen was never shown any more (the claims screen replaced it) but still loaded on this tab:
  // the practice, then batch_management_view, every time, for nothing on screen. It is gone: the claims screen loads its
  // own batches (claimsService), and the page itself reads nothing and calls no database function here.
  it('Finance > Batches shows the claims screen and the page runs none of the old batch screen loads', async () => {
    const { default: Finance } = await import('../../../pages/Finance');
    render(
      <MemoryRouter initialEntries={['/finance?tab=batch-management']}>
        <Finance />
      </MemoryRouter>
    );
    expect(await screen.findByText('The claims screen')).toBeTruthy();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(calls.tables).toEqual([]);
    expect(calls.rpc).toEqual([]);
    expect(calls.rpc.filter(name => MISSING.includes(name))).toEqual([]);
  });

  it("the dashboard's finance window reads them the same way", async () => {
    const { default: EnhancedFinancialModal } = await import('../../modals/EnhancedFinancialModal');
    render(
      <MemoryRouter>
        <EnhancedFinancialModal
          isOpen
          onClose={vi.fn()}
          data={{
            type: 'finance',
            title: 'Finance',
            subtitle: '',
            overview: { total: 0, change: '0%', isPositive: true, period: 'This month' },
            breakdown: [],
            chartData: { labels: [], datasets: [] },
            insights: []
          }}
        />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: /Batch Management/ }));
    await waitFor(() => expect(calls.tables).toContain('practices'));
    expect(calls.rpc.filter(name => MISSING.includes(name))).toEqual([]);
  });
});
