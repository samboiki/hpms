/**
 * Patients > branch filter. Choosing the practice itself ("head office") filtered nothing, and each branch's count
 * read at most 1,000 visits and counted cancelled bookings, so the number beside a branch was not the number of
 * patients choosing it showed.
 */
import { describe, expect, it } from 'vitest';
import { branchPatientCounts, seenAtBranch } from '../branchFilter';

const atBranch = { visits: [{ branch_id: 'b1', status: 'completed' }] };
const atHeadOffice = { visits: [{ branch_id: null, status: 'completed' }] };
const cancelledOnly = { visits: [{ branch_id: 'b1', status: 'cancelled' }] };
const neverSeen = { visits: [] };

describe('seenAtBranch', () => {
  it('head office means a visit not booked at a branch', () => {
    expect(seenAtBranch(atHeadOffice.visits, 'main')).toBe(true);
    expect(seenAtBranch(atBranch.visits, 'main')).toBe(false);
  });

  it('a cancelled booking is not a visit', () => {
    expect(seenAtBranch(cancelledOnly.visits, 'b1')).toBe(false);
    expect(seenAtBranch(atBranch.visits, 'b1')).toBe(true);
  });
});

describe('branchPatientCounts', () => {
  it('counts by the same rule the filter shows', () => {
    expect(branchPatientCounts([atBranch, atHeadOffice, cancelledOnly, neverSeen], ['b1', 'b2']))
      .toEqual({ main: 1, b1: 1, b2: 0 });
  });
});
