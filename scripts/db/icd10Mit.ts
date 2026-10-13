/**
 * Pure helpers for load-icd10-mit.ts: maps the South African ICD-10 Master Industry Table (MIT: the Excel file the
 * medical aids publish, sheet "SA ICD-10 MIT <year>", columns explained on its "MIT File Lay-out" sheet) to rows of
 * public.icd10_codes, and refuses a file it does not fully understand. Unit tested in scripts/db/__tests__/icd10Mit.test.ts.
 */
import { parseIcd10AgeRange } from '../../src/utils/billing/icd10Master.ts';

/** A row of public.icd10_codes (proposals/2026-10-12-icd10-master.sql) as the load script writes it. */
export interface Icd10CodeRow {
  code: string;
  three_char_code: string;
  description: string;
  chapter_no: string;
  chapter_description: string;
  group_code: string;
  group_description: string;
  valid_clinical_use: boolean;
  valid_primary: boolean;
  is_asterisk: boolean;
  is_dagger: boolean;
  is_sequelae: boolean;
  age_range: string | null;
  gender: 'M' | 'F' | 'U' | null;
  status: 'A' | 'D' | 'M' | null;
  who_start_date: string | null;
  who_end_date: string | null;
  sa_start_date: string | null;
  sa_end_date: string | null;
  source: string;
}

/** The MIT's column headings (matched without regard to case: the 2021 file writes WHO_Start_date). */
const COLUMNS = {
  code: 'ICD10_Code',
  threeChar: 'ICD10_3_Code',
  description: 'WHO_Full_Desc',
  chapterNo: 'Chapter_No',
  chapterDescription: 'Chapter_Desc',
  groupCode: 'Group_Code',
  groupDescription: 'Group_Desc',
  clinicalUse: 'Valid_ICD10_ClinicalUse',
  primary: 'Valid_ICD10_Primary',
  asterisk: 'Valid_ICD10_Asterisk',
  dagger: 'Valid_ICD10_Dagger',
  sequelae: 'Valid_ICD10_Sequelae',
  ageRange: 'Age_Range',
  gender: 'Gender',
  status: 'Status',
  whoStart: 'WHO_Start_Date',
  whoEnd: 'WHO_End_Date',
  saStart: 'SA_Start_Date',
  saEnd: 'SA_End_Date'
} as const;

type Column = keyof typeof COLUMNS;

/** The shape public.icd10_codes accepts (its CHECK): A00, A00.0, S52.50, M45.X0, M8000/0. */
const CODE_PATTERN = /^[A-Z][0-9A-Z./]{2,7}$/;

const heading = (value: unknown): string => String(value ?? '').trim().toLowerCase();

/** True when a sheet's first row holds the MIT's headings (the sheet's name changes with each edition). */
export function isMitHeader(header: readonly unknown[]): boolean {
  const names = new Set(header.map(heading));
  return Object.values(COLUMNS).every(name => names.has(name.toLowerCase()));
}

/** "SA ICD-10 MIT 2021" (or the file name) -> "SA MIT 2021"; null without a year. */
export function mitSourceName(...names: readonly string[]): string | null {
  for (const name of names) {
    const year = /MIT[\s_-]*(\d{4})/i.exec(name)?.[1];
    if (year) return `SA MIT ${year}`;
  }
  return null;
}

