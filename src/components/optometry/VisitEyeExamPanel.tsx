import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, QUIET, SECONDARY, errorText } from '../stock/stockUi';
import { formatServiceDate, todayKey } from '../../utils/billing/dates';
import { isOptometryPractice } from '../../utils/billing/tariffRules';
import { extractIcd10Codes } from '../../utils/billing/icd10';
import {
  loadPatientBasics,
  loadSlipHeading,
  loadVisitExam,
  saveExam,
  type PatientBasics,
  type SlipHeading,
  type VisitExamLoad
} from '../../services/optometry/optometryService';
import { emptyExamDraft, examDraftFrom, validateExamDraft, type ExamDraft, type ExamDraftErrors } from '../../utils/optometry/exam';
import { addToDiagnosis, suggestDiagnoses } from '../../utils/optometry/diagnosis';
import {
  EYE_LETTERS,
  compareEye,
  isEmptyRxDraft,
  rxDraftFrom,
  rxInCylinderForm,
  validateRxDraft
} from '../../utils/optometry/prescription';
import { IOP_METHODS, IOP_METHOD_LABELS, type IopMethod } from '../../utils/optometry/records';
import { ChangeLine, EyesNotSetUp } from './optometryParts';
import { CaseHistoryFields, ContactLensFitFields, KeratometryFields, OcularHealthFields } from './ExamFullParts';
import RxFields from './RxFields';
import { prescriptionSlipHtml, printSlip } from './slips';

interface VisitEyeExamPanelProps {
  /** practices.practice_type: the section shows for optometry practices only */
  practiceType: string | null;
  practiceId: string | null;
  patientId: string;
  visitId: string;
  /** The visit's diagnosis as typed (the suggested codes are added to it) */
  diagnosis: string;
  onDiagnosisChange: (next: string) => void;
}

const CLINICAL_ROLES = new Set(['doctor', 'nurse', 'admin']);
const nowTime = (): string => new Date().toTimeString().slice(0, 5);

/**
 * The visit's Eye exam section (optometry practices): vision, the refraction compared with the last prescription,
 * eye pressure, visual fields and a contact-lens fit, saved with one button. The refraction becomes the patient's new
 * prescription (printable at once), and the ICD-10 codes it points to are suggested for the diagnosis: ticked by the
 * practitioner, never added by themselves.
 */
