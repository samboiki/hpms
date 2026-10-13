import React, { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { INPUT, PRIMARY, QUIET, SECONDARY, errorText } from '../stock/stockUi';
import { formatServiceDate } from '../../utils/billing/dates';
import { savePracticeFundNote, type PracticeFundNote as Note } from '../../services/fundMasterService';

const NOTE_LIMIT = 1000;

interface PracticeFundNoteProps {
  practiceId: string;
  fundCode: string;
  fundName: string;
  note: Note | null;
  /** The practice's administrators (and OneHealth support) keep the note; everyone else reads it */
  canEdit: boolean;
  onSaved: (note: Note | null) => void;
}

/** The practice's own note on a fund (its contact at the fund, how it sends claims): only the practice sees it */
export const PracticeFundNote: React.FC<PracticeFundNoteProps> = ({ practiceId, fundCode, fundName, note, canEdit, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const fieldId = useId();

  const start = () => {
    setText(note?.text ?? '');
    setEditing(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || text.trim().length > NOTE_LIMIT) return;
    setSaving(true);
    try {
      const saved = await savePracticeFundNote(practiceId, fundCode, text);
      onSaved(saved ? { text: saved, updatedAt: new Date().toISOString() } : null);
      toast.success(saved ? `Your note on ${fundName} is saved.` : `Your note on ${fundName} is removed.`);
      setEditing(false);
    } catch (error) {
      toast.error(errorText(error, 'The note could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    const length = text.trim().length;
    return (
      <form onSubmit={save} className="space-y-2">
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
          Your practice&apos;s note on {fundName}
        </label>
        <textarea
          id={fieldId}
          value={text}
          onChange={event => setText(event.target.value)}
          rows={3}
          maxLength={NOTE_LIMIT + 50}
          className={INPUT}
          placeholder="For example: our contact at the fund, or how we send its claims."
          aria-describedby={`${fieldId}-count`}
          aria-invalid={length > NOTE_LIMIT}
        />
        <p id={`${fieldId}-count`} className={`text-xs ${length > NOTE_LIMIT ? 'text-red-600' : 'text-gray-500'}`}>
          {length} of {NOTE_LIMIT} characters. Only your practice sees this note; leave it empty to remove it.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={PRIMARY} disabled={saving || length > NOTE_LIMIT}>
            {saving ? 'Saving...' : 'Save note'}
          </button>
          <button type="button" className={SECONDARY} onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-2 font-medium text-gray-700">
          <Icon icon="solar:notebook-bold-duotone" className="h-4 w-4 text-gray-400" aria-hidden="true" />
          Your practice&apos;s note
        </p>
        {note ? (
          <>
            <p className="mt-1 whitespace-pre-line break-words text-gray-900">{note.text}</p>
            {note.updatedAt && <p className="mt-0.5 text-xs text-gray-500">Saved {formatServiceDate(new Date(note.updatedAt))}</p>}
          </>
        ) : (
          <p className="mt-1 text-gray-500">No note yet.</p>
        )}
      </div>
      {canEdit && (
        <button type="button" onClick={start} className={QUIET} aria-label={note ? `Change your note on ${fundName}` : `Add a note on ${fundName}`}>
          <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {note ? 'Change' : 'Add a note'}
        </button>
      )}
    </div>
  );
};
