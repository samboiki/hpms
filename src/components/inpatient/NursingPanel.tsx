import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { ListSheet } from '../patientLists/ListSheet';
import VitalsForm from '../forms/VitalsForm';
import { useAuthStore } from '../../stores/authStore';
import { refreshAfterSave, queryClient } from '../../lib/queryClient';
import { loadVisitVitals, saveNursingRecord, type AdmissionDetail, type NursingRecord, type VitalsRow } from '../../services/inpatientService';
import { canDo, labelOf, MOBILITY, SHIFTS } from '../../utils/inpatient/inpatientRules';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, QUIET, SECONDARY, dayTime, errorText } from '../stock/stockUi';

/** The shift by the Windhoek clock: morning until 14:00, afternoon until 20:00, then night */
const shiftNow = (): string => {
  const minutes = windhoekClock(new Date()).minutes;
  return minutes < 14 * 60 && minutes >= 6 * 60 ? 'morning' : minutes >= 14 * 60 && minutes < 20 * 60 ? 'afternoon' : 'night';
};

const blank = () => ({
  shift_type: shiftNow(),
  patient_condition: '',
  pain_level: '',
  mobility_status: '',
  fluid_intake_ml: '',
  urine_output_ml: '',
  other_output_ml: '',
  skin_condition: '',
  bathed: false,
  position_changed: false,
  nursing_notes: '',
  handover_notes: '',
  vitals_ids: [] as string[]
});

type Values = ReturnType<typeof blank>;

const fromRecord = (record: NursingRecord): Values => ({
  shift_type: record.shift_type,
  patient_condition: record.patient_condition ?? '',
  pain_level: record.pain_level === null ? '' : String(record.pain_level),
  mobility_status: record.mobility_status ?? '',
  fluid_intake_ml: record.fluid_intake_ml === null ? '' : String(record.fluid_intake_ml),
  urine_output_ml: record.urine_output_ml === null ? '' : String(record.urine_output_ml),
  other_output_ml: record.other_output_ml === null ? '' : String(record.other_output_ml),
  skin_condition: record.skin_condition ?? '',
  bathed: !!record.bathed,
  position_changed: !!record.position_changed,
  nursing_notes: record.nursing_notes ?? '',
  handover_notes: record.handover_notes ?? '',
  vitals_ids: record.vitals_ids ?? []
});

const vitalsLine = (row: VitalsRow): string => [
  row.blood_pressure && `BP ${row.blood_pressure}`,
  row.pulse_rate !== null && `pulse ${row.pulse_rate}`,
  row.temperature !== null && `${row.temperature} °C`,
  row.respiratory_rate !== null && `breaths ${row.respiratory_rate}`,
  row.oxygen_saturation !== null && `SpO2 ${row.oxygen_saturation}%`
].filter(Boolean).join(', ') || 'Vitals';

