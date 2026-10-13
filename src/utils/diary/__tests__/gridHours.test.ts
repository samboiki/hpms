import { describe, it, expect } from 'vitest';
import {
  describeOffHourSpan,
  describeWorkingDay,
  gridRowTimes,
  offHourSpans,
  shownGridRange,
  type GridRange
} from '../gridHours';
import { findBookingWarnings } from '../bookingChecks';
import { minutesToTime } from '../diaryTime';
import { practiceHoursResolver, type DayHours } from '../nextFreeSlot';
import { practitionerDayHours, practitionerHoursResolver, type WorkingHoursRow } from '../workingHours';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const day = (open: number, close: number, breaks: DayHours['breaks'] = []): DayHours => ({ open, close, breaks });
const at = (start: number, minutes = 30) => ({ start, minutes });

// An invented week: the practice opens 07:30-18:00 on weekdays. Dr A works 08:00-17:00 with lunch
// 13:00-14:00; Dr B works Tuesdays 08:00-12:00 at one branch and 14:00-17:00 at another.
const PRACTICE = practiceHoursResolver({
  monday: { open: '07:30', close: '18:00' },
  tuesday: { open: '07:30', close: '18:00' },
  wednesday: { open: '07:30', close: '18:00' },
  thursday: { open: '07:30', close: '18:00' },
  friday: { open: '07:30', close: '18:00' },
  saturday: { closed: true },
  sunday: { closed: true }
});
const row = (overrides: Partial<WorkingHoursRow>): WorkingHoursRow => ({
  doctorId: 'pr-a',
  branchId: null,
  branchName: null,
  dayOfWeek: 1,
  start: h(8),
  end: h(17),
  breakStart: h(13),
  breakEnd: h(14),
  ...overrides
});
const ROWS: WorkingHoursRow[] = [
  ...[1, 2, 3, 4, 5].map((dayOfWeek) => row({ dayOfWeek })),
  row({ doctorId: 'pr-b', dayOfWeek: 2, end: h(12), breakStart: null, breakEnd: null }),
  row({ doctorId: 'pr-b', dayOfWeek: 2, start: h(14), breakStart: null, breakEnd: null })
];
const TUESDAY = '2026-10-06';
const SUNDAY = '2026-10-11';
const hoursOf = (doctorId: string, dateKey: string) => practitionerHoursResolver(ROWS, doctorId, PRACTICE)(dateKey);

describe('shownGridRange (the hours the grid shows)', () => {
  it('shows the practice day instead of a fixed 08:00-23:00, so reception does not scroll past empty evenings', () => {
    expect(shownGridRange([PRACTICE(TUESDAY)], [])).toEqual({ start: h(7, 30), end: h(18) });
  });

  it('runs from the earliest start to the latest finish of everyone shown', () => {
    expect(shownGridRange([day(h(8), h(17)), day(h(6, 30), h(13))], [])).toEqual({ start: h(6, 30), end: h(17) });
  });

  it('still shows a booking made outside the hours, early or late, so its slot never looks free', () => {
    const range = shownGridRange([day(h(8), h(17))], [at(h(6, 45)), at(h(19, 15), 45)]);
    expect(range).toEqual({ start: h(6, 30), end: h(20) });
  });

  it('rounds out to whole half-hour rows', () => {
    expect(shownGridRange([day(h(8, 15), h(16, 45))], [])).toEqual({ start: h(8), end: h(17) });
  });

  it('falls back to 08:00-17:00 when nobody works on the days shown (a Sunday)', () => {
    expect(shownGridRange([PRACTICE(SUNDAY), hoursOf('pr-a', SUNDAY)], [])).toEqual({ start: h(8), end: h(17) });
  });

  it('ignores bookings without a time instead of stretching the day', () => {
    expect(shownGridRange([day(h(8), h(17))], [{ start: null, minutes: 30 }])).toEqual({ start: h(8), end: h(17) });
  });

  it('never runs past midnight', () => {
    expect(shownGridRange([day(h(8), h(17))], [at(h(23, 30), 60)]).end).toBe(24 * 60);
  });
});

describe('gridRowTimes', () => {
  it('gives one row per half hour, so every booking in the range lands in a visible row', () => {
    expect(gridRowTimes({ start: h(8), end: h(10) })).toEqual(['08:00', '08:30', '09:00', '09:30']);
  });
});

