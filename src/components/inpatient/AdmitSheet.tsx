import React, { useEffect, useId, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { ListSheet } from '../patientLists/ListSheet';
import Icd10CodeInput from '../billing/Icd10CodeInput';
import { refreshAfterSave } from '../../lib/queryClient';
import { useAuthStore } from '../../stores/authStore';
import { loadPatientAuthorisations } from '../../services/claimRegistersService';
import {
  admitPatient,
  loadPatientName,
  loadPatientVisits,
  searchPatients,
  type PatientChoice,
  type WardBoard
} from '../../services/inpatientService';
import { emptyIcd10Selection, type Icd10Selection } from '../../utils/billing/icd10';
import { todayKey } from '../../utils/billing/dates';
import { ADMISSION_CONDITIONS, ADMISSION_SOURCES, ADMISSION_TYPES, canTakePatient } from '../../utils/inpatient/inpatientRules';
import { Field } from '../stock/stockParts';
import { INPUT, LABEL, PRIMARY, QUIET, SECONDARY, day, errorText, nad } from '../stock/stockUi';
import { toCents } from '../../utils/billing/money';
import { boardWards, rateOf, useStaff } from './inpatientData';

interface AdmitSheetProps {
  practiceId: string;
  role: string | null;
  board: WardBoard;
  /** From the patient file or a visit */
  patientId: string | null;
  visitId: string | null;
  /** From a free bed on the board */
  bedId: string | null;
  onClose: () => void;
  onAdmitted: (admissionId: string) => void;
}

const fullName = (patient: Pick<PatientChoice, 'first_name' | 'last_name'>) => [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Patient';

/** Admit a patient to a free bed: why, by whom, the diagnosis, the fund's authorisation and the safety flags */
export const AdmitSheet: React.FC<AdmitSheetProps> = ({ practiceId, role, board, patientId, visitId, bedId, onClose, onAdmitted }) => {
  const formId = useId();
  const me = useAuthStore(state => state.user?.id ?? null);
  const { doctors } = useStaff(practiceId);
  const [patient, setPatient] = useState<PatientChoice | null>(null);
  const [term, setTerm] = useState('');
  const [found, setFound] = useState<PatientChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [codes, setCodes] = useState<Icd10Selection>(emptyIcd10Selection());
  const [values, setValues] = useState({
    visit_id: visitId ?? '',
    bed_id: bedId ?? '',
    admission_type: 'scheduled',
    admission_source: visitId ? 'outpatient_clinic' : '',
    chief_complaint: '',
    patient_condition: 'stable',
    admitting_doctor_id: role === 'doctor' && me ? me : '',
    attending_doctor_id: role === 'doctor' && me ? me : '',
    primary_diagnosis: '',
    pre_authorization_number: '',
    expected_discharge_date: '',
    referring_doctor_name: '',
    isolation_required: false,
    isolation_type: '',
    fall_risk: false,
    allergy_alert: false
  });
  const set = (key: keyof typeof values, value: string | boolean) => setValues(current => ({ ...current, [key]: value }));

  // The patient named by the patient file or visit
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    loadPatientName(patientId).then(row => !cancelled && setPatient(row)).catch(error => toast.error(errorText(error, 'Could not load the patient.')));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  // Search as the name is typed (a short pause first)
  useEffect(() => {
    if (patient || term.trim().length < 2) {
      setFound([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchPatients(practiceId, term)
        .then(rows => !cancelled && setFound(rows))
        .catch(error => !cancelled && toast.error(errorText(error, 'Could not search the patients.')))
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, patient, practiceId]);

  const visits = useQuery({ queryKey: ['inpatient', 'visits', patient?.id], queryFn: () => loadPatientVisits(patient?.id as string), enabled: !!patient });
  const authorisations = useQuery({ queryKey: ['inpatient', 'authorisations', patient?.id], queryFn: () => loadPatientAuthorisations(patient?.id as string), enabled: !!patient });
  const today = todayKey();
  const validAuthorisations = authorisations.data?.status === 'ready'
    ? authorisations.data.rows.filter(row => !row.removedAt && row.validTo >= today && row.validFrom <= today)
    : [];

  const freeBeds = useMemo(() => boardWards(board).flatMap(ward => ward.beds
    .filter(entry => canTakePatient(entry.board))
    .map(entry => ({ id: entry.bed.id, ward: ward.ward.ward_name, label: `Bed ${entry.bed.bed_number}`, rate: rateOf(entry.bed), reserved: entry.bed.status === 'reserved' }))), [board]);
  const alreadyIn = patient ? board.active.find(admission => admission.patient_id === patient.id) : undefined;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patient) return void toast.error('Choose the patient first.');
    if (!values.bed_id) return void toast.error('Choose a free bed.');
    if (!values.chief_complaint.trim()) return void toast.error('Say why the patient is admitted.');
    setSaving(true);
    try {
      const id = await admitPatient(patient.id, values.bed_id, {
        ...values,
        visit_id: values.visit_id || null,
        primary_diagnosis_code: codes.primary,
        secondary_diagnosis_codes: codes.secondary
      });
      await refreshAfterSave('inpatient');
      toast.success(`${fullName(patient)} admitted.`);
      onAdmitted(id);
    } catch (error) {
      toast.error(errorText(error, 'Could not admit the patient.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet
      open
      onClose={onClose}
      size="lg"
      title="Admit a patient"
      subtitle={patient ? fullName(patient) : 'Choose the patient, a free bed and why they are admitted.'}
      dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form={formId} disabled={saving || !patient || !!alreadyIn || freeBeds.length === 0} className={PRIMARY}>
            {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Admit
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
        {/* The patient */}
        {patient ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-sm text-gray-900">
              <span className="font-medium">{fullName(patient)}</span>
              {patient.date_of_birth && <span className="text-gray-500"> · born {day(patient.date_of_birth)}</span>}
            </p>
            {!patientId && <button type="button" onClick={() => setPatient(null)} className={QUIET}>Change</button>}
          </div>
        ) : (
          <div>
            <Field label="Patient" hint={searching ? 'Searching...' : 'Type a name or ID number'}>
              {props => <input {...props} type="search" value={term} onChange={event => setTerm(event.target.value)} className={INPUT} autoFocus autoComplete="off" />}
            </Field>
            {found.length > 0 && (
              <ul className="mt-2 max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                {found.map(row => (
                  <li key={row.id}>
                    <button type="button" onClick={() => setPatient(row)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus-visible:bg-cyan-50">
                      <span className="font-medium text-gray-900">{fullName(row)}</span>
                      <span className="text-gray-500">{row.date_of_birth ? ` · born ${day(row.date_of_birth)}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {alreadyIn && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
            This patient is already admitted ({alreadyIn.admission_number}). Open their stay to move them to another bed.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Bed" hint={freeBeds.length === 0 ? 'No bed is free. Mark a cleaned bed free on the board.' : undefined}>
            {props => (
              <select {...props} value={values.bed_id} onChange={event => set('bed_id', event.target.value)} className={INPUT}>
                <option value="">Choose a free bed</option>
                {freeBeds.map(bed => (
                  <option key={bed.id} value={bed.id}>
                    {bed.ward}: {bed.label}{bed.reserved ? ' (reserved)' : ''}{bed.rate !== null ? `, ${nad(toCents(bed.rate))} a day` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Visit" hint="The stay is billed on this visit">
            {props => (
              <select {...props} value={values.visit_id} onChange={event => set('visit_id', event.target.value)} className={INPUT} disabled={!patient}>
                <option value="">No visit yet</option>
                {(visits.data ?? []).map(visit => (
                  <option key={visit.id} value={visit.id}>
                    {day(visit.visit_date ?? visit.scheduled_date)}{visit.chief_complaint ? `: ${visit.chief_complaint.slice(0, 40)}` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Why the patient is admitted" className="sm:col-span-2">
            {props => <textarea {...props} rows={2} value={values.chief_complaint} onChange={event => set('chief_complaint', event.target.value)} className={INPUT} maxLength={2000} />}
          </Field>
          <Field label="Kind of admission">
            {props => (
              <select {...props} value={values.admission_type} onChange={event => set('admission_type', event.target.value)} className={INPUT}>
                {ADMISSION_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Came from">
            {props => (
              <select {...props} value={values.admission_source} onChange={event => set('admission_source', event.target.value)} className={INPUT}>
                <option value="">Not recorded</option>
                {ADMISSION_SOURCES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </Field>
          {(values.admission_source === 'physician_referral' || values.admission_type === 'referral') && (
            <Field label="Referred by" className="sm:col-span-2">
              {props => <input {...props} value={values.referring_doctor_name} onChange={event => set('referring_doctor_name', event.target.value)} className={INPUT} maxLength={120} />}
            </Field>
          )}
          <Field label="Admitting doctor">
            {props => (
              <select {...props} value={values.admitting_doctor_id} onChange={event => set('admitting_doctor_id', event.target.value)} className={INPUT}>
                <option value="">Not recorded</option>
                {doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Attending doctor" hint="Looks after the patient in the ward">
            {props => (
              <select {...props} value={values.attending_doctor_id} onChange={event => set('attending_doctor_id', event.target.value)} className={INPUT}>
                <option value="">Same as admitting</option>
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
          <Field label="Expected to go home" hint="Optional">
            {props => <input {...props} type="date" min={today} value={values.expected_discharge_date} onChange={event => set('expected_discharge_date', event.target.value)} className={INPUT} />}
          </Field>
        </div>

        <div className="space-y-2">
          <Icd10CodeInput value={codes} onChange={setCodes} label="Diagnosis (ICD-10)" required={false} />
          <Field label="Diagnosis in words" hint="Optional">
            {props => <input {...props} value={values.primary_diagnosis} onChange={event => set('primary_diagnosis', event.target.value)} className={INPUT} maxLength={300} />}
          </Field>
        </div>

        <div>
          <Field label="Medical aid authorisation number" hint={validAuthorisations.length > 0 ? 'Or choose one from the patient’s register:' : 'Optional'}>
            {props => <input {...props} value={values.pre_authorization_number} onChange={event => set('pre_authorization_number', event.target.value)} className={INPUT} maxLength={40} />}
          </Field>
          {validAuthorisations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {validAuthorisations.map(row => (
                <button key={row.id} type="button" onClick={() => set('pre_authorization_number', row.number)} className={QUIET}>
                  <Icon icon="solar:shield-check-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  {row.number} (until {day(row.validTo)})
                </button>
              ))}
            </div>
          )}
        </div>

        <fieldset className="space-y-1">
          <legend className={LABEL}>Safety</legend>
          {([['fall_risk', 'Fall risk'], ['allergy_alert', 'Allergies: check the patient file before giving medicines'], ['isolation_required', 'Needs isolation']] as const).map(([key, label]) => (
            <label key={key} className="flex min-h-[44px] items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={values[key]} onChange={event => set(key, event.target.checked)} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              {label}
            </label>
          ))}
          {values.isolation_required && (
            <Field label="Kind of isolation" hint="e.g. Contact, droplet, airborne">
              {props => <input {...props} value={values.isolation_type} onChange={event => set('isolation_type', event.target.value)} className={INPUT} maxLength={80} />}
            </Field>
          )}
        </fieldset>
      </form>
    </ListSheet>
  );
};
