/**
 * Finance > Reports, the money reports: practice transactions (R5), cash flow per practitioner (R7), invoices per fund
 * (R18) and a fund's patients with balances (R20). Invented ids and amounts only.
 */
import { describe, expect, it } from 'vitest';
import {
  buildAgingReport,
  ledgerMovements,
  totalMovements,
  type ArAdjustment,
  type ArReceipt
} from '../../../../services/ledgerService';
import { invoice } from '../../../../services/__tests__/ledgerTestUtils';
import {
  NOT_ALLOCATED,
  NO_PRACTITIONER,
  SEVERAL_PRACTITIONERS,
  filterTransactions,
  practiceTransactions,
  receiptPractitioner,
  totalsByKind,
  totalsByPractitioner,
  transactionDetailTable
} from '../practiceTransactions';
import {
  CASH_REFUNDED,
  CASH_UNALLOCATED,
  cashByPractitioner,
  cashDetailTable,
  cashSummaryTable,
  normalizeCashPart,
  type CashPart,
  type RawCashPart
} from '../cashByPractitioner';
import { fundInvoiceTable, fundOfInvoice, fundSummaries, invoicesPerFund, type BatchInfo } from '../invoicesPerFund';
import { fundChoices, fundPatients, fundPatientsTable } from '../fundPatients';

const RANGE = { startKey: '2026-10-01', endKey: '2026-10-31' };

const receipt = (overrides: Partial<ArReceipt> = {}): ArReceipt => ({
  id: 'r1',
  number: 'RC-000001',
  payerType: 'patient',
  patientId: 'p1',
  fundName: null,
  payerName: null,
  method: 'cash',
  amountCents: 10000,
  receivedOn: '2026-10-05',
  reference: null,
  source: 'manual',
  notes: null,
  createdBy: 'u1',
  createdAt: '2026-10-05T09:00:00+02:00',
  reversal: null,
  allocatedCents: 10000,
  refundedCents: 0,
  unallocatedCents: 0,
  ...overrides
});

const adjustment = (overrides: Partial<ArAdjustment> = {}): ArAdjustment => ({
  id: 'a1',
  number: 'CN-000001',
  kind: 'credit_note',
  invoiceId: null,
  receiptId: null,
  patientId: 'p1',
  portion: 'patient',
  amountCents: 2000,
  method: null,
  reasonCode: null,
  reason: 'Test',
  approvedBy: null,
  effectiveOn: '2026-10-10',
  createdBy: 'u1',
  createdAt: '2026-10-10T10:00:00+02:00',
  reversal: null,
  ...overrides
});

