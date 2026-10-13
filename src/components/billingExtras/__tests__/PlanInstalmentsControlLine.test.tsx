/**
 * Finance > Overview's daily controls name the payment plan instalments that fell due and are not on the accounts yet
 * (parity D16): with no scheduler, "Post due instalments" is how a practice catches up without opening every patient.
 * The line is shown only while something waits. Invented counts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
const toasts = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('react-hot-toast', () => toasts);
const auth = vi.hoisted(() => ({ user: { id: 'u1', role: 'receptionist', is_active: true } as { id: string; role: string; is_active: boolean } }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (selector?: (state: typeof auth) => unknown) => (selector ? selector(auth) : auth) }));
const service = vi.hoisted(() => ({ countDueInstalments: vi.fn(), postDueInstalments: vi.fn() }));
vi.mock('../../../services/billing/billingExtrasService', () => service);

import { PlanInstalmentsControlLine } from '../PlanInstalmentsControlLine';

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'u1', role: 'receptionist', is_active: true };
});

const renderLine = () => render(<ul><PlanInstalmentsControlLine practiceId="practice-1" /></ul>);

describe('PlanInstalmentsControlLine', () => {
  it('stays out of the way while nothing is due, and before the database update', async () => {
    service.countDueInstalments.mockResolvedValue({ status: 'ready', data: 0 });
    const { container } = renderLine();
    await waitFor(() => expect(service.countDueInstalments).toHaveBeenCalled());
    expect(container.querySelector('li')).toBeNull();
    service.countDueInstalments.mockResolvedValue({ status: 'not_set_up' });
    const second = renderLine();
    await waitFor(() => expect(service.countDueInstalments).toHaveBeenCalledTimes(2));
    expect(second.container.querySelector('li')).toBeNull();
  });

  it('posts every due instalment of the practice and counts again', async () => {
    service.countDueInstalments.mockResolvedValueOnce({ status: 'ready', data: 3 }).mockResolvedValue({ status: 'ready', data: 0 });
    service.postDueInstalments.mockResolvedValue({ posted: 3, totalCents: 90_000, waiting: 0 });
    renderLine();
    expect(await screen.findByText(/3 payment plan instalments are due and not on the accounts yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Post due instalments' }));
    await waitFor(() => expect(service.postDueInstalments).toHaveBeenCalledWith('practice-1', null));
    expect(toasts.toast.success).toHaveBeenCalledWith(expect.stringContaining('3 instalments (N$ 900.00) posted to the account.'), expect.anything());
    await waitFor(() => expect(screen.queryByText(/payment plan instalments are due/)).not.toBeInTheDocument());
  });

  // Posting instalments raises invoices: Finance's billed and owed figures must follow at once, not after a manual refresh
  it('on Finance > Overview, posting reloads the Finance figures instead of asking staff to refresh', async () => {
    service.countDueInstalments.mockResolvedValueOnce({ status: 'ready', data: 2 }).mockResolvedValue({ status: 'ready', data: 0 });
    service.postDueInstalments.mockResolvedValue({ posted: 2, totalCents: 60_000, waiting: 0 });
    const onPosted = vi.fn();
    render(<ul><PlanInstalmentsControlLine practiceId="practice-1" onPosted={onPosted} /></ul>);
    fireEvent.click(await screen.findByRole('button', { name: 'Post due instalments' }));
    await waitFor(() => expect(onPosted).toHaveBeenCalledTimes(1));
    expect(toasts.toast.success).toHaveBeenCalledWith(expect.not.stringContaining('Refresh Finance'), expect.anything());
  });

  it('shows the waiting instalments to someone without billing rights, without the button', async () => {
    auth.user = { id: 'u2', role: 'cleaner', is_active: true };
    service.countDueInstalments.mockResolvedValue({ status: 'ready', data: 1 });
    renderLine();
    expect(await screen.findByText(/1 payment plan instalment is due/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post due instalments' })).not.toBeInTheDocument();
  });
});
