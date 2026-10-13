/**
 * Typed patient notes and their follow-ups (proposals/2026-10-08-patient-notes.sql). Reading goes through the tables,
 * where row level security shows each role only its kinds of note; writing goes through the three database
 * functions, which check the practice and the role and stamp who did what and when (never sent from here).
 *
 * Until that file is applied the tables and functions do not exist: every call then throws NotesNotSetUpError and the
 * screens say "not set up yet" instead of failing. The rules live in src/components/patients/notes/patientNotes.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingFunctionError, isMissingTableError } from '../utils/diary/dbErrors';
import { normalizeContactNote, type ContactNote, type RawContactNoteRow } from './ledger/creditControl';
import { headerFor, NOTE_TYPES, type DueFollowUp, type NoteAddendum, type NoteDraft, type NoteType, type PatientNote } from '../components/patients/notes/patientNotes';

const NOTE_TABLES = ['patient_notes', 'patient_note_addenda'] as const;
const NOTE_FUNCTIONS = ['patient_note_save', 'patient_note_follow_up_done', 'patient_note_add_addendum'] as const;

export class NotesNotSetUpError extends Error {
  constructor() {
    super('Patient notes are not set up in this database yet.');
    this.name = 'NotesNotSetUpError';
  }
}

export function isNotesNotSetUp(error: unknown): boolean {
  return (
    error instanceof NotesNotSetUpError ||
    NOTE_TABLES.some(table => isMissingTableError(error, table)) ||
    NOTE_FUNCTIONS.some(name => isMissingFunctionError(error, name))
  );
}

interface DbError {
  code?: string;
  message?: string;
}

/** Codes of the database's own plain-word refusals (wrong role, a locked note, a missing date...) */
const PLAIN_CODES = new Set(['22023', '23514', '42501', '55000', 'P0002']);

/** A message for the screen: the database's own words for its rules, otherwise the fallback. */
export function notesErrorMessage(error: unknown, fallback: string): string {
  if (isNotesNotSetUp(error)) return new NotesNotSetUpError().message;
  const { code, message } = (error && typeof error === 'object' ? error : {}) as DbError;
  if (code && PLAIN_CODES.has(code) && message && !/row-level security|permission denied/i.test(message)) return message;
  if (code === '42501') return 'Your account may not do this.';
  return fallback;
}

const fail = (error: DbError, fallback: string): never => {
  if (isNotesNotSetUp(error)) throw new NotesNotSetUpError();
  const failure = new Error(notesErrorMessage(error, fallback)) as Error & { code?: string };
  failure.code = error.code;
  throw failure;
};

// The generated database types do not include these tables and functions yet, so rows are read with the untyped
// client and normalised below (same approach as patientSafetyService.ts)
const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const isNoteType = (value: unknown): value is NoteType => NOTE_TYPES.includes(value as NoteType);

const NOTE_COLUMNS =
  'id, patient_id, note_type, header, body, follow_up_on, follow_up_user_id, follow_up_done_at, follow_up_done_by, ' +
  'locked_at, locked_by, created_by, created_at, edited_by, edited_at, ' +
  'addenda:patient_note_addenda(id, body, created_by, created_at)';

function toAddendum(row: Row): NoteAddendum {
  return { id: String(row.id), body: String(row.body ?? ''), createdBy: text(row.created_by), createdAt: String(row.created_at ?? '') };
}

/** A database row as the screens use it; null for a kind of note this app does not know. */
export function toPatientNote(row: Row): PatientNote | null {
  if (!isNoteType(row.note_type)) return null;
  const addenda = Array.isArray(row.addenda) ? (row.addenda as Row[]).map(toAddendum) : [];
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    type: row.note_type,
    header: String(row.header ?? ''),
    body: String(row.body ?? ''),
    followUpOn: text(row.follow_up_on),
    followUpUserId: text(row.follow_up_user_id),
    followUpDoneAt: text(row.follow_up_done_at),
    followUpDoneBy: text(row.follow_up_done_by),
    lockedAt: text(row.locked_at),
    lockedBy: text(row.locked_by),
    createdBy: text(row.created_by),
    createdAt: String(row.created_at ?? ''),
    editedBy: text(row.edited_by),
    editedAt: text(row.edited_at),
    addenda: addenda.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  };
}

/** The notes on one patient file that the signed-in user may see (row level security decides), newest first. */
export async function loadPatientNotes(patientId: string): Promise<PatientNote[]> {
  const { data, error } = await db
    .from('patient_notes')
    .select(NOTE_COLUMNS)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) fail(error, 'Could not load the notes.');
  return ((data ?? []) as unknown as Row[]).map(toPatientNote).filter((note): note is PatientNote => note !== null);
}

/**
 * The credit-control contact notes kept on this patient's file (Billing > Promises and notes), read-only here. Before
 * the debtors proposal is applied there are none to show.
 */
