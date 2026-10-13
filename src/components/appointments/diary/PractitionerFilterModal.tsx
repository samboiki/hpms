import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import type { DiaryPractitioner } from '../../../utils/diary/diaryPractitioners';
import { describeDiaryView, sameDiaryView, toggleDiaryView, type DiaryView } from '../../../utils/diary/diaryDefaultView';
import { formatRole } from '../../settings/UserManagement/staffUtils';

interface PractitionerFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The diary's practitioners, in column order */
  practitioners: DiaryPractitioner[];
  /** Whose bookings are shown now ([] = all practitioners) */
  view: DiaryView;
  onChange: (view: DiaryView) => void;
  /** What the diary opens on: the user's saved default, else their role's */
  defaultView: DiaryView;
  /** Offered once the database can keep a default (the diary update is applied) */
  canSaveDefault: boolean;
  onSaveDefault: (view: DiaryView) => Promise<{ ok: true } | { ok: false; message: string }>;
  /** A practitioner's name as the diary shows it */
  nameOf: (id: string) => string;
}

/**
 * Whose bookings the diary shows: one practitioner, several side by side, or everyone. Each tick changes the diary at
 * once; "Open the diary on ..." keeps the choice as this user's default on every computer.
 */
export const PractitionerFilterModal: React.FC<PractitionerFilterModalProps> = ({
  isOpen,
  onClose,
  practitioners,
  view,
  onChange,
  defaultView,
  canSaveDefault,
  onSaveDefault,
  nameOf
}) => {
  const titleId = useId();
  const firstChoiceRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSaveError(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Opening moves the focus into the window; closing hands it back to what opened it (the practitioner button)
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstChoiceRef.current?.focus();
    return () => opener?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const order = practitioners.map((practitioner) => practitioner.id);
  const isDefault = sameDiaryView(view, defaultView);
  const described = describeDiaryView(view, nameOf);

  const saveDefault = async () => {
    setSaving(true);
    setSaveError(null);
    const result = await onSaveDefault(view);
    setSaving(false);
    if (!result.ok) setSaveError(result.message);
  };

  const rowClass = (checked: boolean) =>
    `flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 focus-within:ring-2 focus-within:ring-purple-500 ${
      checked ? 'border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50' : 'border border-gray-200 bg-white hover:bg-gray-50'
    }`;

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm" />
      <div className="pointer-events-none fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="pointer-events-auto flex max-h-[85vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex flex-none items-start justify-between gap-3 border-b border-gray-100 p-5">
            <div>
              <h2 id={titleId} className="text-xl font-bold text-gray-800">
                Show practitioners
              </h2>
              <p className="mt-1 text-sm text-gray-500">One, several, or everyone side by side</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-gray-100" title="Close" aria-label="Close">
              <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </button>
          </div>

          <div role="group" aria-label="Practitioners shown" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            <label className={rowClass(view.length === 0)}>
              <input
                ref={firstChoiceRef}
                type="checkbox"
                className="h-4 w-4 flex-none accent-blue-600"
                checked={view.length === 0}
                onChange={() => onChange(toggleDiaryView(view, null, order))}
              />
              <Icon icon="solar:users-group-two-rounded-bold-duotone" className="h-5 w-5 flex-none text-blue-600" aria-hidden="true" />
              <span className="min-w-0 text-left">
                <span className="block font-medium text-gray-800">All practitioners</span>
                <span className="block text-xs text-gray-500">Everyone's bookings, side by side</span>
              </span>
            </label>
            {practitioners.map((practitioner) => {
              const checked = view.includes(practitioner.id);
              return (
                <label key={practitioner.id || 'no-practitioner'} className={rowClass(checked)}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 flex-none accent-blue-600"
                    checked={checked}
                    onChange={() => onChange(toggleDiaryView(view, practitioner.id, order))}
                  />
                  <Icon icon="solar:user-bold-duotone" className="h-5 w-5 flex-none text-gray-500" aria-hidden="true" />
                  <span className="min-w-0 text-left">
                    <span className="block truncate font-medium text-gray-800">{practitioner.name}</span>
                    {practitioner.role && <span className="block text-xs text-gray-500">{formatRole(practitioner.role)}</span>}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-t border-gray-100 p-4">
            <div aria-live="polite" className="min-w-0 flex-1">
              {canSaveDefault &&
                (isDefault ? (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />
                    The diary opens on {described}.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={saveDefault}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-purple-700 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon icon="solar:pin-bold-duotone" className="h-4 w-4 flex-none" aria-hidden="true" />
                    {saving ? 'Saving...' : `Open the diary on ${described}`}
                  </button>
                ))}
              {saveError && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {saveError}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-none rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:from-purple-600 hover:to-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default PractitionerFilterModal;
