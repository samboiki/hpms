import { describe, it, expect } from 'vitest';
import {
  cellCode,
  cellNumber,
  detectLayout,
  outdatedScheduleWarning,
  planScheduleImport,
  readScheduleRows,
  scheduleYear,
  suggestedStartDate,
  type Sheet
} from '../tariffImport';

// The first rows of NAMAF's dental workbook (2025, "Tariffs" sheet): discipline prefixes, their names, the header, then
// one row per code with a price per discipline ('' = not priced for that discipline, 0 = by arrangement).
const NAMAF_DENTAL: Sheet = [
  [null, null, '054', '062', '064', '092', '094', '098', null],
  [null, null, 'General Dental Practitioners', 'Specialist Maxillo- Facial and Oral Surgeons', 'Specialist Orthodontists', 'Periodontists', 'Specialist Prosthodontists', 'Oral Pathologists', null],
  ['Item', 'Description', 'N$', 'N$', 'N$', 'N$', 'N$', 'N$', null],
  ['8101', 'Full mouth examination, charting and treatment planning (see Rule 001)', 254.7, '', '', '', '', '', null],
  ['8105', 'Appointment not kept - per half-hour (By arrangement with patient)', 0, '', '', '', '', '', null],
  ['8107', 'Intra-oral radiographs, per film', 135.4, 134.4, 133.4, 134.1, 134.9, '', null],
  ['8109', 'Infection control, per dentist, per hygienist, per dental assistant, per visit', 34.4, '', '', '', '', '', null],
  [null, 'B. PREVENTIVE PROCEDURES', null, null, null, null, null, null, null],
  ['8161', 'Topical application of fluoride - complete dentition', '', '', '', '', 208.7, '', null],
  ['8161', 'Topical application of fluoride - complete dentition.....', 208.2, '', '', '', '', '', null],
  ['8346', 'Restorative material factor', 0, '', '', '', '', '', null]
];

// Business rule: NAMAF sends each practice the schedule of its own discipline in this layout. The importer must find
// the header and offer each discipline's price column by its practice-number prefix, so staff pick the right one.
describe('detectLayout reads NAMAF\'s own workbook layout', () => {
  it('finds the header, the code and description columns, and one price column per discipline', () => {
    const layout = detectLayout(NAMAF_DENTAL);
    expect(layout).toMatchObject({ headerRow: 2, codeColumn: 0, descriptionColumn: 1, priceColumn: 2, namaf: true });
    expect(layout?.priceColumns.map(column => column.label)).toEqual([
      '054 General Dental Practitioners',
      '062 Specialist Maxillo- Facial and Oral Surgeons',
      '064 Specialist Orthodontists',
      '092 Periodontists',
      '094 Specialist Prosthodontists',
      '098 Oral Pathologists'
    ]);
  });

  it('reads a plain price list (a fund schedule as CSV) with differently named columns', () => {
    const layout = detectLayout([['PSEMAS dental tariff'], ['Tariff code', 'Service', 'Amount (N$)'], ['8101', 'Examination', '148.30']]);
    expect(layout).toMatchObject({ headerRow: 1, codeColumn: 0, descriptionColumn: 1, priceColumn: 2, namaf: false });
    expect(detectLayout([['no', 'header', 'here']])).toBeNull();
  });
});

// Business rule: only real prices are imported. A blank cell is "not priced for this discipline", 0 is NAMAF's "by
// arrangement"; neither may become a N$ 0.00 line. A code listed twice must not be guessed.
describe('readScheduleRows', () => {
  const layout = detectLayout(NAMAF_DENTAL);
  const mapping = { headerRow: 2, codeColumn: 0, descriptionColumn: 1, priceColumn: layout?.priceColumn ?? 2 };

  it('reads each code with its price for the chosen discipline, and says why a row is not imported', () => {
    const rows = readScheduleRows(NAMAF_DENTAL, mapping);
    expect(rows.map(row => [row.code, row.price, row.problem])).toEqual([
      ['8101', 254.7, null],
      ['8105', null, 'no fixed fee (0: by arrangement)'],
      ['8107', 135.4, null],
      ['8109', 34.4, null],
      ['8161', 208.2, null],
      ['8346', null, 'no fixed fee (0: by arrangement)']
    ]);
    // The prosthodontists' column has its own 8161 price
    expect(readScheduleRows(NAMAF_DENTAL, { ...mapping, priceColumn: 6 }).find(row => row.code === '8161')?.price).toBe(208.7);
  });

  it('refuses a code listed twice with different prices instead of picking one', () => {
    const sheet: Sheet = [['Code', 'Description', 'Price'], ['0190', 'Consultation', 520], ['0190', 'Consultation', 540]];
    expect(readScheduleRows(sheet, { headerRow: 0, codeColumn: 0, descriptionColumn: 1, priceColumn: 2 })).toEqual([
      expect.objectContaining({ code: '0190', price: null, problem: expect.stringContaining('different prices (rows 2, 3)') })
    ]);
  });

  it('keeps leading zeros of codes stored as numbers, and reads prices written as text', () => {
    expect(cellCode(190)).toBe('0190');
    expect(cellCode(8101)).toBe('8101');
    expect(cellNumber('N$ 1 234.50')).toBe(1234.5);
    expect(cellNumber('254,70')).toBe(254.7);
    expect(cellNumber('1,234.50')).toBe(1234.5);
    [null, '', 'by arrangement', '12a'].forEach(value => expect(cellNumber(value)).toBeNull());
  });
});

