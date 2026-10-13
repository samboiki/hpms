import { describe, it, expect } from 'vitest';
import { findNextFreeSlot, nextOpenDay, practiceHoursResolver, type NextFreeSlotInput } from '../nextFreeSlot';
import type { DayVisit } from '../bookingChecks';
import type { DiaryBlock } from '../blockedTime';

// Monday to Friday 08:00-17:00, Saturday 08:00-12:00, Sunday closed
const HOURS = practiceHoursResolver({
  monday: { open: '08:00', close: '17:00', closed: false },
  tuesday: { open: '08:00', close: '17:00', closed: false },
  wednesday: { open: '08:00', close: '17:00', closed: false },
  thursday: { open: '08:00', close: '17:00', closed: false },
  friday: { open: '08:00', close: '17:00', closed: false },
  saturday: { open: '08:00', close: '12:00', closed: false },
  sunday: { closed: true }
});

const booked = (date: string, time: string, overrides: Partial<DayVisit> = {}): DayVisit => ({
  id: `${date}-${time}`,
  patient_id: 'pat',
  doctor_id: 'pr-a',
  scheduled_date: date,
  scheduled_time: `${time}:00`,
  visit_date: date,
  visit_time: `${time}:00`,
  status: 'scheduled',
  is_cancelled: false,
  ...overrides
});

const search = (overrides: Partial<NextFreeSlotInput> = {}) =>
  findNextFreeSlot({
    doctorId: 'pr-a',
    fromDate: '2026-10-07', // a Wednesday
    durationMinutes: 30,
    days: 14,
    hoursFor: HOURS,
    visits: [],
    blocks: [],
    ...overrides
  });

describe('findNextFreeSlot', () => {
  it('offers opening time on a free day, so reception can answer the caller at once', () => {
    expect(search()).toEqual({ date: '2026-10-07', time: '08:00' });
  });

  it('starts from now when searching today and rounds up to the form\'s 15-minute steps', () => {
    expect(search({ notBefore: '10:07' })).toEqual({ date: '2026-10-07', time: '10:15' });
  });

  it('skips past bookings of this practitioner only', () => {
    const visits = [booked('2026-10-07', '08:00'), booked('2026-10-07', '08:30'), booked('2026-10-07', '09:00', { doctor_id: 'pr-b' })];
    expect(search({ visits })).toEqual({ date: '2026-10-07', time: '09:00' });
  });

  it('treats a cancelled visit as a free slot, as the diary does', () => {
    expect(search({ visits: [booked('2026-10-07', '08:00', { is_cancelled: true })] })).toEqual({ date: '2026-10-07', time: '08:00' });
  });

  it('never suggests blocked time, so a caller is not promised a slot during leave or lunch', () => {
    const leave: DiaryBlock = {
      id: 'b1', practiceId: 'p1', branchId: null, branchName: null, doctorId: 'pr-a', reason: 'Conference',
      startDate: '2026-10-07', endDate: '2026-10-08', startMinutes: null, endMinutes: null, recurrence: 'none'
    };
    const lunch: DiaryBlock = { ...leave, id: 'b2', reason: 'Lunch', startDate: '2026-10-01', endDate: null, startMinutes: 8 * 60, endMinutes: 10 * 60, recurrence: 'weekdays' };
    expect(search({ blocks: [leave, lunch] })).toEqual({ date: '2026-10-09', time: '10:00' });
  });

  it('skips public holidays and closed days: Heroes\' Day 2026 is a Wednesday', () => {
    expect(search({ fromDate: '2026-08-26' })).toEqual({ date: '2026-08-27', time: '08:00' });
    // Searching from a Sunday lands on Monday
    expect(search({ fromDate: '2026-10-11' })).toEqual({ date: '2026-10-12', time: '08:00' });
  });

  it('only offers a slot the whole booking fits in before closing time', () => {
    // Saturday 10 Oct closes at 12:00: an hour-long booking cannot start after 11:00
    expect(search({ fromDate: '2026-10-10', notBefore: '11:15', durationMinutes: 60 })).toEqual({ date: '2026-10-12', time: '08:00' });
  });

  it('returns null when nothing is free in the period, instead of suggesting a full day', () => {
    const allDay: DiaryBlock = {
      id: 'b1', practiceId: 'p1', branchId: null, branchName: null, doctorId: null, reason: 'Closed for renovations',
      startDate: '2026-10-01', endDate: '2026-12-31', startMinutes: null, endMinutes: null, recurrence: 'none'
    };
    expect(search({ blocks: [allDay] })).toBeNull();
  });
});

describe('practiceHoursResolver', () => {
  it('uses the Settings default (Monday to Friday 08:00-17:00) when a practice has not saved hours', () => {
    const hours = practiceHoursResolver(null);
    expect(hours('2026-10-07')).toEqual({ open: 480, close: 1020 });
    expect(hours('2026-10-10')).toBeNull();
  });

  it('treats a day missing from the saved hours as closed, like the booking form', () => {
    const hours = practiceHoursResolver({ monday: { open: '08:00', close: '13:00' } });
    expect(hours('2026-10-05')).toEqual({ open: 480, close: 780 });
    expect(hours('2026-10-06')).toBeNull();
  });
});

describe('nextOpenDay ("Remind patients" starts there)', () => {
  it("skips the weekend on a Friday, so reception reminds Monday's patients", () => {
    expect(nextOpenDay('2026-10-09', practiceHoursResolver(null))).toBe('2026-10-12');
  });

  it('offers Saturday to a practice open on Saturdays', () => {
    expect(nextOpenDay('2026-10-09', HOURS)).toBe('2026-10-10');
  });

  it("skips a public holiday: Heroes' Day 2026 is a Wednesday", () => {
    expect(nextOpenDay('2026-08-25', HOURS)).toBe('2026-08-27');
  });
});
