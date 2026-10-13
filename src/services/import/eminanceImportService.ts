/**
 * Moving a practice over from Eminance: reading the uploaded files, loading what the plan compares with, and the
 * database calls of proposals/2026-10-07-eminance-import.sql (legacy_import_start / _stage / _continue / _undo).
 *
 * Until that file is applied, every call throws ImportNotSetUpError and Settings shows "not set up yet"; the patient
 * file simply shows no Eminance number. The tables are not in the generated types yet, so rows are read with the
 * untyped client and normalised here (as src/components/finance/financeData.ts does).
 */
import type * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { loadFunds } from '../../components/finance/claims/claimsService';
import { toCents } from '../../utils/billing/money';
import { headerScore } from '../../utils/import/eminanceFields';
import { isClaimFile } from '../../utils/import/eminanceClaims';
import { claimImportFile, tableImportFile, unreadableImportFile, type ImportFile } from '../../utils/import/importFiles';
import { parseDelimitedText, findHeaderRow, type Sheet } from '../../utils/import/tableFile';
import type { ExistingFile, FundOption, StagedKind, StagedRow } from '../../utils/import/importPlan';

const db = supabase as unknown as SupabaseClient;

export class ImportNotSetUpError extends Error {
  constructor() {
    super('Moving over from Eminance is not switched on yet.');
    this.name = 'ImportNotSetUpError';
  }
}

interface DbError {
  code?: string;
  message?: string;
}

/** True when the import's tables, functions or the patients.legacy_account_number column are not in the database yet */
export function isImportNotSetUpError(error: unknown): boolean {
  if (error instanceof ImportNotSetUpError) return true;
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!/legacy_(import|claim|account)/i.test(message ?? '')) return false;
  return ['42P01', '42883', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code ?? '') || /could not find|does not exist/i.test(message ?? '');
}

const fail = (error: DbError, fallback: string): never => {
  if (isImportNotSetUpError(error)) throw new ImportNotSetUpError();
  throw new Error(error.message || fallback);
};

// ---------------------------------------------------------------------------------------------
// Reading the files
// ---------------------------------------------------------------------------------------------

/** Exports larger than this are refused before they are read (a practice's full patient list is a few MB) */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** The workbook's sheet whose heading row is recognised best (`xlsx`: the spreadsheet library, loaded by the caller) */
function bestSheet(xlsx: typeof XLSX, workbook: XLSX.WorkBook): { sheet: Sheet; headerRow: number } | null {
  let best: { sheet: Sheet; headerRow: number; score: number } | null = null;
  for (const name of workbook.SheetNames) {
    // Dates stay Excel serial numbers (parseImportDate reads them), so no time zone can move a birthday by a day;
    // blank rows are kept so line numbers match the sheet
    const sheet = xlsx.utils.sheet_to_json<Array<string | number | boolean | null>>(workbook.Sheets[name], {
      header: 1, raw: true, defval: null, blankrows: true
    }) as Sheet;
    const headerRow = findHeaderRow(sheet, headerScore);
    const score = headerRow >= 0 ? headerScore((sheet[headerRow] ?? []).map(cell => String(cell ?? ''))) : 0;
    if (!best || score > best.score) best = { sheet, headerRow, score };
  }
  return best ? { sheet: best.sheet, headerRow: best.headerRow } : null;
}

/** UTF-8, else Windows-1252 (older exports write names such as "Müller" that way) */
function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** One uploaded file, recognised as a table (Excel or CSV) or an Eminance claim file; `index` names its rows */
export async function readImportFile(file: File, index: number): Promise<ImportFile> {
  const name = file.name;
  if (file.size > MAX_FILE_BYTES) return unreadableImportFile(index, name, 'This file is larger than 25 MB. Export fewer columns, or one report at a time.');
  try {
    const buffer = await file.arrayBuffer();
    if (/\.(xlsx|xls)$/i.test(name)) {
      // Loaded on demand so the spreadsheet library (about 0.9 MB) isn't downloaded with the app's first screen
      const xlsx = await import('xlsx');
      const best = bestSheet(xlsx, xlsx.read(buffer, { type: 'array' }));
      return best ? tableImportFile(index, name, best.sheet, best.headerRow) : unreadableImportFile(index, name, 'The workbook has no sheets.');
    }
    const text = decodeText(buffer);
    if (isClaimFile(text)) return claimImportFile(index, name, text);
    if (/\.dat$/i.test(name)) return unreadableImportFile(index, name, 'This .Dat file is not an Eminance claim file.');
    const sheet = parseDelimitedText(text);
    return tableImportFile(index, name, sheet, findHeaderRow(sheet, headerScore));
  } catch (error) {
    return unreadableImportFile(index, name, error instanceof Error ? `It could not be read: ${error.message}` : 'It could not be read.');
  }
}

// ---------------------------------------------------------------------------------------------
// What the plan compares with
// ---------------------------------------------------------------------------------------------

