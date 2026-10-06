import { format, parseISO, startOfISOWeek } from 'date-fns';
import { fromCents, toCents } from '../billing/money';

/** Working-time limits and pay rates from the Labour Act 11 of 2007 (sections 16, 17, 19, 21 and 22) */
export const LABOUR_ACT = {
  maxOrdinaryHoursPerWeek: 45,
  /** s16: 9 hours a day for someone working 5 days or fewer in the week, 8 hours for more than 5 days */
  maxOrdinaryHoursPerDayUpTo5Days: 9,
  maxOrdinaryHoursPerDayOver5Days: 8,
  /** s17: overtime may not exceed 3 hours a day or 10 hours a week */
  maxOvertimeHoursPerDay: 3,
  maxOvertimeHoursPerWeek: 10,
  /** s17: at least 1.5 times the hourly basic wage */
  overtimeRate: 1.5,
  /** s21: 200% for each hour worked on a Sunday by someone who does not ordinarily work Sundays */
  sundayRate: 2,
  /** s22: on a public holiday that is an ordinary working day, the day's pay plus the hourly wage for each hour worked */
  publicHolidayExtraRate: 1,
  /** s19: night work (22:00 to 07:00) earns at least 6% of the hourly basic wage extra */
  nightPremiumRate: 0.06
} as const;

export interface WorkedDay {
  date: string; // yyyy-MM-dd
  hours: number;
  timeIn?: string; // HH:mm
  timeOut?: string; // HH:mm
}

export type DayType = 'workday' | 'sunday' | 'public_holiday';

export interface ClassifiedDay {
  date: string;
  dayType: DayType;
  hours: number;
  ordinaryHours: number;
  overtimeHours: number;
  sundayHours: number;
  publicHolidayHours: number;
  nightHours: number;
}

export interface LabourActWarning {
  date: string; // the day, or the Monday of the week for weekly limits
  message: string;
}

