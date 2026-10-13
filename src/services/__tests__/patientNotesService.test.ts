import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

// No database in unit tests
vi.mock('../../lib/supabase', () => ({ supabase: { from: fromMock, rpc: rpcMock } }));

import { changeFollowUp, isNotesNotSetUp, notesErrorMessage, saveNote, saveNoteArgs, toPatientNote } from '../patientNotesService';
import type { NoteDraft, PatientNote } from '../../components/patients/notes/patientNotes';

const SQL = readFileSync('proposals/2026-10-08-patient-notes.sql', 'utf8');

/** The parameter names of a function in the proposal, in order */
function sqlParams(name: string): string[] {
  const signature = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(([^)]*)\\)`).exec(SQL);
  expect(signature).not.toBeNull();
  return (signature?.[1] ?? '').split(',').map(part => part.trim().split(/\s+/)[0]).filter(Boolean);
}

const draft: NoteDraft = { type: 'account', header: '', body: '  Agreed to pay N$ 200 a month  ', followUpOn: '2026-10-20', followUpUserId: 'u1', lock: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saving goes to the database function under the names it expects', () => {
  // PostgREST finds a function by its argument names: one renamed argument and every save fails in the practice
  it('sends exactly the arguments of patient_note_save', () => {
    expect(Object.keys(saveNoteArgs({ noteId: null, patientId: 'p1', draft })).sort()).toEqual(sqlParams('patient_note_save').sort());
  });

  // A note typed without a header gets one, and no one is asked to follow up a note without a day
  it('fills the header from the note and drops a follow-up person without a day', () => {
    expect(saveNoteArgs({ noteId: null, patientId: 'p1', draft })).toMatchObject({
      p_header: 'Agreed to pay N$ 200 a month',
      p_body: 'Agreed to pay N$ 200 a month',
      p_follow_up_on: '2026-10-20',
      p_follow_up_user_id: 'u1',
      p_lock: true
    });
    expect(saveNoteArgs({ noteId: 'n1', patientId: 'p1', draft: { ...draft, followUpOn: '' } })).toMatchObject({ p_follow_up_on: null, p_follow_up_user_id: null });
  });

  // Moving the follow-up of a locked note must send its text back unchanged, or the database refuses it as a change
  it('moves a follow-up with the note exactly as stored', async () => {
    rpcMock.mockResolvedValue({ data: 'n1', error: null });
    const stored: PatientNote = {
      id: 'n1', patientId: 'p1', type: 'clinical', header: 'Results', body: 'Line one\n\nLine two', followUpOn: '2026-10-09', followUpUserId: 'u1',
      followUpDoneAt: null, followUpDoneBy: null, lockedAt: '2026-10-08T10:00:00Z', lockedBy: 'u1', createdBy: 'u1', createdAt: '2026-10-08T10:00:00Z',
      editedBy: null, editedAt: null, addenda: []
    };
    await changeFollowUp(stored, '2026-10-15', null);
    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe('patient_note_save');
    expect(Object.keys(args).sort()).toEqual(sqlParams('patient_note_save').sort());
    expect(args).toMatchObject({ p_header: 'Results', p_body: 'Line one\n\nLine two', p_note_type: 'clinical', p_lock: true, p_follow_up_on: '2026-10-15', p_follow_up_user_id: null });
  });

  // The other two functions are called by name too
  it('uses the argument names of the follow-up and addendum functions', () => {
    expect(sqlParams('patient_note_follow_up_done')).toEqual(['p_note_id', 'p_done']);
    expect(sqlParams('patient_note_add_addendum')).toEqual(['p_note_id', 'p_body']);
    const service = readFileSync('src/services/patientNotesService.ts', 'utf8');
    expect(service).toContain("rpc('patient_note_follow_up_done', { p_note_id: noteId, p_done: done })");
    expect(service).toContain("rpc('patient_note_add_addendum', { p_note_id: noteId, p_body: body.trim() })");
  });
});

describe('what staff are told when the database says no', () => {
  // The database explains its own rules in plain words: those reach the screen as they are
  it('passes the database\'s own words through', () => {
    expect(notesErrorMessage({ code: '55000', message: 'This note is locked, so it cannot be changed. Add an addendum instead.' }, 'fallback'))
      .toBe('This note is locked, so it cannot be changed. Add an addendum instead.');
    expect(notesErrorMessage({ code: '42501', message: 'Only practitioners and nurses can write clinical notes.' }, 'fallback'))
      .toBe('Only practitioners and nurses can write clinical notes.');
  });

  // Technical refusals ("permission denied for table") mean nothing to a receptionist
  it('replaces technical refusals and unknown errors', () => {
    expect(notesErrorMessage({ code: '42501', message: 'permission denied for table patient_notes' }, 'fallback')).toBe('Your account may not do this.');
    expect(notesErrorMessage({ code: '08006', message: 'connection failure' }, 'Could not save the note.')).toBe('Could not save the note.');
  });

  // Before the proposal is applied the Notes section says so, instead of showing an error on every patient file
  it('recognises a database without the notes tables or functions', async () => {
    expect(isNotesNotSetUp({ code: 'PGRST205', message: "Could not find the table 'public.patient_notes' in the schema cache" })).toBe(true);
    expect(isNotesNotSetUp({ code: 'PGRST202', message: 'Could not find the function public.patient_note_save' })).toBe(true);
    expect(isNotesNotSetUp({ code: '42P01', message: 'relation "public.visits" does not exist' })).toBe(false);
    rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.patient_note_save' } });
    await expect(saveNote({ noteId: null, patientId: 'p1', draft })).rejects.toThrow('Patient notes are not set up in this database yet.');
  });
});

describe('reading notes', () => {
  // A kind of note this version of the app does not know is left out rather than shown as the wrong kind
  it('skips unknown kinds and puts addenda oldest first', () => {
    expect(toPatientNote({ id: 'x', patient_id: 'p', note_type: 'secret', header: 'h', body: 'b', created_at: '2026-10-09T00:00:00Z' })).toBeNull();
    const read = toPatientNote({
      id: 'n', patient_id: 'p', note_type: 'general', header: 'h', body: 'b', created_at: '2026-10-09T00:00:00Z',
      addenda: [
        { id: 'a2', body: 'second', created_by: 'u', created_at: '2026-10-09T10:00:00+00:00' },
        { id: 'a1', body: 'first', created_by: 'u', created_at: '2026-10-09T09:00:00+00:00' }
      ]
    });
    expect(read?.addenda.map(item => item.id)).toEqual(['a1', 'a2']);
    expect(read?.lockedAt).toBeNull();
  });
});
