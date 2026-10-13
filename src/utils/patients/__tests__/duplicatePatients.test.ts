import { describe, expect, it } from 'vitest';
import {
  combineDuplicateMatches,
  findCallerDuplicates,
  findDuplicatePatients,
  findTemporaryFilesByCell,
  normalizeName,
  referenceNumberKey,
  sameMembership,
  type ExistingPatient,
  type PatientIdentity
} from '../duplicatePatients';

// Invented people
const existing = (overrides: Partial<ExistingPatient>): ExistingPatient => ({
  id: 'p1',
  first_name: 'Ndapewa',
  last_name: 'Shilongo',
  id_number: '90051400123',
  date_of_birth: '1990-05-14',
  cell_number: '081 123 4567',
  ...overrides
});

const newPatient = (overrides: Partial<PatientIdentity>): PatientIdentity => ({
  firstName: 'Ndapewa',
  lastName: 'Shilongo',
  idNumber: '90051400999',
  dateOfBirth: '1990-05-14',
  cellNumber: null,
  ...overrides
});

describe('normalizeName', () => {
  it('ignores case, accents, hyphens and extra spaces, which differ between how two receptionists type a name', () => {
    expect(normalizeName('  Hélène-Marie  ')).toBe('helene marie');
    expect(normalizeName('SHILONGO')).toBe('shilongo');
  });
});

describe('findDuplicatePatients', () => {
  it('finds the same ID number however it was spaced, because that is almost certainly the same person', () => {
    const matches = findDuplicatePatients(newPatient({ idNumber: '9005 1400 123', firstName: 'Other', dateOfBirth: '1991-01-01' }), [existing({})]);
    expect(matches).toHaveLength(1);
    expect(matches[0].reasons).toEqual(['id_number']);
  });

  it('finds the same name and date of birth even when middle names were left out', () => {
    const matches = findDuplicatePatients(newPatient({ firstName: 'Ndapewa Maria' }), [existing({})]);
    expect(matches[0].reasons).toEqual(['name_and_birth_date']);
  });

  it('finds first and last names typed the wrong way round', () => {
    const matches = findDuplicatePatients(newPatient({ firstName: 'Shilongo', lastName: 'Ndapewa' }), [existing({})]);
    expect(matches[0].reasons).toEqual(['name_and_birth_date']);
  });

  it('finds the same cell number and birthday in any number format (a parent registering a child twice)', () => {
    const matches = findDuplicatePatients(
      newPatient({ firstName: 'Ndapewa', lastName: 'Nangolo', cellNumber: '+264 81 123 4567' }),
      [existing({})]
    );
    expect(matches[0].reasons).toEqual(['cell_and_birth_date']);
  });

  it('does not flag a namesake born on another day: a common name alone is not a duplicate', () => {
    expect(findDuplicatePatients(newPatient({ dateOfBirth: '1985-01-01' }), [existing({})])).toEqual([]);
  });

  it('does not flag a shared cell number without the same birthday (families share numbers)', () => {
    expect(
      findDuplicatePatients(newPatient({ firstName: 'Tangeni', dateOfBirth: '2015-06-01', cellNumber: '0811234567' }), [existing({})])
    ).toEqual([]);
  });

  it('lists ID matches first and every reason a file matched', () => {
    const sameName = existing({ id: 'p2', id_number: '80010100555', cell_number: null });
    const sameId = existing({ id: 'p3', first_name: 'Someone', last_name: 'Else', id_number: '90051400999', date_of_birth: '1970-01-01' });
    const matches = findDuplicatePatients(newPatient({ cellNumber: '0811234567' }), [sameName, sameId, existing({})]);
    expect(matches.map(match => match.patient.id)).toEqual(['p3', 'p1', 'p2']);
    expect(matches[1].reasons).toEqual(['name_and_birth_date', 'cell_and_birth_date']);
  });

  it('ignores empty ID numbers so two patients without one never match on it', () => {
    expect(findDuplicatePatients(newPatient({ idNumber: '', dateOfBirth: '1999-09-09' }), [existing({ id_number: '' })])).toEqual([]);
  });
});

