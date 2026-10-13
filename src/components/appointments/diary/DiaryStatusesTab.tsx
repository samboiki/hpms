import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  DIARY_LISTS_NOT_ENABLED_MESSAGE,
  loadDiaryStatuses,
  removeDiaryStatus,
  saveDiaryStatus,
  type DiaryListLoad
} from '../../../services/diaryListsService';
import {
  DIARY_STATUS_COLOURS,
  DIARY_STATUS_COLOUR_STYLES,
  DIARY_STATUS_NAME_MAX,
  sortDiaryStatuses,
  type DiaryStatus,
  type DiaryStatusColour
} from '../../../utils/diary/diaryStatuses';
import { STAGE_LABELS, VISIT_STAGES, type VisitStage } from '../../../utils/visitStage';
import { DiaryStatusLabel } from './DiaryStatusLabel';
import { ReadOnlyNote, SettingsErrors, SettingsNotEnabled } from './DiarySettingsParts';
import { ICON_BUTTON_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_CLASS, SECONDARY_CLASS } from './diarySettingsStyles';

interface DiaryStatusesTabProps {
  practiceId: string;
  /** Practice administrators change the list; everyone else reads it */
  isAdmin: boolean;
  /** After a change, so the diary shows it at once */
  onSaved?: () => void;
}

interface StatusDraft {
  /** null: a new status */
  id: string | null;
  name: string;
  colour: DiaryStatusColour;
  stage: VisitStage;
}

const NEW_STATUS: StatusDraft = { id: null, name: '', colour: 'blue', stage: 'scheduled' };

/**
 * Diary settings > Statuses (parity B3): the practice's own words for where a booking is, each in a colour and
 * belonging to one step of the visit (src/utils/diary/diaryStatuses.ts). Reception picks one in the visit actions, the
 * diary card shows it, and the diary report counts it; billing and reminders keep following the step.
 */
export const DiaryStatusesTab: React.FC<DiaryStatusesTabProps> = ({ practiceId, isAdmin, onSaved }) => {
  const [version, setVersion] = useState(0);
  const [load, setLoad] = useState<DiaryListLoad<DiaryStatus> | null>(null);
  const [draft, setDraft] = useState<StatusDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDiaryStatuses(practiceId).then((loaded) => {
      if (!cancelled) setLoad(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  if (!load) return <p className="text-sm text-gray-500" role="status">Loading...</p>;
  if (load.state === 'not_enabled') return <SettingsNotEnabled message={DIARY_LISTS_NOT_ENABLED_MESSAGE} />;

  const active = sortDiaryStatuses(load.items.filter((status) => status.isActive));

  const changed = (message: string) => {
    setErrors([]);
    setDraft(null);
    toast.success(message);
    setVersion((current) => current + 1);
    onSaved?.();
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    const result = await saveDiaryStatus(practiceId, draft.id, draft, load.items);
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    changed(draft.id ? `Status "${draft.name.trim()}" saved` : `Status "${draft.name.trim()}" added`);
  };

  const handleRemove = async (status: DiaryStatus) => {
    if (!window.confirm(`Remove "${status.name}"? It is no longer offered. Bookings that have it keep it.`)) return;
    setSaving(true);
    const result = await removeDiaryStatus(practiceId, status.id);
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    changed(`Status "${status.name}" removed`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Your own words for where a booking is, such as "Waiting for X-ray" or "Called, no answer". Each belongs to one step of
        the visit: reception picks it in the visit actions while the booking is at that step, the diary shows it on the booking,
        and the diary report counts it. Billing and reminders keep following the step.
      </p>
      {load.state === 'error' && <p className="text-sm text-red-600">Could not load the statuses: {load.message}</p>}
      {!isAdmin && <ReadOnlyNote>Only a practice administrator can change the statuses.</ReadOnlyNote>}

      {active.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
          No statuses yet.{isAdmin ? ' Add the first one below.' : ''}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white" aria-label="Your statuses">
          {active.map((status) => (
            <li key={status.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                <DiaryStatusLabel status={status} size="sm" />
                <span className="text-xs text-gray-500">While: {STAGE_LABELS[status.stage]}</span>
              </span>
              {isAdmin && (
                <span className="flex flex-none gap-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setErrors([]);
                      setDraft({ id: status.id, name: status.name, colour: status.colour, stage: status.stage });
                    }}
                    aria-label={`Change ${status.name}`}
                    title="Change"
                    className={ICON_BUTTON_CLASS}
                  >
                    <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleRemove(status)}
                    aria-label={`Remove ${status.name}`}
                    title="Remove"
                    className={ICON_BUTTON_CLASS}
                  >
                    <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && draft && (
        <form onSubmit={handleSave} noValidate className="space-y-4 rounded-xl border border-purple-200 bg-purple-50/40 p-4">
          <h3 className="text-sm font-semibold text-gray-900">{draft.id ? 'Change the status' : 'New status'}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="status-name" className={LABEL_CLASS}>Name</label>
              <input
                id="status-name"
                value={draft.name}
                maxLength={DIARY_STATUS_NAME_MAX}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Waiting for X-ray"
                className={INPUT_CLASS}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="status-stage" className={LABEL_CLASS}>Shown while the visit is</label>
              <select
                id="status-stage"
                value={draft.stage}
                onChange={(event) => setDraft({ ...draft, stage: event.target.value as VisitStage })}
                className={INPUT_CLASS}
              >
                {VISIT_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className={LABEL_CLASS}>Colour</legend>
            <div className="flex flex-wrap gap-2">
              {DIARY_STATUS_COLOURS.map((colour) => {
                const style = DIARY_STATUS_COLOUR_STYLES[colour];
                const checked = draft.colour === colour;
                return (
                  <label
                    key={colour}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset focus-within:ring-2 focus-within:ring-purple-500 ${style.chip} ${
                      checked ? 'outline outline-2 outline-offset-1 outline-purple-500' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="status-colour"
                      value={colour}
                      checked={checked}
                      onChange={() => setDraft({ ...draft, colour })}
                      className="sr-only"
                    />
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
                    {style.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            On the booking:
            <DiaryStatusLabel status={{ id: 'preview', name: draft.name.trim() || 'Your status', colour: draft.colour, stage: draft.stage, isActive: true }} size="sm" />
          </p>
          <SettingsErrors errors={errors} />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setErrors([]);
              }}
              className={SECONDARY_CLASS}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={PRIMARY_CLASS}>
              <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:tag-bold-duotone'} className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
              {saving ? 'Saving...' : draft.id ? 'Save status' : 'Add status'}
            </button>
          </div>
        </form>
      )}

      {isAdmin && !draft && (
        <>
          <SettingsErrors errors={errors} />
          <button
            type="button"
            onClick={() => {
              setErrors([]);
              setDraft(NEW_STATUS);
            }}
            className={PRIMARY_CLASS}
          >
            <Icon icon="solar:add-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
            Add a status
          </button>
        </>
      )}
    </div>
  );
};

export default DiaryStatusesTab;
