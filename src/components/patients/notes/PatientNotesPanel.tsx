import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';
import { loadPracticeStaff } from '../../../services/invoiceContextService';
import { isNotesNotSetUp, loadCreditControlNotes, loadPatientNotes, notesErrorMessage, saveNote } from '../../../services/patientNotesService';
import type { ContactNote } from '../../../services/ledger/creditControl';
import type { StaffMember } from '../../../utils/billing/invoiceRights';
import { windhoekClock } from '../../../utils/patientLists/listDates';
import { PRIMARY_BUTTON, QUIET_BUTTON } from '../../patientLists/listStyles';
import {
  NOTE_TYPES,
  NOTE_TYPE_LABELS,
  buildNoteList,
  noteCounts,
  noteElementId,
  noteTypesFor,
  type NoteDraft,
  type NoteFilter,
  type PatientNote
} from './patientNotes';
import { NoteForm } from './NoteForm';
import { CreditControlNoteItem, NoteCard } from './NoteCard';

/** The newest notes show at once; the rest are one tap away */
const PREVIEW_COUNT = 3;
/** How long a note opened from a link stays outlined */
const HIGHLIGHT_MS = 4000;

interface PatientNotesPanelProps {
  practiceId: string;
  patientId: string;
  /** A note of this patient to bring into view (a link to it, e.g. from the dashboard's follow-ups) */
  focusNoteId?: string | null;
  /** Opens Billing at the account, where credit-control notes are kept (Promises and notes) */
  onOpenAccount: () => void;
  /** Opens Encounters, where each visit keeps its own notes */
  onOpenEncounters: () => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'not_set_up' }
  | { status: 'error'; message: string }
  | { status: 'ready'; notes: PatientNote[]; creditNotes: ContactNote[]; creditFailed: boolean };

/**
 * Notes on the patient file: typed notes (clinical, account, call or SMS, general) newest first with a filter, each
 * with who wrote it and when, its follow-up and its addenda; the credit-control notes beside the account notes,
 * read-only. Each person sees the kinds of note their role allows (the database decides the same).
 */
