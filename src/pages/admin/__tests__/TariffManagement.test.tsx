/**
 * Admin > Tariffs keeps the owner's own look: its white header bar and its own section buttons. A restyle onto the
 * shared page header and tab bar (October 2026) was put back because the owner designed this page and did not ask for
 * it. Its four sections still open from ?tab=, which other screens link to (the visit's Billing tab opens the
 * co-payments).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

const auth = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Test Admin', email: 'admin@example.test', role: 'admin', practice_id: 'practice-a', is_super_admin: false, avatar: null as string | null },
  selectedPracticeId: null as string | null,
  logout: vi.fn(async () => undefined)
}));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => auth }));

// The page's three direct reads: the practice, the shared tariff list and the funds
const tables = vi.hoisted((): Record<string, { data: unknown; error: { message: string } | null }> => ({}));
const practiceRow = { data: { id: 'practice-a', name: 'Kalahari Dental', practice_type: 'dental' }, error: null };
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const respond = () => Promise.resolve(tables[table] ?? { data: null, error: { message: `unexpected table ${table}` } });
      const builder: Record<string, unknown> = {};
      ['select', 'eq', 'order'].forEach(method => {
        builder[method] = () => builder;
      });
      builder.maybeSingle = respond;
      builder.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => respond().then(resolve, reject);
      return builder;
    }
  }
}));
vi.mock('../../../services/fundPricingService', () => ({
  loadPracticeTypeId: async () => 'type-dental',
  loadFundTariffRecords: async () => ({ rows: [], enabled: true }),
  loadFundContractRecords: async () => [],
  loadInfectionControlStaff: async () => 1
}));
vi.mock('../../../services/practiceTariffService', () => ({
  loadOwnTariffs: async () => ({ rows: [], enabled: true }),
  loadTariffPortions: async () => ({ portions: new Map(), error: null })
}));
vi.mock('../../../services/invoicingSetup', () => ({ loadInvoicingSetup: async () => ({ linePortions: true }) }));
// The sections' own panels are tested on their own; here each only says which one is showing
vi.mock('../../../components/tariffs/FundSchedulesPanel', () => ({ default: () => 'Fund prices panel' }));
vi.mock('../../../components/tariffs/ScheduleImportPanel', () => ({ default: () => 'Schedule import panel' }));
vi.mock('../../../components/tariffs/FundContractsPanel', () => ({ default: () => 'Fund contracts panel' }));
vi.mock('../../../components/billing/CopaymentPanel', () => ({ default: () => 'Co-payments panel' }));
vi.mock('../../../components/tariffs/PracticeTariffPanel', () => ({ default: () => 'Practice tariff panel' }));

import TariffManagement from '../TariffManagement';

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <TariffManagement />
    </MemoryRouter>
  );

beforeEach(() => {
  auth.logout.mockClear();
  tables.practices = practiceRow;
  tables.practice_tariffs_with_types = { data: [], error: null };
  tables.medical_aid_providers = { data: [], error: null };
});

describe('the Tariffs page frame', () => {
  it("keeps the owner's header and section buttons, with the practice's tariff named and its four sections", async () => {
    renderAt('/admin/tariffs');
    expect(await screen.findByRole('tablist', { name: 'Tariff sections' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 }).map(heading => heading.textContent)).toEqual(['Tariffs']);
    expect(screen.getByText('Kalahari Dental: the dental practice tariff, the funds\' own prices and contracts')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Fund prices', 'Import a schedule', 'Contracts and co-payments', 'Practice tariff']);
    // The page's own selected-section colour, not the shared tab bar's gradient
    expect(screen.getByRole('tab', { name: 'Fund prices', selected: true })).toHaveClass('bg-[#01b9d4]');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Fund prices panel');
    // The shared page header brought its own profile picture; this page never had one
    expect(screen.queryByRole('button', { name: /open profile menu/i })).not.toBeInTheDocument();
  });

  it('opens the section named in the address and switches sections from the tab bar', async () => {
    renderAt('/admin/tariffs?tab=contracts');
    expect(await screen.findByRole('tab', { name: 'Contracts and co-payments', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Fund contracts panel');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Co-payments panel');
    fireEvent.click(screen.getByRole('tab', { name: 'Practice tariff' }));
    expect(screen.getByRole('tab', { name: 'Practice tariff', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Practice tariff panel');
  });

  // Said in plain words with a way to try again, under the same header
  it('says what went wrong when the tariffs cannot be loaded', async () => {
    tables.practices = { data: null, error: { message: 'timeout' } };
    renderAt('/admin/tariffs');
    // The database's wording ("timeout") means nothing to staff: the banner says what to do
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not read the practice. Please refresh the page.');
    expect(alert).not.toHaveTextContent('timeout');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 }).map(heading => heading.textContent)).toEqual(['Tariffs']);
  });
});
