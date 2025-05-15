import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Clipboard, Calendar, Phone, Mail, Home, User, Heart, Activity } from 'lucide-react';
import VitalsForm from '../components/forms/VitalsForm';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import VisitsTimeline from '../components/visits/VisitsTimeline';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  occupation: string;
  employer: string;
  home_language: string;
  cell_number: string;
  email: string;
  home_address: string;
  postal_address: string;
  postal_code: string;
  created_at: string;
  updated_at: string;
}

interface MedicalAidDetails {
  provider: string;
  scheme: string;
  membership_number: string;
  plan_type: string;
}

interface NextOfKin {
  name: string;
  relationship: string;
  phone: string;
  address: string;
}

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [medicalAid, setMedicalAid] = useState<MedicalAidDetails | null>(null);
  const [nextOfKin, setNextOfKin] = useState<NextOfKin | null>(null);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showNextOfKinForm, setShowNextOfKinForm] = useState(false);

  useEffect(() => {
    const fetchPatientDetails = async () => {
      if (!id) return;

      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();

      if (patientError) {
        console.error('Error fetching patient:', patientError);
        return;
      }

      setPatient(patientData);

      // Fetch medical aid details
      const { data: medicalAidData } = await supabase
        .from('medical_aid_details')
        .select('*')
        .eq('patient_id', id)
        .single();

      setMedicalAid(medicalAidData);

      // Fetch next of kin details
      const { data: nextOfKinData } = await supabase
        .from('next_of_kin')
        .select('*')
        .eq('patient_id', id)
        .single();

      setNextOfKin(nextOfKinData);
    };

    fetchPatientDetails();
  }, [id]);

  if (!patient) {
    return <div className="p-8">Loading patient details...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-[30px] text-[#494c61] font-semibold">
          Patient Details
        </h1>
        <div className="space-x-4">
          <Button variant="outline" onClick={() => setShowVitalsForm(true)}>
            Record Vitals
          </Button>
          <Button variant="outline" onClick={() => setShowNextOfKinForm(true)}>
            Update Next of Kin
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500">Full Name</p>
              <p className="font-medium">{`${patient.first_name} ${patient.last_name}`}</p>
            </div>
            <div>
              <p className="text-gray-500">ID Number</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{patient.id_number}</p>
                <button 
                  onClick={() => navigator.clipboard.writeText(patient.id_number)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Clipboard className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <p className="text-gray-500">Date of Birth</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <p className="font-medium">{new Date(patient.date_of_birth).toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-500">Gender</p>
              <Badge variant="outline">{patient.gender}</Badge>
            </div>
            <div>
              <p className="text-gray-500">Marital Status</p>
              <p className="font-medium capitalize">{patient.marital_status || 'Not specified'}</p>
            </div>
          </div>
        </Card>

        {/* Contact Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Information
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500">Cell Number</p>
              <p className="font-medium">{patient.cell_number || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <p className="font-medium">{patient.email || 'Not provided'}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-500">Home Address</p>
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-gray-400" />
                <p className="font-medium">{patient.home_address || 'Not provided'}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-500">Postal Address</p>
              <p className="font-medium">{patient.postal_address || 'Not provided'}</p>
            </div>
          </div>
        </Card>

        {/* Medical Aid Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Medical Aid Information
          </h2>
          {medicalAid ? (
            <div className="space-y-4">
              <div>
                <p className="text-gray-500">Provider</p>
                <p className="font-medium">{medicalAid.provider}</p>
              </div>
              <div>
                <p className="text-gray-500">Scheme</p>
                <p className="font-medium">{medicalAid.scheme}</p>
              </div>
              <div>
                <p className="text-gray-500">Membership Number</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{medicalAid.membership_number}</p>
                  <button 
                    onClick={() => navigator.clipboard.writeText(medicalAid.membership_number)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Clipboard className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-gray-500">Plan Type</p>
                <p className="font-medium">{medicalAid.plan_type}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No medical aid information available</p>
          )}
        </Card>
      </div>

      {/* Next of Kin Information */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Next of Kin
        </h2>
        {nextOfKin ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium">{nextOfKin.name}</p>
            </div>
            <div>
              <p className="text-gray-500">Relationship</p>
              <p className="font-medium">{nextOfKin.relationship}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium">{nextOfKin.phone}</p>
            </div>
            <div>
              <p className="text-gray-500">Address</p>
              <p className="font-medium">{nextOfKin.address || 'Not provided'}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No next of kin information available</p>
        )}
      </Card>

      {/* Visits Timeline */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Visit History</h2>
        <VisitsTimeline patientId={id!} />
      </Card>

      {/* Forms */}
      {showVitalsForm && (
        <VitalsForm
          patientId={id!}
          onClose={() => setShowVitalsForm(false)}
          onSuccess={() => {
            setShowVitalsForm(false);
            // Refresh data if needed
          }}
        />
      )}

      {showNextOfKinForm && (
        <NextOfKinForm
          patientId={id!}
          existingData={nextOfKin}
          onClose={() => setShowNextOfKinForm(false)}
          onSuccess={(newData) => {
            setNextOfKin(newData);
            setShowNextOfKinForm(false);
          }}
        />
      )}
    </div>
  );
};

export default PatientDetail;