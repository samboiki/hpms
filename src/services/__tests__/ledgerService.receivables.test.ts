/**
 * Accounts receivable rules: allocation of payments, balances and the payment status they imply,
 * limits on credit notes, write-offs, refunds and shortfall transfers, reversals, the patient
 * statement and the cash-basis reports. Amounts are cents unless a name says otherwise.
 */
import { describe, it, expect } from 'vitest';
import {
  billedPortions,
  buildAgingReport,
  buildStatement,
  checkAdjustmentReversal,
  checkAllocation,
  checkInvoiceAdjustment,
  checkRefund,
  collectedPortions,
  dailyTakingsFromReceipts,
  deriveInvoiceStatus,
  doctorProductivity,
  invoiceFigures,
  normalizeInvoiceBalance,
  normalizeReceipt,
  outstandingAfter,
  owedPortions,
  parseAmountInput,
  payerPortions,
  receiptReversalEffects,
  receiptsByMethod,
  sortOldestFirst,
  suggestAllocation,
  summarizeCollectionsFromLedger,
  summarizeReceipts,
  type ArAdjustment,
  type ArAllocation,
  type ArInvoiceBalance,
  type ArReceipt,
  type DateRange,
  type LedgerInvoice,
  type OpenItem
} from '../ledgerService';
import { invoice } from './ledgerTestUtils';

const october: DateRange = { startKey: '2026-10-01', endKey: '2026-10-31' };
const TODAY = '2026-10-07';

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
    unallocatedCents: overrides.amountCents ?? 10000,
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

/** The balance the database view would give for an invoice with these entries */
function balanceFor(inv: LedgerInvoice, allocations: ArAllocation[] = [], adjustments: ArAdjustment[] = []): ArInvoiceBalance {
  const figures = invoiceFigures(billedPortions(inv), allocations.filter(a => a.invoiceId === inv.id), adjustments.filter(d => d.invoiceId === inv.id));
  return {
    invoiceId: inv.id,
    patientId: inv.patientId,
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    paymentStatus: inv.rawStatus,
    ...figures
  };
}

const openItem = (overrides: Partial<OpenItem> & Pick<OpenItem, 'invoiceId' | 'outstandingCents'>): OpenItem => ({
  invoiceNumber: overrides.invoiceId.toUpperCase(),
  dateKey: '2026-09-01',
  portion: 'patient',
  ...overrides
});

