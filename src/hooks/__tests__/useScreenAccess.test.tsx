import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const service = vi.hoisted(() => ({ loadScreenAccess: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../services/screenAccessService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/screenAccessService')>()),
  ...service
}));
const auth = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) => selector({ user: auth.user })
}));

import { useScreenAccess, useSeesFinanceFigures } from '../useScreenAccess';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('reading who may open Finance and Stock', () => {
  // Administrators always may: they never wait for, or depend on, the practice's choice
  it('does not read anything for an administrator', () => {
    auth.user = { id: 'u1', practice_id: 'practice-1', role: 'admin', is_super_admin: false };
    const { result } = renderHook(() => useScreenAccess(), { wrapper });
    expect(result.current.status).toBe('ready');
    expect(service.loadScreenAccess).not.toHaveBeenCalled();
  });

  it("gives a receptionist the practice's choice once it is read", async () => {
    auth.user = { id: 'u2', practice_id: 'practice-1', role: 'receptionist', is_super_admin: false };
    service.loadScreenAccess.mockResolvedValue({ finance: ['doctor'] });
    const { result } = renderHook(() => useScreenAccess(), { wrapper });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.access).toEqual({ finance: ['doctor'] });
    expect(service.loadScreenAccess).toHaveBeenCalledWith('practice-1');
  });

  // An unreadable choice must never count as "nothing chosen", or a failed read would open Finance to everyone
  it('reports a failed read as an error, not as an open screen', async () => {
    auth.user = { id: 'u2', practice_id: 'practice-1', role: 'receptionist', is_super_admin: false };
    service.loadScreenAccess.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useScreenAccess(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

describe('money figures outside Finance', () => {
  const useReadAndFigures = () => ({ read: useScreenAccess(), sees: useSeesFinanceFigures() });

  // The dashboard and Settings ask this hook: a receptionist the practice keeps out of Finance never sees the revenue
  it('hides them from a receptionist the practice keeps out of Finance, also once the choice is read', async () => {
    auth.user = { id: 'u2', practice_id: 'practice-1', role: 'receptionist', is_super_admin: false };
    service.loadScreenAccess.mockResolvedValue({ finance: ['doctor'] });
    const { result } = renderHook(useReadAndFigures, { wrapper });
    expect(result.current.sees).toBe(false);
    await waitFor(() => expect(result.current.read.status).toBe('ready'));
    expect(result.current.sees).toBe(false);
  });

  it('shows them once the practice is known to let reception into Finance', async () => {
    auth.user = { id: 'u2', practice_id: 'practice-1', role: 'receptionist', is_super_admin: false };
    service.loadScreenAccess.mockResolvedValue({ finance: ['doctor', 'receptionist'] });
    const { result } = renderHook(useReadAndFigures, { wrapper });
    await waitFor(() => expect(result.current.read.status).toBe('ready'));
    expect(result.current.sees).toBe(true);
  });
});
