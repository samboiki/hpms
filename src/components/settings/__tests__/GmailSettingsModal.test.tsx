/**
 * Gmail settings. The practice's emails go out through its Gmail when connected, and through OneHealth's own email
 * when Gmail fails: so "Send Test Email" only proves Gmail works when Gmail sent it. A disconnect the database refused
 * (only administrators and doctors may remove the connection) used to say "Gmail disconnected successfully".
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  role: 'admin',
  removedRows: [{ id: 'cred-1' }] as unknown[],
  provider: 'gmail',
  invoke: vi.fn()
}));

vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: 'u1', role: mocks.role } })
}));
vi.mock('../../../services/gmailConnectService', () => ({
  loadGmailConnection: vi.fn().mockResolvedValue({ email: 'practice@example.test', connectedAt: '2026-10-01T08:00:00Z', lastUsedAt: null, name: null, picture: null }),
  startGmailConnect: vi.fn()
}));
vi.mock('../../../lib/supabase', () => {
  const builder = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['select', 'eq', 'delete']) chain[name] = self;
    chain.single = () => Promise.resolve({ data: { client_id: 'client' }, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: mocks.removedRows, error: null }).then(resolve, reject);
    return chain;
  };
  return {
    supabase: {
      from: () => builder(),
      auth: { getUser: () => Promise.resolve({ data: { user: { email: 'staff@example.test' } } }) },
      functions: { invoke: (...args: unknown[]) => mocks.invoke(...args) }
    }
  };
});
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toast, default: toast };
});
vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import toast from 'react-hot-toast';
import { GmailSettingsModal } from '../GmailSettingsModal';

beforeEach(() => {
  mocks.role = 'admin';
  mocks.removedRows = [{ id: 'cred-1' }];
  mocks.invoke.mockReset().mockImplementation(() => Promise.resolve({ data: { success: true, provider: mocks.provider }, error: null }));
  mocks.provider = 'gmail';
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

const openModal = async (onClose = vi.fn()) => {
  render(<GmailSettingsModal isOpen onClose={onClose} />);
  await screen.findByText('Gmail Connected');
  return onClose;
};

describe('Gmail settings', () => {
  it('a test email that went out through OneHealth\'s own email says Gmail could not send it', async () => {
    mocks.provider = 'resend';
    await openModal();
    fireEvent.click(screen.getByRole('button', { name: /Send Test Email/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Gmail could not send it')));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('a test email Gmail sent says so', async () => {
    await openModal();
    fireEvent.click(screen.getByRole('button', { name: /Send Test Email/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Test email sent to staff@example.test through Gmail'));
  });

  it('a disconnect that removed nothing is not reported as done', async () => {
    mocks.removedRows = [];
    await openModal();
    fireEvent.click(screen.getByRole('button', { name: /Disconnect Gmail/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Gmail Connected')).toBeInTheDocument();
  });

  it('a receptionist cannot disconnect the practice\'s Gmail', async () => {
    mocks.role = 'receptionist';
    await openModal();
    expect(screen.getByRole('button', { name: /Disconnect Gmail/ })).toBeDisabled();
  });

  it('Escape closes the confirmation first, then the window', async () => {
    const onClose = await openModal();
    fireEvent.click(screen.getByRole('button', { name: /Disconnect Gmail/ }));
    expect(screen.getByText('Disconnect Gmail?')).toBeInTheDocument();
    act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(screen.queryByText('Disconnect Gmail?')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
