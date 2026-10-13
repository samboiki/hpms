import React, { useEffect, useState } from 'react';
import FormModal from '../modals/FormModal';
import EditPatientForm, { type EditPatientInitialData } from './EditPatientForm';
import { supabase } from '../../lib/supabase';
import { errorMessage } from './formErrors';

interface Props {
  patientId: string;
  isOpen: boolean;
  /** Called after saving or cancelling */
  onClose: () => void;
  /** Details already typed elsewhere (a full registration of the same caller), filled in over the file's own */
  prefill?: EditPatientInitialData;
}

type FileRow = Record<string, string | null>;

const COLUMNS = 'first_name, last_name, email, cell_number, date_of_birth, gender, marital_status, occupation, employer, home_language, home_address, postal_address, postal_code';

/**
 * The patient's edit form, opened straight from a booking to complete a file that was opened with a name and cell
 * number only (EditPatientForm asks for what is still missing). It reads the file itself, so any screen that knows the
 * patient's id can offer it in one tap.
 */
const CompletePatientFileModal: React.FC<Props> = ({ patientId, isOpen, onClose, prefill }) => {
  const [patient, setPatient] = useState<FileRow | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setPatient(null);
    setProblem(null);
    supabase
      .from('patients')
      .select(COLUMNS)
      .eq('id', patientId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setProblem(`Could not open the patient's file: ${errorMessage(error, 'it was not found')}`);
        else setPatient(data as unknown as FileRow);
      });
    return () => {
      active = false;
    };
  }, [isOpen, patientId]);

  const text = (key: string): string => patient?.[key] ?? '';

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title="Complete the patient's file" icon="solar:user-id-bold-duotone">
      {problem ? (
        <p role="alert" className="text-sm text-red-700">{problem}</p>
      ) : !patient ? (
        <p role="status" className="text-sm text-gray-500">Opening the file...</p>
      ) : (
        <EditPatientForm
          patientId={patientId}
          initialData={{
            first_name: text('first_name'),
            last_name: text('last_name'),
            email: text('email'),
            cell_number: text('cell_number'),
            date_of_birth: text('date_of_birth'),
            gender: text('gender'),
            marital_status: text('marital_status'),
            occupation: text('occupation'),
            employer: text('employer'),
            home_language: text('home_language'),
            home_address: text('home_address'),
            postal_address: text('postal_address'),
            postal_code: text('postal_code'),
            ...prefill
          }}
          onSuccess={onClose}
        />
      )}
    </FormModal>
  );
};

export default CompletePatientFileModal;
