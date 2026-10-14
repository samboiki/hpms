import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { refreshAfterSave } from '../../lib/queryClient';
import { prescribe, recordDose, stopMedication, type AdmissionDetail, type Medication } from '../../services/inpatientService';
import {
  canDo,
  dueDoses,
  DOSE_OUTCOMES,
  labelOf,
  ROUTES,
  shortTime,
  windhoekDay,
  type DoseOutcome,
  type DueDose
} from '../../utils/inpatient/inpatientRules';
import { Chip, Field } from '../stock/stockParts';
import { DANGER, INPUT, PRIMARY, QUIET, SECONDARY, dayTime, errorText } from '../stock/stockUi';

/** Times of day for the usual frequencies; the doctor can change them */
const TIMES: ReadonlyArray<{ label: string; times: string }> = [
  { label: 'Once a day', times: '08:00' },
  { label: 'Twice a day', times: '08:00, 20:00' },
  { label: 'Three times a day', times: '08:00, 14:00, 20:00' },
  { label: 'Four times a day', times: '06:00, 12:00, 18:00, 22:00' },
  { label: 'When needed', times: '' }
];

const EMPTY = { medication_name: '', generic_name: '', dosage: '', dosage_unit: 'mg', route: 'oral', frequency: 'Twice a day', times: '08:00, 20:00',
  duration_days: '', indication: '', special_instructions: '' };

const OUTCOME_TONE: Record<DoseOutcome, 'green' | 'red' | 'amber' | 'gray'> = { given: 'green', refused: 'red', missed: 'red', held: 'amber' };

