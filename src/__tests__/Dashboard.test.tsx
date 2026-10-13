/**
 * The dashboard's four cards (Patients, Communication, Encounters, Finance) in their original look. A practice can keep
 * a role out of Finance (Settings > Users > Screen access): that role must not read the practice's revenue off the
 * dashboard instead, so its Finance card is not shown at all. The diary, modals and data hooks are replaced; the cards
 * are the real ones.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Invented figures only
const mocks = vi.hoisted(() => ({
  seesFinance: true,
  visits: [] as unknown[],
  Nothing: () => null,
  STATS: {
    patient: { total: 1250, male: 600, female: 650, newThisMonth: 12, newThisWeek: 3, averageAge: 41, activePatients: 900 },
    encounter: { total: 3400, completed: 3300, pending: 100, inProgress: 0, percentageCompleted: 97, percentagePending: 3, newThisMonth: 210 },
    invoice: {
      totalInvoices: 5000,
      totalRevenue: 2500000,
      quarterlyRevenue: 125479.58,
      quarterlyInvoices: 320,
      quarterlyPaidInvoices: 280,
      quarterlyOutstandingInvoices: 40,
      quarterlyPercentagePaid: 88,
      quarterlyPercentageOutstanding: 12,
      currentQuarter: 4
    }
  },
  MESSAGES: {
    sms: { current_usage: 380, monthly_limit: 500, percentage_available: 24, available: 120 },
    email: { current_usage: 100, monthly_limit: 1000, percentage_available: 90, available: 900 },
    overall_percentage_available: 57
  }
}));

vi.mock('../hooks/useScreenAccess', () => ({ useSeesFinanceFigures: () => mocks.seesFinance }));
vi.mock('../hooks/useOptimizedDashboardStats', () => ({
  useOptimizedDashboardStats: () => ({ data: mocks.STATS, isLoading: false, isError: false, refetch: vi.fn() }),
  useCommunicationStats: () => ({ data: mocks.MESSAGES, isLoading: false })
}));
vi.mock('../stores/authStore', () => {
  const state = { user: { id: 'u1', name: 'Test Staff', email: 'staff@example.test', role: 'receptionist', practice_id: 'p1' }, logout: vi.fn() };
  return { useAuthStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state) };
});
vi.mock('../stores/themeStore', () => ({
  useTheme: () => ({ currentTheme: { gradients: { sidebar: 'from-cyan-500 to-blue-600', button: 'from-cyan-500 to-blue-600' } } })
}));
vi.mock('../stores/visitsStore', () => {
  const store = {
    get visits() {
      return mocks.visits;
    },
    unconfirmedCount: 0,
    checkedInCount: 0,
    readyCount: 0,
    inProgressCount: 0,
    todayCount: 0,
    isLoading: false,
    error: null,
    fetchTodayVisits: vi.fn(),
    fetchVisits: vi.fn(),
    subscribeToVisitChanges: vi.fn(),
    unsubscribeFromVisitChanges: vi.fn()
  };
  return { useVisitsStore: () => store };
});
// No practice chosen yet: the page loads nothing of its own
vi.mock('../contexts/PracticeContext', () => ({
  usePractice: () => ({ practiceId: null, userId: null, userRole: null, isLoading: false, error: null })
}));
vi.mock('../hooks/usePracticeData', () => ({ usePracticeData: () => ({ practiceData: null, colors: null }) }));
vi.mock('../hooks/useAppointments', () => ({ useTodayAppointments: () => ({ data: [], isLoading: false }), useRealtimeAppointments: () => undefined }));
vi.mock('../hooks/usePatientPrefetch', () => ({ useAutoPatientPrefetch: () => undefined }));
vi.mock('../hooks/useDiaryRangeVisits', () => ({ useDiaryRangeVisits: () => ({ visits: [], error: null, reload: vi.fn() }) }));
vi.mock('../services/dashboardStatsService', () => ({ dashboardStatsService: {} }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toast, default: toast };
});
// Icons are decorative here; a real icon fetches its shape on a timer that can outlive the test
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});
// The diary, the tiles beside it and the modals: not what this tests
vi.mock('../components/icons/SearchDuotone', () => ({ default: mocks.Nothing }));
vi.mock('../components/modals/EnhancedFinancialModal', () => ({ default: mocks.Nothing }));
vi.mock('../components/dashboard/PracticeOverviewTile', () => ({ default: mocks.Nothing }));
// The panel itself is tested on its own (NotificationsPanel.test.tsx): here only what the page hands it
vi.mock('../components/dashboard/NotificationsPanel', () => ({
  NotificationsPanel: ({ notifications }: { notifications: Array<{ id: string; title: string }> }) => (
    <ul aria-label="Notifications">{notifications.map((item) => <li key={item.id}>{item.title}</li>)}</ul>
  )
}));
vi.mock('../components/dashboard/FloatingVisitTracker', () => ({ default: mocks.Nothing }));
// The diary only opens a booking here (one invented booking)
vi.mock('../components/PremiumAppointmentScheduler', () => ({
  default: ({ onEditVisit }: { onEditVisit?: (visit: { id: string; patient_id: string }) => void }) => (
    <button type="button" onClick={() => onEditVisit?.({ id: 'visit-1', patient_id: 'patient-1' })}>Open the booked visit</button>
  )
}));
vi.mock('../components/modals/FormModal', () => ({ default: mocks.Nothing }));
vi.mock('../components/forms/PremiumAddAppointmentForm', () => ({ default: mocks.Nothing }));
vi.mock('../components/visits/FullScreenEditVisitModal', () => ({
  default: ({ isOpen, visitId }: { isOpen: boolean; visitId: string }) => (isOpen ? <p>The visit screen for {visitId}</p> : null)
}));

import Dashboard from '../pages/Dashboard';

const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/finance" element={<p>The Finance page</p>} />
        <Route path="/patients" element={<p>The Patients page</p>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  mocks.visits = [];
});

describe('dashboard cards', () => {
  beforeEach(() => {
    mocks.seesFinance = true;
  });

  it("shows the practice's quarterly revenue on the Finance card to someone the practice lets into Finance", () => {
    renderDashboard();
    expect(screen.getByRole('button', { name: /^Finance/ })).toHaveTextContent('N$ 125,479.58');
  });

  // Hiding Finance in the sidebar is pointless if the same person reads the takings off the dashboard
  it('shows no Finance card, and no amount at all, to a role the practice keeps out of Finance', () => {
    mocks.seesFinance = false;
    const { container } = renderDashboard();
    expect(screen.queryByRole('button', { name: /^Finance/ })).toBeNull();
    expect(container.textContent).not.toMatch(/N\$/);
    // The other cards still show
    for (const name of [/^Patients/, /^Communication/, /^Encounters/]) expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });

  it('opens the page a card counts', () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /^Finance/ }));
    expect(screen.getByText('The Finance page')).toBeInTheDocument();
  });
});

describe('the visit screen', () => {
  // While this test waits, the Dashboard centres today's date in its calendar strip (100 ms after opening); jsdom
  // cannot scroll an element
  const scrollTo = Element.prototype.scrollTo;
  beforeEach(() => {
    Element.prototype.scrollTo = () => undefined;
  });
  afterEach(() => {
    Element.prototype.scrollTo = scrollTo;
  });

  // Its code now loads when first opened instead of with the Dashboard; opening a booking from the diary must still
  // bring up that booking's visit screen
  it('opens for the booking chosen in the diary', async () => {
    renderDashboard();
    expect(screen.queryByText(/The visit screen/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open the booked visit' }));
    expect(await screen.findByText('The visit screen for visit-1')).toBeInTheDocument();
  });
});

// The panel's items were built once when the page opened, from the still-empty visit list: a website booking request
// that loaded a moment later never showed ("You're all caught up")
describe('the notifications panel', () => {
  it('lists a website booking request once the visits are there', () => {
    mocks.visits = [{
      id: 'visit-9', status: 'scheduled', is_confirmed: false, is_from_website: true, is_cancelled: false, visit_type: 'consultation',
      scheduled_date: '2026-10-14', scheduled_time: '09:00', created_at: '2026-10-13T08:00:00Z',
      patient: { first_name: 'Test', last_name: 'Patient' }
    }];
    renderDashboard();
    expect(screen.getAllByText('New Booking Request').length).toBeGreaterThan(0);
  });

  // It was rendered twice (one copy hidden per screen size), each loading every notification and subscribing to them
  // (owner, 13 Oct 2026: speed). One panel, in the place that suits the screen
  for (const [screenSize, large] of [['a phone or tablet', false], ['a large screen', true]] as const) {
    it(`is on the page once on ${screenSize}`, () => {
      const original = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: large, media: query, onchange: null,
        addEventListener: () => undefined, removeEventListener: () => undefined,
        addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false
      })) as unknown as typeof window.matchMedia;
      try {
        mocks.visits = [];
        renderDashboard();
        expect(screen.getAllByRole('list', { name: 'Notifications' })).toHaveLength(1);
      } finally {
        window.matchMedia = original;
      }
    });
  }
});
