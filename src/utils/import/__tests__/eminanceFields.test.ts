import { describe, expect, it } from 'vitest';
import { detectFileKind, missingColumns, normalizeHeader, recogniseColumns } from '../eminanceFields';

describe('normalizeHeader', () => {
  it('treats database names and screen labels alike, because practices export both ways', () => {
    expect(normalizeHeader('ACCOUNT_KEY')).toBe('accountkey');
    expect(normalizeHeader('Acc No.')).toBe('accno');
    expect(normalizeHeader('180+')).toBe('180plus');
    expect(normalizeHeader('Date of Birth')).toBe('dateofbirth');
  });
});

describe('recogniseColumns', () => {
  it("maps Eminance's own column names from a Report Generator export without any help", () => {
    const headers = ['ACCOUNT_KEY', 'PATIENT_KEY', 'SURNAME', 'FIRSTNAME', 'SEX', 'BIRTHDAY', 'IDNUMBER', 'CELL', 'MEDICALAID_KEY', 'MEMBERSHIPNO', 'USERDEPENDANTNUMBER', 'PATIENTALERTMSG'];
    expect(recogniseColumns(headers, 'patients')).toEqual({
      accountNumber: 0, dependantNumber: 1, surname: 2, firstName: 3, sex: 4, dateOfBirth: 5, idNumber: 6, cell: 7,
      medicalAid: 8, membershipNumber: 9, dependantCode: 10, alert: 11
    });
  });

  it('maps the screen labels of the age analysis report, including the 180+ column', () => {
    const headers = ['Account', 'Debtor', 'Current', '30', '60', '90', '120', '150', '180+', 'Unallocated', 'Total'];
    expect(recogniseColumns(headers, 'balances')).toEqual({
      accountNumber: 0, fullName: 1, current: 2, days30: 3, days60: 4, days90: 5, days120: 6, days150: 7, days180: 8, unallocated: 9, total: 10
    });
  });

  it('reads a lone "Name" column beside "Surname" as the first names, as Eminance lists show them', () => {
    expect(recogniseColumns(['Account', 'Surname', 'Name', 'Birthday'], 'patients')).toMatchObject({ surname: 1, firstName: 2 });
  });

  it('keeps the first of repeated columns (Eminance has PHONE1 and PHONE2), so the main number is used', () => {
    expect(recogniseColumns(['Account', 'Phone', 'Telephone'], 'patients').phone).toBe(1);
  });
});

describe('detectFileKind', () => {
  it('tells an age analysis from a patient list and a recall list by their columns, so staff only check, not choose', () => {
    expect(detectFileKind(['ACCOUNT_KEY', 'CURR', 'DAY30', 'DAY60', 'TOTAL'])?.kind).toBe('balances');
    expect(detectFileKind(['Account', 'Patient', 'Recall date', 'Reason'])?.kind).toBe('recalls');
    expect(detectFileKind(['Account', 'Surname', 'First names', 'Birthday', 'Recall date'])?.kind).toBe('patients');
  });

  it('returns nothing for a file it cannot read, so the wizard asks what the file is instead of importing rubbish', () => {
    expect(detectFileKind(['Code', 'Description', 'Price'])).toBeNull();
  });
});

describe('missingColumns', () => {
  it('names what a patient list still needs in plain words, because a patient cannot be saved without them', () => {
    expect(missingColumns('patients', { accountNumber: 0, surname: 1 })).toEqual([
      'the first names and surname (or a name column)',
      'the date of birth (or the ID number)'
    ]);
    expect(missingColumns('patients', { accountNumber: 0, fullName: 1, idNumber: 2 })).toEqual([]);
  });

  it('accepts an age analysis with any age column, since practices may export only the bands they use', () => {
    expect(missingColumns('balances', { accountNumber: 0, days180: 3 })).toEqual([]);
    expect(missingColumns('balances', { accountNumber: 0 })).toEqual(['at least one age column (Current, 30 days ... 180+)']);
  });
});
