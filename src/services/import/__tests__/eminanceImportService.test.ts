import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../../components/finance/claims/claimsService', () => ({ loadFunds: vi.fn() }));
// Counts how often the spreadsheet library is loaded
const excel = vi.hoisted(() => ({ loads: 0 }));
vi.mock('xlsx', async (importOriginal) => {
  excel.loads += 1;
  return importOriginal();
});

import { ImportNotSetUpError, isImportNotSetUpError, readImportFile, stageChunks, STAGE_CHUNK, STAGE_CHUNK_CHARS, toProgress } from '../eminanceImportService';
import type { StagedRow } from '../../../utils/import/importPlan';

const row = (key: string, payload: Record<string, unknown> = {}): StagedRow => ({ kind: 'patient', key, line: 2, account_number: '0000101', label: 'Invented Person', payload });

describe('isImportNotSetUpError', () => {
  it('treats a missing import table, function or column as "not set up yet", so Settings explains instead of showing a database error', () => {
    expect(isImportNotSetUpError({ code: '42P01', message: 'relation "public.legacy_import_runs" does not exist' })).toBe(true);
    expect(isImportNotSetUpError({ code: 'PGRST202', message: 'Could not find the function public.legacy_import_start(p_options, p_practice_id)' })).toBe(true);
    expect(isImportNotSetUpError({ code: '42703', message: 'column patients.legacy_account_number does not exist' })).toBe(true);
    expect(isImportNotSetUpError(new ImportNotSetUpError())).toBe(true);
  });

  it('passes on every other error, so a refused undo or a missing permission is shown as it is', () => {
    expect(isImportNotSetUpError({ code: '42501', message: 'Only a practice admin can move patients over from Eminance' })).toBe(false);
    expect(isImportNotSetUpError({ code: 'P0001', message: 'This import can no longer be undone: visits were added to the imported patients' })).toBe(false);
    expect(isImportNotSetUpError({ code: '42P01', message: 'relation "public.some_other_table" does not exist' })).toBe(false);
  });
});

describe('stageChunks', () => {
  it('sends at most 250 rows a call, below the 500 the database accepts', () => {
    const chunks = stageChunks(Array.from({ length: 600 }, (_, index) => row(`p:0:${index}`)));
    expect(chunks.map(chunk => chunk.length)).toEqual([STAGE_CHUNK, STAGE_CHUNK, 100]);
  });

  it('keeps large claim history rows apart, so no single request becomes too big to send', () => {
    const lines = Array.from({ length: 300 }, () => ({ service_date: '2025-03-04', tariff_code: '8101', description: 'X'.repeat(30), amount_cents: 45000 }));
    const chunks = stageChunks(Array.from({ length: 80 }, (_, index) => ({ ...row(`c:p:0:${index}`, { lines }), kind: 'claim_line' as const })));
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.reduce((chars, item) => chars + JSON.stringify(item).length, 0)).toBeLessThanOrEqual(STAGE_CHUNK_CHARS);
    }
    expect(chunks.flat()).toHaveLength(80);
  });
});

// readImportFile reads a file's name, size and bytes only (jsdom's File cannot hand over its bytes)
const upload = (name: string, bytes: ArrayBuffer): File => ({ name, size: bytes.byteLength, arrayBuffer: () => Promise.resolve(bytes) }) as unknown as File;

describe('readImportFile', () => {
  // The spreadsheet library is large (about 0.9 MB): it is loaded when a practice first reads an Excel export, so the
  // app's first screen on a phone does not carry it, and an export still reads as before (a title row above the headings)
  it('loads the spreadsheet library only for an Excel export, and still reads the export', async () => {
    const csv = await readImportFile(upload('patients.csv', new TextEncoder().encode('Account,Surname,First name\n0000101,Example,Invented\n').buffer as ArrayBuffer), 0);
    expect(csv).toMatchObject({ source: 'table', problem: null });
    expect(excel.loads).toBe(0);

    const XLSX = await vi.importActual<typeof import('xlsx')>('xlsx');
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Patient list'], ['Account', 'Surname', 'First name'], ['0000101', 'Example', 'Invented']]), 'Patients');
    const fromExcel = await readImportFile(upload('patients.xlsx', XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer), 1);
    expect(excel.loads).toBe(1);
    expect(fromExcel).toMatchObject({ index: 1, name: 'patients.xlsx', source: 'table', problem: null });
    expect(fromExcel.table?.headers).toEqual(['Account', 'Surname', 'First name']);
    expect(fromExcel.table?.headerRow).toBe(1);
    expect(fromExcel.table?.rows).toHaveLength(1);
  });
});

describe('toProgress', () => {
  it('reads the counts and amounts the database returns, with zeros where a kind has no rows', () => {
    const progress = toProgress({
      run_id: 'run-1', status: 'importing', done: false, balances_as_of: '2026-10-07',
      counts: { patient: { pending: 20, created: 70, matched: 8, skipped: 2 } }, opening_balance_cents: '58172', claim_lines: 12, undo_left: 0
    });
    expect(progress).toMatchObject({ runId: 'run-1', status: 'importing', done: false, openingBalanceCents: 58172, claimLines: 12 });
    expect(progress.counts.patient?.created).toBe(70);
    expect(progress.counts.balance).toBeUndefined();
  });
});