describe('offHourSpans (shading when a practitioner is not working)', () => {
  const range: GridRange = { start: h(7), end: h(18) };

  it("shades before and after the practitioner's hours and their lunch break", () => {
    expect(offHourSpans(range, [hoursOf('pr-a', TUESDAY)])).toEqual([
      { start: h(7), end: h(8), kind: 'outside' },
      { start: h(13), end: h(14), kind: 'break' },
      { start: h(17), end: h(18), kind: 'outside' }
    ]);
  });

  it('shades the whole column on a day off', () => {
    expect(offHourSpans(range, [hoursOf('pr-a', SUNDAY)])).toEqual([{ start: h(7), end: h(18), kind: 'day_off' }]);
  });

  it('marks the time between two branches as not working rather than a break', () => {
    expect(offHourSpans(range, [hoursOf('pr-b', TUESDAY)])).toContainEqual({ start: h(12), end: h(14), kind: 'gap' });
  });

  it('follows the opening hours for a practitioner without saved hours, as the booking form and "Next free slot" do', () => {
    // The practice opens 07:30-18:00; the grid shows 07:00-18:00
    expect(offHourSpans(range, [hoursOf('pr-c', TUESDAY)])).toEqual([{ start: h(7), end: h(7, 30), kind: 'outside' }]);
  });

  it('with everyone in one column (the week grid), shades only the time nobody works: one on lunch while another works is still bookable', () => {
    // Dr A is at lunch 13:00-14:00 while Dr C (no saved hours: the opening hours) works
    expect(offHourSpans(range, [hoursOf('pr-a', TUESDAY), hoursOf('pr-c', TUESDAY)])).toEqual([{ start: h(7), end: h(7, 30), kind: 'outside' }]);
    // Dr A at lunch and Dr B between branches: nobody can be booked 13:00-14:00
    expect(offHourSpans(range, [hoursOf('pr-a', TUESDAY), hoursOf('pr-b', TUESDAY)])).toEqual([
      { start: h(7), end: h(8), kind: 'outside' },
      { start: h(13), end: h(14), kind: 'gap' },
      { start: h(17), end: h(18), kind: 'outside' }
    ]);
  });

  it('calls it a break only when everyone shown is on a break at that time', () => {
    const lunch = [{ start: h(13), end: h(14), kind: 'break' as const }];
    expect(offHourSpans(range, [day(h(8), h(17), lunch), day(h(8), h(17), lunch)])).toContainEqual({ start: h(13), end: h(14), kind: 'break' });
    expect(offHourSpans(range, [day(h(8), h(13)), day(h(14), h(17))])).toContainEqual({ start: h(13), end: h(14), kind: 'gap' });
  });

  it('shades nothing when no practitioner is shown', () => {
    expect(offHourSpans(range, [])).toEqual([]);
  });

  it('agrees with the booking warnings: every shaded quarter-hour warns "outside hours", every unshaded one does not', () => {
    const date = TUESDAY;
    const workday = practitionerDayHours(ROWS, 'pr-a', date);
    const spans = offHourSpans(range, [hoursOf('pr-a', date)]);
    for (let start = range.start; start < range.end; start += 15) {
      const shaded = spans.some((span) => start >= span.start && start < span.end);
      const warnings = findBookingWarnings({
        proposal: { visitId: null, patientId: 'pt-1', doctorId: 'pr-a', date, time: minutesToTime(start), durationMinutes: 15 },
        visits: [],
        blocks: [],
        practitionerDay: workday
      });
      expect({ time: minutesToTime(start), warns: warnings.some((warning) => warning.kind === 'outside_hours') }).toEqual({
        time: minutesToTime(start),
        warns: shaded
      });
    }
  });
});

describe('labels', () => {
  it('names the shaded time for screen readers, so it is not shown by colour alone', () => {
    expect(describeOffHourSpan({ start: h(13), end: h(14), kind: 'break' })).toBe('Break, 13:00 to 14:00');
    expect(describeOffHourSpan({ start: h(17), end: h(18), kind: 'outside' })).toBe('Outside working hours, 17:00 to 18:00');
    expect(describeOffHourSpan({ start: h(7), end: h(18), kind: 'day_off' })).toBe('Not working today');
  });

  it("writes the practitioner's day in the column header", () => {
    expect(describeWorkingDay(hoursOf('pr-a', TUESDAY))).toBe('08:00-17:00, break 13:00-14:00');
    expect(describeWorkingDay(hoursOf('pr-b', TUESDAY))).toBe('08:00-17:00, not working 12:00-14:00');
    expect(describeWorkingDay(hoursOf('pr-a', SUNDAY))).toBe('Not working today');
  });
});
