import { describe, it, expect } from 'vitest';
import {
  APPOINTMENT_TYPES_MAX,
  bookableAppointmentTypes,
  countTypeBookings,
  dailyLimitWarning,
  describeAppointmentType,
  normalizeAppointmentTypeRow,
  validateAppointmentType,
  type AppointmentType,
  type TypedBooking
} from '../appointmentTypes';

// An invented practice's types
const NEW_PATIENT: AppointmentType = { id: 't-new', name: 'New patient', visitType: 'consultation', lengthMinutes: 45, dailyLimit: 4, isActive: true };
const REVIEW: AppointmentType = { id: 't-rev', name: 'Review', visitType: 'follow-up', lengthMinutes: 15, dailyLimit: null, isActive: true };
const OLD: AppointmentType = { id: 't-old', name: 'Old type', visitType: 'procedure', lengthMinutes: 60, dailyLimit: null, isActive: false };
const TYPES = [REVIEW, NEW_PATIENT, OLD];

const booking = (id: string, extra: Partial<TypedBooking> = {}): TypedBooking => ({
  id,
  doctor_id: 'pr-a',
  appointment_type_id: 't-new',
  scheduled_date: '2026-10-13',
  visit_date: '2026-10-13',
  status: 'scheduled',
  is_cancelled: false,
  ...extra
});

describe('countTypeBookings (how full the day is for the type)', () => {
  const day = [
    booking('v1'),
    booking('v2', { status: 'completed' }),
    booking('v3', { status: 'cancelled', is_cancelled: true }),
    booking('v4', { status: 'no-show' }),
    booking('v5', { doctor_id: 'pr-b' }),
    booking('v6', { scheduled_date: '2026-10-14', visit_date: '2026-10-14' }),
    booking('v7', { appointment_type_id: 't-rev' }),
    booking('v8', { appointment_type_id: null })
  ];
  const query = { typeId: 't-new', practitionerId: 'pr-a', date: '2026-10-13' };

  it("counts the practitioner's bookings of the type that day, seen or still to come", () => {
    expect(countTypeBookings(day, query)).toBe(2);
  });

  // A cancelled booking or a no-show freed its place: counting it would warn about a day that is not full
  it('leaves out cancelled bookings and no-shows, and the booking being moved', () => {
    expect(countTypeBookings(day, { ...query, ignoreVisitId: 'v1' })).toBe(1);
  });
});

describe('dailyLimitWarning', () => {
  it('warns once the practitioner has the most the practice books that day, naming the type, the day and the limit', () => {
    expect(dailyLimitWarning(NEW_PATIENT, 4, '2026-10-13', 'Dr A. Example')).toEqual({
      kind: 'type_daily_limit',
      message: 'New patient: Dr A. Example already has 4 on 13 Oct 2026, and the practice books at most 4 a day.'
    });
  });

  it('says nothing below the limit, or for a type without one', () => {
    expect(dailyLimitWarning(NEW_PATIENT, 3, '2026-10-13', 'Dr A')).toBeNull();
    expect(dailyLimitWarning(REVIEW, 40, '2026-10-13', 'Dr A')).toBeNull();
    expect(dailyLimitWarning(null, 40, '2026-10-13', 'Dr A')).toBeNull();
  });
});

describe('validateAppointmentType (Diary settings, before the database checks the same)', () => {
  it('accepts "New patient, 45 min, at most 4 a day" and reads 0 as no limit', () => {
    expect(validateAppointmentType({ name: ' Check-up ', visitType: 'consultation', lengthMinutes: 20, dailyLimit: 0 }, TYPES)).toEqual({
      ok: true,
      value: { name: 'Check-up', visitType: 'consultation', lengthMinutes: 20, dailyLimit: null }
    });
  });

  it('refuses a name in use, a length the bookings could not have and a limit out of range, in plain words', () => {
    const result = validateAppointmentType({ name: 'new PATIENT', visitType: 'surgery', lengthMinutes: 3, dailyLimit: 51 }, TYPES);
    expect(result).toEqual({
      ok: false,
      errors: [
        'There is already an appointment type called "new PATIENT".',
        'Choose what the appointment is billed and reported as.',
        'Choose a length of 5 to 480 minutes.',
        'The daily limit is 1 to 50 bookings, or none.'
      ]
    });
  });

  it('allows the name of a removed type, and an edited type its own name', () => {
    expect(validateAppointmentType({ name: 'Old type', visitType: 'procedure', lengthMinutes: 60, dailyLimit: null }, TYPES).ok).toBe(true);
    expect(validateAppointmentType({ name: 'New patient', visitType: 'consultation', lengthMinutes: 40, dailyLimit: 5 }, TYPES, 't-new').ok).toBe(true);
  });

  it('stops at the same number of types as the database', () => {
    const many = Array.from({ length: APPOINTMENT_TYPES_MAX }, (_, index) => ({ ...REVIEW, id: `t${index}`, name: `Type ${index}` }));
    expect(validateAppointmentType({ name: 'One more', visitType: 'consultation', lengthMinutes: 30, dailyLimit: null }, many).ok).toBe(false);
  });
});

describe('what the booking form offers and shows', () => {
  it('offers the active types by name, never a removed one', () => {
    expect(bookableAppointmentTypes(TYPES).map((type) => type.name)).toEqual(['New patient', 'Review']);
  });

  it('describes a type in the words reception reads', () => {
    expect(describeAppointmentType(NEW_PATIENT)).toBe('45 min, at most 4 a day per practitioner, billed as Consultation');
    expect(describeAppointmentType(REVIEW)).toBe('15 min, billed as Follow-up');
  });

  it('reads a row, and drops one with a length the diary cannot draw', () => {
    expect(normalizeAppointmentTypeRow({ id: 'x', name: 'Scale and polish', visit_type: 'procedure', length_minutes: 30, daily_limit: null, is_active: true })).toEqual({
      id: 'x',
      name: 'Scale and polish',
      visitType: 'procedure',
      lengthMinutes: 30,
      dailyLimit: null,
      isActive: true
    });
    expect(normalizeAppointmentTypeRow({ id: 'y', name: 'Bad', visit_type: 'procedure', length_minutes: 2 })).toBeNull();
  });
});
