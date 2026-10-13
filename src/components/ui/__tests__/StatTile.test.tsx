/**
 * Number tiles across the app (Finance, Stock, the Eminance import) come from one component. The owner on the
 * Stock page's bordered tiles: "I don't like borders. Just plain, clean, straight and professional."
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { StatTile } from '../StatTile';
import { MiniStat } from '../../finance/FinanceUI';

/** Every class on the tile and inside it */
const classesIn = (root: Element) => [root, ...root.querySelectorAll('*')].flatMap(element => [...element.classList]);
const borderClasses = (root: Element) => classesIn(root).filter(name => /^border(-|$)/.test(name));

describe('StatTile', () => {
  // Finance's cards follow the Dashboard's look (soft edge) since 13 Oct 2026; Stock and the shared tiles stay borderless
  it('draws no border on the Stock and shared tiles, white or tinted', () => {
    const { container } = render(
      <>
        <StatTile label="Items in use" value="42" icon="solar:box-bold-duotone" tone="slate" />
        <StatTile compact label="Low: reorder" value="3" icon="solar:danger-triangle-bold-duotone" tone="amber" />
        <MiniStat label="Collection rate" value="80%" icon="solar:hand-money-bold-duotone" tone="green" />
      </>
    );
    expect(borderClasses(container)).toEqual([]);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Collection rate')).toBeTruthy();
  });

  // The Encounters and Messages analytics give a small figure its context ("of 92 visits") under it
  it('shows a compact tile its caption under the figure', () => {
    const { container } = render(<StatTile compact label="Completion rate" value="22%" caption="20 of 92 visits" icon="solar:check-circle-bold-duotone" tone="green" />);
    expect(container.textContent).toBe('Completion rate22%20 of 92 visits');
  });

  it('makes a tile that filters a list a button that says whether its filter is on', () => {
    const onClick = vi.fn();
    const { rerender } = render(<StatTile label="Overdue" value="N$ 300.00" icon="solar:danger-circle-bold-duotone" tone="red" onClick={onClick} pressed={false} />);
    const tile = screen.getByRole('button', { name: /Overdue/ });
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tile);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<StatTile label="Overdue" value="N$ 300.00" icon="solar:danger-circle-bold-duotone" tone="red" onClick={onClick} pressed />);
    expect(screen.getByRole('button', { name: /Overdue/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
