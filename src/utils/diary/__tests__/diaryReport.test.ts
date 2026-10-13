import { describe, it, expect } from 'vitest';
import { availableMinutes, buildDiaryReport, formatHours, formatRate, noShowsByPatient, reportOutcome, type ReportBooking } from '../diaryReport';
import { practiceHoursResolver } from '../nextFreeSlot';
import type { DiaryBlock } from '../blockedTime';

// Week of Monday 5 to Sunday 11 October 2026, practice open Monday to Friday 08:00-17:00.
const HOURS = practiceHoursResolver(null);
const booking = (id: string, overrides: Partial<ReportBooking> = {}): ReportBooking => ({
  id,
  patientId: `patient-${id}`,
  patientName: 'Patient',
  practitionerId: 'pr-a',
  date: '2026-10-06',
  time: '09:00',
  outcome: 'seen',
  minutes: 30,
  ...overrides
});
const lunch: DiaryBlock = {
  id: 'lunch',
  practiceId: 'p1',
  branchId: null,
  branchName: null,
  doctorId: 'pr-a',
  reason: 'Lunch',
  startDate: '2026-10-01',
  endDate: null,
  startMinutes: 13 * 60,
  endMinutes: 14 * 60,
  recurrence: 'weekdays'
};

const report = (bookings: ReportBooking[], blocks: DiaryBlock[] = []) =>
  buildDiaryReport({
    bookings,
    practitioners: [
      { id: 'pr-a', name: 'Dr. A' },
      { id: 'pr-b', name: 'Dr. B' }
    ],
    from: '2026-10-05',
    to: '2026-10-11',
    hoursFor: () => HOURS,
    blocks,
    today: '2026-10-08'
  });

describe('reportOutcome', () => {
  it('reads where each booking ended up', () => {
    expect(reportOutcome({ status: 'completed', is_cancelled: false })).toBe('seen');
    expect(reportOutcome({ status: 'scheduled', is_cancelled: false, is_checked_in: true })).toBe('seen');
    expect(reportOutcome({ status: 'no-show', is_cancelled: false })).toBe('no_show');
    expect(reportOutcome({ status: 'scheduled', is_cancelled: true })).toBe('cancelled');
    expect(reportOutcome({ status: 'scheduled', is_cancelled: false })).toBe('upcoming');
  });
});

describe('buildDiaryReport', () => {
  const bookings = [
    booking('seen-1'),
    booking('seen-2', { time: '10:00', minutes: 60 }),
    booking('missed', { outcome: 'no_show', time: '11:00' }),
    booking('cancelled', { outcome: 'cancelled', time: '12:00' }),
    booking('not-marked', { outcome: 'upcoming', date: '2026-10-07' }),
    booking('to-come', { outcome: 'upcoming', date: '2026-10-09' }),
    booking('other-week', { date: '2026-10-12' }),
    booking('dr-b', { practitionerId: 'pr-b' })
  ];

  it('keeps the ids behind every number, so each one opens the bookings it counts', () => {
    const [drA] = report(bookings);
    expect(drA).toMatchObject({
      practitionerId: 'pr-a',
      bookingIds: ['seen-1', 'seen-2', 'missed', 'cancelled', 'not-marked', 'to-come'],
      seenIds: ['seen-1', 'seen-2'],
      noShowIds: ['missed'],
      cancelledIds: ['cancelled'],
      unmarkedIds: ['not-marked'],
      upcomingIds: ['to-come']
    });
  });

  it('counts no-shows out of the patients who were due, so future bookings do not hide a problem', () => {
    const [drA] = report(bookings);
    expect(drA.noShowRate).toBeCloseTo(1 / 3);
    expect(drA.cancellationRate).toBeCloseTo(1 / 6);
  });

  it('measures utilisation as booked hours (no-shows included) against the hours available', () => {
    const [drA] = report(bookings);
    // 30 + 60 + 30 (no-show) + 30 + 30 = 180 minutes; cancelled time is free again
    expect(drA.bookedMinutes).toBe(180);
    // Five weekdays of 9 hours
    expect(drA.availableMinutes).toBe(5 * 9 * 60);
    expect(drA.utilisation).toBeCloseTo(180 / 2700);
  });

  it('lists a practitioner without bookings too: an empty diary is worth seeing', () => {
    const rows = report([booking('x')]);
    expect(rows.map((row) => row.name)).toEqual(['Dr. A', 'Dr. B']);
    expect(rows[1]).toMatchObject({ bookingIds: [], noShowRate: null, cancellationRate: null, utilisation: 0 });
  });

  it('shows bookings without a practitioner on their own row', () => {
    const rows = report([booking('request', { practitionerId: null, outcome: 'upcoming', date: '2026-10-09' })]);
    expect(rows[0]).toMatchObject({ practitionerId: null, name: 'No practitioner yet', availableMinutes: null });
  });
});

