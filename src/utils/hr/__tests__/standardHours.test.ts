/**
 * Owner decision 13 Oct 2026: the timesheet's standard hours must be real. The practice saves a standard day, and
 * hours above it are overtime on the timesheet and in payroll; the Labour Act still caps the ordinary day.
 */
import { describe, expect, it } from 'vitest';
import { classifyWorkedHours } from '../labourAct';
import { parseStandardHours, standardDayHours, standardHoursProblem, standardWeeklyHours } from '../standardHours';

const noHolidays = () => false;
// Monday 5 Oct 2026 onwards
const week = (hours: number[]) => hours.map((h, i) => ({ date: `2026-10-0${5 + i}`, hours: h }));

describe('standard day', () => {
  it('08:00 to 16:00 is an 8-hour day and a 40-hour week', () => {
    expect(standardDayHours({ start: '08:00', end: '16:00' })).toBe(8);
    expect(standardWeeklyHours({ start: '08:00', end: '16:00' })).toBe(40);
  });

  it('a week never counts more ordinary hours than the Act allows (45)', () => {
    expect(standardWeeklyHours({ start: '07:00', end: '17:00' })).toBe(45);
    expect(standardWeeklyHours(null)).toBe(45);
  });

  it('refuses times that are not a day, in plain words', () => {
    expect(standardHoursProblem({ start: '17:00', end: '08:00' })).toMatch(/end after it starts/);
    expect(standardHoursProblem({ start: '8am', end: '17:00' })).toMatch(/as times/);
    expect(parseStandardHours({ start: '17:00', end: '08:00' })).toBeNull();
    expect(parseStandardHours({ start: '08:00', end: '16:30' })).toEqual({ start: '08:00', end: '16:30' });
  });
});

describe('classifyWorkedHours with the practice standard day', () => {
  it('hours above an 8-hour standard day are overtime (they were ordinary up to 9 under the Act alone)', () => {
    const actOnly = classifyWorkedHours(week([9]), noHolidays);
    const standard = classifyWorkedHours(week([9]), noHolidays, { standardHoursPerDay: 8 });
    expect(actOnly.overtimeHours).toBe(0);
    expect(standard.ordinaryHours).toBe(8);
    expect(standard.overtimeHours).toBe(1);
  });

  it('a standard day longer than the Act day cannot make extra hours ordinary', () => {
    const summary = classifyWorkedHours(week([11]), noHolidays, { standardHoursPerDay: 10 });
    expect(summary.ordinaryHours).toBe(9);
    expect(summary.overtimeHours).toBe(2);
  });

  it('the Act warning is about the Act overtime, not about hours above a shorter standard day', () => {
    // 7-hour standard day, 10.5 hours worked: 3.5 h practice overtime, but only 1.5 h above the Act day
    const summary = classifyWorkedHours(week([10.5]), noHolidays, { standardHoursPerDay: 7 });
    expect(summary.overtimeHours).toBe(3.5);
    expect(summary.warnings).toEqual([]);
  });

  it('no standard saved: the Act alone decides, as before', () => {
    const summary = classifyWorkedHours(week([9, 9]), noHolidays, { standardHoursPerDay: null });
    expect(summary.overtimeHours).toBe(0);
  });
});