const PAGE = 1000;
const FILE_COLUMNS = 'id, first_name, last_name, id_number, date_of_birth, cell_number, legacy_account_number';

/** The practice's patient files (identity columns only), to find who is already in OneHealth */
export async function loadExistingFiles(practiceId: string): Promise<ExistingFile[]> {
  const rows: ExistingFile[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('patients').select(FILE_COLUMNS).eq('practice_id', practiceId).order('id').range(from, from + PAGE - 1);
    if (error) fail(error, 'Could not read your patients');
    rows.push(...((data ?? []) as ExistingFile[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function loadFundOptions(): Promise<FundOption[]> {
  return (await loadFunds()).map(fund => ({ id: fund.id, name: fund.name, short_name: fund.short_name, medical_aid_reference: fund.medical_aid_reference }));
}

// ---------------------------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------------------------

export type RunStatus = 'staging' | 'importing' | 'imported' | 'undoing' | 'undone' | 'discarded';
export type RowStatus = 'pending' | 'created' | 'matched' | 'skipped';
export type KindCounts = Record<RowStatus, number>;

export interface ImportProgress {
  runId: string;
  status: RunStatus;
  done: boolean;
  balancesAsOf: string | null;
  counts: Partial<Record<StagedKind, KindCounts>>;
  openingBalanceCents: number;
  claimLines: number;
  undoLeft: number;
}

export interface ImportRun {
  id: string;
  status: RunStatus;
  balancesAsOf: string | null;
  createdAt: string;
  importedAt: string | null;
  undoneAt: string | null;
  undoReason: string | null;
  counts: Partial<Record<StagedKind, KindCounts>>;
  openingBalanceCents: number;
  claimLines: number;
}

export interface ImportRowResult {
  kind: StagedKind;
  key: string;
  line: number | null;
  accountNumber: string | null;
  label: string;
  status: RowStatus;
  reason: string | null;
  patientId: string | null;
}

const asCounts = (value: unknown): Partial<Record<StagedKind, KindCounts>> =>
  value && typeof value === 'object' ? (value as Partial<Record<StagedKind, KindCounts>>) : {};

export function toProgress(value: unknown): ImportProgress {
  const data = (value ?? {}) as Record<string, unknown>;
  return {
    runId: String(data.run_id ?? ''),
    status: (data.status as RunStatus) ?? 'staging',
    done: data.done === true,
    balancesAsOf: (data.balances_as_of as string | null) ?? null,
    counts: asCounts(data.counts),
    openingBalanceCents: Number(data.opening_balance_cents ?? 0),
    claimLines: Number(data.claim_lines ?? 0),
    undoLeft: Number(data.undo_left ?? 0)
  };
}

interface RunRow {
  id: string;
  status: RunStatus;
  balances_as_of: string | null;
  created_at: string;
  imported_at: string | null;
  undone_at: string | null;
  undo_reason: string | null;
  summary: Record<string, unknown> | null;
}

export async function loadRuns(practiceId: string): Promise<ImportRun[]> {
  const { data, error } = await db
    .from('legacy_import_runs')
    .select('id, status, balances_as_of, created_at, imported_at, undone_at, undo_reason, summary')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) fail(error, 'Could not read earlier imports');
  return ((data ?? []) as RunRow[]).map(run => ({
    id: run.id,
    status: run.status,
    balancesAsOf: run.balances_as_of,
    createdAt: run.created_at,
    importedAt: run.imported_at,
    undoneAt: run.undone_at,
    undoReason: run.undo_reason,
    counts: asCounts(run.summary?.counts),
    openingBalanceCents: Number(run.summary?.opening_balance_cents ?? 0),
    claimLines: Number(run.summary?.claim_lines ?? 0)
  }));
}

/** Every row of a run with its outcome (names and reasons only: the values were removed when it finished) */
export async function loadRunRows(runId: string): Promise<ImportRowResult[]> {
  const rows: ImportRowResult[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('legacy_import_rows')
      .select('kind, row_key, file_line, account_number, label, status, reason, patient_id')
      .eq('run_id', runId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) fail(error, 'Could not read the import');
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      rows.push({
        kind: row.kind as StagedKind,
        key: String(row.row_key),
        line: (row.file_line as number | null) ?? null,
        accountNumber: (row.account_number as string | null) ?? null,
        label: String(row.label ?? ''),
        status: row.status as RowStatus,
        reason: (row.reason as string | null) ?? null,
        patientId: (row.patient_id as string | null) ?? null
      });
    }
    if (!data || data.length < PAGE) return rows;
  }
}

export interface StartOptions {
  balancesAsOf: string | null;
  files: Array<{ name: string; kind: string; rows: number; portion?: string }>;
}

export async function startImport(practiceId: string, options: StartOptions): Promise<string> {
  const { data, error } = await db.rpc('legacy_import_start', {
    p_practice_id: practiceId,
    p_options: { balances_as_of: options.balancesAsOf, files: options.files }
  });
  if (error) fail(error, 'The import could not be started');
  return String(data);
}

/** Rows per staging call (the database accepts at most 500), and the most text per call (claim rows are large) */
export const STAGE_CHUNK = 250;
export const STAGE_CHUNK_CHARS = 800_000;

/** The rows in calls of at most STAGE_CHUNK rows and about STAGE_CHUNK_CHARS characters each */
export function stageChunks(rows: readonly StagedRow[]): StagedRow[][] {
  const chunks: StagedRow[][] = [];
  let chunk: StagedRow[] = [];
  let chars = 0;
  for (const row of rows) {
    const size = JSON.stringify(row).length;
    if (chunk.length > 0 && (chunk.length >= STAGE_CHUNK || chars + size > STAGE_CHUNK_CHARS)) {
      chunks.push(chunk);
      chunk = [];
      chars = 0;
    }
    chunk.push(row);
    chars += size;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

export async function stageRows(runId: string, rows: readonly StagedRow[], onProgress?: (sent: number) => void): Promise<void> {
  let sent = 0;
  for (const chunk of stageChunks(rows)) {
    const { error } = await db.rpc('legacy_import_stage', { p_run_id: runId, p_rows: chunk });
    if (error) fail(error, 'The rows could not be sent');
    sent += chunk.length;
    onProgress?.(sent);
  }
}

/** One step of the import (the next 40 to 200 rows); call until done */
export async function continueImport(runId: string): Promise<ImportProgress> {
  const { data, error } = await db.rpc('legacy_import_continue', { p_run_id: runId });
  if (error) fail(error, 'The import stopped');
  return toProgress(data);
}

/** One step of an undo; the first call checks that nobody has worked with the imported records */
export async function undoImport(runId: string, reason: string): Promise<ImportProgress> {
  const { data, error } = await db.rpc('legacy_import_undo', { p_run_id: runId, p_reason: reason });
  if (error) fail(error, 'The import could not be undone');
  return toProgress(data);
}

// ---------------------------------------------------------------------------------------------
// The patient file: the claim history and whether the old file number came from an import (the number itself is
// read with the OneHealth reference: loadPatientFileNumbers in src/services/patientFileService.ts)
// ---------------------------------------------------------------------------------------------

export interface LegacyClaimLine {
  id: string;
  serviceDate: string;
  tariffCode: string;
  description: string | null;
  tooth: string | null;
  diagnosis: string | null;
  quantity: number;
  amountCents: number;
  fundCode: string | null;
  invoiceNumber: string | null;
}

/** True when claim history was brought over from Eminance for the patient; false too before the import is set up */
export async function hasLegacyClaimHistory(patientId: string): Promise<boolean> {
  const { count, error } = await db.from('legacy_claim_lines').select('id', { count: 'exact', head: true }).eq('patient_id', patientId);
  if (error) {
    if (isImportNotSetUpError(error)) return false;
    throw new Error(error.message || 'Could not read the claim history');
  }
  return (count ?? 0) > 0;
}

/**
 * True when the file's old file number was written by an Eminance import (a created or matched import row carries it):
 * it is then kept as imported, because the patient's Eminance statements and claims quote it.
 */
export async function isImportedOldFileNumber(patientId: string, oldFileNumber: string): Promise<boolean> {
  const { count, error } = await db
    .from('legacy_import_rows')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('kind', 'patient')
    .eq('account_number', oldFileNumber)
    .in('status', ['created', 'matched']);
  if (error) {
    if (isImportNotSetUpError(error)) return false;
    throw new Error(error.message || 'Could not read the Eminance import');
  }
  return (count ?? 0) > 0;
}

/** Claim history brought over from Eminance, newest first; empty when there is none or the import is not set up */
export async function loadLegacyClaimLines(patientId: string): Promise<LegacyClaimLine[]> {
  const { data, error } = await db
    .from('legacy_claim_lines')
    .select('id, service_date, tariff_code, description, tooth, diagnosis, quantity, amount, fund_code, invoice_number')
    .eq('patient_id', patientId)
    .order('service_date', { ascending: false })
    .limit(500);
  if (error) {
    if (isImportNotSetUpError(error)) return [];
    throw new Error(error.message || 'Could not read the claim history');
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
    id: String(row.id),
    serviceDate: String(row.service_date),
    tariffCode: String(row.tariff_code),
    description: (row.description as string | null) ?? null,
    tooth: (row.tooth as string | null) ?? null,
    diagnosis: (row.diagnosis as string | null) ?? null,
    quantity: Number(row.quantity ?? 1),
    amountCents: toCents(Number(row.amount ?? 0)),
    fundCode: (row.fund_code as string | null) ?? null,
    invoiceNumber: (row.invoice_number as string | null) ?? null
  }));
}
