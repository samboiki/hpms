/** The report tables behind Finance > Reports: what each shows, its basis, and how it behaves when data is missing */
import { describe, it, expect } from 'vitest';
import {
  normalizeExpense,
  normalizeInventoryItem,
  normalizeInvoice,
  normalizePayslip,
  normalizeVisit,
  type LedgerPayslipLine,
  type RawInvoiceRow
} from '../../../services/ledgerService';
import { deriveFinance, type FinanceContext } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { buildReport, type ReportId } from '../reports';

const context: FinanceContext = {
  ranges: {
    preset: 'this_month',
    current: { startKey: '2026-10-01', endKey: '2026-10-06' },
    previous: { startKey: '2026-09-01', endKey: '2026-09-06' }
  },
  todayKey: '2026-10-06',
  trendMonths: ['2026-09', '2026-10']
};

const labels: PeriodLabels = { ranges: context.ranges, current: '1–6 Oct 2026', previous: '1–6 Sep 2026', today: '6 Oct 2026', todayKey: '2026-10-06' };

/** updated_at for a local time on a day, as Supabase returns it */
const at = (dateKey: string, time = '10:00') => new Date(`${dateKey}T${time}:00`).toISOString();

const inv = (row: Partial<RawInvoiceRow> & { id: string }) => normalizeInvoice({
  total: 100, medical_aid_total: 0, payment_status: 'pending', issue_date: '2026-10-02', due_date: '2026-11-01', ...row
});

const payslipLines: LedgerPayslipLine[] = [
  { payslipId: 's1', name: 'Basic Salary', type: 'earning', amount: 12000 },
  { payslipId: 's1', name: 'Tax (PAYE)', type: 'deduction', amount: 1500 },
  { payslipId: 's1', name: 'Social Security (SSC)', type: 'deduction', amount: 99 },
  { payslipId: 's1', name: 'Social Security (employer)', type: 'company_contribution', amount: 99 },
  { payslipId: 's2', name: 'PAYE', type: 'deduction', amount: 300 },
  { payslipId: 's2', name: 'SSC', type: 'deduction', amount: 45 }
];

function workspace(overrides: Partial<FinanceWorkspace> = {}): FinanceWorkspace {
  return {
    practiceId: 'p',
    requestKey: 'p|2025-11-01|2026-10-01|2026-10-06',
    invoices: {
      rows: [
        inv({ id: 'cash', invoice_number: 'C', total: 150, payment_status: 'paid', payment_method: 'cash', practitioner_id: 'd1', visit_id: 'v1', updated_at: at('2026-10-02') }),
        inv({ id: 'aid', invoice_number: 'A', total: 1000, medical_aid_total: 800, patient_id: 'pt1', practitioner_id: 'd1', visit_id: 'v2', batch_id: 'b1' }),
        inv({ id: 'void', invoice_number: 'V', total: 500, payment_status: 'cancelled', practitioner_id: 'd1', updated_at: at('2026-10-03') })
      ],
      error: null
    },
    lineItems: { rows: [], error: null },
    payslips: {
      rows: [
        normalizePayslip({ id: 's1', user_id: 'u1', gross_earnings: 12000, total_deductions: 1599, net_pay: 10401, pay_period_start: '2026-10-01', status: 'unpaid' }),
        normalizePayslip({ id: 's2', user_id: 'u2', gross_earnings: 4000, total_deductions: 345, net_pay: 3655, pay_period_start: '2026-10-01', status: 'unpaid' })
      ],
      error: null
    },
    expenses: { rows: [normalizeExpense({ id: 'e1', amount: 7500, expense_date: '2026-10-03', status: 'paid', expense_type: 'rent' })], error: null },
    inventory: { rows: [normalizeInventoryItem({ id: 'i1', name: 'Laptop', category: 'equipment', quantity: 1, unit_cost: 12000 })], error: null },
    claims: { count: 0, amount: 0, error: null },
    visits: {
      rows: [
        normalizeVisit({ id: 'v1', doctor_id: 'd1', scheduled_date: '2026-10-02', status: 'completed' }),
        normalizeVisit({ id: 'v2', doctor_id: 'd2', scheduled_date: '2026-10-03', status: 'completed' }),
        normalizeVisit({ id: 'v3', doctor_id: 'd1', scheduled_date: '2026-10-04', status: 'no-show' }),
        normalizeVisit({ id: 'v4', doctor_id: 'd1', scheduled_date: '2026-10-05', status: 'scheduled', is_cancelled: true })
      ],
      error: null
    },
    payslipLines: { rows: payslipLines, error: null },
    claimBatches: { rows: [{ id: 'b1', status: 'active', sentAt: null, fundReference: 'NHPM' }], error: null },
    patientNames: { pt1: 'Ndapewa Shilongo' },
    doctorNames: { d1: 'Dr. Jane Doe', d2: 'Maria Amupolo' },
    schemeByPatient: { pt1: 'Namibia Health Plan' },
    serviceDateByVisit: { v2: '2026-10-03' },
    lookupWarnings: [],
    loadedAt: '2026-10-06T08:00:00Z',
    ...overrides
  };
}

