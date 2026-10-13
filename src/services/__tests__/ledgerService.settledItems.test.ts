/**
 * Leaving settled items off statements (parity D26): a paid invoice and what paid it are left off only when that adds
 * up to nothing, so a patient never sees a different balance because their statement is shorter. Invented accounts.
 */
import { describe, expect, it } from 'vitest';
import {
  buildStatement,
  leaveSettledOff,
  settledInvoiceIds,
  type ArAdjustment,
  type ArAllocation,
  type ArInvoiceBalance,
  type ArReceipt,
  type StatementInput,
  type StatementInvoice
} from '../ledgerService';

const zero = { medical_aid: 0, patient: 0 };

const inv = (id: string, dateKey: string, patientCents: number, medicalAidCents = 0): StatementInvoice => ({
  id, invoiceNumber: id.toUpperCase(), dateKey, billed: { medical_aid: medicalAidCents, patient: patientCents }, cancelled: false
});

const receipt = (id: string, amountCents: number, overrides: Partial<ArReceipt> = {}): ArReceipt => ({
  id, number: `RC-${id}`, payerType: 'patient', patientId: 'p1', fundName: null, payerName: null, method: 'cash', amountCents,
  receivedOn: '2026-09-10', reference: null, source: 'manual', notes: null, createdBy: 'u1', createdAt: `2026-09-10T10:00:00+02:00`,
  reversal: null, allocatedCents: amountCents, refundedCents: 0, unallocatedCents: 0, ...overrides
});

const allocation = (id: string, receiptId: string, invoiceId: string, amountCents: number, createdAt = '2026-09-10T10:00:00+02:00'): ArAllocation => ({
  id, receiptId, invoiceId, portion: 'patient', amountCents, createdBy: 'u1', createdAt, reversal: null
});

const balance = (invoiceId: string, outstandingPatient: number, hasEntries = true): ArInvoiceBalance => ({
  invoiceId, patientId: 'p1', invoiceNumber: invoiceId.toUpperCase(), issueDate: null, dueDate: null, paymentStatus: null,
  billed: zero, allocated: zero, credited: zero, writtenOff: zero, journals: zero, shortfallCents: 0,
  outstanding: { medical_aid: 0, patient: outstandingPatient }, hasActivity: hasEntries, hasEntries
});

const closingOf = (input: StatementInput, fromKey: string | null = null) => buildStatement(input, { fromKey }).closing;

describe('which invoices are settled', () => {
  it('only an invoice whose entries leave nothing owed; one only marked paid before receipts has nothing against it on a statement', () => {
    const invoices = [inv('paid', '2026-09-01', 20000), inv('open', '2026-09-02', 10000), inv('legacy', '2026-09-03', 5000), { ...inv('void', '2026-09-04', 0), cancelled: true }];
    const settled = settledInvoiceIds(invoices, {
      paid: balance('paid', 0),
      open: balance('open', 10000),
      legacy: balance('legacy', 0, false),
      void: { ...balance('void', 0, false), hasActivity: false }
    });
    expect([...settled].sort()).toEqual(['paid', 'void']);
  });
});

