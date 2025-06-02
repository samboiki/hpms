import React from 'react';
import ModernPatientRegistrationForm from './ModernPatientRegistrationForm';

interface Props {
  onSuccess: () => void;
}

const AddPatientForm: React.FC<Props> = ({ onSuccess }) => {
  return <ModernPatientRegistrationForm onSuccess={onSuccess} />;
};

export default AddPatientForm;