/**
 * Finance's number cards. The owner asked (13 October 2026) for them to follow the Dashboard's number cards: the
 * icon tile and title, a bold figure, a small trend and two little bars. These tests check that a practice still
 * reads the right amount, sees a loss as a loss, that the bars tell the truth and that long amounts still fit.
 * Amounts are invented.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { StatTile, figureSize } from '../FinanceUI';

describe('Finance number card', () => {
  it('shows the amount as one figure, so a screen reader reads it whole with its title', () => {
    render(<StatTile label="Billed" value="N$ 12,480.50" icon="solar:bill-list-bold-duotone" onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: /Billed.*N\$ 12,480\.50/ })).toBeTruthy();
  });

  it('shows a negative amount in red, so a loss is not mistaken for a profit', () => {
    render(<StatTile label="Net result (billed less costs)" value="-N$ 1,250.00" icon="solar:calculator-bold-duotone" />);
    expect(screen.getByText('-N$ 1,250.00').className).toContain('text-red-600');
  });

  it('keeps a positive amount in the normal colour', () => {
    render(<StatTile label="Collected" value="N$ 1,250.00" icon="solar:hand-money-bold-duotone" />);
    expect(screen.getByText('N$ 1,250.00').className).not.toContain('text-red-600');
  });

  it('shows a figure that is not money exactly as given', () => {
    render(<StatTile label="Net result (billed less costs)" value="Unavailable" icon="solar:calculator-bold-duotone" />);
    expect(screen.getByText('Unavailable')).toBeTruthy();
  });

  it('names both parts of the bars with percentages that add up to 100, never past full', () => {
    const { container, rerender } = render(
      <StatTile label="Collected" value="N$ 100.00" icon="solar:hand-money-bold-duotone" meter={{ share: 0.26, label: 'Collected', rest: 'Unpaid', shareIsGood: true }} />
    );
    expect(container.textContent).toContain('Collected26%');
    expect(container.textContent).toContain('74%Unpaid');
    rerender(<StatTile label="Collected" value="N$ 100.00" icon="solar:hand-money-bold-duotone" meter={{ share: 1.4, label: 'Collected', rest: 'Unpaid', shareIsGood: true }} />);
    expect(container.textContent).toContain('Collected100%');
    expect(container.textContent).toContain('0%Unpaid');
    rerender(<StatTile label="Collected" value="N$ 100.00" icon="solar:hand-money-bold-duotone" meter={{ share: null, label: 'Collected', rest: 'Unpaid', shareIsGood: true }} />);
    expect(container.textContent).not.toContain('Unpaid');
  });

  it('colours past due as the bad part, so a mostly overdue book never looks healthy', () => {
    const { container } = render(
      <StatTile label="Outstanding receivables" value="N$ 300.00" icon="solar:clock-circle-bold-duotone" meter={{ share: 0.8, label: 'Past due', rest: 'Current', shareIsGood: false }} />
    );
    const fills = [...container.querySelectorAll<HTMLElement>('span[style*="background-color"]')].map(element => element.style.backgroundColor);
    expect(fills).toEqual(['rgb(239, 68, 68)', 'rgb(16, 185, 129)']);
  });

  it('shows the change vs the previous period, and says plainly when there is nothing to compare', () => {
    const { container, rerender } = render(
      <StatTile label="Billed" value="N$ 100.00" icon="solar:bill-list-bold-duotone" change={{ percent: -3.1, comparisonLabel: '1–12 Sep 2026' }} />
    );
    expect(container.textContent).toContain('-3.1%');
    expect(container.textContent).toContain('vs 1–12 Sep 2026');
    rerender(<StatTile label="Billed" value="N$ 100.00" icon="solar:bill-list-bold-duotone" change={{ percent: null, comparisonLabel: '1–12 Sep 2026' }} />);
    expect(container.textContent).toContain('Nothing to compare in 1–12 Sep 2026');
  });

  it('makes a card that filters a list say whether its filter is on', () => {
    render(<StatTile dense label="Overdue" value="N$ 300.00" icon="solar:danger-circle-bold-duotone" onClick={() => undefined} pressed />);
    expect(screen.getByRole('button', { name: /Overdue/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('steps long amounts down a size so millions fit a row of four, and of five dense cards', () => {
    expect(figureSize('N$ 48,215.40')).toBe('text-2xl');
    expect(figureSize('N$ 1,248,215.40')).toBe('text-xl');
    expect(figureSize('-N$ 12,431,902.75')).toBe('text-lg');
    expect(figureSize('N$ 48,215.40', true)).toBe('text-lg');
    expect(figureSize('N$ 12,431,902.75', true)).toBe('text-sm');
  });
});
