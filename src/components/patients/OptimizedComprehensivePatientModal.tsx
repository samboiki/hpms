import React from 'react';
import ComprehensivePatientModal from './ComprehensivePatientModal';
import { useOptimizedPatientDetails } from '../../hooks/useOptimizedPatientDetails';

interface OptimizedComprehensivePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string | null;
  visitId?: string | null;
  onVisitUpdated?: () => void;
}

// This is a wrapper that pre-fetches patient data using the optimized hook
export const OptimizedComprehensivePatientModal: React.FC<OptimizedComprehensivePatientModalProps> = (props) => {
  const { fetchPatientDetails } = useOptimizedPatientDetails();

  // Pre-fetch data when modal opens with a patient ID
  React.useEffect(() => {
    if (props.isOpen && props.patientId) {
      // Pre-fetch in the background to warm the cache
      fetchPatientDetails(props.patientId).catch(console.error);
    }
  }, [props.isOpen, props.patientId, fetchPatientDetails]);

  // Pass through all props to the original modal
  return <ComprehensivePatientModal {...props} />;
};

export default OptimizedComprehensivePatientModal;