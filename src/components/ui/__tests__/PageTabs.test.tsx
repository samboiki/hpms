import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { PageTabs, type PageTab } from '../PageTabs';

type Section = 'overview' | 'invoicing' | 'payments' | 'ledgers' | 'reports' | 'batch-management';

const FINANCE: readonly PageTab<Section>[] = [
  { key: 'overview', label: 'Overview', icon: 'solar:chart-square-bold-duotone' },
  { key: 'invoicing', label: 'Invoicing', icon: 'solar:document-text-bold-duotone' },
  { key: 'payments', label: 'Payments', icon: 'solar:wallet-bold-duotone' },
  { key: 'ledgers', label: 'Ledgers', icon: 'solar:notebook-bold-duotone' },
  { key: 'reports', label: 'Reports', icon: 'solar:graph-new-up-bold-duotone' },
  { key: 'batch-management', label: 'Batches', icon: 'solar:box-bold-duotone' }
];

const renderTabs = (active: Section, onChange = vi.fn()) =>
  render(
    <PageTabs tabs={FINANCE} active={active} onChange={onChange} label="Finance sections" activeClassName="bg-cyan-600" />
  );

// Page tab bars (Finance, Settings, Encounters, Patients, practice profile) used to squeeze six tabs into a
// fixed grid, so on a tablet "Overview", "Invoicing" and "Payments" were cut off with an ellipsis and staff
// could not tell the sections apart. The bar now scrolls sideways instead: every label is always whole.
describe('PageTabs', () => {
  it('shows every section name in full instead of cutting it off', () => {
    renderTabs('overview');
    for (const tab of FINANCE) {
      const label = screen.getByText(tab.label);
      expect(label.className).not.toMatch(/truncate|text-ellipsis/);
      // A tab never shrinks below its label; the list scrolls sideways instead
      expect(screen.getByRole('tab', { name: tab.label }).className).toMatch(/shrink-0/);
    }
    expect(screen.getByRole('tablist', { name: 'Finance sections' }).className).toMatch(/overflow-x-auto/);
  });

  it('tells assistive technology which section is open, so the current page is never ambiguous', () => {
    renderTabs('reports');
    expect(screen.getByRole('tab', { name: 'Reports' })).toHaveAttribute('aria-selected', 'true');
    for (const tab of FINANCE.filter((t) => t.key !== 'reports')) {
      expect(screen.getByRole('tab', { name: tab.label })).toHaveAttribute('aria-selected', 'false');
    }
  });

  // Messages has unread messages and patient replies in its tabs: the count shows on the tab, and is read out with it
  it('shows how many things wait in a section beside its name', () => {
    const tabs: readonly PageTab<'dashboard' | 'messaging'>[] = [
      { key: 'dashboard', label: 'Dashboard', icon: 'solar:chart-bold-duotone' },
      { key: 'messaging', label: 'Messaging', icon: 'solar:chat-round-dots-bold-duotone', badge: 3 }
    ];
    render(<PageTabs tabs={tabs} active="dashboard" onChange={vi.fn()} label="Messages sections" activeClassName="bg-orange-500" />);
    expect(screen.getByRole('tab', { name: 'Messaging (3 waiting)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Dashboard' }).textContent).toBe('Dashboard');
  });

  it('opens the section the user picks (and does not submit a surrounding form)', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const { container } = render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <PageTabs tabs={FINANCE} active="overview" onChange={onChange} label="Finance sections" activeClassName="bg-cyan-600" />
      </form>
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Batches' }));
    expect(onChange).toHaveBeenCalledWith('batch-management');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.querySelectorAll('button[type="button"]')).toHaveLength(FINANCE.length);
  });
});