export async function loadCreditControlNotes(practiceId: string, patientId: string): Promise<ContactNote[]> {
  const { data, error } = await db
    .from('credit_control_notes')
    .select('id, patient_id, channel, note, created_by, created_at')
    .eq('practice_id', practiceId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    if (isMissingTableError(error, 'credit_control_notes')) return [];
    throw new Error('Could not load the credit-control notes.');
  }
  return ((data ?? []) as RawContactNoteRow[]).map(normalizeContactNote).filter((note): note is ContactNote => note !== null);
}

/** The arguments of patient_note_save, by the names the database function has (PostgREST matches them by name). */
export function saveNoteArgs(params: { noteId: string | null; patientId: string; draft: NoteDraft }): Record<string, unknown> {
  const { noteId, patientId, draft } = params;
  const followUpOn = draft.followUpOn || null;
  return {
    p_note_id: noteId,
    p_patient_id: patientId,
    p_note_type: draft.type,
    p_header: headerFor(draft.header, draft.body),
    p_body: draft.body.trim(),
    p_follow_up_on: followUpOn,
    p_follow_up_user_id: followUpOn ? draft.followUpUserId : null,
    p_lock: draft.lock
  };
}

/** Writes a new note (noteId null) or changes one; returns its id. */
export async function saveNote(params: { noteId: string | null; patientId: string; draft: NoteDraft }): Promise<string> {
  const { data, error } = await db.rpc('patient_note_save', saveNoteArgs(params));
  if (error) fail(error, 'Could not save the note.');
  return String(data);
}

/**
 * Sets, moves or clears a note's follow-up without touching what it says (also on a locked note): the stored kind,
 * header and text are sent back exactly as they are, so the database sees no change to a locked note.
 */
export async function changeFollowUp(note: PatientNote, followUpOn: string | null, followUpUserId: string | null): Promise<void> {
  const { error } = await db.rpc('patient_note_save', {
    p_note_id: note.id,
    p_patient_id: note.patientId,
    p_note_type: note.type,
    p_header: note.header,
    p_body: note.body,
    p_follow_up_on: followUpOn,
    p_follow_up_user_id: followUpOn ? followUpUserId : null,
    p_lock: note.lockedAt !== null
  });
  if (error) fail(error, 'Could not change the follow-up.');
}

/** Marks a note's follow-up done (true) or open again (false). */
export async function setFollowUpDone(noteId: string, done: boolean): Promise<void> {
  const { error } = await db.rpc('patient_note_follow_up_done', { p_note_id: noteId, p_done: done });
  if (error) fail(error, done ? 'Could not mark the follow-up done.' : 'Could not open the follow-up again.');
}

/** Adds a dated addendum under a note (how a locked note is changed). */
export async function addAddendum(noteId: string, body: string): Promise<void> {
  const { error } = await db.rpc('patient_note_add_addendum', { p_note_id: noteId, p_body: body.trim() });
  if (error) fail(error, 'Could not add the addendum.');
}

interface DueRow {
  id: string;
  patient_id: string;
  note_type: string;
  header: string | null;
  follow_up_on: string | null;
  follow_up_user_id: string | null;
  patient?: { first_name?: string | null; last_name?: string | null } | Array<{ first_name?: string | null; last_name?: string | null }> | null;
}

/**
 * The practice's open follow-ups due on or before `todayKey` that the signed-in user may see (their kinds of note;
 * row level security decides), with the patient's name.
 */
export async function loadFollowUpsDue(practiceId: string, todayKey: string): Promise<DueFollowUp[]> {
  const { data, error } = await db
    .from('patient_notes')
    .select('id, patient_id, note_type, header, follow_up_on, follow_up_user_id, patient:patients!patient_notes_patient_id_fkey(first_name, last_name)')
    .eq('practice_id', practiceId)
    .lte('follow_up_on', todayKey)
    .is('follow_up_done_at', null)
    .order('follow_up_on', { ascending: true })
    .limit(300);
  if (error) fail(error, 'Could not load the follow-ups.');
  return ((data ?? []) as unknown as DueRow[]).flatMap(row => {
    if (!isNoteType(row.note_type) || !row.follow_up_on) return [];
    const patient = Array.isArray(row.patient) ? row.patient[0] : row.patient;
    const patientName = [patient?.first_name, patient?.last_name].map(part => (part ?? '').trim()).filter(Boolean).join(' ');
    return [{
      noteId: row.id,
      patientId: row.patient_id,
      patientName: patientName || 'Patient',
      type: row.note_type,
      header: row.header ?? '',
      followUpOn: row.follow_up_on,
      followUpUserId: row.follow_up_user_id
    }];
  });
}

export const patientNotesService = {
  loadPatientNotes,
  loadCreditControlNotes,
  saveNote,
  changeFollowUp,
  setFollowUpDone,
  addAddendum,
  loadFollowUpsDue
};