describe('allocating a payment', () => {
  it('a N$ 500 cash payment against two invoices pays the oldest first and leaves N$ 50 unallocated for a refund', () => {
    const items = [
      openItem({ invoiceId: 'newer', dateKey: '2026-09-15', outstandingCents: 25000 }),
      openItem({ invoiceId: 'older', dateKey: '2026-09-01', outstandingCents: 20000 })
    ];
    const result = suggestAllocation(50000, items, payerPortions('patient'));
    expect(result.lines).toEqual([
      { invoiceId: 'older', portion: 'patient', amountCents: 20000 },
      { invoiceId: 'newer', portion: 'patient', amountCents: 25000 }
    ]);
    expect(result.unallocatedCents).toBe(5000);
  });

  it('a part payment pays what it can on the oldest invoice and leaves newer ones for later', () => {
    const items = [openItem({ invoiceId: 'older', outstandingCents: 20000 }), openItem({ invoiceId: 'newer', dateKey: '2026-09-15', outstandingCents: 25000 })];
    const result = suggestAllocation(15000, items, ['patient']);
    expect(result.lines).toEqual([{ invoiceId: 'older', portion: 'patient', amountCents: 15000 }]);
    expect(result.unallocatedCents).toBe(0);
  });

  it("puts a patient's payment on what the patient owes, never silently on what the medical aid owes", () => {
    const items = [
      openItem({ invoiceId: 'inv', portion: 'medical_aid', outstandingCents: 80000 }),
      openItem({ invoiceId: 'inv', portion: 'patient', outstandingCents: 20000 })
    ];
    const result = suggestAllocation(50000, items, payerPortions('patient'));
    expect(result.lines).toEqual([{ invoiceId: 'inv', portion: 'patient', amountCents: 20000 }]);
    // the other N$ 300 is credit until staff decide (allocate to the medical aid portion or refund)
    expect(result.unallocatedCents).toBe(30000);
  });

  it("puts a medical aid fund's lump sum on medical aid portions only, oldest claim first", () => {
    const items = [
      openItem({ invoiceId: 'b', dateKey: '2026-08-20', portion: 'medical_aid', outstandingCents: 40000 }),
      openItem({ invoiceId: 'a', dateKey: '2026-08-01', portion: 'medical_aid', outstandingCents: 30000 }),
      openItem({ invoiceId: 'a', dateKey: '2026-08-01', portion: 'patient', outstandingCents: 5000 })
    ];
    const result = suggestAllocation(50000, items, payerPortions('medical_aid'));
    expect(result.lines).toEqual([
      { invoiceId: 'a', portion: 'medical_aid', amountCents: 30000 },
      { invoiceId: 'b', portion: 'medical_aid', amountCents: 20000 }
    ]);
  });

  it('treats an undated invoice as the oldest, as the aging report does, so it is never left behind', () => {
    const sorted = sortOldestFirst([
      openItem({ invoiceId: 'dated', dateKey: '2026-01-01', outstandingCents: 1 }),
      openItem({ invoiceId: 'undated', dateKey: null, outstandingCents: 1 })
    ]);
    expect(sorted.map(item => item.invoiceId)).toEqual(['undated', 'dated']);
  });

  it('orders invoices with the same date by number as a person reads it (INV-9 before INV-10)', () => {
    const sorted = sortOldestFirst([
      openItem({ invoiceId: 'x', invoiceNumber: 'INV-10', outstandingCents: 1 }),
      openItem({ invoiceId: 'y', invoiceNumber: 'INV-9', outstandingCents: 1 })
    ]);
    expect(sorted.map(item => item.invoiceNumber)).toEqual(['INV-9', 'INV-10']);
  });

  it('refuses an allocation line above what that portion still owes, and says how much is owed', () => {
    const check = checkAllocation(50000, [{ invoiceId: 'inv', portion: 'patient', amountCents: 30000, outstandingCents: 20000 }]);
    expect(check.ok).toBe(false);
    expect(check.lineErrors['inv:patient']).toBe('More than the N$ 200.00 still owed');
  });

  it('refuses allocating more than was received, because that money does not exist', () => {
    const check = checkAllocation(10000, [
      { invoiceId: 'a', portion: 'patient', amountCents: 8000, outstandingCents: 8000 },
      { invoiceId: 'b', portion: 'patient', amountCents: 5000, outstandingCents: 9000 }
    ]);
    expect(check.ok).toBe(false);
    expect(check.error).toBe('N$ 130.00 is allocated, N$ 30.00 more than the N$ 100.00 received');
    expect(check.remainingCents).toBe(-3000);
  });

  it('accepts leaving part of a payment unallocated: it stays on the receipt as credit', () => {
    const check = checkAllocation(10000, [{ invoiceId: 'a', portion: 'patient', amountCents: 6000, outstandingCents: 6000 }]);
    expect(check.ok).toBe(true);
    expect(check.remainingCents).toBe(4000);
  });

  it('reads amounts as staff type them and refuses fractions of a cent instead of rounding them away', () => {
    expect(parseAmountInput('1,234.50')).toBe(123450);
    expect(parseAmountInput('N$ 250')).toBe(25000);
    expect(parseAmountInput(' 99.9 ')).toBe(9990);
    expect(parseAmountInput('12.345')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
    expect(parseAmountInput('0')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
  });
});

describe('invoice balance and payment status', () => {
  const inv = (overrides: Partial<LedgerInvoice> = {}) =>
    invoice({ id: 'inv', invoiceNumber: 'INV-1', total: 1000, medicalAidTotal: 800, patientTotal: 200, dueDate: '2026-10-30', ...overrides });

  it('a part payment makes the invoice part paid, and paying the rest later makes it paid', () => {
    const i = inv();
    const first = allocation({ receiptId: 'r1', invoiceId: 'inv', portion: 'patient', amountCents: 20000 });
    const afterFirst = balanceFor(i, [first]);
    expect(afterFirst.outstanding).toEqual({ medical_aid: 80000, patient: 0 });
    expect(deriveInvoiceStatus({ current: 'pending', dueDate: i.dueDate, hasEntries: true, outstanding: afterFirst.outstanding, allocatedCents: 20000, todayKey: TODAY })).toBe('partial');

    const fund = allocation({ receiptId: 'r2', invoiceId: 'inv', portion: 'medical_aid', amountCents: 80000 });
    const afterFund = balanceFor(i, [first, fund]);
    expect(afterFund.outstanding).toEqual({ medical_aid: 0, patient: 0 });
    expect(deriveInvoiceStatus({ current: 'partial', dueDate: i.dueDate, hasEntries: true, outstanding: afterFund.outstanding, allocatedCents: 100000, todayKey: TODAY })).toBe('paid');
  });

  it('reversing a receipt puts the invoices back to outstanding without deleting anything', () => {
    const i = inv({ dueDate: '2026-09-30' });
    const allocations = [
      allocation({ receiptId: 'r1', invoiceId: 'inv', portion: 'medical_aid', amountCents: 80000, reversal: { at: '2026-10-05T10:00:00Z', by: 'u1', reason: 'EFT bounced' } }),
      allocation({ receiptId: 'r1', invoiceId: 'inv', portion: 'patient', amountCents: 20000, reversal: { at: '2026-10-05T10:00:00Z', by: 'u1', reason: 'EFT bounced' } })
    ];
    const balance = balanceFor(i, allocations);
    expect(balance.outstanding).toEqual({ medical_aid: 80000, patient: 20000 });
    // both allocations are still there (with their reversal), the invoice is simply owed again
    expect(allocations).toHaveLength(2);
    expect(balance.hasActivity).toBe(false);
    expect(balance.hasEntries).toBe(true);
    // it was paid; reversed after its due date it is overdue, not pending
    expect(deriveInvoiceStatus({ current: 'paid', dueDate: i.dueDate, hasEntries: true, outstanding: balance.outstanding, allocatedCents: 0, todayKey: TODAY })).toBe('overdue');
  });

  it("ignores the allocations of a reversed receipt even if they were not reversed one by one", () => {
    const i = inv();
    const balance = invoiceFigures(billedPortions(i), [allocation({ receiptId: 'gone', invoiceId: 'inv', amountCents: 20000 })], [], new Set(['gone']));
    expect(balance.outstanding.patient).toBe(20000);
  });

  it('a shortfall transfer moves the unpaid medical aid portion to the patient without changing the total owed', () => {
    const i = inv();
    const fundPaid = allocation({ receiptId: 'r1', invoiceId: 'inv', portion: 'medical_aid', amountCents: 60000 });
    const shortfall = adjustment({ kind: 'shortfall_transfer', invoiceId: 'inv', portion: 'medical_aid', amountCents: 20000 });
    const before = balanceFor(i, [fundPaid]);
    const after = balanceFor(i, [fundPaid], [shortfall]);
    expect(before.outstanding).toEqual({ medical_aid: 20000, patient: 20000 });
    expect(after.outstanding).toEqual({ medical_aid: 0, patient: 40000 });
    expect(after.outstanding.medical_aid + after.outstanding.patient).toBe(before.outstanding.medical_aid + before.outstanding.patient);
  });

  it('a credit note lowers what is owed but is not money received, so the invoice is not part paid', () => {
    const i = inv();
    const credit = adjustment({ kind: 'credit_note', invoiceId: 'inv', portion: 'patient', amountCents: 5000 });
    const balance = balanceFor(i, [], [credit]);
    expect(balance.outstanding.patient).toBe(15000);
    expect(deriveInvoiceStatus({ current: 'pending', dueDate: i.dueDate, hasEntries: true, outstanding: balance.outstanding, allocatedCents: 0, todayKey: TODAY })).toBe('pending');
  });

  it('an invoice with no entries keeps the status staff set, so invoices marked paid before receipts stay paid', () => {
    const legacy = inv({ status: 'paid', rawStatus: 'paid' });
    expect(deriveInvoiceStatus({ current: 'paid', dueDate: null, hasEntries: false, outstanding: { medical_aid: 80000, patient: 20000 }, allocatedCents: 0, todayKey: TODAY })).toBe('paid');
    expect(owedPortions(legacy, balanceFor(legacy))).toEqual({ medical_aid: 0, patient: 0 });
    expect(collectedPortions(legacy, balanceFor(legacy))).toEqual({ medical_aid: 80000, patient: 20000 });
  });

  it('a cancelled invoice owes nothing and its status is never re-derived', () => {
    const void_ = inv({ status: 'cancelled', rawStatus: 'cancelled' });
    expect(billedPortions(void_)).toEqual({ medical_aid: 0, patient: 0 });
    expect(owedPortions(void_)).toEqual({ medical_aid: 0, patient: 0 });
    expect(deriveInvoiceStatus({ current: 'cancelled', dueDate: null, hasEntries: true, outstanding: { medical_aid: 0, patient: 0 }, allocatedCents: 0, todayKey: TODAY })).toBe('cancelled');
  });

  it('adds money in whole cents: three payments of N$ 33.33 and one of N$ 0.01 settle N$ 100.00 exactly', () => {
    const i = invoice({ id: 'c', total: 100, medicalAidTotal: 0 });
    const payments = [3333, 3333, 3333, 1].map((amountCents, index) => allocation({ receiptId: `p${index}`, invoiceId: 'c', amountCents }));
    expect(balanceFor(i, payments).outstanding).toEqual({ medical_aid: 0, patient: 0 });
  });

  it('reads the database view, where numbers arrive as strings, into exact cents', () => {
    const balance = normalizeInvoiceBalance({
      invoice_id: 'i1', medical_aid_billed: '800.00', patient_billed: '200.10', patient_allocated: '0.10',
      medical_aid_outstanding: '800.00', patient_outstanding: '200.00', shortfall_transferred: null, has_activity: true
    });
    expect(balance.billed).toEqual({ medical_aid: 80000, patient: 20010 });
    expect(balance.outstanding).toEqual({ medical_aid: 80000, patient: 20000 });
    expect(balance.shortfallCents).toBe(0);
  });
});

describe('credit notes, write-offs, corrections, shortfalls and refunds', () => {
  const owed = { medical_aid: 30000, patient: 12000 };

  it('a write-off can never exceed what the patient still owes', () => {
    const tooMuch = checkInvoiceAdjustment({ kind: 'write_off', portion: 'patient', amountCents: 12001, reason: 'Small balance', reasonCode: 'small_balance' }, owed, 'admin');
    expect(tooMuch.error).toBe('A write-off cannot be more than the N$ 120.00 still owed on the patient portion');
    expect(checkInvoiceAdjustment({ kind: 'write_off', portion: 'patient', amountCents: 12000, reason: 'Small balance', reasonCode: 'small_balance' }, owed, 'admin').ok).toBe(true);
  });

  it('only a practice admin or doctor can approve a write-off: money given up needs someone accountable', () => {
    const result = checkInvoiceAdjustment({ kind: 'write_off', portion: 'patient', amountCents: 1000, reason: 'x', reasonCode: 'bad_debt' }, owed, 'receptionist');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/admin or doctor/);
    expect(checkInvoiceAdjustment({ kind: 'write_off', portion: 'patient', amountCents: 1000, reason: 'x', reasonCode: 'bad_debt' }, owed, 'doctor').ok).toBe(true);
  });

  it('a write-off needs a reason code so the practice can see why money was given up', () => {
    expect(checkInvoiceAdjustment({ kind: 'write_off', portion: 'patient', amountCents: 1000, reason: 'x' }, owed, 'admin').error).toBe('Choose why it is written off');
  });

  it('limits a credit note on the medical aid portion by what the fund still owes, not by the invoice total', () => {
    const result = checkInvoiceAdjustment({ kind: 'credit_note', portion: 'medical_aid', amountCents: 30001, reason: 'Wrong code billed' }, owed, 'receptionist');
    expect(result.error).toBe('A credit note cannot be more than the N$ 300.00 still owed on the medical aid portion');
  });

  it('cannot move more to the patient than the medical aid still owes', () => {
    const result = checkInvoiceAdjustment({ kind: 'shortfall_transfer', portion: 'medical_aid', amountCents: 30001, reason: 'Paid at scheme rate' }, owed, 'receptionist');
    expect(result.error).toBe('Only N$ 300.00 of the medical aid portion is unpaid, so no more can be moved to the patient');
  });

  it('a correction that takes off is limited by what is owed; one that adds is not', () => {
    expect(checkInvoiceAdjustment({ kind: 'journal', portion: 'patient', direction: 'decrease', amountCents: 12001, reason: 'Typo' }, owed, null).ok).toBe(false);
    expect(checkInvoiceAdjustment({ kind: 'journal', portion: 'patient', direction: 'increase', amountCents: 999999, reason: 'Missed item' }, owed, null).ok).toBe(true);
  });

  it('every adjustment needs a reason, kept with the entry for the audit trail', () => {
    expect(checkInvoiceAdjustment({ kind: 'credit_note', portion: 'patient', amountCents: 100, reason: '  ' }, owed, 'admin').ok).toBe(false);
  });

  it('shows what each portion will owe after the adjustment before it is confirmed', () => {
    expect(outstandingAfter(owed, { kind: 'shortfall_transfer', portion: 'medical_aid' }, 10000)).toEqual({ medical_aid: 20000, patient: 22000 });
    expect(outstandingAfter(owed, { kind: 'journal', portion: 'patient', direction: 'decrease' }, 2000)).toEqual({ medical_aid: 30000, patient: 10000 });
    expect(outstandingAfter(owed, { kind: 'credit_note', portion: 'medical_aid' }, 30000)).toEqual({ medical_aid: 0, patient: 12000 });
  });

  it('a refund can never exceed the unallocated credit on the receipt', () => {
    const credit = receipt({ amountCents: 50000, allocatedCents: 45000, unallocatedCents: 5000 });
    expect(checkRefund({ amountCents: 5001, method: 'cash', reason: 'Overpaid' }, credit).error).toBe('A refund can only pay back unallocated credit: N$ 50.00 on this receipt');
    expect(checkRefund({ amountCents: 5000, method: 'cash', reason: 'Overpaid' }, credit).ok).toBe(true);
    expect(checkRefund({ amountCents: 100, method: 'cash', reason: 'x' }, { ...credit, reversal: { at: 'x', by: null, reason: 'y' } }).ok).toBe(false);
  });
});

describe('reversals', () => {
  it('reversing a receipt gives back every standing allocation per invoice portion, and its unallocated credit disappears', () => {
    const r = receipt({ id: 'rx', amountCents: 50000, allocatedCents: 45000, unallocatedCents: 5000 });
    const effects = receiptReversalEffects(r, [
      allocation({ receiptId: 'rx', invoiceId: 'i1', amountCents: 20000 }),
      allocation({ receiptId: 'rx', invoiceId: 'i2', amountCents: 25000 }),
      allocation({ receiptId: 'rx', invoiceId: 'i3', amountCents: 7000, reversal: { at: 'earlier', by: null, reason: 'moved' } })
    ], []);
    expect(effects.blockedBy).toBeNull();
    expect(effects.restores).toEqual([
      { invoiceId: 'i1', portion: 'patient', amountCents: 20000 },
      { invoiceId: 'i2', portion: 'patient', amountCents: 25000 }
    ]);
    expect(effects.restoredCents).toBe(45000);
    expect(effects.creditCents).toBe(5000);
  });

  it('refuses to reverse a receipt while a refund paid out of it stands, because that money already left the practice', () => {
    const r = receipt({ id: 'ry', amountCents: 50000, unallocatedCents: 0 });
    const refund = adjustment({ kind: 'refund', receiptId: 'ry', invoiceId: null, portion: null, amountCents: 5000, number: 'RF-000001' });
    expect(receiptReversalEffects(r, [], [refund]).blockedBy).toBe('Money was refunded from this receipt (RF-000001). Reverse the refund first.');
  });

  it('refuses to move a shortfall back to the medical aid once the patient has paid part of it', () => {
    const shortfall = adjustment({ kind: 'shortfall_transfer', invoiceId: 'i1', portion: 'medical_aid', amountCents: 20000 });
    expect(checkAdjustmentReversal(shortfall, { medical_aid: 0, patient: 15000 }, 'admin').ok).toBe(false);
    expect(checkAdjustmentReversal(shortfall, { medical_aid: 0, patient: 20000 }, 'admin').ok).toBe(true);
  });

  it('lets only an admin or doctor reverse a write-off, like approving one', () => {
    const writeOff = adjustment({ kind: 'write_off', invoiceId: 'i1', amountCents: 1000 });
    expect(checkAdjustmentReversal(writeOff, { medical_aid: 0, patient: 0 }, 'nurse').ok).toBe(false);
    expect(checkAdjustmentReversal(writeOff, { medical_aid: 0, patient: 0 }, 'admin').ok).toBe(true);
  });
});

describe('patient statement', () => {
  const invoices = [
    { id: 'i1', invoiceNumber: 'INV-1', dateKey: '2026-09-01', billed: { medical_aid: 80000, patient: 20000 }, cancelled: false },
    { id: 'i2', invoiceNumber: 'INV-2', dateKey: '2026-09-10', billed: { medical_aid: 0, patient: 30000 }, cancelled: false },
    { id: 'i3', invoiceNumber: 'INV-3', dateKey: '2026-09-11', billed: { medical_aid: 0, patient: 99900 }, cancelled: true }
  ];

  it("ends at what the invoices still owe less the credit on the account, so it agrees with the patient's balance", () => {
    const cash = receipt({ id: 'cash', amountCents: 55000, createdAt: '2026-09-12T08:00:00Z', receivedOn: '2026-09-12' });
    const fund = receipt({ id: 'fund', payerType: 'medical_aid', fundName: 'Namibia Health Plan', patientId: null, amountCents: 500000, receivedOn: '2026-09-20', createdAt: '2026-09-20T07:00:00Z' });
    const allocations = [
      allocation({ receiptId: 'cash', invoiceId: 'i1', amountCents: 20000, createdAt: cash.createdAt }),
      allocation({ receiptId: 'cash', invoiceId: 'i2', amountCents: 30000, createdAt: cash.createdAt }),
      allocation({ receiptId: 'fund', invoiceId: 'i1', portion: 'medical_aid', amountCents: 60000, createdAt: fund.createdAt })
    ];
    const credit = adjustment({ kind: 'credit_note', invoiceId: 'i1', portion: 'medical_aid', amountCents: 5000, effectiveOn: '2026-09-25', number: 'CN-000001' });
    const statement = buildStatement({ patientId: 'pt1', invoices, receipts: [cash, fund], allocations, adjustments: [credit] });

    // medical aid still owes 800 - 600 - 50 = 150; the patient owes nothing; N$ 50 of the cash is credit
    expect(statement.closing).toEqual({ medicalAid: 15000, patient: 0, credit: 5000, total: 10000 });
    expect(statement.lines.map(line => line.kind)).toEqual(['invoice', 'invoice', 'receipt', 'payment', 'credit_note']);
    // the cancelled invoice is void and not on the statement
    expect(statement.lines.some(line => line.reference === 'INV-3')).toBe(false);
    // the fund's lump sum only shows what it paid on this patient's invoice
    expect(statement.lines[3]).toMatchObject({ medicalAid: -60000, patient: 0, credit: 0 });
  });

  it('keeps a reversed receipt on the statement and adds the reversal on the day it was made', () => {
    const reversal = { at: '2026-09-15T10:00:00Z', by: 'u1', reason: 'Card payment declined' };
    const card = receipt({ id: 'card', method: 'card', amountCents: 30000, receivedOn: '2026-09-12', createdAt: '2026-09-12T08:00:00Z', reversal, unallocatedCents: 0 });
    const allocations = [allocation({ receiptId: 'card', invoiceId: 'i2', amountCents: 30000, createdAt: card.createdAt, reversal })];
    const statement = buildStatement({ patientId: 'pt1', invoices: invoices.slice(1, 2), receipts: [card], allocations, adjustments: [] });
    expect(statement.lines.map(line => [line.kind, line.balance.total])).toEqual([
      ['invoice', 30000],
      ['receipt', 0],
      ['receipt_reversed', 30000]
    ]);
    expect(statement.lines[2].description).toBe('Receipt ' + card.number + ' reversed: Card payment declined');
  });

  it('starts at a chosen date with the balance brought forward, so a monthly statement still adds up', () => {
    const statement = buildStatement({ patientId: 'pt1', invoices: invoices.slice(0, 2), receipts: [], allocations: [], adjustments: [] }, { fromKey: '2026-09-05' });
    expect(statement.lines[0]).toMatchObject({ kind: 'opening', balance: { medicalAid: 80000, patient: 20000, credit: 0, total: 100000 } });
    expect(statement.lines[1]).toMatchObject({ kind: 'invoice', reference: 'INV-2' });
    expect(statement.closing.total).toBe(130000);
  });

  it('shows a refund of credit as money paid back, which raises the balance by the refund', () => {
    const cash = receipt({ id: 'over', amountCents: 40000, receivedOn: '2026-09-12', createdAt: '2026-09-12T08:00:00Z' });
    const refund = adjustment({ kind: 'refund', receiptId: 'over', invoiceId: null, portion: null, method: 'cash', amountCents: 10000, effectiveOn: '2026-09-13' });
    const statement = buildStatement({
      patientId: 'pt1', invoices: invoices.slice(1, 2), receipts: [cash],
      allocations: [allocation({ receiptId: 'over', invoiceId: 'i2', amountCents: 30000, createdAt: cash.createdAt })], adjustments: [refund]
    });
    expect(statement.closing).toEqual({ medicalAid: 0, patient: 0, credit: 0, total: 0 });
  });
});

describe('Finance reports once receipts are in use', () => {
  it('counts takings on the day the money was received, by method, less refunds paid out that day', () => {
    const takings = dailyTakingsFromReceipts([
      receipt({ amountCents: 15000, method: 'cash', receivedOn: '2026-10-02' }),
      receipt({ amountCents: 20000, method: 'card', receivedOn: '2026-10-02' }),
      receipt({ amountCents: 50000, method: 'eft', payerType: 'medical_aid', receivedOn: '2026-10-03' }),
      receipt({ amountCents: 9900, method: 'debit_order', receivedOn: '2026-10-03' }),
      receipt({ amountCents: 7000, method: 'cash', receivedOn: '2026-10-03', reversal: { at: '2026-10-03T12:00:00Z', by: 'u1', reason: 'Captured twice' } }),
      receipt({ amountCents: 4000, method: 'cash', receivedOn: '2026-09-30' })
    ], [adjustment({ kind: 'refund', receiptId: 'x', invoiceId: null, portion: null, method: 'cash', amountCents: 2500, effectiveOn: '2026-10-02' })], october);

    expect(takings.days.map(day => [day.dateKey, day.total, day.count])).toEqual([['2026-10-03', 599, 2], ['2026-10-02', 325, 2]]);
    expect(takings.byMethod).toMatchObject({ cash: 150, card: 200, eft: 500, debit_order: 99 });
    expect(takings.cashRefunds).toBe(25);
    // the receipt captured twice and reversed is not money taken, but it is reported
    expect(takings.reversedCount).toBe(1);
    expect(takings.total).toBe(924);
  });

  it('splits money received by who paid, and reports what of it is still not allocated', () => {
    const summary = summarizeReceipts([
      receipt({ amountCents: 10000, unallocatedCents: 2500 }),
      receipt({ amountCents: 90000, payerType: 'medical_aid', fundName: 'NHP', patientId: null, unallocatedCents: 0 })
    ], october);
    expect(summary).toEqual({ received: 1000, count: 2, fromMedicalAids: 900, fromPatients: 100, unallocated: 25 });
    expect(receiptsByMethod([receipt({ amountCents: 100, method: 'card' }), receipt({ amountCents: 300, method: 'cash' })], october).map(m => m.method)).toEqual(['cash', 'card']);
  });

  it('ages what each portion still owes after a part payment, not the whole invoice', () => {
    const partPaid = invoice({ id: 'pp', total: 1000, medicalAidTotal: 800, status: 'pending', rawStatus: 'partial', dueDate: '2026-09-15' });
    const balances = { pp: balanceFor(partPaid, [allocation({ receiptId: 'r', invoiceId: 'pp', portion: 'patient', amountCents: 15000 })]) };
    const report = buildAgingReport([partPaid], TODAY, balances);
    expect(report.total).toBe(850);
    expect(report.medicalAid).toBe(800);
    expect(report.patient).toBe(50);
    // without receipts the same invoice would show as fully owed
    expect(buildAgingReport([partPaid], TODAY).total).toBe(1000);
  });

  it('counts part payments as collected against the invoices issued in the period', () => {
    const a = invoice({ id: 'a', total: 1000, medicalAidTotal: 0, issueDate: '2026-10-02' });
    const legacyPaid = invoice({ id: 'b', total: 300, medicalAidTotal: 0, issueDate: '2026-10-03', status: 'paid', rawStatus: 'paid' });
    const balances = { a: balanceFor(a, [allocation({ receiptId: 'r', invoiceId: 'a', amountCents: 40000 })]), b: balanceFor(legacyPaid) };
    const collections = summarizeCollectionsFromLedger([a, legacyPaid], october, balances);
    // N$ 400 received on a; b was marked paid before receipts existed and still counts in full
    expect(collections.collected).toBe(700);
    expect(collections.count).toBe(2);
    expect(collections.collectionRate).toBeCloseTo(700 / 1300);
  });

  it("credits a doctor with part payments on their invoices, not only with invoices marked paid", () => {
    const a = invoice({ id: 'a', total: 1000, medicalAidTotal: 0, practitionerId: 'd1', issueDate: '2026-10-02' });
    const balances = { a: balanceFor(a, [allocation({ receiptId: 'r', invoiceId: 'a', amountCents: 25000 })]) };
    const [row] = doctorProductivity([a], [], october, balances);
    expect(row.collected).toBe(250);
    expect(doctorProductivity([a], [], october)[0].collected).toBe(0);
  });

  it('reads receipts from the view with what is allocated, refunded and still unallocated', () => {
    const r = normalizeReceipt({
      receipt_id: 'r1', receipt_number: 'RC-000001', payer_type: 'medical_aid', fund_name: ' NHP ', method: 'eft', amount: '1000.00',
      received_on: '2026-10-02', source: 'batch', allocated: '900.00', refunded: '0', unallocated: '100.00'
    });
    expect(r).toMatchObject({ id: 'r1', payerType: 'medical_aid', fundName: 'NHP', amountCents: 100000, allocatedCents: 90000, unallocatedCents: 10000, reversal: null });
  });
});
