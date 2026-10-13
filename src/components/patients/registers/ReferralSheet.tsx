import React, { useId, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../../finance/receipts/ArUi';
import { todayKey } from '../../../utils/billing/dates';
import {
  MAX_REFERRAL_NUMBER_LENGTH,
  MAX_REFERRAL_REASON_LENGTH,
  MAX_REFERRING_NAME_LENGTH,
  draftOfReferral,
  emptyReferralDraft,
  validateReferralDraft,
  type PatientReferral,
  type ReferralDraft,
  type ReferralField
} from '../../../utils/billing/referrals';
import { RECORDS_BUCKET, openRecord } from '../../../services/recordFiles';
import { supabase } from '../../../lib/supabase';
import { referralLetterProblem, savePatientReferral, uploadReferralLetter } from '../../../services/claimRegistersService';

interface ReferralSheetProps {
  practiceId: string;
  patientId: string;
  /** The referral to change; null for a new one */
  referral: PatientReferral | null;
  onClose: () => void;
  /** Saved: its id, so a visit can pick it straight away */
  onSaved: (referralId: string) => void;
  /** Opened over the full-screen visit */
  overFullScreen?: boolean;
}

/**
 * Adds or changes a referral on the patient's file (parity C10): who referred the patient (name, practice number,
 * HPCNA number), the referral number, the date of the letter and its last day, why, and the letter itself, kept in the
 * practice's private records. The database checks everything again (save_patient_referral).
 */
const ReferralSheet: React.FC<ReferralSheetProps> = ({ practiceId, patientId, referral, onClose, onSaved, overFullScreen = false }) => {
  const id = useId();
  const [today] = useState(() => todayKey());
  const [draft, setDraft] = useState<ReferralDraft>(() => (referral ? draftOfReferral(referral) : emptyReferralDraft(today)));
  const [letter, setLetter] = useState<{ path: string | null; name: string | null }>({ path: referral?.letterPath ?? null, name: referral?.letterName ?? null });
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const checked = validateReferralDraft(draft, today);
  const errors: Partial<Record<ReferralField, string>> = showErrors && !checked.ok ? checked.errors : {};
  const update = (key: ReferralField, value: string) => setDraft(current => ({ ...current, [key]: value }));

  const chooseFile = (chosen: File | null) => {
    setFile(chosen);
    setFileProblem(chosen ? referralLetterProblem(chosen) : null);
  };

  const save = async () => {
    setShowErrors(true);
    if (!checked.ok || fileProblem) return;
    setSaving(true);
    setSaveError(null);
    let uploaded: string | null = null;
    try {
      const stored = file ? await uploadReferralLetter(practiceId, patientId, file) : null;
      uploaded = stored?.path ?? null;
      const referralId = await savePatientReferral(referral?.id ?? null, patientId, {
        ...checked.value,
        letterPath: stored?.path ?? letter.path,
        letterName: stored?.name ?? letter.name
      });
      onSaved(referralId);
    } catch (error) {
      // A letter stored for a referral that was not saved is taken away again
      if (uploaded) void supabase.storage.from(RECORDS_BUCKET).remove([uploaded]);
      setSaveError(error instanceof Error ? plainWords(error.message) : 'The referral could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const openLetter = () => {
    if (letter.path) void openRecord(letter.path).catch(error => setSaveError(error instanceof Error ? plainWords(error.message) : 'The letter could not be opened.'));
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      overFullScreen={overFullScreen}
      title={referral ? 'Change referral' : 'Add a referral'}
      subtitle="A letter from another practitioner who referred this patient. Claims name the referring practitioner from it."
      icon="solar:document-medicine-bold-duotone"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton busy={saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save referral'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Referring practitioner" htmlFor={`${id}-name`} error={errors.referringName} hint="As the letter names them, for example Dr A Shikongo" className="sm:col-span-2">
            <input id={`${id}-name`} className={inputClass} maxLength={MAX_REFERRING_NAME_LENGTH} value={draft.referringName} onChange={event => update('referringName', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Their practice number" htmlFor={`${id}-practice`} error={errors.referringPracticeNumber} hint="The fund matches the referral by it">
            <input id={`${id}-practice`} className={inputClass} inputMode="numeric" maxLength={20} value={draft.referringPracticeNumber} onChange={event => update('referringPracticeNumber', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Their HPCNA number" htmlFor={`${id}-hpcna`} error={errors.referringHpcna}>
            <input id={`${id}-hpcna`} className={inputClass} maxLength={20} value={draft.referringHpcna} onChange={event => update('referringHpcna', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Referral number" htmlFor={`${id}-number`} error={errors.referralNumber} hint="If the fund or the letter gives one">
            <input id={`${id}-number`} className={inputClass} maxLength={MAX_REFERRAL_NUMBER_LENGTH} value={draft.referralNumber} onChange={event => update('referralNumber', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Date of the letter" htmlFor={`${id}-date`} error={errors.referralDate}>
            <input id={`${id}-date`} type="date" className={inputClass} max={today} value={draft.referralDate} onChange={event => update('referralDate', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Valid until (last day)" htmlFor={`${id}-until`} error={errors.validUntil} hint="Leave empty when the letter gives no end date">
            <input id={`${id}-until`} type="date" className={inputClass} min={draft.referralDate || undefined} value={draft.validUntil} onChange={event => update('validUntil', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Reason for the referral" htmlFor={`${id}-reason`} error={errors.reason} className="sm:col-span-2">
            <textarea id={`${id}-reason`} rows={2} className={inputClass} maxLength={MAX_REFERRAL_REASON_LENGTH} value={draft.reason} onChange={event => update('reason', event.target.value)} disabled={saving} />
          </Field>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-medium text-gray-700">The referral letter</p>
          {letter.path && !file && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Icon icon="solar:paperclip-bold-duotone" className="h-4 w-4 text-gray-500" aria-hidden="true" />
              <span className="min-w-0 break-all text-gray-800">{letter.name || 'Referral letter'}</span>
              <button type="button" onClick={openLetter} className="font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded">Open</button>
              <button type="button" onClick={() => setLetter({ path: null, name: null })} disabled={saving} className="font-medium text-gray-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded">Take off</button>
            </div>
          )}
          <label htmlFor={`${id}-file`} className="mt-2 block text-xs text-gray-500">
            {letter.path ? 'Replace it with' : 'Add it as'} a PDF or a photo (JPG or PNG, up to 10 MB). It is kept in the practice&apos;s private records.
          </label>
          <input
            id={`${id}-file`}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={event => chooseFile(event.target.files?.[0] ?? null)}
            disabled={saving}
            className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cyan-700 hover:file:bg-cyan-100"
          />
          {fileProblem && <p className="mt-1 text-xs text-red-600" role="alert">{fileProblem}</p>}
        </div>

        {saveError && <ErrorBox>{saveError}</ErrorBox>}
      </div>
    </Sheet>
  );
};

export default ReferralSheet;
