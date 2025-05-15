import React from 'react';
import { useParams } from 'react-router-dom';
import { usePatient } from '../hooks/usePatient';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import { VisitsTimeline } from '../components/visits/VisitsTimeline';
import { LabResults } from '../components/patients/LabResults';
import { NextOfKinForm } from '../components/forms/NextOfKinForm';
import { EditPatientForm } from '../components/forms/EditPatientForm';

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { patient, isLoading, error } = usePatient(id!);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!patient) {
    return <div>Patient not found</div>;
  }

  const tabs = [
    {
      label: 'Timeline',
      content: <VisitsTimeline patientId={patient.id} />
    },
    {
      label: 'Lab Results',
      content: <LabResults patientId={patient.id} />
    },
    {
      label: 'Next of Kin',
      content: <NextOfKinForm patientId={patient.id} />
    },
    {
      label: 'Edit Patient',
      content: <EditPatientForm patient={patient} />
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-6">
        <div className="p-6">
          <h1 className="text-[30px] text-[#494c61] font-semibold mb-4">
            {patient.first_name} {patient.last_name}
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-gray-600">ID Number</p>
              <p className="font-medium">{patient.id_number}</p>
            </div>
            <div>
              <p className="text-gray-600">Date of Birth</p>
              <p className="font-medium">
                {new Date(patient.date_of_birth).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Gender</p>
              <p className="font-medium capitalize">{patient.gender}</p>
            </div>
            <div>
              <p className="text-gray-600">Contact Number</p>
              <p className="font-medium">{patient.cell_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600">Email</p>
              <p className="font-medium">{patient.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600">Address</p>
              <p className="font-medium">{patient.home_address || 'N/A'}</p>
            </div>
          </div>
        </div>
      </Card>
      <Tabs tabs={tabs} />
    </div>
  );
};

export default PatientDetail;