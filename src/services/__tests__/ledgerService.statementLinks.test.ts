/**
 * A statement on screen opens what each line is about (bi-directional links): an invoice line its invoice, a
 * receipt or a fund's payment its receipt, a credit note or discount the invoice it is on, a refund the receipt it paid
 * back. The ids ride on the lines; the printed and emailed statements never show them. Invented data only.
 */
import { describe, expect, it } from 'vitest';
import {
  buildStatement,
  statementLineOpens,
  type ArAdjustment,
  type ArAllocation,
  type ArReceipt,
  type StatementInvoice
} from '../ledgerService';

let seq = 0;
const receipt = (overrides: Partial<ArReceipt> = {}): ArReceipt => {
  seq += 1;
  return {
    id: `r${seq}`,
    number: `RC-${String(seq).padStart(6, '0')}`,
    payerType: 'patient',
    patientId: 'pt1',
    fundName: null,
    payerName: null,
    method: 'cash',
    amountCents: 10000,
    receivedOn: '2026-10-02',
    reference: null,
    source: 'manual',
    notes: null,
    createdBy: 'u1',
    createdAt: `2026-10-02T08:00:${String(seq % 60).padStart(2, '0')}Z`,
    reversal: null,
    allocatedCents: 0,
    refundedCents: 0,
    unallocatedCents: 0,
    ...overrides
  };
};
const allocation = (overrides: Partial<ArAllocation> & Pick<ArAllocation, 'receiptId' | 'invoiceId' | 'amountCents'>): ArAllocation => ({
  id: `a${++seq}`,
  portion: 'patient',
  createdBy: 'u1',
  createdAt: '2026-10-02T08:00:00Z',
  reversal: null,
  ...overrides
});
const adjustment = (overrides: Partial<ArAdjustment> & Pick<ArAdjustment, 'kind' | 'amountCents'>): ArAdjustment => ({
  id: `d${++seq}`,
  number: `ADJ-${seq}`,
  invoiceId: null,
  receiptId: null,
  patientId: 'pt1',
  portion: 'patient',
  method: null,
  reasonCode: null,
  reason: 'Test',
  approvedBy: null,
  effectiveOn: '2026-10-03',
  createdBy: 'u1',
  createdAt: '2026-10-03T09:00:00Z',
  reversal: null,
  ...overrides
});

const invoices: StatementInvoice[] = [
  { id: 'i1', invoiceNumber: 'INV-1', dateKey: '2026-10-01', billed: { medical_aid: 60000, patient: 20000 }, cancelled: false },
  { id: 'i2', invoiceNumber: 'INV-2', dateKey: '2026-10-01', billed: { medical_aid: 0, patient: 30000 }, cancelled: false }
];

describe('statement lines open their records', () => {
  it('an invoice opens itself; the patient\'s own payment opens its receipt', () => {
    const cash = receipt({ id: 'cash', amountCents: 30000, createdAt: '2026-10-02T08:00:00Z' });
    const statement = buildStatement({
      patientId: 'pt1',
      invoices,
      receipts: [cash],
      allocations: [allocation({ receiptId: 'cash', invoiceId: 'i2', amountCents: 30000, createdAt: cash.createdAt })],
      adjustments: []
    });
    const byKind = Object.fromEntries(statement.lines.map(line => [`${line.kind}:${line.reference}`, statementLineOpens(line)]));
    expect(byKind['invoice:INV-1']).toEqual({ kind: 'invoice', id: 'i1' });
    expect(byKind[`receipt:${cash.number}`]).toEqual({ kind: 'receipt', id: 'cash' });
  });

  it('a fund\'s payment opens the fund\'s receipt, even though the statement only shows this patient\'s part of it', () => {
    const fund = receipt({ id: 'fund', payerType: 'medical_aid', fundName: 'Example Fund', patientId: null, amountCents: 500000, createdAt: '2026-10-05T07:00:00Z' });
    const statement = buildStatement({
      patientId: 'pt1',
      invoices,
      receipts: [fund],
      allocations: [allocation({ receiptId: 'fund', invoiceId: 'i1', portion: 'medical_aid', amountCents: 60000, createdAt: fund.createdAt })],
      adjustments: []
    });
    const payment = statement.lines.find(line => line.kind === 'payment');
    expect(payment).toMatchObject({ receiptId: 'fund', invoiceId: 'i1' });
    expect(statementLineOpens(payment!)).toEqual({ kind: 'receipt', id: 'fund' });
  });

  it('a credit note or discount opens the invoice it is on; a refund opens the receipt it paid back', () => {
    const over = receipt({ id: 'over', amountCents: 40000, createdAt: '2026-10-02T08:00:00Z' });
    const statement = buildStatement({
      patientId: 'pt1',
      invoices,
      receipts: [over],
      allocations: [allocation({ receiptId: 'over', invoiceId: 'i2', amountCents: 30000, createdAt: over.createdAt })],
      adjustments: [
        adjustment({ kind: 'credit_note', invoiceId: 'i1', portion: 'medical_aid', amountCents: 5000, number: 'CN-000001' }),
        adjustment({ kind: 'refund', receiptId: 'over', invoiceId: null, portion: null, method: 'cash', amountCents: 10000, number: 'RF-000001' })
      ]
    });
    const opens = (reference: string) => statementLineOpens(statement.lines.find(line => line.reference === reference)!);
    expect(opens('CN-000001')).toEqual({ kind: 'invoice', id: 'i1' });
    expect(opens('RF-000001')).toEqual({ kind: 'receipt', id: 'over' });
  });

  it('the balance brought forward opens nothing, and a payment of another account\'s invoice never links that invoice', () => {
    const own = receipt({ id: 'own', amountCents: 10000, createdAt: '2026-10-02T08:00:00Z' });
    const statement = buildStatement({
      patientId: 'pt1',
      invoices,
      receipts: [own],
      // Credit from the patient's own receipt used later on someone else's invoice
      allocations: [allocation({ receiptId: 'own', invoiceId: 'someone-else', amountCents: 10000, createdAt: '2026-10-04T08:00:00Z' })],
      adjustments: []
    }, { fromKey: '2026-10-02' });
    const opening = statement.lines.find(line => line.kind === 'opening')!;
    expect(statementLineOpens(opening)).toBeNull();
    const creditUsed = statement.lines.find(line => line.kind === 'credit_used')!;
    expect(creditUsed.invoiceId).toBeUndefined();
    expect(statementLineOpens(creditUsed)).toEqual({ kind: 'receipt', id: 'own' });
  });
});