export const PatientNotesPanel: React.FC<PatientNotesPanelProps> = ({ practiceId, patientId, focusNoteId = null, onOpenAccount, onOpenEncounters }) => {
  const user = useAuthStore(state => state.user);
  const myUserId = user?.id ?? null;
  const role = user?.role ?? null;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  // The signed-in person's registration number counts too: an owner-practitioner is often the administrator
  const myNumber = staff.find(member => member.id === myUserId)?.hpcsa_number ?? null;
  const visible = useMemo(() => noteTypesFor(role ? { role, is_active: true, hpcsa_number: myNumber } : null), [role, myNumber]);
  const seesAccount = visible.includes('account');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [focusMissing, setFocusMissing] = useState(false);
  const handledFocus = useRef<string | null>(null);
  const latestLoad = useRef(0);
  const todayKey = windhoekClock(new Date()).dateKey;
  const headingId = `patient-notes-${patientId}`;

  const load = useCallback(async () => {
    // Only the latest answer counts: a slow one for the previous patient must never show on this file
    const request = ++latestLoad.current;
    try {
      const [notes, credit] = await Promise.all([
        loadPatientNotes(patientId),
        seesAccount
          ? loadCreditControlNotes(practiceId, patientId).then(
              list => ({ list, failed: false }),
              () => ({ list: [] as ContactNote[], failed: true })
            )
          : Promise.resolve({ list: [] as ContactNote[], failed: false })
      ]);
      if (request !== latestLoad.current) return;
      setState({ status: 'ready', notes, creditNotes: credit.list, creditFailed: credit.failed });
    } catch (error) {
      if (request !== latestLoad.current) return;
      setState(isNotesNotSetUp(error) ? { status: 'not_set_up' } : { status: 'error', message: notesErrorMessage(error, 'Could not load the notes.') });
    }
  }, [practiceId, patientId, seesAccount]);

  // Another patient: start from the top
  useEffect(() => {
    setState({ status: 'loading' });
    setFilter('all');
    setShowAll(false);
    setAdding(false);
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setStaffLoaded(false);
    // Names of who wrote, changed and follows up, and who is a registered practitioner; without them the notes still
    // show ("A former staff member") and clinical notes stay hidden (fails closed)
    loadPracticeStaff(practiceId).then(
      list => {
        if (cancelled) return;
        setStaff(list);
        setStaffLoaded(true);
      },
      () => {
        if (cancelled) return;
        setStaff([]);
        setStaffLoaded(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [practiceId]);
  const staffById = useMemo(() => new Map(staff.map(member => [member.id, member])), [staff]);

  // Opened at a note: show every note, then bring that one into view and outline it for a moment
  useEffect(() => {
    if (!focusNoteId || state.status !== 'ready' || !staffLoaded || handledFocus.current === focusNoteId) return;
    handledFocus.current = focusNoteId;
    const found = state.notes.some(note => note.id === focusNoteId && visible.includes(note.type));
    setFocusMissing(!found);
    if (!found) return;
    setFilter('all');
    setShowAll(true);
    setHighlightId(focusNoteId);
  }, [focusNoteId, state, staffLoaded, visible]);

  useEffect(() => {
    if (!highlightId) return;
    const element = document.getElementById(noteElementId(highlightId));
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    element?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  const addNote = async (draft: NoteDraft) => {
    try {
      await saveNote({ noteId: null, patientId, draft });
      setAdding(false);
      setFilter('all');
      toast.success('Note saved.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not save the note.');
    }
  };

  // Shown once the staff are known too, so a practitioner's clinical notes never flash missing
  const ready = state.status === 'ready' && staffLoaded ? state : null;
  const counts = ready ? noteCounts(ready.notes, ready.creditNotes, visible) : null;
  const items = ready ? buildNoteList(ready.notes, ready.creditNotes, filter, visible) : [];
  const shown = showAll ? items : items.slice(0, PREVIEW_COUNT);
  const filters = counts ? NOTE_TYPES.filter(type => visible.includes(type) && counts[type] > 0) : [];
  const canWrite = visible.length > 0 && state.status !== 'not_set_up';

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
            <Icon icon="solar:notebook-bold-duotone" className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 id={headingId} className="text-base font-semibold text-gray-900">
            Notes{counts && counts.all > 0 ? ` (${counts.all})` : ''}
          </h3>
        </div>
        {canWrite && ready && !adding && (
          <button type="button" className={PRIMARY_BUTTON} onClick={() => setAdding(true)}>
            <Icon icon="solar:add-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
            Add note
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {(state.status === 'loading' || (state.status === 'ready' && !staffLoaded)) && <p className="text-sm text-gray-500">Loading notes...</p>}
        {state.status === 'not_set_up' && <p className="text-sm text-gray-500">Patient notes are not set up in this database yet.</p>}
        {state.status === 'error' && (
          <p className="text-sm text-red-700" role="alert">
            {state.message}{' '}
            <button type="button" className="font-medium underline" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
        {ready && visible.length === 0 && <p className="text-sm text-gray-500">Your role cannot read patient notes.</p>}

        {focusMissing && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
            The note you opened is not on this list: it may be a kind of note your role does not see.
          </p>
        )}

        {adding && ready && (
          <NoteForm allowed={visible} staff={staff} myUserId={myUserId} todayKey={todayKey} onCancel={() => setAdding(false)} onSave={addNote} />
        )}

        {ready && filters.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show notes">
            {(['all', ...filters] as NoteFilter[]).map(option => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  filter === option ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {option === 'all' ? 'All' : NOTE_TYPE_LABELS[option]} ({counts ? counts[option] : 0})
              </button>
            ))}
          </div>
        )}

        {ready && visible.length > 0 && items.length === 0 && !adding && (
          <p className="text-sm text-gray-500">No notes yet. Add one for anything the next person should know: a call, a payment arrangement, a preference.</p>
        )}

        {shown.length > 0 && (
          <ul className="space-y-2">
            {shown.map(item =>
              item.kind === 'note' ? (
                <NoteCard
                  key={item.id}
                  note={item.note}
                  visible={visible}
                  staff={staff}
                  staffById={staffById}
                  myUserId={myUserId}
                  todayKey={todayKey}
                  highlighted={highlightId === item.note.id}
                  onChanged={load}
                />
              ) : (
                <CreditControlNoteItem key={item.id} note={item.note} staffById={staffById} myUserId={myUserId} onOpenAccount={onOpenAccount} />
              )
            )}
          </ul>
        )}

        {items.length > PREVIEW_COUNT && (
          <button type="button" className={QUIET_BUTTON} aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>
            <Icon icon="solar:alt-arrow-down-bold-duotone" className={`h-4 w-4 motion-safe:transition-transform ${showAll ? 'rotate-180' : ''}`} aria-hidden="true" />
            {showAll ? 'Show fewer' : `Show all ${items.length} notes`}
          </button>
        )}

        {ready?.creditFailed && <p className="text-xs text-amber-700">The credit-control notes could not be loaded, so this list may be incomplete.</p>}

        {ready && (
          <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">
            Visit notes stay with each visit in{' '}
            <button type="button" className="font-medium text-purple-700 hover:underline" onClick={onOpenEncounters}>
              Encounters
            </button>
            ; the clinical alert shows under the patient&apos;s name.
          </p>
        )}
      </div>
    </section>
  );
};

export default PatientNotesPanel;
