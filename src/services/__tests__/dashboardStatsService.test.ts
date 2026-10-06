import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every table answers with no rows; the finance numbers come from the KPI loader mock below
vi.mock('../../lib/supabase', () => {
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'gte', 'order', 'range']) builder[method] = () => builder;
    builder.single = () => Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return builder;
  };
  return { supabase: { from: () => makeBuilder() } };
});

const kpiLoader = vi.hoisted(() => ({ getFinancialKPIs: vi.fn() }));
vi.mock('../financialKpiService', () => ({ financialKpiService: kpiLoader }));

import { dashboardStatsService } from '../dashboardStatsService';

const kpis = {
  totalBilledMTD: 1500,
  totalOutstanding: 900,
  statusSummary: {
    paid: { count: 4, amount: 2000 },
    pending: { count: 2, amount: 600 },
    overdue: { count: 1, amount: 300 },
    cancelled: { count: 1, amount: 450 },
  },
  monthlyRevenueTrend: [100, 200, 0, 0, 1100, 1500].map((revenue, i) => ({ month: `M${i}`, revenue, medical_aid: 0, patient: 0 })),
};

describe('dashboardStatsService finance and notification numbers', () => {
  beforeEach(() => {
    kpiLoader.getFinancialKPIs.mockReset();
    kpiLoader.getFinancialKPIs.mockResolvedValue(kpis);
  });

  it("reports the practice's real invoices instead of 100 randomly generated ones", async () => {
    const stats = await dashboardStatsService.getComprehensiveStats('practice-1');

    expect(kpiLoader.getFinancialKPIs).toHaveBeenCalledWith('practice-1', '6m');
    expect(stats.finance).toEqual({
      totalRevenue: 2900, // paid + pending + overdue; a cancelled invoice is not revenue
      thisMonth: 1500,
      outstanding: 900,
      paidInvoices: 4,
      unpaidInvoices: 3,
      revenueData: [100, 200, 0, 0, 1100, 1500],
      paymentMethods: [],
    });
  });

  it('gives the same numbers every time it is asked (nothing random)', async () => {
    const first = await dashboardStatsService.getComprehensiveStats('practice-1');
    const second = await dashboardStatsService.getComprehensiveStats('practice-1');
    expect(second.finance).toEqual(first.finance);
  });

  it('reports no notifications rather than invented counts', async () => {
    const stats = await dashboardStatsService.getComprehensiveStats('practice-1');
    expect(stats.notifications).toEqual({ total: 0, unread: 0, urgent: 0, types: [], weeklyData: [] });
  });
});
