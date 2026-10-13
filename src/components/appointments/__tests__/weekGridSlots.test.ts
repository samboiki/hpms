import { describe, it, expect } from 'vitest';
import { slotForTime } from '../weekGridSlots';
import { gridRowTimes, shownGridRange } from '../../../utils/diary/gridHours';

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

// The rows themselves (the day's hours, widened to early and late bookings) are tested in
// src/utils/diary/__tests__/gridHours.test.ts
describe('rows of the week grid', () => {
  it('puts early and late appointments in rows of their own instead of hiding them', () => {
    const range = shownGridRange([{ open: 8 * 60, close: 17 * 60 }], [
      { start: 7 * 60 + 15, minutes: 30 },
      { start: 19 * 60 + 45, minutes: 15 }
    ]);
    const rows = gridRowTimes(range);
    expect(rows[0]).toBe('07:00');
    expect(rows[rows.length - 1]).toBe('19:30');
    ['07:15:00', '19:45:00'].forEach((time) => expect(rows).toContain(slotForTime(time)));
  });
});