describe('practice transactions (R5)', () => {
  const inv1 = invoice({ id: 'i1', invoiceNumber: 'INV-1', patientId: 'p1', practitionerId: 'drA', issueDate: '2026-10-02', total: 500 });
  const inv2 = invoice({ id: 'i2', invoiceNumber: 'INV-2', patientId: 'p2', practitionerId: 'drB', issueDate: '2026-10-03', total: 300 });
  const older = invoice({ id: 'i0', invoiceNumber: 'INV-0', patientId: 'p1', practitionerId: 'drB', issueDate: '2026-08-20', total: 900 });
  const sources = {
    invoices: [inv1, inv2, older],
    receipts: [
      receipt({ id: 'r1', number: 'RC-1', amountCents: 50000, receivedOn: '2026-10-04' }),
      receipt({ id: 'r2', number: 'RC-2', amountCents: 20000, receivedOn: '2026-10-06', payerType: 'medical_aid', patientId: null, fundName: 'PSEMAS' }),
      receipt({ id: 'r3', number: 'RC-3', amountCents: 7000, receivedOn: '2026-09-28', reversal: { at: '2026-10-08T10:00:00+02:00', by: 'u1', reason: 'Bounced' } })
    ],
    adjustments: [
      adjustment({ id: 'a1', number: 'CN-1', invoiceId: 'i0', amountCents: 2000, effectiveOn: '2026-10-10' }),
      adjustment({ id: 'a2', number: 'RF-1', kind: 'refund', invoiceId: null, receiptId: 'r1', amountCents: 1500, effectiveOn: '2026-10-12', method: 'cash' })
    ],
    allocatedPractitioners: new Map<string, Array<string | null>>([['r1', ['drA', 'drA']], ['r2', ['drA', 'drB']]])
  };
  const rows = practiceTransactions(sources, RANGE);

  it('adds up, type by type, to the month end\'s control totals for the same days, so the two reports never disagree', () => {
    const control = totalMovements(ledgerMovements({ invoices: [inv1, inv2, older], receipts: sources.receipts, adjustments: sources.adjustments }), RANGE);
    for (const total of totalsByKind(rows)) expect(total.cents).toBe(control[total.kind]);
    expect(rows.reduce((sum, row) => sum + row.cents, 0)).toBe(Object.values(control).reduce((sum, cents) => sum + cents, 0));
  });

  it('lists a September payment reversed in October on the day of the reversal only, so a closed September never moves', () => {
    expect(rows.filter(row => row.document === 'RC-3').map(row => [row.kind, row.dateKey, row.cents])).toEqual([['receipt_reversals', '2026-10-08', 7000]]);
  });

  it('puts an older invoice\'s credit note in the period it was given, under that invoice\'s practitioner, opening the invoice', () => {
    const credit = rows.find(row => row.document === 'CN-1');
    expect(credit).toMatchObject({ kind: 'credit_notes', onInvoice: 'INV-0', practitioner: 'drB', cents: -2000, target: { kind: 'invoice', id: 'i0' } });
    expect(rows.some(row => row.document === 'INV-0')).toBe(false); // raised in August: not a transaction of October
  });

  it('credits a payment to the practitioner whose invoices it paid, and says so when it paid several or none', () => {
    expect(rows.find(row => row.document === 'RC-1')?.practitioner).toBe('drA');
    expect(rows.find(row => row.document === 'RC-2')).toMatchObject({ practitioner: SEVERAL_PRACTITIONERS, payer: 'PSEMAS', patientId: null });
    expect(receiptPractitioner(undefined)).toBe(NOT_ALLOCATED);
    expect(receiptPractitioner([null])).toBe(NO_PRACTITIONER);
    expect(rows.find(row => row.document === 'RF-1')?.practitioner).toBe(NOT_ALLOCATED); // a refund pays back unallocated credit
  });

  it('filters by type and practitioner, and the practitioner totals add up to the net change', () => {
    expect(filterTransactions(rows, { kind: 'invoices', practitioner: 'drA' }).map(row => row.document)).toEqual(['INV-1']);
    const byPractitioner = totalsByPractitioner(rows);
    expect(byPractitioner.reduce((sum, total) => sum + total.netCents, 0)).toBe(rows.reduce((sum, row) => sum + row.cents, 0));
    expect(byPractitioner[byPractitioner.length - 1]?.practitioner).toBe(NOT_ALLOCATED); // the people first, the buckets last
  });

  it('gives every row of the detailed list something to open and names unknown people instead of showing ids', () => {
    const report = transactionDetailTable({ rows, periodLabel: 'Oct 2026', patientNames: { p1: 'Patient One' }, staffNames: { drA: 'Practitioner A' } });
    expect(report.targets.every(target => target !== null)).toBe(true);
    expect(report.table.rows.find(row => row[2] === 'INV-2')?.[5]).toBe('Practitioner not on the staff list');
    expect(report.table.rows.find(row => row[2] === 'RC-2')?.[4]).toBe('PSEMAS');
  });
});

