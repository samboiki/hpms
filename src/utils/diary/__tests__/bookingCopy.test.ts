import { describe, it, expect } from 'vitest';
import { bookAgainFrom, bookingReason, describeCopied, pastePractitioner, prefillFromBooking, type CopyableBooking } from '../bookingCopy';

// An invented booking: a 45-minute procedure with Dr One
const booking = (overrides: Partial<CopyableBooking> = {}): CopyableBooking => ({
  patient_id: 'pt-1',
  doctor_id: 'dr-1',
  type: 'procedure',
  duration: 45,
  reason: 'Dressing change',
  patient: { first_name: 'Anna', last_name: 'Tester' },
  ...overrides
});

describe('prefillFromBooking ("Book again" and "Copy")', () => {
  it('carries the patient, practitioner, type, length and reason, so a follow-up is not typed again', () => {
    expect(prefillFromBooking(booking())).toEqual({
      patientId: 'pt-1',
      patientName: 'Anna Tester',
      patientFirstName: 'Anna',
      practitionerId: 'dr-1',
      type: 'procedure',
      durationMinutes: 45,
      reason: 'Dressing change',
      appointmentTypeId: null
    });
  });

  // A "New patient" booked again stays a "New patient": its length and daily limit come with it
  it("carries the practice's appointment type when the booking was made as one", () => {
    expect(prefillFromBooking(booking({ appointment_type_id: 't-new' }))?.appointmentTypeId).toBe('t-new');
  });

  it('cannot copy a booking without a patient: there is nobody to book', () => {
    expect(prefillFromBooking(booking({ patient_id: null }))).toBeNull();
    expect(prefillFromBooking(booking({ patient_id: '' }))).toBeNull();
  });

  it('copies a website request without a practitioner, leaving the practitioner for reception to choose', () => {
    expect(prefillFromBooking(booking({ doctor_id: '' }))?.practitionerId).toBeNull();
  });

  it('falls back to a consultation of 30 minutes when the type or length cannot be read, values the form accepts', () => {
    const copy = prefillFromBooking(booking({ type: 'unknown', duration: 0 }));
    expect([copy?.type, copy?.durationMinutes]).toEqual(['consultation', 30]);
  });

  it('names the patient by surname when the first name is missing, so the banner never says "Copied: ,"', () => {
    expect(prefillFromBooking(booking({ patient: { first_name: '', last_name: 'Tester' } }))?.patientFirstName).toBe('Tester');
  });
});

describe('bookingReason', () => {
  it("never copies the booking form's automatic \"Appointment scheduled for ...\" line: it names the old date", () => {
    expect(bookingReason('Appointment scheduled for 08 Oct 2026 at 09:00 - 09:30')).toBe('');
  });

  it('keeps the reason reception typed', () => {
    expect(bookingReason('  Review blood results ')).toBe('Review blood results');
    expect(bookingReason(null)).toBe('');
  });
});

describe('bookAgainFrom (where "Book again" starts looking for a free time)', () => {
  it('looks from the day after the booking: the patient is not booked twice on the same day', () => {
    expect(bookAgainFrom('2026-10-12', '2026-10-09')).toBe('2026-10-13');
  });

  it('never looks in the past for an old booking', () => {
    expect(bookAgainFrom('2026-09-01', '2026-10-09')).toBe('2026-10-09');
  });

  it('looks from today when the booking has no readable date', () => {
    expect(bookAgainFrom(null, '2026-10-09')).toBe('2026-10-09');
    expect(bookAgainFrom('not a date', '2026-10-09')).toBe('2026-10-09');
  });
});

describe('pastePractitioner (pasting into a free time)', () => {
  const copied = prefillFromBooking(booking())!;

  it("books into the practitioner column that was clicked: reception chose that practitioner's time", () => {
    expect(pastePractitioner('dr-2', copied)).toBe('dr-2');
  });

  it("keeps the copied booking's practitioner where the grid has no practitioner columns (the week)", () => {
    expect(pastePractitioner(undefined, copied)).toBe('dr-1');
  });
});

describe('describeCopied (the diary banner)', () => {
  it('says whose booking is copied and how long it is, in plain words', () => {
    expect(describeCopied(prefillFromBooking(booking())!)).toBe('Anna, 45 min');
    expect(describeCopied(prefillFromBooking(booking({ duration: 60 }))!)).toBe('Anna, 1 hour');
  });
});
