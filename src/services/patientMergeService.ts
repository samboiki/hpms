/**
 * The duplicate finder and the merge of two patient files (Patients > More > Possible duplicates), over
 * proposals/2026-10-09-patient-merge.sql: merge_patients and undo_patient_merge (an administrator of the practice, one
 * transaction each), patient_record_counts (visits, invoices and claims, with the caller's rights) and the merge record
 * patient_merges. The pairs themselves are found in the browser (src/utils/patients/duplicatePairs.ts) from every
 * current file of the practice; an archived (merged-away) file has no practice, so it is never read or offered.
 *
 * Until the SQL is applied every call throws MergeNotSetUpError, which the finder shows as "not set up yet".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingFunctionError, isMissingTableError, isPermissionError } from '../utils/diary/dbErrors';
import type { PracticeFile } from '../utils/patients/duplicatePairs';
import { parseAddedRecords, type FileRecordCounts } from '../utils/patients/patientMerge';

// Untyped: the generated types do not know the merge functions and table yet
const db = supabase as unknown as SupabaseClient;

export class MergeNotSetUpError extends Error {
  constructor() {
    super('Merging patient files is not set up yet.');
    this.name = 'MergeNotSetUpError';
  }
}

/** The undo was refused: records were added to the kept file since the merge (per table, as the database counts) */
export class MergeHasNewRecordsError extends Error {
  readonly added: Record<string, number>;
  constructor(added: Record<string, number>) {
    super('Records were added to the kept file since the merge, so it can no longer be undone.');
    this.name = 'MergeHasNewRecordsError';
    this.added = added;
  }
}

interface DbError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const isNotSetUp = (error: unknown): boolean =>
  isMissingFunctionError(error, 'merge_patients') ||
  isMissingFunctionError(error, 'undo_patient_merge') ||
  isMissingFunctionError(error, 'patient_record_counts') ||
  isMissingTableError(error, 'patient_merges');

const failure = (error: DbError, fallback: string): Error => {
  if (isNotSetUp(error)) return new MergeNotSetUpError();
  if (error.hint === 'merge_has_new_records') return new MergeHasNewRecordsError(parseAddedRecords(error.details) ?? {});
  if (isPermissionError(error)) return new Error(error.message || 'Only a practice administrator can merge or unmerge patient files.');
  return new Error(error.message || fallback);
};

const PAGE = 1000;
const FILE_COLUMNS =
  'id, first_name, last_name, id_number, date_of_birth, gender, cell_number, system_patient_reference_number, legacy_account_number, ' +
  'medical_aid_details(medical_aid_provider_id, provider, membership_number, dependant_code)';

/** Every current file of the practice with what the finder compares, a page at a time */
export async function loadPracticeFiles(practiceId: string): Promise<PracticeFile[]> {
  const files: PracticeFile[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('patients').select(FILE_COLUMNS).eq('practice_id', practiceId).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not read the practice's patients: ${error.message}`);
    const page = (data ?? []) as unknown as PracticeFile[];
    files.push(...page);
    if (page.length < PAGE) return files;
  }
}

/** The database function counts at most this many files per call */
const COUNTS_PER_CALL = 400;

/** Visits, invoices and claims per file */
export async function loadRecordCounts(patientIds: readonly string[]): Promise<Map<string, FileRecordCounts>> {
  const counts = new Map<string, FileRecordCounts>();
  const ids = [...new Set(patientIds)];
  for (let from = 0; from < ids.length; from += COUNTS_PER_CALL) {
    const { data, error } = await db.rpc('patient_record_counts', { p_patient_ids: ids.slice(from, from + COUNTS_PER_CALL) });
    if (error) throw failure(error, 'Could not count the visits, invoices and claims');
    for (const row of (data ?? []) as Array<{ patient_id: string; visits: number; invoices: number; claims: number }>) {
      counts.set(row.patient_id, { visits: Number(row.visits), invoices: Number(row.invoices), claims: Number(row.claims) });
    }
  }
  return counts;
}

export interface MergeResult {
  mergeId: string;
  /** Rows moved to the kept file, per table */
  moved: Record<string, number>;
  /** Rows that stayed with the archived file (claim lines already sent, what the kept file already had), per table */
  leftWithArchived: Record<string, number>;
}

