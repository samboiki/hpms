/**
 * The files of one Eminance import, from upload to the plan's input: what each file is (patient list, age analysis,
 * recall list or claim file), which of its columns hold what, and the rows read from it.
 *
 * Each file keeps the number it got when it was added: the plan names people by it ('p:<file>:<line>'), so
 * removing one file never renames the people of another.
 */
import { readBalances, type BalancePortion, type BalanceRow } from './eminanceBalances';
import { parseClaimFile, type ClaimHistoryLine } from './eminanceClaims';
import { detectFileKind, missingColumns, recogniseColumns, type ColumnMapping, type ImportFileKind } from './eminanceFields';
import { readPeople, type PersonRow, type ValueChoices } from './eminancePeople';
import { readRecalls, type RecallRow } from './eminanceRecalls';
import { toImportTable, type ImportTable, type Sheet } from './tableFile';

/** What a file is used as; 'ignore' leaves it out */
export type FileUse = ImportFileKind | 'claims' | 'ignore';

export interface ImportFile {
  index: number;
  name: string;
  /** A spreadsheet or CSV table, a claim file, or a file that could not be read */
  source: 'table' | 'claims' | 'unreadable';
  use: FileUse;
  /** Why the file cannot be used; null when it can */
  problem: string | null;
  table: ImportTable | null;
  mapping: ColumnMapping;
  /** For an age analysis: which portion of each account it holds */
  portion: BalancePortion;
  claimLines: ClaimHistoryLine[];
  /** Claim lines that could not be read */
  ignoredLines: number;
}

const base = (index: number, name: string, source: ImportFile['source']): ImportFile => ({
  index, name, source, use: 'ignore', problem: null, table: null, mapping: {}, portion: 'both', claimLines: [], ignoredLines: 0
});

/** A spreadsheet or CSV file: its kind and columns are recognised from the heading row when they can be */
export function tableImportFile(index: number, name: string, sheet: Sheet, headerRow: number): ImportFile {
  if (headerRow < 0) {
    return { ...base(index, name, 'unreadable'), problem: 'No heading row was found (a row with headings such as Account, Surname or Current).' };
  }
  const table = toImportTable(sheet, headerRow);
  const detected = detectFileKind(table.headers);
  return { ...base(index, name, 'table'), table, use: detected?.kind ?? 'ignore', mapping: detected?.mapping ?? {} };
}

export function claimImportFile(index: number, name: string, text: string): ImportFile {
  const { lines, ignored } = parseClaimFile(text, name);
  return { ...base(index, name, 'claims'), use: 'claims', claimLines: lines, ignoredLines: ignored };
}

export function unreadableImportFile(index: number, name: string, reason: string): ImportFile {
  return { ...base(index, name, 'unreadable'), problem: reason };
}

/** What a file can be used as */
export function usesOf(file: ImportFile): FileUse[] {
  if (file.source === 'table') return ['patients', 'balances', 'recalls', 'ignore'];
  if (file.source === 'claims') return ['claims', 'ignore'];
  return [];
}

/** The file used as another kind: a table's columns are recognised again for that kind */
export function withUse(file: ImportFile, use: FileUse): ImportFile {
  if (!usesOf(file).includes(use)) return file;
  if (use === 'ignore' || use === 'claims' || !file.table) return { ...file, use };
  return { ...file, use, mapping: recogniseColumns(file.table.headers, use) };
}

/** What the file still needs before it can be used, in plain words (empty when it is ready or left out) */
export function fileNeeds(file: ImportFile): string[] {
  if (file.problem || file.use === 'ignore' || file.use === 'claims') return [];
  return missingColumns(file.use, file.mapping);
}

export const isUsable = (file: ImportFile): boolean => !file.problem && file.use !== 'ignore' && fileNeeds(file).length === 0;

export interface ReadRows {
  people: PersonRow[];
  balances: Array<{ fileName: string; rows: BalanceRow[]; portion: BalancePortion }>;
  recalls: RecallRow[];
  claims: ClaimHistoryLine[];
}

/** The rows of every usable file, read with what staff chose for values written as codes */
export function readImportFiles(files: readonly ImportFile[], today: string, choices: ValueChoices): ReadRows {
  const result: ReadRows = { people: [], balances: [], recalls: [], claims: [] };
  for (const file of files) {
    if (!isUsable(file)) continue;
    if (file.use === 'claims') {
      result.claims.push(...file.claimLines);
      continue;
    }
    const table = file.table as ImportTable;
    const options = { fileName: file.name, fileIndex: file.index, today };
    if (file.use === 'patients') result.people.push(...readPeople(table, file.mapping, { ...options, choices }));
    else if (file.use === 'balances') result.balances.push({ fileName: file.name, rows: readBalances(table, file.mapping, options), portion: file.portion });
    else if (file.use === 'recalls') result.recalls.push(...readRecalls(table, file.mapping, options));
  }
  return result;
}
