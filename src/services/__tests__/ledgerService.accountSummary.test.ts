/**
 * The patient file's money at a glance: credit and the last payment on the Billing summary, and the
 * alerts beside the name when the file opens (a promise to pay still open or overdue, credit-control
 * notes on record). They use the debtors' rules, so the file never contradicts Finance > Debtors.
 * Amounts are cents.
 */
import { describe, it, expect } from 'vitest';
import {
  accountAlerts,
  familyAccounts,
  patientMoneySummary,
  promiseAlertText,
  type AccountHolderLink,
  type ArReceipt,
  type PaymentPromise
} from '../ledgerService';

const TODAY = '2026-10-08';

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
    createdAt: '2026-10-02T09:00:00+02:00',
    reversal: null,
    allocatedCents: 10000,
    refundedCents: 0,
    unallocatedCents: 0,
    ...overrides
  };
};

const reversal = { at: '2026-10-03T10:00:00+02:00', by: 'u1', reason: 'EFT bounced' };

const promise = (overrides: Partial<PaymentPromise> = {}): PaymentPromise => ({
  id: `pp${++seq}`,
  patientId: 'pt1',
  madeOn: '2026-10-01',
  promisedOn: '2026-10-15',
  amountCents: 20000,
  note: null,
  createdBy: 'u1',
  createdAt: '2026-10-01T09:00:00+02:00',
  cancelledAt: null,
  cancelReason: null,
  ...overrides
});

describe('the Billing summary: credit and the last payment', () => {
  it('shows money the patient paid in that is not used on an invoice yet, so staff allocate or refund it', () => {
    const summary = patientMoneySummary([
      receipt({ unallocatedCents: 5000 }),
      receipt({ unallocatedCents: 2500, reversal }), // reversed: the money is gone
      receipt({ payerType: 'medical_aid', patientId: null, fundName: 'NHP', unallocatedCents: 9000 }), // the fund's suspense, not the patient's
      receipt({ patientId: 'someone-else', unallocatedCents: 100 })
    ], 'pt1');
    expect(summary.creditCents).toBe(5000);
  });

  it('shows the latest payment by or for the patient; a medical aid payment or a reversed receipt is not the patient paying', () => {
    const summary = patientMoneySummary([
      receipt({ receivedOn: '2026-09-01', amountCents: 30000 }),
      receipt({ payerType: 'other', payerName: 'Employer', receivedOn: '2026-09-20', amountCents: 15000 }),
      receipt({ payerType: 'medical_aid', fundName: 'NHP', receivedOn: '2026-10-01', amountCents: 90000 }),
      receipt({ receivedOn: '2026-10-05', amountCents: 5000, reversal })
    ], 'pt1');
    expect(summary.lastPayment).toMatchObject({ receivedOn: '2026-09-20', amountCents: 15000 });
  });

  it('takes the payment recorded last when two came in on the same day', () => {
    const summary = patientMoneySummary([
      receipt({ number: 'RC-LATE', receivedOn: '2026-10-06', createdAt: '2026-10-06T15:00:00+02:00', amountCents: 2000 }),
      receipt({ number: 'RC-EARLY', receivedOn: '2026-10-06', createdAt: '2026-10-06T08:00:00+02:00', amountCents: 7000 })
    ], 'pt1');
    expect(summary.lastPayment).toEqual({ receivedOn: '2026-10-06', amountCents: 2000, receiptNumber: 'RC-LATE' });
  });

  it('has no last payment and no credit for a patient who never paid', () => {
    expect(patientMoneySummary([], 'pt1')).toEqual({ creditCents: 0, lastPayment: null });
  });
});

describe('alerts when the patient file opens', () => {
  const alerts = (overrides: Partial<Parameters<typeof accountAlerts>[0]> = {}) =>
    accountAlerts({ accountId: 'pt1', promises: [], receipts: [], hasNotes: false, todayKey: TODAY, ...overrides });

  it('shows an open promise with its amount and date, so the desk knows what was agreed', () => {
    const result = alerts({ promises: [promise()] });
    expect(result.promise).toEqual({ promisedOn: '2026-10-15', amountCents: 20000, state: 'open', shortCents: 20000 });
    expect(promiseAlertText(result.promise!)).toBe('Promised N$ 200.00 by 15 Oct 2026');
  });

  it('marks a promise overdue once its day passed unpaid, with what is still short, so staff ask about it', () => {
    const result = alerts({
      promises: [promise({ promisedOn: '2026-10-05' })],
      receipts: [receipt({ receivedOn: '2026-10-03', amountCents: 5000 })]
    });
    expect(result.promise).toMatchObject({ state: 'broken', shortCents: 15000 });
    expect(promiseAlertText(result.promise!)).toBe('Promise overdue: N$ 150.00 not paid by 5 Oct 2026');
  });

  it('says a promise is due today on its day', () => {
    expect(promiseAlertText(alerts({ promises: [promise({ promisedOn: TODAY })] }).promise!)).toBe('Promised N$ 200.00 today');
  });

  it('shows nothing for a kept promise: the patient paid what they promised in time', () => {
    const result = alerts({ promises: [promise()], receipts: [receipt({ receivedOn: '2026-10-04', amountCents: 20000 })] });
    expect(result.promise).toBeNull();
  });

  it('follows only the latest promise: a new promise replaces an older broken one', () => {
    const result = alerts({
      promises: [
        promise({ madeOn: '2026-09-01', promisedOn: '2026-09-10', createdAt: '2026-09-01T09:00:00+02:00' }),
        promise({ madeOn: '2026-10-06', promisedOn: '2026-10-20', amountCents: 8000, createdAt: '2026-10-06T09:00:00+02:00' })
      ]
    });
    expect(result.promise).toMatchObject({ state: 'open', promisedOn: '2026-10-20', amountCents: 8000 });
  });

  it('ignores a cancelled promise and a promise on another account', () => {
    const result = alerts({ promises: [promise({ cancelledAt: '2026-10-02T10:00:00+02:00', cancelReason: 'Paid by EFT' }), promise({ patientId: 'pt9' })] });
    expect(result.promise).toBeNull();
  });

  it('counts a payment on a family member\'s file towards the account holder\'s promise', () => {
    const links: AccountHolderLink[] = [{ id: 'l1', patientId: 'kid', holderId: 'pt1', relationship: 'child', linkedBy: 'u1', linkedAt: null, unlinkedAt: null, unlinkReason: null }];
    const result = alerts({
      promises: [promise({ promisedOn: '2026-10-05' })],
      receipts: [receipt({ patientId: 'kid', receivedOn: '2026-10-04', amountCents: 20000 })],
      accountOf: familyAccounts(links).accountOf
    });
    expect(result.promise).toBeNull();
  });

  it('says credit-control notes exist only when there are some', () => {
    expect(alerts({ hasNotes: true }).hasNotes).toBe(true);
    expect(alerts()).toEqual({ promise: null, hasNotes: false });
  });
});