// Business rule: NAMAF schedules start on 1 January. The start date comes from the file, and it is now October 2026:
// staff importing the 2025 file must be told that the 2026 schedule applies from 1 January 2026.
describe('start date and the schedule year', () => {
  it('takes the year from the sheet title, else from the file name', () => {
    expect(scheduleYear('2025_Dental Practitioners (All).xlsx', NAMAF_DENTAL, 2)).toBe(2025);
    expect(scheduleYear('dental.xlsx', [['Benchmark tariffs effective 1 January 2026'], ['Item', 'Description', 'N$']], 1)).toBe(2026);
    expect(scheduleYear('tariffs.csv', [], 0)).toBeNull();
    expect(suggestedStartDate(2026)).toBe('2026-01-01');
  });

  it('warns when the schedule is older than the current year', () => {
    expect(outdatedScheduleWarning('2025-01-01', '2026-10-07')).toContain("NAMAF's 2026 schedule applies from 1 January 2026");
    expect(outdatedScheduleWarning('2026-01-01', '2026-10-07')).toBeNull();
    expect(outdatedScheduleWarning('2027-01-01', '2026-10-07')).toBeNull();
  });
});

// Business rule: an import never rewrites history. A changed price becomes a new version from its start date (older
// visits keep the old price); an unchanged price is not saved again; a different price already starting that day is
// refused, because two versions of one day are ambiguous and would stop the code from being billed.
describe('planScheduleImport', () => {
  const rows = readScheduleRows(NAMAF_DENTAL, { headerRow: 2, codeColumn: 0, descriptionColumn: 1, priceColumn: 2 });
  const existing = [
    { code: '8101', price: '242.40', effective_from: '2024-01-01' },
    { code: '8101', price: '254.70', effective_from: '2025-01-01' },
    { code: '8107', price: 128.9, effective_from: '2024-01-01' },
    { code: '8109', price: 32.7, effective_from: '2024-01-01', is_active: false }
  ];

  it('marks new codes, changed prices, unchanged prices and rows it skips', () => {
    const plan = planScheduleImport(rows, existing, '2025-01-01', { dental: true, knownCodes: new Set(['8101', '8107', '8109']) });
    expect(plan.rows.map(row => [row.code, row.status, row.currentPrice])).toEqual([
      ['8101', 'unchanged', 254.7],
      ['8105', 'skipped', null],
      ['8107', 'changed', 128.9],
      ['8109', 'new', null],
      ['8161', 'new', null],
      ['8346', 'skipped', null]
    ]);
    expect(plan.counts).toEqual({ new: 2, changed: 1, unchanged: 1, conflict: 0, skipped: 2 });
    expect(plan.toSave.map(row => row.code)).toEqual(['8107', '8109', '8161']);
    expect(plan.rows.find(row => row.code === '8161')?.note).toContain('not in the practice tariff list');
    expect(plan.blocked).toBe(false);
  });

  it('refuses the whole import while a different price already starts on the same day', () => {
    const plan = planScheduleImport(rows, [{ code: '8109', price: '35.00', effective_from: '2026-01-01' }], '2026-01-01', { dental: true });
    expect(plan.rows.find(row => row.code === '8109')).toMatchObject({ status: 'conflict', note: expect.stringContaining('2026-01-01') });
    expect(plan.blocked).toBe(true);
  });
});
