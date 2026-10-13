import React, { useId, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import ReferralSheet from '../patients/registers/ReferralSheet';
import type { PatientClaimRegisters } from '../../hooks/usePatientClaimRegisters';
import {
  describeClaimDetails,
  draftWithReferral,
  draftWithoutReferral,
  placeOfServiceLabel,
  validateClaimDetailsDraft,
  type ClaimDetailsField,
  type VisitClaimDetailsDraft
} from '../../utils/billing/visitClaimDetails';
import { describeReferrer, referralDetailsOf, referralsToPick } from '../../utils/billing/referrals';
import type { VisitClaimDetailsState } from './useVisitClaimDetails';

interface VisitClaimDetailsCardProps {
  state: VisitClaimDetailsState;
  /** yyyy-MM-dd */
  visitDate: string;
  hasMedicalAid: boolean;
  practiceId: string | null;
  patientId: string | null;
  /** The patient's referrals and authorisations (useVisitBilling) */
  registers: PatientClaimRegisters;
  /** Authorisations that ended, have not started or are used up for this visit's lines */
  authorisationNotices: string[];
}

const INPUT = 'mt-0.5 block w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900';
const TYPED = 'typed';

/**
 * The visit's claim details on its Billing tab (parity C10, F19), for a medical aid patient: who referred the patient
 * (picked from the referral register, which fills the claim fields, or typed), a hospital stay (the claim says "H") with
 * its admission and discharge dates, and the place of service. Saved with the visit; every claim line of the visit
 * carries them (claim fields 25, 30, 42-44), a line with its own referral uses that one. Closed unless something is set.
 */
const VisitClaimDetailsCard: React.FC<VisitClaimDetailsCardProps> = ({
  state,
  visitDate,
  hasMedicalAid,
  practiceId,
  patientId,
  registers,
  authorisationNotices
}) => {
  const id = useId();
  const { draft, setDraft } = state;
  const [open, setOpen] = useState<boolean | null>(null);
  const [addingReferral, setAddingReferral] = useState(false);
  const checked = useMemo(() => validateClaimDetailsDraft(draft, visitDate || null), [draft, visitDate]);
  const choices = useMemo(() => referralsToPick(registers.referrals, visitDate), [registers.referrals, visitDate]);

  if (!hasMedicalAid || state.status === 'not_set_up' || state.status === 'loading') return null;

  const summary = checked.ok ? describeClaimDetails(checked.value) : 'Check the details below: the claim would refuse one';
  // Open when something is set, an authorisation needs checking, or a detail would be refused
  const expanded = open ?? (Boolean(summary) || authorisationNotices.length > 0 || !checked.ok);
  const errors: Partial<Record<ClaimDetailsField, string>> = checked.ok ? {} : checked.errors;
  const update = (changes: Partial<VisitClaimDetailsDraft>) => setDraft({ ...draft, ...changes });
  const referralChoice = draft.referralId ?? (draft.referringName || draft.referringPracticeNumber || draft.referralNumber || draft.referringHpcna ? TYPED : '');
  const placeLabel = placeOfServiceLabel(draft.placeOfService);

  const pickReferral = (value: string) => {
    if (value === TYPED) {
      update({ referralId: null });
      return;
    }
    const referral = registers.referrals.find(item => item.id === value);
    setDraft(referral ? draftWithReferral(draft, referral.id, referralDetailsOf(referral)) : draftWithoutReferral(draft));
  };

  const fieldError = (field: ClaimDetailsField) =>
    errors[field] ? <span id={`${id}-${field}-error`} className="mt-0.5 block text-red-700" role="alert">{errors[field]}</span> : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        aria-controls={`${id}-body`}
        className="flex w-full items-start gap-3 p-4 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <Icon icon="solar:document-medicine-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-700" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">Referral and hospital details</span>
          <span className="block text-xs text-gray-600 break-words">{summary || 'None: add them when a referral or a hospital stay goes on the claim'}</span>
        </span>
        <Icon icon={expanded ? 'solar:alt-arrow-up-bold-duotone' : 'solar:alt-arrow-down-bold-duotone'} className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
      </button>

      {expanded && (
        <div id={`${id}-body`} className="space-y-4 border-t border-gray-100 p-4 text-xs text-gray-600">
          {state.message && <p className="text-red-700" role="alert">{state.message}</p>}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">Who referred the patient</legend>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label>
                Referral
                <select value={referralChoice} onChange={event => pickReferral(event.target.value)} className={INPUT}>
                  <option value="">No referral</option>
                  {choices.map(({ referral, state: validity }) => (
                    <option key={referral.id} value={referral.id}>
                      {describeReferrer(referral)}
                      {validity === 'expired' ? ' (expired on the visit date)' : ''}
                    </option>
                  ))}
                  <option value={TYPED}>Not on the file: type the details</option>
                </select>
              </label>
              {practiceId && patientId && (
                <div className="self-end">
                  <button
                    type="button"
                    onClick={() => setAddingReferral(true)}
                    className="font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                  >
                    Add a referral letter to the patient file
                  </button>
                </div>
              )}
            </div>
            {referralChoice !== '' && (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                <label>
                  Referring practitioner
                  <input value={draft.referringName} maxLength={100} onChange={event => update({ referringName: event.target.value })} className={INPUT}
                    aria-invalid={errors.referringName ? true : undefined} aria-describedby={errors.referringName ? `${id}-referringName-error` : undefined} />
                  {fieldError('referringName')}
                </label>
                <label>
                  Their practice number
                  <input value={draft.referringPracticeNumber} inputMode="numeric" maxLength={20} onChange={event => update({ referringPracticeNumber: event.target.value })} className={INPUT}
                    aria-invalid={errors.referringPracticeNumber ? true : undefined} aria-describedby={errors.referringPracticeNumber ? `${id}-referringPracticeNumber-error` : undefined} />
                  {fieldError('referringPracticeNumber')}
                </label>
                <label>
                  Their HPCNA number
                  <input value={draft.referringHpcna} maxLength={20} onChange={event => update({ referringHpcna: event.target.value })} className={INPUT}
                    aria-invalid={errors.referringHpcna ? true : undefined} aria-describedby={errors.referringHpcna ? `${id}-referringHpcna-error` : undefined} />
                  {fieldError('referringHpcna')}
                </label>
                <label>
                  Referral number
                  <input value={draft.referralNumber} maxLength={15} onChange={event => update({ referralNumber: event.target.value })} className={INPUT}
                    aria-invalid={errors.referralNumber ? true : undefined} aria-describedby={errors.referralNumber ? `${id}-referralNumber-error` : undefined} />
                  {fieldError('referralNumber')}
                </label>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">Where the service was given</legend>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={draft.inHospital}
                onChange={event => update({ inHospital: event.target.checked, ...(event.target.checked ? {} : { admissionDate: '', dischargeDate: '' }) })}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              In hospital (the claim says H)
            </label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {draft.inHospital && (
                <>
                  <label>
                    Admitted on
                    <input type="date" value={draft.admissionDate} onChange={event => update({ admissionDate: event.target.value })} className={INPUT}
                      aria-invalid={errors.admissionDate ? true : undefined} aria-describedby={errors.admissionDate ? `${id}-admissionDate-error` : undefined} />
                    {fieldError('admissionDate')}
                  </label>
                  <label>
                    Discharged on
                    <input type="date" value={draft.dischargeDate} min={draft.admissionDate || undefined} onChange={event => update({ dischargeDate: event.target.value })} className={INPUT}
                      aria-invalid={errors.dischargeDate ? true : undefined} aria-describedby={errors.dischargeDate ? `${id}-dischargeDate-error` : undefined} />
                    {fieldError('dischargeDate')}
                  </label>
                </>
              )}
              <label>
                Place of service code
                <input value={draft.placeOfService} inputMode="numeric" maxLength={2} placeholder="For example 11" onChange={event => update({ placeOfService: event.target.value })} className={INPUT}
                  aria-invalid={errors.placeOfService ? true : undefined} aria-describedby={`${id}-placeOfService-hint`} />
                {fieldError('placeOfService') ?? (
                  <span id={`${id}-placeOfService-hint`} className="mt-0.5 block text-gray-500">
                    {placeLabel ?? 'The fund list: rooms 10-14, home 20-24, hospital admitted 40-46, out-patients 60-66, emergency 70-72, day clinic 80-83. Leave empty when the fund does not ask.'}
                  </span>
                )}
              </label>
            </div>
          </fieldset>

          {checked.ok && checked.warnings.length > 0 && (
            <ul className="space-y-1 text-amber-800">
              {checked.warnings.map(warning => (
                <li key={warning} className="flex items-start gap-1">
                  <Icon icon="solar:danger-triangle-bold-duotone" className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {warning}
                </li>
              ))}
            </ul>
          )}

          {authorisationNotices.length > 0 && (
            <ul className="space-y-1 text-amber-800" aria-label="Authorisations to check">
              {authorisationNotices.map(notice => (
                <li key={notice} className="flex items-start gap-1">
                  <Icon icon="solar:shield-check-bold-duotone" className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {notice}
                </li>
              ))}
            </ul>
          )}

          <p className="text-gray-500">
            Saved with the visit. Every claim line of this visit carries these details; a line can name its own referral under Change.
          </p>
        </div>
      )}

      {addingReferral && practiceId && patientId && (
        <ReferralSheet
          practiceId={practiceId}
          patientId={patientId}
          referral={null}
          overFullScreen
          onClose={() => setAddingReferral(false)}
          onSaved={() => {
            setAddingReferral(false);
            registers.reload();
          }}
        />
      )}
    </div>
  );
};

export default VisitClaimDetailsCard;
