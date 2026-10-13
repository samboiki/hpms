/**
 * Staff chat list: the time of each conversation's last message. Only the time was shown, so a message from last
 * week looked as if it came today.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatListTime } from '../chatTime';

describe('chatListTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 13, 15, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('shows the time for a message today', () => {
    expect(chatListTime(new Date(2026, 9, 13, 9, 5).toISOString())).toBe('09:05');
  });

  it('shows the day, day first, for an older message (and the year when it is not this year)', () => {
    expect(chatListTime(new Date(2026, 9, 7, 9, 5).toISOString())).toBe('7 Oct');
    expect(chatListTime(new Date(2025, 11, 24, 9, 5).toISOString())).toBe('24 Dec 2025');
  });

  it('shows nothing for a date it cannot read', () => {
    expect(chatListTime('not a date')).toBe('');
  });
});
