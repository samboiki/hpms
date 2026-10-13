import { describe, it, expect } from 'vitest';
import { diaryHolidayOn, holidayBookingWarning } from '../holidays';

// The diary asks before a booking on a public holiday because most practices are closed then. A
// holiday on the wrong date would warn on a normal working day and stay silent on the real one.
describe('public holidays in the diary', () => {
  it("names Heroes' Day, so a booking on it asks first: the practice is usually closed", () => {
    const holiday = diaryHolidayOn('2026-08-26');
    expect(holiday?.name).toBe("Heroes' Day");
    expect(holidayBookingWarning(holiday!)).toBe(
      "26 Aug 2026 is Heroes' Day, a public holiday. Most practices are closed."
    );
  });

  it('puts the Easter holidays on the right days although Easter moves every year', () => {
    // Easter Sunday 2026 is 5 April
    expect(diaryHolidayOn('2026-04-03')?.name).toBe('Good Friday');
    expect(diaryHolidayOn('2026-04-06')?.name).toBe('Easter Monday');
    expect(diaryHolidayOn('2026-05-14')?.name).toBe('Ascension Day');
    // Easter Sunday 2027 is 28 March
    expect(diaryHolidayOn('2027-03-26')?.name).toBe('Good Friday');
    expect(diaryHolidayOn('2027-03-29')?.name).toBe('Easter Monday');
    expect(diaryHolidayOn('2027-05-06')?.name).toBe('Ascension Day');
    // The Sunday itself is not a public holiday in Namibia
    expect(diaryHolidayOn('2026-04-05')).toBeNull();
  });

  it('closes the Monday when a holiday falls on a Sunday, because that is the day off people take', () => {
    // Cassinga Day, 4 May 2025, was a Sunday
    expect(diaryHolidayOn('2025-05-05')?.name).toBe('Cassinga Day (observed)');
    // Independence Day, 21 March 2027, is a Sunday
    expect(diaryHolidayOn('2027-03-22')?.name).toBe('Independence Day (observed)');
  });

  it('adds no Tuesday when that Monday is already a holiday, as the Act says', () => {
    // Christmas Day 2033 is a Sunday; Monday 26 December is Family Day in any case
    expect(new Date(2033, 11, 25).getDay()).toBe(0);
    expect(diaryHolidayOn('2033-12-26')?.name).toBe('Family Day');
    expect(diaryHolidayOn('2033-12-27')).toBeNull();
  });

  it('shows both names when two holidays fall on one day, so neither is hidden', () => {
    // Easter 2028 is 16 April, so Ascension Day (39 days later) is Africa Day, 25 May
    expect(diaryHolidayOn('2028-05-25')?.name).toBe('Africa Day and Ascension Day');
  });

  it('knows Genocide Remembrance Day from 2025 (Proclamation 19 of 2024) and not before', () => {
    expect(diaryHolidayOn('2026-05-28')?.name).toBe('Genocide Remembrance Day');
    expect(diaryHolidayOn('2024-05-28')).toBeNull();
  });

  it('stays quiet on ordinary working days and on text that is not a date', () => {
    expect(diaryHolidayOn('2026-10-07')).toBeNull();
    expect(diaryHolidayOn('2026-02-30')).toBeNull();
    expect(diaryHolidayOn('next week')).toBeNull();
  });
});
