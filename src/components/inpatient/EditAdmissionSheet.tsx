import React, { useId, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { ListSheet } from '../patientLists/ListSheet';
import Icd10CodeInput from '../billing/Icd10CodeInput';
import { refreshAfterSave } from '../../lib/queryClient';
import { loadPatientVisits, updateAdmission, type AdmissionDetail } from '../../services/inpatientService';
import { icd10SelectionOf, type Icd10Selection } from '../../utils/billing/icd10';
import { ADMISSION_CONDITIONS } from '../../utils/inpatient/inpatientRules';
import { Field } from '../stock/stockParts';
import { INPUT, LABEL, PRIMARY, SECONDARY, day, errorText } from '../stock/stockUi';
import { patientName, useStaff } from './inpatientData';

/** Change a stay's details while the patient is admitted: doctor, condition, diagnosis, authorisation, visit, flags */
export const EditAdmissionSheet: React.FC<{ data: AdmissionDetail; practiceId: string; onClose: () => void }> = ({ data, practiceId, onClose }) => {
  const formId = useId();
  const { admission } = data;
  const { doctors } = useStaff(practiceId);
  const visits = useQuery({ queryKey: ['inpatient', 'visits', admission.patient_id], queryFn: () => loadPatientVisits(admission.patient_id) });
  const [codes, setCodes] = useState<Icd10Selection>(icd10SelectionOf([admission.primary_diagnosis_code, ...(admission.secondary_diagnosis_codes ?? [])].filter((code): code is string => !!code)));
  const [values, setValues] = useState({
    visit_id: admission.visit_id ?? '',
    attending_doctor_id: admission.attending_doctor_id ?? '',
    patient_condition: admission.patient_condition ?? 'stable',
    chief_complaint: admission.chief_complaint ?? '',
    primary_diagnosis: admission.primary_diagnosis ?? '',
    pre_authorization_number: admission.pre_authorization_number ?? '',
    expected_discharge_date: admission.expected_discharge_date ?? '',
    isolation_required: !!admission.isolation_required,
    isolation_type: admission.isolation_type ?? '',
    fall_risk: !!admission.fall_risk,
    allergy_alert: !!admission.allergy_alert
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values, value: string | boolean) => setValues(current => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateAdmission(admission.id, { ...values, visit_id: values.visit_id || null, attending_doctor_id: values.attending_doctor_id || null,
        primary_diagnosis_code: codes.primary, secondary_diagnosis_codes: codes.secondary });
      await refreshAfterSave('inpatient');
      toast.success('Stay saved.');
      onClose();
    } catch (error) {
      toast.error(errorText(error, 'Could not save the stay.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet open onClose={onClose} size="lg" title={`Change ${patientName(admission)}'s stay`} subtitle={admission.admission_number} dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form={formId} disabled={saving} className={PRIMARY}>Save</button>
        </div>
      }>
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Why admitted" className="sm:col-span-2">
            {props => <textarea {...props} rows={2} value={values.chief_complaint} onChange={event => set('chief_complaint', event.target.value)} className={INPUT} maxLength={2000} />}
          </Field>
          <Field label="Attending doctor">
            {props => (
              <select {...props} value={values.attending_doctor_id} onChange={event => set('attending_doctor_id', event.target.value)} className={INPUT}>
                <option value="">Not recorded</option>
                {doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Condition">
            {props => (
              <select {...props} value={values.patient_condition} onChange={event => set('patient_condition', event.target.value)} className={INPUT}>
                {ADMISSION_CONDITIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Visit" hint="The stay is billed on this visit">
            {props => (
              <select {...props} value={values.visit_id} onChange={event => set('visit_id', event.target.value)} className={INPUT}>
                <option value="">No visit</option>
                {(visits.data ?? []).map(visit => <option key={visit.id} value={visit.id}>{day(visit.visit_date ?? visit.scheduled_date)}{visit.chief_complaint ? `: ${visit.chief_complaint.slice(0, 40)}` : ''}</option>)}
              </select>
            )}
          </Field>
          <Field label="Expected to go home">
            {props => <input {...props} type="date" value={values.expected_discharge_date} onChange={event => set('expected_discharge_date', event.target.value)} className={INPUT} />}
          </Field>
          <Field label="Medical aid authorisation number" className="sm:col-span-2">
            {props => <input {...props} value={values.pre_authorization_number} onChange={event => set('pre_authorization_number', event.target.value)} className={INPUT} maxLength={40} />}
          </Field>
        </div>
        <Icd10CodeInput value={codes} onChange={setCodes} label="Diagnosis (ICD-10)" required={false} />
        <Field label="Diagnosis in words">
          {props => <input {...props} value={values.primary_diagnosis} onChange={event => set('primary_diagnosis', event.target.value)} className={INPUT} maxLength={300} />}
        </Field>
        <fieldset className="space-y-1">
          <legend className={LABEL}>Safety</legend>
          {([['fall_risk', 'Fall risk'], ['allergy_alert', 'Allergies'], ['isolation_required', 'Needs isolation']] as const).map(([key, label]) => (
            <label key={key} className="flex min-h-[44px] items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={values[key]} onChange={event => set(key, event.target.checked)} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              {label}
            </label>
          ))}
          {values.isolation_required && (
            <Field label="Kind of isolation">
              {props => <input {...props} value={values.isolation_type} onChange={event => set('isolation_type', event.target.value)} className={INPUT} maxLength={80} />}
            </Field>
          )}
        </fieldset>
      </form>
    </ListSheet>
  );
};
