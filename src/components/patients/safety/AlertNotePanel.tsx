import React, { useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { MAX_ALERT_NOTE, saveAlertNote, type ClinicalProfileRecord } from '../../../services/patientSafetyService';
import { INPUT, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../../patientLists/listStyles';
import { formatSafetyDate } from './safetyFormat';

interface AlertNotePanelProps {
  practiceId: string;
  patientId: string;
  profile: ClinicalProfileRecord | null;
  onChanged: () => Promise<void>;
}

/** The short clinical alert ("Pacemaker", "Latex gloves only") shown on the strip. */
export const AlertNotePanel: React.FC<AlertNotePanelProps> = ({ practiceId, patientId, profile, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const fieldId = useId();
  const note = profile?.alertNote ?? null;

  const startEditing = () => {
    setDraft(note ?? '');
    setEditing(true);
    setTimeout(() => fieldRef.current?.focus(), 0);
  };

  const save = async (value: string) => {
    setSaving(true);
    try {
      await saveAlertNote(practiceId, patientId, value);
      await onChanged();
      toast.success(value.trim() ? 'Alert saved.' : 'Alert removed.');
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the alert.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="text-sm font-semibold text-gray-900">
          Clinical alert
        </h3>
        {!editing && (
          <button type="button" className={QUIET_BUTTON} onClick={startEditing}>
            <Icon icon={note ? 'solar:pen-bold-duotone' : 'solar:add-circle-bold-duotone'} className="h-4 w-4" aria-hidden="true" />
            {note ? 'Change' : 'Add alert'}
          </button>
        )}
      </div>

      {!editing &&
        (note ? (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <p className="whitespace-pre-line font-medium">{note}</p>
            {profile?.alertUpdatedAt && (
              <p className="mt-1 text-xs text-amber-800">
                Updated{profile.alertUpdatedByName ? ` by ${profile.alertUpdatedByName}` : ''} on {formatSafetyDate(profile.alertUpdatedAt)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">None. Use it for what every visit must know, such as a pacemaker or "latex-free gloves".</p>
        ))}

      {editing && (
        <div className="space-y-2">
          <label htmlFor={fieldId} className="sr-only">
            Clinical alert
          </label>
          <textarea
            id={fieldId}
            ref={fieldRef}
            className={`${INPUT} min-h-[4.5rem]`}
            value={draft}
            maxLength={MAX_ALERT_NOTE}
            placeholder="e.g. Pacemaker. Latex-free gloves only."
            onChange={event => setDraft(event.target.value)}
          />
          <p className="text-right text-xs text-gray-500">
            {draft.length}/{MAX_ALERT_NOTE}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {note && (
              <button type="button" className={SECONDARY_BUTTON} disabled={saving} onClick={() => void save('')}>
                Remove alert
              </button>
            )}
            <button type="button" className={SECONDARY_BUTTON} disabled={saving} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className={PRIMARY_BUTTON} disabled={saving || draft.trim() === (note ?? '')} onClick={() => void save(draft)}>
              {saving ? 'Saving...' : 'Save alert'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AlertNotePanel;
