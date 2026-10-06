import { describe, it, expect } from 'vitest';
import { matchesPatientSearch } from '../patientSearch';

// Fields as the Patients page passes them: first name, last name, patient number, email, cell, medical aid number
const thandi = ['Thandi', 'van Wyk', 'P-1001', 'thandi@example.com', '0811234567', 'NHP-555'];

describe('matchesPatientSearch', () => {
  it('finds a patient when reception types the full name', () => {
    // The old filter compared "thandi van wyk" to each field separately, so this returned nothing
    expect(matchesPatientSearch(thandi, 'Thandi van Wyk')).toBe(true);
  });

  it('finds a patient when the surname is typed first', () => {
    expect(matchesPatientSearch(thandi, 'van wyk thandi')).toBe(true);
  });

  it('finds a patient by medical aid number, as the search box promises', () => {
    expect(matchesPatientSearch(thandi, 'nhp-555')).toBe(true);
  });

  it('rejects a patient when any typed word is missing, so similar names do not crowd the list', () => {
    expect(matchesPatientSearch(thandi, 'Thandi Nghipandulwa')).toBe(false);
  });

  it('ignores missing fields and extra spaces', () => {
    expect(matchesPatientSearch(['Thandi', null, undefined], '  thandi  ')).toBe(true);
  });

  it('matches everyone when the query is blank', () => {
    expect(matchesPatientSearch(thandi, '   ')).toBe(true);
  });
});
