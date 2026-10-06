import { describe, it, expect } from 'vitest';
import { parseTime12Hour } from '../businessHours';

describe('parseTime12Hour', () => {
  it('reads the stored "9:00 AM" style, so editing an older branch shows its real opening time instead of 09:00', () => {
    expect(parseTime12Hour('8:00 AM')).toBe('08:00');
    expect(parseTime12Hour('6:30 PM')).toBe('18:30');
  });

  it('handles noon and midnight, which a naive +12 for PM gets wrong', () => {
    expect(parseTime12Hour('12:00 PM')).toBe('12:00');
    expect(parseTime12Hour('12:15 AM')).toBe('00:15');
  });

  it('accepts lower-case and dotted markers and times already in 24-hour form', () => {
    expect(parseTime12Hour('5:00 p.m.')).toBe('17:00');
    expect(parseTime12Hour('17:00')).toBe('17:00');
  });

  it('returns null for text it cannot read, so the form falls back to a default instead of a wrong time', () => {
    expect(parseTime12Hour('Closed')).toBeNull();
    expect(parseTime12Hour('13:00 PM')).toBeNull();
    expect(parseTime12Hour('25:00')).toBeNull();
    expect(parseTime12Hour('9:75 AM')).toBeNull();
  });
});
