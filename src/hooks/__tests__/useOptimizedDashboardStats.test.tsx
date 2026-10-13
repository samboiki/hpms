import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getCommunicationStats: vi.fn()
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: mocks.rpc }
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { practice_id: 'practice-1' } })
}));
vi.mock('../../services/communicationStatsService', () => ({
  CommunicationStatsService: { getCommunicationStats: mocks.getCommunicationStats }
}));

import { useOptimizedDashboardStats } from '../useOptimizedDashboardStats';

const baseStats = {
  patient: { total: 1, male: 1, female: 0, newThisMonth: 0, newThisWeek: 0, averageAge: 30, activePatients: 1 },
  encounter: { total: 1, completed: 1, pending: 0, inProgress: 0, percentageCompleted: 100, percentagePending: 0, newThisMonth: 0 },
  invoice: {
    totalInvoices: 3, totalRevenue: 12345, quarterlyRevenue: 12345, quarterlyInvoices: 3,
    quarterlyPaidInvoices: 2, quarterlyOutstandingInvoices: 1, quarterlyPercentagePaid: 67,
    quarterlyPercentageOutstanding: 33, currentQuarter: 4
  }
};

const renderStatsHook = () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useOptimizedDashboardStats(), { wrapper });
};

describe('useOptimizedDashboardStats', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.rpc.mockReset();
    mocks.getCommunicationStats.mockReset();
    mocks.getCommunicationStats.mockResolvedValue({
      sms: { current_usage: 0, monthly_limit: 100, percentage_available: 100, available: 100 },
      email: { current_usage: 0, monthly_limit: 100, percentage_available: 100, available: 100 },
      overall_percentage_available: 100
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a failed load as an error instead of N$0 figures', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'function get_dashboard_stats does not exist' } });

    const { result } = renderStatsHook();

    // The hook retries once (react-query default 1s delay) before giving up
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.data).toBeUndefined();
    expect(result.current.error?.message).toMatch(/get_dashboard_stats does not exist/);
  }, 10000);

  // The Messages tile reads its own figures and shows "-" when they fail: that must not blank every other tile
  it('still shows the practice figures when only the message allowance cannot be read', async () => {
    mocks.rpc.mockResolvedValue({ data: baseStats, error: null });
    mocks.getCommunicationStats.mockRejectedValue({ code: '42501', message: 'permission denied' });
    const { result } = renderStatsHook();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.invoice.quarterlyRevenue).toBe(12345);
  });

  it('keeps the last good figures when a refresh fails', async () => {
    mocks.rpc.mockResolvedValue({ data: baseStats, error: null });
    const { result } = renderStatsHook();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.invoice.quarterlyRevenue).toBe(12345);

    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } });
    await result.current.refetch();

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.data?.invoice.quarterlyRevenue).toBe(12345);
    expect(result.current.error?.message).toMatch(/connection reset/);
  }, 10000);
});
