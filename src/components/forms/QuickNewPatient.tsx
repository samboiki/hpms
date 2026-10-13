import React, { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { normalizePhoneNumber } from '../patients/patientContact';
import { findPracticeDuplicatesForCaller } from '../../services/patientDuplicateService';
import { createTemporaryPatient, type OpenedPatient } from '../../services/patientFileService';
import { DUPLICATE_REASON_LABELS, type DuplicateMatch } from '../../utils/patients/duplicatePatients';
import { patientFileStatus } from '../../utils/patients/temporaryPatient';
import { splitFullName } from '../../utils/import/importValues';
import { formatServiceDate } from '../../utils/billing/dates';
import { errorMessage } from './formErrors';

export interface ChosenPatient {
  id: string;
  first_name: string;
  last_name: string;
  id_number?: string | null;
  cell_number?: string | null;
}

interface Props {
  practiceId: string | null;
  /** What reception typed in the patient search: a name, or the caller's cell number */
  initialText: string;
  /** The patient to book: an existing file reception chose, or the temporary file just opened (isNew) */
  onUse: (patient: ChosenPatient, isNew: boolean) => void;
  onCancel: () => void;
}

const startingValues = (text: string) => {
  const typed = text.trim();
  if (/^[+\d][\d\s()-]*$/.test(typed)) return { firstName: '', lastName: '', cellNumber: typed };
  const { firstName, surname } = splitFullName(typed);
  return { firstName, lastName: surname, cellNumber: '' };
};

/**
 * Booking a new caller with a name and cell number only (Eminance's "temporary patient"). The practice's files with the
 * same name or number are offered first ("Use this patient"); otherwise a temporary file is opened and booked, and
 * reception completes it (ID number, date of birth, gender, medical aid) when the patient arrives.
 */
const QuickNewPatient: React.FC<Props> = ({ practiceId, initialText, onUse, onCancel }) => {
  const ids = useId();
  const [values, setValues] = useState(() => startingValues(initialText));
  const [matches, setMatches] = useState<DuplicateMatch[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const change = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues(previous => ({ ...previous, [field]: event.target.value }));
    // Another name or number needs its own check
    setMatches(null);
    setProblem(null);
  };

  const openFile = async () => {
    if (!practiceId) return;
    setBusy(true);
    try {
      const opened: OpenedPatient = await createTemporaryPatient(practiceId, values);
      onUse(opened, true);
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    if (!firstName || !lastName) {
      setProblem('Type the first name and the surname.');
      return;
    }
    if (!normalizePhoneNumber(values.cellNumber)) {
      setProblem('Type a cell number the practice can call or text, for example 081 123 4567.');
      return;
    }
    if (!practiceId) {
      setProblem("Your practice couldn't be identified. Reload the page and try again.");
      return;
    }
    setBusy(true);
    setProblem(null);
    let found: DuplicateMatch[];
    try {
      found = await findPracticeDuplicatesForCaller(practiceId, values);
    } catch (error) {
      setProblem(errorMessage(error));
      setBusy(false);
      return;
    }
    setBusy(false);
    if (found.length > 0) {
      setMatches(found);
      return;
    }
    await openFile();
  };

  // Enter in these fields must not submit the booking form around them
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!busy && !matches) void check();
  };

  const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-800 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500';

  return (
    <section aria-labelledby={`${ids}-title`} className="mt-3 space-y-3 rounded-xl border border-purple-200 bg-purple-50/60 p-4">
      <div className="flex items-start gap-2">
        <Icon icon="solar:user-plus-bold-duotone" className="mt-0.5 h-5 w-5 flex-none text-purple-600" aria-hidden="true" />
        <div>
          <h4 id={`${ids}-title`} className="font-semibold text-gray-900">New patient: name and cell</h4>
          <p className="text-xs text-gray-600">Book now. The ID number, date of birth, gender and medical aid are added when the patient arrives.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${ids}-first`} className="mb-1 block text-sm font-medium text-gray-700">First name(s)</label>
          <input id={`${ids}-first`} type="text" autoComplete="off" value={values.firstName} onChange={change('firstName')} onKeyDown={onKeyDown} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${ids}-last`} className="mb-1 block text-sm font-medium text-gray-700">Surname</label>
          <input id={`${ids}-last`} type="text" autoComplete="off" value={values.lastName} onChange={change('lastName')} onKeyDown={onKeyDown} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${ids}-cell`} className="mb-1 block text-sm font-medium text-gray-700">Cell number</label>
          <input id={`${ids}-cell`} type="tel" autoComplete="off" value={values.cellNumber} onChange={change('cellNumber')} onKeyDown={onKeyDown} placeholder="081 123 4567" className={inputClass} />
        </div>
      </div>

      {problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}

      {matches ? (
        <div role="alert" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">This caller may already have a file</p>
          <ul className="space-y-2">
            {matches.map(({ patient, reasons }) => {
              const status = patientFileStatus(patient);
              const details = [
                status.incomplete ? 'File not complete' : null,
                status.dateOfBirth ? `Born ${formatServiceDate(status.dateOfBirth)}` : null,
                patient.cell_number
              ].filter(Boolean).join(' · ');
              return (
                <li key={patient.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-amber-200">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-gray-900">{patient.first_name} {patient.last_name}</p>
                    {details && <p className="text-gray-600">{details}</p>}
                    <p className="text-xs text-amber-800">{reasons.map(reason => DUPLICATE_REASON_LABELS[reason]).join(', ')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUse({ ...patient, first_name: patient.first_name ?? '', last_name: patient.last_name ?? '' }, false)}
                    className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
                  >
                    Use this patient
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void openFile()}
              disabled={busy}
              className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {busy ? 'Opening the file...' : 'Book as a new patient'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        {!matches && (
          <button
            type="button"
            onClick={() => void check()}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Checking...' : 'Continue'}
          </button>
        )}
      </div>
    </section>
  );
};

export default QuickNewPatient;
