import React, { useCallback, useEffect, useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';
import { loadPracticeStaff } from '../../../services/invoiceContextService';
import {
  MAX_PRIVATE_NOTE,
  PrivateNotesNotSetUpError,
  deletePrivateNote,
  loadPrivateNotes,
  privateNoteProblem,
  savePrivateNote,
  type PrivateNote
} from '../../../services/privateNotesService';
import { noteTypesFor } from '../notes/patientNotes';
import { formatSafetyDate } from '../safety/safetyFormat';
import { INPUT, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../../patientLists/listStyles';

interface PrivateNotesPanelProps {
  practiceId: string;
  patientId: string;
}

type State = { status: 'loading' } | { status: 'not_set_up' } | { status: 'error'; message: string } | { status: 'ready'; notes: PrivateNote[] };

/** The newest notes show at once; the rest are one tap away */
const PREVIEW_COUNT = 3;

/**
 * "My private notes" on the patient file's Overview: a practitioner's own notes on the patient, which only they read
 * (the database enforces it: no colleague, administrator or OneHealth support login reads them, and record exports
 * leave them out unless the practitioner exports their own). Practitioners and nurses write them, as clinical notes;
 * for anyone else with none of their own the panel is not shown.
 */
export const PrivateNotesPanel: React.FC<PrivateNotesPanelProps> = ({ practiceId, patientId }) => {
  const user = useAuthStore(store => store.user);
  const userId = user?.id ?? null;
  const [clinical, setClinical] = useState<boolean | null>(null);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const id = useId();

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setState({ status: 'ready', notes: await loadPrivateNotes(patientId, userId) });
    } catch (error) {
      setState(error instanceof PrivateNotesNotSetUpError ? { status: 'not_set_up' } : { status: 'error', message: error instanceof Error ? error.message : 'Could not load your private notes.' });
    }
  }, [patientId, userId]);

  useEffect(() => {
    setState({ status: 'loading' });
    setAdding(false);
    setEditingId(null);
    setShowAll(false);
    void load();
  }, [load]);

  // Whether the signed-in person writes clinical notes (role, or a practitioner registration number): fails closed
  useEffect(() => {
    let cancelled = false;
    loadPracticeStaff(practiceId).then(
      staff => {
        if (cancelled) return;
        const me = staff.find(member => member.id === userId);
        const role = me?.role ?? user?.role ?? null;
        setClinical(noteTypesFor(role ? { role, is_active: me?.is_active ?? true, hpcsa_number: me?.hpcsa_number ?? null } : null).includes('clinical'));
      },
      () => {
        if (!cancelled) setClinical(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [practiceId, userId, user?.role]);

  const notes = state.status === 'ready' ? state.notes : [];
  // Shown to practitioners and nurses, and to anyone who still has notes of their own (written before a role change)
  if (!userId || clinical === null || state.status === 'loading') return null;
  if (!clinical && notes.length === 0) return null;

  const add = async () => {
    const problem = privateNoteProblem(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      await savePrivateNote(patientId, null, draft);
      setDraft('');
      setAdding(false);
      toast.success('Private note saved. Only you can read it.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the note.');
    } finally {
      setBusy(false);
    }
  };

  const change = async (noteId: string) => {
    const problem = privateNoteProblem(editText);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      await savePrivateNote(patientId, noteId, editText);
      setEditingId(null);
      toast.success('Private note changed.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change the note.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (noteId: string) => {
    if (!window.confirm('Delete this private note? It cannot be brought back.')) return;
    setBusy(true);
    try {
      await deletePrivateNote(noteId);
      toast.success('Private note deleted.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the note.');
    } finally {
      setBusy(false);
    }
  };

  const headingId = `${id}-heading`;
  const shown = showAll ? notes : notes.slice(0, PREVIEW_COUNT);

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
            <Icon icon="solar:lock-keyhole-bold-duotone" className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id={headingId} className="text-base font-semibold text-gray-900">
              My private notes
            </h3>
            <p className="text-sm text-gray-500">Only you can read these: not colleagues, administrators or record exports.</p>
          </div>
        </div>
        {clinical && state.status === 'ready' && !adding && (
          <button type="button" className={PRIMARY_BUTTON} onClick={() => setAdding(true)}>
            <Icon icon="solar:add-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
            Add private note
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {state.status === 'not_set_up' && <p className="text-sm text-gray-500">Private notes are not set up in this database yet.</p>}
        {state.status === 'error' && (
          <p className="text-sm text-red-700" role="alert">
            {state.message}{' '}
            <button type="button" className="font-medium underline" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}

        {adding && (
          <form
            className="space-y-2"
            onSubmit={event => {
              event.preventDefault();
              void add();
            }}
          >
            <label htmlFor={`${id}-new`} className="sr-only">
              New private note
            </label>
            <textarea
              id={`${id}-new`}
              className={`${INPUT} min-h-[5rem]`}
              maxLength={MAX_PRIVATE_NOTE}
              placeholder="Only you will see this note."
              value={draft}
              onChange={event => setDraft(event.target.value)}
              autoFocus
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-500">
                {draft.length} of {MAX_PRIVATE_NOTE.toLocaleString('en-ZA')} characters
              </span>
              <div className="flex gap-2">
                <button type="button" className={SECONDARY_BUTTON} onClick={() => setAdding(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className={PRIMARY_BUTTON} disabled={busy || !draft.trim()}>
                  {busy ? 'Saving...' : 'Save note'}
                </button>
              </div>
            </div>
          </form>
        )}

        {state.status === 'ready' && notes.length === 0 && !adding && (
          <p className="text-sm text-gray-500">No private notes yet. Keep reminders and impressions here that are for you alone.</p>
        )}

        {shown.length > 0 && (
          <ul className="space-y-2">
            {shown.map(note => (
              <li key={note.id} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                {editingId === note.id ? (
                  <form
                    className="space-y-2"
                    onSubmit={event => {
                      event.preventDefault();
                      void change(note.id);
                    }}
                  >
                    <label htmlFor={`${id}-edit-${note.id}`} className="sr-only">
                      Change the private note
                    </label>
                    <textarea
                      id={`${id}-edit-${note.id}`}
                      className={`${INPUT} min-h-[5rem]`}
                      maxLength={MAX_PRIVATE_NOTE}
                      value={editText}
                      onChange={event => setEditText(event.target.value)}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditingId(null)} disabled={busy}>
                        Cancel
                      </button>
                      <button type="submit" className={PRIMARY_BUTTON} disabled={busy || !editText.trim()}>
                        {busy ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-900">{note.body}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-gray-500">
                        {[
                          `Written ${formatSafetyDate(note.createdAt) ?? ''}`.trim(),
                          note.updatedAt && note.updatedAt !== note.createdAt ? `changed ${formatSafetyDate(note.updatedAt) ?? ''}`.trim() : null
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      <div className="flex gap-1">
                        {clinical && (
                          <button
                            type="button"
                            className={QUIET_BUTTON}
                            disabled={busy}
                            onClick={() => {
                              setEditingId(note.id);
                              setEditText(note.body);
                            }}
                          >
                            <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                            Change
                          </button>
                        )}
                        <button type="button" className={QUIET_BUTTON} disabled={busy} onClick={() => void remove(note.id)}>
                          <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {notes.length > PREVIEW_COUNT && (
          <button type="button" className={QUIET_BUTTON} aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>
            <Icon icon="solar:alt-arrow-down-bold-duotone" className={`h-4 w-4 motion-safe:transition-transform ${showAll ? 'rotate-180' : ''}`} aria-hidden="true" />
            {showAll ? 'Show fewer' : `Show all ${notes.length}`}
          </button>
        )}
      </div>
    </section>
  );
};

export default PrivateNotesPanel;
