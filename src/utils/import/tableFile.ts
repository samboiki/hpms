/**
 * Reading an exported file into rows of cells, for the Eminance import (Settings > Move over from Eminance).
 *
 * Eminance exports its reports (patient list, age analysis, recall view) to CSV or Excel. Its CSV files come from a
 * South African build: the separator may be a comma or a semicolon (a comma is then the decimal sign), and a report
 * often has title lines above the real heading row. Excel files are turned into cells by the service (SheetJS); this
 * module does the rest, so it can be tested without a browser.
 */
import { cellText, type Cell, type Sheet } from '../billing/tariffImport';

export type { Cell, Sheet };

/** One data row of a file, with its line number as a spreadsheet shows it (1 = the first row of the file) */
export interface TableRow {
  line: number;
  cells: readonly Cell[];
}

export interface ImportTable {
  /** The heading of each column, as written in the file */
  headers: string[];
  /** 0-based index of the heading row in the file */
  headerRow: number;
  /** The rows below the heading that have at least one value */
  rows: TableRow[];
}

/** How many rows from the top are searched for the heading row (report titles come first) */
export const HEADER_SEARCH_ROWS = 20;

/** The separator of a CSV text: Excel's "sep=;" line, else the most common of comma, semicolon and tab outside quotes. */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).filter(line => line.trim() !== '').slice(0, 5);
  const declared = /^sep=(.)\s*$/i.exec(firstLines[0] ?? '');
  if (declared && [',', ';', '\t'].includes(declared[1])) return declared[1] as ',' | ';' | '\t';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const line of firstLines) {
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char in counts) counts[char as keyof typeof counts] += 1;
    }
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  return ',';
}

/**
 * A CSV text as rows of text cells. Double quotes protect separators, line breaks and quotes ("" is a quote).
 * A byte-order mark and Excel's "sep=" line are dropped; values are kept as written (no trimming, no number
 * conversion), so an account number such as 0001234 keeps its zeros.
 */
export function parseDelimitedText(text: string, delimiter: string = detectDelimiter(text)): string[][] {
  let body = text.replace(/^\uFEFF/, '');
  if (/^sep=.\s*(\r\n|\r|\n)/i.test(body)) body = body.replace(/^sep=.\s*(\r\n|\r|\n)/i, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (quoted) {
      if (char === '"' && body[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.trim() === '') {
      quoted = true;
      field = '';
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && body[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * The heading row: within the first rows, the one where `score` (how many headings are recognised) is highest,
 * at least 2. -1 when no row looks like a heading.
 */
export function findHeaderRow(sheet: Sheet, score: (headers: string[]) => number): number {
  let best = -1;
  let bestScore = 1;
  const limit = Math.min(sheet.length, HEADER_SEARCH_ROWS);
  for (let index = 0; index < limit; index += 1) {
    const value = score((sheet[index] ?? []).map(cellText));
    if (value > bestScore) {
      best = index;
      bestScore = value;
    }
  }
  return best;
}

/** The rows below the heading row; empty rows and repeated heading rows (reports repeat them per page) are left out. */
export function toImportTable(sheet: Sheet, headerRow: number): ImportTable {
  const headerCells = (sheet[headerRow] ?? []).map(cellText);
  const headerKey = headerCells.join('|').toLowerCase();
  const rows: TableRow[] = [];
  for (let index = headerRow + 1; index < sheet.length; index += 1) {
    const cells = sheet[index] ?? [];
    if (!cells.some(cell => cellText(cell) !== '')) continue;
    if (cells.map(cellText).join('|').toLowerCase() === headerKey) continue;
    rows.push({ line: index + 1, cells });
  }
  return { headers: headerCells, headerRow, rows };
}
