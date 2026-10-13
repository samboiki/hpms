/**
 * One source of truth for section colours: the page header icon and the selected tab take their classes from
 * src/config/sectionColors.ts, and Finance's matches the green of its dashboard card (PremiumStatCard). The owner saw
 * Finance green on the dashboard but blue on its own page, and Stock without its own colour.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SECTION_COLORS } from '../sectionColors';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

const auth = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Test Staff', email: 'staff@example.test', role: 'admin', practice_id: 'p1', practices: { id: 'p1', name: 'Example Practice' } },
  selectedPracticeId: null,
  logout: vi.fn()
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof auth) => unknown) => (selector ? selector(auth) : auth)
}));
vi.mock('../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'p1' }) }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
// Stock as it is once set up, with nothing in it yet
vi.mock('../../components/stock/useStockSettings', async importOriginal => ({
  ...(await importOriginal<typeof import('../../components/stock/useStockSettings')>()),
  useStockSettings: () => ({ status: 'ready', settings: { dispensingEnabled: false }, reload: () => undefined })
}));
vi.mock('../../components/stock/stockContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../../components/stock/stockContext')>()),
  useStockData: () => ({ status: 'ready', data: { items: [], levels: new Map(), suppliers: [], staffNames: new Map() }, reload: () => undefined })
}));

import { FinanceHeader } from '../../components/finance/FinanceHeader';
import { FinanceTabBar } from '../../components/finance/FinanceTabBar';
import PremiumStatCard from '../../components/dashboard/PremiumStatCard';
import { StockPage } from '../../components/stock/StockPage';

/** True when an element carries every class of a class list (e.g. "bg-gradient-to-br from-emerald-500 to-teal-600") */
const wears = (element: Element | null | undefined, classes: string) => !!element && classes.split(' ').every(name => element.classList.contains(name));
const wearing = (root: HTMLElement, classes: string) => [...root.querySelectorAll('*')].filter(element => wears(element, classes));
/** The icon box beside a page's title */
const titleIcon = (title: string) => screen.getByRole('heading', { level: 1, name: title }).parentElement?.previousElementSibling;

const RANGES = {
  preset: 'this_month' as const,
  current: { startKey: '2026-10-01', endKey: '2026-10-09' },
  previous: { startKey: '2026-09-01', endKey: '2026-09-09' }
};

describe('section colours in use', () => {
  it("shows Finance's green on its page header icon and selected tab, as on its dashboard tile", () => {
    const finance = SECTION_COLORS.finance;
    const { container } = render(
      <MemoryRouter>
        <FinanceHeader period={{ preset: 'this_month' }} ranges={RANGES} onPeriodChange={() => undefined} showPeriod loadedAt={null} refreshing={false} onRefresh={() => undefined} />
        <FinanceTabBar active="overview" onChange={() => undefined} />
      </MemoryRouter>
    );
    expect(wears(titleIcon('Finance'), finance.iconBox)).toBe(true);
    expect(wears(screen.getByRole('tab', { name: 'Overview' }), finance.activeTab)).toBe(true);
    // The old blue and cyan are gone from the page top
    expect(container.innerHTML).not.toMatch(/from-cyan-500 to-(blue-500|cyan-600)/);

    // The dashboard's Finance card wears the same green
    const card = render(<PremiumStatCard title="Finance" mainValue="" subtitle="" gradient="" stats={[]} cardType="finance" onClick={() => undefined} />);
    expect(wearing(card.container, finance.iconBox).length).toBeGreaterThan(0);
  });

  it('gives Stock its own colour on the page header icon and the selected tab', () => {
    const stock = SECTION_COLORS.stock;
    render(
      <MemoryRouter initialEntries={['/stock?tab=items']}>
        <StockPage />
      </MemoryRouter>
    );
    expect(wears(titleIcon('Stock'), stock.iconBox)).toBe(true);
    const tabs = screen.getByRole('tablist', { name: 'Stock sections' });
    expect(wears(within(tabs).getByRole('tab', { name: 'Items' }), stock.activeTab)).toBe(true);
    expect(SECTION_COLORS.finance.activeTab).not.toBe(stock.activeTab);
  });
});
