import { describe, it, expect } from 'vitest';
import { formatNotificationTime } from '../notificationTime';

// Tuesday 6 October 2026, 09:00 local time
const now = new Date(2026, 9, 6, 9, 0, 0);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute, 0);

// Reception reads these times to decide what needs attention first.
describe('formatNotificationTime', () => {
  it('shows when a follow-up later today is due, instead of claiming it happened "Just now"', () => {
    expect(formatNotificationTime(at(6, 15), now)).toBe('Today 3:00 PM');
  });

  it('marks tomorrow and later scheduled items with their day, written day-first', () => {
    expect(formatNotificationTime(at(7, 8, 30), now)).toBe('Tomorrow 8:30 AM');
    expect(formatNotificationTime(at(12, 10), now)).toBe('12 Oct, 10:00 AM');
  });

  it('keeps showing how long ago recent requests arrived', () => {
    expect(formatNotificationTime(now, now)).toBe('Just now');
    expect(formatNotificationTime(at(6, 8, 15), now)).toBe('45m ago');
    expect(formatNotificationTime(at(5, 18), now)).toBe('15h ago');
  });

  it('writes older dates day-first, as Namibian staff read them', () => {
    expect(formatNotificationTime(at(1, 14, 5), now)).toBe('1 Oct, 2:05 PM');
  });

  it('shows nothing for a booking saved without a time, instead of crashing the panel', () => {
    expect(formatNotificationTime(new Date('2026-10-06Tnull'), now)).toBe('');
  });
});
