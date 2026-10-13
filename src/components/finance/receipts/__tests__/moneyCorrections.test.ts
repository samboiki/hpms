/**
 * Owner decisions of 13 October 2026: refunds, payment reversals and credit notes are for practice administrators
 * only, and the practice gives no discounts on invoices. The screens hide those actions from everyone else; these
 * tests check the service refuses them too, with a plain message and before anything reaches the database (so a
 * receptionist on an old screen, or a hand-made call, cannot move money back). Invented ids only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, state } = vi.hoisted(() => ({
  rpc: vi.fn(),
  state: { role: 'receptionist' as string | null }
}));
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: { getState: () => ({ user: state.role ? { role: state.role } : null }) }
}));

import { postAdjustment, reverseAdjustment, reverseAllocation, reverseReceipt } from '../arService';
import { postCreditNoteLines } from '../creditNoteService';
import { canCorrectMoney, moneyCorrectionRefusal } from '../../../../services/ledger/moneyRights';

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { id: 'a1', number: 'X-1', kind: 'journal', receipt_number: 'RC-1', allocation_id: 'al1' }, error: null });
});

describe('who may take money back', () => {
  it('is the practice administrator only, because a refund or reversal changes what the practice was paid', () => {
    expect(canCorrectMoney('admin')).toBe(true);
    for (const role of ['doctor', 'nurse', 'receptionist', null, undefined]) expect(canCorrectMoney(role)).toBe(false);
    expect(moneyCorrectionRefusal('refund', 'receptionist')).toBe('Only a practice administrator can refund money. Ask an administrator to do it.');
    expect(moneyCorrectionRefusal('credit_note', 'admin')).toBeNull();
  });
});

describe('the service refuses a non-administrator before the database is called', () => {
  it.each(['receptionist', 'doctor', 'nurse'])('%s cannot refund, reverse or credit', async role => {
    state.role = role;
    await expect(postAdjustment({ practiceId: 'p', kind: 'refund', receiptId: 'r', amountCents: 100, method: 'cash', reason: 'x' })).rejects.toThrow(/Only a practice administrator can refund/);
    await expect(postAdjustment({ practiceId: 'p', kind: 'credit_note', invoiceId: 'i', portion: 'patient', amountCents: 100, reason: 'x' })).rejects.toThrow(/credit note/);
    await expect(reverseReceipt('r', 'x')).rejects.toThrow(/reverse a receipt/);
    await expect(reverseAllocation('al', 'x')).rejects.toThrow(/take a payment off an invoice/);
    await expect(reverseAdjustment('a', 'x')).rejects.toThrow(/reverse an entry/);
    await expect(postCreditNoteLines({ practiceId: 'p', invoiceId: 'i', reason: 'x', lines: [] })).rejects.toThrow(/credit note/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('still lets reception record the everyday entries (a shortfall moved to the patient, a correction)', async () => {
    state.role = 'receptionist';
    await postAdjustment({ practiceId: 'p', kind: 'shortfall_transfer', invoiceId: 'i', portion: 'medical_aid', amountCents: 100, reason: 'x' });
    expect(rpc).toHaveBeenCalledWith('ar_post_adjustment', expect.anything());
  });

  it('lets an administrator refund and reverse', async () => {
    state.role = 'admin';
    await postAdjustment({ practiceId: 'p', kind: 'refund', receiptId: 'r', amountCents: 100, method: 'cash', reason: 'x' });
    await reverseReceipt('r', 'bounced');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe('discounts', () => {
  it('are not given at all, not even by an administrator, because the practice does not discount invoices', async () => {
    state.role = 'admin';
    await expect(postAdjustment({ practiceId: 'p', kind: 'discount', invoiceId: 'i', portion: 'patient', amountCents: 100, reason: 'x' })).rejects.toThrow(/does not give discounts/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
