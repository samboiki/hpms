/**
 * Reading a tariff schedule file for the Tariffs page: a NAMAF benchmark schedule of any discipline, or a fund's
 * price list, from xlsx or CSV (the page turns the file into rows of cells; this module does the rest).
 *
 * NAMAF sends each practice the schedule of its own discipline. The reference layout is NAMAF's dental workbook
 * ("2025_Dental Practitioners (All).xlsx"): a row of practice-number prefixes ('054', '062'...), a row of their
 * names, a header row ('Item', 'Description', 'N$'...) and one row per code with one price column per discipline.
 * Other files are read the same way: the header row and the code, description and price columns are detected and
 * shown for staff to confirm or change before anything is saved.
 *
 * Money rules: prices are N$ to the cent (half up); a blank price is "not priced in this column", 0 is NAMAF's
 * "no fixed fee / by arrangement", and neither is imported. A code listed twice with different prices is refused.
 */
import { fromCents, toCents } from './money.ts';
import { isValidDateKey, toDateKey } from './dates.ts';
import { MAX_UNIT_PRICE } from './pricing.ts';
import { MATERIAL_FACTOR_CODE } from './tariffRules.ts';

export type Cell = string | number | boolean | Date | null | undefined;
export type Sheet = readonly (readonly Cell[])[];

export interface PriceColumn {
  index: number;
  /** e.g. "054 General Dental Practitioners" or "Price" */
  label: string;
  /** NAMAF practice-number prefix of the discipline, when the file has one */
  discipline: string | null;
}

export interface ScheduleLayout {
  headerRow: number;
  codeColumn: number;
  descriptionColumn: number | null;
  priceColumns: PriceColumn[];
  priceColumn: number | null;
  /** True when discipline prefixes were found above the header (NAMAF's own layout) */
  namaf: boolean;
}

const MAX_HEADER_SEARCH = 40;
const CODE_HEADER = /^(item|items|code|codes|tariff|tariff code|item code|item no\.?|code no\.?|procedure code)$/i;
const DESCRIPTION_HEADER = /description|procedure|service|item description/i;
const PRICE_HEADER = /n\$|nad|price|amount|fee|tariff|rand|benchmark|\b20\d{2}\b/i;
const DISCIPLINE = /^\d{3}$/;
const CODE_PATTERN = /^[A-Z0-9]{2,10}$/;

export const cellText = (cell: Cell): string => {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return toDateKey(cell) ?? '';
  return String(cell).trim();
};

/** A price cell as N$ (numbers, or text such as "1 234.50" / "N$ 254,70"); null when blank or not a number. */
export function cellNumber(cell: Cell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  const text = cellText(cell).replace(/^N\$\s*/i, '').replace(/\s/g, '');
  if (!text) return null;
  // "254,70" (decimal comma) -> 254.70; "1,234.50" (thousands comma) -> 1234.50
  const normalised = /^\d+,\d{1,2}$/.test(text) ? text.replace(',', '.') : text.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) return null;
  return Number(normalised);
}

/** A code cell as the code staff bill ('8101', '0190'); a code stored as a number loses its leading zero. */
export function cellCode(cell: Cell): string {
  if (typeof cell === 'number' && Number.isInteger(cell) && cell >= 0 && cell < 1000) return String(cell).padStart(4, '0');
  return cellText(cell).toUpperCase();
}

/** Finds the header row and the code, description and price columns. null when no header row is found. */
export function detectLayout(sheet: Sheet): ScheduleLayout | null {
  const rowsToSearch = Math.min(sheet.length, MAX_HEADER_SEARCH);
  for (let headerRow = 0; headerRow < rowsToSearch; headerRow += 1) {
    const header = sheet[headerRow] ?? [];
    const codeColumn = header.findIndex(cell => CODE_HEADER.test(cellText(cell)));
    if (codeColumn < 0) continue;
    const descriptionIndex = header.findIndex((cell, index) => index !== codeColumn && DESCRIPTION_HEADER.test(cellText(cell)));
    const descriptionColumn = descriptionIndex >= 0 ? descriptionIndex : null;
    const dataRows = sheet.slice(headerRow + 1).filter(row => CODE_PATTERN.test(cellCode(row?.[codeColumn])));
    const width = Math.max(header.length, ...dataRows.slice(0, 50).map(row => row.length));
    // Discipline prefixes ('054') and names in the rows above the header, as in NAMAF's workbooks
    const prefixRow = sheet.slice(0, headerRow).findIndex(row => row.filter(cell => DISCIPLINE.test(cellText(cell))).length >= 1);
    const priceColumns: PriceColumn[] = [];
    for (let index = 0; index < width; index += 1) {
      if (index === codeColumn || index === descriptionColumn) continue;
      const title = cellText(header[index]);
      const numeric = dataRows.slice(0, 200).filter(row => cellNumber(row?.[index]) !== null).length;
      if (!PRICE_HEADER.test(title) && numeric === 0) continue;
      const discipline = prefixRow >= 0 && DISCIPLINE.test(cellText(sheet[prefixRow]?.[index])) ? cellText(sheet[prefixRow][index]) : null;
      const name = discipline && headerRow - 1 > prefixRow ? cellText(sheet[headerRow - 1]?.[index]) : '';
      const label = discipline ? `${discipline}${name ? ` ${name}` : ''}` : title || `Column ${index + 1}`;
      priceColumns.push({ index, label, discipline });
    }
    return {
      headerRow,
      codeColumn,
      descriptionColumn,
      priceColumns,
      priceColumn: priceColumns[0]?.index ?? null,
      namaf: priceColumns.some(column => column.discipline !== null)
    };
  }
  return null;
}

