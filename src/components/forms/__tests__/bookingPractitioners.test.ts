import { describe, expect, it } from 'vitest';
import { bookingPractitioners, type PractitionerStaffRow } from '../bookingPractitioners';
import type { WorkingHoursRow } from '../../../utils/diary/workingHours';

// An invented practice: two doctors (one has left), a nurse, a receptionist
const row = (id: string, full_name: string, role: string, is_active: boolean | null = true): PractitionerStaffRow => ({ id, full_name, role, is_active });
const STAFF = [
  row('dr-1', 'Petrus Amutenya', 'doctor'),
  row('dr-old', 'Johanna Visser', 'doctor', false),
  row('nurse-1', 'Maria Nangolo', 'nurse'),
  row('rec-1', 'Selma Haufiku', 'receptionist')
];
const hoursFor = (doctorId: string): WorkingHoursRow => ({ doctorId, branchId: null, branchName: null, dayOfWeek: 1, start: 480, end: 1020, breakStart: null, breakEnd: null });

describe('bookingPractitioners (who a booking can be made with)', () => {
  it('lists a nurse with working hours by name, as the diary gives her a column, so a booking in her column shows who it is with', () => {
    const options = bookingPractitioners(STAFF, [hoursFor('nurse-1')], null);
    expect(options.map(option => option.label)).toEqual(['Petrus Amutenya', 'Maria Nangolo (Nurse)']);
  });

  it('lists the same people as the diary: active doctors only while nobody else has working hours', () => {
    expect(bookingPractitioners(STAFF, [], null).map(option => option.id)).toEqual(['dr-1']);
  });

  it('keeps the practitioner the form was opened for (a diary column or the booking being edited), even without hours', () => {
    expect(bookingPractitioners(STAFF, [], 'nurse-1').map(option => option.id)).toEqual(['dr-1', 'nurse-1']);
  });

  it('never offers a doctor who has left for a new booking', () => {
    expect(bookingPractitioners(STAFF, [hoursFor('dr-old')], null).map(option => option.id)).not.toContain('dr-old');
  });
});
