import { describe, it, expect } from 'vitest';
import {
  describeWorkingWeek,
  normalizeWorkingHoursRow,
  practitionerDayHours,
  practitionerHoursResolver,
  validateWeekDraft,
  weekDraftFromRows,
  workingHoursLabels,
  workingHoursProblem,
  type WorkingHoursRow
} from '../workingHours';
import { findNextFreeSlot, practiceHoursResolver } from '../nextFreeSlot';
import { findBookingWarnings } from '../bookingChecks';

// Dr A works Monday to Friday 08:00-17:00 with lunch 13:00-14:00, and Saturday mornings.
// Dr B works Tuesdays at two branches: 08:00-12:00 in town, 14:00-17:00 at the clinic.
const row = (overrides: Partial<WorkingHoursRow>): WorkingHoursRow => ({
  doctorId: 'pr-a',
  branchId: null,
  branchName: null,
  dayOfWeek: 1,
  start: 8 * 60,
  end: 17 * 60,
  breakStart: 13 * 60,
  breakEnd: 14 * 60,
  ...overrides
});
const ROWS: WorkingHoursRow[] = [
  ...[1, 2, 3, 4, 5].map((dayOfWeek) => row({ dayOfWeek })),
  row({ dayOfWeek: 6, end: 12 * 60, breakStart: null, breakEnd: null }),
  row({ doctorId: 'pr-b', dayOfWeek: 2, end: 12 * 60, breakStart: null, breakEnd: null, branchName: 'Town' }),
  row({ doctorId: 'pr-b', dayOfWeek: 2, start: 14 * 60, breakStart: null, breakEnd: null, branchName: 'Clinic' })
];
const PRACTICE_HOURS = practiceHoursResolver({
  monday: { open: '07:30', close: '18:00' },
  tuesday: { open: '07:30', close: '18:00' },
  wednesday: { open: '07:30', close: '18:00' },
  thursday: { open: '07:30', close: '18:00' },
  friday: { open: '07:30', close: '18:00' },
  saturday: { closed: true },
  sunday: { closed: true }
});

describe('practitionerDayHours', () => {
  it("returns the practitioner's own hours with the lunch break", () => {
    expect(practitionerDayHours(ROWS, 'pr-a', '2026-10-07')).toEqual({ open: 480, close: 1020, breaks: [{ start: 780, end: 840, kind: 'break' }] });
  });

  it('treats a day without hours as a day off once any hours are saved', () => {
    expect(practitionerDayHours(ROWS, 'pr-a', '2026-10-11')).toBeNull(); // a Sunday
  });

  it('leaves practitioners without saved hours on the practice opening hours, as before', () => {
    expect(practitionerDayHours(ROWS, 'pr-c', '2026-10-07')).toBeUndefined();
    expect(practitionerHoursResolver(ROWS, 'pr-c', PRACTICE_HOURS)('2026-10-07')).toEqual({ open: 450, close: 1080 });
  });

  it('turns the time between two branches into a gap nobody is booked into', () => {
    expect(practitionerDayHours(ROWS, 'pr-b', '2026-10-06')).toEqual({ open: 480, close: 1020, breaks: [{ start: 720, end: 840, kind: 'gap' }] });
  });
});

describe('workingHoursProblem (warn, never refuse)', () => {
  const day = (doctor: string, date: string) => practitionerDayHours(ROWS, doctor, date);

  it('says nothing inside the hours or when no hours are saved', () => {
    expect(workingHoursProblem(day('pr-a', '2026-10-07'), '2026-10-07', 9 * 60, 9 * 60 + 30, 'Dr. A')).toBeNull();
    expect(workingHoursProblem(undefined, '2026-10-07', 22 * 60, 23 * 60, 'Dr. C')).toBeNull();
  });

  it('names the day off, the hours and the break, so reception can tell the caller', () => {
    expect(workingHoursProblem(day('pr-a', '2026-10-11'), '2026-10-11', 600, 630, 'Dr. A')).toBe('Dr. A does not work on Sundays.');
    expect(workingHoursProblem(day('pr-a', '2026-10-07'), '2026-10-07', 16 * 60 + 45, 17 * 60 + 15, 'Dr. A')).toBe(
      'Dr. A works 08:00-17:00 on Wednesdays; 16:45-17:15 is outside these hours.'
    );
    expect(workingHoursProblem(day('pr-a', '2026-10-07'), '2026-10-07', 12 * 60 + 45, 13 * 60 + 15, 'Dr. A')).toBe(
      "12:45-13:15 is during Dr. A's break (13:00-14:00)."
    );
    expect(workingHoursProblem(day('pr-b', '2026-10-06'), '2026-10-06', 12 * 60, 12 * 60 + 30, 'Dr. B')).toBe(
      'Dr. B is not working 12:00-14:00 on Tuesdays.'
    );
  });

  it('becomes a booking warning with "Book anyway", like a clash or a holiday', () => {
    const warnings = findBookingWarnings({
      proposal: { visitId: null, patientId: 'pat', doctorId: 'pr-a', date: '2026-10-07', time: '13:00', durationMinutes: 30 },
      visits: [],
      blocks: [],
      doctorName: () => 'Dr. A',
      practitionerDay: practitionerDayHours(ROWS, 'pr-a', '2026-10-07')
    });
    expect(warnings).toEqual([{ kind: 'outside_hours', message: "13:00-13:30 is during Dr. A's break (13:00-14:00)." }]);
  });
});

