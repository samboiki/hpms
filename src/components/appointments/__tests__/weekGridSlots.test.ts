import { describe, it, expect } from 'vitest';
import { buildWeekTimeSlots, slotForTime } from '../weekGridSlots';

// The week timeline only draws appointments that fall in one of its rows. An appointment that
// matches no row is invisible, so its slot looks free and reception may double-book the doctor.
describe('slotForTime', () => {
  it('shows an appointment that does not start on the half hour in the row it falls in', () => {
    expect(slotForTime('09:15')).toBe('09:00');
    expect(slotForTime('09:45:00')).toBe('09:30');
  });

  it('keeps on-the-hour and half-past bookings in their own row', () => {
    expect(slotForTime('14:00:00')).toBe('14:00');
    expect(slotForTime('14:30')).toBe('14:30');
  });

  it('reads times saved without a leading zero', () => {
    expect(slotForTime('9:05')).toBe('09:00');
  });
});

describe('buildWeekTimeSlots', () => {
  it('shows the normal clinic day, 08:00 to 17:30, when nothing is booked outside it', () => {
    const slots = buildWeekTimeSlots(['09:00', '16:30:00']);
    expect(slots[0]).toBe('08:00');
    expect(slots[slots.length - 1]).toBe('17:30');
    expect(slots).toHaveLength(20);
  });

  it('adds rows for early and late appointments instead of hiding them', () => {
    const times = ['07:15:00', '19:45:00'];
    const slots = buildWeekTimeSlots(times);
    expect(slots[0]).toBe('07:00');
    expect(slots[slots.length - 1]).toBe('19:30');
    times.forEach((time) => expect(slots).toContain(slotForTime(time)));
  });

  it('ignores appointments without a time instead of stretching the day to midnight', () => {
    expect(buildWeekTimeSlots([null, undefined, ''])).toEqual(buildWeekTimeSlots([]));
  });
});