const build = (id: ReportId, ws: FinanceWorkspace = workspace()) => buildReport(id, deriveFinance(ws, context), ws, labels);
const column = (report: { columns: { header: string }[] }, header: string) => report.columns.findIndex(c => c.header === header);

const ALL_REPORTS: ReportId[] = [
  'daily_takings', 'collections', 'ar_aging', 'fund_debtors', 'revenue_by_tariff', 'payer_mix', 'doctor_productivity',
  'attendance', 'payroll_vs_revenue', 'statutory_payroll', 'expenses_by_category', 'inventory_valuation'
];

const EMPTY: Partial<FinanceWorkspace> = {
  invoices: { rows: [], error: null },
  payslips: { rows: [], error: null },
  expenses: { rows: [], error: null },
  inventory: { rows: [], error: null },
  visits: { rows: [], error: null },
  payslipLines: { rows: [], error: null },
  claimBatches: { rows: [], error: null }
};

describe('every report', () => {
  it.each(ALL_REPORTS)('%s states its basis (period or as-at date and source)', id => {
    const { report } = build(id);
    expect(report?.basis).toMatch(/1–6 Oct 2026|6 Oct 2026|Sep 2026/);
  });

  // an empty period must reach the preview's empty state, not a table of zeros
  it.each(['daily_takings', 'fund_debtors', 'doctor_productivity', 'attendance', 'statutory_payroll', 'expenses_by_category', 'inventory_valuation'] as ReportId[])(
    '%s has no rows when there is nothing in the period',
    id => {
      expect(build(id, workspace(EMPTY)).report?.rows).toEqual([]);
    }
  );
});

describe('daily takings report', () => {
  it('says it follows the time invoices were marked paid, and lists the till first', () => {
    const report = build('daily_takings').report!;
    expect(report.basis).toBe('Invoices marked paid 1–6 Oct 2026, by the time they were marked paid');
    expect(report.columns.map(c => c.header)).toEqual(['Day', 'Cash', 'Card', 'EFT', 'Medical aid', 'Other', 'Not recorded', 'Day total', 'Invoices']);
    // the cancelled invoice updated on 3 Oct is not money taken
    expect(report.rows).toEqual([['2026-10-02', 150, 0, 0, 0, 0, 0, 150, 1]]);
    expect(report.totals).toEqual(['Total', 150, 0, 0, 0, 0, 0, 150, 1]);
  });
});

describe('debtors by medical aid fund report', () => {
  it('shows each fund\'s claims by state, adding up to what medical aids owe in the aging report', () => {
    const ws = workspace();
    const derived = deriveFinance(ws, context);
    const report = buildReport('fund_debtors', derived, ws, labels).report!;
    expect(report.rows).toEqual([['Namibia Health Plan', 1, 0, 800, 0, 0, 800, '4 months']]);
    expect(report.totals?.[column(report, 'Owed by fund')]).toBe(derived.aging.medicalAid);
  });

  it('is unavailable rather than showing every claim as unsent when the claim batches could not be loaded', () => {
    const result = build('fund_debtors', workspace({ claimBatches: { rows: [], error: 'timeout' } }));
    expect(result.report).toBeUndefined();
    expect(result.unavailable).toMatch(/claim batches/);
  });
});