describe('cash flow per practitioner (R7)', () => {
  const raw = (overrides: Partial<RawCashPart>): RawCashPart => ({
    received_on: '2026-10-05', receipt_id: 'r1', receipt_number: 'RC-1', payer_type: 'patient', patient_id: 'p1', fund_name: null,
    method: 'cash', practitioner_id: 'drA', basis: 'line', amount: '100.00', ...overrides
  });
  const parts = [
    raw({}),
    raw({ practitioner_id: 'drB', basis: 'invoice', amount: '50.00' }),
    raw({ receipt_id: 'r2', receipt_number: 'RC-2', method: 'eft', practitioner_id: 'drA', basis: 'invoice', amount: '200.00' }),
    raw({ receipt_id: 'r3', receipt_number: 'RC-3', method: 'card', practitioner_id: 'drA', basis: 'unallocated', amount: '30.00' }),
    raw({ receipt_id: 'r3', receipt_number: 'RC-3', method: 'card', practitioner_id: null, basis: 'refunded', amount: '20.00' })
  ].map(normalizeCashPart).filter((part): part is CashPart => part !== null);

  it('splits one payment between the practitioners whose work it paid, and the total is still the money received', () => {
    const summary = cashByPractitioner(parts);
    expect(summary.rows.map(row => [row.key, row.totalCents])).toEqual([['drA', 30000], ['drB', 5000], [CASH_UNALLOCATED, 3000], [CASH_REFUNDED, 2000]]);
    expect(summary.totalCents).toBe(40000);
    expect(summary.receipts).toBe(3);
    expect(summary.rows.find(row => row.key === 'drA')?.byMethod).toMatchObject({ cash: 10000, eft: 20000 });
  });

  it('never credits unallocated or refunded money to a practitioner, even if the database named one', () => {
    expect(parts.find(part => part.basis === 'unallocated')?.practitionerId).toBeNull();
  });

  it('leaves out a row it does not understand rather than guessing where the money went', () => {
    expect(normalizeCashPart(raw({ basis: 'something_new' }))).toBeNull();
    expect(normalizeCashPart(raw({ receipt_id: null }))).toBeNull();
  });

  it('shows only the payment methods used, and every payment row opens its payment', () => {
    const table = cashSummaryTable(cashByPractitioner(parts), 'Oct 2026', { drA: 'Practitioner A', drB: 'Practitioner B' }).table;
    expect(table.columns.map(column => column.header)).toEqual(['Practitioner', 'Cash', 'Card', 'EFT', 'Total', 'Payments']);
    const detail = cashDetailTable(parts, 'Oct 2026', {}, { p1: 'Patient One' });
    expect(detail.targets.every(target => target?.kind === 'receipt')).toBe(true);
  });
});

