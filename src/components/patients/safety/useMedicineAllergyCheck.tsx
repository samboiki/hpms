import React, { useCallback, useId, useRef, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { isSafetyNotSetUp, recordAllergyOverride, SEVERITY_LABELS } from '../../../services/patientSafetyService';
import { findAllergyConflicts, type AllergyConflict } from '../../../utils/clinical/allergyMatch';
import { DANGER_BUTTON, INPUT, PRIMARY_BUTTON } from '../../patientLists/listStyles';
import { ClinicalDialog } from './ClinicalDialog';
import { SEVERITY_CHIP } from './safetyFormat';
import { usePatientSafety } from './usePatientSafety';

const MIN_REASON = 3;
const MAX_REASON = 300;

interface Pending {
  medicine: string;
  conflicts: AllergyConflict[];
  proceed: () => void;
}

export interface MedicineAllergyCheck {
  /**
   * Call before a medicine is added to the prescription. `proceed` runs straight away when nothing
   * matches; otherwise after the prescriber gives a reason (which is kept), or never if they cancel.
   */
  confirmMedicine: (medicine: string, proceed: () => void) => void;
  /** The warning dialog: render it once anywhere in the screen */
  dialog: React.ReactNode;
}

/**
 * The allergy check on the visit's Medications tab. It never blocks prescribing: a match asks for a
 * reason, and the reason, the medicine and the allergy are recorded (patient_allergy_overrides).
 * Before the patient-safety tables exist there are no recorded allergies and nothing is checked.
 */
export function useMedicineAllergyCheck(params: {
  patientId: string;
  practiceId: string | null | undefined;
  visitId: string | null | undefined;
}): MedicineAllergyCheck {
  const { patientId, practiceId, visitId } = params;
  const safety = usePatientSafety(patientId);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const reasonId = useId();

  const { data: loadedSafety, status: safetyStatus, ensureLoaded } = safety;
  const confirmMedicine = useCallback(
    (medicine: string, proceed: () => void) => {
      void (async () => {
        let allergies = loadedSafety?.allergies ?? null;
        if (!allergies && safetyStatus !== 'not_set_up') {
          // Still loading (or failed earlier): wait for the records rather than skip the check
          try {
            allergies = (await ensureLoaded())?.allergies ?? [];
          } catch (error) {
            if (!isSafetyNotSetUp(error)) {
              // Never silently skip the check: say it could not run
              toast.error('Allergies could not be loaded, so this medicine was not checked against them.', { duration: 6000 });
            }
            proceed();
            return;
          }
        }
        const conflicts = allergies ? findAllergyConflicts(medicine, allergies) : [];
        if (conflicts.length === 0) {
          proceed();
          return;
        }
        setReason('');
        setPending({ medicine: medicine.trim(), conflicts, proceed });
      })();
    },
    [loadedSafety, safetyStatus, ensureLoaded]
  );

  const close = () => {
    if (!saving) setPending(null);
  };

  const addAnyway = async () => {
    if (!pending || !practiceId) return;
    const text = reason.trim();
    if (text.length < MIN_REASON) {
      reasonRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      for (const conflict of pending.conflicts) {
        await recordAllergyOverride({
          practiceId,
          patientId,
          visitId: visitId ?? null,
          allergyId: conflict.allergy.id,
          allergySubstance: conflict.allergy.substance,
          medicine: pending.medicine,
          reason: text
        });
      }
      pending.proceed();
      toast.success(`${pending.medicine} added. Your reason was kept with the allergy record.`);
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not record the reason. The medicine was not added.');
    } finally {
      setSaving(false);
    }
  };

  const dialog = (
    <ClinicalDialog
      open={pending !== null}
      onClose={close}
      title="Allergy warning"
      subtitle={pending ? `Before adding ${pending.medicine}` : undefined}
      role="alertdialog"
      dismissible={!saving}
      initialFocus={reasonRef}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={DANGER_BUTTON} disabled={saving || reason.trim().length < MIN_REASON || !practiceId} onClick={() => void addAnyway()}>
            {saving ? 'Saving...' : 'Add anyway'}
          </button>
          <button type="button" className={PRIMARY_BUTTON} disabled={saving} onClick={close}>
            Do not add
          </button>
        </div>
      }
    >
      {pending && (
        <div className="space-y-4">
          <ul className="space-y-2">
            {pending.conflicts.map(conflict => (
              <li
                key={conflict.allergy.id}
                className={`rounded-xl px-3 py-2 ring-1 ${conflict.kind === 'related' ? 'bg-amber-50 ring-amber-200' : 'bg-red-50 ring-red-200'}`}
              >
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                  <Icon
                    icon="solar:danger-triangle-bold-duotone"
                    className={`h-5 w-5 ${conflict.kind === 'related' ? 'text-amber-600' : 'text-red-600'}`}
                    aria-hidden="true"
                  />
                  Allergic to {conflict.allergy.substance}
                  {conflict.allergy.severity && conflict.allergy.severity in SEVERITY_LABELS && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CHIP[conflict.allergy.severity as keyof typeof SEVERITY_CHIP]}`}>
                      {SEVERITY_LABELS[conflict.allergy.severity as keyof typeof SEVERITY_LABELS]}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-gray-800">{conflict.explanation}</p>
                {conflict.allergy.reaction && <p className="text-sm text-gray-700">Reaction: {conflict.allergy.reaction}</p>}
              </li>
            ))}
          </ul>
          <div>
            <label htmlFor={reasonId} className="mb-1.5 block text-sm font-medium text-gray-700">
              To add it anyway, give the reason
            </label>
            <textarea
              id={reasonId}
              ref={reasonRef}
              className={`${INPUT} min-h-[4.5rem]`}
              value={reason}
              maxLength={MAX_REASON}
              placeholder="e.g. Tolerated this medicine before; allergy was to a different penicillin"
              onChange={event => setReason(event.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500">
            Checked by name against the recorded allergies. This is not a full drug-interaction check.
          </p>
        </div>
      )}
    </ClinicalDialog>
  );

  return { confirmMedicine, dialog };
}
