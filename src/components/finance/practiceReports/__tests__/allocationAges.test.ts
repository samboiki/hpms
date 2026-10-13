/**
 * Payments by the age of the debt they paid (parity R1): a practice sees whether the money coming in pays this month's
 * work or old debt, and the report always adds up to the money received (Collections). Invented ids and amounts only.
 */
import { describe, expect, it } from 'vitest';
import { receiptsByMethod, type ArAllocation, type ArReceipt } from '../../../../services/ledgerService';
import { invoice } from '../../../../services/__tests__/ledgerTestUtils';
import { ROW_LABELS, agePartsTable, ageRows, ageSummaryTable, paymentParts } from '../allocationAges';

const RANGE = { startKey: '2026-10-01', endKey: '2026-10-31' };

const receipt = (overrides: Partial<ArReceipt> = {}): ArReceipt => ({
  id: 'r1', number: 'RC-000001', payerType: 'patient', patientId: 'p1', fundName: null, payerName: null, method: 'cash',
  amountCents: 10000, receivedOn: '2026-10-10', reference: null, source: 'manual', notes: null, createdBy: 'u1',
  createdAt: '2026-10-10T09:00:00+02:00', reversal: null, allocatedCents: 10000, refundedCents: 0, unallocatedCents: 0, ...overrides
});

const allocation = (overrides: Partial<ArAllocation> = {}): ArAllocation => ({
  id: 'a1', receiptId: 'r1', invoiceId: 'recent', portion: 'patient', amountCents: 10000, createdBy: 'u1', createdAt: null, reversal: null, ...overrides
});

const invoices = new Map([
  ['recent', invoice({ id: 'recent', invoiceNumber: 'INV-RECENT', issueDate: '2026-10-01' })],
  ['old', invoice({ id: 'old', invoiceNumber: 'INV-OLD', issueDate: '2026-06-01' })],
  ['ancient', invoice({ id: 'ancient', invoiceNumber: 'INV-ANCIENT', issueDate: '2025-12-01' })],
  ['later', invoice({ id: 'later', invoiceNumber: 'INV-LATER', issueDate: '2026-10-20' })],
  ['undated', invoice({ id: 'undated', invoiceNumber: 'INV-UNDATED', issueDate: null, createdAt: null })]
]);

describe('payments by the age of the debt they paid', () => {
  it('puts each part of a payment in the age band of the invoice it paid, counted on the day the money came in', () => {
    const parts = paymentParts(
      [receipt({ amountCents: 30000, allocatedCents: 30000 })],
      [
        allocation({ id: 'a1', invoiceId: 'recent', amountCents: 10000 }),
        allocation({ id: 'a2', invoiceId: 'old', amountCents: 15000, portion: 'medical_aid' }),
        allocation({ id: 'a3', invoiceId: 'ancient', amountCents: 5000 })
      ],
      invoices,
      RANGE
    );
    // 1 Oct -> 10 Oct is 9 days (current); 1 Jun -> 10 Oct is 131 days (120); 1 Dec 2025 -> 10 Oct is 313 days (180+)
    expect(parts.map(part => [part.invoice?.number, part.ageDays, part.rowKey])).toEqual([
      ['INV-RECENT', 9, 'current'],
      ['INV-OLD', 131, 'days_120'],
      ['INV-ANCIENT', 313, 'days_180_plus']
    ]);
    const rows = ageRows(parts);
    // Every band is listed, so a practice sees at a glance that nothing paid 30-day debt
    expect(rows.map(row => row.key)).toEqual(['current', 'days_30', 'days_60', 'days_90', 'days_120', 'days_150', 'days_180_plus']);
    expect(rows.find(row => row.key === 'days_120')).toMatchObject({ medicalAidCents: 15000, patientCents: 0, totalCents: 15000, payments: 1 });
  });

  it('adds up to the money received in the period, as Collections does: unallocated and refunded money on their own rows', () => {
    const receipts = [
      receipt({ id: 'r1', amountCents: 10000, allocatedCents: 6000, unallocatedCents: 4000 }),
      receipt({ id: 'r2', number: 'RC-000002', payerType: 'medical_aid', fundName: 'NMC1', method: 'eft', amountCents: 50000, allocatedCents: 45000, refundedCents: 5000 }),
      // Outside the period, and a reversed payment: neither counts anywhere
      receipt({ id: 'r3', number: 'RC-000003', receivedOn: '2026-09-30' }),
      receipt({ id: 'r4', number: 'RC-000004', reversal: { at: '2026-10-11T08:00:00Z', by: 'u1', reason: 'Bounced' } })
    ];
    const parts = paymentParts(receipts, [
      allocation({ id: 'a1', receiptId: 'r1', invoiceId: 'recent', amountCents: 6000 }),
      allocation({ id: 'a2', receiptId: 'r2', invoiceId: 'old', portion: 'medical_aid', amountCents: 45000 }),
      allocation({ id: 'a3', receiptId: 'r3', invoiceId: 'old', amountCents: 10000 }),
      allocation({ id: 'a4', receiptId: 'r4', invoiceId: 'old', amountCents: 10000 })
    ], invoices, RANGE);
    const summary = ageSummaryTable(parts, 'Oct 2026');
    const collected = receiptsByMethod(receipts, RANGE).reduce((sum, method) => sum + method.amount, 0);
    expect(summary.table.totals?.[3]).toBe(collected);
    expect(summary.table.totals?.[3]).toBe(600);
    expect(summary.keys).toContain('unallocated');
    expect(summary.keys).toContain('refunded');
    const unallocatedRow = summary.table.rows[summary.keys.indexOf('unallocated')];
    // Money on no invoice has no portion and no share of what was allocated
    expect(unallocatedRow).toEqual([ROW_LABELS.unallocated, null, null, 40, null, 1]);
  });

  it('counts a deposit paid before its invoice as current, and an invoice without a date as 180+ days (it cannot be shown to be recent)', () => {
    const parts = paymentParts([receipt({ amountCents: 20000, allocatedCents: 20000 })], [
      allocation({ id: 'a1', invoiceId: 'later', amountCents: 10000 }),
      allocation({ id: 'a2', invoiceId: 'undated', amountCents: 10000 })
    ], invoices, RANGE);
    expect(parts.map(part => [part.ageDays, part.rowKey])).toEqual([[0, 'current'], [null, 'days_180_plus']]);
  });

  it('leaves out an allocation that was taken back: that money no longer paid that invoice', () => {
    const parts = paymentParts([receipt({ allocatedCents: 0, unallocatedCents: 10000 })], [
      allocation({ reversal: { at: '2026-10-12T08:00:00Z', by: 'u1', reason: 'Wrong invoice' } })
    ], invoices, RANGE);
    expect(parts.map(part => part.rowKey)).toEqual(['unallocated']);
  });

  it('opens the payment from every row of the list, and names the payer', () => {
    const parts = paymentParts([receipt()], [allocation()], invoices, RANGE);
    const list = agePartsTable(parts, 'Oct 2026', { p1: 'Pat Testing' });
    expect(list.targets).toEqual([{ kind: 'receipt', id: 'r1' }]);
    expect(list.table.rows[0]).toEqual(['2026-10-10', 'RC-000001', 'Pat Testing', 'Cash', 'INV-RECENT', '2026-10-01', 9, 'Current', 'Patient', 100]);
    expect(list.table.totals?.[9]).toBe(100);
  });
});
