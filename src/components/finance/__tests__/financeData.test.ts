import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Thenable stand-in for the Supabase query builder: records every call per table and resolves with
// a canned response, a response computed from the request's ops, or never (a hung request).
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
    for (const method of ['select', 'eq', 'gte', 'lte', 'in', 'or', 'is', 'not', 'like', 'order', 'range']) {
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

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: (table: string) => db.makeBuilder(table) }
}));

import { FINANCE_SOURCE_TIMEOUT_MS, fetchInvoiceLineItems, loadFinanceWorkspace } from '../financeData';
import { EXCLUDE_CARRIER_VISITS } from '../../../utils/carrierVisits';

type Op = [string, unknown[]];
const callsFor = (table: string) => db.state.calls.filter(c => c.table === table);
const opsFor = (table: string) => callsFor(table).flatMap(c => c.ops);
const has = (ops: Op[], method: string) => ops.some(([m]) => m === method);

const request = {
  practiceId: 'practice-1',
  windowStartKey: '2025-11-01',
  lineItemRange: { startKey: '2026-10-01', endKey: '2026-10-31' }
};

const row = (overrides: Record<string, unknown>) => ({
  id: 'x',
  invoice_number: null,
  patient_id: null,
  practitioner_id: null,
  issue_date: '2026-10-02',
  due_date: '2026-11-01',
  total: '100',
  medical_aid_total: '0',
  patient_total: '100',
  payment_status: 'pending',
  ...overrides
});

