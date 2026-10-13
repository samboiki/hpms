import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../services/communicationService', () => ({ communicationService: {} }));

import { getInvoiceLock, blocksReopen, claimedInvoiceNotice, sentClaimOf } from '../invoiceLock';

const openBatch = { status: 'active', sent_at: null };
const sentBatch = { status: 'sent', sent_at: '2026-10-01T08:00:00Z' };

describe('getInvoiceLock', () => {
  it('leaves an unpaid invoice outside any batch editable', () => {
    expect(getInvoiceLock({ payment_status: 'pending', batch_id: null })).toBeNull();
  });

  it('locks a paid invoice even before it is batched, because money was received against it', () => {
    expect(getInvoiceLock({ payment_status: 'paid', batch_id: null })).toBe('paid');
  });

  it('locks a part-paid invoice too: changing its lines would leave the receipt allocated to a different bill', () => {
    const lock = getInvoiceLock({ payment_status: 'partial', batch_id: null });
    expect(lock).toBe('paid');
    expect(blocksReopen(lock)).toBe(true);
  });

  it('keeps an invoice in the unsent batch reopenable, since medical aid invoices are batched automatically', () => {
    // Every medical aid invoice joins the open batch about a second after it is created.
    // Treating that as "submitted" would make every medical aid visit impossible to reopen.
    const lock = getInvoiceLock({ payment_status: 'pending', batch_id: 'b1' }, openBatch);
    expect(lock).toBe('in-open-batch');
    expect(blocksReopen(lock)).toBe(false);
  });

  it('blocks reopening once the claim was sent to the fund', () => {
    const lock = getInvoiceLock({ payment_status: 'pending', batch_id: 'b1' }, sentBatch);
    expect(lock).toBe('claim-sent');
    expect(blocksReopen(lock)).toBe(true);
  });

  it('treats a batch marked active but with a sent date as sent', () => {
    expect(getInvoiceLock({ payment_status: 'pending', batch_id: 'b1' }, { status: 'active', sent_at: '2026-10-01T08:00:00Z' })).toBe('claim-sent');
  });

  it('treats a batch it cannot read as sent, so missing data never unlocks a claim', () => {
    expect(getInvoiceLock({ payment_status: 'pending', batch_id: 'b1' }, null)).toBe('claim-sent');
  });
});

// Since 2026-10-08 the database keeps a sent batch exactly as the fund received it: a change saved on a claimed
// invoice silently never reaches the fund, so the editing screen must say so first and point to the real corrections
describe('a claimed invoice', () => {
  // Since 2026-10-09 a sent line is corrected and sent again from its batch without waiting for a refusal
  it('names the batch and the day it was sent, and the two ways to correct a claim', () => {
    const claim = sentClaimOf({ payment_status: 'pending', batch_id: 'b1' }, { ...sentBatch, sent_at: '2026-10-03T10:00:00+02:00', batch_number: 1042 });
    expect(claim).toEqual({ batchId: 'b1', batchNumber: 1042, sentAt: '2026-10-03T10:00:00+02:00' });
    expect(claimedInvoiceNotice(claim!)).toBe(
      'Already claimed in batch 1042 on 3 Oct 2026: this change is not sent to the fund. Use a credit note, or correct the line in its batch and send it again.'
    );
  });

  it('is claimed even when paid, and when its batch cannot be read (then without a number or date)', () => {
    expect(sentClaimOf({ payment_status: 'paid', batch_id: 'b1' }, { ...sentBatch, batch_number: 7 })?.batchNumber).toBe(7);
    expect(claimedInvoiceNotice(sentClaimOf({ payment_status: 'pending', batch_id: 'b1' }, null)!)).toMatch(/^Already claimed in a claim batch: this change is not sent/);
  });

  it('is not claimed outside a batch or while its batch is still open (the open batch takes the change)', () => {
    expect(sentClaimOf({ payment_status: 'pending', batch_id: null })).toBeNull();
    expect(sentClaimOf({ payment_status: 'pending', batch_id: 'b1' }, openBatch)).toBeNull();
  });
});