describe('doctor productivity report', () => {
  it('credits each invoice to the doctor on its visit and shows each name with one "Dr." prefix', () => {
    const report = build('doctor_productivity').report!;
    expect(report.rows).toEqual([
      ['Dr. Maria Amupolo', 1, 1, 1000, 0, 1000, 0],
      ['Dr. Jane Doe', 1, 1, 150, 150, 150, 1]
    ]);
    expect(report.totals).toEqual(['Total', 2, 2, 1150, 150, 575, 150 / 1150]);
  });

  it('labels work without a doctor instead of dropping it', () => {
    const ws = workspace({ invoices: { rows: [inv({ id: 'x', total: 80, practitioner_id: null })], error: null }, visits: { rows: [], error: null } });
    expect(build('doctor_productivity', ws).report?.rows[0][0]).toBe('No doctor recorded');
  });

  it('is unavailable (not zero visits) when visits could not be loaded', () => {
    expect(build('doctor_productivity', workspace({ visits: { rows: [], error: 'permission denied' } })).unavailable).toMatch(/Visits could not be loaded/);
  });
});

describe('appointments and attendance report', () => {
  it('counts the month\'s bookings by outcome, with no-show and cancellation rates of all bookings', () => {
    const report = build('attendance').report!;
    expect(report.basis).toBe('Visits dated 1–6 Oct 2026; cancelled visits noted "did not attend" count as no-shows');
    expect(report.rows).toEqual([['October 2026', 4, 2, 1, 1, 0, 0.25, 0.25]]);
    expect(report.totals).toEqual(['Total', 4, 2, 1, 1, 0, 0.25, 0.25]);
  });

  it('reports a missed appointment saved as a cancellation with a no-show note as a no-show', () => {
    const missed = normalizeVisit({ id: 'v9', doctor_id: 'd1', scheduled_date: '2026-10-05', status: 'cancelled', is_cancelled: true }, new Set(['v9']));
    const ws = workspace({ visits: { rows: [missed], error: null } });
    expect(build('attendance', ws).report?.rows).toEqual([['October 2026', 1, 0, 1, 0, 0, 1, 0]]);
    expect(build('attendance', ws).report?.notes?.join(' ')).toMatch(/\[Cancelled: did not attend \(no-show\)\].*count as no-shows/);
  });
});

describe('PAYE, Social Security and pension report', () => {
  it('totals PAYE and both Social Security shares per month and says it is not the return itself', () => {
    const report = build('statutory_payroll').report!;
    const row = report.rows[0];
    expect(row[column(report, 'Gross pay')]).toBe(16000);
    expect(row[column(report, 'PAYE')]).toBe(1800);
    expect(row[column(report, 'SSC (employee)')]).toBe(144);
    expect(row[column(report, 'SSC (employer)')]).toBe(99);
    expect(row[column(report, 'Net pay')]).toBe(14056);
    expect(report.notes?.join(' ')).toMatch(/NamRA PAYE return.*Social Security Commission return.*not the return itself/);
    // s2 is an older payslip with no employer line: the shortfall is pointed out before filing
    expect(report.notes?.join(' ')).toMatch(/employer's Social Security share is lower/);
  });

  it('is unavailable when the payslip lines could not be loaded, so PAYE is never shown as N$0', () => {
    expect(build('statutory_payroll', workspace({ payslipLines: { rows: [], error: 'timeout' } })).unavailable).toMatch(/Payslip lines could not be loaded/);
  });
});

describe('expenses by category report', () => {
  it('has a column per month of the period and a category per expense type', () => {
    const report = build('expenses_by_category').report!;
    expect(report.columns.map(c => c.header)).toEqual(['Category', 'Oct 2026', 'Total', 'Share']);
    expect(report.rows).toEqual([['Rent & lease', 7500, 7500, 1]]);
  });

  it('is unavailable when expenses could not be loaded', () => {
    expect(build('expenses_by_category', workspace({ expenses: { rows: [], error: 'x' } })).unavailable).toBeTruthy();
  });
});

describe('stock and equipment valuation report', () => {
  it('values stock per category at cost, matching the inventory ledger total', () => {
    const ws = workspace();
    const derived = deriveFinance(ws, context);
    const report = buildReport('inventory_valuation', derived, ws, labels).report!;
    expect(report.rows).toEqual([['Equipment', 1, 0, 0, 12000, 1]]);
    expect(report.totals?.[column(report, 'Value at cost')]).toBe(derived.inventory?.total);
  });

  it('is unavailable when inventory could not be loaded', () => {
    expect(build('inventory_valuation', workspace({ inventory: { rows: [], error: 'x' } })).unavailable).toMatch(/Inventory could not be loaded/);
  });
});
