/**
 * A14, A19 follow-up: an invoice billed to a company or fund account is that account's debt in every figure that says
 * who owes, and the figures still add up to the receivables Overview shows. One map (FinanceWorkspace.payers.byInvoice)
 * feeds every age analysis (ageContext), the "who owes" sentence of Overview and the receivables report, the month-end
 * pack and the fund patients report.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_AGE_FILTER, buildAgeAnalysis, normalizeInvoice, type RawInvoiceRow } from '../../../../services/ledgerService';
import { deriveFinance, type FinanceContext } from '../../deriveFinance';
import type { FinanceWorkspace } from '../../financeData';
import type { PeriodLabels } from '../../financeNav';
import { buildReport } from '../../reports';
import { ageContext } from '../../debtors/debtorsContext';
import { fundChoices } from '../../practiceReports/fundPatients';
import { receivablesByDebtor, whoOwesSentence } from '../receivablesSplit';
import { payersByInvoice, type PayerAccount } from '../../../../utils/accounts/payerAccounts';
import type { PracticePayerData } from '../../../../services/payerAccountService';

// Invented practice, patients, company and amounts only
const context: FinanceContext = {
  ranges: { preset: 'this_month', current: { startKey: '2026-10-01', endKey: '2026-10-13' }, previous: { startKey: '2026-09-01', endKey: '2026-09-13' } },
  todayKey: '2026-10-13',
  trendMonths: ['2026-09', '2026-10']
};
const labels: PeriodLabels = { ranges: context.ranges, current: '1–13 Oct 2026', previous: '1–13 Sep 2026', today: '13 Oct 2026', todayKey: '2026-10-13' };

const inv = (row: Partial<RawInvoiceRow> & { id: string }) =>
  normalizeInvoice({ total: 100, medical_aid_total: 0, payment_status: 'pending', issue_date: '2026-10-02', due_date: '2026-11-01', ...row });

const invoices = [
  // The employee's own consultation: the fund's part and the patient's
  inv({ id: 'own', invoice_number: 'O', total: 1000, medical_aid_total: 800, patient_id: 'emp', visit_id: 'v-own', issue_date: '2026-09-01' }),
  // The company's pre-employment medical for the same employee: all of it the company's
  inv({ id: 'company', invoice_number: 'C', total: 450, medical_aid_total: 0, patient_id: 'emp', visit_id: 'v-company', issue_date: '2026-07-01' }),
  // Another patient, private
  inv({ id: 'private', invoice_number: 'P', total: 300, medical_aid_total: 0, patient_id: 'other', visit_id: 'v-private' })
];

const account: PayerAccount = {
  id: 'acc', practiceId: 'p', kind: 'employer', name: 'Test Builders', accountNumber: 'AC-0001', registrationNumber: null, vatNumber: null,
  contactName: null, phone: null, email: null, postalAddress: null, town: null, region: null, notes: null, createdAt: null, closedAt: null, closeReason: null
};
const visitPayers = [{ visitId: 'v-company', accountId: 'acc', caseId: null }];
const payers: PracticePayerData = { status: 'ready', accounts: [account], visitPayers, byInvoice: payersByInvoice(invoices, visitPayers, [account]), error: null };

const workspace = (withPayers: boolean): FinanceWorkspace => ({
  practiceId: 'p',
  requestKey: 'p|2025-11-01|2026-10-01|2026-10-13',
  invoices: { rows: invoices, error: null },
  lineItems: { rows: [], error: null },
  payslips: { rows: [], error: null },
  expenses: { rows: [], error: null },
  inventory: { rows: [], error: null },
  visits: { rows: [], error: null },
  payslipLines: { rows: [], error: null },
  claimBatches: { rows: [], error: null },
  patientNames: { emp: 'Test Employee', other: 'Test Other' },
  doctorNames: {},
  schemeByPatient: { emp: 'Namibia Health Plan' },
  serviceDateByVisit: {},
  lookupWarnings: [],
  ...(withPayers ? { payers } : {}),
  loadedAt: '2026-10-13T08:00:00Z'
});

const owedColumn = (report: { columns: { header: string }[] }) => report.columns.findIndex(column => column.header === 'Owed');

describe("an account's invoices in Finance's figures (A14, A19)", () => {
  const ws = workspace(true);
  const derived = deriveFinance(ws, context);

  it("puts the company's invoice on the company's row of the age analysis report, and the report still adds up to Overview's receivables", () => {
    const result = buildReport('age_analysis', derived, ws, labels);
    if (!('report' in result) || !result.report) throw new Error('no report');
    const { report } = result;
    const owed = owedColumn(report);
    const byLabel = Object.fromEntries(report.rows.map(row => [row[0], row[owed]]));
    expect(byLabel['Test Builders']).toBe(450);
    expect(byLabel['Test Employee']).toBe(1000);
    expect(report.totals?.[owed]).toBe(derived.aging.total);
    expect(report.notes).toEqual(expect.arrayContaining(["An invoice billed to a company or fund account is on that account's row, not its patient's."]));
  });

  it('says who owes what in one sentence that adds up to the receivables, on Overview and in the receivables report', () => {
    const split = receivablesByDebtor(derived.aging, ws.payers);
    expect(split).toEqual({ medicalAidCents: 80000, patientCents: 20000 + 30000, accountsCents: 45000, totalCents: 175000 });
    expect(split.totalCents).toBe(Math.round(derived.aging.total * 100));
    const sentence = whoOwesSentence(split);
    expect(sentence).toBe('Medical aids owe N$ 800.00; patients owe N$ 500.00; company and fund accounts owe N$ 450.00.');
    const result = buildReport('ar_aging', derived, ws, labels);
    if (!('report' in result) || !result.report) throw new Error('no report');
    expect(result.report.notes).toContain(sentence);
  });

  it("counts it under the account in the month-end pack's age analysis and keeps the company out of the fund picker", () => {
    const ages = ageContext({ patientNames: ws.patientNames, schemeByPatient: ws.schemeByPatient, payers: ws.payers });
    const pack = buildAgeAnalysis(derived.aging, DEFAULT_AGE_FILTER, ages);
    expect(pack.rows.find(row => row.label === 'Test Builders')?.owedCents).toBe(45000);
    expect(pack.totals.owedCents).toBe(Math.round(derived.aging.total * 100));
    // The company's row in a fund grouping is not a medical aid to choose
    expect(fundChoices(derived.aging, ages).map(choice => choice.fund)).not.toContain('payer:acc');
    expect(fundChoices(derived.aging, ages).reduce((sum, choice) => sum + choice.owedCents, 0)).toBe(175000 - 45000);
  });

  it('changes nothing before the accounts exist: every invoice is its patient\'s and the sentence is as before', () => {
    const plain = workspace(false);
    const plainDerived = deriveFinance(plain, context);
    expect(whoOwesSentence(receivablesByDebtor(plainDerived.aging, plain.payers))).toBe('Medical aids owe N$ 800.00; patients owe N$ 950.00.');
    const result = buildReport('age_analysis', plainDerived, plain, labels);
    if (!('report' in result) || !result.report) throw new Error('no report');
    expect(result.report.rows.map(row => row[0])).not.toContain('Test Builders');
    expect(result.report.totals?.[owedColumn(result.report)]).toBe(plainDerived.aging.total);
  });
});
