import React from 'react';
import PatientRegistrationForm from './PatientRegistrationForm';

interface Props {
  onSuccess: () => void;
}

const AddPatientForm: React.FC<Props> = ({ onSuccess }) => {
  return <PatientRegistrationForm onSuccess={onSuccess} />;
};

export default AddPatientForm;