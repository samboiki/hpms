/**
 * A practitioner's private notes on a patient (patient_private_notes, proposals/2026-10-13-patient-file-extras.sql).
 * The database lets only the author read a note (row level security: no colleague, administrator or OneHealth support
 * login reads it), so the list is always the signed-in practitioner's own. Writing goes through save_private_note and
 * delete_private_note, which check the role (practitioners and nurses, as for clinical notes) and stamp the author.
 * Before the proposal is applied the notes are "not set up yet" and nothing else changes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingFunctionError, isMissingTableError } from '../utils/diary/dbErrors';

export const PRIVATE_NOTES_TABLE = 'patient_private_notes';
/** The database's limit (patient_private_notes.body) */
export const MAX_PRIVATE_NOTE = 4000;

export class PrivateNotesNotSetUpError extends Error {
  constructor() {
    super('Private notes are not set up in this database yet.');
    this.name = 'PrivateNotesNotSetUpError';
  }
}

export const isPrivateNotesNotSetUp = (error: unknown): boolean =>
  error instanceof PrivateNotesNotSetUpError ||
  isMissingTableError(error, PRIVATE_NOTES_TABLE) ||
  isMissingFunctionError(error, 'save_private_note') ||
  isMissingFunctionError(error, 'delete_private_note');

export interface PrivateNote {
  id: string;
  body: string;
  createdAt: string;
  /** Equal to createdAt until the note is changed */
  updatedAt: string;
}

type Row = Record<string, unknown>;

// The generated database types do not include this table or its functions yet
const db = supabase as unknown as SupabaseClient;

interface DbError {
  code?: string;
  message?: string;
}

/** The database's own words for its rules; anything else becomes the fallback. */
function fail(error: DbError, fallback: string): never {
  if (isPrivateNotesNotSetUp(error)) throw new PrivateNotesNotSetUpError();
  const plain = error.message && !/row-level security|permission denied/i.test(error.message);
  if ((error.code === '42501' || error.code === '22023' || error.code === 'P0002') && plain) throw new Error(error.message);
  if (error.code === '42501') throw new Error('Only practitioners and nurses keep private notes.');
  throw new Error(fallback);
}

/** Why a note cannot be saved, in the database's words; null when it can. */
export function privateNoteProblem(body: string): string | null {
  const length = body.trim().length;
  return length < 1 || length > MAX_PRIVATE_NOTE ? 'Write the note (up to 4,000 characters).' : null;
}

/** The signed-in practitioner's own notes on this patient, newest first (the database returns nobody else's). */
export async function loadPrivateNotes(patientId: string, authorId: string): Promise<PrivateNote[]> {
  const { data, error } = await db
    .from(PRIVATE_NOTES_TABLE)
    .select('id, body, created_at, updated_at')
    .eq('patient_id', patientId)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Could not load your private notes.');
  return ((data ?? []) as Row[]).map(row => ({
    id: String(row.id),
    body: String(row.body ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? row.created_at ?? '')
  }));
}

/** Writes a note (no id) or changes one of your own; returns its id. */
export async function savePrivateNote(patientId: string, noteId: string | null, body: string): Promise<string> {
  const { data, error } = await db.rpc('save_private_note', { p_patient_id: patientId, p_note_id: noteId, p_body: body });
  if (error) fail(error, 'Could not save the note. Please try again.');
  return String(data);
}

/** Removes one of your own notes. */
export async function deletePrivateNote(noteId: string): Promise<void> {
  const { error } = await db.rpc('delete_private_note', { p_note_id: noteId });
  if (error) fail(error, 'Could not remove the note. Please try again.');
}
