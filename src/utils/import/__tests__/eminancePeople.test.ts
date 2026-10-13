import { describe, expect, it } from 'vitest';
import { recogniseColumns } from '../eminanceFields';
import { groupFamilies, NO_CHOICES, readPeople, unreadValues, type PersonRow } from '../eminancePeople';
import { parseDelimitedText, toImportTable } from '../tableFile';

const TODAY = '2026-10-07';

// Invented people in the shape of an Eminance Report Generator export (PATIENT joined to ACCOUNT)
const CSV = [
  'ACCOUNT_KEY,PATIENT_KEY,TITLE,INITIALS,SURNAME,FIRSTNAME,SEX,BIRTHDAY,IDNUMBER,CELL,PHONE1,EMAIL,MEDICALAID_KEY,MEMBERSHIPNO,USERDEPENDANTNUMBER,RELATIONSHIP,PATIENTALERTMSG',
  '0000101,0,Mrs,NM,Kandemo,Ndeshi Maria,F,1980/01/15,80011500123,0811234567,,ndeshi@example.com,NMC01,900000001,00,Main member,Allergic to penicillin',
  '0000101,1,,P,Kandemo,Petrus,M,2015/05/05,,,,,,900000001,01,Child,',
  '0000102,0,Mnr,J,Testa,Johannes,,,85020200456,,081 765 4321,not-an-email,PRIVATE,,,Main member,',
  '0000103,0,,,Sampula,Anna,X,1990/02/02,,,,,PSEMAS,12345678901,00,Main member,',
  ',0,,,Nobody,Nameless,F,1970/01/01,,,,,,,,,'
].join('\n');

const read = (choices = NO_CHOICES): PersonRow[] => {
  const table = toImportTable(parseDelimitedText(CSV), 0);
  return readPeople(table, recogniseColumns(table.headers, 'patients'), { fileName: 'patients.csv', fileIndex: 0, today: TODAY, choices });
};

describe('readPeople', () => {
  it('keeps the Eminance account and dependant numbers, which staff and patients still quote after the move', () => {
    const [main, child] = read();
    expect(main).toMatchObject({ key: 'p:0:2', accountNumber: '0000101', dependantNumber: '0', dependantCode: '00', firstName: 'Ndeshi Maria', surname: 'Kandemo' });
    expect(child).toMatchObject({ accountNumber: '0000101', dependantNumber: '1', dependantCode: '01', relationship: 'child' });
  });

  it('reads the date of birth from a Namibian ID number when the birthday is empty, so the file can still be made', () => {
    const johannes = read()[2];
    expect(johannes.dateOfBirth).toBe('1985-02-02');
    expect(johannes.problems.map(problem => problem.message)).toContain('The date of birth was read from the ID number');
  });

  it('takes the sex from the title when the sex column is empty (Mnr is male)', () => {
    expect(read()[2].sex).toBe('male');
  });

  it('uses a phone column only when it is a mobile, and drops an email that is not one, with a note for each', () => {
    const johannes = read()[2];
    expect(johannes.cellNumber).toBe('081 765 4321');
    expect(johannes.email).toBeNull();
    expect(johannes.problems.map(problem => problem.message)).toEqual(
      expect.arrayContaining(['The cell number was taken from the phone column', '"not-an-email" is not an email address: it was left out'])
    );
  });

  it('warns about a missing ID number without blocking: children rarely have one and the file gets a placeholder', () => {
    const child = read()[1];
    expect(child.idNumber).toBeNull();
    expect(child.problems).toEqual([{ message: 'No ID number: the file gets a placeholder (NOID-...) until you add the number', blocking: false }]);
  });

  it('blocks a row whose sex code is unknown until staff say what it means, then uses their choice', () => {
    const anna = read()[3];
    expect(anna.sex).toBeNull();
    expect(anna.needsSexChoice).toBe(true);
    expect(anna.problems.some(problem => problem.blocking)).toBe(true);
    const chosen = read({ sex: { x: 'female' }, relationship: {} })[3];
    expect(chosen.sex).toBe('female');
    expect(chosen.problems.some(problem => problem.blocking)).toBe(false);
  });

  it('blocks a row without an account number, because family accounts and balances hang on it', () => {
    expect(read()[4].problems).toContainEqual({ message: 'No account number', blocking: true });
  });

  it('keeps the alert, which Eminance shows when the file opens and staff rely on', () => {
    expect(read()[0].alert).toBe('Allergic to penicillin');
  });
});

describe('unreadValues', () => {
  it('lists each unreadable sex value once with how many people have it, so staff answer once per value', () => {
    expect(unreadValues(read(), 'sexRaw')).toEqual([{ key: 'x', raw: 'X', count: 1 }]);
  });
});

describe('groupFamilies', () => {
  it('makes the main member the account holder of everyone on the Eminance account', () => {
    const families = groupFamilies(read());
    const kandemo = families.find(family => family.accountNumber === '0000101');
    expect(kandemo?.holder?.firstName).toBe('Ndeshi Maria');
    expect(kandemo?.members).toHaveLength(2);
    expect(kandemo?.problem).toBeNull();
  });

  it('falls back to dependant number 0, then card code 00, then the only person, as Eminance numbers families', () => {
    const base = read()[1];
    const byNumber = groupFamilies([{ ...base, key: 'a', relationship: null, dependantNumber: '0' }, { ...base, key: 'b', relationship: null, dependantNumber: '1' }]);
    expect(byNumber[0].holder?.key).toBe('a');
    const byCode = groupFamilies([{ ...base, key: 'a', relationship: null, dependantNumber: null, dependantCode: '01' }, { ...base, key: 'b', relationship: null, dependantNumber: null, dependantCode: '00' }]);
    expect(byCode[0].holder?.key).toBe('b');
    expect(groupFamilies([{ ...base, relationship: null, dependantNumber: null, dependantCode: null }])[0].holder).not.toBeNull();
  });

  it('says so when an account has nobody marked as main member, rather than guessing who pays', () => {
    const base = read()[1];
    const family = groupFamilies([{ ...base, key: 'a', relationship: 'child', dependantNumber: '2' }, { ...base, key: 'b', relationship: 'child', dependantNumber: '3' }])[0];
    expect(family.holder).toBeNull();
    expect(family.problem).toMatch(/No main member/);
  });
});