describe('loadFinanceWorkspace', () => {
  beforeEach(() => {
    db.state.calls = [];
    db.state.responses = {};
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('scopes every query to the selected practice (no cross-practice data)', async () => {
    db.state.responses.invoices_enhanced = { data: [row({ id: 'a', patient_id: 'p1', practitioner_id: 'd1' })], error: null };

    await loadFinanceWorkspace(request);

    // issued in the window, unpaid of any age, and older invoices marked paid in the period
    expect(callsFor('invoices_enhanced')).toHaveLength(3);
    callsFor('invoices_enhanced').forEach(call => expect(call.ops).toContainEqual(['eq', ['practice_id', 'practice-1']]));
    // payslips have no practice_id; they are scoped through the employee's practice
    expect(opsFor('payslips')).toContainEqual(['eq', ['user.practice_id', 'practice-1']]);
    for (const table of ['practice_expenses', 'practice_inventory', 'patients', 'users', 'visits']) {
      expect(opsFor(table)).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    }
  });

  it('reads invoices marked paid in the period whatever their issue date, so old accounts paid today are in the takings', async () => {
    const paidToday = row({ id: 'old-paid', issue_date: '2024-02-01', payment_status: 'paid', updated_at: '2026-10-06T09:15:00Z' });
    db.state.responses.invoices_enhanced = ops => (ops.some(([m, args]) => m === 'gte' && args[0] === 'updated_at')
      ? { data: [paidToday], error: null }
      : { data: [], error: null });

    const workspace = await loadFinanceWorkspace(request);

    const paidQuery = callsFor('invoices_enhanced').find(c => c.ops.some(([m, args]) => m === 'eq' && args[0] === 'payment_status'))!;
    expect(paidQuery.ops).toContainEqual(['eq', ['payment_status', 'paid']]);
    // only invoices the window query cannot return (issued before it, or with no issue date)
    expect(paidQuery.ops).toContainEqual(['or', ['issue_date.is.null,issue_date.lt.2025-11-01']]);
    // the period's local calendar days, from midnight on the first day to the end of the last
    expect(paidQuery.ops).toContainEqual(['gte', ['updated_at', new Date(2026, 9, 1, 0, 0, 0, 0).toISOString()]]);
    expect(paidQuery.ops).toContainEqual(['lte', ['updated_at', new Date(2026, 9, 31, 23, 59, 59, 999).toISOString()]]);
    expect(workspace.invoices.rows.map(inv => inv.id)).toEqual(['old-paid']);
  });

  it('reads visits whose scheduled or visit date is in the period, so a rescheduled appointment is not missed', async () => {
    db.state.responses.visits = ops => (has(ops, 'like')
      // only the ids of visits whose note marks a missed appointment, never the notes themselves
      ? { data: [{ id: 'v3' }], error: null }
      : {
        data: [
          { id: 'v1', doctor_id: 'd2', scheduled_date: '2026-10-05', visit_date: '2026-09-29', status: 'completed' },
          { id: 'v2', doctor_id: null, scheduled_date: null, visit_date: '2026-10-02', status: 'no-show' },
          { id: 'v3', doctor_id: 'd2', scheduled_date: '2026-10-06', status: 'cancelled', is_cancelled: true },
          { id: 'v4', doctor_id: 'd2', scheduled_date: '2026-10-07', status: 'cancelled', is_cancelled: true }
        ],
        error: null
      });
    db.state.responses.users = { data: [{ id: 'd2', full_name: 'Dr. Maria Amupolo' }], error: null };

    const workspace = await loadFinanceWorkspace(request);

    const inPeriod = 'and(scheduled_date.gte.2026-10-01,scheduled_date.lte.2026-10-31),and(visit_date.gte.2026-10-01,visit_date.lte.2026-10-31)';
    callsFor('visits').forEach(call => expect(call.ops).toContainEqual(['or', [inPeriod]]));
    const noShowQuery = callsFor('visits').find(call => has(call.ops, 'like'))!;
    expect(noShowQuery.ops).toContainEqual(['select', ['id']]);
    // "[Cancelled: did not attend (no-show)]" with PostgREST's reserved characters matched by %
    expect(noShowQuery.ops).toContainEqual(['like', ['notes', '[Cancelled% did not attend %no-show%]%']]);
    // A payment plan instalment, a package sale or an opening balance hangs on a cancelled row that is not a visit: in
    // Appointments and attendance it would be a booking and a cancellation nobody made
    const periodQuery = callsFor('visits').find(call => !has(call.ops, 'like'))!;
    expect(periodQuery.ops).toContainEqual(['or', [EXCLUDE_CARRIER_VISITS]]);
    expect(workspace.visits.rows).toEqual([
      { id: 'v1', doctorId: 'd2', dateKey: '2026-10-05', stage: 'completed' },
      { id: 'v2', doctorId: null, dateKey: '2026-10-02', stage: 'no-show' },
      { id: 'v3', doctorId: 'd2', dateKey: '2026-10-06', stage: 'no-show' },
      { id: 'v4', doctorId: 'd2', dateKey: '2026-10-07', stage: 'cancelled' }
    ]);
    // a doctor who saw patients but billed nothing still gets a name in the productivity report
    expect(opsFor('users')).toContainEqual(['in', ['id', ['d2']]]);
    expect(workspace.doctorNames).toEqual({ d2: 'Dr. Maria Amupolo' });
  });

  it('reads the lines of the period payslips only, preferring payslip_items over the JSON details of older payslips', async () => {
    db.state.responses.payslips = ops => (has(ops, 'in')
      ? {
        data: [
          { id: 's1', earnings_details: [], deductions_details: [{ name: 'Old tax line', amount: 999 }] },
          { id: 's2', earnings_details: [{ name: 'SSC employer', amount: 99, isCompanyContribution: true }], deductions_details: [{ name: 'PAYE', amount: '450.50' }] }
        ],
        error: null
      }
      : {
        data: [
          { id: 's1', gross_earnings: '5000', net_pay: '4000', total_deductions: '1000', pay_period_start: '2026-10-01', status: 'paid' },
          { id: 's2', gross_earnings: '3000', net_pay: '2549.50', total_deductions: '450.50', pay_period_start: '2026-10-01', status: 'unpaid' },
          { id: 'sep', gross_earnings: '3000', net_pay: '3000', total_deductions: '0', pay_period_start: '2026-09-01', status: 'paid' }
        ],
        error: null
      });
    db.state.responses.payslip_items = { data: [{ payslip_id: 's1', component_name: 'Tax (PAYE)', type: 'deduction', amount: '1000' }], error: null };

    const workspace = await loadFinanceWorkspace(request);

    expect(opsFor('payslip_items')).toContainEqual(['in', ['payslip_id', ['s1', 's2']]]);
    expect(workspace.payslipLines).toEqual({
      rows: [
        { payslipId: 's1', name: 'Tax (PAYE)', type: 'deduction', amount: 1000 },
        { payslipId: 's2', name: 'SSC employer', type: 'company_contribution', amount: 99 },
        { payslipId: 's2', name: 'PAYE', type: 'deduction', amount: 450.5 }
      ],
      error: null
    });
  });

  it('reads the claim batch and visit date of unpaid medical aid invoices only, to place each claim', async () => {
    db.state.responses.invoices_enhanced = {
      data: [
        row({ id: 'aid', medical_aid_total: '80', batch_id: 'b1', visit_id: 'v1' }),
        row({ id: 'paid-aid', medical_aid_total: '80', batch_id: 'b9', visit_id: 'v9', payment_status: 'paid' }),
        row({ id: 'self-pay', medical_aid_total: '0', batch_id: null, visit_id: 'v8' })
      ],
      error: null
    };
    db.state.responses.batch_headers = ops => (has(ops, 'in')
      ? { data: [{ id: 'b1', status: 'sent', sent_at: '2026-09-02T08:00:00Z', medical_aid_reference: ' NHPM ', batch_number: 4 }], error: null }
      : { data: [], error: null });
    db.state.responses.visits = ops => (has(ops, 'in')
      ? { data: [{ id: 'v1', visit_date: '2026-06-01' }], error: null }
      : { data: [], error: null });

    const workspace = await loadFinanceWorkspace(request);

    expect(opsFor('batch_headers')).toContainEqual(['in', ['id', ['b1']]]);
    // The batch number too: the statement of outstanding claims names each batch by it
    expect(workspace.claimBatches).toEqual({ rows: [{ id: 'b1', status: 'sent', sentAt: '2026-09-02T08:00:00Z', fundReference: 'NHPM', batchNumber: 4 }], error: null });
    expect(opsFor('visits')).toContainEqual(['in', ['id', ['v1']]]);
    expect(workspace.serviceDateByVisit).toEqual({ v1: '2026-06-01' });
  });

  it('reads unpaid invoices without a date limit, because an old unpaid invoice is still owed', async () => {
    await loadFinanceWorkspace(request);

    const [windowQuery, unpaidQuery] = [
      callsFor('invoices_enhanced').find(c => has(c.ops, 'gte'))!,
      callsFor('invoices_enhanced').find(c => has(c.ops, 'or'))!
    ];
    expect(windowQuery.ops).toContainEqual(['gte', ['issue_date', '2025-11-01']]);
    expect(has(unpaidQuery.ops, 'gte')).toBe(false);
    expect(unpaidQuery.ops).toContainEqual(['or', ['payment_status.is.null,payment_status.not.in.(paid,cancelled)']]);
  });

  it('counts an unpaid invoice returned by both queries once', async () => {
    db.state.responses.invoices_enhanced = ops => has(ops, 'or')
      ? { data: [row({ id: 'a' }), row({ id: 'old', issue_date: '2023-01-10' })], error: null }
      : { data: [row({ id: 'a' }), row({ id: 'b', payment_status: 'paid' })], error: null };

    const workspace = await loadFinanceWorkspace(request);

    expect(workspace.invoices.rows.map(inv => inv.id).sort()).toEqual(['a', 'b', 'old']);
    expect(workspace.invoices.rows.find(inv => inv.id === 'a')?.total).toBe(100);
  });

  it('reads line items only for revenue invoices billed in the selected period', async () => {
    db.state.responses.invoices_enhanced = {
      data: [
        row({ id: 'oct' }),
        row({ id: 'void', payment_status: 'cancelled' }),
        row({ id: 'sept', issue_date: '2026-09-30' })
      ],
      error: null
    };
    db.state.responses.invoice_services = {
      data: [{ invoice_id: 'oct', code: '0190', description: 'Consultation', quantity: 1, unit_price: '100', total_price: '100', medical_aid_covered: '0', patient_portion: '100' }],
      error: null
    };

    const workspace = await loadFinanceWorkspace(request);

    expect(opsFor('invoice_services')).toContainEqual(['in', ['invoice_id', ['oct']]]);
    expect(workspace.lineItems.rows).toEqual([
      { invoiceId: 'oct', code: '0190', description: 'Consultation', quantity: 1, unitPrice: 100, total: 100, medicalAid: 0, patient: 100 }
    ]);
  });

  it('reports a payroll failure on payroll only, so the page shows "unavailable" rather than N$0', async () => {
    db.state.responses.invoices_enhanced = { data: [row({ id: 'a' })], error: null };
    db.state.responses.payslips = { data: null, error: { message: 'permission denied for table payslips' } };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const workspace = await loadFinanceWorkspace(request);

    expect(workspace.payslips.error).toMatch(/permission denied/);
    expect(workspace.payslips.rows).toEqual([]);
    expect(workspace.invoices.error).toBeNull();
    expect(workspace.invoices.rows).toHaveLength(1);
  });

  it('reports an invoice failure and does not query line items it cannot attribute', async () => {
    db.state.responses.invoices_enhanced = { data: null, error: { message: 'timeout' } };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const workspace = await loadFinanceWorkspace(request);

    expect(workspace.invoices.error).toMatch(/Failed to load (unpaid )?invoices: timeout/);
    expect(callsFor('invoice_services')).toHaveLength(0);
  });

  it('keeps the figures when a display lookup fails and records a warning', async () => {
    db.state.responses.invoices_enhanced = { data: [row({ id: 'a', patient_id: 'p1' })], error: null };
    db.state.responses.patients = { data: null, error: { message: 'boom' } };
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const workspace = await loadFinanceWorkspace(request);

    expect(workspace.patientNames).toEqual({});
    expect(workspace.lookupWarnings).toEqual(['Patient names could not be loaded (boom)']);
    expect(workspace.invoices.rows[0].total).toBe(100);
  });

  it('maps names, medical aids, payslips, expenses and inventory from real rows', async () => {
    db.state.responses.invoices_enhanced = { data: [row({ id: 'a', patient_id: 'p1', practitioner_id: 'd1' })], error: null };
    db.state.responses.patients = { data: [{ id: 'p1', first_name: 'Ndapewa', last_name: 'Shilongo' }], error: null };
    db.state.responses.users = { data: [{ id: 'd1', full_name: 'Dr. Jane Doe' }], error: null };
    db.state.responses.medical_aid_details = { data: [{ patient_id: 'p1', provider: 'NAMMED' }], error: null };
    db.state.responses.payslips = { data: [{ id: 's1', gross_earnings: '5000', net_pay: '4000', total_deductions: '1000', pay_period_start: '2026-10-01', status: 'paid', user: { full_name: 'Anna' } }], error: null };
    db.state.responses.practice_expenses = { data: [{ id: 'e1', name: 'Rent', expense_type: 'rent', amount: '7500', expense_date: '2026-10-01', status: 'Paid' }], error: null };
    db.state.responses.practice_inventory = { data: [{ id: 'i1', practice_id: 'practice-1', name: 'Laptop', category: 'equipment', quantity: 1, unit_cost: '12000', total_value: '12000' }], error: null };
    db.state.responses.stock_item_levels = { data: [{ item_id: 'i1', on_hand: 1, value: '12000.00' }], error: null };

    const workspace = await loadFinanceWorkspace(request);

    expect(workspace.patientNames).toEqual({ p1: 'Ndapewa Shilongo' });
    expect(workspace.doctorNames).toEqual({ d1: 'Dr. Jane Doe' });
    expect(workspace.schemeByPatient).toEqual({ p1: 'NAMMED' });
    expect(workspace.payslips.rows[0]).toMatchObject({ employeeName: 'Anna', gross: 5000, status: 'paid' });
    expect(workspace.expenses.rows[0]).toMatchObject({ amount: 7500, status: 'paid' });
    expect(workspace.inventory).toMatchObject({ source: 'stock_ledger', error: null });
    expect(workspace.inventory.rows[0]).toMatchObject({ quantity: 1, ledgerValue: 12000, category: 'equipment' });
  });

  // Stock > Reports values stock from the stock ledger; Finance read the old list's copied quantities and a rounded unit
  // cost, so the two pages could show different stock values. Finance now reads the same ledger, and only falls back to
  // the old list on a database without the stock update.
  it('values stock from Stock\'s own ledger (on hand and value per item), as Stock > Reports does', async () => {
    db.state.responses.practice_inventory = { data: [{ id: 'i1', practice_id: 'practice-1', name: 'Amoxicillin', category: 'medications', quantity: 50, unit_cost: '33.33' }], error: null };
    db.state.responses.stock_item_levels = { data: [{ item_id: 'i1', on_hand: 3, value: '100.00' }], error: null };

    const workspace = await loadFinanceWorkspace(request);

    expect(opsFor('stock_item_levels')).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    expect(workspace.inventory.rows[0]).toMatchObject({ quantity: 3, ledgerValue: 100 });
  });

  it('before the stock update, still values the old inventory list instead of showing an error', async () => {
    db.state.responses.practice_inventory = ops => (ops.some(([m, args]) => m === 'select' && String(args[0]).includes('nappi_code'))
      ? { data: null, error: { code: '42703', message: 'column practice_inventory.nappi_code does not exist' } }
      : { data: [{ id: 'i1', name: 'Laptop', category: 'equipment', quantity: 1, unit_cost: '12000', total_value: '12000' }], error: null });

    const workspace = await loadFinanceWorkspace(request);

    expect(workspace.inventory).toMatchObject({ source: 'inventory_list', error: null });
    expect(workspace.inventory.rows[0]).toMatchObject({ unitCost: 12000, category: 'equipment' });
  });

  it('times out a hung source without blocking the rest of the page', async () => {
    vi.useFakeTimers();
    db.state.responses.invoices_enhanced = { data: [row({ id: 'a' })], error: null };
    db.state.responses.practice_inventory = 'hang';
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const pending = loadFinanceWorkspace(request);
    await vi.advanceTimersByTimeAsync(FINANCE_SOURCE_TIMEOUT_MS);
    const workspace = await pending;

    expect(workspace.inventory.error).toMatch(/took too long/);
    expect(workspace.invoices.rows).toHaveLength(1);
  });
});

describe('fetchInvoiceLineItems', () => {
  beforeEach(() => {
    db.state.calls = [];
    db.state.responses = {};
  });

  it('returns the normalised lines of one invoice', async () => {
    db.state.responses.invoice_services = {
      data: [{ invoice_id: 'inv-1', code: '0190', total_price: '350', medical_aid_covered: '350', quantity: 1, unit_price: '350' }],
      error: null
    };

    const lines = await fetchInvoiceLineItems('inv-1');

    expect(opsFor('invoice_services')).toContainEqual(['eq', ['invoice_id', 'inv-1']]);
    expect(lines).toEqual([{ invoiceId: 'inv-1', code: '0190', description: '', quantity: 1, unitPrice: 350, total: 350, medicalAid: 350, patient: 0 }]);
  });

  it('throws with the database message so the drill-down can show it', async () => {
    db.state.responses.invoice_services = { data: null, error: { message: 'relation does not exist' } };

    await expect(fetchInvoiceLineItems('inv-1')).rejects.toThrow(/relation does not exist/);
  });
});
