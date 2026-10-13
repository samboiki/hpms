/**
 * Pure helpers for move-records.ts: checking the plan (record-moves.sql), building the row updates and running the
 * steps for one file in the only safe order. Unit tested in scripts/storage/__tests__/recordMoves.test.ts.
 */
import { RECORDS_BUCKET, isRecordPath } from '../../src/services/recordPaths.ts';

/** A row that points at a file: its table, id, the column holding the path or link, and the value the plan read */
export interface RowRef {
  table: string;
  id: string;
  column: string;
  old: string;
}

/** One file of the plan (scripts/storage/record-moves.sql) */
export interface PlannedMove {
  old_path: string;
  size: number | string | null;
  practice_id: string | null;
  practice_source: string | null;
  new_path: string | null;
  keep_reason: string | null;
  existing_copy_size: number | string | null;
  refs: RowRef[];
}

/**
 * How each table that points at a record is repointed: the column holding the path, the bucket column when the
 * table has one, and file_name where some rows hold the path there too. A fixed list: no SQL is built from data.
 */
export const ROW_UPDATES: Readonly<Record<string, { column: string; bucketColumn?: string; fileNameColumn?: string }>> = {
  visit_documents: { column: 'file_path', bucketColumn: 'storage_bucket' },
  patient_documents: { column: 'storage_path' },
  patient_media: { column: 'storage_path', bucketColumn: 'storage_bucket', fileNameColumn: 'file_name' },
  patient_imaging: { column: 'storage_path', bucketColumn: 'storage_bucket', fileNameColumn: 'file_name' },
  patient_laboratory: { column: 'storage_path', bucketColumn: 'storage_bucket', fileNameColumn: 'file_name' },
  practice_documents: { column: 'file_path' },
  lab_requests: { column: 'media_url' },
  timesheets: { column: 'pdf_url' },
  leave_requests: { column: 'supporting_document_url' }
};

/** Why a planned move must not run, or null. Every file is checked before anything is copied. */
export function moveProblem(move: PlannedMove): string | null {
  if (!move.new_path) return null;
  if (!isRecordPath(move.new_path) || move.new_path.split('/')[0] !== move.practice_id) {
    return 'the new path does not start with the practice of the file';
  }
  if (move.existing_copy_size !== null && Number(move.existing_copy_size) !== Number(move.size)) {
    return 'a different file is already at the new path';
  }
  if (move.refs.some(ref => ROW_UPDATES[ref.table]?.column !== ref.column)) {
    return 'a row that points at it cannot be repointed by this script';
  }
  return null;
}

export interface RowUpdate {
  text: string;
  values: string[];
}

/** The UPDATE for one row: the new path (and bucket), only while the row still holds the value the plan read */
export function rowUpdate(ref: RowRef, newPath: string): RowUpdate {
  const update = ROW_UPDATES[ref.table];
  if (!update || update.column !== ref.column) throw new Error(`No update known for ${ref.table}.${ref.column}`);
  const sets = [`${update.column} = $1`];
  if (update.bucketColumn) sets.push(`${update.bucketColumn} = '${RECORDS_BUCKET}'`);
  if (update.fileNameColumn) {
    sets.push(`${update.fileNameColumn} = CASE WHEN ${update.fileNameColumn} = $3 THEN $1 ELSE ${update.fileNameColumn} END`);
  }
  return {
    text: `UPDATE public.${ref.table} SET ${sets.join(', ')} WHERE id = $2 AND ${update.column} = $3`,
    values: [newPath, ref.id, ref.old]
  };
}

/** What the runner does with storage and the database (injected, so the order can be tested) */
export interface MoveIo {
  /** Copies the public file to the private bucket */
  copy(oldPath: string, newPath: string): Promise<void>;
  /** Runs the row updates in one transaction; fails unless each touches exactly one row */
  repoint(updates: RowUpdate[]): Promise<void>;
  /** Deletes the public copy */
  removeOld(oldPath: string): Promise<void>;
}

/**
 * One file, in the only safe order: copy (unless an earlier run did), repoint every row, and only then delete the
 * public copy. A failure stops before the next step, so no row ever points at a file that is not there.
 */
export async function moveOne(move: PlannedMove, io: MoveIo): Promise<void> {
  if (!move.new_path) throw new Error('This file stays where it is');
  if (move.existing_copy_size === null) await io.copy(move.old_path, move.new_path);
  const newPath = move.new_path;
  if (move.refs.length > 0) await io.repoint(move.refs.map(ref => rowUpdate(ref, newPath)));
  await io.removeOld(move.old_path);
}

const tally = (values: string[]): string =>
  Object.entries(values.reduce<Record<string, number>>((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {}))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, n]) => `${value} ${n}`)
    .join(', ') || 'none';

/** The plan in counts: never a file name, path or id (they name patients) */
export function summarize(plan: PlannedMove[]): string[] {
  const moving = plan.filter(move => move.new_path);
  const staying = plan.filter(move => !move.new_path);
  const bytes = moving.reduce((sum, move) => sum + Number(move.size ?? 0), 0);
  return [
    `Record files in the public bucket: ${plan.length}`,
    `To move: ${moving.length} (${(bytes / 1024 / 1024).toFixed(1)} MB), already copied: ${moving.filter(move => move.existing_copy_size !== null).length}`,
    `To move, by kind: ${tally(moving.map(move => (move.new_path ?? '').split('/')[1]))}`,
    `Practice taken from: ${tally(moving.map(move => move.practice_source ?? 'unknown'))}`,
    `Rows to repoint, by table: ${tally(moving.flatMap(move => move.refs.map(ref => ref.table)))}`,
    `Staying where they are: ${staying.length}${staying.length ? ` (${tally(staying.map(move => move.keep_reason ?? 'unknown'))})` : ''}`
  ];
}