export interface HoursSummary {
  days: ClassifiedDay[];
  totalHours: number;
  ordinaryHours: number;
  overtimeHours: number;
  sundayHours: number;
  publicHolidayHours: number;
  nightHours: number;
  warnings: LabourActWarning[];
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

const toMinutes = (time: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

/** Hours of a shift that fall in the night-work window (22:00 to 07:00), including shifts past midnight */
export function nightHoursForShift(timeIn?: string, timeOut?: string): number {
  if (!timeIn || !timeOut) return 0;
  const start = toMinutes(timeIn);
  let end = toMinutes(timeOut);
  if (start === null || end === null) return 0;
  if (end <= start) end += 24 * 60;

  // Night windows across the two calendar days a shift can touch
  const windows: Array<[number, number]> = [[0, 7 * 60], [22 * 60, 31 * 60], [46 * 60, 48 * 60]];
  const minutes = windows.reduce((sum, [from, to]) => sum + Math.max(0, Math.min(end as number, to) - Math.max(start, from)), 0);
  return round2(minutes / 60);
}

/**
 * Splits hours worked into ordinary time, overtime, Sunday and public holiday time as the Labour Act defines them:
 * - ordinary time is capped at 9 hours a day (8 if more than 5 days were worked that week) and 45 hours a week;
 * - anything above those caps on a normal day is overtime (paid at least 1.5x);
 * - all hours on a Sunday or a public holiday are counted separately, because they are paid at their own rates.
 * Weeks run Monday to Sunday. Warnings flag overtime beyond 3 hours a day or 10 hours a week.
 */
export function classifyWorkedHours(days: WorkedDay[], isPublicHoliday: (dateKey: string) => boolean): HoursSummary {
  const worked = days.filter(day => day.hours > 0).sort((a, b) => a.date.localeCompare(b.date));
  const weeks = new Map<string, WorkedDay[]>();
  for (const day of worked) {
    const weekKey = format(startOfISOWeek(parseISO(day.date)), 'yyyy-MM-dd');
    weeks.set(weekKey, [...(weeks.get(weekKey) || []), day]);
  }

  const classified: ClassifiedDay[] = [];
  const warnings: LabourActWarning[] = [];

  for (const [weekStart, weekDays] of weeks) {
    const dailyCap = weekDays.length > 5 ? LABOUR_ACT.maxOrdinaryHoursPerDayOver5Days : LABOUR_ACT.maxOrdinaryHoursPerDayUpTo5Days;
    const weekClassified = weekDays.map((day): ClassifiedDay => {
      const isSunday = parseISO(day.date).getDay() === 0;
      const holiday = isPublicHoliday(day.date);
      const dayType: DayType = holiday ? 'public_holiday' : isSunday ? 'sunday' : 'workday';
      const ordinaryHours = dayType === 'workday' ? Math.min(day.hours, dailyCap) : 0;
      return {
        date: day.date,
        dayType,
        hours: day.hours,
        ordinaryHours,
        overtimeHours: dayType === 'workday' ? day.hours - ordinaryHours : 0,
        // A public holiday on a Sunday is counted once, at the Sunday rate (the higher of the two)
        sundayHours: isSunday ? day.hours : 0,
        publicHolidayHours: holiday && !isSunday ? day.hours : 0,
        nightHours: nightHoursForShift(day.timeIn, day.timeOut)
      };
    });

    // Weekly cap: ordinary hours above 45 become overtime, taken from the latest days of the week first
    let excess = weekClassified.reduce((sum, day) => sum + day.ordinaryHours, 0) - LABOUR_ACT.maxOrdinaryHoursPerWeek;
    for (let index = weekClassified.length - 1; index >= 0 && excess > 0; index--) {
      const day = weekClassified[index];
      const moved = Math.min(day.ordinaryHours, excess);
      day.ordinaryHours -= moved;
      day.overtimeHours += moved;
      excess -= moved;
    }

    for (const day of weekClassified) {
      if (day.overtimeHours > LABOUR_ACT.maxOvertimeHoursPerDay + 1e-9) {
        warnings.push({
          date: day.date,
          message: `${round2(day.overtimeHours)} h overtime on ${format(parseISO(day.date), 'd MMM')}: the Labour Act allows at most ${LABOUR_ACT.maxOvertimeHoursPerDay} h a day (s17).`
        });
      }
    }
    const weekOvertime = weekClassified.reduce((sum, day) => sum + day.overtimeHours, 0);
    if (weekOvertime > LABOUR_ACT.maxOvertimeHoursPerWeek + 1e-9) {
      warnings.push({
        date: weekStart,
        message: `${round2(weekOvertime)} h overtime in the week of ${format(parseISO(weekStart), 'd MMM')}: the Labour Act allows at most ${LABOUR_ACT.maxOvertimeHoursPerWeek} h a week (s17).`
      });
    }

    classified.push(...weekClassified.map(day => ({
      ...day,
      ordinaryHours: round2(day.ordinaryHours),
      overtimeHours: round2(day.overtimeHours)
    })));
  }

  const total = (key: keyof Pick<ClassifiedDay, 'hours' | 'ordinaryHours' | 'overtimeHours' | 'sundayHours' | 'publicHolidayHours' | 'nightHours'>) =>
    round2(classified.reduce((sum, day) => sum + day[key], 0));

  return {
    days: classified,
    totalHours: total('hours'),
    ordinaryHours: total('ordinaryHours'),
    overtimeHours: total('overtimeHours'),
    sundayHours: total('sundayHours'),
    publicHolidayHours: total('publicHolidayHours'),
    nightHours: total('nightHours'),
    warnings
  };
}

/** Hourly basic wage of a monthly-paid employee: monthly basic x 12 / 52 / ordinary hours per week */
export function hourlyBasicWage(monthlyBasic: number, ordinaryHoursPerWeek: number = LABOUR_ACT.maxOrdinaryHoursPerWeek): number {
  if (!(monthlyBasic > 0) || !(ordinaryHoursPerWeek > 0)) return 0;
  return (monthlyBasic * 12) / 52 / ordinaryHoursPerWeek;
}

export interface TimesheetPayLine {
  name: string;
  code: 'OVERTIME' | 'SUNDAY_WORK' | 'PUBLIC_HOLIDAY_WORK' | 'NIGHT_WORK';
  hours: number;
  rate: number;
  amount: number;
}

/**
 * Extra pay on top of the monthly salary for the hours in a timesheet. A monthly salary already pays the ordinary
 * day, so a public holiday on a working day adds the hourly wage once; Sunday work by someone who does not
 * ordinarily work Sundays adds 200%.
 */
export function timesheetPayLines(summary: HoursSummary, hourlyWage: number): TimesheetPayLine[] {
  if (!(hourlyWage > 0)) return [];
  const line = (code: TimesheetPayLine['code'], name: string, hours: number, rate: number): TimesheetPayLine => ({
    code,
    name: `${name} (${round2(hours)} h at ${rate * 100}%)`,
    hours: round2(hours),
    rate,
    amount: fromCents(toCents(hours * hourlyWage * rate))
  });

  return [
    summary.overtimeHours > 0 ? line('OVERTIME', 'Overtime', summary.overtimeHours, LABOUR_ACT.overtimeRate) : null,
    summary.sundayHours > 0 ? line('SUNDAY_WORK', 'Sunday work', summary.sundayHours, LABOUR_ACT.sundayRate) : null,
    summary.publicHolidayHours > 0 ? line('PUBLIC_HOLIDAY_WORK', 'Public holiday work', summary.publicHolidayHours, LABOUR_ACT.publicHolidayExtraRate) : null,
    summary.nightHours > 0 ? line('NIGHT_WORK', 'Night work premium', summary.nightHours, LABOUR_ACT.nightPremiumRate) : null
  ].filter((item): item is TimesheetPayLine => item !== null);
}
