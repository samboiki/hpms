import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every table answers with no rows (patients with db.patients) and every call is recorded; the finance numbers come from
// the KPI loader mock below
const db = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; ops: Array<[string, unknown[]]> }>,
  patients: [] as Array<{ id: string }>
}));
vi.mock('../../lib/supabase', () => {
  const makeBuilder = (table: string) => {
    const entry = { table, ops: [] as Array<[string, unknown[]]> };
    db.calls.push(entry);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'or', 'gte', 'order', 'range']) {
      builder[method] = (...args: unknown[]) => {
        entry.ops.push([method, args]);
        return builder;
      };
    }
    builder.single = () => Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: table === 'patients' ? db.patients : [], error: null }).then(resolve, reject);
    return builder;
  };
  return { supabase: { from: (table: string) => makeBuilder(table) } };
});

const kpiLoader = vi.hoisted(() => ({ getFinancialKPIs: vi.fn() }));
vi.mock('../financialKpiService', () => ({ financialKpiService: kpiLoader }));

import { dashboardStatsService } from '../dashboardStatsService';
import { EXCLUDE_CARRIER_VISITS } from '../../utils/carrierVisits';

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
    db.calls.length = 0;
    db.patients = [];
  });

  // A payment plan instalment, a package sale or an opening balance hangs on a cancelled "Not a consultation" row:
  // counted, it would add a visit (and a "consultation") the practice never saw
  it('counts the visits of the last six months without the rows that only carry invoices', async () => {
    db.patients = [{ id: 'patient-1' }];
    await dashboardStatsService.getComprehensiveStats('practice-1');
    const visitReads = db.calls.filter(call => call.table === 'visits');
    expect(visitReads).toHaveLength(1);
    expect(visitReads[0].ops).toContainEqual(['in', ['patient_id', ['patient-1']]]);
    expect(visitReads[0].ops).toContainEqual(['or', [EXCLUDE_CARRIER_VISITS]]);
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
