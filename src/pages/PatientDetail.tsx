import React from 'react';
import { useParams } from 'react-router-dom';
import { VisitsTimeline } from '../components/visits/VisitsTimeline';

function PatientDetail() {
  const { id } = useParams();

  return (
    <div>
      <VisitsTimeline patientId={id || ''} />
    </div>
  );
}

export default PatientDetail;