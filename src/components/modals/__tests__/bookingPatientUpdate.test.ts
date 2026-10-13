import { describe, it, expect } from 'vitest';
import { buildBookingPatientUpdate, type BookingPatientField } from '../bookingPatientUpdate';

const form = (overrides: Partial<Record<BookingPatientField, string>> = {}) => ({
  first_name: 'Test',
  last_name: 'Patient',
  email: '',
  cell_number: '+264810000000',
  id_number: '',
  date_of_birth: '',
  ...overrides
});

// Confirming a website booking must never erase what the practice already knows about the patient.
describe('buildBookingPatientUpdate', () => {
  it('skips fields reception left blank, so details already on file are kept', () => {
    expect(buildBookingPatientUpdate(form())).toEqual({
      first_name: 'Test',
      last_name: 'Patient',
      cell_number: '+264810000000'
    });
  });

  it('never sends an empty date of birth, which the database would reject and block the booking', () => {
    expect(buildBookingPatientUpdate(form())).not.toHaveProperty('date_of_birth');
  });

  it('saves the details reception did type in, without stray spaces', () => {
    expect(buildBookingPatientUpdate(form({ id_number: ' 85010112345 ', date_of_birth: '1985-01-01' }))).toMatchObject({
      id_number: '85010112345',
      date_of_birth: '1985-01-01'
    });
  });

  it('ignores hidden form state such as a default gender, so it cannot overwrite the patient record', () => {
    const withHiddenFields = { ...form(), gender: 'other', address: '', occupation: '' };
    const update = buildBookingPatientUpdate(withHiddenFields);
    expect(update).not.toHaveProperty('gender');
    expect(update).not.toHaveProperty('address');
    expect(update).not.toHaveProperty('occupation');
  });
});
