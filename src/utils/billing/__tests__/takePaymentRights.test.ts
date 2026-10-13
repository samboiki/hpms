/**
 * Who sees "Invoice and take payment" on a visit. The step saves the visit and then records a receipt,
 * so it is offered only to someone the database will let do both: raise the invoice (invoiceRights)
 * and record the receipt (ar_post_receipt accepts staff of the practice the money is for). Offering it
 * to anyone else would save the visit and then end in a refusal at the till.
 */
import { describe, expect, it } from 'vitest';
import { BILLING_ROLES, canInvoiceAndTakePayment, takePaymentProblem } from '../invoiceRights';

describe('who may invoice and take payment in one step', () => {
  it.each(BILLING_ROLES)('offers it to an active %s of the practice: reception takes the money at the desk', role => {
    expect(takePaymentProblem({ role, is_active: true, practice_id: 'practice-a' }, 'practice-a')).toBeNull();
    expect(canInvoiceAndTakePayment({ role, practice_id: 'practice-a' }, 'practice-a')).toBe(true);
  });

  it('does not offer it for another practice: the database records receipts only for the person\'s own practice', () => {
    expect(canInvoiceAndTakePayment({ role: 'receptionist', practice_id: 'practice-a' }, 'practice-b')).toBe(false);
    expect(takePaymentProblem({ role: 'admin', practice_id: 'practice-a' }, 'practice-b')).toMatch(/practice/);
  });

  it('does not offer it without a practice on either side', () => {
    expect(canInvoiceAndTakePayment({ role: 'doctor', practice_id: null }, null)).toBe(false);
    expect(canInvoiceAndTakePayment({ role: 'doctor', practice_id: 'practice-a' }, '')).toBe(false);
  });

  it('follows the invoice rights first: someone who may not raise the invoice is told why, in the same words', () => {
    expect(takePaymentProblem({ role: 'cleaner', practice_id: 'practice-a' }, 'practice-a')).toMatch(/cannot create invoices/);
    expect(takePaymentProblem({ role: 'nurse', is_active: false, practice_id: 'practice-a' }, 'practice-a')).toMatch(/switched off/);
    expect(takePaymentProblem(null, 'practice-a')).toMatch(/Sign in/);
  });
});