export interface ScheduleRow {
  /** 1-based row number in the file, for messages */
  line: number;
  code: string;
  description: string;
  /** N$ to the cent; null when not imported (see problem) */
  price: number | null;
  /** Why the row is not imported; null for a usable price */
  problem: string | null;
}

export interface ScheduleMapping {
  headerRow: number;
  codeColumn: number;
  descriptionColumn: number | null;
  priceColumn: number;
}

/**
 * The code rows under a mapping. Rows without a code (titles, notes, section headings) are left out; every code row
 * comes back, with `problem` set when its price is not imported.
 */
export function readScheduleRows(sheet: Sheet, mapping: ScheduleMapping): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  sheet.slice(mapping.headerRow + 1).forEach((row, offset) => {
    const code = cellCode(row?.[mapping.codeColumn]);
    if (!CODE_PATTERN.test(code)) return;
    const description = mapping.descriptionColumn === null ? '' : cellText(row?.[mapping.descriptionColumn]).replace(/\s+/g, ' ');
    const raw = cellNumber(row?.[mapping.priceColumn]);
    let price: number | null = null;
    let problem: string | null = null;
    if (raw === null) {
      problem = cellText(row?.[mapping.priceColumn]) ? 'the price is not a number' : 'no price in this column';
    } else if (raw < 0) {
      problem = 'the price is negative';
    } else if (raw > MAX_UNIT_PRICE) {
      problem = 'the price is too large';
    } else if (raw === 0) {
      problem = 'no fixed fee (0: by arrangement)';
    } else {
      // To the cent, half up (NAMAF prices have at most 2 decimals)
      price = fromCents(toCents(raw));
    }
    rows.push({ line: mapping.headerRow + offset + 2, code, description, price, problem });
  });
  return mergeDuplicates(rows);
}

/** A code listed twice: one usable price wins over an empty one; two different prices are refused. */
function mergeDuplicates(rows: ScheduleRow[]): ScheduleRow[] {
  const byCode = new Map<string, ScheduleRow[]>();
  rows.forEach(row => byCode.set(row.code, [...(byCode.get(row.code) ?? []), row]));
  const merged: ScheduleRow[] = [];
  byCode.forEach(group => {
    const priced = group.filter(row => row.price !== null);
    if (priced.length === 0) {
      merged.push(group[0]);
      return;
    }
    const cents = new Set(priced.map(row => toCents(row.price as number)));
    if (cents.size > 1) {
      merged.push({
        ...priced[0],
        price: null,
        problem: `listed ${priced.length} times with different prices (rows ${priced.map(row => row.line).join(', ')})`
      });
      return;
    }
    merged.push(priced[0]);
  });
  return merged.sort((a, b) => a.line - b.line);
}

