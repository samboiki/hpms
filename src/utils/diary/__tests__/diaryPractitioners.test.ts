import { describe, it, expect } from 'vitest';
import {
  FORMER_PRACTITIONER_NAME,
  NO_PRACTITIONER_ID,
  NO_PRACTITIONER_NAME,
  diaryDayColumns,
  diaryPractitioners,
  workingHoursStaff,
  type DiaryStaffMember
} from '../diaryPractitioners';
import type { WorkingHoursRow } from '../workingHours';

// An invented practice: two doctors, a nurse, a receptionist and an administrator
const member = (id: string, name: string, role: string, isActive = true): DiaryStaffMember => ({ id, name, role, isActive });
const STAFF: DiaryStaffMember[] = [
  member('dr-2', 'Doctor Two', 'doctor'),
  member('nurse-1', 'Nurse One', 'nurse'),
  member('dr-1', 'Doctor One', 'doctor'),
  member('rec-1', 'Reception One', 'receptionist'),
  member('adm-1', 'Admin One', 'admin')
];
const hoursFor = (doctorId: string): WorkingHoursRow => ({
  doctorId,
  branchId: null,
  branchName: null,
  dayOfWeek: 1,
  start: 8 * 60,
  end: 17 * 60,
  breakStart: null,
  breakEnd: null
});
const ids = (list: Array<{ id: string }>) => list.map((item) => item.id);

describe('diaryPractitioners (who gets a diary column)', () => {
  it('gives every active doctor a column, even on a day without bookings', () => {
    expect(ids(diaryPractitioners({ staff: STAFF, workingHours: [], bookedIds: [] }))).toEqual(['dr-1', 'dr-2']);
  });

  it('gives a nurse a column once she has working hours: no role has to be set up to put her in the diary', () => {
    const columns = diaryPractitioners({ staff: STAFF, workingHours: [hoursFor('nurse-1')], bookedIds: [] });
    expect(ids(columns)).toEqual(['dr-1', 'dr-2', 'nurse-1']);
  });

  it('gives anyone with a booking in the days shown a column, so no booking is hidden from the grid', () => {
    const columns = diaryPractitioners({ staff: STAFF, workingHours: [], bookedIds: ['adm-1', 'dr-1', null, ''] });
    expect(ids(columns)).toEqual(['dr-1', 'dr-2', 'adm-1']);
  });

  it('leaves out staff who do not treat (no hours, no bookings), so the diary stays uncluttered', () => {
    const columns = diaryPractitioners({ staff: STAFF, workingHours: [], bookedIds: [] });
    expect(ids(columns)).not.toContain('rec-1');
    expect(ids(columns)).not.toContain('adm-1');
  });

  it('keeps a deactivated practitioner with bookings in view, so those patients can be moved, but no one else who left', () => {
    const staff = [...STAFF, member('dr-old', 'Doctor Old', 'doctor', false), member('dr-gone', 'Doctor Gone', 'doctor', false)];
    const columns = diaryPractitioners({ staff, workingHours: [hoursFor('dr-gone')], bookedIds: ['dr-old'] });
    expect(ids(columns)).toEqual(['dr-1', 'dr-2', 'dr-old']);
  });

  it('shows bookings of someone no longer in the practice under "Former practitioner", like the diary report', () => {
    const columns = diaryPractitioners({ staff: STAFF, workingHours: [], bookedIds: ['someone-else'] });
    expect(columns[columns.length - 1]).toEqual({ id: 'someone-else', name: FORMER_PRACTITIONER_NAME, role: null });
  });

  it('orders the columns doctors first, then the other practitioners, each by name, so they stay in the same place every day', () => {
    const staff = [...STAFF, member('nurse-0', 'Another Nurse', 'nurse')];
    const columns = diaryPractitioners({ staff, workingHours: [hoursFor('nurse-1'), hoursFor('nurse-0')], bookedIds: [] });
    expect(columns.map((column) => column.name)).toEqual(['Doctor One', 'Doctor Two', 'Another Nurse', 'Nurse One']);
  });

  it("keeps the chosen practitioner's column on a day they have no bookings, instead of an empty diary", () => {
    const columns = diaryPractitioners({ staff: STAFF, workingHours: [], bookedIds: [], chosenIds: ['rec-1'] });
    expect(ids(columns)).toContain('rec-1');
  });
});

describe('diaryDayColumns (the day grid)', () => {
  const practitioners = diaryPractitioners({ staff: STAFF, workingHours: [hoursFor('nurse-1')], bookedIds: [] });

  it("shows only the chosen practitioner's column, so the other diaries do not look free", () => {
    expect(ids(diaryDayColumns(practitioners, ['nurse-1'], ['nurse-1', 'dr-1']))).toEqual(['nurse-1']);
  });

  it('shows several chosen practitioners side by side in column order, e.g. a doctor covering a colleague', () => {
    expect(ids(diaryDayColumns(practitioners, ['nurse-1', 'dr-1'], []))).toEqual(['dr-1', 'nurse-1']);
  });

  it('adds a "No practitioner yet" column for a booking without one (a website request), so it is not hidden', () => {
    const columns = diaryDayColumns(practitioners, [], ['dr-1', '']);
    expect(columns[columns.length - 1]).toEqual({ id: NO_PRACTITIONER_ID, name: NO_PRACTITIONER_NAME, role: null });
    expect(ids(diaryDayColumns(practitioners, ['dr-1'], [null]))).toEqual(['dr-1', NO_PRACTITIONER_ID]);
  });

  it('adds no extra column when every booking has a practitioner', () => {
    expect(ids(diaryDayColumns(practitioners, [], ['dr-1', 'dr-2']))).toEqual(['dr-1', 'dr-2', 'nurse-1']);
  });
});

describe('workingHoursStaff (whose hours Diary settings lists)', () => {
  const staff = [...STAFF, member('nurse-x', 'Nurse Left', 'nurse', false)];
  const practitioners = diaryPractitioners({ staff, workingHours: [], bookedIds: [] });

  it('shows an administrator every active staff member, practitioners first: giving someone hours is how they get a column', () => {
    expect(ids(workingHoursStaff(staff, practitioners, true))).toEqual(['dr-1', 'dr-2', 'adm-1', 'nurse-1', 'rec-1']);
  });

  it('shows everyone else only the practitioners already in the diary, so reception does not land on its own empty hours', () => {
    expect(ids(workingHoursStaff(staff, practitioners, false))).toEqual(['dr-1', 'dr-2']);
  });
});