const EPOCH_1900 = Date.UTC(1899, 11, 30);
const EPOCH_1904 = Date.UTC(1904, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * A date cell as yyyy-MM-dd: an Excel day number (the 2021 file counts from 1904, `date1904`) or YYYYMMDD, the format
 * the lay-out sheet describes. Null when blank; undefined when not understood.
 */
export function mitDate(value: unknown, date1904: boolean): string | null | undefined {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (/^\d{8}$/.test(text)) {
    const [year, month, day] = [Number(text.slice(0, 4)), Number(text.slice(4, 6)), Number(text.slice(6, 8))];
    const ms = Date.UTC(year, month - 1, day);
    return isoDay(ms) === `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}` ? isoDay(ms) : undefined;
  }
  if (/^\d{1,6}$/.test(text)) return isoDay((date1904 ? EPOCH_1904 : EPOCH_1900) + Number(text) * DAY_MS);
  return undefined;
}

export interface MitResult {
  rows: Icd10CodeRow[];
  /** Why rows were refused, with the sheet's row number; nothing is loaded while there is one */
  errors: string[];
  /** Flags written in lower case or with spaces ("n", "N "), read as Y or N */
  tidiedFlags: number;
  blankRows: number;
}

/** Maps and checks every row of the MIT sheet (header first). */
export function mapMitRows(
  header: readonly unknown[],
  rows: readonly (readonly unknown[])[],
  options: { source: string; date1904: boolean }
): MitResult {
  const index = new Map(header.map((name, position) => [heading(name), position]));
  const missing = Object.values(COLUMNS).filter(name => !index.has(name.toLowerCase()));
  if (missing.length > 0) return { rows: [], errors: [`The sheet has no column ${missing.join(', ')}.`], tidiedFlags: 0, blankRows: 0 };

  const result: MitResult = { rows: [], errors: [], tidiedFlags: 0, blankRows: 0 };
  const seen = new Map<string, number>();

  rows.forEach((cells, position) => {
    if (cells.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
      result.blankRows += 1;
      return;
    }
    const rowNumber = position + 2;
    const raw = (column: Column): unknown => cells[index.get(COLUMNS[column].toLowerCase()) as number];
    const text = (column: Column): string => String(raw(column) ?? '').trim();
    const code = text('code');
    const refuse = (message: string) => result.errors.push(`Row ${rowNumber}${code ? ` (${code})` : ''}: ${message}`);

    if (!CODE_PATTERN.test(code)) refuse(`"${code}" is not a code the table accepts.`);
    const first = seen.get(code);
    if (first !== undefined) refuse(`the code is also on row ${first}.`);
    else seen.set(code, rowNumber);

    const required = (column: Column): string => {
      const value = text(column);
      if (!value) refuse(`${COLUMNS[column]} is empty.`);
      return value;
    };
    const flag = (column: Column): boolean => {
      const value = text(column).toUpperCase();
      if (value !== 'Y' && value !== 'N') {
        refuse(`${COLUMNS[column]} is "${text(column)}"; only Y or N is allowed.`);
        return false;
      }
      if (String(raw(column)) !== value) result.tidiedFlags += 1;
      return value === 'Y';
    };
    const oneOf = <T extends string>(column: Column, allowed: readonly T[]): T | null => {
      const value = text(column).toUpperCase();
      if (!value) return null;
      if (!(allowed as readonly string[]).includes(value)) refuse(`${COLUMNS[column]} is "${text(column)}"; expected ${allowed.join(', ')} or blank.`);
      return (allowed as readonly string[]).includes(value) ? (value as T) : null;
    };
    const date = (column: Column): string | null => {
      const value = mitDate(raw(column), options.date1904);
      if (value === undefined) refuse(`${COLUMNS[column]} "${text(column)}" is not a date.`);
      return value ?? null;
    };
    const ageRange = text('ageRange') || null;
    if (ageRange && !parseIcd10AgeRange(ageRange)) refuse(`Age_Range "${ageRange}" is not understood (claim review could not check it).`);

    result.rows.push({
      code,
      three_char_code: required('threeChar'),
      description: required('description'),
      chapter_no: required('chapterNo'),
      chapter_description: required('chapterDescription'),
      group_code: required('groupCode'),
      group_description: required('groupDescription'),
      valid_clinical_use: flag('clinicalUse'),
      valid_primary: flag('primary'),
      is_asterisk: flag('asterisk'),
      is_dagger: flag('dagger'),
      is_sequelae: flag('sequelae'),
      age_range: ageRange,
      gender: oneOf('gender', ['M', 'F', 'U'] as const),
      status: oneOf('status', ['A', 'D', 'M'] as const),
      who_start_date: date('whoStart'),
      who_end_date: date('whoEnd'),
      sa_start_date: date('saStart'),
      sa_end_date: date('saEnd'),
      source: options.source
    });
  });
  return result;
}

/** Rows in batches of `size` for the upsert. */
export function inBatches<T>(rows: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < rows.length; start += size) batches.push(rows.slice(start, start + size));
  return batches;
}
