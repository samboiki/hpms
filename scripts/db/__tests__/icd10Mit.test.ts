import { describe, expect, it } from 'vitest';
import { inBatches, isMitHeader, mapMitRows, mitDate, mitSourceName } from '../icd10Mit';

// The headings of the 2021 file's first 24 columns, as written (WHO_Start_date in lower case "date")
const HEADER = [
  'Number', 'Chapter_No', 'Chapter_Desc', 'Group_Code', 'Group_Desc', 'ICD10_3_Code', 'ICD10_3_Code_Desc', 'ICD10_Code',
  'WHO_Full_Desc', 'Valid_ICD10_ClinicalUse', 'Valid_ICD10_Primary', 'Valid_ICD10_Asterisk', 'Valid_ICD10_Dagger',
  'Valid_ICD10_Sequelae', 'Age_Range', 'Gender', 'Status', 'WHO_Start_date', 'WHO_End_date', 'WHO_Revision_History',
  'SA_Start_Date', 'SA_End_Date', 'SA_Revision_History', 'Comment'
];

/** A row like the file's: code, description, the five flags, then age range, sex, status and the SA end date. */
const row = (
  code: string,
  description: string,
  flags: [string, string, string, string, string],
  extra: { age?: string | null; gender?: string | null; status?: string | null; saEnd?: number | string | null } = {}
): unknown[] => [
  1, 'CHAPTER I', 'Certain infectious and parasitic diseases (A00-B99)', '001 (A00-A09)', 'Intestinal infectious diseases',
  code.slice(0, 3), 'Cholera', code, description, ...flags, extra.age ?? null, extra.gender ?? null, extra.status ?? null,
  null, null, null, null, extra.saEnd ?? null, null, null
];

const options = { source: 'SA MIT 2021', date1904: true };

// Business rule (parity E14): claim review trusts this table to say which codes the funds accept, so the load script
// must refuse a file it does not fully understand rather than load a half-right list.
describe('reading the medical aids\' ICD-10 list (MIT)', () => {
  it('finds the MIT sheet by its headings, whatever the edition calls the sheet', () => {
    expect(isMitHeader(HEADER)).toBe(true);
    expect(isMitHeader(HEADER.filter(name => name !== 'Valid_ICD10_Primary'))).toBe(false);
    expect(mitSourceName('SA ICD-10 MIT 2021')).toBe('SA MIT 2021');
    expect(mitSourceName('Sheet1', 'ICD-10_MIT_2023_Excel.xlsx')).toBe('SA MIT 2023');
    expect(mitSourceName('Sheet1')).toBeNull();
  });

  // The 2021 workbook counts days from 1904: read as 1900 dates every end date would be four years early (C14.1 ended
  // on 31 Aug 2007, as its comment says, not on 30 Aug 2003)
  it('reads dates from the workbook\'s own calendar, or written as YYYYMMDD', () => {
    expect(mitDate(37863, true)).toBe('2007-08-31');
    expect(mitDate(39325, false)).toBe('2007-08-31');
    expect(mitDate('20051101', true)).toBe('2005-11-01');
    expect(mitDate('', true)).toBeNull();
    expect(mitDate('20051301', true)).toBeUndefined();
    expect(mitDate('next year', true)).toBeUndefined();
  });

  it('maps a row to the table, the flags as true or false', () => {
    const result = mapMitRows(HEADER, [row('A00.0', 'Cholera due to Vibrio cholerae 01, biovar cholerae', ['Y', 'Y', 'N', 'N', 'N'])], options);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        code: 'A00.0',
        three_char_code: 'A00',
        description: 'Cholera due to Vibrio cholerae 01, biovar cholerae',
        chapter_no: 'CHAPTER I',
        chapter_description: 'Certain infectious and parasitic diseases (A00-B99)',
        group_code: '001 (A00-A09)',
        group_description: 'Intestinal infectious diseases',
        valid_clinical_use: true,
        valid_primary: true,
        is_asterisk: false,
        is_dagger: false,
        is_sequelae: false,
        age_range: null,
        gender: null,
        status: null,
        who_start_date: null,
        who_end_date: null,
        sa_start_date: null,
        sa_end_date: null,
        source: 'SA MIT 2021'
      }
    ]);
  });

  // The 2021 file has one "n" and one "N " among 205,040 flags: they mean N, and the count is reported
  it('reads a flag written in lower case or with a space, and counts it', () => {
    const result = mapMitRows(HEADER, [row('Y20.6', 'Hanging, while working for income', ['n', 'N ', 'N', 'N', 'N'])], options);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ valid_clinical_use: false, valid_primary: false });
    expect(result.tidiedFlags).toBe(2);
  });

  it('keeps the sex, the age range, the status and the end date of a code', () => {
    const result = mapMitRows(
      HEADER,
      [row('N92.2', 'Excessive menstruation at puberty', ['Y', 'Y', 'N', 'N', 'N'], { age: '≤19 years', gender: 'F', status: 'd', saEnd: 39963 })],
      options
    );
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ age_range: '≤19 years', gender: 'F', status: 'D', sa_end_date: '2013-05-31' });
  });

  it('refuses a flag other than Y or N, a repeated code, an unknown sex, status or age range, naming the row', () => {
    const result = mapMitRows(
      HEADER,
      [
        row('A00.0', 'Cholera', ['Y', 'Y', 'N', 'N', 'N']),
        row('A00.0', 'Cholera again', ['Y', 'Y', 'N', 'N', 'N']),
        row('A00.1', 'Cholera', ['Y', 'maybe', 'N', 'N', 'N'], { gender: 'X', status: 'Q', age: 'adults' }),
        row('a00', 'Cholera', ['N', 'N', 'N', 'N', 'N'])
      ],
      options
    );
    expect(result.errors).toEqual([
      'Row 3 (A00.0): the code is also on row 2.',
      'Row 4 (A00.1): Age_Range "adults" is not understood (claim review could not check it).',
      'Row 4 (A00.1): Valid_ICD10_Primary is "maybe"; only Y or N is allowed.',
      'Row 4 (A00.1): Gender is "X"; expected M, F, U or blank.',
      'Row 4 (A00.1): Status is "Q"; expected A, D, M or blank.',
      'Row 5 (a00): "a00" is not a code the table accepts.'
    ]);
  });

  it('skips blank rows and refuses a sheet without a needed column', () => {
    expect(mapMitRows(HEADER, [[null, null, ''], row('A00', 'Cholera', ['N', 'N', 'N', 'N', 'N'])], options)).toMatchObject({ blankRows: 1, errors: [] });
    expect(mapMitRows(HEADER.slice(0, 10), [], options).errors).toEqual([
      'The sheet has no column Valid_ICD10_Primary, Valid_ICD10_Asterisk, Valid_ICD10_Dagger, Valid_ICD10_Sequelae, Age_Range, Gender, Status, WHO_Start_Date, WHO_End_Date, SA_Start_Date, SA_End_Date.'
    ]);
  });

  it('upserts in batches of the size asked', () => {
    expect(inBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(inBatches([], 1000)).toEqual([]);
  });
});