const VisitEyeExamPanel: React.FC<VisitEyeExamPanelProps> = ({ practiceType, practiceId, patientId, visitId, diagnosis, onDiagnosisChange }) => {
  const optometry = isOptometryPractice(practiceType);
  const role = useAuthStore(state => state.user?.role ?? null);
  const canRecord = role !== null && CLINICAL_ROLES.has(role);
  const today = todayKey();
  const [load, setLoad] = useState<VisitExamLoad | { status: 'loading' } | { status: 'error'; message: string }>({ status: 'loading' });
  const [draft, setDraft] = useState<ExamDraft>(emptyExamDraft(today));
  const [errors, setErrors] = useState<ExamDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [slip, setSlip] = useState<{ heading: SlipHeading; patient: PatientBasics } | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    if (!optometry || !visitId) return;
    let cancelled = false;
    loadVisitExam(visitId, patientId)
      .then(result => {
        if (cancelled) return;
        setLoad(result);
        if (result.status === 'ready') setDraft(examDraftFrom(result.exam, result.prescriptions, today));
      })
      .catch((error: unknown) => !cancelled && setLoad({ status: 'error', message: errorText(error, 'Could not read the eye exam.') }));
    return () => {
      cancelled = true;
    };
  }, [optometry, visitId, patientId, today, version]);

  // Read ahead, so "Print the prescription" opens its window straight from the click (a browser blocks one opened later)
  useEffect(() => {
    if (!optometry || !practiceId) return;
    let cancelled = false;
    Promise.all([loadSlipHeading(practiceId), loadPatientBasics(patientId)])
      .then(([heading, patient]) => !cancelled && setSlip({ heading, patient }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [optometry, practiceId, patientId]);

  const refraction = useMemo(() => {
    if (isEmptyRxDraft(draft.refraction)) return null;
    const checked = validateRxDraft(draft.refraction, 'spectacles');
    return checked.ok ? checked.rx : null;
  }, [draft.refraction]);
  const suggestions = useMemo(() => (refraction ? suggestDiagnoses(refraction) : []), [refraction]);
  const inDiagnosis = useMemo(() => new Set(extractIcd10Codes(diagnosis)), [diagnosis]);
  useEffect(() => setPicked(new Set(suggestions.map(item => item.code))), [suggestions]);

  if (!optometry) return null;

  const set = (patch: Partial<ExamDraft>) => setDraft(current => ({ ...current, ...patch }));
  const ready = load.status === 'ready' ? load : null;
  const previous = ready?.earlier.find(rx => rx.kind === 'spectacles') ?? null;
  const savedRx = ready?.prescriptions.find(rx => rx.kind === 'spectacles') ?? null;

  const save = async () => {
    const checked = validateExamDraft(draft, { hasSavedExam: Boolean(ready?.exam), full: ready?.full === true });
    if (!checked.ok) {
      setErrors(checked.errors);
      toast.error('Check the marked boxes in the eye exam.');
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveExam({ ...checked.payload, visit_id: visitId });
      toast.success('Eye exam saved.');
      reload();
    } catch (failure) {
      toast.error(errorText(failure));
    } finally {
      setSaving(false);
    }
  };

  const print = () => {
    if (!savedRx || !slip) return;
    if (!printSlip(prescriptionSlipHtml(slip.heading, slip.patient, savedRx))) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
  };

  const transpose = () => {
    if (!refraction) return;
    const form = (refraction.right.cylinder ?? refraction.left.cylinder ?? 0) < 0 ? 'plus' : 'minus';
    set({ refraction: rxDraftFrom(rxInCylinderForm(refraction, form)) });
  };

  const vaInput = (field: 'vaUnaidedRight' | 'vaUnaidedLeft' | 'vaAidedRight' | 'vaAidedLeft', label: string) => (
    <Field label={label} error={errors[field]}>
      {props => (
        <input {...props} className={`${INPUT} px-2.5 py-2`} value={draft[field]} placeholder="6/6" autoComplete="off" disabled={!canRecord || saving} onChange={event => set({ [field]: event.target.value } as Partial<ExamDraft>)} />
      )}
    </Field>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-label="Eye exam">
      <div className="mb-4 flex items-center">
        <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 p-2 shadow-md">
          <Icon icon="solar:eye-bold-duotone" className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-lg font-semibold text-gray-800">Eye exam</h3>
          <p className="text-sm text-gray-600">Vision, refraction, pressure, fields and contact lenses</p>
        </div>
      </div>

      {load.status === 'loading' && <p className="text-sm text-gray-500" role="status">Loading the eye exam...</p>}
      {load.status === 'not_set_up' && <EyesNotSetUp compact />}
      {load.status === 'error' && (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <p className="text-sm text-red-700">{load.message}</p>
          <button type="button" className={SECONDARY} onClick={reload}>Try again</button>
        </div>
      )}

      {ready && (
        <div className="space-y-5">
          {!canRecord && <p className="text-xs text-gray-500">A practitioner, nurse or practice admin records the eye exam.</p>}

          {ready.full && (
            <CaseHistoryFields value={draft.history} errors={errors.history} disabled={!canRecord || saving} onChange={history => set({ history })} />
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-gray-800">Vision (distance)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {vaInput('vaUnaidedRight', `${EYE_LETTERS.right} without glasses`)}
              {vaInput('vaUnaidedLeft', `${EYE_LETTERS.left} without glasses`)}
              {vaInput('vaAidedRight', `${EYE_LETTERS.right} with own glasses`)}
              {vaInput('vaAidedLeft', `${EYE_LETTERS.left} with own glasses`)}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold text-gray-800">Refraction: the new spectacle prescription</legend>
            <div className="flex flex-wrap gap-2">
              {previous && canRecord && (
                <button type="button" className={QUIET} disabled={saving} onClick={() => set({ refraction: rxDraftFrom(previous) })}>
                  Start from the last prescription ({formatServiceDate(previous.prescribedOn)})
                </button>
              )}
              {refraction && canRecord && (refraction.right.cylinder || refraction.left.cylinder) && (
                <button type="button" className={QUIET} disabled={saving} onClick={transpose}>
                  Transpose (plus / minus cylinder)
                </button>
              )}
            </div>
            <RxFields value={draft.refraction} onChange={next => set({ refraction: next })} kind="spectacles" errors={errors.refraction} disabled={!canRecord || saving} />
            {refraction && previous && (
              <ChangeLine since={formatServiceDate(previous.prescribedOn)} change={{ right: compareEye(previous.right, refraction.right), left: compareEye(previous.left, refraction.left) }} />
            )}
            {!isEmptyRxDraft(draft.refraction) && (
              <Field label="Valid until" error={errors.validUntil} hint="Two years unless you change it">
                {props => <input {...props} type="date" className={`${INPUT} sm:w-56`} value={draft.validUntil} disabled={!canRecord || saving} onChange={event => set({ validUntil: event.target.value })} />}
              </Field>
            )}
          </fieldset>

          {suggestions.length > 0 && (
            <fieldset className="rounded-xl border border-green-200 bg-green-50/60 p-3">
              <legend className="px-1 text-sm font-semibold text-green-900">Suggested diagnosis (ICD-10)</legend>
              <p className="mb-2 text-xs text-green-900">From the refraction. Tick what applies; nothing is added until you press the button.</p>
              <ul className="space-y-1.5">
                {suggestions.map(item => (
                  <li key={item.code}>
                    <label className="flex items-start gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        checked={picked.has(item.code)}
                        disabled={inDiagnosis.has(item.code)}
                        onChange={() => setPicked(current => {
                          const next = new Set(current);
                          if (next.has(item.code)) next.delete(item.code);
                          else next.add(item.code);
                          return next;
                        })}
                      />
                      <span>
                        <span className="font-medium">{item.code} {item.label}</span>
                        <span className="block text-xs text-gray-600">{inDiagnosis.has(item.code) ? 'Already in the diagnosis' : item.reason}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${SECONDARY} mt-2`}
                disabled={suggestions.every(item => !picked.has(item.code) || inDiagnosis.has(item.code))}
                onClick={() => onDiagnosisChange(addToDiagnosis(diagnosis, suggestions.filter(item => picked.has(item.code))))}
              >
                Add to the diagnosis
              </button>
            </fieldset>
          )}

          {ready.full && (
            <KeratometryFields value={draft.keratometry} errors={errors.keratometry} disabled={!canRecord || saving} onChange={keratometry => set({ keratometry })} />
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-gray-800">Eye pressure (IOP)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['iopRight', 'iopLeft'] as const).map(field => (
                <Field key={field} label={`${field === 'iopRight' ? EYE_LETTERS.right : EYE_LETTERS.left} (mmHg)`} error={errors[field]}>
                  {props => (
                    <input
                      {...props}
                      className={`${INPUT} px-2.5 py-2 text-right tabular-nums`}
                      inputMode="decimal"
                      value={draft[field]}
                      disabled={!canRecord || saving}
                      onChange={event => set({ [field]: event.target.value, iopTime: draft.iopTime || nowTime() } as Partial<ExamDraft>)}
                    />
                  )}
                </Field>
              ))}
              <Field label="Method" error={errors.iopMethod}>
                {props => (
                  <select {...props} className={`${INPUT} px-2.5 py-2`} value={draft.iopMethod} disabled={!canRecord || saving} onChange={event => set({ iopMethod: event.target.value as IopMethod | '' })}>
                    <option value="">Choose</option>
                    {IOP_METHODS.map(method => (
                      <option key={method} value={method}>{IOP_METHOD_LABELS[method]}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Time measured" error={errors.iopTime}>
                {props => <input {...props} type="time" className={`${INPUT} px-2.5 py-2`} value={draft.iopTime} disabled={!canRecord || saving} onChange={event => set({ iopTime: event.target.value })} />}
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-gray-800">Visual fields</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Visual fields result">
              {([['', 'Not tested'], ['normal', 'Normal'], ['abnormal', 'Abnormal']] as const).map(([value, label]) => (
                <label key={value} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${draft.fieldsResult === value ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-gray-200 text-gray-700'}`}>
                  <input type="radio" name={`fields-${visitId}`} className="h-4 w-4 text-cyan-600 focus:ring-cyan-500" checked={draft.fieldsResult === value} disabled={!canRecord || saving} onChange={() => set({ fieldsResult: value })} />
                  {label}
                </label>
              ))}
            </div>
            {draft.fieldsResult && (
              <Field label="Result (optional)" error={errors.fieldsNote} hint="The test and what it showed, e.g. confrontation full, or the printout's summary" className="mt-2">
                {props => <input {...props} className={INPUT} value={draft.fieldsNote} maxLength={300} disabled={!canRecord || saving} onChange={event => set({ fieldsNote: event.target.value })} />}
              </Field>
            )}
          </fieldset>

          {ready.full && (
            <OcularHealthFields value={draft.ocular} errors={errors.ocular} disabled={!canRecord || saving} onChange={ocular => set({ ocular })} />
          )}

          <fieldset className="space-y-2">
            <legend className="sr-only">Contact lenses</legend>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" checked={draft.clFitted} disabled={!canRecord || saving} onChange={event => set({ clFitted: event.target.checked })} />
              Contact lenses fitted at this visit
            </label>
            {draft.clFitted && (
              <div className="space-y-2">
                <Field label="Lenses" error={errors.lensName} hint="Brand and product, as on the box">
                  {props => <input {...props} className={INPUT} value={draft.lensName} maxLength={80} disabled={!canRecord || saving} onChange={event => set({ lensName: event.target.value })} />}
                </Field>
                <RxFields value={draft.contactLens} onChange={next => set({ contactLens: next })} kind="contact_lenses" errors={errors.contactLens} disabled={!canRecord || saving} />
                {ready.full && (
                  <ContactLensFitFields value={draft.clFit} errors={errors.clFit} disabled={!canRecord || saving} onChange={clFit => set({ clFit })} />
                )}
                <Field label="How the lenses fit (optional)" error={errors.clFittingNote}>
                  {props => <textarea {...props} rows={2} className={INPUT} value={draft.clFittingNote} maxLength={500} disabled={!canRecord || saving} onChange={event => set({ clFittingNote: event.target.value })} />}
                </Field>
              </div>
            )}
          </fieldset>

          <Field label="Exam notes (optional)" error={errors.notes}>
            {props => <textarea {...props} rows={2} className={INPUT} value={draft.notes} maxLength={1000} disabled={!canRecord || saving} onChange={event => set({ notes: event.target.value })} />}
          </Field>

          {canRecord && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {savedRx && (
                <button type="button" className={SECONDARY} onClick={print} disabled={saving || !slip}>
                  <Icon icon="solar:printer-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  Print the prescription
                </button>
              )}
              <button type="button" className={PRIMARY} onClick={() => void save()} disabled={saving}>
                {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Save eye exam
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisitEyeExamPanel;
