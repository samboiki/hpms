import { describe, it, expect, vi, beforeEach } from 'vitest';

// Recording thenable stand-in for the Supabase query builder; the response can depend on the
// request's ops (e.g. its range, or whether it filters by issue_date).
const db = vi.hoisted(() => {
  type Op = [string, unknown[]];
  type Response = { data: unknown; error: unknown };
  const state = {
    calls: [] as Array<{ table: string; ops: Op[] }>,
    respond: (() => ({ data: [], error: null })) as (table: string, ops: Op[]) => Response
  };
  const makeBuilder = (table: string) => {
    const entry = { table, ops: [] as Op[] };
    state.calls.push(entry);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'gte', 'lte', 'in', 'order', 'range']) {
      builder[method] = (...args: unknown[]) => {
        entry.ops.push([method, args]);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(state.respond(table, entry.ops)).then(resolve, reject);
    return builder;
  };
  return { state, makeBuilder };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (table: string) => db.makeBuilder(table) }
}));
vi.mock('../../contexts/PracticeContext', () => ({
  usePractice: () => ({ practiceId: null })
}));

import { fetchInvoiceStats } from '../useDashboardStats';

type Op = [string, unknown[]];
const isQuarterly = (ops: Op[]) => ops.some(([method]) => method === 'gte');
const rangeStart = (ops: Op[]) => ((ops.find(([method]) => method === 'range')?.[1] as number[] | undefined)?.[0]) ?? 0;

describe('fetchInvoiceStats (dashboard Finance tile fallback)', () => {
  beforeEach(() => {
    db.state.calls = [];
    db.state.respond = () => ({ data: [], error: null });
  });

  it('bounds the quarter with local calendar dates (Q4 starts 1 Oct, not 30 Sep as UTC gave in UTC+2)', async () => {
    // 00:30 local on 1 Oct 2026 is still 30 Sep in UTC
    const stats = await fetchInvoiceStats('practice-1', new Date(2026, 9, 1, 0, 30));

    const quarterlyOps = db.state.calls.map(c => c.ops).find(isQuarterly) ?? [];
    expect(quarterlyOps).toContainEqual(['gte', ['issue_date', '2026-10-01']]);
    expect(quarterlyOps).toContainEqual(['lte', ['issue_date', '2026-12-31']]);
    expect(quarterlyOps).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    expect(stats.currentQuarter).toBe(4);
  });

  it('counts cancelled invoices as neither paid nor outstanding', async () => {
    db.state.respond = () => ({
      error: null,
      data: [
        { total: 100, payment_status: 'paid' },
        { total: 100, payment_status: 'pending' },
        { total: 100, payment_status: 'overdue' },
        { total: 100, payment_status: null },
        { total: 100, payment_status: 'cancelled' }
      ]
    });

    const stats = await fetchInvoiceStats('practice-1', new Date(2026, 9, 5));

    expect(stats.quarterlyPaidInvoices).toBe(1);
    expect(stats.quarterlyOutstandingInvoices).toBe(3);
    expect(stats.quarterlyPercentagePaid).toBe(20);
    expect(stats.quarterlyPercentageOutstanding).toBe(60);
  });

  it('pages past the 1000-row cap so all-time totals are complete for large practices', async () => {
    db.state.respond = (_table, ops) => {
      if (isQuarterly(ops)) return { data: [], error: null };
      const size = rangeStart(ops) === 0 ? 1000 : 2;
      return { error: null, data: Array.from({ length: size }, () => ({ total: 50, payment_status: 'paid' })) };
    };

    const stats = await fetchInvoiceStats('practice-1', new Date(2026, 9, 5));

    expect(stats.totalInvoices).toBe(1002);
    expect(stats.totalRevenue).toBe(50100);
  });

  it('fails loudly on a query error instead of reporting zero invoices', async () => {
    db.state.respond = () => ({ data: null, error: { message: 'permission denied for table invoices_enhanced' } });

    await expect(fetchInvoiceStats('practice-1', new Date(2026, 9, 5))).rejects.toThrow(/permission denied/);
  });
});
