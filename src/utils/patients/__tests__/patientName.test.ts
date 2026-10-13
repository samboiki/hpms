import { describe, expect, it } from 'vitest';
import { PATIENT_TITLES, followInitials, formalPatientName, titleOptions } from '../patientName';

// All people are invented
describe('formalPatientName', () => {
  it('addresses the patient by title, initials and surname, as on a letter or statement', () => {
    expect(formalPatientName({ title: 'Mrs', initials: 'NM', first_name: 'Ndapewa Maria', last_name: 'Shilongo' })).toBe('Mrs N M Shilongo');
  });

  it('takes the initials from the first names when none were saved', () => {
    expect(formalPatientName({ title: 'Dr', initials: null, first_name: 'Johannes Petrus', last_name: 'van Wyk' })).toBe('Dr J P van Wyk');
  });

  it('works without a title once initials are saved', () => {
    expect(formalPatientName({ title: '', initials: 'T', first_name: 'Tangeni', last_name: 'Nangolo' })).toBe('T Nangolo');
  });

  it('shows nothing formal for a file with neither title nor initials (the full name is shown instead)', () => {
    expect(formalPatientName({ first_name: 'Tangeni', last_name: 'Nangolo' })).toBeNull();
  });
});

describe('followInitials', () => {
  it('fills the initials from the first names as they are typed', () => {
    expect(followInitials('', '', 'Ndapewa')).toBe('N');
    expect(followInitials('N', 'Ndapewa', 'Ndapewa Maria')).toBe('NM');
  });

  it('keeps initials reception typed themselves (a patient known by another name)', () => {
    expect(followInitials('J', 'Ndapewa', 'Ndapewa Maria')).toBeNull();
  });
});

describe('titleOptions', () => {
  it('offers the usual titles, blank meaning none', () => {
    expect(titleOptions(null)).toEqual([...PATIENT_TITLES]);
  });

  it('keeps a title already on the file that is not in the list, so saving the form never wipes it', () => {
    expect(titleOptions('Adv')).toEqual([...PATIENT_TITLES, 'Adv']);
  });
});
