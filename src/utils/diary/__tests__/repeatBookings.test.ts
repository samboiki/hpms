import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REPEAT_RULE,
  REPEAT_MAX_BOOKINGS,
  describeRepeat,
  repeatDates,
  seriesWarnings,
  validateRepeatRule,
  type RepeatRule
} from '../repeatBookings';

const rule = (overrides: Partial<RepeatRule> = {}): RepeatRule => ({ ...DEFAULT_REPEAT_RULE, ...overrides });

describe('repeatDates', () => {
  it('books a weekly course on the same weekday, the first booking included', () => {
    expect(repeatDates('2026-10-08', rule({ every: 1, unit: 'weeks', ends: 'count', count: 4 }))).toEqual([
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
      '2026-10-29'
    ]);
  });

  it('books dressings every two days until a date, that day included', () => {
    expect(repeatDates('2026-10-08', rule({ every: 2, unit: 'days', ends: 'until', until: '2026-10-14' }))).toEqual([
      '2026-10-08',
      '2026-10-10',
      '2026-10-12',
      '2026-10-14'
    ]);
  });

  it('keeps monthly reviews on the same date, or the last day of a shorter month', () => {
    expect(repeatDates('2027-01-31', rule({ unit: 'months', count: 3 }))).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it(`never makes more than ${REPEAT_MAX_BOOKINGS} bookings, whatever is typed`, () => {
    expect(repeatDates('2026-10-08', rule({ unit: 'days', count: 500 }))).toHaveLength(REPEAT_MAX_BOOKINGS);
  });
});

describe('validateRepeatRule', () => {
  it('returns the days of a sensible series', () => {
    expect(validateRepeatRule('2026-10-08', rule({ count: 3 }))).toEqual({ ok: true, dates: ['2026-10-08', '2026-10-15', '2026-10-22'] });
  });

  it('explains in plain words what to fix', () => {
    expect(validateRepeatRule('2026-10-08', rule({ every: 0 }))).toEqual({ ok: false, errors: ['Repeat every 1 to 52 weeks.'] });
    expect(validateRepeatRule('2026-10-08', rule({ ends: 'until', until: '2026-10-01' }))).toEqual({
      ok: false,
      errors: ['The last day must be after the first booking.']
    });
    expect(validateRepeatRule('2026-10-08', rule({ count: 1 }))).toEqual({ ok: false, errors: ['Choose 2 to 52 bookings.'] });
  });

  it('refuses a series that would be cut off at the maximum, instead of silently stopping', () => {
    const result = validateRepeatRule('2026-10-08', rule({ unit: 'days', ends: 'until', until: '2027-10-08' }));
    expect(result.ok).toBe(false);
  });

  it('refuses an end date that leaves only the first booking', () => {
    expect(validateRepeatRule('2026-10-08', rule({ unit: 'months', ends: 'until', until: '2026-10-20' }))).toEqual({
      ok: false,
      errors: ['The series has only one booking: make the last day later or repeat more often.']
    });
  });
});

describe('describeRepeat and seriesWarnings', () => {
  it('sums the series up in one line', () => {
    const dates = repeatDates('2026-10-08', rule({ every: 2, count: 3 }));
    expect(describeRepeat(rule({ every: 2, count: 3 }), dates)).toBe('Every 2 weeks: 3 bookings, 8 Oct 2026 to 5 Nov 2026');
  });

  it('lists every clash once, with its day, so reception decides for the whole series at once', () => {
    expect(
      seriesWarnings([
        { date: '2026-10-15', warnings: [{ kind: 'doctor_overlap', message: 'N. Amupolo already has a booking at 09:00 that overlaps this time.' }] },
        { date: '2026-10-22', warnings: [] }
      ])
    ).toEqual([{ kind: 'doctor_overlap', message: '15 Oct 2026: N. Amupolo already has a booking at 09:00 that overlaps this time.' }]);
  });
});
