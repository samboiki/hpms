import { describe, it, expect } from 'vitest';
import {
  ageOn,
  birthdayBetween,
  birthdayInYear,
  currentBirthday,
  isoWeekKey,
  monthBounds,
  weekBounds,
  windhoekClock
} from '../listDates';

describe('windhoekClock', () => {
  it('uses the practice date, so the server at 23:30 UTC on 6 October already sends 7 October greetings', () => {
    expect(windhoekClock(new Date('2026-10-06T23:30:00Z'))).toEqual({ dateKey: '2026-10-07', minutes: 90 });
  });

  it('gives 08:00 Windhoek time for 06:00 UTC, which is when a "morning" message is due', () => {
    expect(windhoekClock(new Date('2026-10-07T06:00:00Z')).minutes).toBe(8 * 60);
  });
});

describe('birthdayInYear', () => {
  it('greets a patient born on 29 February on 28 February in 2027, so they are not skipped for three years', () => {
    expect(birthdayInYear('2000-02-29', 2027)).toBe('2027-02-28');
  });

  it('keeps 29 February in leap years', () => {
    expect(birthdayInYear('2000-02-29', 2028)).toBe('2028-02-29');
  });

  it('has no birthday before the patient was born or without a date of birth', () => {
    expect(birthdayInYear('2026-05-01', 2025)).toBeNull();
    expect(birthdayInYear(null, 2026)).toBeNull();
    expect(birthdayInYear('not a date', 2026)).toBeNull();
  });
});

describe('birthdayBetween', () => {
  it('finds a 2 January birthday in the week from 28 December, so New Year birthdays are not missed', () => {
    expect(birthdayBetween('1990-01-02', '2026-12-28', '2027-01-03')).toBe('2027-01-02');
  });

  it('finds nothing outside the range', () => {
    expect(birthdayBetween('1990-01-10', '2026-12-28', '2027-01-03')).toBeNull();
  });
});

describe('ageOn and currentBirthday', () => {
  it('turns 40 on the birthday itself, not the day before', () => {
    expect(ageOn('1986-10-07', '2026-10-06')).toBe(39);
    expect(ageOn('1986-10-07', '2026-10-07')).toBe(40);
  });

  it('counts a 29 February birthday as reached on the 28 February greeting day', () => {
    expect(ageOn('2000-02-29', '2027-02-28')).toBe(27);
  });

  it('treats last week\'s birthday as the current one, so a this-month list says "turned 40", not 41', () => {
    const birthday = currentBirthday('1986-10-01', '2026-10-07');
    expect(birthday).toBe('2026-10-01');
    expect(ageOn('1986-10-01', birthday as string)).toBe(40);
  });
});

describe('weekBounds and monthBounds', () => {
  it('runs a week from Monday to Sunday, as staff read "this week"', () => {
    // 7 October 2026 is a Wednesday
    expect(weekBounds('2026-10-07')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(weekBounds('2026-10-11')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('covers the whole month, including 29 February in a leap year', () => {
    expect(monthBounds('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('isoWeekKey', () => {
  it('puts 31 December and 1 January in the same week, so a weekly limit is not reset by New Year', () => {
    expect(isoWeekKey('2026-12-31')).toBe('2026-W53');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
    expect(isoWeekKey('2027-01-04')).toBe('2027-W01');
  });
});
