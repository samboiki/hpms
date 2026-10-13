import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  followUpsDue,
  periodRange,
  topDiagnoses,
  type AnalyticsVisitRow,
  type DiagnosisLineRow,
  type FollowUpVisitRow
} from '../../../utils/encounters/encounterAnalytics';
import type { AnalyticsView } from '../../../utils/encounters/encounterLinks';

const service = vi.hoisted(() => ({ loadPeriodVisits: vi.fn(), loadTopDiagnoses: vi.fn(), loadFollowUpsDue: vi.fn() }));
vi.mock('../../../services/encounterAnalyticsService', () => service);
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1', isLoading: false }) }));
vi.mock('../../patients/ComprehensivePatientModal', () => ({
  default: (props: { patientId: string; backAction?: { label: string } }) => (
    <div data-testid="patient-file">
      {props.patientId} {props.backAction?.label}
    </div>
  )
}));

import { AdvancedEncountersDashboard } from '../AdvancedEncountersDashboard';

// The charts size themselves with a ResizeObserver, which jsdom lacks; the figures a person taps are buttons beside them
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Invented rows only: no real patients, practitioners or visits
const TODAY = '2026-10-12';
const RANGE = periodRange('30d', TODAY);
const STAFF = [
  { id: 'pr-a', full_name: 'Practitioner A' },
  { id: 'pr-b', full_name: 'Practitioner B' }
];

const visit = (id: string, day: string, doctor: string, type: string, overrides: Partial<AnalyticsVisitRow> = {}): AnalyticsVisitRow => ({
  id,
  patient_id: `patient-${id}`,
  doctor_id: doctor,
  scheduled_date: day,
  visit_date: day,
  status: 'completed',
  is_cancelled: false,
  is_checked_in: true,
  is_ready: false,
  visit_type: type,
  ...overrides
});
const notSeen = { status: 'scheduled', is_checked_in: false };
const VISITS: AnalyticsVisitRow[] = [
  visit('v1', '2026-10-05', 'pr-a', 'consultation'),
  visit('v2', '2026-10-06', 'pr-b', 'procedure'),
  visit('v3', '2026-10-06', 'pr-a', 'follow-up'),
  visit('v4', '2026-10-07', 'pr-a', 'consultation', { status: 'no-show', is_checked_in: false }),
  visit('v5', '2026-10-08', 'pr-b', 'consultation', { status: 'cancelled', is_checked_in: false }),
  visit('v6', '2026-10-09', 'pr-b', 'emergency', notSeen),
  visit('v7', TODAY, 'pr-a', 'consultation', notSeen)
];
const LINES: DiagnosisLineRow[] = [
  { icd10_primary: 'J06.9', icd10_secondary: ['I10'], invoice: { visit_id: 'v1', payment_status: 'pending' } },
  { icd10_primary: 'I10', icd10_secondary: [], invoice: { visit_id: 'v2', payment_status: 'paid' } }
];
const DESCRIPTIONS = new Map([
  ['J06.9', 'Acute upper respiratory infection, unspecified'],
  ['I10', 'Essential (primary) hypertension']
]);
const FOLLOW_UPS: FollowUpVisitRow[] = [
  { ...visit('f1', '2026-09-20', 'pr-a', 'consultation'), follow_up_date: '2026-10-01', patient: { first_name: 'Example', last_name: 'One', visits: [] } },
  { ...visit('f2', '2026-09-25', 'pr-b', 'consultation'), follow_up_date: TODAY, patient: { first_name: 'Example', last_name: 'Two', visits: [] } }
];

/** The practice's rows: once, or twice over (every row again under a new id) */
function useRows(times: 1 | 2) {
  const again = <T extends { id: string }>(rows: T[]): T[] => (times === 1 ? rows : [...rows, ...rows.map((row) => ({ ...row, id: `${row.id}-again` }))]);
  const lines = times === 1 ? LINES : [...LINES, ...LINES.map((line) => ({ ...line, invoice: { ...line.invoice!, visit_id: `${line.invoice!.visit_id}-again` } }))];
  const followUps = again(FOLLOW_UPS).map((row) => ({ ...row, patient_id: `patient-${row.id}` }));
  service.loadPeriodVisits.mockResolvedValue({ rows: again(VISITS), staff: STAFF });
  service.loadTopDiagnoses.mockResolvedValue({ rows: topDiagnoses(lines), descriptions: DESCRIPTIONS });
  service.loadFollowUpsDue.mockResolvedValue({ items: followUpsDue(followUps, RANGE, TODAY), staff: STAFF });
}

const onOpenVisits = vi.fn();
const onOpenDiaryDay = vi.fn();
const onViewChange = vi.fn();
const onPeriodChange = vi.fn();

const renderAnalytics = (view: AnalyticsView) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdvancedEncountersDashboard
        view={view}
        period="30d"
        onViewChange={onViewChange}
        onPeriodChange={onPeriodChange}
        onOpenVisits={onOpenVisits}
        onOpenDiaryDay={onOpenDiaryDay}
      />
    </QueryClientProvider>
  );

const loaded = async (view: AnalyticsView) => {
  // The Quick Stats column shows on both views
  await screen.findByRole('button', { name: /^Total Visits: / });
  if (view === 'visits') await screen.findByRole('list', { name: 'Visits per day' });
  else {
    await screen.findByRole('list', { name: 'Top diagnoses' });
    await screen.findByRole('list', { name: 'Follow-up visits due' });
  }
};