describe('next free slot with working hours', () => {
  it('skips the break and starts after it', () => {
    const slot = findNextFreeSlot({
      doctorId: 'pr-a',
      fromDate: '2026-10-07',
      notBefore: '12:50',
      durationMinutes: 30,
      days: 1,
      hoursFor: practitionerHoursResolver(ROWS, 'pr-a', PRACTICE_HOURS),
      visits: [],
      blocks: []
    });
    expect(slot).toEqual({ date: '2026-10-07', time: '14:00' });
  });

  it("offers the practitioner's Saturday morning even though the practice says closed", () => {
    const slot = findNextFreeSlot({
      doctorId: 'pr-a',
      fromDate: '2026-10-10',
      durationMinutes: 30,
      days: 1,
      hoursFor: practitionerHoursResolver(ROWS, 'pr-a', PRACTICE_HOURS),
      visits: [],
      blocks: []
    });
    expect(slot).toEqual({ date: '2026-10-10', time: '08:00' });
  });
});

describe('workingHoursLabels (time picker)', () => {
  it('marks the break and the time outside the hours, and nothing when no hours are saved', () => {
    const labels = workingHoursLabels(practitionerDayHours(ROWS, 'pr-a', '2026-10-07'), 7 * 60 + 30, 18 * 60);
    expect(labels['07:45']).toBe('Not working');
    expect(labels['08:00']).toBeUndefined();
    expect(labels['13:30']).toBe('Break');
    expect(labels['17:00']).toBe('Not working');
    expect(workingHoursLabels(undefined, 0, 600)).toEqual({});
  });
});

describe('describeWorkingWeek', () => {
  it('groups equal days so the week reads in one line', () => {
    expect(describeWorkingWeek(ROWS, 'pr-a')).toBe('Mon-Fri 08:00-17:00 (break 13:00-14:00), Sat 08:00-12:00');
    expect(describeWorkingWeek(ROWS, 'pr-b')).toBe('Tue 08:00-12:00 at Town and 14:00-17:00 at Clinic');
    expect(describeWorkingWeek(ROWS, 'pr-c')).toBeNull();
  });
});

describe('the hours editor', () => {
  it("starts from the practice's opening hours for a practitioner without hours (a suggestion, not saved)", () => {
    const draft = weekDraftFromRows(ROWS, 'pr-c', PRACTICE_HOURS);
    expect(draft[1]).toMatchObject({ works: true, start: '07:30', end: '18:00', hasBreak: false });
    expect(draft[6].works).toBe(false);
  });

  it('round-trips saved hours into what save_practitioner_hours takes', () => {
    const result = validateWeekDraft(weekDraftFromRows(ROWS, 'pr-a', PRACTICE_HOURS));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.days).toHaveLength(6);
      expect(result.days[0]).toEqual({ day_of_week: 1, branch_id: null, start_time: '08:00', end_time: '17:00', break_start: '13:00', break_end: '14:00' });
    }
  });

  it('refuses a break outside the hours or an end before the start, in plain words', () => {
    const draft = weekDraftFromRows([], 'pr-c', PRACTICE_HOURS);
    draft[1] = { ...draft[1], hasBreak: true, breakStart: '07:00', breakEnd: '08:00' };
    draft[2] = { ...draft[2], end: '07:00' };
    expect(validateWeekDraft(draft)).toEqual({
      ok: false,
      errors: ['Monday: the break must fall inside the working hours.', 'Tuesday: the end time must be after the start time.']
    });
  });
});

describe('normalizeWorkingHoursRow', () => {
  it('reads a saved row with its branch and drops rows switched off or unreadable', () => {
    expect(
      normalizeWorkingHoursRow({
        doctor_id: 'pr-a',
        branch_id: 'br-1',
        day_of_week: 2,
        start_time: '08:00:00',
        end_time: '12:00:00',
        break_start: null,
        break_end: null,
        is_active: true,
        branch: { name: 'Town' }
      })
    ).toEqual({ doctorId: 'pr-a', branchId: 'br-1', branchName: 'Town', dayOfWeek: 2, start: 480, end: 720, breakStart: null, breakEnd: null });
    expect(normalizeWorkingHoursRow({ doctor_id: 'pr-a', day_of_week: 2, start_time: '08:00', end_time: '12:00', is_active: false })).toBeNull();
    expect(normalizeWorkingHoursRow({ doctor_id: 'pr-a', day_of_week: 9, start_time: '08:00', end_time: '12:00' })).toBeNull();
  });
});
