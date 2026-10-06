import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  ChevronLeft,
  Edit3,
  Clock,
  User,
  Users,
  Loader2,
  Heart,
  AlertCircle,
  XCircle
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddMedicalRecordForm from '../components/forms/AddMedicalRecordForm';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import EditPatientForm from '../components/forms/EditPatientForm';
import AddVisitForm from '../components/forms/AddVisitForm';
import ManageBeneficiariesModal from '../components/modals/ManageBeneficiariesModal';
import { supabase } from '../lib/supabase';
import { logDatabaseError } from '../lib/supabase';
import { calculateAge } from '../hooks/usePatient';
import VisitsTimeline from '../components/visits/VisitsTimeline';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  cellNumber: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  occupation: string;
  homeLanguage: string;
  homeAddress: string;
  postalAddress: string;
  postalCode: string;
  medicalAidDetails: Array<{
    provider: string;
    scheme: string;
    membershipNumber: string;
    planType: string;
    mainMemberName: string;
    mainMemberIdNumber: string;
    relationshipToMain: string;
  }>;
  nextOfKin: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    address: string;
  }>;
  chronicConditions?: string[];
}

const PatientDetail: React.FC = () => {
  // App.tsx routes this page as patients/:patientId/visit/:visitId, so `id` alone was always undefined
  const { id: idParam, patientId } = useParams<{ id?: string; patientId?: string }>();
  const id = patientId || idParam;
  const navigate = useNavigate();
  const location = useLocation();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'appointments'>('overview');
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isNextOfKinModalOpen, setIsNextOfKinModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [isAddVisitModalOpen, setIsAddVisitModalOpen] = useState(false);
  const [isManageBeneficiariesModalOpen, setIsManageBeneficiariesModalOpen] = useState(false);
  const [beneficiariesCount, setBeneficiariesCount] = useState<number>(0);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  useEffect(() => {
    if (id) {
      fetchPatientDetails();
    } else {
      // Without an id nothing will load: show "Patient not found" instead of an endless spinner
      setIsLoading(false);
    }
  }, [id]);

  // Handle return from beneficiary management
  useEffect(() => {
    const locationState = location.state as any;
    if (locationState?.fromBeneficiaryManagement && locationState?.returnToModal === 'manageBeneficiaries') {
      // Open the ManageBeneficiariesModal when returning from a beneficiary's profile
      setIsManageBeneficiariesModalOpen(true);
    } else if (locationState?.openManageBeneficiariesModal) {
      // Open modal when returning to the original patient from beneficiary navigation
      setIsManageBeneficiariesModalOpen(true);
    }
  }, [location.state]);

  // Handle back navigation
  const handleBackNavigation = () => {
    const locationState = location.state as any;
    
    if (locationState?.fromBeneficiaryManagement && locationState?.returnToPatientId) {
      // Navigate back to the original patient's profile and open the beneficiaries modal
      navigate(`/patients/${locationState.returnToPatientId}`, {
        state: {
          openManageBeneficiariesModal: true,
          currentMedicalAid: locationState.currentMedicalAid
        }
      });
    } else {
      // Default back to patients list
      navigate('/patients');
    }
  };

  const fetchBeneficiariesCount = async (membershipNumber?: string) => {
    const memberNumber = membershipNumber || patient?.medicalAidDetails?.[0]?.membershipNumber;
    if (!memberNumber) return;

    try {
      const { data, error } = await supabase
        .from('medical_aid_details')
        .select('id', { count: 'exact' })
        .eq('membership_number', memberNumber);

      if (error) {
        console.error('Error fetching beneficiaries count:', error);
        return;
      }

      const count = data?.length || 0;
      setBeneficiariesCount(count);
      console.log(`✅ Found ${count} total beneficiaries for membership ${memberNumber}`);
    } catch (err) {
      console.error('Error fetching beneficiaries count:', err);
    }
  };

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

      // Transform snake_case to camelCase for the patient data
      const transformedData = {
        ...data,
        firstName: data.first_name,
        lastName: data.last_name,
        cellNumber: data.cell_number,
        dateOfBirth: data.date_of_birth,
        maritalStatus: data.marital_status,
        homeLanguage: data.home_language,
        homeAddress: data.home_address,
        postalAddress: data.postal_address,
        postalCode: data.postal_code,
        medicalAidDetails: data.medical_aid_details?.map((detail: any) => ({
          provider: detail.provider,
          scheme: detail.scheme,
          membershipNumber: detail.membership_number,
          planType: detail.plan_type,
          mainMemberName: detail.main_member_name,
          mainMemberIdNumber: detail.main_member_id_number,
          relationshipToMain: detail.relationship_to_main
        })),
        nextOfKin: data.next_of_kin
      };

      console.log('Fetched patient data:', transformedData);
      setPatient(transformedData);
      
      // Fetch beneficiaries count after patient data is loaded
      if (transformedData.medicalAidDetails?.[0]?.membershipNumber) {
        fetchBeneficiariesCount(transformedData.medicalAidDetails[0].membershipNumber);
      }
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

  const handleEditPatientSubmit = async () => {
    await fetchPatientDetails();
    setIsEditPatientModalOpen(false);
  };

  const refreshPatientData = async () => {
    await fetchPatientDetails();
    if (patient?.medicalAidDetails?.[0]?.membershipNumber) {
      fetchBeneficiariesCount(patient.medicalAidDetails[0].membershipNumber);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-xl shadow-lg text-center"
        >
          <Loader2 size={32} className="animate-spin text-[#01b9d4] mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading patient details...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="text-center py-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-xl shadow-lg inline-block"
        >
          <AlertCircle size={48} className="text-error-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-error-600 mb-4">{error || 'Patient not found'}</h2>
          <Button
            variant="outline"
            onClick={() => navigate('/patients')}
          >
            <ChevronLeft size={16} className="mr-2" />
            Back to Patients
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackNavigation}
            className="mr-4"
            aria-label="Back"
            title="Back"
          >
            <ChevronLeft size={16} />
          </Button>
          <div>
            <h1 className="text-[30px] font-bold font-heading text-[#494c61]">
              Patient Details
            </h1>
            <p className="text-gray-600">View and manage patient information</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button onClick={() => setIsAddVisitModalOpen(true)}>
            <Clock size={16} className="mr-2" />
            Record Visit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-1 space-y-6"
        >
          <Card className="overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-[#01b9d4] to-[#0197d4]" />
            <CardContent className="relative pt-16 pb-6">
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2">
                <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg">
                  <div className="w-full h-full bg-gradient-to-r from-[#01b9d4] to-[#0197d4] rounded-full flex items-center justify-center">
                    <User size={40} className="text-white" />
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {patient.firstName} {patient.lastName}
                </h2>
                <p className="text-gray-500 mt-1">
                  {patient.dateOfBirth ? `${calculateAge(patient.dateOfBirth)} years` : 'Age not recorded'} • {patient.gender || 'Gender not recorded'}
                </p>
                
                {patient.medicalAidDetails?.[0] && (
                  <div className="flex justify-center mt-3 space-x-2">
                    <Badge variant="azure">Insured</Badge>
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-center text-gray-600">
                    <Phone size={16} className="text-[#01b9d4] mr-3" />
                    <span>{patient.cellNumber || 'No phone number'}</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-600">
                    <Mail size={16} className="text-[#01b9d4] mr-3" />
                    <span>{patient.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-600">
                    <MapPin size={16} className="text-[#01b9d4] mr-3" />
                    <span>{patient.homeAddress || 'No address'}</span>
                  </div>
                </div>

                <Button
                  variant="outline" 
                  className="mt-6 w-full"
                  onClick={() => setIsEditPatientModalOpen(true)}
                >
                  <Edit3 size={16} className="mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white flex items-center">
                  <Building2 size={20} className="mr-2" />
                  Medical Aid
                </CardTitle>
                {/* Medical aid is edited in the Edit Patient form, which saves medical_aid_details */}
                {patient.medicalAidDetails?.[0] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white"
                    onClick={() => setIsEditPatientModalOpen(true)}
                    aria-label="Edit medical aid"
                    title="Edit medical aid"
                  >
                    <Edit3 size={16} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {patient.medicalAidDetails && patient.medicalAidDetails[0] ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Provider</h4>
                      <p className="text-lg font-semibold text-gray-900">{patient.medicalAidDetails[0].provider}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="azure" className="text-xs">
                        {beneficiariesCount} {beneficiariesCount === 1 ? 'Member' : 'Members'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Scheme</h4>
                    <p className="text-gray-900">{patient.medicalAidDetails[0].scheme}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Membership Number</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900 font-mono">#{patient.medicalAidDetails[0].membershipNumber}</p>
                      <Badge variant="outline" className="text-xs font-medium">
                        Total Members: {beneficiariesCount}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-500">Main Member</h4>
                    <p className="text-gray-900 font-medium">{patient.medicalAidDetails[0].mainMemberName}</p>
                    <p className="text-sm text-gray-500">ID: {patient.medicalAidDetails[0].mainMemberIdNumber}</p>
                  </div>
                  
                  <div className="space-y-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setIsEditPatientModalOpen(true)}
                    >
                      <Edit3 size={14} className="mr-2" />
                      Update Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setIsManageBeneficiariesModalOpen(true)}
                    >
                      <Users size={14} className="mr-2" />
                      Manage Beneficiaries
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-4">No medical aid information</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsEditPatientModalOpen(true)}
                  >
                    <Edit3 size={14} className="mr-2" />
                    Add Medical Aid
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white flex items-center">
                  <Heart size={20} className="mr-2" />
                  Next of Kin
                </CardTitle>
                {patient.nextOfKin && patient.nextOfKin[0] && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-white"
                    onClick={() => setIsNextOfKinModalOpen(true)}
                    aria-label="Edit next of kin"
                    title="Edit next of kin"
                  >
                    <Edit3 size={16} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {patient.nextOfKin && patient.nextOfKin[0] ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-rose-100 rounded-full">
                      <Heart size={20} className="text-rose-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{patient.nextOfKin[0].name}</h3>
                      <p className="text-sm text-gray-500">{patient.nextOfKin[0].relationship}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center text-gray-600">
                      <Phone size={16} className="mr-2" />
                      <span>{patient.nextOfKin[0].phone}</span>
                    </div>
                    
                    {patient.nextOfKin[0].address && (
                      <div className="flex items-start text-gray-600">
                        <MapPin size={16} className="mr-2 mt-1" />
                        <span>{patient.nextOfKin[0].address}</span>
                      </div>
                    )}
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-4"
                    onClick={() => setIsNextOfKinModalOpen(true)}
                  >
                    <Edit3 size={14} className="mr-2" />
                    Update Information
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Heart size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-4">No next of kin information</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsNextOfKinModalOpen(true)}
                  >
                    <Edit3 size={14} className="mr-2" />
                    Add Next of Kin
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="lg:col-span-2 space-y-6"
        >
          <VisitsTimeline patientId={id || ''} />
        </motion.div>
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
        title={patient.nextOfKin && patient.nextOfKin[0] ? "Update Next of Kin" : "Add Next of Kin"}
      >
        <NextOfKinForm
          patientId={id || ''}
          initialData={patient.nextOfKin && patient.nextOfKin[0]}
          onSuccess={handleNextOfKinSubmit}
        />
      </FormModal>

      <FormModal
        isOpen={isEditPatientModalOpen}
        onClose={() => setIsEditPatientModalOpen(false)}
        title="Edit Patient Details"
      >
        <EditPatientForm
          patientId={id || ''}
          initialData={patient}
          onSuccess={handleEditPatientSubmit}
        />
      </FormModal>

      <FormModal
        isOpen={isAddVisitModalOpen}
        onClose={() => setIsAddVisitModalOpen(false)}
        title="Record New Visit"
      >
        <AddVisitForm
          patientId={id || ''}
          onSuccess={() => {
            setIsAddVisitModalOpen(false);
            refreshPatientData();
          }}
        />
      </FormModal>

      {/* Manage Beneficiaries Modal */}
      <ManageBeneficiariesModal
        isOpen={isManageBeneficiariesModalOpen}
        onClose={() => setIsManageBeneficiariesModalOpen(false)}
        currentMedicalAid={patient?.medicalAidDetails?.[0] ? {
          id: '', // This would need to be retrieved from the actual medical aid details
          provider: patient.medicalAidDetails[0].provider,
          scheme: patient.medicalAidDetails[0].scheme,
          membership_number: patient.medicalAidDetails[0].membershipNumber,
          plan_type: patient.medicalAidDetails[0].planType,
          main_member_name: patient.medicalAidDetails[0].mainMemberName,
          main_member_id_number: patient.medicalAidDetails[0].mainMemberIdNumber,
          patient_id: id || ''
        } : undefined}
        patientId={id || ''}
        onRefresh={refreshPatientData}
      />
    </motion.div>
  );
};

export default PatientDetail;