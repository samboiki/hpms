import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  Heart,
  Activity,
  Stethoscope,
  Pill,
  Clipboard,
  CalendarClock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Building2
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddMedicalRecordForm from '../components/forms/AddMedicalRecordForm';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import EditPatientForm from '../components/forms/EditPatientForm';
import { supabase } from '../lib/supabase';
import { logDatabaseError } from '../lib/supabase';
import { format } from 'date-fns';

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

  const handleEditPatientSubmit = async () => {
    await fetchPatientDetails();
    setIsEditPatientModalOpen(false);
  };

  const calculateAge = (dateOfBirth: string) => {
    return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'inactive': return 'error';
      default: return 'glass';
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
            onClick={() => navigate('/patients')}
            className="mr-4"
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
          <Button variant="outline">
            <FileText size={16} className="mr-2" />
            Export Data
          </Button>
          <Button>
            <Calendar size={16} className="mr-2" />
            Schedule Visit
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
                  {patient.first_name} {patient.last_name}
                </h2>
                <p className="text-gray-500 mt-1">
                  {calculateAge(patient.date_of_birth)} years • {patient.gender}
                </p>
                
                <div className="flex justify-center mt-3 space-x-2">
                  <Badge variant="success">Active Patient</Badge>
                  {patient.medical_aid_details && (
                    <Badge variant="azure">Insured</Badge>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-center text-gray-600">
                    <Phone size={16} className="text-[#01b9d4] mr-3" />
                    <span>{patient.cell_number || 'No phone number'}</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-600">
                    <Mail size={16} className="text-[#01b9d4] mr-3" />
                    <span>{patient.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-600">
                    <MapPin size={16} className="text-[#01b9d4] mr-3" />
                    <span>{patient.home_address || 'No address'}</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#01b9d4]">12</div>
                    <div className="text-xs text-gray-500">Visits</div>
                  </div>
                  <div className="text-center border-x border-gray-100">
                    <div className="text-2xl font-bold text-[#01b9d4]">4</div>
                    <div className="text-xs text-gray-500">Reports</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#01b9d4]">2</div>
                    <div className="text-xs text-gray-500">Referrals</div>
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
                {patient.medical_aid_details && (
                  <Button variant="ghost" size="sm" className="text-white" onClick={() => setIsMedicalAidModalOpen(true)}>
                    <Edit3 size={16} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {patient.medical_aid_details && patient.medical_aid_details[0] ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Provider</h4>
                      <p className="text-lg font-semibold text-gray-900">{patient.medical_aid_details[0].provider}</p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Scheme</h4>
                    <p className="text-gray-900">{patient.medical_aid_details[0].scheme}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Membership Number</h4>
                    <p className="text-gray-900 font-mono">{patient.medical_aid_details[0].membership_number}</p>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-500">Main Member</h4>
                    <p className="text-gray-900 font-medium">{patient.medical_aid_details[0].main_member_name}</p>
                    <p className="text-sm text-gray-500">ID: {patient.medical_aid_details[0].main_member_id_number}</p>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-4"
                    onClick={() => setIsMedicalAidModalOpen(true)}
                  >
                    <Edit3 size={14} className="mr-2" />
                    Update Details
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-4">No medical aid information</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsMedicalAidModalOpen(true)}
                  >
                    <PlusCircle size={14} className="mr-2" />
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
                {patient.next_of_kin && patient.next_of_kin[0] && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-white"
                    onClick={() => setIsNextOfKinModalOpen(true)}
                  >
                    <Edit3 size={16} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
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
                    <PlusCircle size={14} className="mr-2" />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <CardContent className="p-6">
                <Activity size={24} className="mb-4" />
                <h3 className="text-2xl font-bold">12</h3>
                <p className="text-sm opacity-90">Total Visits</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <CardContent className="p-6">
                <Stethoscope size={24} className="mb-4" />
                <h3 className="text-2xl font-bold">4</h3>
                <p className="text-sm opacity-90">Consultations</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <CardContent className="p-6">
                <Pill size={24} className="mb-4" />
                <h3 className="text-2xl font-bold">8</h3>
                <p className="text-sm opacity-90">Prescriptions</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-rose-500 to-pink-600 text-white">
              <CardContent className="p-6">
                <Clipboard size={24} className="mb-4" />
                <h3 className="text-2xl font-bold">3</h3>
                <p className="text-sm opacity-90">Reports</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-gray-100">
              <div className="flex justify-between items-center">
                <CardTitle>Quick Actions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button className="flex flex-col items-center justify-center h-24 bg-gradient-to-r from-[#01b9d4] to-[#0197d4] hover:from-[#0197d4] hover:to-[#01b9d4]">
                  <Calendar size={24} className="mb-2" />
                  <span>New Visit</span>
                </Button>
                
                <Button variant="outline" className="flex flex-col items-center justify-center h-24">
                  <FileText size={24} className="mb-2" />
                  <span>Add Record</span>
                </Button>
                
                <Button variant="outline" className="flex flex-col items-center justify-center h-24">
                  <CalendarClock size={24} className="mb-2" />
                  <span>Schedule</span>
                </Button>
                
                <Button variant="outline" className="flex flex-col items-center justify-center h-24">
                  <Activity size={24} className="mb-2" />
                  <span>Vitals</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-gray-100">
              <div className="flex justify-between items-center">
                <CardTitle>Recent Activity</CardTitle>
                <Button variant="ghost" size="sm">View All</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                <div className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <div className="mr-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle size={20} className="text-emerald-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">Consultation Completed</h4>
                      <p className="text-sm text-gray-500">Dr. Sarah Johnson • General Check-up</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-500">2 days ago</span>
                      <Button variant="ghost" size="sm" className="ml-2">
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <div className="mr-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Calendar size={20} className="text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">Appointment Scheduled</h4>
                      <p className="text-sm text-gray-500">Follow-up Visit • Next Week</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-500">3 days ago</span>
                      <Button variant="ghost" size="sm" className="ml-2">
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <div className="mr-4">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Pill size={20} className="text-amber-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">Prescription Updated</h4>
                      <p className="text-sm text-gray-500">Dr. Michael Chen • Medication Review</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-500">1 week ago</span>
                      <Button variant="ghost" size="sm" className="ml-2">
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="border-b border-gray-100">
                <CardTitle>Upcoming Appointments</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="azure">Follow-up</Badge>
                      <span className="text-sm text-gray-500">Tomorrow, 10:00 AM</span>
                    </div>
                    <h4 className="font-medium">Dr. Sarah Johnson</h4>
                    <p className="text-sm text-gray-500">General Medicine</p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="warning">Lab Test</Badge>
                      <span className="text-sm text-gray-500">Next Week</span>
                    </div>
                    <h4 className="font-medium">Blood Work</h4>
                    <p className="text-sm text-gray-500">Routine Check</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-gray-100">
                <CardTitle>Latest Vitals</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Blood Pressure</p>
                      <h4 className="text-lg font-medium">120/80</h4>
                      <Badge variant="success" size="sm">Normal</Badge>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Heart Rate</p>
                      <h4 className="text-lg font-medium">72 bpm</h4>
                      <Badge variant="success" size="sm">Normal</Badge>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Temperature</p>
                      <h4 className="text-lg font-medium">36.6°C</h4>
                      <Badge variant="success" size="sm">Normal</Badge>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Weight</p>
                      <h4 className="text-lg font-medium">75 kg</h4>
                      <Badge variant="success" size="sm">Normal</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
        title={patient.next_of_kin && patient.next_of_kin[0] ? "Update Next of Kin" : "Add Next of Kin"}
      >
        <NextOfKinForm
          patientId={id || ''}
          initialData={patient.next_of_kin && patient.next_of_kin[0]}
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
    </motion.div>
  );
};

export default PatientDetail;