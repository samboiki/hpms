import { addDays, format } from 'date-fns';

export interface PublicHoliday {
  date: string; // yyyy-MM-dd
  name: string;
}

/** Easter Sunday in the Gregorian calendar (anonymous Gregorian algorithm), as a local date */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const FIXED_HOLIDAYS: Array<{ monthDay: string; name: string; fromYear?: number }> = [
  { monthDay: '01-01', name: "New Year's Day" },
  { monthDay: '03-21', name: 'Independence Day' },
  { monthDay: '05-01', name: "Workers' Day" },
  { monthDay: '05-04', name: 'Cassinga Day' },
  { monthDay: '05-25', name: 'Africa Day' },
  { monthDay: '05-28', name: 'Genocide Remembrance Day', fromYear: 2025 },
  { monthDay: '08-26', name: "Heroes' Day" },
  { monthDay: '12-10', name: 'Day of the Namibian Women and International Human Rights Day' },
  { monthDay: '12-25', name: 'Christmas Day' },
  { monthDay: '12-26', name: 'Family Day' }
];

const holidayCache = new Map<number, PublicHoliday[]>();

/**
 * Namibian public holidays for a year (Public Holidays Act 26 of 1990, plus Genocide Remembrance Day from 2025).
 * When a holiday falls on a Sunday, the following Monday is a public holiday. One-off days the President
 * declares in a given year are not included and have to be added by hand.
 */
export function getNamibiaPublicHolidays(year: number): PublicHoliday[] {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const holidays: PublicHoliday[] = [
    ...FIXED_HOLIDAYS
      .filter(holiday => !holiday.fromYear || year >= holiday.fromYear)
      .map(holiday => ({ date: `${year}-${holiday.monthDay}`, name: holiday.name })),
    { date: format(addDays(easter, -2), 'yyyy-MM-dd'), name: 'Good Friday' },
    { date: format(addDays(easter, 1), 'yyyy-MM-dd'), name: 'Easter Monday' },
    { date: format(addDays(easter, 39), 'yyyy-MM-dd'), name: 'Ascension Day' }
  ];

  const taken = new Set(holidays.map(holiday => holiday.date));
  for (const holiday of [...holidays]) {
    const [y, m, d] = holiday.date.split('-').map(Number);
    if (new Date(y, m - 1, d).getDay() === 0) {
      const monday = format(new Date(y, m - 1, d + 1), 'yyyy-MM-dd');
      if (!taken.has(monday)) {
        holidays.push({ date: monday, name: `${holiday.name} (observed)` });
        taken.add(monday);
      }
    }
  }

  holidays.sort((a, b) => a.date.localeCompare(b.date));
  holidayCache.set(year, holidays);
  return holidays;
}

/** Name of the public holiday on a yyyy-MM-dd date, or null */
export function getNamibiaHolidayName(dateKey: string): string | null {
  const year = Number(dateKey.slice(0, 4));
  if (!Number.isInteger(year)) return null;
  return getNamibiaPublicHolidays(year).find(holiday => holiday.date === dateKey)?.name ?? null;
}

export function isNamibiaPublicHoliday(dateKey: string): boolean {
  return getNamibiaHolidayName(dateKey) !== null;
}