/** Nursing care per shift: observations, intake and output, pain, mobility, notes and the handover */
export const NursingPanel: React.FC<{ data: AdmissionDetail; role: string | null; nameOf: (id: string | null | undefined) => string }> = ({ data, role, nameOf }) => {
  const me = useAuthStore(state => state.user?.id ?? null);
  const active = data.admission.admission_status === 'active';
  const visitId = data.admission.visit_id;
  const [editing, setEditing] = useState<{ id: string | null; values: Values } | null>(null);
  const [recordingVitals, setRecordingVitals] = useState(false);
  const [saving, setSaving] = useState(false);
  const vitals = useQuery({ queryKey: ['inpatient', 'vitals', visitId], queryFn: () => loadVisitVitals(visitId as string), enabled: !!visitId });
  const vitalsById = new Map((vitals.data ?? []).map(row => [row.id, row]));
  // Vitals of the last 12 hours can be linked to this shift's record
  const recent = (vitals.data ?? []).filter(row => row.created_at && Date.now() - new Date(row.created_at).getTime() < 12 * 3_600_000);

  const set = (key: keyof Values, value: string | boolean | string[]) =>
    setEditing(current => (current ? { ...current, values: { ...current.values, [key]: value } } : current));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await saveNursingRecord(editing.id, data.admission.id, editing.values);
      await refreshAfterSave('inpatient');
      setEditing(null);
      toast.success('Nursing record saved.');
    } catch (error) {
      toast.error(errorText(error, 'Could not save the nursing record.'));
    } finally {
      setSaving(false);
    }
  };

  const values = editing?.values;
  return (
    <div className="space-y-4">
      {active && canDo(role, 'nursing') && !editing && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing({ id: null, values: { ...blank(), vitals_ids: recent.map(row => row.id) } })} className={PRIMARY}>
            <Icon icon="solar:clipboard-heart-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            New shift record
          </button>
          {visitId && (
            <button type="button" onClick={() => setRecordingVitals(true)} className={SECONDARY}>
              <Icon icon="solar:heart-pulse-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Record vitals
            </button>
          )}
        </div>
      )}
      {active && !visitId && canDo(role, 'nursing') && (
        <p className="text-xs text-gray-500">Vitals are kept on a visit: link the stay to a visit (Summary, Change details) to record and link them here.</p>
      )}

      {editing && values && (
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-gray-50 p-3" noValidate aria-label={editing.id ? 'Change the shift record' : 'New shift record'}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Shift">
              {props => (
                <select {...props} value={values.shift_type} onChange={event => set('shift_type', event.target.value)} className={INPUT}>
                  {SHIFTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Pain (0 to 10)">
              {props => <input {...props} inputMode="numeric" value={values.pain_level} onChange={event => set('pain_level', event.target.value)} className={INPUT} />}
            </Field>
            <Field label="Moves">
              {props => (
                <select {...props} value={values.mobility_status} onChange={event => set('mobility_status', event.target.value)} className={INPUT}>
                  <option value="">Not recorded</option>
                  {MOBILITY.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Fluids in (ml)">
              {props => <input {...props} inputMode="numeric" value={values.fluid_intake_ml} onChange={event => set('fluid_intake_ml', event.target.value)} className={INPUT} />}
            </Field>
            <Field label="Urine out (ml)">
              {props => <input {...props} inputMode="numeric" value={values.urine_output_ml} onChange={event => set('urine_output_ml', event.target.value)} className={INPUT} />}
            </Field>
            <Field label="Other out (ml)">
              {props => <input {...props} inputMode="numeric" value={values.other_output_ml} onChange={event => set('other_output_ml', event.target.value)} className={INPUT} />}
            </Field>
            <Field label="Condition" className="col-span-2 sm:col-span-3">
              {props => <input {...props} value={values.patient_condition} onChange={event => set('patient_condition', event.target.value)} className={INPUT} maxLength={300} />}
            </Field>
            <Field label="Skin" className="col-span-2 sm:col-span-3">
              {props => <input {...props} value={values.skin_condition} onChange={event => set('skin_condition', event.target.value)} className={INPUT} maxLength={300} />}
            </Field>
            <Field label="Notes" className="col-span-2 sm:col-span-3">
              {props => <textarea {...props} rows={2} value={values.nursing_notes} onChange={event => set('nursing_notes', event.target.value)} className={INPUT} maxLength={4000} />}
            </Field>
            <Field label="Handover to the next shift" className="col-span-2 sm:col-span-3">
              {props => <textarea {...props} rows={2} value={values.handover_notes} onChange={event => set('handover_notes', event.target.value)} className={INPUT} maxLength={4000} />}
            </Field>
          </div>
          <div className="flex flex-wrap gap-x-5">
            {([['bathed', 'Washed'], ['position_changed', 'Turned']] as const).map(([key, label]) => (
              <label key={key} className="inline-flex min-h-[44px] items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={values[key]} onChange={event => set(key, event.target.checked)} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                {label}
              </label>
            ))}
          </div>
          {recent.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-gray-700">Vitals taken this shift</legend>
              {recent.map(row => (
                <label key={row.id} className="flex min-h-[44px] items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" checked={values.vitals_ids.includes(row.id)}
                    onChange={event => set('vitals_ids', event.target.checked ? [...values.vitals_ids, row.id] : values.vitals_ids.filter(id => id !== row.id))}
                    className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                  {dayTime(row.created_at)}: {vitalsLine(row)}
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setEditing(null)} className={SECONDARY}>Cancel</button>
            <button type="submit" disabled={saving} className={PRIMARY}>Save record</button>
          </div>
        </form>
      )}

      {data.nursing.length === 0 ? (
        <p className="text-sm text-gray-500">No nursing records yet.</p>
      ) : (
        <ol className="space-y-3">
          {data.nursing.map(record => (
            <li key={record.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{labelOf(SHIFTS, record.shift_type)} shift · {dayTime(record.shift_start_time)} · {nameOf(record.nurse_id)}</p>
                {active && record.nurse_id === me && !editing && (
                  <button type="button" onClick={() => setEditing({ id: record.id, values: fromRecord(record) })} className={QUIET}>Change</button>
                )}
              </div>
              <p className="text-sm text-gray-700">
                {[record.pain_level !== null && `Pain ${record.pain_level}/10`, record.mobility_status && labelOf(MOBILITY, record.mobility_status),
                  record.fluid_intake_ml !== null && `in ${record.fluid_intake_ml} ml`, record.urine_output_ml !== null && `urine ${record.urine_output_ml} ml`,
                  record.other_output_ml !== null && `other out ${record.other_output_ml} ml`, record.bathed && 'washed', record.position_changed && 'turned']
                  .filter(Boolean).join(' · ')}
              </p>
              {(record.vitals_ids ?? []).map(id => vitalsById.get(id)).filter((row): row is VitalsRow => !!row).map(row => (
                <p key={row.id} className="text-xs text-gray-500">{vitalsLine(row)}</p>
              ))}
              {record.patient_condition && <p className="mt-1 text-sm text-gray-700">{record.patient_condition}</p>}
              {record.nursing_notes && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{record.nursing_notes}</p>}
              {record.handover_notes && <p className="mt-1 whitespace-pre-line text-sm text-gray-700"><span className="font-medium">Handover: </span>{record.handover_notes}</p>}
            </li>
          ))}
        </ol>
      )}

      {recordingVitals && visitId && (
        <ListSheet open onClose={() => setRecordingVitals(false)} title="Record vitals" subtitle="Saved on the stay's visit">
          <VitalsForm
            visitId={visitId}
            onSuccess={() => {
              setRecordingVitals(false);
              void queryClient.invalidateQueries({ queryKey: ['inpatient', 'vitals', visitId] });
            }}
          />
        </ListSheet>
      )}
    </div>
  );
};