/** The schedule year written in the sheet above the header, else in the file name ("2025_Dental..." -> 2025). */
export function scheduleYear(fileName: string, sheet: Sheet, headerRow: number): number | null {
  const fromText = (text: string): number | null => {
    const match = /(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/.exec(text);
    return match ? Number(match[1]) : null;
  };
  for (const row of sheet.slice(0, Math.max(0, headerRow))) {
    for (const cell of row) {
      const text = cellText(cell);
      if (/effective|benchmark|tariff|schedule/i.test(text)) {
        const year = fromText(text);
        if (year) return year;
      }
    }
  }
  return fromText(fileName);
}

/** NAMAF schedules start on 1 January: the suggested start date for a file of `year`. */
export const suggestedStartDate = (year: number | null): string | null => (year ? `${year}-01-01` : null);

/**
 * A warning when the schedule is older than the year we are in: imported from its own start date it also prices
 * today's visits, until the current year's schedule is imported.
 */
export function outdatedScheduleWarning(startDate: string, today: string): string | null {
  if (!isValidDateKey(startDate) || !isValidDateKey(today)) return null;
  const year = Number(startDate.slice(0, 4));
  const currentYear = Number(today.slice(0, 4));
  if (year >= currentYear) return null;
  return (
    `This is a ${year} schedule, but it is now ${currentYear}: NAMAF's ${currentYear} schedule applies from 1 January ${currentYear}. ` +
    `Imported from ${startDate}, these prices also apply to visits today until the ${currentYear} schedule is imported. ` +
    `Import the ${currentYear} file if the practice has received it.`
  );
}

/** A version already in the target list (a practice tariff or a fund price row). */
export interface ExistingPrice {
  code: string | null;
  price: number | string | null;
  effective_from: string | null;
  effective_to?: string | null;
  is_active?: boolean | null;
}

export type ImportStatus = 'new' | 'changed' | 'unchanged' | 'conflict' | 'skipped';

export interface PlannedImportRow extends ScheduleRow {
  status: ImportStatus;
  /** The price in effect on the start date before the import */
  currentPrice: number | null;
  /** Shown next to the row (why skipped, a conflict, a code the practice tariff does not have...) */
  note: string | null;
}

export interface ImportPlan {
  rows: PlannedImportRow[];
  counts: Record<ImportStatus, number>;
  /** Rows that will be saved: new codes and changed prices */
  toSave: PlannedImportRow[];
  /** Nothing is saved while any row conflicts with a version starting on the same day */
  blocked: boolean;
}

const priceOf = (value: number | string | null): number | null => {
  const amount = typeof value === 'number' ? value : value === null ? Number.NaN : Number(value);
  return Number.isFinite(amount) ? fromCents(toCents(amount)) : null;
};

/**
 * Compares the file with the versions already in the target list on the start date: a new code, a changed price (a
 * new version from the start date; older visits keep the old price), an unchanged price (not saved again), or a
 * conflict (a different version already starts that day: refused, as two versions of one day are ambiguous).
 */
export function planScheduleImport(
  rows: readonly ScheduleRow[],
  existing: readonly ExistingPrice[],
  startDate: string,
  options: { dental: boolean; knownCodes?: ReadonlySet<string> } = { dental: false }
): ImportPlan {
  const planned = rows.map((row): PlannedImportRow => {
    const base = { ...row, currentPrice: null as number | null, note: row.problem };
    if (row.price === null) return { ...base, status: 'skipped' };
    if (options.dental && row.code === MATERIAL_FACTOR_CODE) {
      return { ...base, status: 'skipped', note: '8346 is always 10% of its restoration, so a fixed price is not used' };
    }
    const versions = existing.filter(version => {
      if (version.is_active === false || (version.code ?? '').trim().toUpperCase() !== row.code) return false;
      const from = toDateKey(version.effective_from ?? null);
      const to = version.effective_to ? toDateKey(version.effective_to) : null;
      return (!from || from <= startDate) && (!to || to >= startDate);
    });
    const newest = versions.reduce<ExistingPrice | null>(
      (latest, version) => (!latest || (toDateKey(version.effective_from ?? null) ?? '') > (toDateKey(latest.effective_from ?? null) ?? '') ? version : latest),
      null
    );
    const currentPrice = newest ? priceOf(newest.price) : null;
    const known = options.knownCodes && !options.knownCodes.has(row.code) ? 'not in the practice tariff list, so it cannot be billed until the code is added' : null;
    const sameDay = versions.filter(version => toDateKey(version.effective_from ?? null) === startDate);
    if (sameDay.some(version => priceOf(version.price) === null || toCents(priceOf(version.price) as number) !== toCents(row.price as number))) {
      return { ...base, currentPrice, status: 'conflict', note: `a different price already starts on ${startDate}; end it first or choose another start date` };
    }
    if (currentPrice !== null && toCents(currentPrice) === toCents(row.price)) return { ...base, currentPrice, status: 'unchanged', note: known };
    return { ...base, currentPrice, status: currentPrice === null ? 'new' : 'changed', note: known };
  });
  const counts: Record<ImportStatus, number> = { new: 0, changed: 0, unchanged: 0, conflict: 0, skipped: 0 };
  planned.forEach(row => {
    counts[row.status] += 1;
  });
  return {
    rows: planned,
    counts,
    toSave: planned.filter(row => row.status === 'new' || row.status === 'changed'),
    blocked: counts.conflict > 0
  };
}
