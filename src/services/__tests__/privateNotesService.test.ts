import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  calls: [] as Array<{ method: string; args: unknown[] }>,
  result: { data: null as unknown, error: null as unknown },
  rpc: vi.fn()
}));
vi.mock('../../lib/supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['from', 'select', 'eq', 'order']) {
    builder[method] = (...args: unknown[]) => {
      state.calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(state.result).then(resolve, reject);
  builder.rpc = (...args: unknown[]) => state.rpc(...args);
  return { supabase: builder };
});

import { PrivateNotesNotSetUpError, deletePrivateNote, loadPrivateNotes, privateNoteProblem, savePrivateNote } from '../privateNotesService';

beforeEach(() => {
  state.calls = [];
  state.result = { data: null, error: null };
  state.rpc.mockReset();
});

describe('private practitioner notes', () => {
  it("asks only for the signed-in practitioner's own notes, on top of the database's own rule", async () => {
    state.result = { data: [{ id: 'n1', body: 'Invented', created_at: '2026-10-13T08:00:00Z', updated_at: '2026-10-13T08:00:00Z' }], error: null };
    await expect(loadPrivateNotes('patient-1', 'user-1')).resolves.toEqual([
      { id: 'n1', body: 'Invented', createdAt: '2026-10-13T08:00:00Z', updatedAt: '2026-10-13T08:00:00Z' }
    ]);
    expect(state.calls).toContainEqual({ method: 'eq', args: ['author_id', 'user-1'] });
  });

  it('says "not set up yet" before the notes exist, instead of an error on the file', async () => {
    state.result = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.patient_private_notes'" } };
    await expect(loadPrivateNotes('patient-1', 'user-1')).rejects.toBeInstanceOf(PrivateNotesNotSetUpError);
  });

  it("passes on the database's plain words (wrong role, not the author), never its technical ones", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only practitioners and nurses keep private notes.' } });
    await expect(savePrivateNote('patient-1', null, 'x')).rejects.toThrow('Only practitioners and nurses keep private notes.');
    state.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for function save_private_note' } });
    await expect(savePrivateNote('patient-1', null, 'x')).rejects.toThrow('Only practitioners and nurses keep private notes.');
    state.rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'This private note was not found: only the practitioner who wrote it can remove it.' } });
    await expect(deletePrivateNote('note-1')).rejects.toThrow(/only the practitioner who wrote it/);
  });

  it('writes through the function that stamps the author, never with an author sent from the screen', async () => {
    state.rpc.mockResolvedValue({ data: 'note-9', error: null });
    await expect(savePrivateNote('patient-1', null, 'Invented note')).resolves.toBe('note-9');
    expect(state.rpc).toHaveBeenCalledWith('save_private_note', { p_patient_id: 'patient-1', p_note_id: null, p_body: 'Invented note' });
  });

  it('checks the length the database allows before saving', () => {
    expect(privateNoteProblem('   ')).toBe('Write the note (up to 4,000 characters).');
    expect(privateNoteProblem('x'.repeat(4001))).toBe('Write the note (up to 4,000 characters).');
    expect(privateNoteProblem('A reminder')).toBeNull();
  });
});
