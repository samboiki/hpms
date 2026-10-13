import { describe, it, expect } from 'vitest';
import { isOpenBatch, OPEN_BATCH_STATUSES } from '../claimsService';
import { LINE_OUTCOME_META, batchStatus, isClaimLineOutcome } from '../status';

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

  // The database moves a sent batch on with the funds' answers (claim_batch_refresh_status): each status it can set
  // must read as plain words with what it means, or staff see a code instead of where their money stands
  it.each([
    ['sent', 'Submitted'],
    ['confirmed', 'Acknowledged'],
    ['partially_paid', 'Partly paid'],
    ['paid', 'Paid'],
    ['unpaid', 'Some not paid'],
    ['rejected', 'Not paid']
  ])('a batch the funds answered as %s reads "%s", with what it means', (status, label) => {
    const shown = batchStatus({ status, sent_at: '2026-10-05T08:00:00Z' });
    expect(shown.label).toBe(label);
    expect(shown.hint).toBeTruthy();
  });
});

describe('LINE_OUTCOME_META', () => {
  // Claim lines are coloured by what the fund answered; colour alone fails colour-blind staff and printouts
  it('gives every outcome, and "no answer yet", a word and an icon besides its colour', () => {
    for (const key of ['paid', 'part_paid', 'rejected', 'waiting', 'none'] as const) {
      expect(LINE_OUTCOME_META[key].label.length).toBeGreaterThan(2);
      expect(LINE_OUTCOME_META[key].icon).toMatch(/^solar:/);
    }
    expect(new Set(Object.values(LINE_OUTCOME_META).map(meta => meta.label)).size).toBe(5);
  });

  it('only accepts the four answers the database gives', () => {
    expect(['paid', 'part_paid', 'rejected', 'waiting'].every(isClaimLineOutcome)).toBe(true);
    expect(isClaimLineOutcome('pended')).toBe(false);
    expect(isClaimLineOutcome(null)).toBe(false);
  });
});
