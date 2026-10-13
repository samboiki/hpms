import { describe, expect, it } from 'vitest';
import {
  canHaveDueDate,
  dueDateFromLastPeriod,
  dueDateProblem,
  duePeriodRange,
  gestationOn,
  gestationShort,
  gestationText,
  keepsDueDates
} from '../pregnancy';

const TODAY = '2026-10-13';

describe('which practices keep due dates', () => {
  it('shows due dates to GP, specialist, nursing and therapy practices but never to dentists or optometrists', () => {
    for (const type of ['medical', 'general', 'dermatology', 'nursing', 'physiotherapy', null]) expect(keepsDueDates(type)).toBe(true);
    for (const type of ['dental', 'Dental', 'optometry']) expect(keepsDueDates(type)).toBe(false);
  });

  it('offers a due date to every patient not recorded as male, so a file without a gender is not blocked', () => {
    expect(canHaveDueDate('female')).toBe(true);
    expect(canHaveDueDate('other')).toBe(true);
    expect(canHaveDueDate(null)).toBe(true);
    expect(canHaveDueDate(' Male ')).toBe(false);
  });
});

describe('checking a due date before it is saved', () => {
  it('accepts a date up to 40 weeks ahead, the furthest a pregnancy can be from its due date', () => {
    expect(dueDateProblem('2027-07-20', TODAY)).toBeNull();
    expect(dueDateProblem('2027-07-21', TODAY)).toMatch(/at most 40 weeks/);
  });

  it('refuses a due date long past, which is a typo or a birth that should clear the date instead', () => {
    expect(dueDateProblem('2026-09-01', TODAY)).toBeNull();
    expect(dueDateProblem('2026-08-31', TODAY)).toMatch(/born, clear/);
  });

  it('asks for a date when nothing usable was typed', () => {
    expect(dueDateProblem('', TODAY)).toBe('Enter the due date.');
    expect(dueDateProblem('2027-02-30', TODAY)).toBe('Enter the due date.');
  });
});

describe('working the due date out from the last period', () => {
  it('adds 40 weeks to the first day of the last period, as practitioners do on a pregnancy wheel', () => {
    expect(dueDateFromLastPeriod('2026-09-01', TODAY)).toEqual({ dueDate: '2027-06-08' });
  });

  it('refuses a period in the future or one too long ago to be a pregnancy now', () => {
    expect(dueDateFromLastPeriod('2026-10-14', TODAY)).toEqual({ problem: 'The last period cannot start after today.' });
    expect(dueDateFromLastPeriod('2025-11-01', TODAY)).toHaveProperty('problem');
  });
});

describe('how far along the patient is', () => {
  it('counts weeks and days back from the due date, so the list shows who is close to term', () => {
    // 152 days to go: 280 - 152 = 128 days = 18 weeks 2 days
    expect(gestationOn('2027-03-14', TODAY)).toEqual({ weeks: 18, days: 2, daysToGo: 152 });
    expect(gestationText('2027-03-14', TODAY)).toBe('18 weeks 2 days pregnant');
    expect(gestationShort('2027-03-14', TODAY)).toBe('18 wk');
  });

  it('says a due date passed in days, so staff can follow up or clear it', () => {
    expect(gestationText('2026-10-13', TODAY)).toBe('due today');
    expect(gestationText('2026-10-08', TODAY)).toBe('5 days past the due date');
    expect(gestationShort('2026-10-12', TODAY)).toBe('1 d over');
  });

  it('writes one week and one day without a plural', () => {
    expect(gestationText(addDays('2026-10-13', 280 - 8), TODAY)).toBe('1 week 1 day pregnant');
  });

  it('shows nothing for a date it cannot read', () => {
    expect(gestationText(null, TODAY)).toBe('');
    expect(gestationOn('not a date', TODAY)).toBeNull();
  });
});

describe('the periods of the due-dates list', () => {
  it('covers whole calendar months for this month and next month, across a new year', () => {
    expect(duePeriodRange('this_month', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(duePeriodRange('next_month', '2026-12-20')).toEqual({ from: '2027-01-01', to: '2027-01-31' });
  });

  it('counts the next 4 weeks and 3 months from today, both days included', () => {
    expect(duePeriodRange('next_4_weeks', TODAY)).toEqual({ from: '2026-10-13', to: '2026-11-09' });
    expect(duePeriodRange('next_3_months', TODAY)).toEqual({ from: '2026-10-13', to: '2027-01-12' });
  });

  it('lists due dates that passed in the last year and were never cleared, so the file can be brought up to date', () => {
    expect(duePeriodRange('past_due', TODAY)).toEqual({ from: '2025-10-13', to: '2026-10-12' });
  });

  it('checks a chosen range in plain words', () => {
    expect(duePeriodRange('custom', TODAY, { from: '2026-11-01', to: '2026-11-30' })).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(duePeriodRange('custom', TODAY, { from: '2026-11-30', to: '2026-11-01' })).toEqual({ problem: 'The first day is after the last day.' });
    expect(duePeriodRange('custom', TODAY, { from: '' })).toEqual({ problem: 'Choose the first and the last day.' });
  });
});

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
