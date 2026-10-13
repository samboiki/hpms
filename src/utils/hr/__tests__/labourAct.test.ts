import { describe, it, expect } from 'vitest';
import { classifyWorkedHours, hourlyBasicWage, nightHoursForShift, timesheetPayLines, type WorkedDay } from '../labourAct';
import { isNamibiaPublicHoliday } from '../namibiaHolidays';

const noHolidays = () => false;
// 5 to 9 October 2026 is Monday to Friday; 11 October is a Sunday
const week = (hours: number[], startDay = 5): WorkedDay[] =>
  hours.map((h, index) => ({ date: `2026-10-${String(startDay + index).padStart(2, '0')}`, hours: h }));

describe('classifyWorkedHours: ordinary time and overtime (Labour Act s16, s17)', () => {
  it('counts a normal 9-hour, 5-day week as all ordinary time', () => {
    const summary = classifyWorkedHours(week([9, 9, 9, 9, 9]), noHolidays);
    expect(summary.ordinaryHours).toBe(45);
    expect(summary.overtimeHours).toBe(0);
    expect(summary.warnings).toEqual([]);
  });

  it('treats hours above 9 in a day as overtime, even when the week stays under 45', () => {
    // The old screen used practice opening hours (8:00-20:00 = 12 h) as "regular", so this showed no overtime
    const summary = classifyWorkedHours(week([12, 8, 8]), noHolidays);
    expect(summary.ordinaryHours).toBe(25);
    expect(summary.overtimeHours).toBe(3);
  });

  it('caps ordinary days at 8 hours when more than 5 days are worked in the week', () => {
    // Monday to Saturday, 9 hours each: 6 days means an 8-hour ordinary day
    const summary = classifyWorkedHours(week([9, 9, 9, 9, 9, 9]), noHolidays);
    expect(summary.ordinaryHours).toBe(45); // 6 x 8 = 48, then the 45-hour weekly cap
    expect(summary.overtimeHours).toBe(9); // 6 x 1 daily excess + 3 over the weekly cap
  });

  it('turns ordinary hours above 45 in a week into overtime', () => {
    const summary = classifyWorkedHours(week([9, 9, 9, 9, 9, 4]), noHolidays);
    // 6 days -> 8-hour cap: 5 x 1 h daily excess, ordinary 5 x 8 + 4 = 44, under 45
    expect(summary.ordinaryHours).toBe(44);
    expect(summary.overtimeHours).toBe(5);
  });

  it('warns when overtime goes past 3 hours in a day', () => {
    const summary = classifyWorkedHours(week([13]), noHolidays);
    expect(summary.overtimeHours).toBe(4);
    expect(summary.warnings.map(w => w.message).join(' ')).toMatch(/at most 3 h a day/);
  });

  it('warns when overtime goes past 10 hours in a week', () => {
    const summary = classifyWorkedHours(week([12, 12, 12, 12]), noHolidays);
    expect(summary.overtimeHours).toBe(12);
    expect(summary.warnings.some(w => /at most 10 h a week/.test(w.message))).toBe(true);
  });

  it('works out each Monday-to-Sunday week on its own', () => {
    // Two light weeks must not be added together into one long week
    const days = [...week([9, 9, 9, 9, 9]), ...week([9, 9, 9, 9, 9], 12)];
    const summary = classifyWorkedHours(days, noHolidays);
    expect(summary.ordinaryHours).toBe(90);
    expect(summary.overtimeHours).toBe(0);
  });
});

describe('classifyWorkedHours: Sundays and public holidays (s21, s22)', () => {
  it('counts every hour worked on a Sunday separately from ordinary time and overtime', () => {
    const summary = classifyWorkedHours([{ date: '2026-10-11', hours: 6 }], noHolidays);
    expect(summary.sundayHours).toBe(6);
    expect(summary.ordinaryHours).toBe(0);
    expect(summary.overtimeHours).toBe(0);
  });

  it('counts hours on a public holiday as holiday time, using the Namibian calendar', () => {
    // Heroes' Day, Wednesday 26 August 2026
    const summary = classifyWorkedHours([{ date: '2026-08-26', hours: 8 }], isNamibiaPublicHoliday);
    expect(summary.publicHolidayHours).toBe(8);
    expect(summary.ordinaryHours).toBe(0);
  });

  it('counts a public holiday on a Sunday once, at the Sunday rate', () => {
    const summary = classifyWorkedHours([{ date: '2027-03-21', hours: 5 }], isNamibiaPublicHoliday);
    expect(summary.sundayHours).toBe(5);
    expect(summary.publicHolidayHours).toBe(0);
  });
});

describe('nightHoursForShift (s19: 22:00 to 07:00)', () => {
  it('counts the hours of an evening shift after 22:00', () => {
    expect(nightHoursForShift('14:00', '23:30')).toBe(1.5);
  });

  it('counts early-morning hours before 07:00', () => {
    expect(nightHoursForShift('05:00', '13:00')).toBe(2);
  });

  it('handles a shift that runs past midnight', () => {
    expect(nightHoursForShift('20:00', '08:00')).toBe(9); // 22:00 to 07:00
  });

  it('finds no night work in a normal day shift or without times', () => {
    expect(nightHoursForShift('08:00', '17:00')).toBe(0);
    expect(nightHoursForShift(undefined, '17:00')).toBe(0);
  });
});

describe('pay for timesheet hours', () => {
  it('derives the hourly basic wage from a monthly salary and a 45-hour week', () => {
    // N$ 19,500 x 12 / 52 / 45 = N$ 100.00 an hour
    expect(hourlyBasicWage(19500)).toBeCloseTo(100, 6);
  });

  it('pays overtime at 150%, Sunday work at 200%, holiday work at an extra 100% and night work at 6%', () => {
    const summary = classifyWorkedHours([
      { date: '2026-10-05', hours: 11, timeIn: '08:00', timeOut: '19:00' }, // 2 h overtime
      { date: '2026-10-11', hours: 4, timeIn: '09:00', timeOut: '13:00' }, // Sunday
      { date: '2026-08-26', hours: 3, timeIn: '20:00', timeOut: '23:00' } // Heroes' Day, 1 h night work
    ], isNamibiaPublicHoliday);
    const lines = timesheetPayLines(summary, 100);
    expect(lines.map(line => [line.code, line.hours, line.amount])).toEqual([
      ['OVERTIME', 2, 300],
      ['SUNDAY_WORK', 4, 800],
      ['PUBLIC_HOLIDAY_WORK', 3, 300],
      ['NIGHT_WORK', 1, 6]
    ]);
  });

  it('rounds pay lines to the cent', () => {
    const summary = classifyWorkedHours([{ date: '2026-10-05', hours: 10 }], noHolidays);
    const [overtime] = timesheetPayLines(summary, hourlyBasicWage(12000));
    // 1 h x (12,000 x 12 / 52 / 45) x 1.5 = 92.307692... -> 92.31
    expect(overtime.amount).toBe(92.31);
  });

  it('adds nothing when there is no extra time or no salary', () => {
    expect(timesheetPayLines(classifyWorkedHours(week([9, 9]), noHolidays), 100)).toEqual([]);
    expect(timesheetPayLines(classifyWorkedHours(week([12]), noHolidays), 0)).toEqual([]);
  });
});