describe('invoices per fund (R18)', () => {
  const batches = new Map<string, BatchInfo>([
    ['b1', { id: 'b1', number: 7, sentAt: '2026-10-06T10:00:00Z', fundReference: 'MAG1' }],
    ['b2', { id: 'b2', number: 8, sentAt: null, fundReference: 'NMC1' }]
  ]);
  const schemes = { p1: 'PSEMAS', p2: 'Namibia Medical Care', p3: 'Some Other Fund' };
  const invoices = [
    invoice({ id: 'i1', invoiceNumber: 'INV-1', patientId: 'p1', batchId: 'b1', issueDate: '2026-10-02', total: 500, medicalAidTotal: 400 }),
    invoice({ id: 'i2', invoiceNumber: 'INV-2', patientId: 'p1', issueDate: '2026-10-02', total: 100, medicalAidTotal: 100 }),
    invoice({ id: 'i3', invoiceNumber: 'INV-3', patientId: 'p2', batchId: 'b2', issueDate: '2026-10-03', total: 300, medicalAidTotal: 300 }),
    invoice({ id: 'i4', invoiceNumber: 'INV-4', patientId: 'p3', issueDate: '2026-10-03', total: 80, medicalAidTotal: 80 }),
    invoice({ id: 'i5', invoiceNumber: 'INV-5', patientId: null, issueDate: '2026-10-03', total: 60, medicalAidTotal: 0 }),
    invoice({ id: 'i6', invoiceNumber: 'INV-6', patientId: 'p1', issueDate: '2026-10-03', total: 70, medicalAidTotal: 70, status: 'cancelled', rawStatus: 'cancelled' }),
    invoice({ id: 'i7', invoiceNumber: 'INV-7', patientId: 'p1', issueDate: '2026-09-30', total: 70, medicalAidTotal: 70 })
  ];
  const rows = invoicesPerFund({ invoices, range: RANGE, schemeByPatient: schemes, batchById: batches });

  it('puts MAG1 and PSEMAS under one fund, so a fund\'s invoices are never split over two names', () => {
    expect(rows.filter(row => row.fundKey === 'MAG1').map(row => row.invoiceNumber)).toEqual(['INV-1', 'INV-2']);
    expect(fundOfInvoice({ patientId: 'p2', batchId: null }, schemes, batches)).toEqual({ key: 'NMC1', label: 'Namibia Medical Care (NMC)' });
  });

  it('says where each claim stands: sent, waiting in a batch, not batched, or nothing for the fund', () => {
    expect(rows.map(row => [row.invoiceNumber, row.claim, row.batchNumber])).toEqual(expect.arrayContaining([
      ['INV-1', 'sent', 7], ['INV-2', 'not_batched', null], ['INV-3', 'in_batch', 8], ['INV-5', 'nothing_to_claim', null]
    ]));
  });

  it('leaves out cancelled invoices and invoices of other days, and keeps funds it does not know under their own name', () => {
    expect(rows.map(row => row.invoiceNumber)).not.toContain('INV-6');
    expect(rows.map(row => row.invoiceNumber)).not.toContain('INV-7');
    expect(rows.find(row => row.invoiceNumber === 'INV-4')?.fund).toBe('Some Other Fund');
    expect(rows.find(row => row.invoiceNumber === 'INV-5')?.fund).toBe('No medical aid (private)');
  });

  it('adds each fund\'s portion up into sent and not sent, private last, and each invoice row opens its invoice', () => {
    const summaries = fundSummaries(rows);
    expect(summaries[summaries.length - 1]?.fundKey).toBe('No medical aid (private)');
    const psemas = summaries.find(fund => fund.fundKey === 'MAG1');
    expect(psemas).toMatchObject({ invoices: 2, medicalAidCents: 50000, sentCents: 40000, notSentCents: 10000 });
    expect(fundInvoiceTable(rows, 'Oct 2026', {}, null).targets.every(target => target?.kind === 'invoice')).toBe(true);
  });
});

describe('a fund\'s patients with balances (R20)', () => {
  const invoices = [
    invoice({ id: 'i1', patientId: 'a', issueDate: '2026-09-01', total: 300, medicalAidTotal: 200 }),
    invoice({ id: 'i2', patientId: 'b', issueDate: '2026-08-01', total: 400, medicalAidTotal: 400 }),
    invoice({ id: 'i3', patientId: 'c', issueDate: '2026-10-01', total: 80, medicalAidTotal: 60 })
  ];
  const aging = buildAgingReport(invoices, '2026-10-12');
  const context = { patientNames: { a: 'Patient A', b: 'Patient B', c: 'Patient C' }, fundByPatient: { a: 'NHP', b: 'PSEMAS', c: 'NHP' } };

  it('offers the funds that are owed something, the fund owed most first', () => {
    expect(fundChoices(aging, context).map(choice => [choice.fund, choice.owedCents, choice.patients])).toEqual([['PSEMAS', 40000, 1], ['NHP', 38000, 2]]);
  });

  it('lists only that fund\'s patients, adding up to the fund on the age analysis, each opening the patient\'s file', () => {
    const report = fundPatientsTable(fundPatients(aging, 'NHP', context), 'NHP', '12 Oct 2026');
    expect(report.table.rows.map(row => row[0])).toEqual(['Patient A', 'Patient C']);
    expect(report.table.totals?.[3]).toBe(380);
    expect(report.targets).toEqual([{ kind: 'patient', id: 'a' }, { kind: 'patient', id: 'c' }]);
  });
});
