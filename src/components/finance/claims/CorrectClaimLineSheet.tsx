import React, { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { formatServiceDate, todayKey } from '../../../utils/billing/dates';
import DateInput from '../../ui/DateInput';
import Icd10CodeInput from '../../billing/Icd10CodeInput';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { correctionPlan, type CorrectionBilling, type CorrectionDraft, type SentLineValues } from './claimCorrections';
import { correctClaimLine, loadCorrectionChoices, type PersonOption } from './claimCorrectionsService';

export interface CorrectClaimLineSheetProps {
  practiceId: string;
  /** The sent line: where it is and what it is for */
  line: { id: string; batchNumber: number; lineNumber: number; tariffCode: string; invoiceNumber: string; membershipNumber: string; patientName: string };
  /** What the fund received on it */
  sent: SentLineValues;
  fundName: string;
  onClose: () => void;
  /** It was corrected: what to tell staff */
  onDone: (message: string) => void;
}

/**
 * Corrects a line the fund was already sent and sends it again (parity D23), without waiting for the fund to refuse
 * it: the date, the dependant (another member of the family on the same membership number), the ICD-10 codes, the
 * treating practitioner or the authorisation number. A copy goes into the fund's open batch with claim field 32 set
 * to R; the sent batch is never changed. Date, practitioner and codes are put on the invoice line too, and the
 * invoice's history records who changed what and when (claim_line_correct). Another practitioner also moves the line to
 * their own practice number, else the practice's (the partner-billing rule), and the confirmation says so.
 */
const CorrectClaimLineSheet: React.FC<CorrectClaimLineSheetProps> = ({ practiceId, line, sent, fundName, onClose, onDone }) => {
  const [choices, setChoices] = useState<{ family: PersonOption[]; practitioners: PersonOption[]; billing: CorrectionBilling | null } | null>(null);
  const [choicesError, setChoicesError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CorrectionDraft>({
    serviceDate: sent.serviceDate ?? '',
    patientId: sent.patientId ?? '',
    icd10: { primary: sent.icd10[0] ?? '', secondary: sent.icd10.slice(1) },
    practitionerId: sent.practitionerId ?? '',
    authorisationNumber: sent.authorisationNumber
  });
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [today] = useState(() => todayKey());

  useEffect(() => {
    let cancelled = false;
    loadCorrectionChoices(practiceId, line.membershipNumber)
      .then(result => {
        if (!cancelled) setChoices(result);
      })
      .catch(error => {
        if (!cancelled) setChoicesError(error instanceof Error ? plainWords(error.message) : 'The family and practitioners could not be loaded');
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, line.membershipNumber]);

  const nameOf = (options: PersonOption[] | undefined, id: string) => options?.find(option => option.id === id)?.name;
  // Another practitioner bills the line under their own practice number, else the practice's: the confirmation says which
  const plan = useMemo(
    () => correctionPlan(
      sent,
      draft,
      today,
      { patient: nameOf(choices?.family, draft.patientId), practitioner: nameOf(choices?.practitioners, draft.practitionerId) },
      choices?.billing ?? null
    ),
    [sent, draft, today, choices]
  );
  const update = <K extends keyof CorrectionDraft>(key: K, value: CorrectionDraft[K]) => setDraft(previous => ({ ...previous, [key]: value }));

  const save = async () => {
    if (plan.errors.length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await correctClaimLine(line.id, plan.changes, note.trim() || null);
      onDone(
        `Line ${line.lineNumber} of batch ${line.batchNumber} was corrected and added to batch ${result.batchNumber ?? ''} with resubmission flag R; ` +
          `it goes to ${fundName} with that batch.${result.invoiceLineUpdated ? ` Invoice ${line.invoiceNumber} says the same now.` : ''}`
      );
    } catch (error) {
      setSaveError(error instanceof Error ? plainWords(error.message) : 'The line could not be corrected');
      setStep('edit');
    } finally {
      setSaving(false);
    }
  };

  // The current family member and practitioner are offered even when the lists could not be read
  const family = choices?.family.length ? choices.family : sent.patientId ? [{ id: sent.patientId, name: line.patientName || 'Patient claimed for' }] : [];
  const practitioners = choices?.practitioners ?? [];

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title={`Correct and send again: line ${line.lineNumber}`}
      subtitle={`Batch ${line.batchNumber} · code ${line.tariffCode} · invoice ${line.invoiceNumber} · ${fundName}`}
      icon="solar:restart-bold-duotone"
      tone="cyan"
      footer={step === 'edit' ? (
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton icon="solar:arrow-right-bold-duotone" disabled={plan.errors.length > 0} onClick={() => setStep('confirm')}>Review</PrimaryButton>
        </>
      ) : (
        <>
          <SecondaryButton onClick={() => setStep('edit')} disabled={saving}>Back</SecondaryButton>
          <PrimaryButton icon="solar:restart-bold-duotone" busy={saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Correct and send again'}</PrimaryButton>
        </>
      )}
    >
      {step === 'edit' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Change what was wrong. A corrected copy waits in {fundName}&apos;s open batch with resubmission flag R; the batch that was sent stays as it was.
          </p>
          {choicesError && <ErrorBox>{choicesError}</ErrorBox>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateInput label="Date of service" value={draft.serviceDate} onChange={value => update('serviceDate', value)} maxDate={today} />
            <Field label="Claimed for" htmlFor="correct-patient" hint={family.length > 1 ? 'Family members on the same membership number' : 'Nobody else is on this membership number'}>
              <select id="correct-patient" className={inputClass} value={draft.patientId} onChange={event => update('patientId', event.target.value)} disabled={saving || family.length <= 1}>
                {family.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </Field>
            <Field label="Treating practitioner" htmlFor="correct-practitioner" hint="Practitioners with an HPCNA number">
              <select id="correct-practitioner" className={inputClass} value={draft.practitionerId} onChange={event => update('practitionerId', event.target.value)} disabled={saving}>
                {!practitioners.some(person => person.id === draft.practitionerId) && <option value={draft.practitionerId}>As sent</option>}
                {practitioners.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </Field>
            <Field label="Authorisation number" htmlFor="correct-authorisation" hint={sent.authorisationNumber ? `Sent: ${sent.authorisationNumber}` : 'None was sent'}>
              <input id="correct-authorisation" className={inputClass} maxLength={21} value={draft.authorisationNumber} onChange={event => update('authorisationNumber', event.target.value)} disabled={saving} />
            </Field>
          </div>
          <Icd10CodeInput value={draft.icd10} onChange={value => update('icd10', value)} disabled={saving} />
          <Field label="Note (optional)" htmlFor="correct-note" hint="Kept in the invoice's history">
            <input id="correct-note" className={inputClass} maxLength={200} value={note} onChange={event => setNote(event.target.value)} disabled={saving} />
          </Field>
          {plan.errors.length > 0 && <ErrorBox>{plan.errors.join(' ')}</ErrorBox>}
          {saveError && <ErrorBox>{saveError}</ErrorBox>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-900">Sent on {formatServiceDate(sent.serviceDate)} for {line.patientName || 'the patient'}. What changes:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
            {plan.changed.map(change => <li key={change}>{change}</li>)}
          </ul>
          <p className="text-xs text-gray-500">The invoice&apos;s history records it with your name and the time. A refusal of this line waiting in Rejections is closed as resubmitted.</p>
        </div>
      )}
    </Sheet>
  );
};

export default CorrectClaimLineSheet;
