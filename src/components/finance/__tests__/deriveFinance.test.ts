import { describe, it, expect } from 'vitest';
import { normalizeInvoice, normalizePayslip, normalizeExpense, normalizeInventoryItem, type ArInvoiceBalance, type LedgerInvoice, type RawInvoiceRow } from '../../../services/ledgerService';
import { deriveFinance, type FinanceContext } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { buildReport } from '../reports';

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

const inv = (row: Partial<RawInvoiceRow> & { id: string }) => normalizeInvoice({
  total: 100, medical_aid_total: 0, payment_status: 'pending', issue_date: '2026-10-02', due_date: '2026-11-01', ...row
});

function workspace(overrides: Partial<FinanceWorkspace> = {}): FinanceWorkspace {
  return {
    practiceId: 'p',
    requestKey: 'p|2025-11-01|2026-10-01|2026-10-06',
    invoices: {
      rows: [
        inv({ id: 'a', invoice_number: 'A', total: 300, medical_aid_total: 300, patient_id: 'pt1' }),
        inv({ id: 'b', invoice_number: 'B', total: 100, payment_status: 'paid', payment_method: 'cash' }),
        inv({ id: 'c', invoice_number: 'C', total: 50, payment_status: 'cancelled' }),
        inv({ id: 'sep', invoice_number: 'S', total: 200, issue_date: '2026-09-03', payment_status: 'paid' }),
        // 'submitted' is not a payment status HPMS knows ('partial' is: receipts set it), so it counts as unrecognised and unpaid
        inv({ id: 'old', invoice_number: 'O', total: 80, issue_date: '2026-05-01', due_date: '2026-05-31', payment_status: 'submitted', patient_id: 'pt2' })
      ],
      error: null
    },
    lineItems: { rows: [{ invoiceId: 'a', code: '0190', description: 'Consultation', quantity: 1, unitPrice: 300, total: 300, medicalAid: 300, patient: 0 }], error: null },
    payslips: { rows: [normalizePayslip({ id: 's1', gross_earnings: 120, net_pay: 100, pay_period_start: '2026-10-01', status: 'paid' })], error: null },
    expenses: { rows: [normalizeExpense({ id: 'e1', amount: 30, expense_date: '2026-10-03', status: 'pending', expense_type: 'rent' })], error: null },
    inventory: { rows: [normalizeInventoryItem({ id: 'i1', name: 'PC', category: 'equipment', quantity: 1, unit_cost: 5000 })], error: null },
    visits: { rows: [], error: null },
    payslipLines: { rows: [], error: null },
    claimBatches: { rows: [], error: null },
    patientNames: { pt1: 'Ndapewa Shilongo', pt2: 'Johannes Nghifikwa' },
    doctorNames: {},
    schemeByPatient: { pt1: 'NAMMED' },
    serviceDateByVisit: {},
    lookupWarnings: [],
    loadedAt: '2026-10-06T08:00:00Z',
    ...overrides
  };
}

describe('deriveFinance', () => {
  it('compares the period with the previous period and keeps receivables as at today', () => {
    const derived = deriveFinance(workspace(), context);
    expect(derived.revenue.billed).toBe(400); // a + b; cancelled c excluded
    expect(derived.previousRevenue.billed).toBe(200);
    // Receivables ignore the period: the May invoice is still owed
    expect(derived.aging.total).toBe(380);
    expect(derived.statusSummary.cancelled.count).toBe(1);
    expect(derived.statusSummary.pending.count).toBe(1); // only invoice a was issued in the period and is pending
  });

  it('builds the net result from income, expenses and payroll', () => {
    const derived = deriveFinance(workspace(), context);
    expect(derived.summary).toMatchObject({ income: 400, practiceExpenses: 30, payroll: 120, netResult: 250, inventory: 5000, payables: 30 });
  });

  it('marks payroll-based figures unavailable (null) when payslips failed, instead of treating payroll as N$0', () => {
    const derived = deriveFinance(workspace({ payslips: { rows: [], error: 'permission denied' } }), context);
    expect(derived.payroll).toBeNull();
    expect(derived.payrollVsRevenue).toBeNull();
    expect(derived.summary.payroll).toBeNull();
    expect(derived.summary.netResult).toBeNull();
    expect(derived.revenue.billed).toBe(400);
  });

  it('marks expense, inventory and tariff figures unavailable when their sources failed', () => {
    const derived = deriveFinance(workspace({
      expenses: { rows: [], error: 'x' },
      inventory: { rows: [], error: 'y' },
      lineItems: { rows: [], error: 'z' }
    }), context);
    expect(derived.expenses).toBeNull();
    expect(derived.payables).toBeNull();
    expect(derived.inventory).toBeNull();
    expect(derived.tariffs).toBeNull();
    expect(derived.summary.netResult).toBeNull();
  });

  it('counts invoices with an unrecognised stored status', () => {
    expect(deriveFinance(workspace(), context).unrecognisedStatusCount).toBe(1);
  });
});

