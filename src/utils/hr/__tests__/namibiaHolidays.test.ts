import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import { easterSunday, getNamibiaPublicHolidays, getNamibiaHolidayName, isNamibiaPublicHoliday } from '../namibiaHolidays';

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2030, '2030-04-21'],
    [2038, '2038-04-25']
  ])('Easter %i falls on %s, so Good Friday and Easter Monday are right in any year', (year, expected) => {
    expect(format(easterSunday(year), 'yyyy-MM-dd')).toBe(expected);
  });
});

describe('Namibian public holidays', () => {
  it('lists the 2026 holidays, matching the published calendar', () => {
    const dates = getNamibiaPublicHolidays(2026).map(holiday => holiday.date);
    expect(dates).toEqual([
      '2026-01-01', '2026-03-21', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-04',
      '2026-05-14', '2026-05-25', '2026-05-28', '2026-08-26', '2026-12-10', '2026-12-25', '2026-12-26'
    ]);
  });

  it('does not treat the Day of the Namibian Child (10 September) as a paid public holiday', () => {
    // The old list included it, which would have paid 2x for a normal working day
    expect(isNamibiaPublicHoliday('2026-09-10')).toBe(false);
  });

  it('adds Genocide Remembrance Day only from 2025, when it was declared', () => {
    expect(isNamibiaPublicHoliday('2025-05-28')).toBe(true);
    expect(isNamibiaPublicHoliday('2024-05-28')).toBe(false);
  });

  it('makes the Monday a holiday when a holiday falls on a Sunday', () => {
    // 21 March 2027 is a Sunday
    expect(getNamibiaHolidayName('2027-03-22')).toBe('Independence Day (observed)');
  });

  it('names holidays for display on timesheets', () => {
    expect(getNamibiaHolidayName('2026-12-26')).toBe('Family Day');
    expect(getNamibiaHolidayName('2026-10-06')).toBeNull();
  });
});
