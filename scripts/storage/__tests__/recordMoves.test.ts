import { describe, expect, it } from 'vitest';
import { moveOne, moveProblem, rowUpdate, summarize, type MoveIo, type PlannedMove, type RowUpdate } from '../recordMoves';

// Invented ids
const PRACTICE = '1a2b3c4d-0000-4000-8000-00000000000a';
const OTHER_PRACTICE = '1a2b3c4d-0000-4000-8000-00000000000b';
const PATIENT = '5e6f7a8b-0000-4000-8000-000000000001';
const ROW = '9c0d1e2f-0000-4000-8000-000000000001';

const plannedMove = (overrides: Partial<PlannedMove> = {}): PlannedMove => ({
  old_path: `${PATIENT}/1_scan.png`,
  size: 2048,
  practice_id: PRACTICE,
  practice_source: 'rows',
  new_path: `${PRACTICE}/patient-media/${PATIENT}/1_scan.png`,
  keep_reason: null,
  existing_copy_size: null,
  refs: [{ table: 'patient_media', id: ROW, column: 'storage_path', old: `${PATIENT}/1_scan.png` }],
  ...overrides
});

const recordingIo = (fail: Partial<Record<keyof MoveIo, string>> = {}) => {
  const steps: string[] = [];
  const updates: RowUpdate[][] = [];
  const io: MoveIo = {
    copy: async () => { steps.push('copy'); if (fail.copy) throw new Error(fail.copy); },
    repoint: async batch => { steps.push('repoint'); updates.push(batch); if (fail.repoint) throw new Error(fail.repoint); },
    removeOld: async () => { steps.push('removeOld'); if (fail.removeOld) throw new Error(fail.removeOld); }
  };
  return { io, steps, updates };
};

// The public copy is what the July 2025 app and every old row open: it may only go once the private copy exists and
// every row points at it, or a patient's file is lost to the practice.
describe('moving one file', () => {
  it('copies, repoints the rows, and only then deletes the public copy', async () => {
    const { io, steps } = recordingIo();
    await moveOne(plannedMove(), io);
    expect(steps).toEqual(['copy', 'repoint', 'removeOld']);
  });

  it('keeps the public copy when the rows cannot be repointed', async () => {
    const { io, steps } = recordingIo({ repoint: 'a row changed since the plan was read' });
    await expect(moveOne(plannedMove(), io)).rejects.toThrow('a row changed');
    expect(steps).toEqual(['copy', 'repoint']);
  });

  it('touches no row and deletes nothing when the copy fails', async () => {
    const { io, steps } = recordingIo({ copy: 'copy failed' });
    await expect(moveOne(plannedMove(), io)).rejects.toThrow('copy failed');
    expect(steps).toEqual(['copy']);
  });

  it('reuses the copy a stopped run made instead of copying again', async () => {
    const { io, steps } = recordingIo();
    await moveOne(plannedMove({ existing_copy_size: 2048 }), io);
    expect(steps).toEqual(['repoint', 'removeOld']);
  });

  it('moves a file no row points at without touching the database', async () => {
    const { io, steps } = recordingIo();
    await moveOne(plannedMove({ refs: [] }), io);
    expect(steps).toEqual(['copy', 'removeOld']);
  });
});

// A record filed under the wrong practice is readable by that practice's staff: the plan is checked before anything
// is copied.
describe('checking the plan before the first copy', () => {
  it('accepts a move into the practice folder of the file', () => {
    expect(moveProblem(plannedMove())).toBeNull();
  });

  it('refuses a new path outside the practice of the file', () => {
    expect(moveProblem(plannedMove({ new_path: `${OTHER_PRACTICE}/patient-media/${PATIENT}/1_scan.png` }))).toMatch(/practice/);
    expect(moveProblem(plannedMove({ new_path: `patient-media/${PATIENT}/1_scan.png` }))).toMatch(/practice/);
  });

  it('stops when a different file already sits at the new path', () => {
    expect(moveProblem(plannedMove({ existing_copy_size: 99 }))).toMatch(/different file/);
  });

  it('refuses rows of a table it does not know how to repoint', () => {
    expect(moveProblem(plannedMove({ refs: [{ table: 'users', id: ROW, column: 'avatar', old: 'x' }] }))).toMatch(/cannot be repointed/);
  });

  it('has nothing to check for a file that stays', () => {
    expect(moveProblem(plannedMove({ new_path: null, keep_reason: 'no practice found' }))).toBeNull();
  });
});

// Rows change while the app is in use: an update only applies while the row still holds what the plan read, and the
// bucket column says "records" so the app reads the new copy.
describe('repointing a row', () => {
  it('sets the new path and bucket only on the row that still holds the old value', () => {
    const update = rowUpdate({ table: 'visit_documents', id: ROW, column: 'file_path', old: 'invoices/x.pdf' }, `${PRACTICE}/invoices/x.pdf`);
    expect(update.text).toBe("UPDATE public.visit_documents SET file_path = $1, storage_bucket = 'records' WHERE id = $2 AND file_path = $3");
    expect(update.values).toEqual([`${PRACTICE}/invoices/x.pdf`, ROW, 'invoices/x.pdf']);
  });

  it('also moves file_name where it held the path (rows the file panel wrote)', () => {
    expect(rowUpdate(plannedMove().refs[0], 'p').text).toContain('file_name = CASE WHEN file_name = $3 THEN $1 ELSE file_name END');
  });

  it('replaces an old public link with the path', () => {
    const update = rowUpdate({ table: 'timesheets', id: ROW, column: 'pdf_url', old: 'https://project.supabase.co/storage/v1/object/public/documents/timesheets/u/1.pdf' }, `${PRACTICE}/timesheets/u/1.pdf`);
    expect(update.text).toBe('UPDATE public.timesheets SET pdf_url = $1 WHERE id = $2 AND pdf_url = $3');
  });

  it('never builds SQL for a table or column outside its fixed list', () => {
    expect(() => rowUpdate({ table: 'users; DROP TABLE users', id: ROW, column: 'avatar', old: 'x' }, 'p')).toThrow();
    expect(() => rowUpdate({ table: 'timesheets', id: ROW, column: 'notes', old: 'x' }, 'p')).toThrow();
  });
});

// The output is read by people and tools that must never see patient data: file names and paths carry patient ids
it('reports the plan in counts only', () => {
  const lines = summarize([plannedMove(), plannedMove({ new_path: null, keep_reason: 'no practice found', refs: [] })]).join('\n');
  expect(lines).toContain('To move: 1');
  expect(lines).toContain('patient_media 1');
  expect(lines).toContain('Staying where they are: 1 (no practice found 1)');
  expect(lines).not.toContain(PATIENT);
  expect(lines).not.toContain(PRACTICE);
  expect(lines).not.toContain(ROW);
});