/** Every number a person can tap, by what it counts: "Seen" -> 3, "Tue 6 Oct 2026" -> 2... */
function figuresOnScreen(root: HTMLElement): Map<string, number> {
  const figures = new Map<string, number>();
  for (const button of within(root).queryAllByRole('button')) {
    const named = /^(.*): (\d+) visits?\b/.exec(button.getAttribute('aria-label') ?? '');
    if (named) {
      figures.set(named[1], Number(named[2]));
      continue;
    }
    // A number tile: its figure is the text that is only a number, the rest of its text names it
    const number = [...button.querySelectorAll('p')].find((p) => /^\d[\d,\s]*$/.test(p.textContent ?? ''));
    if (number) figures.set((button.textContent ?? '').replace(number.textContent ?? '', ' # '), Number((number.textContent ?? '').replace(/\D/g, '')));
  }
  return figures;
}

describe('Encounters > Analytics', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T08:00:00Z')); // 10:00 in Windhoek
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // The owner's first rule: no fake numbers. A typed-in figure stays the same when the practice's rows double, and a
  // random one would not double with them: either way this fails.
  it.each(['visits', 'diagnoses'] as const)('every figure on the %s view follows the practice\'s rows: none is a constant or a random number', async (view) => {
    useRows(1);
    const first = renderAnalytics(view);
    await loaded(view);
    const once = figuresOnScreen(first.container);
    const patientsOnce = view === 'diagnoses' ? within(screen.getByRole('list', { name: 'Follow-up visits due' })).getAllByRole('listitem').length : 0;
    first.unmount();

    useRows(2);
    const second = renderAnalytics(view);
    await loaded(view);
    const twice = figuresOnScreen(second.container);

    expect(once.size).toBeGreaterThanOrEqual(view === 'visits' ? 18 : 2);
    for (const [name, value] of once) {
      expect(value, name).toBeGreaterThan(0);
      expect(twice.get(name), name).toBe(value * 2);
    }
    if (view === 'diagnoses') {
      expect(within(screen.getByRole('list', { name: 'Follow-up visits due' })).getAllByRole('listitem')).toHaveLength(patientsOnce * 2);
    }
  });

  it.each(['visits', 'diagnoses'] as const)('labels the %s view honestly: no "Live data" or "AI" badge, and no money (it is not behind Finance\'s access)', async (view) => {
    useRows(1);
    const { container } = renderAnalytics(view);
    await loaded(view);
    expect(container.textContent).not.toMatch(/live data/i);
    expect(container.textContent).not.toMatch(/\bAI\b/);
    expect(container.textContent).not.toMatch(/N\$/);
    expect(screen.getByText(/counted from the practice's own visits and invoices/)).toBeInTheDocument();
  });

  it.each(['visits', 'diagnoses'] as const)('keeps the views\' tab bar on the %s view, so no view is a dead end', async (view) => {
    useRows(1);
    renderAnalytics(view);
    await loaded(view);
    const tabs = within(screen.getByRole('tablist', { name: 'Analytics views' }));
    fireEvent.click(tabs.getByRole('tab', { name: view === 'visits' ? 'Diagnoses and follow-ups' : 'Visits' }));
    expect(onViewChange).toHaveBeenCalledWith(view === 'visits' ? 'diagnoses' : 'visits');
  });

  it('a figure opens exactly what it counts: a status its visits, a day the diary', async () => {
    useRows(1);
    renderAnalytics('visits');
    await loaded('visits');
    fireEvent.click(screen.getByRole('button', { name: /No-shows/ }));
    expect(onOpenVisits).toHaveBeenCalledWith({ label: 'No-shows, 13 Sep-12 Oct 2026', visitIds: ['v4'] });
    fireEvent.click(screen.getByRole('button', { name: /^Tue 6 Oct 2026: 2 visits/ }));
    expect(onOpenDiaryDay).toHaveBeenCalledWith('2026-10-06');
    fireEvent.click(screen.getByRole('button', { name: /^Practitioner B: 3 visits/ }));
    expect(onOpenVisits).toHaveBeenLastCalledWith({ label: 'Practitioner B, 13 Sep-12 Oct 2026', visitIds: ['v2', 'v5', 'v6'] });
  });

  // The period is how a practice looks further back than 30 days; it lives behind the Date Range card
  it('changes the period from the Date Range card', async () => {
    useRows(1);
    renderAnalytics('visits');
    await loaded('visits');
    fireEvent.click(screen.getByRole('button', { name: /Date Range/ }));
    const choices = screen.getByRole('dialog', { name: 'Select Date Range' });
    fireEvent.click(within(choices).getByRole('button', { name: 'Last 3 months' }));
    expect(onPeriodChange).toHaveBeenCalledWith('3m');
  });

  it('a diagnosis opens its visits, and a follow-up opens the patient with the way back', async () => {
    useRows(1);
    renderAnalytics('diagnoses');
    await loaded('diagnoses');
    fireEvent.click(screen.getByRole('button', { name: /^I10 Essential \(primary\) hypertension: 2 visits/ }));
    expect(onOpenVisits).toHaveBeenCalledWith({ label: 'Diagnosis I10, 13 Sep-12 Oct 2026', visitIds: ['v1', 'v2'] });
    fireEvent.click(screen.getByRole('button', { name: /^Example One, follow-up due 1 Oct 2026, 11 days late/ }));
    expect(screen.getByTestId('patient-file')).toHaveTextContent('patient-f1 Back to analytics');
  });
});