describe('availableMinutes', () => {
  it('takes off breaks, blocked time and public holidays', () => {
    // Lunch every weekday: 8 hours a day
    expect(availableMinutes(HOURS, [lunch], 'pr-a', '2026-10-05', '2026-10-09')).toBe(5 * 8 * 60);
    // Lunch is Dr A's, not Dr B's
    expect(availableMinutes(HOURS, [lunch], 'pr-b', '2026-10-05', '2026-10-09')).toBe(5 * 9 * 60);
    // Heroes' Day (Wednesday 26 August 2026) is not available
    expect(availableMinutes(HOURS, [], 'pr-a', '2026-08-24', '2026-08-28')).toBe(4 * 9 * 60);
  });
});

describe('formatting', () => {
  it('writes rates and hours the way the report shows them', () => {
    expect(formatRate(1 / 3)).toBe('33%');
    expect(formatRate(null)).toBe('-');
    expect(formatHours(90)).toBe('1.5 h');
  });
});

// Parity O5: the no-shows report says who missed appointments, when, and how often, so the practice can follow up the
// patients who keep missing, and move them to a recall list
describe('no-shows by patient', () => {
  it('lists each patient once with every missed day, the most no-shows first', () => {
    const rows = noShowsByPatient(
      [
        booking('1', { patientId: 'a', patientName: 'Anna', outcome: 'no_show', date: '2026-10-06' }),
        booking('2', { patientId: 'a', patientName: 'Anna', outcome: 'no_show', date: '2026-10-08' }),
        booking('3', { patientId: 'a', patientName: 'Anna', outcome: 'seen', date: '2026-10-09' }),
        booking('4', { patientId: 'b', patientName: 'Ben', outcome: 'no_show', date: '2026-10-09' }),
        booking('5', { patientId: 'c', patientName: 'Cara', outcome: 'seen', date: '2026-10-09' })
      ],
      '2026-10-05',
      '2026-10-11'
    );
    expect(rows.map((row) => row.patientName)).toEqual(['Anna', 'Ben']);
    expect(rows[0]).toMatchObject({ dates: ['2026-10-06', '2026-10-08'], bookingIds: ['1', '2'], dueCount: 3 });
    expect(rows[1]).toMatchObject({ dates: ['2026-10-09'], dueCount: 1 });
  });

  it('does not count cancelled or still-to-come bookings as "due", so "how often" is out of the visits they missed or made', () => {
    const rows = noShowsByPatient(
      [
        booking('1', { patientId: 'a', outcome: 'no_show' }),
        booking('2', { patientId: 'a', outcome: 'cancelled' }),
        booking('3', { patientId: 'a', outcome: 'upcoming', date: '2026-10-10' })
      ],
      '2026-10-05',
      '2026-10-11'
    );
    expect(rows[0].dueCount).toBe(1);
  });

  it('leaves out no-shows outside the period and bookings without a patient', () => {
    expect(noShowsByPatient([booking('1', { outcome: 'no_show', date: '2026-09-30' }), booking('2', { patientId: null, outcome: 'no_show' })], '2026-10-05', '2026-10-11')).toEqual([]);
  });
});
