import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../services/communicationService', () => ({ communicationService: {} }));

import { getInvoiceLock, blocksReopen } from '../invoiceLock';

const openBatch = { status: 'active', sent_at: null };
const sentBatch = { status: 'sent', sent_at: '2026-10-01T08:00:00Z' };

describe('getInvoiceLock', () => {
  it('leaves an unpaid invoice outside any batch editable', () => {
    expect(getInvoiceLock({ payment_status: 'pending', batch_id: null })).toBeNull();
  });

  it('locks a paid invoice even before it is batched, because money was received against it', () => {
    expect(getInvoiceLock({ payment_status: 'paid', batch_id: null })).toBe('paid');
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
