import { describe, expect, it } from 'vitest';
import { dispensingBilling, repeatsText, type VisitBill } from '../dispensingStatus';

const record = { cancelledAt: null, billed: true, visitId: 'v1', itemId: 'i1' };
const bills = new Map<string, VisitBill>([['v1', { invoiceId: 'inv1', invoiceNumber: 'INV-0042', units: new Map([['i1', 30]]) }]]);

describe('is the dispensed medicine on a bill?', () => {
  it('names the invoice when the visit was saved with the line, so staff can open it', () => {
    expect(dispensingBilling(record, bills)).toEqual({ state: 'billed', invoiceId: 'inv1', invoiceNumber: 'INV-0042' });
  });

  it('says the line waits for the visit to be saved, so nobody thinks it is already charged', () => {
    expect(dispensingBilling({ ...record, visitId: 'v2' }, bills, new Set(['i1']))).toEqual({ state: 'on_bill_unsaved' });
  });

  it('flags medicine handed over but never billed (the visit was not saved, or the line was removed)', () => {
    expect(dispensingBilling({ ...record, visitId: 'v2' }, bills)).toEqual({ state: 'not_on_bill' });
  });

  it('treats medicine given without billing and cancelled records as such, never as missing from a bill', () => {
    expect(dispensingBilling({ ...record, billed: false }, bills)).toEqual({ state: 'given' });
    expect(dispensingBilling({ ...record, cancelledAt: '2026-10-08T09:00:00Z' }, bills)).toEqual({ state: 'cancelled' });
  });
});

describe('repeats on the label', () => {
  it('tells the patient how many repeats a script has, and which repeat this is', () => {
    expect(repeatsText({ repeatOf: null, repeatsAllowed: 2 }, null, null)).toBe('2 repeats');
    expect(repeatsText({ repeatOf: 'd1', repeatsAllowed: 0 }, 1, 2)).toBe('Repeat 1 of 2');
    expect(repeatsText({ repeatOf: null, repeatsAllowed: 0 }, null, null)).toBeNull();
  });
});
