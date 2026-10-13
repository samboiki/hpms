import { describe, it, expect } from 'vitest';
import { matchesPatientSearch, patientSearchFields, patientSearchRank } from '../patientSearch';

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

// All people and numbers are invented
const patient = (overrides: Record<string, unknown> = {}) => ({
  first_name: 'Ndapewa',
  last_name: 'Shilongo',
  id_number: '90051400123',
  cell_number: '081 123 4567',
  email: 'ndapewa@example.com',
  system_patient_reference_number: 1234,
  legacy_account_number: '0004321',
  medical_aid_details: [{ membership_number: '123456789' }],
  ...overrides
});
const rank = (query: string, overrides: Record<string, unknown> = {}) => patientSearchRank(patientSearchFields(patient(overrides)), query);

describe('patient search: what reception can type', () => {
  it('finds the ID number, typed whole or with the spaces on the ID card', () => {
    expect(rank('90051400123')).toBe(0);
    expect(rank('9005 1400 123')).not.toBeNull();
  });

  it('finds the OneHealth reference as statements print it (1234) and as claims print it (0001234)', () => {
    expect(rank('1234')).toBe(0);
    expect(rank('0001234')).toBe(0);
  });

  it('finds a caller by cell number however it was saved, so a phone booking finds the existing file', () => {
    expect(rank('0811234567')).toBe(0);
    expect(rank('0811234567', { cell_number: '+264811234567' })).toBe(0);
    expect(rank('081 123 4567', { cell_number: '+264 81 123 4567' })).not.toBeNull();
  });

  it('never finds a file by the placeholder ID number of a booking made with name and cell only', () => {
    // The placeholder is not the patient's number; its digits would only add false matches
    const temporary = { id_number: 'TEMP-1728000000000-abc123xyz' };
    expect(rank('temp', temporary)).toBeNull();
    expect(rank('1728000000000', temporary)).toBeNull();
  });
});

describe('patient search: best matches first, without a search mode', () => {
  it('ranks an exact word, then a word that starts with the text, then one that only contains it', () => {
    expect(rank('Shilongo')).toBe(0);
    expect(rank('Shil')).toBe(1);
    expect(rank('longo')).toBe(2);
  });

  it('ranks a patient by their weakest word, so "Ndapewa Shil" is a starts-with match', () => {
    expect(rank('Ndapewa Shilongo')).toBe(0);
    expect(rank('Ndapewa Shil')).toBe(1);
  });

  it('puts the patient whose ID number was typed in full above patients whose numbers only contain it', () => {
    const typed = '90051400123';
    const exact = rank(typed);
    const containing = rank(typed, { id_number: '1900514001234' });
    expect(exact).toBe(0);
    expect(containing).toBe(2);
  });
});
