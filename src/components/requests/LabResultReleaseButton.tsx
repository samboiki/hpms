import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { releaseState, setLabResultsRelease, type ReleasableResult } from './labRelease';
import { useAuthStore } from '../../stores/authStore';

/**
 * Staff: share a lab request's results with the patient in the patient app, or take them back.
 * Patients never see a result before it is released here. Hidden until the patient app is switched on.
 */
const LabResultReleaseButton: React.FC<{ requestId: string; results: ReleasableResult[]; onChanged: () => void }> = ({
  requestId,
  results,
  onChanged,
}) => {
  const [busy, setBusy] = useState(false);
  // Releasing is for doctors, administrators and OneHealth support (release_lab_results_to_patient checks the same):
  // everyone else sees whether the patient can see the results, without buttons that would be refused
  const canRelease = useAuthStore((store) => {
    const user = store.user;
    return !!user && (user.role === 'doctor' || user.role === 'admin' || user.is_super_admin === true);
  });
  const state = releaseState(results);
  if (state.kind === 'unavailable') return null;

  const change = async (release: boolean) => {
    const question = release
      ? 'Release these results to the patient? They will see them in the patient app, with the reference ranges and a note to discuss them with their practitioner.'
      : 'Take these results back from the patient app? The patient will no longer see them there.';
    if (!window.confirm(question)) return;
    setBusy(true);
    const outcome = await setLabResultsRelease(requestId, release);
    setBusy(false);
    if (!outcome.ok) {
      toast.error(outcome.message);
      return;
    }
    toast.success(release ? 'Released to the patient app' : 'Taken back from the patient app');
    onChanged();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 bg-white">
      <p className="flex items-center gap-2 text-sm text-gray-700">
        <Icon
          icon={state.kind === 'all' ? 'solar:eye-bold-duotone' : 'solar:eye-closed-bold-duotone'}
          className={`w-5 h-5 ${state.kind === 'all' ? 'text-emerald-600' : 'text-gray-400'}`}
          aria-hidden="true"
        />
        {state.kind === 'all' && 'Shown to the patient in the patient app'}
        {state.kind === 'none' && 'Not shown to the patient yet'}
        {state.kind === 'partly' && `${state.total - state.released} of ${state.total} results not shown to the patient yet (new or changed)`}
      </p>
      {canRelease && <div className="flex items-center gap-2">
        {state.kind !== 'all' && (
          <button
            type="button"
            onClick={() => void change(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Icon icon="solar:share-bold-duotone" className="w-4 h-4" aria-hidden="true" />
            {state.kind === 'partly' ? 'Release all to patient' : 'Release to patient'}
          </button>
        )}
        {state.kind !== 'none' && (
          <button
            type="button"
            onClick={() => void change(false)}
            disabled={busy}
            className="text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Take back
          </button>
        )}
      </div>}
    </div>
  );
};

export default LabResultReleaseButton;
