import { describe, it, expect } from 'vitest';
import { billingBadgeFor, billingBadgesByVisit } from '../billingBadge';
import type { BookingInvoice } from '../patientBookings';

const invoice = (visitId: string, paymentStatus: string | null, id = `${visitId}-${paymentStatus}`): BookingInvoice => ({
  id,
  visitId,
  number: 'INV-1',
  paymentStatus
});

// Parity B13: reception sees on the diary card whether a visit is still to be billed, billed, or settled, without
// opening it (Eminance shows "invoiced" then "paid")
describe('the diary card\'s billing badge', () => {
  it('says "Invoiced" once the visit has an invoice that is not settled, including one part paid', () => {
    expect(billingBadgeFor([{ paymentStatus: 'pending' }])).toBe('invoiced');
    expect(billingBadgeFor([{ paymentStatus: 'overdue' }])).toBe('invoiced');
    expect(billingBadgeFor([{ paymentStatus: 'partial' }])).toBe('invoiced');
  });

  it('says "Paid" only when every invoice of the visit is paid', () => {
    expect(billingBadgeFor([{ paymentStatus: 'paid' }])).toBe('paid');
    expect(billingBadgeFor([{ paymentStatus: 'paid' }, { paymentStatus: 'pending' }])).toBe('invoiced');
  });

  it('ignores a cancelled invoice, so a re-done invoice decides the badge and a cancelled one alone shows none', () => {
    expect(billingBadgeFor([{ paymentStatus: 'cancelled' }, { paymentStatus: 'paid' }])).toBe('paid');
    expect(billingBadgeFor([{ paymentStatus: 'void' }])).toBeNull();
    expect(billingBadgeFor([])).toBeNull();
  });

  it('groups the invoices read for the whole diary by visit', () => {
    const badges = billingBadgesByVisit([invoice('v1', 'paid'), invoice('v2', 'pending'), invoice('v3', 'cancelled')]);
    expect(badges.get('v1')).toBe('paid');
    expect(badges.get('v2')).toBe('invoiced');
    expect(badges.has('v3')).toBe(false);
  });
});