/** The inpatient medication chart: what is prescribed, each dose given, missed, refused or held, and stopping a medicine */
export const MedicationPanel: React.FC<{ data: AdmissionDetail; role: string | null; nameOf: (id: string | null | undefined) => string }> = ({ data, role, nameOf }) => {
  const active = data.admission.admission_status === 'active';
  const [adding, setAdding] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [dose, setDose] = useState<{ med: Medication; due: DueDose; outcome: DoseOutcome; note: string } | null>(null);
  const [stopping, setStopping] = useState<{ med: Medication; reason: string } | null>(null);
  const set = (key: keyof typeof EMPTY, value: string) => setValues(current => ({ ...current, [key]: value }));
  const current = data.medications.filter(med => med.status === 'active' || med.status === 'held');
  const past = data.medications.filter(med => !current.includes(med));

  const run = async (action: () => Promise<unknown>, done: string, after: () => void) => {
    setSaving(true);
    try {
      await action();
      await refreshAfterSave('inpatient');
      after();
      toast.success(done);
    } catch (error) {
      toast.error(errorText(error, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  const submitPrescription = (event: React.FormEvent) => {
    event.preventDefault();
    const times = values.times.split(/[,\s]+/).filter(Boolean);
    void run(() => prescribe(data.admission.id, { ...values, scheduled_times: times }), `${values.medication_name} added to the chart.`, () => {
      setValues(EMPTY);
      setAdding(false);
    });
  };

  return (
    <div className="space-y-4">
      {active && canDo(role, 'prescribe') && !adding && (
        <button type="button" onClick={() => setAdding(true)} className={PRIMARY}>
          <Icon icon="solar:pill-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Prescribe
        </button>
      )}
      {adding && (
        <form onSubmit={submitPrescription} className="space-y-3 rounded-xl bg-gray-50 p-3" noValidate aria-label="Prescribe">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Medicine" className="col-span-2">
              {props => <input {...props} value={values.medication_name} onChange={event => set('medication_name', event.target.value)} className={INPUT} maxLength={200} autoFocus />}
            </Field>
            <Field label="Dose">
              {props => <input {...props} value={values.dosage} onChange={event => set('dosage', event.target.value)} className={INPUT} maxLength={60} placeholder="500" />}
            </Field>
            <Field label="Unit">
              {props => <input {...props} value={values.dosage_unit} onChange={event => set('dosage_unit', event.target.value)} className={INPUT} maxLength={20} />}
            </Field>
            <Field label="How">
              {props => (
                <select {...props} value={values.route} onChange={event => set('route', event.target.value)} className={INPUT}>
                  {ROUTES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="How often">
              {props => (
                <select {...props} value={values.frequency}
                  onChange={event => {
                    const preset = TIMES.find(option => option.label === event.target.value);
                    setValues(current => ({ ...current, frequency: event.target.value, times: preset ? preset.times : current.times }));
                  }}
                  className={INPUT}>
                  {TIMES.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Times of day" hint="e.g. 08:00, 20:00" className="col-span-2">
              {props => <input {...props} value={values.times} onChange={event => set('times', event.target.value)} className={INPUT} />}
            </Field>
            <Field label="Days" hint="Empty: until stopped">
              {props => <input {...props} inputMode="numeric" value={values.duration_days} onChange={event => set('duration_days', event.target.value)} className={INPUT} />}
            </Field>
            <Field label="For" className="col-span-2 sm:col-span-3">
              {props => <input {...props} value={values.indication} onChange={event => set('indication', event.target.value)} className={INPUT} maxLength={300} />}
            </Field>
            <Field label="Instructions" className="col-span-2 sm:col-span-3">
              {props => <input {...props} value={values.special_instructions} onChange={event => set('special_instructions', event.target.value)} className={INPUT} maxLength={1000} />}
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAdding(false)} className={SECONDARY}>Cancel</button>
            <button type="submit" disabled={saving} className={PRIMARY}>Add to the chart</button>
          </div>
        </form>
      )}

      {current.length === 0 ? (
        <p className="text-sm text-gray-500">No medicines on the chart.</p>
      ) : (
        <ul className="space-y-3">
          {current.map(med => {
            const today = windhoekDay(new Date());
            const doses = dueDoses({ startDatetime: med.start_datetime, endDatetime: med.end_datetime, scheduledTimes: med.scheduled_times ?? [],
              records: med.administration_records ?? [] });
            return (
              <li key={med.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{med.medication_name} {med.dosage}{med.dosage_unit ? ` ${med.dosage_unit}` : ''}</p>
                    <p className="text-xs text-gray-500">
                      {labelOf(ROUTES, med.route)} · {med.frequency}
                      {(med.scheduled_times ?? []).length > 0 && ` at ${(med.scheduled_times ?? []).map(shortTime).join(', ')}`}
                      {med.end_datetime && ` · until ${dayTime(med.end_datetime)}`} · {nameOf(med.prescribed_by)}
                    </p>
                    {med.special_instructions && <p className="text-xs text-gray-600">{med.special_instructions}</p>}
                  </div>
                  {active && canDo(role, 'prescribe') && (
                    <button type="button" onClick={() => setStopping({ med, reason: '' })} className={QUIET}>Stop</button>
                  )}
                </div>
                {doses.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Doses of ${med.medication_name}`}>
                    {doses.map(due => (
                      <li key={due.dueAt}>
                        {due.record ? (
                          <Chip tone={OUTCOME_TONE[due.record.outcome]}>
                            {due.date !== today && 'Yesterday '}{due.time} {labelOf(DOSE_OUTCOMES, due.record.outcome)}
                            {due.record.recorded_by ? ` · ${nameOf(due.record.recorded_by)}` : ''}
                          </Chip>
                        ) : active && canDo(role, 'giveDose') ? (
                          <button type="button" onClick={() => setDose({ med, due, outcome: 'given', note: '' })}
                            className={`rounded-full px-3 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${due.late ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 'bg-cyan-50 text-cyan-800 ring-1 ring-cyan-100'}`}>
                            {due.date !== today && 'Yesterday '}{due.time} {due.late ? 'late: record' : 'due: record'}
                          </button>
                        ) : (
                          <Chip tone={due.late ? 'red' : 'cyan'}>{due.date !== today && 'Yesterday '}{due.time} {due.late ? 'late' : 'due'}</Chip>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {dose?.med.id === med.id && (
                  <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-900">Dose due {dose.due.date !== today ? 'yesterday at ' : ''}{dose.due.time}</p>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What happened">
                      {DOSE_OUTCOMES.map(option => (
                        <button key={option.value} type="button" role="radio" aria-checked={dose.outcome === option.value}
                          onClick={() => setDose({ ...dose, outcome: option.value })}
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${dose.outcome === option.value ? 'bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-200' : 'text-gray-600 hover:bg-white'}`}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {dose.outcome !== 'given' && (
                      <Field label="Why">
                        {props => <input {...props} value={dose.note} onChange={event => setDose({ ...dose, note: event.target.value })} className={INPUT} maxLength={500} />}
                      </Field>
                    )}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setDose(null)} className={SECONDARY}>Cancel</button>
                      <button type="button" disabled={saving}
                        onClick={() => void run(() => recordDose(med.id, dose.due.dueAt, dose.outcome, dose.note || null), `${med.medication_name}: ${labelOf(DOSE_OUTCOMES, dose.outcome).toLowerCase()}.`, () => setDose(null))}
                        className={PRIMARY}>
                        Record
                      </button>
                    </div>
                  </div>
                )}
                {stopping?.med.id === med.id && (
                  <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3">
                    <Field label={`Why stop ${med.medication_name}`}>
                      {props => <input {...props} value={stopping.reason} onChange={event => setStopping({ ...stopping, reason: event.target.value })} className={INPUT} maxLength={500} autoFocus />}
                    </Field>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setStopping(null)} className={SECONDARY}>Cancel</button>
                      <button type="button" disabled={saving}
                        onClick={() => void run(() => stopMedication(med.id, stopping.reason), `${med.medication_name} stopped.`, () => setStopping(null))}
                        className={DANGER}>
                        Stop the medicine
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 && (
        <details className="rounded-xl bg-gray-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">Stopped and finished ({past.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {past.map(med => (
              <li key={med.id}>
                {med.medication_name} {med.dosage}{med.dosage_unit ? ` ${med.dosage_unit}` : ''}:{' '}
                {med.status === 'discontinued' ? `stopped ${dayTime(med.discontinued_at)} (${med.discontinuation_reason ?? ''})` : `finished ${dayTime(med.end_datetime)}`}
                {' · '}{(med.administration_records ?? []).filter(record => record.outcome === 'given').length} doses given
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
