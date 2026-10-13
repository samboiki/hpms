import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { CHIP, INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../patientLists/listStyles';
import { formatStaffName } from '../../settings/UserManagement/staffUtils';
import {
  BODY_MAX,
  HEADER_MAX,
  NOTE_TYPE_LABELS,
  defaultFollowUpPerson,
  defaultLockFor,
  defaultNoteType,
  followUpCandidates,
  followUpShortcuts,
  noteDraftProblem,
  type NoteDraft,
  type NoteType,
  type PatientNote,
  type StaffLike
} from './patientNotes';
import { NOTE_TYPE_STYLE } from './noteTypeStyle';

interface FollowUpFieldsProps {
  type: NoteType;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  day: string;
  onDayChange: (day: string) => void;
  /** '' = anyone who sees the note */
  who: string;
  onWhoChange: (who: string) => void;
  staff: readonly StaffLike[];
  myUserId: string | null;
  todayKey: string;
  /** The day already on the note (it may stay, even when it has passed) */
  savedDay?: string | null;
  disabled?: boolean;
}

/** Follow up: a tick, then the day (with quick choices) and who follows up. */
export const FollowUpFields: React.FC<FollowUpFieldsProps> = ({
  type,
  enabled,
  onEnabledChange,
  day,
  onDayChange,
  who,
  onWhoChange,
  staff,
  myUserId,
  todayKey,
  savedDay = null,
  disabled = false
}) => {
  const baseId = useId();
  const candidates = useMemo(() => followUpCandidates(staff, type), [staff, type]);
  const minDay = savedDay && savedDay < todayKey ? savedDay : todayKey;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-purple-600"
          checked={enabled}
          disabled={disabled}
          onChange={event => onEnabledChange(event.target.checked)}
        />
        Follow up
      </label>
      {enabled && (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-white/80 p-3 ring-1 ring-gray-200 sm:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-day`} className={LABEL}>
              On
            </label>
            <input
              id={`${baseId}-day`}
              type="date"
              className={INPUT}
              value={day}
              min={minDay}
              disabled={disabled}
              onChange={event => onDayChange(event.target.value)}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {followUpShortcuts(todayKey).map(shortcut => (
                <button
                  key={shortcut.label}
                  type="button"
                  disabled={disabled}
                  aria-pressed={day === shortcut.value}
                  onClick={() => onDayChange(shortcut.value)}
                  className={`${CHIP} cursor-pointer ring-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    day === shortcut.value ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor={`${baseId}-who`} className={LABEL}>
              Who follows up
            </label>
            <select id={`${baseId}-who`} className={INPUT} value={who} disabled={disabled} onChange={event => onWhoChange(event.target.value)}>
              <option value="">Anyone who sees this note</option>
              {who && !candidates.some(member => member.id === who) && (
                // Saved earlier, but they left or no longer see this kind of note: shown so the choice is visible
                <option value={who}>Someone who can no longer follow up: choose again</option>
              )}
              {candidates.map(member => (
                <option key={member.id} value={member.id}>
                  {formatStaffName(member)}
                  {member.id === myUserId ? ' (you)' : ''}
                </option>
              ))}
            </select>
            {type === 'clinical' && <p className="mt-1 text-xs text-gray-500">Only practitioners and nurses see clinical notes.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

interface NoteFormProps {
  /** The note being changed; none for a new note */
  note?: PatientNote | null;
  allowed: readonly NoteType[];
  staff: readonly StaffLike[];
  myUserId: string | null;
  todayKey: string;
  onCancel: () => void;
  /** Saves the draft (the panel closes the form once it is saved, and keeps it open with the reason when not) */
  onSave: (draft: NoteDraft) => Promise<void>;
}

/**
 * Write a note in seconds: the kind (clinical for practitioners, else general), the text, and only if wanted a
 * header, a follow-up and the lock. Clinical notes start locked; the box can be unticked before saving.
 */
export const NoteForm: React.FC<NoteFormProps> = ({ note = null, allowed, staff, myUserId, todayKey, onCancel, onSave }) => {
  const baseId = useId();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const editing = note !== null;
  const [type, setType] = useState<NoteType>(note?.type ?? defaultNoteType(allowed));
  const [header, setHeader] = useState(note?.header ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [followUp, setFollowUp] = useState(Boolean(note?.followUpOn));
  const [day, setDay] = useState(note?.followUpOn ?? '');
  const [who, setWho] = useState(note?.followUpUserId ?? '');
  const [lock, setLock] = useState(editing ? false : defaultLockFor(type));
  const [lockTouched, setLockTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  const chooseType = (next: NoteType) => {
    setType(next);
    if (!editing && !lockTouched) setLock(defaultLockFor(next));
    // Someone who cannot see the new kind of note cannot follow it up
    if (who && !followUpCandidates(staff, next).some(member => member.id === who)) setWho('');
  };

  const toggleFollowUp = (enabled: boolean) => {
    setFollowUp(enabled);
    if (enabled && !day) {
      setDay(followUpShortcuts(todayKey)[0].value);
      setWho(defaultFollowUpPerson(staff, type, myUserId));
    }
  };

  const draft: NoteDraft = { type, header, body, followUpOn: followUp ? day : '', followUpUserId: followUp && who ? who : null, lock };

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    const found = noteDraftProblem(draft, allowed, todayKey, note?.followUpOn ?? null);
    setProblem(found);
    if (found) return;
    setBusy(true);
    try {
      await onSave(draft);
    } finally {
      setBusy(false);
    }
  };

  const left = BODY_MAX - body.trim().length;

  return (
    <form onSubmit={event => void submit(event)} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3" noValidate>
      <fieldset>
        <legend className={LABEL}>Kind of note</legend>
        <div className="flex flex-wrap gap-2">
          {allowed.map(option => (
            <label key={option} className="cursor-pointer">
              <input
                type="radio"
                name={`${baseId}-type`}
                value={option}
                checked={type === option}
                disabled={busy}
                onChange={() => chooseType(option)}
                className="peer sr-only"
              />
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-purple-500 ${
                  type === option ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon icon={NOTE_TYPE_STYLE[option].icon} className="h-4 w-4" aria-hidden="true" />
                {NOTE_TYPE_LABELS[option]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${baseId}-header`} className={LABEL}>
          Header <span className="font-normal text-gray-500">(optional: the start of the note is used)</span>
        </label>
        <input
          id={`${baseId}-header`}
          className={INPUT}
          value={header}
          maxLength={HEADER_MAX}
          disabled={busy}
          placeholder="e.g. Results discussed"
          onChange={event => setHeader(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-body`} className={LABEL}>
          Note
        </label>
        <textarea
          id={`${baseId}-body`}
          ref={bodyRef}
          className={`${INPUT} min-h-[96px] resize-y`}
          rows={4}
          value={body}
          disabled={busy}
          aria-describedby={`${baseId}-body-hint`}
          onChange={event => setBody(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void submit();
          }}
        />
        <p id={`${baseId}-body-hint`} className={`mt-1 text-xs ${left < 0 ? 'text-red-700' : 'text-gray-500'}`}>
          {left < 500 ? `${left} characters left. ` : ''}Ctrl+Enter saves.
        </p>
      </div>

      <FollowUpFields
        type={type}
        enabled={followUp}
        onEnabledChange={toggleFollowUp}
        day={day}
        onDayChange={setDay}
        who={who}
        onWhoChange={setWho}
        staff={staff}
        myUserId={myUserId}
        todayKey={todayKey}
        savedDay={note?.followUpOn ?? null}
        disabled={busy}
      />

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-purple-600"
          checked={lock}
          disabled={busy}
          onChange={event => {
            setLock(event.target.checked);
            setLockTouched(true);
          }}
        />
        <span>
          <span className="font-medium">Lock this note</span>
          <span className="block text-xs text-gray-500">Once saved it cannot be changed: anything later is added as a dated addendum.</span>
        </span>
      </label>

      {problem && (
        <p className="text-sm text-red-700" role="alert">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={SECONDARY_BUTTON} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
          {busy ? 'Saving...' : editing ? 'Save changes' : 'Save note'}
        </button>
      </div>
    </form>
  );
};

export default NoteForm;
