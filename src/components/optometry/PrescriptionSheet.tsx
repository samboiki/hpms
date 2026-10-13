import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, SECONDARY, errorText } from '../stock/stockUi';
import { todayKey, isValidDateKey } from '../../utils/billing/dates';
import {
  RX_KIND_LABELS,
  defaultValidUntil,
  emptyRxDraft,
  rxDraftFrom,
  validateRxDraft,
  type RxDraft,
  type RxDraftErrors,
  type RxKind
} from '../../utils/optometry/prescription';
import { rxJson, type PrescriptionRecord } from '../../utils/optometry/records';
import { savePrescription } from '../../services/optometry/optometryService';
import RxFields from './RxFields';

interface PrescriptionSheetProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  /** Correcting a prescription: it is kept, marked "corrected", and the new one takes its place */
  replaces?: PrescriptionRecord | null;
  onSaved: () => void;
}

/**
 * A prescription written outside an eye exam: one the patient brought from another practitioner, or a correction of
 * a saved one. Prescriptions from an exam are recorded in the visit's Eye exam section.
 */
const PrescriptionSheet: React.FC<PrescriptionSheetProps> = ({ open, onClose, patientId, replaces = null, onSaved }) => {
  const today = todayKey();
  const [kind, setKind] = useState<RxKind>('spectacles');
  const [draft, setDraft] = useState<RxDraft>(emptyRxDraft());
  const [prescribedOn, setPrescribedOn] = useState(today);
  const [validUntil, setValidUntil] = useState(defaultValidUntil('spectacles', today));
  const [source, setSource] = useState('');
  const [lensName, setLensName] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<RxDraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(replaces?.kind ?? 'spectacles');
    setDraft(replaces ? rxDraftFrom(replaces) : emptyRxDraft());
    setPrescribedOn(replaces?.prescribedOn ?? today);
    setValidUntil(replaces?.validUntil ?? defaultValidUntil(replaces?.kind ?? 'spectacles', replaces?.prescribedOn ?? today));
    setSource(replaces?.outsideSource ?? '');
    setLensName(replaces?.lensName ?? '');
    setNotes(replaces?.notes ?? '');
    setErrors({});
    setFormError(null);
  }, [open, replaces, today]);

  const changeKind = (next: RxKind) => {
    setKind(next);
    if (isValidDateKey(prescribedOn)) setValidUntil(defaultValidUntil(next, prescribedOn));
  };
  const changeDate = (next: string) => {
    setPrescribedOn(next);
    if (isValidDateKey(next)) setValidUntil(defaultValidUntil(kind, next));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateRxDraft(draft, kind);
    setErrors(checked.ok ? {} : checked.errors);
    if (!isValidDateKey(prescribedOn) || prescribedOn > today) {
      setFormError('Give the day it was prescribed (not a day still to come).');
      return;
    }
    if (validUntil && (!isValidDateKey(validUntil) || validUntil < prescribedOn)) {
      setFormError('"Valid until" is on or after the day it was prescribed.');
      return;
    }
    if (!checked.ok) {
      setFormError('Check the marked boxes.');
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      await savePrescription({
        patient_id: patientId,
        kind,
        prescribed_on: prescribedOn,
        replaces: replaces?.id ?? null,
        ...rxJson(checked.rx, { validUntil, lensName: kind === 'contact_lenses' ? lensName : null, notes, outsideSource: source })
      });
      toast.success(replaces ? 'Prescription corrected. The old one is kept, marked corrected.' : 'Prescription saved.');
      onSaved();
      onClose();
    } catch (failure) {
      setFormError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      size="lg"
      title={replaces ? 'Correct the prescription' : 'Add a prescription'}
      subtitle={replaces ? 'The old one stays in the history, marked corrected.' : 'For a prescription from another practitioner, or written outside an eye exam.'}
      dismissible={!busy}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {formError && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{formError}</p>}
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="optometry-rx-form" className={PRIMARY} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Save prescription
          </button>
        </div>
      }
    >
      <form id="optometry-rx-form" onSubmit={save} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {!replaces && (
            <Field label="For">
              {props => (
                <select {...props} className={INPUT} value={kind} onChange={event => changeKind(event.target.value as RxKind)}>
                  {(['spectacles', 'contact_lenses'] as const).map(option => (
                    <option key={option} value={option}>{RX_KIND_LABELS[option]}</option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Prescribed on">
            {props => <input {...props} type="date" className={INPUT} value={prescribedOn} max={today} onChange={event => changeDate(event.target.value)} />}
          </Field>
          <Field label="Valid until" hint="Spectacles 2 years, contact lenses 1 year, unless you change it">
            {props => <input {...props} type="date" className={INPUT} value={validUntil} min={prescribedOn} onChange={event => setValidUntil(event.target.value)} />}
          </Field>
        </div>
        <Field label="From another practitioner (optional)" hint="Their name or practice, when the patient brought the prescription">
          {props => <input {...props} className={INPUT} value={source} maxLength={120} onChange={event => setSource(event.target.value)} />}
        </Field>
        {kind === 'contact_lenses' && (
          <Field label="Lenses" hint="Brand and product, e.g. as on the box">
            {props => <input {...props} className={INPUT} value={lensName} maxLength={80} onChange={event => setLensName(event.target.value)} />}
          </Field>
        )}
        <RxFields value={draft} onChange={setDraft} kind={kind} errors={errors} disabled={busy} />
        <Field label="Notes (optional)" hint="E.g. for driving, for computer work">
          {props => <textarea {...props} rows={2} className={INPUT} value={notes} maxLength={500} onChange={event => setNotes(event.target.value)} />}
        </Field>
      </form>
    </ListSheet>
  );
};

export default PrescriptionSheet;
