/**
 * The Dashboard's financial window was built but nothing opened it. The owner asked (13 October 2026) for it to be
 * wired up: a small button by the Finance card's title opens it, while clicking the card still goes to Finance.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import PremiumStatCard from '../PremiumStatCard';

const renderCard = (onClick: () => void, onDetails?: () => void) =>
  render(
    <PremiumStatCard
      title="Finance"
      mainValue="N$ 12,000.00"
      subtitle="Q4 2026 revenue"
      iconName="solar:wallet-money-bold-duotone"
      gradient="from-cyan-500 to-blue-500"
      cardType="finance"
      stats={[]}
      onClick={onClick}
      onDetails={onDetails}
    />
  );

describe('PremiumStatCard overview button', () => {
  it('opens the overview without also leaving for the Finance page', () => {
    const onClick = vi.fn();
    const onDetails = vi.fn();
    renderCard(onClick, onDetails);
    fireEvent.click(screen.getByRole('button', { name: 'Open Finance overview' }));
    expect(onDetails).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps Enter on the overview button from also opening the card', () => {
    const onClick = vi.fn();
    renderCard(onClick, vi.fn());
    fireEvent.keyDown(screen.getByRole('button', { name: 'Open Finance overview' }), { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  // The other three Dashboard cards have no window, so they must not show a button that does nothing
  it('shows no overview button on a card without one', () => {
    renderCard(vi.fn());
    expect(screen.queryByRole('button', { name: /overview/ })).toBeNull();
  });
});
