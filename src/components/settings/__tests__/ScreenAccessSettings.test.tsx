import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const service = vi.hoisted(() => ({
  loadScreenAccess: vi.fn(),
  loadRolesInUse: vi.fn(),
  saveScreenAccess: vi.fn()
}));
// Icons load on a timer that outlives the test; they are decorative here
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../../services/screenAccessService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/screenAccessService')>()),
  ...service
}));
const auth = vi.hoisted(() => ({ user: { id: 'user-1', practice_id: 'practice-1', role: 'admin', is_super_admin: false } as Record<string, unknown> }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) => selector({ user: auth.user })
}));

import { ScreenAccessSettings } from '../ScreenAccessSettings';

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ScreenAccessSettings />
    </QueryClientProvider>
  );

const financeRow = async () => within((await screen.findByText('Who can open Finance')).closest('fieldset') as HTMLElement);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'user-1', practice_id: 'practice-1', role: 'admin', is_super_admin: false };
  service.loadScreenAccess.mockResolvedValue({});
  service.loadRolesInUse.mockResolvedValue(['doctor', 'receptionist']);
});

afterEach(cleanup);

describe('Screen access in Settings > Users', () => {
  // Only administrators choose; everyone else must not even see the choice (the database refuses them too)
  it('is not shown to a receptionist', () => {
    auth.user = { id: 'user-2', practice_id: 'practice-1', role: 'receptionist', is_super_admin: false };
    const { container } = renderCard();
    expect(container).toBeEmptyDOMElement();
    expect(service.loadScreenAccess).not.toHaveBeenCalled();
  });

  // Nothing changes until an administrator chooses: every box starts ticked, administrators cannot be unticked
  it('shows a ticked box per role the practice uses, with administrators always in', async () => {
    renderCard();
    const finance = await financeRow();
    expect(finance.getByRole('checkbox', { name: 'Doctor' })).toBeChecked();
    expect(finance.getByRole('checkbox', { name: 'Receptionist' })).toBeChecked();
    expect(finance.queryByRole('checkbox', { name: 'Nurse' })).toBeNull();
    const administrators = finance.getByRole('checkbox', { name: 'Administrator (always)' });
    expect(administrators).toBeChecked();
    expect(administrators).toBeDisabled();
    expect(screen.getByText('Who can open Stock')).toBeInTheDocument();
  });

  it('closes Finance to receptionists with one click and says it is saved', async () => {
    service.saveScreenAccess.mockResolvedValue({ ok: true, access: { finance: ['doctor'] } });
    renderCard();
    const finance = await financeRow();
    fireEvent.click(finance.getByRole('checkbox', { name: 'Receptionist' }));
    await waitFor(() => expect(finance.getByText('Saved.')).toBeInTheDocument());
    expect(service.saveScreenAccess).toHaveBeenCalledWith('practice-1', 'finance', ['doctor']);
    expect(finance.getByRole('checkbox', { name: 'Receptionist' })).not.toBeChecked();
  });

  // A refused save must not look saved: the box shows what the practice really has, with the reason
  it('explains a refused save and leaves the box as it was', async () => {
    service.saveScreenAccess.mockResolvedValue({ ok: false, message: 'Not saved: screen access is not set up in the database yet.' });
    renderCard();
    const finance = await financeRow();
    fireEvent.click(finance.getByRole('checkbox', { name: 'Receptionist' }));
    expect(await finance.findByRole('alert')).toHaveTextContent('not set up in the database yet');
    expect(finance.getByRole('checkbox', { name: 'Receptionist' })).toBeChecked();
  });

  it('says there is nothing to choose while only administrators work in the practice', async () => {
    service.loadRolesInUse.mockResolvedValue([]);
    renderCard();
    expect(await screen.findByText(/Only administrators work in this practice now/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
