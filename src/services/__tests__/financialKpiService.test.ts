import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal thenable stand-in for the Supabase query builder: records every call per table and
// resolves with a canned response, a response computed from the request's ops (e.g. its range),
// or never resolves, to simulate a hung request.
const db = vi.hoisted(() => {
  type Op = [string, unknown[]];
  type Response = { data: unknown; error: unknown };
  const state = {
    calls: [] as Array<{ table: string; ops: Op[] }>,
    responses: {} as Record<string, Response | 'hang' | ((ops: Op[]) => Response)>
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
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const response = state.responses[table];
      if (response === 'hang') return new Promise(() => {}).then(resolve, reject);
      const value = typeof response === 'function' ? response(entry.ops) : response;
      return Promise.resolve(value ?? { data: [], error: null }).then(resolve, reject);
    };
    return builder;
  };
  return { state, makeBuilder };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (table: string) => db.makeBuilder(table) }
}));

import {
  financialKpiService,
  FINANCE_KPI_TIMEOUT_MS,
  PAGE_SIZE,
  getQuarterDateRange,
  toPatientBillingItems
} from '../financialKpiService';

const invoice = (overrides: Record<string, unknown>) => ({
  id: 'x',
  invoice_number: null,
  total: 0,
  medical_aid_total: 0,
  patient_total: 0,
  payment_status: 'pending',
  payment_method: null,
  issue_date: '2026-10-01',
  updated_at: null,
  practitioner_id: null,
  patient_id: null,
  ...overrides
});

const opsFor = (table: string) => db.state.calls.filter(c => c.table === table).flatMap(c => c.ops);