// A caller booked by phone gives only a name and a cell number. Opening a new file for someone who already has one
// splits their history (allergies on one file, invoices on the other), so reception is offered the existing files first.
describe('findCallerDuplicates', () => {
  const caller = { firstName: 'Ndapewa', lastName: 'Shilongo', cellNumber: '0811234567' };

  it('offers the file with the same name and cell number first, whatever format the number was saved in', () => {
    const sameCellOnly = existing({ id: 'p2', first_name: 'Tangeni', last_name: 'Nangolo' });
    const matches = findCallerDuplicates(caller, [sameCellOnly, existing({ cell_number: '+264 81 123 4567' })]);
    expect(matches.map(match => match.patient.id)).toEqual(['p1', 'p2']);
    expect(matches[0].reasons).toEqual(['name', 'cell_number']);
    expect(matches[1].reasons).toEqual(['cell_number']);
  });

  it('finds the name typed the wrong way round, or without the middle name on file', () => {
    const swapped = findCallerDuplicates({ ...caller, firstName: 'Shilongo', lastName: 'Ndapewa', cellNumber: '' }, [existing({ first_name: 'Ndapewa Maria' })]);
    expect(swapped[0].reasons).toEqual(['name']);
  });

  it('offers nothing for another name on another number, so a new caller is booked without a detour', () => {
    expect(findCallerDuplicates(caller, [existing({ first_name: 'Maria', last_name: 'Nghifikwa', cell_number: '0851112222' })])).toEqual([]);
  });

  it('never matches on a missing or undiallable cell number', () => {
    expect(findCallerDuplicates({ ...caller, firstName: 'Other', cellNumber: 'n/a' }, [existing({ cell_number: 'n/a' })])).toEqual([]);
  });
});

// A caller booked by phone gets a temporary file with a placeholder birthday. When reception later registers the same
// person in full, the name-and-birthday rule cannot see that file: without the cell number rule the person ends up with
// two files, and their booking stays on the incomplete one.
describe('findTemporaryFilesByCell', () => {
  const temporary = existing({ id: 'temp-1', id_number: 'TEMP-1728000000000-abc123xyz', date_of_birth: '1990-01-01', cell_number: '+264 81 123 4567' });

  it('finds the caller\'s temporary file by the cell number in any format, whatever its birthday', () => {
    const matches = findTemporaryFilesByCell(newPatient({ dateOfBirth: '1985-03-02', cellNumber: '081 123 4567' }), [temporary]);
    expect(matches).toEqual([{ patient: temporary, reasons: ['temporary_file'] }]);
  });

  it('leaves complete files to the other rules: a shared family number alone is not a duplicate', () => {
    expect(findTemporaryFilesByCell(newPatient({ cellNumber: '0811234567' }), [existing({ date_of_birth: '1970-01-01' })])).toEqual([]);
  });

  it('needs a cell number that can be dialled', () => {
    expect(findTemporaryFilesByCell(newPatient({ cellNumber: '' }), [temporary])).toEqual([]);
  });
});

describe('combineDuplicateMatches', () => {
  it('lists each file once with all its reasons: the same ID first, then the caller\'s temporary file, then the rest', () => {
    const sameId = { patient: existing({ id: 'p-id' }), reasons: ['id_number' as const] };
    const sameName = { patient: existing({ id: 'p-name' }), reasons: ['name_and_birth_date' as const, 'cell_and_birth_date' as const] };
    const temporaryFile = { patient: existing({ id: 'p-temp' }), reasons: ['temporary_file' as const] };
    const alsoByName = { patient: existing({ id: 'p-temp' }), reasons: ['name_and_birth_date' as const] };
    const combined = combineDuplicateMatches([sameName, alsoByName, sameId], [temporaryFile]);
    expect(combined.map(match => match.patient.id)).toEqual(['p-id', 'p-temp', 'p-name']);
    expect(combined[1].reasons).toEqual(['name_and_birth_date', 'temporary_file']);
  });

  it('keeps the order of the other rules when no temporary file matched', () => {
    const matches = findDuplicatePatients(newPatient({ cellNumber: '0811234567' }), [existing({})]);
    expect(combineDuplicateMatches(matches, [])).toEqual(matches);
  });
});