describe('leaving settled items off', () => {
  it('drops a paid invoice and the payment that paid it, keeps the open one, and the balance is the same', () => {
    const input: StatementInput = {
      patientId: 'p1',
      invoices: [inv('paid', '2026-09-01', 20000), inv('open', '2026-09-20', 10000)],
      receipts: [receipt('r1', 20000)],
      allocations: [allocation('a1', 'r1', 'paid', 20000)],
      adjustments: []
    };
    const result = leaveSettledOff(input, new Set(['paid']));
    expect(result.invoicesLeftOff).toBe(1);
    expect(buildStatement(result.input).lines.map(line => line.reference)).toEqual(['OPEN']);
    expect(closingOf(result.input)).toEqual(closingOf(input));
  });

  it('keeps a payment that also paid an open invoice, and so the settled invoice it touched, because leaving it off would change the balance', () => {
    const input: StatementInput = {
      patientId: 'p1',
      invoices: [inv('paid', '2026-09-01', 20000), inv('open', '2026-09-02', 30000)],
      receipts: [receipt('r1', 30000)],
      allocations: [allocation('a1', 'r1', 'paid', 20000), allocation('a2', 'r1', 'open', 10000)],
      adjustments: []
    };
    const result = leaveSettledOff(input, new Set(['paid']));
    expect(result.invoicesLeftOff).toBe(0);
    expect(closingOf(result.input)).toEqual(closingOf(input));
  });

  it('keeps a payment that still holds credit on the account, with the invoice it paid', () => {
    const input: StatementInput = {
      patientId: 'p1',
      invoices: [inv('paid', '2026-09-01', 20000)],
      receipts: [receipt('r1', 25000, { allocatedCents: 20000, unallocatedCents: 5000 })],
      allocations: [allocation('a1', 'r1', 'paid', 20000)],
      adjustments: []
    };
    const result = leaveSettledOff(input, new Set(['paid']));
    expect(result.invoicesLeftOff).toBe(0);
    expect(closingOf(result.input).credit).toBe(5000);
  });

  it("drops a fund-paid invoice with its discount and the fund's payment, keeping the account's other entries", () => {
    const fund = receipt('fund', 700000, { payerType: 'medical_aid', patientId: null, fundName: 'Test Fund', method: 'medical_aid' });
    const discount: ArAdjustment = {
      id: 'd1', number: 'DS-000001', kind: 'discount', invoiceId: 'claimed', receiptId: null, patientId: 'p1', portion: 'patient', amountCents: 30000,
      method: null, reasonCode: 'pensioner', reason: 'Pensioner', approvedBy: 'doc', effectiveOn: '2026-09-05', createdBy: 'doc', createdAt: '2026-09-05T09:00:00+02:00', reversal: null
    };
    const input: StatementInput = {
      patientId: 'p1',
      invoices: [inv('claimed', '2026-09-01', 30000, 70000), inv('open', '2026-09-20', 10000)],
      receipts: [fund],
      allocations: [{ ...allocation('fa', 'fund', 'claimed', 70000), portion: 'medical_aid' }],
      adjustments: [discount]
    };
    const result = leaveSettledOff(input, new Set(['claimed']));
    expect(result.invoicesLeftOff).toBe(1);
    expect(result.input.adjustments).toEqual([]);
    expect(result.input.allocations).toEqual([]);
    expect(closingOf(result.input)).toEqual(closingOf(input));
  });

  it('keeps the balance brought forward right when a settled invoice falls before the history shown', () => {
    const input: StatementInput = {
      patientId: 'p1',
      invoices: [inv('old', '2026-06-01', 20000), inv('open', '2026-09-20', 10000)],
      receipts: [receipt('r1', 20000, { receivedOn: '2026-09-02', createdAt: '2026-09-02T10:00:00+02:00' })],
      allocations: [allocation('a1', 'r1', 'old', 20000, '2026-09-02T10:00:00+02:00')],
      adjustments: []
    };
    const result = leaveSettledOff(input, new Set(['old']));
    const lines = buildStatement(result.input, { fromKey: '2026-08-01' }).lines;
    expect(lines[0]).toMatchObject({ kind: 'opening', balance: { total: 0 } });
    expect(closingOf(result.input, '2026-08-01')).toEqual(closingOf(input, '2026-08-01'));
  });

  it("never touches another account's patients: a payment towards a relative's invoice elsewhere stays", () => {
    const input: StatementInput = {
      patientId: 'p1',
      invoices: [inv('paid', '2026-09-01', 20000)],
      receipts: [receipt('r1', 30000)],
      allocations: [allocation('a1', 'r1', 'paid', 20000), allocation('a2', 'r1', 'elsewhere', 10000)],
      adjustments: []
    };
    const result = leaveSettledOff(input, new Set(['paid']));
    expect(result.invoicesLeftOff).toBe(0);
    expect(closingOf(result.input)).toEqual(closingOf(input));
  });
});
