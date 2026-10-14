import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { refreshAfterSave } from '../../lib/queryClient';
import { saveRound, type AdmissionDetail } from '../../services/inpatientService';
import { canDo, CONSCIOUSNESS, labelOf, ROUND_CONDITIONS } from '../../utils/inpatient/inpatientRules';
import { Chip, Field } from '../stock/stockParts';
import { INPUT, PRIMARY, day, dayTime, errorText } from '../stock/stockUi';
import { todayKey } from '../../utils/billing/dates';

const EMPTY = {
  patient_condition: 'stable',
  consciousness_level: 'alert',
  examination_findings: '',
  treatment_changes: '',
  new_orders: '',
  doctor_notes: '',
  next_review_date: '',
  vital_signs_reviewed: true,
  lab_results_reviewed: false,
  discharge_planning_started: false,
  family_updated: false
};

/** Ward rounds: a doctor's note per round (never changed afterwards: a correction is the next round) */
export const RoundsPanel: React.FC<{ data: AdmissionDetail; role: string | null; nameOf: (id: string | null | undefined) => string }> = ({ data, role, nameOf }) => {
  const active = data.admission.admission_status === 'active';
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof EMPTY, value: string | boolean) => setValues(current => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveRound(data.admission.id, { ...values, new_orders: values.new_orders.split('\n').map(line => line.trim()).filter(Boolean) });
      await refreshAfterSave('inpatient');
      setValues(EMPTY);
      toast.success('Round saved.');
    } catch (error) {
      toast.error(errorText(error, 'Could not save the round.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {active && canDo(role, 'round') && (
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-gray-50 p-3" noValidate aria-label="New round">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="How the patient is doing">
              {props => (
                <select {...props} value={values.patient_condition} onChange={event => set('patient_condition', event.target.value)} className={INPUT}>
                  {ROUND_CONDITIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Consciousness">
              {props => (
                <select {...props} value={values.consciousness_level} onChange={event => set('consciousness_level', event.target.value)} className={INPUT}>
                  {CONSCIOUSNESS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Findings" className="sm:col-span-2">
              {props => <textarea {...props} rows={2} value={values.examination_findings} onChange={event => set('examination_findings', event.target.value)} className={INPUT} maxLength={4000} />}
            </Field>
            <Field label="Treatment changes">
              {props => <textarea {...props} rows={2} value={values.treatment_changes} onChange={event => set('treatment_changes', event.target.value)} className={INPUT} maxLength={2000} />}
            </Field>
            <Field label="New orders" hint="One per line, e.g. FBC tomorrow">
              {props => <textarea {...props} rows={2} value={values.new_orders} onChange={event => set('new_orders', event.target.value)} className={INPUT} />}
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              {props => <textarea {...props} rows={2} value={values.doctor_notes} onChange={event => set('doctor_notes', event.target.value)} className={INPUT} maxLength={4000} />}
            </Field>
            <Field label="Next review">
              {props => <input {...props} type="date" min={todayKey()} value={values.next_review_date} onChange={event => set('next_review_date', event.target.value)} className={INPUT} />}
            </Field>
          </div>
          <div className="flex flex-wrap gap-x-5">
            {([['vital_signs_reviewed', 'Vitals reviewed'], ['lab_results_reviewed', 'Results reviewed'], ['family_updated', 'Family updated'],
              ['discharge_planning_started', 'Planning discharge']] as const).map(([key, label]) => (
              <label key={key} className="inline-flex min-h-[44px] items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={values[key]} onChange={event => set(key, event.target.checked)} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className={PRIMARY}>Save round</button>
          </div>
        </form>
      )}
      {active && !canDo(role, 'round') && <p className="text-sm text-gray-500">Doctors record ward rounds.</p>}

      {data.rounds.length === 0 ? (
        <p className="text-sm text-gray-500">No rounds yet.</p>
      ) : (
        <ol className="space-y-3">
          {data.rounds.map(round => (
            <li key={round.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{dayTime(round.round_datetime)} · {nameOf(round.doctor_id)}</p>
                <Chip tone={round.patient_condition === 'deteriorating' || round.patient_condition === 'critical' ? 'red' : 'green'}>{labelOf(ROUND_CONDITIONS, round.patient_condition)}</Chip>
              </div>
              {round.consciousness_level && <p className="text-xs text-gray-500">{labelOf(CONSCIOUSNESS, round.consciousness_level)}</p>}
              {round.examination_findings && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{round.examination_findings}</p>}
              {round.treatment_changes && <p className="mt-1 whitespace-pre-line text-sm text-gray-700"><span className="font-medium">Treatment: </span>{round.treatment_changes}</p>}
              {(round.new_orders ?? []).length > 0 && <p className="mt-1 text-sm text-gray-700"><span className="font-medium">Orders: </span>{(round.new_orders ?? []).join('; ')}</p>}
              {round.doctor_notes && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{round.doctor_notes}</p>}
              {round.next_review_date && <p className="mt-1 text-xs text-gray-500">Next review {day(round.next_review_date)}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
