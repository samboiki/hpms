import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { visitOverlapsSlot, type ConflictVisit } from '../appointments';

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 9, 6, h, m, 0, 0);
};

const visit = (overrides: Partial<ConflictVisit> = {}): ConflictVisit => ({
  id: 'v1',
  visit_date: '2026-10-06',
  visit_time: '09:00',
  scheduled_date: '2026-10-06',
  scheduled_time: '09:00',
  status: 'scheduled',
  is_cancelled: false,
  ...overrides
});

// The booking form relies on this to stop two patients being booked with one doctor at once.
describe('visitOverlapsSlot', () => {
  it('blocks a booking that starts inside an existing 30-minute visit', () => {
    expect(visitOverlapsSlot(visit(), at('09:15'), 30)).toBe(true);
  });

  it('blocks a longer booking that runs into a later visit', () => {
    expect(visitOverlapsSlot(visit(), at('08:30'), 60)).toBe(true);
  });

  it('allows back-to-back bookings that only touch at the edge', () => {
    expect(visitOverlapsSlot(visit(), at('09:30'), 30)).toBe(false);
    expect(visitOverlapsSlot(visit(), at('08:30'), 30)).toBe(false);
  });

  it('frees the slot of cancelled visits and no-shows', () => {
    expect(visitOverlapsSlot(visit({ is_cancelled: true }), at('09:00'), 30)).toBe(false);
    expect(visitOverlapsSlot(visit({ status: 'cancelled' }), at('09:00'), 30)).toBe(false);
    expect(visitOverlapsSlot(visit({ status: 'no-show' }), at('09:00'), 30)).toBe(false);
  });

  it('still blocks the slot while the patient is being seen', () => {
    expect(visitOverlapsSlot(visit({ status: 'in-progress' }), at('09:10'), 15)).toBe(true);
  });

  it('uses the booked (scheduled) time when visit time is missing', () => {
    expect(visitOverlapsSlot(visit({ visit_time: null, visit_date: null }), at('09:00'), 30)).toBe(true);
  });

  it('ignores a visit with no time recorded instead of guessing', () => {
    expect(visitOverlapsSlot(visit({ visit_time: null, scheduled_time: null }), at('09:00'), 30)).toBe(false);
  });
});
