import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  FileText, 
  Phone, 
  Mail, 
  MapPin, 
  ChevronLeft,
  Edit3,
  PlusCircle,
  Clock,
  FileSymlink,
  User,
  Loader2,
  Heart
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddMedicalRecordForm from '../components/forms/AddMedicalRecordForm';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import { supabase } from '../lib/supabase';
import { logDatabaseError } from '../lib/supabase';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  occupation: string;
  home_language: string;
  home_address: string;
  postal_address: string;
  postal_code: string;
  medical_aid_details: Array<{
    id: string;
    provider: string;
    scheme: string;
    membership_number: string;
    plan_type: string;
    main_member_name: string;
    main_member_id_number: string;
    relationship_to_main: string;
  }>;
  next_of_kin: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    address: string;
  }>;
}

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'appointments'>('overview');
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isNextOfKinModalOpen, setIsNextOfKinModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [isMedicalAidModalOpen, setIsMedicalAidModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPatientDetails();
    }
  }, [id]);

  const fetchPatientDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('patient_details_view')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      console.log('Fetched patient data:', data);
      setPatient(data);
    } catch (err) {
      console.error('Error fetching patient details:', err);
      logDatabaseError(err, 'fetchPatientDetails');
      setError('Failed to load patient details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextOfKinSubmit = async () => {
    await fetchPatientDetails();
    setIsNextOfKinModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading patient details...</span>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-medium text-error-600">{error || 'Patient not found'}</h2>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => navigate('/patients')}
        >
          <ChevronLeft size={16} className="mr-2" />
          Back to Patients
        </Button>
      </div>
    );
  }

  const renderMedicalAidCard = () => (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Medical Aid Information</CardTitle>
          {patient.medical_aid_details && patient.medical_aid_details[0] && (
            <Button variant="ghost" size="sm" onClick={() => setIsMedicalAidModalOpen(true)}>
              <Edit3 size={16} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {patient.medical_aid_details && patient.medical_aid_details[0] ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Provider</h4>
              <p className="text-gray-900">{patient.medical_aid_details[0].provider}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Scheme</h4>
              <p className="text-gray-900">{patient.medical_aid_details[0].scheme}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Membership Number</h4>
              <p className="text-gray-900">{patient.medical_aid_details[0].membership_number}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Plan Type</h4>
              <p className="text-gray-900">{patient.medical_aid_details[0].plan_type}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Main Member</h4>
              <p className="text-gray-900">{patient.medical_aid_details[0].main_member_name}</p>
              <p className="text-sm text-gray-500">ID: {patient.medical_aid_details[0].main_member_id_number}</p>
            </div>
            {patient.medical_aid_details[0].relationship_to_main !== 'Self' && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Relationship to Main Member</h4>
                <p className="text-gray-900">{patient.medical_aid_details[0].relationship_to_main}</p>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => setIsMedicalAidModalOpen(true)}
            >
              <Edit3 size={14} className="mr-2" />
              Update Medical Aid
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">No medical aid information</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => setIsMedicalAidModalOpen(true)}
            >
              Add Medical Aid
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderNextOfKinCard = () => (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Next of Kin</CardTitle>
          {patient.next_of_kin && patient.next_of_kin[0] && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsNextOfKinModalOpen(true)}
            >
              <Edit3 size={16} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {patient.next_of_kin && patient.next_of_kin[0] ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-rose-100 rounded-full">
                <Heart size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{patient.next_of_kin[0].name}</h3>
                <p className="text-sm text-gray-500">{patient.next_of_kin[0].relationship}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center text-gray-600">
                <Phone size={16} className="mr-2" />
                <span>{patient.next_of_kin[0].phone}</span>
              </div>
              
              {patient.next_of_kin[0].address && (
                <div className="flex items-start text-gray-600">
                  <MapPin size={16} className="mr-2 mt-1" />
                  <span>{patient.next_of_kin[0].address}</span>
                </div>
              )}
            </div>

            <div className="pt-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => setIsNextOfKinModalOpen(true)}
              >
                <Edit3 size={14} className="mr-2" />
                Update Information
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Heart size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 mb-4">No next of kin information</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsNextOfKinModalOpen(true)}
            >
              <PlusCircle size={14} className="mr-2" />
              Add Next of Kin
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/patients')}
          className="mr-4"
        >
          <ChevronLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          Patient Details
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                  <User size={40} className="text-gray-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {patient.first_name} {patient.last_name}
                </h2>
                <p className="text-gray-500 capitalize">
                  {patient.gender} • {new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} years
                </p>
                <div className="mt-4 w-full">
                  <div className="flex items-center py-2">
                    <Phone size={16} className="text-gray-400 mr-3" />
                    <span className="text-gray-700">{patient.cell_number}</span>
                  </div>
                  <div className="flex items-center py-2">
                    <Mail size={16} className="text-gray-400 mr-3" />
                    <span className="text-gray-700">{patient.email}</span>
                  </div>
                  <div className="flex items-center py-2">
                    <MapPin size={16} className="text-gray-400 mr-3" />
                    <span className="text-gray-700">{patient.home_address}</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="mt-4 w-full"
                  onClick={() => setIsEditPatientModalOpen(true)}
                >
                  <Edit3 size={16} className="mr-2" />
                  Edit Patient
                </Button>
              </div>
            </CardContent>
          </Card>

          {renderMedicalAidCard()}
          {renderNextOfKinCard()}
        </div>

        <div className="lg:col-span-2">
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 px-4 text-sm font-medium ${
                activeTab === 'overview'
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-4 text-sm font-medium ${
                activeTab === 'history'
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Medical History
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`pb-3 px-4 text-sm font-medium ${
                activeTab === 'appointments'
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Appointments
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button>
                      <Calendar size={16} className="mr-2" />
                      Schedule
                    </Button>
                    <Button variant="outline">
                      <FileText size={16} className="mr-2" />
                      New Note
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setIsAddRecordModalOpen(true)}
                    >
                      <FileSymlink size={16} className="mr-2" />
                      Add Record
                    </Button>
                    <Button variant="outline">
                      <Clock size={16} className="mr-2" />
                      History
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Additional overview content */}
            </div>
          )}
          
          {activeTab === 'history' && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Medical History</CardTitle>
                  <Button 
                    size="sm"
                    onClick={() => setIsAddRecordModalOpen(true)}
                  >
                    <PlusCircle size={14} className="mr-2" />
                    Add Record
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-10">
                  <FileText size={40} className="mx-auto text-gray-300" />
                  <p className="mt-2 text-gray-500">No medical records found</p>
                  <Button 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setIsAddRecordModalOpen(true)}
                  >
                    <PlusCircle size={14} className="mr-2" />
                    Add First Record
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {activeTab === 'appointments' && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Appointments</CardTitle>
                  <Button size="sm">
                    <PlusCircle size={14} className="mr-2" />
                    New Appointment
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-10">
                  <Calendar size={40} className="mx-auto text-gray-300" />
                  <p className="mt-2 text-gray-500">No appointments found</p>
                  <Button size="sm" className="mt-3">
                    <PlusCircle size={14} className="mr-2" />
                    Schedule Appointment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <FormModal
        isOpen={isAddRecordModalOpen}
        onClose={() => setIsAddRecordModalOpen(false)}
        title="Add Medical Record"
      >
        <AddMedicalRecordForm
          patientId={id || ''}
          onSuccess={() => setIsAddRecordModalOpen(false)}
        />
      </FormModal>

      <FormModal
        isOpen={isNextOfKinModalOpen}
        onClose={() => setIsNextOfKinModalOpen(false)}
        title={patient.next_of_kin && patient.next_of_kin[0] ? "Update Next of Kin" : "Add Next of Kin"}
      >
        <NextOfKinForm
          patientId={id || ''}
          initialData={patient.next_of_kin && patient.next_of_kin[0]}
          onSuccess={handleNextOfKinSubmit}
        />
      </FormModal>
    </div>
  );
};

export default PatientDetail;