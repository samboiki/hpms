import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// The page header's profile picture reads the signed-in user (none here)
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: null; logout: () => void }) => unknown) => {
    const state = { user: null, logout: () => undefined };
    return selector ? selector(state) : state;
  }
}));

import { ScreenAccessNotice } from '../ScreenAccessNotice';

afterEach(cleanup);

/** The patient's Billing tab, from which "Open the invoice" leads into Finance */
const fromPatientFile = (gate: 'closed' | 'unchecked' | 'checking', onRetry = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={['/patients?patientId=p1&tab=billing', '/finance?tab=invoicing&invoice=inv-1']} initialIndex={1}>
      <Routes>
        <Route path="/patients" element={<p>Patient file</p>} />
        <Route path="/finance" element={<ScreenAccessNotice screen="finance" gate={gate} onRetry={onRetry} />} />
        <Route path="/" element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('a closed screen explains instead of breaking', () => {
  // A link into Finance from another screen must say who decides and how to get access, not show "page not found"
  it('tells the person whom to ask and where access is given', () => {
    fromPatientFile('closed');
    // Still the Finance page (its header), so the person knows where the link took them
    expect(screen.getByRole('heading', { level: 1, name: 'Finance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ask your practice administrator for access to Finance' })).toBeInTheDocument();
    expect(screen.getByText(/Settings > Users > Screen access/)).toBeInTheDocument();
  });

  it('takes them back to the screen they came from', () => {
    fromPatientFile('closed');
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByText('Patient file')).toBeInTheDocument();
  });

  // An address typed in has nowhere in the app to go back to: the dashboard is the way on
  it('offers only the dashboard when there is nothing to go back to', () => {
    render(
      <MemoryRouter initialEntries={['/stock']}>
        <ScreenAccessNotice screen="stock" gate="closed" onRetry={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'Ask your practice administrator for access to Stock' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open the dashboard' })).toBeInTheDocument();
  });
});

describe('the screen is never shown before the choice is known', () => {
  it('shows a spinner announced to screen readers while checking', () => {
    fromPatientFile('checking');
    expect(screen.getByRole('status')).toHaveTextContent('Checking who can open Finance');
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('asks to try again when the choice could not be read', () => {
    const onRetry = vi.fn();
    fromPatientFile('unchecked', onRetry);
    expect(screen.getByRole('heading', { name: 'Could not check your access to Finance' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
