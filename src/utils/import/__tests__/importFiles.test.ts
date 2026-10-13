import { describe, expect, it } from 'vitest';
import { NO_CHOICES } from '../eminancePeople';
import { claimImportFile, fileNeeds, isUsable, readImportFiles, tableImportFile, unreadableImportFile, withUse } from '../importFiles';

const TODAY = '2026-10-08';

// Invented rows with the headings of Eminance's own exports
const PATIENTS = [
  ['ACCOUNT_KEY', 'PATIENT_KEY', 'SURNAME', 'FIRSTNAME', 'BIRTHDAY', 'SEX', 'IDNUMBER'],
  ['0000101', '0', 'Kandemo', 'Ndeshi', '15/01/1980', 'F', ''],
  ['0000101', '1', 'Kandemo', 'Petrus', '05/05/2015', 'M', '']
];
const AGE_ANALYSIS = [
  ['Account', 'Debtor', 'Current', '30', '60', '90', '120', '150', '180+', 'Unallocated', 'Total'],
  ['0000101', 'KANDEMO N', '100.00', '50.00', '', '', '', '', '', '', '150.00']
];
const RECALLS = [
  ['ACCOUNT_KEY', 'PATIENT_KEY', 'RECALLDATE', 'REASON'],
  ['0000101', '1', '10/11/2026', 'Check-up']
];
const CLAIM_FILE = [
  '1,0540001234567,1,D,37,20250310,EMINANCE,05.06.00,1.6',
  ['D', '1', '4711', '0000101', '', 'NMC1', '', '900000001', '', '', 'NDESHI', '19800115', '8101', '450.00', 'CONSULTATION', '', '20250304', '1']
    .concat(Array.from({ length: 35 }, () => ''))
    .join(','),
  'Z,1,1,450.00'
].join('\r\n');

describe('tableImportFile', () => {
  it('tells a patient list, an age analysis and a recall list apart by their headings, so staff need not say what each file is', () => {
    expect(tableImportFile(0, 'patients.csv', PATIENTS, 0).use).toBe('patients');
    expect(tableImportFile(1, 'age.csv', AGE_ANALYSIS, 0).use).toBe('balances');
    expect(tableImportFile(2, 'recalls.csv', RECALLS, 0).use).toBe('recalls');
  });

  it('leaves out a file whose headings it does not know until staff say what it is, rather than guessing', () => {
    const file = tableImportFile(0, 'other.csv', [['Ref', 'Who', 'When'], ['1', 'x', 'y']], 0);
    expect(file.use).toBe('ignore');
    expect(isUsable(file)).toBe(false);
  });

  it('explains a file without a heading row instead of reading its first row as people', () => {
    expect(tableImportFile(0, 'notes.csv', [['hello']], -1).problem).toMatch(/No heading row/);
  });
});

describe('withUse', () => {
  it('recognises the columns again when staff correct what a file is', () => {
    const file = withUse(tableImportFile(0, 'recalls.csv', RECALLS, 0), 'patients');
    expect(file.use).toBe('patients');
    expect(file.mapping.accountNumber).toBe(0);
    // A recall list has no names or dates of birth: as a patient list it is not ready until those columns are matched
    expect(fileNeeds(file)).toEqual(['the first names and surname (or a name column)', 'the date of birth (or the ID number)']);
    expect(readImportFiles([file], TODAY, NO_CHOICES).people).toEqual([]);
  });

  it('never reads a claim file as a table or a table as a claim file, but either can be left out', () => {
    const claims = claimImportFile(0, 'run.Dat', CLAIM_FILE);
    expect(withUse(claims, 'patients').use).toBe('claims');
    expect(withUse(claims, 'ignore').use).toBe('ignore');
    expect(withUse(tableImportFile(1, 'patients.csv', PATIENTS, 0), 'claims').use).toBe('patients');
    expect(isUsable(unreadableImportFile(2, 'photo.png', 'Not a spreadsheet'))).toBe(false);
  });
});

describe('readImportFiles', () => {
  it('reads every usable file by its kind, and claim lines from claim files', () => {
    const files = [tableImportFile(0, 'patients.csv', PATIENTS, 0), tableImportFile(1, 'age.csv', AGE_ANALYSIS, 0), tableImportFile(2, 'recalls.csv', RECALLS, 0), claimImportFile(3, 'run.Dat', CLAIM_FILE)];
    const rows = readImportFiles(files, TODAY, NO_CHOICES);
    expect(rows.people.map(person => person.firstName)).toEqual(['Ndeshi', 'Petrus']);
    expect(rows.balances[0].rows[0].bands.current).toBe(10000);
    expect(rows.recalls[0].dueDate).toBe('2026-11-10');
    expect(rows.claims).toHaveLength(1);
  });

  it("keeps each file's own number in the keys, so removing an earlier file does not rename people the staged rows refer to", () => {
    const later = tableImportFile(4, 'patients.csv', PATIENTS, 0);
    expect(readImportFiles([later], TODAY, NO_CHOICES).people[0].key).toBe('p:4:2');
  });

  it('puts an age analysis on the portion staff chose for it', () => {
    const file = { ...tableImportFile(0, 'age.csv', AGE_ANALYSIS, 0), portion: 'medical_aid' as const };
    expect(readImportFiles([file], TODAY, NO_CHOICES).balances[0].portion).toBe('medical_aid');
  });
});
