/**
 * Finance > Reports' older report cards now open their records from every row, as the newer reports do: a day of
 * takings its payments, a payment method its payments, an unpaid invoice itself, a fund its unpaid invoices, a tariff
 * code the invoices carrying it, a practitioner their invoices, a month its appointments or payslips, an expense
 * category its expenses, a stock category its items. The list behind a row must be exactly what makes up its figure,
 * or staff would be shown records that do not add up to the number they clicked. Invented data only.
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeExpense,
  normalizeInventoryItem,
  normalizeInvoice,
  normalizeLineItem,
  normalizePayslip,
  normalizeVisit,
  type ArAdjustment,
  type ArReceipt,
  type RawInvoiceRow
} from '../../../services/ledgerService';
import { deriveFinance, type FinanceContext } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { buildReport, type ReportId } from '../reports';
import type { RecordItem, ReportTarget } from '../practiceReports/reportTargets';

const context: FinanceContext = {
  ranges: { preset: 'this_month', current: { startKey: '2026-10-01', endKey: '2026-10-06' }, previous: { startKey: '2026-09-01', endKey: '2026-09-06' } },
  todayKey: '2026-10-06',
  trendMonths: ['2026-09', '2026-10']
};
const labels: PeriodLabels = { ranges: context.ranges, current: '1–6 Oct 2026', previous: '1–6 Sep 2026', today: '6 Oct 2026', todayKey: '2026-10-06' };

const at = (dateKey: string, time = '10:00') => new Date(`${dateKey}T${time}:00`).toISOString();
const inv = (row: Partial<RawInvoiceRow> & { id: string }) => normalizeInvoice({
  total: 100, medical_aid_total: 0, payment_status: 'pending', issue_date: '2026-10-02', due_date: '2026-11-01', ...row
});
const receipt = (overrides: Partial<ArReceipt> & Pick<ArReceipt, 'id' | 'amountCents' | 'receivedOn'>): ArReceipt => ({
  number: `RC-${overrides.id}`, payerType: 'patient', patientId: 'pt1', fundName: null, payerName: null, method: 'cash', reference: null,
  source: 'manual', notes: null, createdBy: 'u1', createdAt: `${overrides.receivedOn}T08:00:00Z`, reversal: null, allocatedCents: 0,
  refundedCents: 0, unallocatedCents: 0, ...overrides
});
const refund = (overrides: Partial<ArAdjustment> & Pick<ArAdjustment, 'id' | 'amountCents' | 'effectiveOn'>): ArAdjustment => ({
  number: `RF-${overrides.id}`, kind: 'refund', invoiceId: null, receiptId: 'r1', patientId: 'pt1', portion: null, method: 'cash', reasonCode: null,
  reason: 'Overpaid', approvedBy: 'u1', createdBy: 'u1', createdAt: `${overrides.effectiveOn}T12:00:00Z`, reversal: null, ...overrides
});

function workspace(overrides: Partial<FinanceWorkspace> = {}): FinanceWorkspace {
  return {
    practiceId: 'p',
    requestKey: 'p|2025-11-01|2026-10-01|2026-10-06',
    invoices: {
      rows: [
        inv({ id: 'cash', invoice_number: 'C', total: 150, payment_status: 'paid', payment_method: 'cash', practitioner_id: 'd1', visit_id: 'v1', updated_at: at('2026-10-02') }),
        // Made by d1 but on d2's visit: it counts for d2
        inv({ id: 'aid', invoice_number: 'A', total: 1000, medical_aid_total: 800, patient_id: 'pt1', practitioner_id: 'd1', visit_id: 'v2', batch_id: 'b1' }),
        inv({ id: 'card', invoice_number: 'K', total: 240, patient_id: 'pt2', payment_status: 'paid', payment_method: 'card', practitioner_id: 'd1', updated_at: at('2026-10-04') }),
        inv({ id: 'void', invoice_number: 'V', total: 500, payment_status: 'cancelled', practitioner_id: 'd1', updated_at: at('2026-10-03') })
      ],
      error: null
    },
    lineItems: {
      rows: [
        { invoice_id: 'cash', code: '0190', description: 'Consultation', quantity: 1, unit_price: 150, total_price: 150, medical_aid_covered: 0 },
        { invoice_id: 'aid', code: '0190', description: 'Consultation', quantity: 1, unit_price: 600, total_price: 600, medical_aid_covered: 600 },
        { invoice_id: 'aid', code: '', description: 'Dressing', quantity: 2, unit_price: 200, total_price: 400, medical_aid_covered: 200 },
        { invoice_id: 'void', code: '0190', description: 'Consultation', quantity: 1, unit_price: 500, total_price: 500, medical_aid_covered: 0 }
      ].map(row => normalizeLineItem(row)!),
      error: null
    },
    payslips: {
      rows: [
        normalizePayslip({ id: 's1', user_id: 'u1', gross_earnings: 12000, total_deductions: 1599, net_pay: 10401, pay_period_start: '2026-10-01', status: 'unpaid', user: { full_name: 'Anna Example' } }),
        normalizePayslip({ id: 's2', user_id: 'u2', gross_earnings: 4000, total_deductions: 345, net_pay: 3655, pay_period_start: '2026-10-01', status: 'unpaid', user: { full_name: 'Ben Example' } }),
        normalizePayslip({ id: 's3', user_id: 'u3', gross_earnings: 9999, total_deductions: 0, net_pay: 9999, pay_period_start: '2026-10-01', status: 'cancelled' })
      ],
      error: null
    },
    expenses: {
      rows: [
        normalizeExpense({ id: 'e1', name: 'October rent', amount: 7500, expense_date: '2026-10-03', status: 'paid', expense_type: 'rent' }),
        normalizeExpense({ id: 'e2', name: 'Water', amount: 300, expense_date: '2026-10-04', status: 'pending', expense_type: 'utilities' }),
        normalizeExpense({ id: 'e3', name: 'Cancelled lease', amount: 999, expense_date: '2026-10-04', status: 'cancelled', expense_type: 'rent' })
      ],
      error: null
    },
    inventory: {
      rows: [
        { ...normalizeInventoryItem({ id: 'i1', name: 'Laptop', category: 'equipment', quantity: 1, unit_cost: 12000 }), ledgerValue: 12000 },
        { ...normalizeInventoryItem({ id: 'i2', name: 'Gloves', category: 'disposables', quantity: 3, unit_cost: 33.33 }), ledgerValue: 100 }
      ],
      error: null,
      source: 'stock_ledger'
    },
    visits: {
      rows: [
        normalizeVisit({ id: 'v1', doctor_id: 'd1', scheduled_date: '2026-10-02', status: 'completed' }),
        normalizeVisit({ id: 'v2', doctor_id: 'd2', scheduled_date: '2026-10-03', status: 'completed' }),
        normalizeVisit({ id: 'v3', doctor_id: 'd3', scheduled_date: '2026-10-04', status: 'completed' })
      ],
      error: null
    },
    payslipLines: { rows: [], error: null },
    claimBatches: { rows: [{ id: 'b1', status: 'active', sentAt: null, fundReference: 'NHPM' }], error: null },
    patientNames: { pt1: 'Ndapewa Example', pt2: 'Tomas Example' },
    doctorNames: { d1: 'Jane Practitioner', d2: 'Maria Practitioner', d3: 'Peter Practitioner' },
    schemeByPatient: { pt1: 'Namibia Health Plan' },
    serviceDateByVisit: { v2: '2026-10-03' },
    lookupWarnings: [],
    loadedAt: '2026-10-06T08:00:00Z',
    ...overrides
  };
}

const withReceipts = (): FinanceWorkspace => workspace({
  ar: {
    state: 'ready',
    error: null,
    receipts: [
      receipt({ id: 'r1', amountCents: 50000, receivedOn: '2026-10-02' }),
      receipt({ id: 'r2', amountCents: 20000, receivedOn: '2026-10-02', method: 'card' }),
      // Captured twice and reversed: never money taken
      receipt({ id: 'r3', amountCents: 9900, receivedOn: '2026-10-02', reversal: { at: '2026-10-02T09:00:00Z', by: 'u1', reason: 'Twice' } }),
      receipt({ id: 'r4', amountCents: 80000, receivedOn: '2026-10-05', method: 'eft', payerType: 'medical_aid', fundName: 'Namibia Health Plan', patientId: null })
    ],
    refunds: [refund({ id: 'f1', amountCents: 5000, effectiveOn: '2026-10-02' })],
    balances: {}
  } as unknown as FinanceWorkspace['ar']
});

const build = (id: ReportId, ws: FinanceWorkspace) => buildReport(id, deriveFinance(ws, context), ws, labels);
const records = (target: ReportTarget | null | undefined): RecordItem[] => (target && target.kind === 'records' ? target.items : []);
const total = (items: RecordItem[]) => Math.round(items.reduce((sum, item) => sum + (item.amount ?? 0), 0) * 100) / 100;
const cell = (id: ReportId, ws: FinanceWorkspace, header: string, row: number) => {
  const { report } = build(id, ws);
  return report!.rows[row][report!.columns.findIndex(column => column.header === header)];
};

const REPORTS_WITH_ROWS: ReportId[] = [
  'daily_takings', 'collections', 'ar_aging', 'fund_debtors', 'revenue_by_tariff', 'payer_mix', 'doctor_productivity',
  'attendance', 'payroll_vs_revenue', 'statutory_payroll', 'expenses_by_category', 'inventory_valuation'
];

describe('every row of the older reports opens what it counts', () => {
  it.each(REPORTS_WITH_ROWS)('%s gives every row a target, in the rows\' order', id => {
    for (const ws of [workspace(), withReceipts()]) {
      const result = build(id, ws);
      expect(result.targets).toHaveLength(result.report!.rows.length);
      expect(result.targets!.some(Boolean)).toBe(result.report!.rows.length > 0);
    }
  });

  // The Reports grid builds every report for its cards: what the rows open is worked out only for a previewed report,
  // so a long period's grid does not pay for fourteen lists nobody opened
  it('works out what rows open only when asked (the cards ask for the tables alone)', () => {
    const ws = withReceipts();
    for (const id of REPORTS_WITH_ROWS) {
      const tableOnly = buildReport(id, deriveFinance(ws, context), ws, labels, undefined, { targets: false });
      expect(tableOnly.targets).toBeUndefined();
      expect(tableOnly.report).toEqual(build(id, ws).report);
    }
  });

  it('a day of takings opens the payments that came in that day and the refunds paid out; they add up to the day total', () => {
    const ws = withReceipts();
    const { report, targets } = build('daily_takings', ws);
    const day = report!.rows.findIndex(row => row[0] === '2026-10-02');
    const items = records(targets![day]);
    expect(items.map(item => item.title)).toEqual(['Receipt RC-r1', 'Receipt RC-r2', 'Refund RF-f1']);
    expect(total(items)).toBe(cell('daily_takings', ws, 'Day total', day));
    // The refund opens the receipt it paid back
    expect(items[2].target).toEqual({ kind: 'receipt', id: 'r1' });
  });

  it('before receipts, a day of takings opens the invoices marked paid that day', () => {
    const { report, targets } = build('daily_takings', workspace());
    const day = report!.rows.findIndex(row => row[0] === '2026-10-04');
    expect(records(targets![day]).map(item => item.target)).toEqual([{ kind: 'invoice', id: 'card' }]);
  });

  it('a payment method opens its payments of the period, adding up to the method\'s amount', () => {
    const ws = withReceipts();
    const { report, targets } = build('collections', ws);
    report!.rows.forEach((row, index) => expect(total(records(targets![index]))).toBe(row[2]));
    const eft = report!.rows.findIndex(row => row[0] === 'EFT');
    expect(records(targets![eft]).map(item => item.target)).toEqual([{ kind: 'receipt', id: 'r4' }]);
  });

  it('an unpaid invoice row opens that invoice', () => {
    const { report, targets } = build('ar_aging', workspace());
    expect(report!.rows.map(row => row[0])).toEqual(['A']);
    expect(targets).toEqual([{ kind: 'invoice', id: 'aid' }]);
  });

  it('a fund opens its unpaid invoices with what it still owes on each', () => {
    const ws = workspace();
    const { report, targets } = build('fund_debtors', ws);
    const items = records(targets![0]);
    expect(report!.rows[0][0]).toBe('Namibia Health Plan');
    expect(items.map(item => item.target)).toEqual([{ kind: 'invoice', id: 'aid' }]);
    expect(total(items)).toBe(cell('fund_debtors', ws, 'Owed by fund', 0));
  });

  it('a tariff code opens the invoices that carry it (cancelled left out), with the code\'s revenue on each', () => {
    const ws = workspace();
    const { report, targets } = build('revenue_by_tariff', ws);
    report!.rows.forEach((row, index) => expect(total(records(targets![index]))).toBe(row[report!.columns.findIndex(c => c.header === 'Revenue')]));
    const consult = report!.rows.findIndex(row => row[0] === '0190');
    // By invoice date, then number
    expect(records(targets![consult]).map(item => item.title)).toEqual(['Invoice A', 'Invoice C']);
    // A line without a code is grouped by its description, and opens the same way
    const dressing = report!.rows.findIndex(row => row[1] === 'Dressing');
    expect(records(targets![dressing]).map(item => item.title)).toEqual(['Invoice A']);
  });

  it('each payer opens the invoices it was billed, with its portion of each', () => {
    const ws = workspace();
    const { report, targets } = build('payer_mix', ws);
    report!.rows.forEach((row, index) => expect(total(records(targets![index]))).toBe(row[2]));
  });

  it('a practitioner opens the invoices that count for them: the practitioner on the visit, not whoever made the invoice', () => {
    const ws = workspace();
    const { report, targets } = build('doctor_productivity', ws);
    const rowOf = (name: string) => report!.rows.findIndex(row => row[0] === name);
    expect(records(targets![rowOf('Maria Practitioner')]).map(item => item.title)).toEqual(['Invoice A']);
    expect(records(targets![rowOf('Jane Practitioner')]).map(item => item.title)).toEqual(['Invoice C', 'Invoice K']);
    report!.rows.forEach((row, index) => {
      const items = records(targets![index]);
      if (items.length > 0) expect(total(items)).toBe(row[3]);
    });
    // Peter only completed a visit: his row opens that visit
    expect(targets![rowOf('Peter Practitioner')]).toEqual({ kind: 'visits', ids: ['v3'], label: 'visits completed by Peter Practitioner' });
  });

  it('a month of appointments opens those visits in Encounters', () => {
    const { targets } = build('attendance', workspace());
    expect(targets![0]).toMatchObject({ kind: 'visits', ids: ['v1', 'v2', 'v3'] });
  });

  it('a payroll month opens its payslips (cancelled left out), each opening Settings > Users on Payroll', () => {
    const ws = workspace();
    for (const id of ['statutory_payroll', 'payroll_vs_revenue'] as const) {
      const { report, targets } = build(id, ws);
      const october = report!.rows.findIndex(row => String(row[0]).startsWith('October'));
      const items = records(targets![october]);
      expect(items.map(item => item.title)).toEqual(['Anna Example', 'Ben Example']);
      expect(items[0].target).toEqual({ kind: 'link', href: '/settings?tab=users&section=payroll' });
      expect(total(items)).toBe(16000);
    }
  });

  it('an expense category opens its expenses of the period (cancelled left out)', () => {
    const ws = workspace();
    const { report, targets } = build('expenses_by_category', ws);
    const rent = report!.rows.findIndex(row => row[0] === 'Rent & lease');
    expect(records(targets![rent]).map(item => item.title)).toEqual(['October rent']);
    expect(total(records(targets![rent]))).toBe(cell('expenses_by_category', ws, 'Total', rent));
  });

  it('a stock category opens its items, each on the Stock page with its history, at the ledger\'s value', () => {
    const ws = workspace();
    const { report, targets } = build('inventory_valuation', ws);
    const disposables = report!.rows.findIndex(row => row[0] === 'Disposables');
    const items = records(targets![disposables]);
    expect(items).toMatchObject([{ title: 'Gloves', amount: 100, target: { kind: 'link', href: '/stock?tab=items&item=i2' } }]);
    expect(total(items)).toBe(cell('inventory_valuation', ws, 'Value at cost', disposables));
  });
});
