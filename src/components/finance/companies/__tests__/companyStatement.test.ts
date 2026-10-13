import { describe, expect, it } from 'vitest';
import { invoice } from '../../../../services/__tests__/ledgerTestUtils';
import type { ArAllocation, ArReceipt } from '../../../../services/ledgerService';
import type { InjuryCase } from '../../../../utils/accounts/injuryCases';
import { caseNotesOf, companyInvoiceRows, companyStatement, companyStatementHtml } from '../companyStatement';

// Invented company, employees and amounts only
const ACCOUNT = { id: 'acc-1', name: 'Test Builders (Pty) Ltd', accountNumber: 'AC-0001', contactName: 'Test Payroll', postalAddress: 'PO Box 1', town: 'Windhoek' };

const receipt = (overrides: Partial<ArReceipt>): ArReceipt => ({
  id: 'r1',
  number: 'RC-000001',
  payerType: 'other',
  patientId: null,
  fundName: null,
  payerName: 'Test Builders (Pty) Ltd',
  method: 'eft',
  amountCents: 30000,
  receivedOn: '2026-10-05',
  reference: null,
  source: 'manual',
  notes: null,
  createdBy: 'u1',
  createdAt: '2026-10-05T09:00:00+02:00',
  reversal: null,
  allocatedCents: 30000,
  refundedCents: 0,
  unallocatedCents: 0,
  ...overrides
});

const allocation = (overrides: Partial<ArAllocation>): ArAllocation => ({
  id: 'a1',
  receiptId: 'r1',
  invoiceId: 'inv-a',
  portion: 'patient',
  amountCents: 30000,
  createdBy: 'u1',
  createdAt: '2026-10-05T09:00:00+02:00',
  reversal: null,
  ...overrides
});

const injuryCase: InjuryCase = {
  id: 'case-1',
  patientId: 'emp-2',
  type: 'injury_on_duty',
  injuryDate: '2026-09-20',
  employerAccountId: 'acc-1',
  employerName: null,
  employeeNumber: 'E-17',
  claimNumber: 'ECF/2026/9',
  payerAccountId: 'acc-1',
  notes: null,
  closedAt: null,
  removedAt: null,
  createdAt: '2026-09-21T08:00:00+02:00'
};

const ledger = {
  invoices: [
    invoice({ id: 'inv-a', invoiceNumber: 'INV-A', patientId: 'emp-1', visitId: 'v1', issueDate: '2026-09-01', total: 300, medicalAidTotal: 0, patientTotal: 300 }),
    invoice({ id: 'inv-b', invoiceNumber: 'INV-B', patientId: 'emp-2', visitId: 'v2', issueDate: '2026-09-25', total: 500, medicalAidTotal: 0, patientTotal: 500 })
  ],
  balances: {},
  receipts: [
    receipt({}),
    // An employee paid part of the company's invoice themselves: it is not the company's money
    receipt({ id: 'r2', number: 'RC-000002', payerType: 'patient', patientId: 'emp-2', payerName: null, method: 'cash', amountCents: 5000, receivedOn: '2026-10-06', createdAt: '2026-10-06T09:00:00+02:00', allocatedCents: 5000 })
  ],
  allocations: [allocation({}), allocation({ id: 'a2', receiptId: 'r2', invoiceId: 'inv-b', amountCents: 5000, createdAt: '2026-10-06T09:00:00+02:00' })],
  adjustments: [],
  accountReceiptIds: new Set(['r1']),
  caseOfVisit: { v1: null, v2: 'case-1' },
  patientNames: { 'emp-1': 'Test Employee One', 'emp-2': 'Test Employee Two' }
};

describe("a company account's statement (A14)", () => {
  // The company's statement must show what the company owes and paid; the employees' names say whose visit it was
  it("shows each invoice with the employee's name, the company's payment as its own and what is still owed", () => {
    const built = companyStatement(ACCOUNT, ledger, { fromKey: null, asAtKey: '2026-10-13' });
    const descriptions = built.statement.lines.map(line => line.description);
    expect(descriptions).toContain('Invoice INV-A (Test Employee One)');
    expect(descriptions).toContain('Invoice INV-B (Test Employee Two)');
    expect(built.statement.lines.find(line => line.kind === 'receipt')?.reference).toBe('RC-000001');
    // The employee's own money shows as a payment on the invoice, not as a receipt of the company
    expect(built.statement.lines.find(line => line.kind === 'payment')?.reference).toBe('RC-000002');
    expect(built.statement.closing.total).toBe(80000 - 30000 - 5000);
  });

  it('lists its invoices oldest first with the case each was billed under', () => {
    const rows = companyInvoiceRows(ledger, [injuryCase], { 'acc-1': ACCOUNT.name });
    expect(rows.map(row => [row.invoiceNumber, row.patientName, row.caseTitle])).toEqual([
      ['INV-A', 'Test Employee One', null],
      ['INV-B', 'Test Employee Two', 'Injury on duty, 20 Sep 2026']
    ]);
    expect(rows[1].caseDetails).toBe('Employer Test Builders (Pty) Ltd, employee no E-17, claim no ECF/2026/9');
    expect(caseNotesOf(rows)).toEqual({ 'INV-B': 'Injury on duty, 20 Sep 2026. Employer Test Builders (Pty) Ltd, employee no E-17, claim no ECF/2026/9' });
  });

  it('prints one amount column, the claim details of a case and the amount due, with every value escaped', () => {
    const built = companyStatement({ ...ACCOUNT, name: 'Test <Builders>' }, ledger, { fromKey: null, asAtKey: '2026-10-13' });
    const rows = companyInvoiceRows(ledger, [injuryCase], { 'acc-1': ACCOUNT.name });
    const html = companyStatementHtml(
      { ...ACCOUNT, name: 'Test <Builders>' },
      built,
      { practiceName: 'Test Practice', contactPhone: null, contactEmail: null, payment: null, asAtKey: '2026-10-13' },
      caseNotesOf(rows)
    );
    expect(html).toContain('Statement of account for Test &lt;Builders&gt;');
    expect(html).toContain('claim no ECF/2026/9');
    expect(html).toContain('<th class="num">Amount</th>');
    expect(html).not.toContain('Patient still owes');
    expect(html).toContain('Amount due');
  });
});