/** Everything of `mergePatientId` moves to `keepPatientId`; the merged-away file is archived and points to the kept one */
export async function mergePatients(keepPatientId: string, mergePatientId: string): Promise<MergeResult> {
  const { data, error } = await db.rpc('merge_patients', { p_keep_patient_id: keepPatientId, p_merge_patient_id: mergePatientId });
  if (error) throw failure(error, 'The files could not be merged');
  const result = (data ?? {}) as { merge_id?: string; moved?: Record<string, number>; left_with_archived?: Record<string, number> };
  return { mergeId: String(result.merge_id ?? ''), moved: result.moved ?? {}, leftWithArchived: result.left_with_archived ?? {} };
}

/** Puts every moved row back and restores the archived file; returns what moved back, per table */
export async function undoMerge(mergeId: string): Promise<Record<string, number>> {
  const { data, error } = await db.rpc('undo_patient_merge', { p_merge_id: mergeId });
  if (error) throw failure(error, 'The merge could not be undone');
  return ((data ?? {}) as { moved_back?: Record<string, number> }).moved_back ?? {};
}

export interface MergeRecord {
  id: string;
  keptPatientId: string;
  keptName: string;
  keptReference: number | null;
  mergedName: string;
  mergedReference: number | null;
  moved: Record<string, number>;
  leftWithArchived: Record<string, number>;
  mergedAt: string;
  mergedBy: string | null;
  undoneAt: string | null;
  undoneBy: string | null;
}

const fullName = (first: unknown, last: unknown): string =>
  [first, last].filter(part => typeof part === 'string' && part.trim() !== '').join(' ') || 'Unnamed patient';

/** The practice's merges, newest first (the merged-away file's name comes from the record: staff cannot read it) */
export async function loadMergeHistory(practiceId: string, limit = 50): Promise<MergeRecord[]> {
  const { data, error } = await db
    .from('patient_merges')
    .select('id, kept_patient_id, merged_file, moved, left_with_archived, merged_by, merged_at, undone_by, undone_at')
    .eq('practice_id', practiceId)
    .order('merged_at', { ascending: false })
    .limit(limit);
  if (error) throw failure(error, 'Could not read the merges');
  const rows = (data ?? []) as Array<{
    id: string;
    kept_patient_id: string;
    merged_file: { first_name?: string; last_name?: string; reference?: number | null } | null;
    moved: Record<string, number> | null;
    left_with_archived: Record<string, number> | null;
    merged_by: string | null;
    merged_at: string;
    undone_by: string | null;
    undone_at: string | null;
  }>;
  if (rows.length === 0) return [];

  const keptIds = [...new Set(rows.map(row => row.kept_patient_id))];
  const staffIds = [...new Set(rows.flatMap(row => [row.merged_by, row.undone_by]).filter((id): id is string => !!id))];
  const [kept, staff] = await Promise.all([
    db.from('patients').select('id, first_name, last_name, system_patient_reference_number').in('id', keptIds),
    staffIds.length > 0 ? db.from('users').select('id, full_name').in('id', staffIds) : null
  ]);
  if (kept.error) throw new Error(`Could not read the kept files: ${kept.error.message}`);
  const keptById = new Map(((kept.data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; system_patient_reference_number: number | null }>)
    .map(file => [file.id, file]));
  // A colleague's name is a courtesy: without it the record still shows what happened and when
  const staffById = new Map(((staff?.data ?? []) as Array<{ id: string; full_name: string | null }>).map(user => [user.id, user.full_name]));

  return rows.map(row => {
    const keptFile = keptById.get(row.kept_patient_id);
    return {
      id: row.id,
      keptPatientId: row.kept_patient_id,
      keptName: keptFile ? fullName(keptFile.first_name, keptFile.last_name) : 'A file merged since',
      keptReference: keptFile?.system_patient_reference_number ?? null,
      mergedName: fullName(row.merged_file?.first_name, row.merged_file?.last_name),
      mergedReference: row.merged_file?.reference ?? null,
      moved: row.moved ?? {},
      leftWithArchived: row.left_with_archived ?? {},
      mergedAt: row.merged_at,
      mergedBy: (row.merged_by && staffById.get(row.merged_by)) || null,
      undoneAt: row.undone_at,
      undoneBy: (row.undone_by && staffById.get(row.undone_by)) || null
    };
  });
}
