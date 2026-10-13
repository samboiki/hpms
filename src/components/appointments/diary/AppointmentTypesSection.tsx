import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  DIARY_LISTS_NOT_ENABLED_MESSAGE,
  loadAppointmentTypes,
  removeAppointmentType,
  saveAppointmentType,
  type DiaryListLoad
} from '../../../services/diaryListsService';
import {
  APPOINTMENT_TYPE_NAME_MAX,
  DAILY_LIMIT_MAX,
  describeAppointmentType,
  sortAppointmentTypes,
  type AppointmentType
} from '../../../utils/diary/appointmentTypes';
import { TYPE_LENGTH_OPTIONS, VISIT_TYPES, VISIT_TYPE_LABELS, formatBookingLength, type VisitType } from '../../../utils/diary/bookingLength';
import { ReadOnlyNote, SettingsErrors, SettingsNotEnabled } from './DiarySettingsParts';
import { ICON_BUTTON_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_CLASS, SECONDARY_CLASS } from './diarySettingsStyles';

interface AppointmentTypesSectionProps {
  practiceId: string;
  /** Practice administrators change the list; everyone else reads it */
  isAdmin: boolean;
  /** After a change, so the booking form offers it at once */
  onSaved?: () => void;
}

interface TypeDraft {
  /** null: a new type */
  id: string | null;
  name: string;
  visitType: VisitType;
  lengthMinutes: number;
  /** '' = no limit (the number field's text) */
  dailyLimit: string;
}

const NEW_TYPE: TypeDraft = { id: null, name: '', visitType: 'consultation', lengthMinutes: 30, dailyLimit: '' };

/**
 * Diary settings > Appointment types (parity B6): the practice's own types ("New patient, 45 min, at most 4 a day"),
 * each saved and billed as one of the four standard types, with its own length and an optional daily limit per
 * practitioner (src/utils/diary/appointmentTypes.ts). The booking form offers them first; the limit only warns.
 */
export const AppointmentTypesSection: React.FC<AppointmentTypesSectionProps> = ({ practiceId, isAdmin, onSaved }) => {
  const [version, setVersion] = useState(0);
  const [load, setLoad] = useState<DiaryListLoad<AppointmentType> | null>(null);
  const [draft, setDraft] = useState<TypeDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAppointmentTypes(practiceId).then((loaded) => {
      if (!cancelled) setLoad(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  if (!load) return <p className="text-sm text-gray-500" role="status">Loading...</p>;

  const heading = <h3 className="text-sm font-semibold text-gray-900">Your own appointment types</h3>;
  if (load.state === 'not_enabled') {
    return (
      <section className="space-y-3">
        {heading}
        <SettingsNotEnabled message={DIARY_LISTS_NOT_ENABLED_MESSAGE} />
      </section>
    );
  }

  const active = sortAppointmentTypes(load.items.filter((type) => type.isActive));
  const lengthOptions: number[] = [...TYPE_LENGTH_OPTIONS];
  if (draft && !lengthOptions.includes(draft.lengthMinutes)) lengthOptions.push(draft.lengthMinutes);

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
    const limitText = draft.dailyLimit.trim();
    setSaving(true);
    const result = await saveAppointmentType(
      practiceId,
      draft.id,
      { name: draft.name, visitType: draft.visitType, lengthMinutes: draft.lengthMinutes, dailyLimit: limitText === '' ? null : Number(limitText) },
      load.items
    );
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    changed(draft.id ? `"${draft.name.trim()}" saved` : `"${draft.name.trim()}" added`);
  };

  const handleRemove = async (type: AppointmentType) => {
    if (!window.confirm(`Remove "${type.name}"? It is no longer offered. Bookings made as it keep it.`)) return;
    setSaving(true);
    const result = await removeAppointmentType(practiceId, type.id);
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    changed(`"${type.name}" removed`);
  };

  return (
    <section className="space-y-4" aria-labelledby="own-types-heading">
      <h3 id="own-types-heading" className="text-sm font-semibold text-gray-900">Your own appointment types</h3>
      <p className="text-sm text-gray-600">
        For example "New patient, 45 minutes, at most 4 a day". The booking form offers these first; each is booked, billed and
        reported as one of the standard types. A daily limit counts each practitioner's bookings of the type that day and
        only warns: reception can still book with "Book anyway".
      </p>
      {load.state === 'error' && <p className="text-sm text-red-600">Could not load the appointment types: {load.message}</p>}
      {!isAdmin && <ReadOnlyNote>Only a practice administrator can change the appointment types.</ReadOnlyNote>}

      {active.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
          No appointment types of your own yet.{isAdmin ? ' Add the first one below.' : ''}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white" aria-label="Your appointment types">
          {active.map((type) => (
            <li key={type.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium text-gray-900">{type.name}</span>
                <span className="block text-xs text-gray-500">{describeAppointmentType(type)}</span>
              </span>
              {isAdmin && (
                <span className="flex flex-none gap-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setErrors([]);
                      setDraft({
                        id: type.id,
                        name: type.name,
                        visitType: type.visitType,
                        lengthMinutes: type.lengthMinutes,
                        dailyLimit: type.dailyLimit === null ? '' : String(type.dailyLimit)
                      });
                    }}
                    aria-label={`Change ${type.name}`}
                    title="Change"
                    className={ICON_BUTTON_CLASS}
                  >
                    <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleRemove(type)}
                    aria-label={`Remove ${type.name}`}
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
          <h4 className="text-sm font-semibold text-gray-900">{draft.id ? 'Change the appointment type' : 'New appointment type'}</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="type-name" className={LABEL_CLASS}>Name</label>
              <input
                id="type-name"
                value={draft.name}
                maxLength={APPOINTMENT_TYPE_NAME_MAX}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="New patient"
                className={INPUT_CLASS}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="type-visit-type" className={LABEL_CLASS}>Booked and billed as</label>
              <select
                id="type-visit-type"
                value={draft.visitType}
                onChange={(event) => setDraft({ ...draft, visitType: event.target.value as VisitType })}
                className={INPUT_CLASS}
              >
                {VISIT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {VISIT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="type-length" className={LABEL_CLASS}>Length</label>
              <select
                id="type-length"
                value={draft.lengthMinutes}
                onChange={(event) => setDraft({ ...draft, lengthMinutes: Number(event.target.value) })}
                className={INPUT_CLASS}
              >
                {lengthOptions.sort((a, b) => a - b).map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatBookingLength(minutes)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="type-limit" className={LABEL_CLASS}>At most a day per practitioner</label>
              <input
                id="type-limit"
                type="number"
                inputMode="numeric"
                min={1}
                max={DAILY_LIMIT_MAX}
                value={draft.dailyLimit}
                onChange={(event) => setDraft({ ...draft, dailyLimit: event.target.value })}
                placeholder="No limit"
                className={INPUT_CLASS}
                aria-describedby="type-limit-help"
              />
              <p id="type-limit-help" className="mt-1 text-xs text-gray-500">Leave empty for no limit.</p>
            </div>
          </div>
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
              <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:calendar-add-bold-duotone'} className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
              {saving ? 'Saving...' : draft.id ? 'Save type' : 'Add type'}
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
              setDraft(NEW_TYPE);
            }}
            className={SECONDARY_CLASS}
          >
            <Icon icon="solar:add-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
            Add an appointment type
          </button>
        </>
      )}
    </section>
  );
};

export default AppointmentTypesSection;
