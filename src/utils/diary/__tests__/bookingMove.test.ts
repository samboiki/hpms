import { describe, it, expect } from 'vitest';
import { isSameSlot, localMoveReasons, moveConfirmQuestion, moveProblem, type MovableBooking } from '../bookingMove';
import type { DiaryBlock } from '../blockedTime';

// An invented booking: Tuesday 6 October 2026 at 09:00 with Dr One
const booking = (overrides: Partial<MovableBooking> = {}): MovableBooking => ({
  id: 'b-1',
  date: '2026-10-06',
  time: '09:00:00',
  doctor_id: 'dr-1',
  status: 'scheduled',
  duration: 30,
  ...overrides
});
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes);
const lunch: DiaryBlock = {
  id: 'blk-1',
  practiceId: 'p-1',
  branchId: null,
  branchName: null,
  doctorId: 'dr-1',
  reason: 'Lunch',
  startDate: '2026-10-05',
  endDate: null,
  startMinutes: 13 * 60,
  endMinutes: 14 * 60,
  recurrence: 'weekdays'
};

describe('moveProblem (what may be dragged)', () => {
  it('moves a booking that has not started, the same in the day and the week grid', () => {
    expect(moveProblem(booking(), 'dr-1')).toBeNull();
    expect(moveProblem(booking({ status: 'ready' }), 'dr-1')).toBeNull();
  });

  it('keeps a visit that started, ended, was a no-show or was cancelled in its slot: the record belongs to that time', () => {
    for (const status of ['in-progress', 'completed', 'no-show', 'cancelled']) {
      expect(moveProblem(booking({ status }), 'dr-1')).toBe('Only appointments that have not started yet can be moved');
    }
  });

  it('does not move a booking to nobody: a website request gets its practitioner by opening it', () => {
    expect(moveProblem(booking({ doctor_id: '' }), '')).toBe('Open the booking to choose its practitioner first');
  });
});

describe('isSameSlot', () => {
  it('treats a drop back on its own time and practitioner as no move, so nothing is saved or asked', () => {
    expect(isSameSlot(booking(), at(6, 9), 'dr-1')).toBe(true);
  });

  it('sees another day, time or practitioner as a move', () => {
    expect(isSameSlot(booking(), at(7, 9), 'dr-1')).toBe(false);
    expect(isSameSlot(booking(), at(6, 9, 30), 'dr-1')).toBe(false);
    expect(isSameSlot(booking(), at(6, 9), 'dr-2')).toBe(false);
  });
});

describe('localMoveReasons (when the diary passes no full check)', () => {
  const nameOf = () => 'Dr One';

  it("names the practitioner's blocked time at the new time, so a move into lunch or leave is never silent", () => {
    const reasons = localMoveReasons({ blocks: [lunch], time: at(6, 13), minutes: 30, practitionerId: 'dr-1', practitionerName: nameOf });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('Lunch');
  });

  it('names a public holiday', () => {
    const reasons = localMoveReasons({ blocks: [], time: new Date(2026, 11, 25, 10), minutes: 30, practitionerId: 'dr-1', practitionerName: nameOf });
    expect(reasons.join(' ')).toMatch(/Christmas/i);
  });

  it('has nothing to say about a free weekday time', () => {
    expect(localMoveReasons({ blocks: [lunch], time: at(6, 10), minutes: 30, practitionerId: 'dr-1', practitionerName: nameOf })).toEqual([]);
  });
});

describe('moveConfirmQuestion', () => {
  it('lists every reason before asking, so reception decides knowing all of them', () => {
    expect(moveConfirmQuestion(['A clash.', 'A holiday.'])).toBe('A clash.\nA holiday.\n\nMove the appointment here anyway?');
  });
});
