import React, { useId, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { refreshAfterSave } from '../../lib/queryClient';
import { dischargePatient, type AdmissionDetail } from '../../services/inpatientService';
import { todayKey } from '../../utils/billing/dates';
import { ADMISSION_CONDITIONS, DISCHARGE_TYPES } from '../../utils/inpatient/inpatientRules';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, SECONDARY, errorText } from '../stock/stockUi';
import { patientName } from './inpatientData';

/**
 * Discharge: how the patient leaves, the instructions and the follow-up. The bed goes to "needs cleaning", the chart's
 * medicines end and visitors are signed out; then the stay is billed (BillStaySheet opens next).
 */
export const DischargeSheet: React.FC<{ data: AdmissionDetail; onClose: () => void; onDischarged: () => void }> = ({ data, onClose, onDischarged }) => {
  const formId = useId();
  const [values, setValues] = useState({
    discharge_type: 'home',
    discharge_disposition: '',
    patient_condition: data.admission.patient_condition ?? 'stable',
    discharge_instructions: '',
    follow_up_date: ''
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  const activeMedicines = data.medications.filter(med => med.status === 'active').length;
  const visitorsIn = data.visitors.filter(visitor => !visitor.check_out_time).length;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await dischargePatient(data.admission.id, values);
      await refreshAfterSave('inpatient');
      toast.success(`${patientName(data.admission)} discharged. The bed is marked for cleaning.`);
      onDischarged();
    } catch (error) {
      toast.error(errorText(error, 'Could not discharge the patient.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet open onClose={onClose} title={`Discharge ${patientName(data.admission)}`} subtitle={data.admission.admission_number} dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form={formId} disabled={saving} className={PRIMARY}>Discharge</button>
        </div>
      }>
      <form id={formId} onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Leaves">
          {props => (
            <select {...props} value={values.discharge_type} onChange={event => set('discharge_type', event.target.value)} className={INPUT} autoFocus>
              {DISCHARGE_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
        {values.discharge_type !== 'home' && values.discharge_type !== 'expired' && (
          <Field label="Goes to" className="sm:col-span-2" hint="e.g. the hospital or facility">
            {props => <input {...props} value={values.discharge_disposition} onChange={event => set('discharge_disposition', event.target.value)} className={INPUT} maxLength={300} />}
          </Field>
        )}
        <Field label="Instructions for the patient" className="sm:col-span-2" hint="Printed on the discharge summary">
          {props => <textarea {...props} rows={4} value={values.discharge_instructions} onChange={event => set('discharge_instructions', event.target.value)} className={INPUT} maxLength={4000} />}
        </Field>
        {values.discharge_type !== 'expired' && (
          <Field label="Follow-up" hint="Optional">
            {props => <input {...props} type="date" min={todayKey()} value={values.follow_up_date} onChange={event => set('follow_up_date', event.target.value)} className={INPUT} />}
          </Field>
        )}
        {(activeMedicines > 0 || visitorsIn > 0) && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700 sm:col-span-2">
            {activeMedicines > 0 && `${activeMedicines} medicine${activeMedicines === 1 ? '' : 's'} on the chart will end. `}
            {visitorsIn > 0 && `${visitorsIn} visitor${visitorsIn === 1 ? '' : 's'} will be signed out.`}
          </p>
        )}
      </form>
    </ListSheet>
  );
};
