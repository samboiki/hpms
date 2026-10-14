import React, { useId, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { refreshAfterSave } from '../../lib/queryClient';
import { transferPatient, type AdmissionDetail, type WardBoard } from '../../services/inpatientService';
import { canTakePatient, TRANSFER_REASONS } from '../../utils/inpatient/inpatientRules';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, SECONDARY, errorText, nad } from '../stock/stockUi';
import { toCents } from '../../utils/billing/money';
import { bedPlace, boardWards, patientName, rateOf } from './inpatientData';

/** Move a patient to another free bed: the old bed goes to cleaning, the move is kept in the stay's history */
export const TransferSheet: React.FC<{ data: AdmissionDetail; board: WardBoard; onClose: () => void }> = ({ data, board, onClose }) => {
  const formId = useId();
  const [values, setValues] = useState({ bed_id: '', reason_code: 'medical_needs', reason: '', urgency: 'routine' });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  const fromBed = data.allocations.find(allocation => allocation.is_current)?.bed_id;
  const freeBeds = useMemo(() => boardWards(board).flatMap(ward => ward.beds.filter(entry => canTakePatient(entry.board))
    .map(entry => ({ id: entry.bed.id, label: `${ward.ward.ward_name}: Bed ${entry.bed.bed_number}`, rate: rateOf(entry.bed) }))), [board]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.bed_id) return void toast.error('Choose the bed the patient moves to.');
    setSaving(true);
    try {
      await transferPatient(data.admission.id, values.bed_id, values.reason_code, values.reason, values.urgency);
      await refreshAfterSave('inpatient');
      toast.success(`${patientName(data.admission)} moved to ${bedPlace(board, values.bed_id)}.`);
      onClose();
    } catch (error) {
      toast.error(errorText(error, 'Could not move the patient.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet open onClose={onClose} title={`Move ${patientName(data.admission)}`} subtitle={`Now in ${bedPlace(board, fromBed)}`} dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form={formId} disabled={saving || freeBeds.length === 0} className={PRIMARY}>Move</button>
        </div>
      }>
      <form id={formId} onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="To bed" className="sm:col-span-2" hint={freeBeds.length === 0 ? 'No bed is free.' : 'The bed left behind is marked for cleaning.'}>
          {props => (
            <select {...props} value={values.bed_id} onChange={event => set('bed_id', event.target.value)} className={INPUT} autoFocus>
              <option value="">Choose a free bed</option>
              {freeBeds.map(bed => <option key={bed.id} value={bed.id}>{bed.label}{bed.rate !== null ? `, ${nad(toCents(bed.rate))} a day` : ''}</option>)}
            </select>
          )}
        </Field>
        <Field label="Why">
          {props => (
            <select {...props} value={values.reason_code} onChange={event => set('reason_code', event.target.value)} className={INPUT}>
              {TRANSFER_REASONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="How urgent">
          {props => (
            <select {...props} value={values.urgency} onChange={event => set('urgency', event.target.value)} className={INPUT}>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          )}
        </Field>
        <Field label="Note" className="sm:col-span-2" hint="Optional">
          {props => <input {...props} value={values.reason} onChange={event => set('reason', event.target.value)} className={INPUT} maxLength={500} />}
        </Field>
      </form>
    </ListSheet>
  );
};
