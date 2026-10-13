import { describe, it, expect } from 'vitest';
import {
  bookingProposalKey,
  describeNoShowHistory,
  findBookingWarnings,
  takenStartTimes,
  type BookingCheckInput,
  type BookingProposal,
  type DayVisit
} from '../bookingChecks';
import type { DiaryBlock } from '../blockedTime';

const NAMES: Record<string, string> = { 'pr-a': 'N. Amupolo', 'pr-b': 'T. Shikongo' };

const visit = (overrides: Partial<DayVisit> = {}): DayVisit => ({
  id: 'v1',
  patient_id: 'pat-2',
  doctor_id: 'pr-a',
  scheduled_date: '2026-10-07',
  scheduled_time: '09:00:00',
  visit_date: '2026-10-07',
  visit_time: '09:00:00',
  status: 'scheduled',
  is_cancelled: false,
  ...overrides
});

const proposal = (overrides: Partial<BookingProposal> = {}): BookingProposal => ({
  visitId: null,
  patientId: 'pat-1',
  doctorId: 'pr-a',
  date: '2026-10-07', // a Wednesday
  time: '09:15',
  durationMinutes: 30,
  ...overrides
});

const check = (overrides: Partial<BookingCheckInput> = {}) =>
  findBookingWarnings({
    proposal: proposal(),
    visits: [],
    blocks: [],
    doctorName: (id) => NAMES[id],
    ...overrides
  });

describe('findBookingWarnings', () => {
  it('says nothing for a free slot on a working day, so normal bookings are not slowed down', () => {
    expect(check()).toEqual([]);
  });

  it('warns (never refuses) when the practitioner already has someone at that time', () => {
    const warnings = check({ visits: [visit()] });
    expect(warnings).toEqual([
      { kind: 'doctor_overlap', message: 'N. Amupolo already has a booking at 09:00 that overlaps this time.' }
    ]);
    // Two clashes are listed together, earliest first
    expect(check({ visits: [visit({ id: 'v3', scheduled_time: '09:30:00' }), visit()] })[0].message).toBe(
      'N. Amupolo already has bookings at 09:00 and 09:30 that overlap this time.'
    );
  });

  it('does not count the booking being moved, or cancelled and no-show visits, which free their slot', () => {
    expect(check({ proposal: proposal({ visitId: 'v1' }), visits: [visit()] })).toEqual([]);
    expect(check({ visits: [visit({ is_cancelled: true }), visit({ id: 'v2', status: 'no-show' })] })).toEqual([]);
  });

  it("ignores another practitioner's patients at the same time: two diaries can run side by side", () => {
    expect(check({ visits: [visit({ doctor_id: 'pr-b' })] })).toEqual([]);
  });

  it('also catches clashes in the older appointments table, which the previous check looked at', () => {
    const warnings = check({ legacyAppointments: [{ id: 'a1', time: '09:30:00', duration: 30 }] });
    expect(warnings.map((w) => w.kind)).toEqual(['doctor_overlap']);
    expect(warnings[0].message).toContain('09:30');
  });

  it('warns when the patient is already booked that day, often a duplicate from a second phone call', () => {
    const warnings = check({ visits: [visit({ patient_id: 'pat-1', doctor_id: 'pr-b', scheduled_time: '15:00:00', visit_time: '15:00:00' })] });
    expect(warnings).toEqual([
      { kind: 'patient_same_day', message: 'This patient is already booked on 7 Oct 2026 at 15:00 with T. Shikongo.' }
    ]);
  });

  it("names the reason when the time is blocked, so reception can tell the caller why (leave, lunch)", () => {
    const leave: DiaryBlock = {
      id: 'b1', practiceId: 'p1', branchId: null, branchName: null, doctorId: 'pr-a', reason: 'Annual leave',
      startDate: '2026-10-05', endDate: '2026-10-09', startMinutes: null, endMinutes: null, recurrence: 'none'
    };
    expect(check({ blocks: [leave] })).toEqual([
      { kind: 'blocked_time', message: 'N. Amupolo is unavailable all day, 5-9 Oct 2026: Annual leave.' }
    ]);
  });

  it("asks first on Heroes' Day and on days the business hours say the practice is closed", () => {
    const kinds = check({ proposal: proposal({ date: '2026-08-26' }), closedWeekday: 'wednesday' }).map((w) => w.kind);
    expect(kinds).toEqual(['public_holiday', 'closed_day']);
    expect(check({ proposal: proposal({ date: '2026-08-26' }) })[0].message).toContain("Heroes' Day");
  });
});

describe('bookingProposalKey', () => {
  it('changes when the time or practitioner changes, so "Book anyway" never carries over to a new choice', () => {
    const key = bookingProposalKey(proposal());
    expect(bookingProposalKey(proposal())).toBe(key);
    expect(bookingProposalKey(proposal({ time: '09:30' }))).not.toBe(key);
    expect(bookingProposalKey(proposal({ doctorId: 'pr-b' }))).not.toBe(key);
    expect(bookingProposalKey(proposal({ durationMinutes: 60 }))).not.toBe(key);
  });
});

describe('describeNoShowHistory', () => {
  it("tells reception about missed appointments (Eminance shows the caller's previous status too)", () => {
    expect(describeNoShowHistory(0, null)).toBeNull();
    expect(describeNoShowHistory(1, '2026-09-03')).toBe('Missed an appointment on 3 Sep 2026 (no-show).');
    expect(describeNoShowHistory(3, '2026-09-03')).toBe('Missed 3 appointments, most recently on 3 Sep 2026.');
  });
});

describe('real booking lengths in the checks', () => {
  const lengths = { consultation: 30, 'follow-up': 15, procedure: 60, emergency: 30 };

  it('sees a clash with a 60-minute procedure that a fixed 30 minutes missed', () => {
    const procedure = visit({ visit_type: 'procedure', duration_minutes: null });
    expect(check({ visits: [procedure], proposal: proposal({ time: '09:45' }), lengths })).toEqual([
      { kind: 'doctor_overlap', message: 'N. Amupolo already has a booking at 09:00 that overlaps this time.' }
    ]);
    expect(check({ visits: [procedure], proposal: proposal({ time: '10:00' }), lengths })).toEqual([]);
  });

  it('frees the rest of the half hour after a 15-minute follow-up', () => {
    const followUp = visit({ visit_type: 'follow-up', duration_minutes: null });
    expect(check({ visits: [followUp], proposal: proposal({ time: '09:15', durationMinutes: 15 }), lengths })).toEqual([]);
  });
});

describe('takenStartTimes (the booking form time list)', () => {
  it('marks every start time a booking runs through, for its own length', () => {
    const visits = [
      visit({ id: 'long', scheduled_time: '09:00:00', duration_minutes: 45 }),
      visit({ id: 'odd', scheduled_time: '11:10:00', duration_minutes: 20 }),
      visit({ id: 'gone', scheduled_time: '14:00:00', is_cancelled: true })
    ];
    expect(takenStartTimes(visits, null)).toEqual(['09:00', '09:15', '09:30', '11:15']);
  });

  it('does not mark the booking being moved against itself', () => {
    expect(takenStartTimes([visit({ id: 'me' })], null, 'me')).toEqual([]);
  });
});