describe('report builders', () => {
  it('AR aging puts each invoice amount in its age column and totals match the ledger', () => {
    const derived = deriveFinance(workspace(), context);
    const { report } = buildReport('ar_aging', derived, workspace(), labels);
    expect(report?.basis).toBe('As at 6 Oct 2026');
    const headers = report!.columns.map(c => c.header);
    const oldRow = report!.rows.find(row => row[0] === 'O')!;
    expect(oldRow[headers.indexOf('90+ days')]).toBe(80);
    expect(oldRow[headers.indexOf('Not yet due')]).toBeNull();
    expect(oldRow[1]).toBe('Johannes Nghifikwa');
    expect(report!.totals?.[report!.totals.length - 1]).toBe(derived.aging.total);
  });

  it('payroll vs revenue is unavailable (not zero) when payroll failed to load', () => {
    const failed = workspace({ payslips: { rows: [], error: 'permission denied' } });
    const result = buildReport('payroll_vs_revenue', deriveFinance(failed, context), failed, labels);
    expect(result.report).toBeUndefined();
    expect(result.unavailable).toMatch(/Payroll could not be loaded/);
  });

  it('revenue by tariff code is unavailable when line items failed, and lists codes when loaded', () => {
    const failed = workspace({ lineItems: { rows: [], error: 'z' } });
    expect(buildReport('revenue_by_tariff', deriveFinance(failed, context), failed, labels).unavailable).toBeTruthy();
    const ok = buildReport('revenue_by_tariff', deriveFinance(workspace(), context), workspace(), labels).report!;
    expect(ok.rows[0].slice(0, 2)).toEqual(['0190', 'Consultation']);
  });

  it('payer mix lists each medical aid fund and the patient share, adding up to billed revenue', () => {
    const report = buildReport('payer_mix', deriveFinance(workspace(), context), workspace(), labels).report!;
    expect(report.rows.map(r => r[0])).toEqual(['Medical aid (all funds)', '  NAMMED', 'Patient (self-pay portion)']);
    expect((report.rows[0][2] as number) + (report.rows[2][2] as number)).toBe(report.totals?.[2]);
  });

  it('collections report totals equal the collected figure', () => {
    const derived = deriveFinance(workspace(), context);
    const report = buildReport('collections', derived, workspace(), labels).report!;
    expect(report.rows).toEqual([['Cash', 1, 100, 1]]);
    expect(report.totals?.[2]).toBe(derived.collections.collected);
  });
});

// "Claims sent, awaiting payment" summed every batch ever marked sent (91 of 99) and nothing moves a batch past
// "sent", so it only grew. It must be what the funds still owe on claims sent to them: a paid claim leaves it.
describe('claims sent, awaiting payment', () => {
  const sentBatch = { rows: [{ id: 'b-sent', status: 'sent', sentAt: '2026-09-20T08:00:00Z', fundReference: 'NHPM' }], error: null };
  const claimed = (id: string, fundAmount: number, status = 'pending') =>
    inv({ id, invoice_number: id.toUpperCase(), total: fundAmount, medical_aid_total: fundAmount, patient_id: 'pt1', batch_id: 'b-sent', payment_status: status });
  /** The ledger balance of a claim the fund has paid part of (amounts in cents) */
  const fundPaid = (invoice: LedgerInvoice, billedCents: number, paidCents: number): ArInvoiceBalance => ({
    invoiceId: invoice.id,
    patientId: invoice.patientId,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paymentStatus: invoice.rawStatus,
    billed: { medical_aid: billedCents, patient: 0 },
    allocated: { medical_aid: paidCents, patient: 0 },
    credited: { medical_aid: 0, patient: 0 },
    writtenOff: { medical_aid: 0, patient: 0 },
    journals: { medical_aid: 0, patient: 0 },
    shortfallCents: 0,
    outstanding: { medical_aid: billedCents - paidCents, patient: 0 },
    hasActivity: true,
    hasEntries: true
  });

  it('drops a claim once its invoice is paid', () => {
    const invoices = { rows: [claimed('i1', 300), claimed('i2', 500, 'paid')], error: null };
    expect(deriveFinance(workspace({ invoices, claimBatches: sentBatch }), context).fundDebtors?.totals.sent).toBe(300);
  });

  it('counts only what each fund still owes once receipts are in use, so remittances bring it down', () => {
    const settled = claimed('i1', 300);
    const partPaid = claimed('i2', 500);
    const ar = { state: 'ready' as const, error: null, receipts: [], refunds: [], balances: { i1: fundPaid(settled, 30000, 30000), i2: fundPaid(partPaid, 50000, 20000) } };
    const derived = deriveFinance(workspace({ invoices: { rows: [settled, partPaid], error: null }, claimBatches: sentBatch, ar }), context);
    expect(derived.fundDebtors?.totals.sent).toBe(300);
  });

  it('is unavailable, not N/usr/bin/bash, when the claim batches could not be read', () => {
    expect(deriveFinance(workspace({ claimBatches: { rows: [], error: 'timeout' } }), context).fundDebtors).toBeNull();
  });
});
