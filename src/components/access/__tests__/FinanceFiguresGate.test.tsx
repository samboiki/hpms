/**
 * Settings > Practice > Overhead lists the practice's costs. A practice that keeps a role out of Finance (Settings >
 * Users > Screen access) does not want that role reading the money there instead, so it sees a calm note.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ScreenAccessRead } from '../../../utils/auth/screenAccess';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

const state = vi.hoisted(() => ({
  user: { id: 'u2', role: 'receptionist', is_super_admin: false } as Record<string, unknown>,
  read: { status: 'ready', access: {} } as ScreenAccessRead,
  retry: vi.fn()
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) => selector({ user: state.user })
}));
vi.mock('../../../hooks/useScreenAccess', () => ({ useScreenAccess: () => ({ ...state.read, retry: state.retry }) }));

import { FinanceFiguresGate } from '../FinanceFiguresGate';

/** Stands in for the overheads screen: counts how often it is mounted (it loads the figures when it mounts) */
const mounted = vi.fn();
const Overheads = () => {
  mounted();
  return <p>Rent N$ 12,000.00</p>;
};

const renderGate = () =>
  render(
    <FinanceFiguresGate what="The practice's overheads">
      <Overheads />
    </FinanceFiguresGate>
  );

afterEach(() => {
  cleanup();
  mounted.mockClear();
  state.retry.mockClear();
});

describe('money figures in Settings follow who may open Finance', () => {
  it('shows the overheads to a role the practice lets into Finance', () => {
    state.user = { id: 'u3', role: 'doctor', is_super_admin: false };
    state.read = { status: 'ready', access: { finance: ['doctor'] } };
    renderGate();
    expect(screen.getByText('Rent N$ 12,000.00')).toBeTruthy();
  });

  it('shows a role the practice keeps out of Finance whom to ask, and never loads the figures', () => {
    state.user = { id: 'u2', role: 'receptionist', is_super_admin: false };
    state.read = { status: 'ready', access: { finance: ['doctor'] } };
    const { container } = renderGate();
    expect(screen.getByRole('heading', { name: 'Ask your practice administrator' })).toBeTruthy();
    expect(screen.getByText(/Settings > Users > Screen access/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/N\$/);
    expect(mounted).not.toHaveBeenCalled();
  });

  // Administrators can never be locked out of their own practice's costs
  it('always shows them to administrators', () => {
    state.user = { id: 'u1', role: 'admin', is_super_admin: false };
    state.read = { status: 'ready', access: { finance: [] } };
    renderGate();
    expect(mounted).toHaveBeenCalled();
  });

  // Neither "no access" nor the figures until the practice's choice is known
  it('waits while the choice is read, and offers to try again when it could not be read', () => {
    state.user = { id: 'u2', role: 'receptionist', is_super_admin: false };
    state.read = { status: 'loading', access: {} };
    const { unmount } = renderGate();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
    unmount();

    state.read = { status: 'error', access: {} };
    renderGate();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.retry).toHaveBeenCalledTimes(1);
    expect(mounted).not.toHaveBeenCalled();
  });
});
