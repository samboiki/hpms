import React from 'react';
import { useParams } from 'react-router-dom';
import { usePatient } from '../hooks/usePatient';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { VisitsTimeline } from '../components/visits/VisitsTimeline';
import { PatientModal } from '../components/patients/PatientModal';
import { LabResults } from '../components/patients/LabResults';
import { User, Phone, Mail, Home, Calendar, Briefcase, Heart, UserPlus, Building2, Languages } from 'lucide-react';

const PatientModernDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { patient, loading, error } = usePatient(id);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!patient) return <div>Patient not found</div>;

  const tabs = [
    {
      label: 'Timeline',
      content: <VisitsTimeline patientId={patient.id} />
    },
    {
      label: 'Lab Results',
      content: <LabResults patientId={patient.id} />
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 style={{ fontSize: '30px', color: '#494c61' }} className="font-semibold">
          Patient Details
        </h1>
        <Button onClick={() => setIsEditModalOpen(true)}>
          Edit Patient
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {patient.first_name} {patient.last_name}
              </h2>
              <Badge>{patient.gender}</Badge>
            </div>

            <div className="space-y-4">
              <div className="flex items-center text-gray-600">
                <User className="w-5 h-5 mr-3" />
                <span>ID: {patient.id_number}</span>
              </div>
              
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-3" />
                <span>DOB: {new Date(patient.date_of_birth).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center text-gray-600">
                <Phone className="w-5 h-5 mr-3" />
                <span>{patient.cell_number || 'No phone number'}</span>
              </div>

              <div className="flex items-center text-gray-600">
                <Mail className="w-5 h-5 mr-3" />
                <span>{patient.email || 'No email'}</span>
              </div>

              <div className="flex items-center text-gray-600">
                <Home className="w-5 h-5 mr-3" />
                <span>{patient.home_address || 'No address'}</span>
              </div>

              <div className="flex items-center text-gray-600">
                <Briefcase className="w-5 h-5 mr-3" />
                <span>{patient.occupation || 'No occupation'}</span>
              </div>

              <div className="flex items-center text-gray-600">
                <Building2 className="w-5 h-5 mr-3" />
                <span>{patient.employer || 'No employer'}</span>
              </div>

              <div className="flex items-center text-gray-600">
                <Languages className="w-5 h-5 mr-3" />
                <span>{patient.home_language || 'No language specified'}</span>
              </div>

              <div className="flex items-center text-gray-600">
                <Heart className="w-5 h-5 mr-3" />
                <span>{patient.marital_status || 'No marital status'}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Next of Kin</h2>
              <UserPlus className="w-5 h-5 text-gray-400" />
            </div>
            {patient.next_of_kin ? (
              <div className="space-y-4">
                <div className="flex items-center text-gray-600">
                  <User className="w-5 h-5 mr-3" />
                  <span>{patient.next_of_kin.name}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Heart className="w-5 h-5 mr-3" />
                  <span>{patient.next_of_kin.relationship}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Phone className="w-5 h-5 mr-3" />
                  <span>{patient.next_of_kin.phone}</span>
                </div>
                {patient.next_of_kin.address && (
                  <div className="flex items-center text-gray-600">
                    <Home className="w-5 h-5 mr-3" />
                    <span>{patient.next_of_kin.address}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No next of kin information</p>
            )}
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="p-6">
            <Tabs tabs={tabs} />
          </Card>
        </div>
      </div>

      <PatientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        patientId={patient.id}
        mode="edit"
      />
    </div>
  );
};

export default PatientModernDetail;