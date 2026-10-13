import { describe, expect, it } from 'vitest';
import { detectDelimiter, findHeaderRow, parseDelimitedText, toImportTable } from '../tableFile';
import { headerScore } from '../eminanceFields';

// Invented rows shaped like an Eminance report exported to CSV
const PATIENT_LIST = [
  'Patient List - DR TEST PRACTICE',
  'Printed 07/10/2026',
  '',
  'ACCOUNT_KEY,PATIENT_KEY,SURNAME,FIRSTNAME,BIRTHDAY',
  '0000101,0,Kandemo,"Ndeshi, Maria",1980/01/15',
  '0000101,1,Kandemo,Petrus,2015/05/05',
  'ACCOUNT_KEY,PATIENT_KEY,SURNAME,FIRSTNAME,BIRTHDAY',
  ''
].join('\r\n');

describe('detectDelimiter', () => {
  it('reads semicolon files, because a South African Windows build writes them when the comma is the decimal sign', () => {
    expect(detectDelimiter('Account;Current;30\n0000101;100,50;0')).toBe(';');
    expect(detectDelimiter('Account,Current,30\n0000101,100.50,0')).toBe(',');
    expect(detectDelimiter('Account\tCurrent\n0000101\t100.50')).toBe('\t');
  });

  it("obeys Excel's sep= line, so a file saved with an explicit separator is never guessed wrong", () => {
    expect(detectDelimiter('sep=;\nAccount,Name;Total\n1;A,B;2')).toBe(';');
  });

  it('ignores separators inside quotes, so a name like "Kandemo, Ndeshi" does not change the guess', () => {
    expect(detectDelimiter('"Kandemo, Ndeshi";"Kandemo, Petrus";"x"\n"a";"b";"c"')).toBe(';');
  });
});

describe('parseDelimitedText', () => {
  it('keeps quoted commas, quotes and line breaks inside one field, so an address or alert is not split over columns', () => {
    expect(parseDelimitedText('a,"b, c","say ""hi""","line\nbreak"\n1,2,3,4')).toEqual([
      ['a', 'b, c', 'say "hi"', 'line\nbreak'],
      ['1', '2', '3', '4']
    ]);
  });

  it('keeps leading zeros, because the Eminance account number 0000101 must stay searchable as staff know it', () => {
    expect(parseDelimitedText('0000101,007')).toEqual([['0000101', '007']]);
  });

  it("drops a byte-order mark and Excel's sep= line, which would otherwise end up in the first heading", () => {
    expect(parseDelimitedText('\uFEFFsep=;\r\nACCOUNT;TOTAL\r\n1;2', ';')).toEqual([['ACCOUNT', 'TOTAL'], ['1', '2']]);
  });
});

describe('findHeaderRow and toImportTable', () => {
  const sheet = parseDelimitedText(PATIENT_LIST);

  it("skips the report's title lines and finds the real heading row", () => {
    expect(findHeaderRow(sheet, headerScore)).toBe(3);
  });

  it('numbers rows as the spreadsheet shows them and drops blank and repeated heading rows (reports repeat headings per page)', () => {
    const table = toImportTable(sheet, 3);
    expect(table.headers).toEqual(['ACCOUNT_KEY', 'PATIENT_KEY', 'SURNAME', 'FIRSTNAME', 'BIRTHDAY']);
    expect(table.rows.map(row => row.line)).toEqual([5, 6]);
    expect(table.rows[0].cells[3]).toBe('Ndeshi, Maria');
  });

  it('says there is no heading when no row has two known headings, so the wizard asks instead of guessing', () => {
    expect(findHeaderRow([['hello', 'world'], ['1', '2']], headerScore)).toBe(-1);
  });
});
