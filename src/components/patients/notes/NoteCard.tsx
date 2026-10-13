import React, { useEffect, useId, useRef, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { CHIP, INPUT, LABEL, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../../patientLists/listStyles';
import { formatAuditTime } from '../../billing/invoiceAudit';
import { formatServiceDate } from '../../../utils/billing/dates';
import { CONTACT_CHANNELS, type ContactNote } from '../../../services/ledger/creditControl';
import { addAddendum, changeFollowUp, saveNote, setFollowUpDone } from '../../../services/patientNotesService';
import {
  BODY_MAX,
  NOTE_TYPE_LABELS,
  canEditNote,
  defaultFollowUpPerson,
  followUpShortcuts,
  followUpStatus,
  noteDraftProblem,
  noteElementId,
  staffLabel,
  type NoteDraft,
  type NoteType,
  type PatientNote,
  type StaffLike
} from './patientNotes';
import { FOLLOW_UP_STYLE, NOTE_TYPE_STYLE } from './noteTypeStyle';
import { FollowUpFields, NoteForm } from './NoteForm';

/** Long notes show their start, with the rest one tap away */
const PREVIEW_CHARS = 400;

const TypeChip: React.FC<{ type: NoteType }> = ({ type }) => (
  <span className={`${CHIP} ${NOTE_TYPE_STYLE[type].chip}`}>
    <Icon icon={NOTE_TYPE_STYLE[type].icon} className="h-3.5 w-3.5" aria-hidden="true" />
    {NOTE_TYPE_LABELS[type]}
  </span>
);

const NoteText: React.FC<{ text: string }> = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > PREVIEW_CHARS;
  return (
    <div className="mt-1 text-sm text-gray-700">
      <p className="whitespace-pre-wrap break-words">{long && !expanded ? `${text.slice(0, PREVIEW_CHARS).trimEnd()}…` : text}</p>
      {long && (
        <button type="button" className="mt-0.5 text-xs font-medium text-purple-700 hover:underline" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

interface NoteCardProps {
  note: PatientNote;
  /** The kinds of note the signed-in user sees */
  visible: readonly NoteType[];
  staff: readonly StaffLike[];
  staffById: ReadonlyMap<string, StaffLike>;
  myUserId: string | null;
  todayKey: string;
  /** Opened from a link to this note (the dashboard's follow-ups): outlined for a moment */
  highlighted?: boolean;
  /** Reloads the notes after a change */
  onChanged: () => Promise<void>;
}

type Mode = 'view' | 'edit' | 'addendum' | 'follow-up';

/**
 * One note: its kind, header and text, who wrote it and when (and who changed or locked it), the follow-up with
 * "Done", the dated addenda, and what can still be done: change it until it is locked, then add an addendum.
 */
export const NoteCard: React.FC<NoteCardProps> = ({ note, visible, staff, staffById, myUserId, todayKey, highlighted = false, onChanged }) => {
  const baseId = useId();
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState(false);
  const [addendum, setAddendum] = useState('');
  const [followUp, setFollowUp] = useState(Boolean(note.followUpOn));
  const [day, setDay] = useState(note.followUpOn ?? '');
  const [who, setWho] = useState(note.followUpUserId ?? '');
  const addendumRef = useRef<HTMLTextAreaElement>(null);
  const name = (id: string | null) => staffLabel(id, staffById, myUserId);
  // Inside a sentence: "changed by you"
  const byName = (id: string | null) => {
    const label = name(id);
    return label === 'You' ? 'you' : label;
  };

  useEffect(() => {
    if (mode === 'addendum') addendumRef.current?.focus();
  }, [mode]);
  const status = followUpStatus(note, todayKey);
  const editable = canEditNote(note, visible);

  const run = async (action: () => Promise<void>, success: string): Promise<boolean> => {
    setBusy(true);
    try {
      await action();
      await onChanged();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'That did not work. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (draft: NoteDraft) => {
    if (await run(() => saveNote({ noteId: note.id, patientId: note.patientId, draft }).then(() => undefined), 'Note saved.')) setMode('view');
  };

  const saveAddendum = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = addendum.trim();
    if (!text) {
      toast.error('Write the addendum first.');
      return;
    }
    if (text.length > BODY_MAX) {
      toast.error('Keep the addendum to 4,000 characters.');
      return;
    }
    if (await run(() => addAddendum(note.id, text), 'Addendum added.')) {
      setAddendum('');
      setMode('view');
    }
  };

  const openFollowUpEditor = () => {
    setFollowUp(Boolean(note.followUpOn));
    setDay(note.followUpOn ?? '');
    setWho(note.followUpUserId ?? '');
    setMode('follow-up');
  };

  const saveFollowUp = async (event: React.FormEvent) => {
    event.preventDefault();
    // The same rule as a new note's follow-up (a day is needed; a new day is today or later)
    const problem = noteDraftProblem(
      { type: note.type, header: note.header, body: note.body, followUpOn: followUp ? day : '', followUpUserId: followUp && who ? who : null, lock: true },
      visible,
      todayKey,
      note.followUpOn
    );
    if (problem) {
      toast.error(problem);
      return;
    }
    if (await run(() => changeFollowUp(note, followUp ? day : null, followUp && who ? who : null), followUp ? 'Follow-up saved.' : 'Follow-up removed.')) {
      setMode('view');
    }
  };

  if (mode === 'edit') {
    return (
      <li id={noteElementId(note.id)} className="list-none">
        <NoteForm note={note} allowed={visible} staff={staff} myUserId={myUserId} todayKey={todayKey} onCancel={() => setMode('view')} onSave={saveEdit} />
      </li>
    );
  }

  return (
    <li
      id={noteElementId(note.id)}
      tabIndex={-1}
      className={`list-none rounded-xl border bg-white p-3 scroll-mt-4 focus:outline-none ${
        highlighted ? 'border-purple-400 ring-2 ring-purple-200' : 'border-gray-200'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeChip type={note.type} />
        {note.lockedAt && (
          <span className={`${CHIP} bg-gray-100 text-gray-700 ring-1 ring-gray-200`}>
            <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Locked
          </span>
        )}
      </div>
      <h4 className="mt-1.5 break-words text-sm font-semibold text-gray-900">{note.header}</h4>
      <NoteText text={note.body} />
      <p className="mt-1.5 text-xs text-gray-500">
        {name(note.createdBy)}, {formatAuditTime(note.createdAt)}
        {note.editedAt && ` · changed by ${byName(note.editedBy)}, ${formatAuditTime(note.editedAt)}`}
        {note.lockedAt && ` · locked by ${byName(note.lockedBy)}, ${formatAuditTime(note.lockedAt)}`}
      </p>

      {status.state !== 'none' && note.followUpOn && (
        <div className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-1.5 text-xs ${FOLLOW_UP_STYLE[status.state]}`}>
          <Icon
            icon={status.state === 'done' ? 'solar:check-circle-bold-duotone' : 'solar:calendar-mark-bold-duotone'}
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          {status.state === 'done' ? (
            <span>
              Followed up by {byName(note.followUpDoneBy)}, {formatAuditTime(note.followUpDoneAt ?? '')}
            </span>
          ) : (
            <span>
              <span className="font-semibold">{status.label}</span>
              {status.state === 'overdue' && ` (${formatServiceDate(note.followUpOn)})`} · {note.followUpUserId ? name(note.followUpUserId) : 'Anyone'}
            </span>
          )}
          <button
            type="button"
            className="ml-auto rounded-md px-2 py-0.5 font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              void run(() => setFollowUpDone(note.id, status.state !== 'done'), status.state === 'done' ? 'Follow-up open again.' : 'Follow-up done.')
            }
          >
            {status.state === 'done' ? 'Open again' : 'Mark done'}
          </button>
        </div>
      )}

      {note.addenda.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-l-2 border-purple-200 pl-3" aria-label="Addenda">
          {note.addenda.map(item => (
            <li key={item.id} className="text-sm text-gray-700">
              <span className="block text-xs text-gray-500">
                Addendum · {name(item.createdBy)}, {formatAuditTime(item.createdAt)}
              </span>
              <span className="whitespace-pre-wrap break-words">{item.body}</span>
            </li>
          ))}
        </ul>
      )}

      {mode === 'addendum' && (
        <form onSubmit={event => void saveAddendum(event)} className="mt-2 space-y-2" noValidate>
          <label htmlFor={`${baseId}-addendum`} className={LABEL}>
            Addendum
          </label>
          <textarea
            id={`${baseId}-addendum`}
            ref={addendumRef}
            className={`${INPUT} min-h-[72px] resize-y`}
            rows={3}
            value={addendum}
            disabled={busy}
            onChange={event => setAddendum(event.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setMode('view')} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
              {busy ? 'Saving...' : 'Add addendum'}
            </button>
          </div>
        </form>
      )}

      {mode === 'follow-up' && (
        <form onSubmit={event => void saveFollowUp(event)} className="mt-2 space-y-2 rounded-xl bg-gray-50/70 p-3 ring-1 ring-gray-200" noValidate>
          <FollowUpFields
            type={note.type}
            enabled={followUp}
            onEnabledChange={enabled => {
              setFollowUp(enabled);
              if (enabled && !day) {
                setDay(followUpShortcuts(todayKey)[0].value);
                setWho(defaultFollowUpPerson(staff, note.type, myUserId));
              }
            }}
            day={day}
            onDayChange={setDay}
            who={who}
            onWhoChange={setWho}
            staff={staff}
            myUserId={myUserId}
            todayKey={todayKey}
            savedDay={note.followUpOn}
            disabled={busy}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setMode('view')} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
              {busy ? 'Saving...' : 'Save follow-up'}
            </button>
          </div>
        </form>
      )}

      {mode === 'view' && (
        <div className="mt-2 flex flex-wrap gap-1">
          {editable ? (
            <button type="button" className={QUIET_BUTTON} onClick={() => setMode('edit')} disabled={busy}>
              <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Change
            </button>
          ) : (
            <>
              <button type="button" className={QUIET_BUTTON} onClick={() => setMode('addendum')} disabled={busy}>
                <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Add addendum
              </button>
              <button type="button" className={QUIET_BUTTON} onClick={openFollowUpEditor} disabled={busy}>
                <Icon icon="solar:calendar-mark-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                {note.followUpOn ? 'Change follow-up' : 'Add follow-up'}
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
};

const channelLabel = (channel: ContactNote['channel']): string => CONTACT_CHANNELS.find(option => option.value === channel)?.label ?? 'Other';

interface CreditControlNoteItemProps {
  note: ContactNote;
  staffById: ReadonlyMap<string, StaffLike>;
  myUserId: string | null;
  /** Opens the Billing tab at the account, where promises and notes are kept */
  onOpenAccount: () => void;
}

/** A credit-control contact note, read-only here: it is kept (and added to) under Billing > Promises and notes. */
export const CreditControlNoteItem: React.FC<CreditControlNoteItemProps> = ({ note, staffById, myUserId, onOpenAccount }) => (
  <li className="list-none rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-3">
    <div className="flex flex-wrap items-center gap-1.5">
      <TypeChip type="account" />
      <span className={`${CHIP} bg-white text-gray-600 ring-1 ring-gray-200`}>Credit control</span>
    </div>
    <h4 className="mt-1.5 text-sm font-semibold text-gray-900">{channelLabel(note.channel)}</h4>
    <NoteText text={note.note} />
    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-gray-500">
        {staffLabel(note.createdBy, staffById, myUserId)}, {formatAuditTime(note.createdAt)}
      </p>
      <button type="button" className={QUIET_BUTTON} onClick={onOpenAccount}>
        <Icon icon="solar:wallet-money-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        Open account
      </button>
    </div>
  </li>
);

export default NoteCard;