// A membership number or old file number is typed in many ways ("0012 345", "12345"); a placeholder such as "N/A" or
// "0" must never make every file look like the same person.
describe('referenceNumberKey', () => {
  it('compares numbers without spaces, dashes or leading zeros', () => {
    expect(referenceNumberKey('0012 345')).toBe('12345');
    expect(referenceNumberKey('12-345')).toBe(referenceNumberKey('012345'));
  });

  it('gives nothing for placeholders with fewer than 3 digits', () => {
    expect(referenceNumberKey('N/A')).toBe('');
    expect(referenceNumberKey('0')).toBe('');
    expect(referenceNumberKey('')).toBe('');
  });
});

// One person on a fund is the fund, the membership number and the dependant code: a family shares the number.
describe('sameMembership', () => {
  const psemas = { fundId: 'fund-psemas', fundName: 'PSEMAS', number: '00123456', dependantCode: '01' };
  const ndapewa = { firstName: 'Ndapewa', dateOfBirth: '1990-05-14' };

  it('is the same person with the same fund, number and dependant code, whatever the name on the file', () => {
    expect(sameMembership(psemas, ndapewa, { ...psemas, number: '123456' }, { firstName: 'Maria', dateOfBirth: '1991-01-01' })).toBe(true);
  });

  it('is another family member with another dependant code', () => {
    expect(sameMembership(psemas, ndapewa, { ...psemas, dependantCode: '02' }, ndapewa)).toBe(false);
  });

  it('without a dependant code, needs the same first name or birthday, so a child is not taken for the parent', () => {
    const noCode = { ...psemas, dependantCode: null };
    expect(sameMembership(noCode, ndapewa, noCode, { firstName: 'Ndapewa Maria', dateOfBirth: null })).toBe(true);
    expect(sameMembership(noCode, ndapewa, noCode, { firstName: 'Tangeni', dateOfBirth: '1990-05-14' })).toBe(true);
    expect(sameMembership(noCode, ndapewa, noCode, { firstName: 'Tangeni', dateOfBirth: '2015-03-02' })).toBe(false);
  });

  it('never matches the same number at another fund', () => {
    expect(sameMembership(psemas, ndapewa, { ...psemas, fundId: 'fund-nmc', fundName: 'Namibia Medical Care' }, ndapewa)).toBe(false);
  });

  it('knows a fund by its code when a saved medical aid has no fund id (MAG1 is PSEMAS)', () => {
    expect(sameMembership({ ...psemas, fundId: null, fundName: 'MAG1' }, ndapewa, { ...psemas, fundId: null }, ndapewa)).toBe(true);
  });
});

describe('findDuplicatePatients: membership and old file number', () => {
  const onFund = existing({
    id: 'p-fund',
    first_name: 'Ndapewa',
    last_name: 'Nghifikwa',
    id_number: '90051499999',
    date_of_birth: '1990-05-15',
    cell_number: null,
    medical_aid_details: [{ medical_aid_provider_id: 'fund-nmc', provider: 'Namibia Medical Care', membership_number: '012345678', dependant_code: null }]
  });

  it('finds a file with the same membership (a surname changed by marriage, a birthday mistyped)', () => {
    const matches = findDuplicatePatients(
      newPatient({ membership: { fundId: 'fund-nmc', fundName: 'Namibia Medical Care', number: '12345678', dependantCode: '' } }),
      [onFund]
    );
    expect(matches).toEqual([{ patient: onFund, reasons: ['membership'] }]);
  });

  it('finds a file with the same old file number however it was written', () => {
    const paperFile = existing({ id: 'p-paper', first_name: 'Maria', last_name: 'Nghifikwa', id_number: '70010100111', date_of_birth: '1970-01-01', legacy_account_number: '0004321' });
    expect(findDuplicatePatients(newPatient({ oldFileNumber: '4321' }), [paperFile])).toEqual([{ patient: paperFile, reasons: ['old_file_number'] }]);
  });

  it('compares neither when reception typed none', () => {
    const paperFile = existing({ id: 'p-paper', first_name: 'Maria', id_number: '70010100111', date_of_birth: '1970-01-01', legacy_account_number: '0004321' });
    expect(findDuplicatePatients(newPatient({ oldFileNumber: '', membership: null }), [paperFile, onFund])).toEqual([]);
  });
});
