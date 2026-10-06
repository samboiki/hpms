import { describe, it, expect } from 'vitest';
import { isOpenBatch, OPEN_BATCH_STATUSES } from '../claimsService';
import { batchStatus } from '../status';

// Business rule: a batch can change (lines added or removed, visits reopened, submission) only until
// it is sent. Other screens (visits store, edit visit) rely on exactly these semantics.
describe('isOpenBatch', () => {
  it.each([
    { status: 'active', sent_at: null, open: true },
    { status: 'ACTIVE', sent_at: null, open: true },
    { status: null, sent_at: null, open: true },
    { status: 'open', sent_at: null, open: true },
    { status: 'draft', sent_at: null, open: true },
    { status: 'ready', sent_at: null, open: true },
    { status: 'sending', sent_at: null, open: false },
    { status: 'sent', sent_at: null, open: false },
    { status: 'active', sent_at: '2026-10-05T10:00:00Z', open: false },
    { status: 'paid', sent_at: null, open: false },
    { status: 'unpaid', sent_at: '2026-10-05T10:00:00Z', open: false },
    { status: 'confirmed', sent_at: null, open: false },
    { status: 'rejected', sent_at: null, open: false }
  ])('$status / sent_at $sent_at -> open: $open', ({ status, sent_at, open }) => {
    expect(isOpenBatch({ status, sent_at })).toBe(open);
  });

  it('lists the open statuses', () => {
    expect(OPEN_BATCH_STATUSES).toEqual(['active', 'open', 'draft', 'ready']);
  });

  it('labels statuses for staff, including ones it does not know', () => {
    expect(batchStatus({ status: 'active', sent_at: null }).label).toBe('Open');
    expect(batchStatus({ status: null, sent_at: '2026-10-05' }).label).toBe('Submitted');
    expect(batchStatus({ status: 'archived', sent_at: null }).label).toBe('archived');
  });
});
