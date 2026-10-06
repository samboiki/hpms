import React from 'react';
import ModernPatientRegistrationForm from './ModernPatientRegistrationForm';

export interface CreatedPatient {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  onSuccess: () => void;
  /** Called with the new patient (before onSuccess) when the registration form hands it back. */
  onCreated?: (patient: CreatedPatient) => void;
}

const AddPatientForm: React.FC<Props> = ({ onSuccess, onCreated }) => {
  // Without onCreated, callers get exactly the previous behaviour.
  // ModernPatientRegistrationForm must pass the inserted row to onSuccess for onCreated to fire.
  const handleSuccess = (patient?: CreatedPatient) => {
    if (patient && onCreated) onCreated(patient);
    onSuccess();
  };

  return <ModernPatientRegistrationForm onSuccess={onCreated ? handleSuccess : onSuccess} />;
};

export default AddPatientForm;