describe('financialKpiService.getFinancialKPIs', () => {
  // 5 Oct 2026, mid-morning local time
  const now = new Date(2026, 9, 5, 10, 0, 0);

  beforeEach(() => {
    db.state.calls = [];
    db.state.responses = {};
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('scopes invoices and claim batches to the selected practice (multi-tenant isolation)', async () => {
    await financialKpiService.getFinancialKPIs('practice-1', '30d', now);

    expect(opsFor('invoices_enhanced')).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    expect(opsFor('batch_headers')).toContainEqual(['eq', ['practice_id', 'practice-1']]);
  });

  it('filters issue_date with local calendar dates so the 6-month trend window is not shifted a day by UTC', async () => {
    await financialKpiService.getFinancialKPIs('practice-1', '30d', now);

    // Trend covers May..Oct 2026; toISOString() in UTC+2 would have produced 2026-04-30
    expect(opsFor('invoices_enhanced')).toContainEqual(['gte', ['issue_date', '2026-05-01']]);
  });

  it('returns an explicit zero-invoice result for an empty period so the UI can show "No invoices in this period"', async () => {
    const kpis = await financialKpiService.getFinancialKPIs('practice-1', '30d', now);

    expect(kpis.invoiceCount).toBe(0);
    expect(kpis.totalBilledMTD).toBe(0);
    expect(kpis.totalOutstanding).toBe(0);
    expect(kpis.monthlyRevenueTrend).toHaveLength(6);
    // No invoices => no need to query line items at all
    expect(db.state.calls.some(c => c.table === 'invoice_services')).toBe(false);
  });

  it('counts only pending/overdue (and status-less) invoices as outstanding, and only paid ones as collected', async () => {
    db.state.responses.invoices_enhanced = {
      error: null,
      data: [
        { id: 'a', total: 100, medical_aid_total: 0, patient_total: 100, payment_status: 'pending', issue_date: '2026-10-02', practitioner_id: null, patient_id: null },
        { id: 'b', total: 50, medical_aid_total: 0, patient_total: 50, payment_status: 'overdue', issue_date: '2026-09-20', practitioner_id: null, patient_id: null },
        { id: 'c', total: 30, medical_aid_total: 0, patient_total: 30, payment_status: 'paid', issue_date: '2026-10-01', practitioner_id: null, patient_id: null },
        { id: 'd', total: 20, medical_aid_total: 0, patient_total: 20, payment_status: 'cancelled', issue_date: '2026-10-03', practitioner_id: null, patient_id: null },
        { id: 'e', total: 5, medical_aid_total: 0, patient_total: 5, payment_status: null, issue_date: '2026-10-04', practitioner_id: null, patient_id: null }
      ]
    };

    const kpis = await financialKpiService.getFinancialKPIs('practice-1', '30d', now);

    expect(kpis.totalOutstanding).toBe(155); // 100 pending + 50 overdue + 5 with no status
    expect(kpis.totalCollectedMTD).toBe(30);
    // October invoices a, c, e. The cancelled invoice d is void and was never revenue,
    // so counting it would overstate what the practice billed this month.
    expect(kpis.totalBilledMTD).toBe(135);
    expect(kpis.invoiceCount).toBe(5);
    // Line items are fetched only for invoices in the period, never the whole table
    expect(opsFor('invoice_services')).toContainEqual(['in', ['invoice_id', ['a', 'b', 'c', 'd', 'e']]]);
  });

  it('rejects instead of hanging when the database never answers, so the loading state can end', async () => {
    vi.useFakeTimers();
    db.state.responses.invoices_enhanced = 'hang';

    const pending = financialKpiService.getFinancialKPIs('practice-1', '30d', now);
    const assertion = expect(pending).rejects.toThrow(/took too long/);
    await vi.advanceTimersByTimeAsync(FINANCE_KPI_TIMEOUT_MS);

    await assertion;
  });

  it('surfaces query errors as a rejection with the database message', async () => {
    db.state.responses.invoices_enhanced = { data: null, error: { message: 'permission denied' } };

    await expect(financialKpiService.getFinancialKPIs('practice-1', '30d', now)).rejects.toThrow(/permission denied/);
  });

  it('pages past the 1000-row Supabase cap so large practices get complete totals', async () => {
    // First page is full (1000 invoices of N$10), second page has the remaining 5
    db.state.responses.invoices_enhanced = ops => {
      const range = ops.find(([method]) => method === 'range')?.[1] as [number, number] | undefined;
      const from = range?.[0] ?? 0;
      const size = from === 0 ? PAGE_SIZE : 5;
      return {
        error: null,
        data: Array.from({ length: size }, (_, i) =>
          invoice({ id: `inv-${from + i}`, total: 10, payment_status: 'pending', issue_date: '2026-10-02' }))
      };
    };

    const kpis = await financialKpiService.getFinancialKPIs('practice-1', '30d', now);

    expect(kpis.invoiceCount).toBe(1005);
    expect(kpis.totalOutstanding).toBe(10050);
    expect(kpis.totalBilledMTD).toBe(10050);
    expect(opsFor('invoices_enhanced')).toContainEqual(['range', [0, 999]]);
    expect(opsFor('invoices_enhanced')).toContainEqual(['range', [1000, 1999]]);
    // A stable unique tie-breaker keeps pages from overlapping or skipping invoices
    expect(opsFor('invoices_enhanced')).toContainEqual(['order', ['id']]);
  });

  it('summarises invoices by status and lists recent invoices/payments from real rows', async () => {
    db.state.responses.invoices_enhanced = {
      error: null,
      data: [
        invoice({ id: 'a', invoice_number: 'INV-A', total: 100, payment_status: 'pending', issue_date: '2026-10-04', patient_id: 'p1' }),
        invoice({ id: 'b', invoice_number: 'INV-B', total: 40, payment_status: 'paid', payment_method: 'cash', issue_date: '2026-10-03', updated_at: '2026-10-03T08:00:00Z', patient_id: 'p2' }),
        invoice({ id: 'c', invoice_number: 'INV-C', total: 60, payment_status: 'paid', payment_method: 'card', issue_date: '2026-09-20', updated_at: '2026-10-04T09:00:00Z', patient_id: 'p1' }),
        invoice({ id: 'd', invoice_number: 'INV-D', total: 25, payment_status: 'cancelled', issue_date: '2026-09-15', patient_id: 'p2' }),
        invoice({ id: 'e', invoice_number: 'INV-E', total: 15, payment_status: 'overdue', issue_date: '2026-09-10', patient_id: 'p3' })
      ]
    };
    db.state.responses.patients = {
      error: null,
      data: [
        { id: 'p1', first_name: 'Ndapewa', last_name: 'Shilongo' },
        { id: 'p2', first_name: 'Johannes', last_name: 'Nghifikwa' }
      ]
    };

    const kpis = await financialKpiService.getFinancialKPIs('practice-1', '30d', now);

    expect(kpis.statusSummary).toEqual({
      paid: { count: 2, amount: 100 },
      pending: { count: 1, amount: 100 },
      overdue: { count: 1, amount: 15 },
      cancelled: { count: 1, amount: 25 }
    });
    expect(kpis.recentInvoices.map(i => i.invoiceNumber)).toEqual(['INV-A', 'INV-B', 'INV-C', 'INV-D', 'INV-E']);
    // Only paid invoices count as payments, most recently updated (i.e. marked paid) first
    expect(kpis.recentPaidInvoices.map(i => [i.invoiceNumber, i.amount, i.paymentMethod]))
      .toEqual([['INV-C', 60, 'card'], ['INV-B', 40, 'cash']]);
    expect(kpis.recentInvoices[0].patientName).toBe('Ndapewa Shilongo');
    // Names come only from the practice-scoped lookup; a patient it does not return gets a fallback label
    expect(kpis.recentInvoices[4].patientName).toBe('Unknown patient');
    expect(opsFor('patients')).toContainEqual(['eq', ['practice_id', 'practice-1']]);
  });

  it('keeps the invoice figures when the patient-name lookup fails', async () => {
    db.state.responses.invoices_enhanced = {
      error: null,
      data: [invoice({ id: 'a', invoice_number: 'INV-A', total: 100, patient_id: 'p1' })]
    };
    db.state.responses.patients = { data: null, error: { message: 'timeout' } };
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const kpis = await financialKpiService.getFinancialKPIs('practice-1', '30d', now);

    expect(kpis.totalOutstanding).toBe(100);
    expect(kpis.recentInvoices[0].patientName).toBe('Unknown patient');
  });
});

describe('getQuarterDateRange', () => {
  it('uses local calendar dates, so the quarter does not start on 30 Sep in UTC+2', () => {
    // Just after local midnight on 1 Oct: in UTC it is still 30 Sep
    expect(getQuarterDateRange(new Date(2026, 9, 1, 0, 30))).toEqual({ quarter: 4, startKey: '2026-10-01', endKey: '2026-12-31' });
    // Late on the last day of the quarter: in UTC-x zones toISOString() would already be 1 Jan
    expect(getQuarterDateRange(new Date(2026, 11, 31, 23, 30))).toEqual({ quarter: 4, startKey: '2026-10-01', endKey: '2026-12-31' });
    expect(getQuarterDateRange(new Date(2026, 2, 31, 12, 0))).toEqual({ quarter: 1, startKey: '2026-01-01', endKey: '2026-03-31' });
  });
});

describe('toPatientBillingItems', () => {
  it('uses the real invoice totals and statuses, excluding cancelled invoices from spend and balance', () => {
    const items = toPatientBillingItems([
      { id: '1', invoice_number: 'INV-1', issue_date: '2026-09-01', due_date: '2026-10-01', total: 450, payment_status: 'paid', payment_method: 'medical_aid' },
      { id: '2', invoice_number: 'INV-2', issue_date: null, created_at: '2026-09-15T10:00:00Z', due_date: '2026-10-15', total: '320.50', payment_status: null },
      { id: '3', invoice_number: 'INV-3', issue_date: '2026-09-20', due_date: '2026-10-20', total: 999, payment_status: 'cancelled' },
      { id: '4', invoice_number: 'INV-4', issue_date: '2026-08-01', due_date: '2026-09-01', total: 80, payment_status: 'overdue', notes: ' Follow-up ' }
    ]);

    expect(items.map(i => i.id)).toEqual(['1', '2', '4']);
    expect(items.reduce((sum, i) => sum + i.amount, 0)).toBe(850.5);
    // A missing status is still money owed
    expect(items.find(i => i.id === '2')).toMatchObject({ status: 'pending', amount: 320.5, date: '2026-09-15T10:00:00Z' });
    expect(items.find(i => i.id === '1')).toMatchObject({ status: 'paid', paymentMethod: 'medical_aid', invoiceNumber: 'INV-1', description: 'Visit invoice' });
    expect(items.find(i => i.id === '4')).toMatchObject({ status: 'overdue', description: 'Follow-up' });
  });

  it('returns no items (not demo data) when the patient has no invoices', () => {
    expect(toPatientBillingItems([])).toEqual([]);
    expect(toPatientBillingItems(undefined)).toEqual([]);
  });
});
