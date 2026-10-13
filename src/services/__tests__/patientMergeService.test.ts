import { beforeEach, describe, expect, it, vi } from 'vitest';

// All people and ids are invented
type Call = { table: string; filters: Array<[string, string, unknown]>; range?: [number, number] };
const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  calls: [] as Call[],
  rows: (() => []) as (call: Call) => unknown[],
  error: null as null | Record<string, string>
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: unknown) => db.rpc(name, args),
    from: (table: string) => {
      const call: Call = { table, filters: [] };
      db.calls.push(call);
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          call.filters.push(['eq', column, value]);
          return chain;
        },
        in: (column: string, values: unknown) => {
          call.filters.push(['in', column, values]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        range: (from: number, to: number) => {
          call.range = [from, to];
          return chain;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(db.error ? { data: null, error: db.error } : { data: db.rows(call), error: null }).then(resolve)
      };
      return chain;
    }
  }
}));

import {
  MergeHasNewRecordsError,
  MergeNotSetUpError,
  loadMergeHistory,
  loadPracticeFiles,
  loadRecordCounts,
  mergePatients,
  undoMerge
} from '../patientMergeService';

beforeEach(() => {
  db.rpc.mockReset();
  db.calls = [];
  db.rows = () => [];
  db.error = null;
});

describe('mergePatients', () => {
  // Swapping the two would archive the file the administrator chose to keep
  it('sends the file that stays and the file that is archived to the database, in that order', async () => {
    db.rpc.mockResolvedValue({ data: { merge_id: 'm1', moved: { visits: 3 }, left_with_archived: { batch_details: 1 } }, error: null });
    await expect(mergePatients('keep-1', 'gone-1')).resolves.toEqual({ mergeId: 'm1', moved: { visits: 3 }, leftWithArchived: { batch_details: 1 } });
    expect(db.rpc).toHaveBeenCalledWith('merge_patients', { p_keep_patient_id: 'keep-1', p_merge_patient_id: 'gone-1' });
  });

  it('says "not set up yet" before the SQL is applied, instead of a database error', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.merge_patients in the schema cache' } });
    await expect(mergePatients('keep-1', 'gone-1')).rejects.toBeInstanceOf(MergeNotSetUpError);
  });

  it("passes on the database's own words when it refuses (not an administrator, another practice's file)", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only a practice administrator can merge patient files' } });
    await expect(mergePatients('keep-1', 'gone-1')).rejects.toThrow('Only a practice administrator can merge patient files');
  });
});

describe('undoMerge', () => {
  it('returns what moved back', async () => {
    db.rpc.mockResolvedValue({ data: { merge_id: 'm1', moved_back: { visits: 3 } }, error: null });
    await expect(undoMerge('m1')).resolves.toEqual({ visits: 3 });
    expect(db.rpc).toHaveBeenCalledWith('undo_patient_merge', { p_merge_id: 'm1' });
  });

  // Something new on the kept file (a visit booked since) makes the undo impossible: the administrator is told what
  it('tells what was added to the kept file when the undo is refused for that', async () => {
    db.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Records were added to the kept file since the merge', details: '{"visits": 1}', hint: 'merge_has_new_records' }
    });
    const refusal = await undoMerge('m1').catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(MergeHasNewRecordsError);
    expect((refusal as MergeHasNewRecordsError).added).toEqual({ visits: 1 });
  });
});

describe('loadRecordCounts', () => {
  it('asks for at most 400 files per call, each file once', async () => {
    db.rpc.mockImplementation(async (_name: string, args: { p_patient_ids: string[] }) => ({
      data: args.p_patient_ids.map(id => ({ patient_id: id, visits: 2, invoices: 1, claims: 0 })),
      error: null
    }));
    const ids = Array.from({ length: 401 }, (_, index) => `p${index}`);
    const counts = await loadRecordCounts([...ids, 'p0']);
    expect(db.rpc).toHaveBeenCalledTimes(2);
    expect(db.rpc.mock.calls[0][1].p_patient_ids).toHaveLength(400);
    expect(counts.get('p400')).toEqual({ visits: 2, invoices: 1, claims: 0 });
  });
});

describe('loadPracticeFiles', () => {
  // A practice with more files than one page must have every file compared, or a duplicate on page 2 is missed
  it("reads every file of the practice a page at a time, and only that practice's", async () => {
    db.rows = call => (call.range?.[0] === 0 ? Array.from({ length: 1000 }, (_, index) => ({ id: `p${index}` })) : [{ id: 'last' }]);
    const files = await loadPracticeFiles('practice-1');
    expect(files).toHaveLength(1001);
    expect(db.calls.map(call => call.range)).toEqual([[0, 999], [1000, 1999]]);
    for (const call of db.calls) expect(call.filters).toContainEqual(['eq', 'practice_id', 'practice-1']);
  });
});

describe('loadMergeHistory', () => {
  it("shows the archived file's name from the record, the kept file and the colleague by name", async () => {
    db.rows = call => {
      if (call.table === 'patient_merges') {
        return [{
          id: 'm1', kept_patient_id: 'keep-1', merged_file: { first_name: 'Ndapewa', last_name: 'Shilongo', reference: 77 },
          moved: { visits: 3 }, left_with_archived: {}, merged_by: 'admin-1', merged_at: '2026-10-09T10:00:00Z', undone_by: null, undone_at: null
        }];
      }
      if (call.table === 'patients') return [{ id: 'keep-1', first_name: 'Ndapewa', last_name: 'Shilongo-Nghifikwa', system_patient_reference_number: 12 }];
      return [{ id: 'admin-1', full_name: 'Invented Administrator' }];
    };
    const [record] = await loadMergeHistory('practice-1');
    expect(record).toMatchObject({
      mergedName: 'Ndapewa Shilongo', mergedReference: 77, keptName: 'Ndapewa Shilongo-Nghifikwa', keptReference: 12, mergedBy: 'Invented Administrator', undoneAt: null
    });
    expect(db.calls[0].filters).toContainEqual(['eq', 'practice_id', 'practice-1']);
  });

  it('says "not set up yet" while the merge record table is missing', async () => {
    db.error = { code: 'PGRST205', message: "Could not find the table 'public.patient_merges' in the schema cache" };
    await expect(loadMergeHistory('practice-1')).rejects.toBeInstanceOf(MergeNotSetUpError);
  });
});
