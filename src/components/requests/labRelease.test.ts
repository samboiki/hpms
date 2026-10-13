import { describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }));

import { releaseState, setLabResultsRelease } from './labRelease';

describe('"Release to patient" on the lab results screen', () => {
  it('stays hidden until the patient app database change is applied', () => {
    // Rows without the release column come from a database without the patient app
    expect(releaseState([{ id: 'a' }, { id: 'b' }])).toEqual({ kind: 'unavailable' });
    expect(releaseState([])).toEqual({ kind: 'unavailable' });
  });

  it('shows results as not shared until a doctor releases them', () => {
    expect(releaseState([{ id: 'a', released_to_patient: false }, { id: 'b', released_to_patient: false }])).toEqual({ kind: 'none', total: 2 });
    expect(releaseState([{ id: 'a', released_to_patient: true }])).toEqual({ kind: 'all', total: 1 });
  });

  it('flags results added or changed after release: the patient does not see them until released again', () => {
    expect(releaseState([{ id: 'a', released_to_patient: true }, { id: 'b', released_to_patient: false }])).toEqual({
      kind: 'partly',
      total: 2,
      released: 1,
    });
  });

  it('explains a refusal for staff who may not release (only doctors and administrators)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(setLabResultsRelease('req-1', true)).resolves.toEqual({
      ok: false,
      message: 'Only a doctor or a practice administrator can release results to the patient.',
    });
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    await expect(setLabResultsRelease('req-1', true)).resolves.toEqual({ ok: true, changed: 3 });
    expect(rpc).toHaveBeenLastCalledWith('release_lab_results_to_patient', { p_lab_request_id: 'req-1', p_release: true });
  });
});
