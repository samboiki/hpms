import { describe, expect, it } from 'vitest';
import {
  TEMPORARY_BIRTH_DATE,
  describeMissing,
  isTemporaryIdNumber,
  newTemporaryIdNumber,
  patientFileStatus,
  temporaryPatientRow
} from '../temporaryPatient';

// All people and numbers are invented
describe('temporary patient files (booked with a name and cell number only)', () => {
  it('uses the same marker as website booking requests, so both kinds are completed the same way', () => {
    // supabase/functions/submit-booking writes `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const id = newTemporaryIdNumber(1728000000000, () => 0.123456789);
    expect(id).toBe(`TEMP-1728000000000-${(0.123456789).toString(36).substr(2, 9)}`);
    expect(isTemporaryIdNumber(id)).toBe(true);
  });

  it('never mistakes a real ID or passport number for the marker', () => {
    expect(isTemporaryIdNumber('90051400123')).toBe(false);
    expect(isTemporaryIdNumber('P1234567')).toBe(false);
    expect(isTemporaryIdNumber(null)).toBe(false);
  });

  it('fills every column the database requires, so the booking can be saved before the patient arrives', () => {
    const row = temporaryPatientRow({ firstName: '  Ndapewa ', lastName: 'Shilongo', cellNumber: ' 081 123 4567 ' }, 'practice-1', 'TEMP-1-abc');
    expect(row).toEqual({
      first_name: 'Ndapewa',
      last_name: 'Shilongo',
      cell_number: '081 123 4567',
      id_number: 'TEMP-1-abc',
      date_of_birth: TEMPORARY_BIRTH_DATE,
      gender: 'other',
      practice_id: 'practice-1'
    });
  });
});

describe('patientFileStatus', () => {
  const temporary = { id_number: 'TEMP-1-abc', date_of_birth: TEMPORARY_BIRTH_DATE, gender: 'other' };

  it('lists what reception still has to add, in plain words', () => {
    const status = patientFileStatus(temporary);
    expect(status.incomplete).toBe(true);
    expect(describeMissing(status.missing)).toBe('ID number, date of birth and gender');
  });

  it('never shows the placeholders as a real age, birthday or gender (a dose is worked out from the age)', () => {
    const status = patientFileStatus(temporary);
    expect(status.dateOfBirth).toBeNull();
    expect(status.gender).toBeNull();
  });

  it('keeps a date of birth and gender reception already corrected, while the ID number is still missing', () => {
    const status = patientFileStatus({ ...temporary, date_of_birth: '2015-06-01', gender: 'female' });
    expect(status.missing).toEqual(['ID number']);
    expect(status.dateOfBirth).toBe('2015-06-01');
    expect(status.gender).toBe('female');
  });

  it('treats a registered patient born on 1 January 1990 as complete', () => {
    const status = patientFileStatus({ id_number: '90010100123', date_of_birth: TEMPORARY_BIRTH_DATE, gender: 'other' });
    expect(status).toEqual({ incomplete: false, missing: [], dateOfBirth: TEMPORARY_BIRTH_DATE, gender: 'other' });
  });
});
