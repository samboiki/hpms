import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  User,
  Phone,
  Mail,
  Building2,
  Heart,
  Activity,
  Stethoscope,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  ImageIcon,
  Microscope,
  ChevronRight,
  Calendar,
  FileText,
  Thermometer,
  Weight,
  MessageSquare
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import AddVisitForm from '../components/forms/AddVisitForm';
import EditVisitForm from '../components/forms/EditVisitForm';
import VisitModal from '../components/visits/VisitModal';
import MedicalAidForm from '../components/forms/MedicalAidForm';
import EditPatientForm from '../components/forms/EditPatientForm';
import SendMessageModal from '../components/modals/SendMessageModal';
import PatientDataTabs from '../components/patients/PatientDataTabs';
import PremiumFolderTabs from '../components/patients/PremiumFolderTabs';
import { useRealtimeAppointments } from '../hooks/useRealtimeAppointments';
import VitalsForm from '../components/forms/VitalsForm';
import AddLabRequestForm from '../components/forms/AddLabRequestForm';
import AddMediaRequestForm from '../components/forms/AddMediaRequestForm';
import { toast } from 'react-hot-toast';
import { defaultSMSService } from '../services/smsPortal';
import { authStore } from '../stores/authStore';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  marital_status?: string;
  occupation?: string;
  employer?: string;
  home_language?: string;
  home_address?: string;
  postal_address?: string;
  postal_code?: string;
  avatar?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
}

interface NextOfKin {
  id: string;
  patient_id: string;
  name: string;
  relationship: string;
  phone: string;
  address?: string;
}

interface MedicalAidDetails {
  id: string;
  patient_id: string;
  provider: string;
  scheme: string;
  membership_number: string;
  plan_type?: string;
  main_member_name: string;
  main_member_id_number: string;
  relationship_to_main: string;
}

interface LatestVitals {
  id: string;
  blood_pressure?: string;
  temperature?: number;
  pulse_rate?: number;
  respiratory_rate?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  created_at: string;
}

interface Visit {
  id: string;
  appointment_id?: string;
  visit_date: string;
  visit_time: string;
  visit_type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'in-progress' | 'completed' | 'cancelled' | 'scheduled';
  doctor_name: string;
  chief_complaint: string;
  diagnosis: string;
  treatment_plan?: string;
  prescription?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
  notes?: string;
  vitals: {
    blood_pressure?: string;
    temperature?: number;
    pulse_rate?: number;
    respiratory_rate?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
  lab_results?: Array<{
    id?: string;
    name: string;
    value: string;
    unit: string;
    reference_range: string;
    status: 'normal' | 'high' | 'low' | 'critical';
    date: string;
  }>;
  media?: Array<{
    type: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'photo';
    url: string;
    description: string;
    date: string;
  }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Visit Card Component
const VisitCard: React.FC<{ visit: any; index: number; onClick: () => void; onStatusChange: (id: string, status: string, appointmentId?: string) => void }> = ({ visit, index, onClick, onStatusChange }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative group/visit mb-4"
      onClick={onClick}
    >
      {/* Timeline node - properly aligned */}
      <div className={`absolute left-4 top-3 w-8 h-8 -ml-4 rounded-full flex items-center justify-center shadow-md ${
        visit.status === 'completed' ? 'bg-gradient-to-br from-emerald-500 to-green-600' :
        visit.status === 'in-progress' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
        'bg-gradient-to-br from-gray-400 to-slate-500'
      }`}>
        <span className="text-white text-xs font-bold">{index + 1}</span>
      </div>

      <motion.div className="ml-8 relative group/card">
        <div className={`absolute inset-0 rounded-lg opacity-0 group-hover/card:opacity-100 transition-opacity ${
          visit.visit_type === 'consultation' ? 'bg-gradient-to-r from-blue-500/5 to-indigo-500/5' :
          visit.visit_type === 'follow-up' ? 'bg-gradient-to-r from-emerald-500/5 to-green-500/5' :
          visit.visit_type === 'procedure' ? 'bg-gradient-to-r from-purple-500/5 to-pink-500/5' :
          'bg-gradient-to-r from-gray-500/5 to-slate-500/5'
        }`}></div>
        <div className={`relative bg-white/95 rounded-lg shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden ${
          visit.visit_type === 'consultation' ? 'border-l-4 border-l-blue-500' :
          visit.visit_type === 'follow-up' ? 'border-l-4 border-l-emerald-500' :
          visit.visit_type === 'procedure' ? 'border-l-4 border-l-purple-500' :
          'border-l-4 border-l-gray-400'
        } border border-gray-200/50`}>
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    visit.visit_type === 'consultation' ? 'bg-blue-100' :
                    visit.visit_type === 'follow-up' ? 'bg-emerald-100' :
                    visit.visit_type === 'procedure' ? 'bg-purple-100' :
                    'bg-gray-100'
                  }`}>
                    {visit.visit_type === 'consultation' ? <Stethoscope className="w-4 h-4 text-blue-600" /> :
                     visit.visit_type === 'follow-up' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                     visit.visit_type === 'procedure' ? <Activity className="w-4 h-4 text-purple-600" /> :
                     <User className="w-4 h-4 text-gray-600" />}
                  </div>
                  <p className="text-sm font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)}
                  </p>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                      visit.status === 'completed' ? 'bg-green-500' :
                      visit.status === 'in-progress' ? 'bg-blue-500 animate-pulse' :
                      'bg-gray-400'
                    }`}></div>
                    <span className={`text-xs font-medium ${
                      visit.status === 'completed' ? 'text-green-600' :
                      visit.status === 'in-progress' ? 'text-blue-600' :
                      'text-gray-500'
                    }`}>
                      {visit.status === 'completed' ? 'Completed' :
                       visit.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  {format(new Date(visit.visit_date), 'MMM d, yyyy')} • {visit.visit_time} • Dr. {visit.doctor_name}
                </p>
                
                {(visit.chief_complaint || visit.diagnosis) && (
                  <div className="mt-3 space-y-1">
                    {visit.chief_complaint && (
                      <p className="text-xs text-gray-700">
                        <span className="font-medium">Complaint:</span> {visit.chief_complaint}
                      </p>
                    )}
                    {visit.diagnosis && (
                      <p className="text-xs text-gray-700">
                        <span className="font-medium">Diagnosis:</span> {visit.diagnosis}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Microscope className="w-3 h-3" />
                    <span>2 Results</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    <span>3 Images</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {visit.status === 'in-progress' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(visit.id, 'completed', visit.appointment_id);
                    }}
                    className="px-3 py-1.5 bg-emerald-500 text-white rounded-md text-xs font-medium hover:bg-emerald-600 transition-colors"
                  >
                    Complete
                  </button>
                )}
                {visit.status === 'scheduled' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(visit.id, 'in-progress', visit.appointment_id);
                    }}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs font-medium hover:bg-blue-600 transition-colors"
                  >
                    Start Visit
                  </button>
                )}
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const PatientModernDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [nextOfKin, setNextOfKin] = useState<NextOfKin | null>(null);
  const [medicalAid, setMedicalAid] = useState<MedicalAidDetails | null>(null);
  const [latestVitals, setLatestVitals] = useState<LatestVitals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNextOfKinModalOpen, setIsNextOfKinModalOpen] = useState(false);
  const [isAddVisitModalOpen, setIsAddVisitModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isVisitDetailModalOpen, setIsVisitDetailModalOpen] = useState(false);
  const [isEditVisitModalOpen, setIsEditVisitModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isMedicalAidModalOpen, setIsMedicalAidModalOpen] = useState(false);
  const [smsContent, setSmsContent] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [labRequests, setLabRequests] = useState<any[]>([]);
  const [mediaRequests, setMediaRequests] = useState<any[]>([]);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [isLabRequestModalOpen, setIsLabRequestModalOpen] = useState(false);
  const [isMediaRequestModalOpen, setIsMediaRequestModalOpen] = useState(false);
  const [currentPracticeId, setCurrentPracticeId] = useState<string | null>(null);
  const [currentDoctorId, setCurrentDoctorId] = useState<string>('');
  const [doctorAppointments, setDoctorAppointments] = useState<any[]>([]);

  // Extract fetchData function so it can be called from buttons
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!id || !UUID_REGEX.test(id)) {
        throw new Error('Invalid patient ID format. Please use a valid UUID.');
      }
      
      const { data: patientData, error: patientError } = await supabase
        .from('patient_details_view')
        .select('*')
        .eq('id', id)
        .single();

      if (patientError) throw patientError;
      if (!patientData) throw new Error('Patient not found');
      
      setPatient(patientData);
      
      // Extract medical aid from the view
      if (patientData.medical_aid_details && patientData.medical_aid_details.length > 0) {
        setMedicalAid(patientData.medical_aid_details[0]);
      }

      const { data: visitsData, error: visitsError } = await supabase
        .from('visit_details_view')
        .select('*')
        .eq('patient_id', id)
        .order('visit_date', { ascending: true });

      if (visitsError) throw visitsError;
      setVisits(visitsData || []);

      // Fetch all patient appointments - Fixed query syntax
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          doctor:users!appointments_doctor_id_fkey(
            id,
            email,
            full_name
          )
        `)
        .eq('patient_id', id)
        .order('date', { ascending: false })
        .order('time', { ascending: false });
      
      if (appointmentsError) console.error('Error fetching appointments:', appointmentsError);
      else {
        const formattedAppointments = appointmentsData?.map(apt => ({
          ...apt,
          doctor_name: apt.doctor?.full_name || 'Unassigned'
        })) || [];
        setAppointments(formattedAppointments);
      }

      // Fetch all vitals for the patient
      const { data: allVitalsData, error: allVitalsError } = await supabase
        .from('vitals')
        .select('*')
        .in('visit_id', visitsData?.map(v => v.id) || [])
        .order('created_at', { ascending: false });
      
      if (allVitalsError) console.error('Error fetching vitals:', allVitalsError);
      else setVitals(allVitalsData || []);

      // Fetch lab requests - Fixed to use visit_id instead of patient_id
      const visitIds = visitsData?.map(v => v.id) || [];
      let labRequestsData = [];
      if (visitIds.length > 0) {
        const { data, error: labRequestsError } = await supabase
          .from('lab_requests')
          .select('*')
          .in('visit_id', visitIds)
          .order('created_at', { ascending: false });
        
        if (labRequestsError) console.error('Error fetching lab requests:', labRequestsError);
        else labRequestsData = data || [];
      }
      setLabRequests(labRequestsData);

      // Fetch media requests - Fixed to use visit_id instead of patient_id
      let mediaRequestsData = [];
      if (visitIds.length > 0) {
        const { data, error: mediaRequestsError } = await supabase
          .from('media_requests')
          .select('*')
          .in('visit_id', visitIds)
          .order('created_at', { ascending: false });
        
        if (mediaRequestsError) console.error('Error fetching media requests:', mediaRequestsError);
        else mediaRequestsData = data || [];
      }
      setMediaRequests(mediaRequestsData);

      // Get current user info and practice
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentDoctorId(user.id);
        const { data: userData } = await supabase
          .from('users')
          .select('practice_id')
          .eq('id', user.id)
          .single();
        
        if (userData?.practice_id) {
          setCurrentPracticeId(userData.practice_id);
          
          // Fetch all appointments for the doctor's queue
          const { data: queueData, error: queueError } = await supabase
            .from('appointments')
            .select('*, patient:patients(*)')
            .eq('practice_id', userData.practice_id)
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date', { ascending: true })
            .order('time', { ascending: true });
          
          if (!queueError && queueData) {
            setDoctorAppointments(queueData);
          }
        }
      }

      // Fetch Next of Kin
      const { data: nextOfKinData, error: nextOfKinError } = await supabase
        .from('next_of_kin')
        .select('*')
        .eq('patient_id', id)
        .maybeSingle();

      if (nextOfKinError && nextOfKinError.code !== 'PGRST116') {
        console.error('Error fetching next of kin:', nextOfKinError);
      } else {
        setNextOfKin(nextOfKinData);
      }

      // Fetch Latest Vitals
      const { data: vitalsData, error: vitalsError } = await supabase
        .from('vitals')
        .select('*')
        .in('visit_id', visitsData?.map(v => v.id) || [])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vitalsError && vitalsError.code !== 'PGRST116') {
        console.error('Error fetching vitals:', vitalsError);
      } else {
        setLatestVitals(vitalsData);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while fetching patient data');
      if (error instanceof Error && error.message.includes('Invalid patient ID format')) {
        navigate('/patients');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, navigate]);

  const calculateAge = (dateOfBirth: string) => {
    return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
  };

  const isBloodPressureAbnormal = (bp: string) => {
    const [systolic, diastolic] = bp.split('/').map(Number);
    return systolic > 140 || systolic < 90 || diastolic > 90 || diastolic < 60;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'emerald';
      case 'in-progress':
        return 'amber';
      case 'cancelled':
        return 'rose';
      default:
        return 'glass';
    }
  };

  const handleVisitClick = async (visitId: string) => {
    try {
      const { data, error } = await supabase
        .from('visit_details_view')
        .select('*')
        .eq('id', visitId)
        .single();

      if (error) throw error;
      setSelectedVisit(data);
      setIsVisitDetailModalOpen(true);
    } catch (error) {
      console.error('Error fetching visit details:', error);
    }
  };

  const handleLinkToVisit = async (itemId: string, visitId: string, type: 'vital' | 'lab' | 'media') => {
    try {
      let tableName = '';
      if (type === 'vital') tableName = 'vitals';
      else if (type === 'lab') tableName = 'lab_requests';
      else if (type === 'media') tableName = 'media_requests';
      
      const { error } = await supabase
        .from(tableName)
        .update({ visit_id: visitId })
        .eq('id', itemId);
      
      if (error) throw error;
      
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} linked to visit successfully`);
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error linking to visit:', error);
      toast.error('Failed to link to visit');
    }
  };

  const handleVisitStatusChange = async (visitId: string, status: string, appointmentId?: string) => {
    try {
      // Update visit status
      const { error: visitError } = await supabase
        .from('visits')
        .update({ status })
        .eq('id', visitId);

      if (visitError) throw visitError;

      // If completing a visit and it has an associated appointment, update the appointment too
      if (status === 'completed' && appointmentId) {
        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', appointmentId);

        if (appointmentError) throw appointmentError;
      }

      const { data: updatedVisits } = await supabase
        .from('visit_details_view')
        .select('*')
        .eq('patient_id', id)
        .order('visit_date', { ascending: false });

      setVisits(updatedVisits || []);
    } catch (error) {
      console.error('Error updating visit status:', error);
    }
  };

  const handleSendSms = async () => {
    if (!smsContent.trim() || !smsPhone.trim()) {
      alert('Please enter both phone number and message content');
      return;
    }

    setIsSendingSms(true);
    try {
      const result = await defaultSMSService.sendSMS({
        to: smsPhone,
        content: smsContent,
        reference: `patient-${id}-${Date.now()}`
      });

      if (result.success) {
        alert('SMS sent successfully!');
        setIsSmsModalOpen(false);
        setSmsContent('');
        setSmsPhone('');
      } else {
        alert(`Failed to send SMS: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      alert('Failed to send SMS. Please try again.');
    } finally {
      setIsSendingSms(false);
    }
  };

  const openSmsModal = () => {
    // Pre-populate with next of kin details
    const defaultPhone = nextOfKin?.phone || patient?.emergency_contact_phone || '';
    const defaultMessage = `Hello ${nextOfKin?.name || patient?.emergency_contact_name || 'there'},

This is regarding ${patient?.first_name} ${patient?.last_name}'s medical care. Please contact us at your earliest convenience.

Best regards,
Medical Team`;
    
    setSmsPhone(defaultPhone);
    setSmsContent(defaultMessage);
    setIsSmsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/patients')}
          variant="outline"
          className="mt-4"
        >
          <ChevronLeft size={16} className="mr-2" />
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 relative overflow-hidden">
      {/* Premium mesh gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-purple-50/30 via-transparent to-transparent"></div>
      
      {/* Subtle texture overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'dots\' x=\'0\' y=\'0\' width=\'60\' height=\'60\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'1\' fill=\'%23000\' opacity=\'0.1\'/%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'1\' fill=\'%23000\' opacity=\'0.1\'/%3E%3Ccircle cx=\'30\' cy=\'2\' r=\'1\' fill=\'%23000\' opacity=\'0.1\'/%3E%3Ccircle cx=\'2\' cy=\'30\' r=\'1\' fill=\'%23000\' opacity=\'0.1\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'url(%23dots)\'/%3E%3C/svg%3E")', backgroundSize: '60px 60px' }}></div>
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>
      
      {/* Floating light orbs for depth */}
      <div className="absolute top-40 left-20 w-72 h-72 bg-gradient-to-br from-[#01b9d5]/10 to-cyan-400/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-40 right-20 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-float-delayed"></div>
      <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-gradient-to-br from-indigo-400/10 to-blue-400/10 rounded-full blur-3xl animate-float-slow"></div>
      <div className="relative z-10 px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Premium Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden"
        >
          <div className="relative bg-white/95 backdrop-blur-xl shadow-2xl border border-gray-200/50 overflow-hidden rounded-2xl">
            {/* Premium glass morphism background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/20 to-gray-100/10 rounded-2xl"></div>
            
            <div className="relative p-4">
            
            {patient && (
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                {/* Enhanced Avatar Section - Circle with Pulsating Ring */}
                <div className="relative group">
                  {/* Pulsating outer ring */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                  <div className="absolute -inset-1 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-full opacity-50"></div>
                  
                  {/* Avatar circle */}
                  <div className="relative h-20 w-20 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                    <img 
                      src="https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200"
                      alt={`${patient.first_name} ${patient.last_name}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
                
                {/* Enhanced Patient Info */}
                <div className="flex-1">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
                    <div>
                      <h1 className="text-2xl lg:text-3xl font-bold leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        <span className="text-gray-900">{patient.first_name}</span> <span className="text-gray-500">{patient.last_name}</span>
                      </h1>
                      {/* Patient details in one row */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-medium mt-2">
                        <span>Patient ID: {patient.id.slice(0, 8)}</span>
                        <span className="text-gray-400">•</span>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <span>{calculateAge(patient.date_of_birth)} yrs • {patient.gender}</span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{patient.cell_number}</span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span className="truncate max-w-[200px]">{patient.email}</span>
                        </div>
                      </div>
                      
                      {/* Medical Aid - Simple one row with logo */}
                      {medicalAid && (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className="mt-3 flex items-center gap-3 text-sm"
                        >
                          {/* Medical Aid Logo */}
                          <div className="relative">
                            <div className="w-12 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center text-white font-bold text-xs shadow-md">
                              {medicalAid.provider.includes('NMC') ? 'NMC' : 
                               medicalAid.provider.includes('NHP') ? 'NHP' :
                               medicalAid.provider.includes('Nammed') ? 'NAM' :
                               medicalAid.provider.includes('Gem') ? 'GEM' :
                               'MA'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-700">{medicalAid.provider}</span>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                              {medicalAid.scheme}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-600 font-mono">{medicalAid.membership_number}</span>
                          </div>
                        </motion.div>
                      )}
                    </div>
                    
                  </div>
                  
                  
                </div>
              </div>
            )}
            
            {/* Action Buttons - Bottom Right */}
            {patient && (
              <div className="absolute bottom-4 right-4 flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsMessageModalOpen(true)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 font-medium text-sm flex items-center gap-2"
                  title="Send Message"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsEditPatientModalOpen(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-xl flex items-center gap-2 shadow-lg hover:shadow-2xl hover:shadow-[#01b9d5]/30 transition-all duration-300 font-semibold text-sm"
                >
                  View Profile
                </motion.button>
              </div>
            )}
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Patient Records - Premium Folder Tabs */}
          <div className="lg:col-span-9 space-y-4 md:space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden"
            >
              {/* Premium Background Effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/50 to-blue-50/30 rounded-2xl"></div>
              <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#01b9d5]/5 to-purple-500/5 rounded-full blur-3xl animate-float-slow"></div>
              <div className="absolute bottom-0 left-0 w-60 h-60 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 rounded-full blur-2xl animate-float-delayed"></div>
              
              <div className="relative backdrop-blur-xl bg-white/95 border border-gray-200/50 rounded-2xl shadow-xl p-6">
                {/* Premium Folder Tabs Interface */}
                <PremiumFolderTabs 
                  visits={visits}
                  vitals={vitals}
                  patientId={patient?.id || ''}
                  onAddVisit={() => setIsAddVisitModalOpen(true)}
                  onAddVitals={() => setIsVitalsModalOpen(true)}
                  onVisitClick={(visitId) => handleVisitClick(visitId)}
                  onEditVisit={(visit) => {
                    setSelectedVisit(visit);
                    setIsEditVisitModalOpen(true);
                  }}
                  onVisitStatusChange={(visitId, status) => handleVisitStatusChange(visitId, status)}
                />
              </div>
            </motion.div>
          </div>

          {/* Right Sidebar - Appointment Dashboard */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
          {/* Doctor's Premium Appointment Management Dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative group"
          >
            {/* Floating glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d4]/20 via-purple-500/20 to-indigo-600/20 rounded-xl blur-xl opacity-0 group-hover:opacity-50 transition-all duration-500 -z-10"></div>
            
            <div className="relative bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 overflow-hidden">
              {/* Animated gradient header */}
              <div className="h-2 bg-gradient-to-r from-[#01b9d4] via-purple-500 to-indigo-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
              </div>
              
              {/* Main content */}
              <div className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-[#01b9d4] to-purple-600 rounded-xl shadow-lg">
                      <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>Appointments Today</h3>
                      <p className="text-xs text-gray-500 font-medium">Live Queue Management</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600 font-medium">Live</span>
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="p-3 bg-gradient-to-br from-emerald-500/10 to-green-600/10 rounded-xl border border-emerald-500/20 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-xs font-medium text-emerald-700">Completed</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">
                      {doctorAppointments.filter(apt => 
                        apt.doctor_id === currentDoctorId && 
                        apt.status === 'completed' &&
                        apt.date === format(new Date(), 'yyyy-MM-dd')
                      ).length}
                    </p>
                  </motion.div>
                  
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="p-3 bg-gradient-to-br from-amber-500/10 to-yellow-600/10 rounded-xl border border-amber-500/20 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span className="text-xs font-medium text-amber-700">In Queue</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-600">
                      {doctorAppointments.filter(apt => 
                        (apt.doctor_id === currentDoctorId || (!apt.doctor_id && apt.status === 'ready')) && 
                        ['scheduled', 'ready'].includes(apt.status) &&
                        apt.date === format(new Date(), 'yyyy-MM-dd')
                      ).length}
                    </p>
                  </motion.div>
                </div>
                
                {/* Live Queue */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-800">Next Patients</h4>
                    <span className="text-xs text-gray-500">Updated now</span>
                  </div>
                  
                  {/* Queue Items - Dynamic */}
                  {(() => {
                    const todayQueue = doctorAppointments
                      .filter(apt => {
                        const isToday = apt.date === format(new Date(), 'yyyy-MM-dd');
                        const isMyPatient = apt.doctor_id === currentDoctorId || (!apt.doctor_id && apt.status === 'ready');
                        const notCurrentPatient = apt.patient_id !== id;
                        const isQueued = ['scheduled', 'ready'].includes(apt.status);
                        return isToday && isMyPatient && notCurrentPatient && isQueued;
                      })
                      .sort((a, b) => {
                        // Ready patients first
                        if (a.status === 'ready' && b.status !== 'ready') return -1;
                        if (b.status === 'ready' && a.status !== 'ready') return 1;
                        // Then by time
                        return a.time.localeCompare(b.time);
                      })
                      .slice(0, 3);
                    
                    if (todayQueue.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Calendar className="w-6 h-6 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-600">No more appointments in queue</p>
                          <p className="text-xs text-gray-500 mt-1">Great job today!</p>
                        </div>
                      );
                    }
                    
                    return todayQueue.map((apt, index) => (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative group/queue cursor-pointer"
                        onClick={() => navigate(`/patients/${apt.patient_id}`)}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-r ${
                          apt.status === 'ready' ? 'from-green-500/5 to-emerald-500/5' :
                          'from-blue-500/5 to-purple-500/5'
                        } rounded-lg opacity-0 group-hover/queue:opacity-100 transition-opacity`}></div>
                        <div className={`relative p-3 bg-white/90 rounded-lg border ${
                          apt.status === 'ready' ? 'border-green-200/50' : 'border-blue-200/50'
                        } shadow-sm hover:shadow-md transition-all`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 bg-gradient-to-br ${
                              apt.status === 'ready' ? 'from-green-500 to-emerald-600' :
                              index === 0 ? 'from-blue-500 to-purple-600' :
                              index === 1 ? 'from-amber-500 to-orange-600' :
                              'from-gray-400 to-slate-500'
                            } rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-800">
                                {apt.patient.first_name} {apt.patient.last_name}
                              </p>
                              <p className="text-xs text-gray-600">
                                {apt.type} • {apt.time}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${
                                apt.status === 'ready' ? 'bg-green-500' : 'bg-amber-500'
                              }`}></div>
                              <span className={`text-xs font-medium ${
                                apt.status === 'ready' ? 'text-green-600' : 'text-amber-600'
                              }`}>
                                {apt.status === 'ready' ? 'Ready' : 'Waiting'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ));
                  })()}
                </div>
                
                {/* Quick Actions */}
                <div className="space-y-2">
                  {(() => {
                    const nextPatient = doctorAppointments
                      .filter(apt => {
                        const isToday = apt.date === format(new Date(), 'yyyy-MM-dd');
                        const isMyPatient = apt.doctor_id === currentDoctorId || (!apt.doctor_id && apt.status === 'ready');
                        const notCurrentPatient = apt.patient_id !== id;
                        const isQueued = ['scheduled', 'ready'].includes(apt.status);
                        return isToday && isMyPatient && notCurrentPatient && isQueued;
                      })
                      .sort((a, b) => {
                        if (a.status === 'ready' && b.status !== 'ready') return -1;
                        if (b.status === 'ready' && a.status !== 'ready') return 1;
                        return a.time.localeCompare(b.time);
                      })[0];
                    
                    return (
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          if (!nextPatient) {
                            toast.error('No appointments in queue');
                            return;
                          }
                          
                          try {
                            // Create visit and update appointment
                            const { data: visit, error: visitError } = await supabase
                              .from('visits')
                              .insert([{
                                appointment_id: nextPatient.id,
                                patient_id: nextPatient.patient_id,
                                doctor_id: currentDoctorId,
                                visit_date: nextPatient.date,
                                visit_time: nextPatient.time,
                                visit_type: nextPatient.type || 'consultation',
                                chief_complaint: nextPatient.notes || 'See appointment notes',
                                status: 'in-progress',
                                created_at: new Date().toISOString()
                              }])
                              .select()
                              .single();
                            
                            if (visitError) throw visitError;
                            
                            const { error: updateError } = await supabase
                              .from('appointments')
                              .update({ 
                                status: 'in-progress',
                                doctor_id: currentDoctorId,
                                updated_at: new Date().toISOString()
                              })
                              .eq('id', nextPatient.id);
                            
                            if (updateError) {
                              await supabase.from('visits').delete().eq('id', visit.id);
                              throw updateError;
                            }
                            
                            toast.success(`Starting visit for ${nextPatient.patient.first_name} ${nextPatient.patient.last_name}`);
                            navigate(`/patients/${nextPatient.patient_id}`);
                          } catch (error) {
                            console.error('Error starting next visit:', error);
                            toast.error('Failed to start next visit');
                          }
                        }}
                        disabled={!nextPatient}
                        className="w-full p-3 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Activity className="w-4 h-4" />
                        {nextPatient ? `Start Next Visit (${nextPatient.patient.first_name})` : 'No Patients in Queue'}
                      </motion.button>
                    );
                  })()}
                  
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/appointments')}
                      className="p-2.5 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2 text-xs font-medium text-gray-600"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Schedule
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={fetchData}
                      className="p-2.5 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2 text-xs font-medium text-gray-600"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Refresh
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>


          {/* Premium Next of Kin Card */}
          <motion.div
            initial={{ opacity: 0, y: 20, rotateX: -5 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            whileHover={{ y: -2, scale: 1.01 }}
            className="relative group"
          >
            {/* Floating glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d4]/20 via-purple-500/20 to-blue-600/20 rounded-xl blur-xl opacity-0 group-hover:opacity-70 transition-all duration-500 -z-10"></div>
            
            {/* Main card */}
            <div className="relative bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 overflow-hidden">
              {/* Animated gradient header */}
              <div className="h-2 bg-gradient-to-r from-[#01b9d4] via-purple-500 to-blue-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
              </div>
              
              {/* Floating orbs background */}
              <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-[#01b9d4]/10 to-purple-500/10 rounded-full blur-2xl opacity-60"></div>
              <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-xl opacity-40"></div>
              
              <div className="relative p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-[#01b9d4] to-purple-600 rounded-xl shadow-lg">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>Next of Kin</h3>
                      <p className="text-xs text-gray-500 font-medium">Emergency Contact Details</p>
                    </div>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsNextOfKinModalOpen(true)}
                    className="p-2.5 bg-gray-50 hover:bg-white rounded-xl border border-gray-200 hover:border-[#01b9d4]/50 transition-all duration-300 shadow-sm"
                  >
                    <Edit3 className="w-4 h-4 text-gray-600 hover:text-[#01b9d4] transition-colors" />
                  </motion.button>
                </div>
                
                <div className="space-y-5">
                  {/* Next of Kin Info - Clickable */}
                  <div className="p-4 bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-xl border border-gray-200/50 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center shadow-md">
                          <Heart className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Emergency Contact</p>
                          <p className="text-sm font-bold text-gray-800">
                            {nextOfKin?.name || patient?.emergency_contact_name || 'No emergency contact'}
                          </p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsNextOfKinModalOpen(true)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3 h-3 text-gray-600" />
                      </motion.button>
                    </div>
                    <div className="space-y-1 text-xs text-gray-500 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <span>Phone: {nextOfKin?.phone || patient?.emergency_contact_phone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <span>Relationship: {nextOfKin?.relationship || patient?.emergency_contact_relationship || 'N/A'}</span>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={openSmsModal}
                        className="flex-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md text-xs font-medium hover:shadow-md transition-all"
                      >
                        <Phone className="w-3 h-3 inline mr-1" />
                        Send Message
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const phone = nextOfKin?.phone || patient?.emergency_contact_phone;
                          if (phone) window.open(`tel:${phone}`, '_self');
                        }}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-medium transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                      </motion.button>
                    </div>
                  </div>
                  
                  {/* Quick actions */}
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="p-3 bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors shadow-sm"
                    >
                      <FileText className="w-4 h-4 text-gray-300" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <FormModal
        isOpen={isVisitDetailModalOpen}
        onClose={() => {
          setIsVisitDetailModalOpen(false);
          setSelectedVisit(null);
        }}
        title="Visit Details"
        hideHeader
      >
        {selectedVisit && (
          <VisitModal
            visit={selectedVisit}
            onClose={() => {
              setIsVisitDetailModalOpen(false);
              setSelectedVisit(null);
            }}
            onStatusChange={(status) => {
              handleVisitStatusChange(selectedVisit.id, status, selectedVisit.appointment_id);
            }}
            onEdit={() => {
              setIsVisitDetailModalOpen(false);
              setIsEditVisitModalOpen(true);
            }}
          />
        )}
      </FormModal>

      <FormModal
        isOpen={isEditVisitModalOpen}
        onClose={() => {
          setIsEditVisitModalOpen(false);
          setSelectedVisit(null);
        }}
        title="Edit Visit"
      >
        {selectedVisit && (
          <EditVisitForm
            visitId={selectedVisit.id}
            initialData={{
              ...selectedVisit,
              visit_type: selectedVisit.visit_type as 'consultation' | 'follow-up' | 'procedure' | 'emergency',
              status: selectedVisit.status as 'in-progress' | 'completed' | 'cancelled',
              treatment_plan: selectedVisit.treatment_plan || '',
              follow_up_required: selectedVisit.follow_up_required || false,
              lab_results: selectedVisit.lab_results || [],
              media: selectedVisit.media || []
            }}
            onSuccess={() => {
              setIsEditVisitModalOpen(false);
              if (id) {
                const fetchVisits = async () => {
                  const { data } = await supabase
                    .from('visit_details_view')
                    .select('*')
                    .eq('patient_id', id)
                    .order('visit_date', { ascending: false });
                  setVisits(data || []);
                };
                fetchVisits();
              }
            }}
          />
        )}
      </FormModal>


      <FormModal
        isOpen={isNextOfKinModalOpen}
        onClose={() => setIsNextOfKinModalOpen(false)}
        title="Update Next of Kin"
      >
        <NextOfKinForm
          patientId={id || ''}
          initialData={nextOfKin ? {
            name: nextOfKin.name,
            relationship: nextOfKin.relationship,
            phone: nextOfKin.phone,
            address: nextOfKin.address || ''
          } : undefined}
          onSuccess={async () => {
            setIsNextOfKinModalOpen(false);
            // Refresh next of kin data
            const { data } = await supabase
              .from('next_of_kin')
              .select('*')
              .eq('patient_id', id)
              .maybeSingle();
            if (data) setNextOfKin(data);
          }}
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
            if (id) {
              const fetchVisits = async () => {
                const { data } = await supabase
                  .from('visit_details_view')
                  .select('*')
                  .eq('patient_id', id)
                  .order('visit_date', { ascending: false });
                setVisits(data || []);
              };
              fetchVisits();
            }
          }}
        />
      </FormModal>

      {/* Patient Profile Modal */}
      <FormModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Patient Profile Details"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Personal Information</h3>
                <Button
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    setIsEditPatientModalOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Full Name</label>
                  <p className="text-gray-800">{patient?.first_name} {patient?.last_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-gray-800">{patient?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Phone</label>
                  <p className="text-gray-800">{patient?.cell_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Date of Birth</label>
                  <p className="text-gray-800">{patient?.date_of_birth}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Gender</label>
                  <p className="text-gray-800">{patient?.gender}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Medical Summary</h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Patient has {visits.length} recorded visits. Latest vitals show normal readings across all parameters.
                  Recommend regular check-ups and continued monitoring.
                </p>
              </div>
            </div>
          </div>
        </div>
      </FormModal>

      {/* Premium SMS Quick Contact Modal */}
      <FormModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        title=""
        hideHeader={true}
      >
        <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 rounded-2xl shadow-2xl overflow-hidden">
          {/* Premium Header */}
          <div className="relative bg-gradient-to-r from-[#01b9d5] to-purple-600 p-6 text-white">
            <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/20 to-purple-600/20 backdrop-blur-sm"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Send SMS Message</h2>
                <p className="text-blue-100 text-sm">Contact Next of Kin directly</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Recipient Section */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Recipient Information
              </label>
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {nextOfKin?.name || patient?.emergency_contact_name || 'No emergency contact'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Next of Kin • {nextOfKin?.relationship || patient?.emergency_contact_relationship || 'Not specified'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">Phone Number</label>
                  <input
                    type="tel"
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all font-mono text-gray-800"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            </div>

            {/* Message Template */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Message Template
              </label>
              <div className="relative">
                <select className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all appearance-none cursor-pointer">
                  <option value="appointment">🗓️ Appointment Reminder</option>
                  <option value="results">📋 Test Results Available</option>
                  <option value="emergency">🚨 Emergency Contact</option>
                  <option value="followup">💊 Follow-up Required</option>
                  <option value="custom">✏️ Custom Message</option>
                </select>
                <ChevronRight className="absolute right-3 top-1/2 transform -translate-y-1/2 rotate-90 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Message Content */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Message Content
              </label>
              <div className="relative">
                <textarea
                  rows={4}
                  value={smsContent}
                  onChange={(e) => setSmsContent(e.target.value)}
                  className="w-full p-4 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all resize-none"
                  placeholder="Type your message here..."
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                  Character count: {smsContent.length}/1600
                </div>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg text-left hover:shadow-md transition-all"
              >
                <div className="text-sm font-medium text-emerald-800">Appointment Confirmed</div>
                <div className="text-xs text-emerald-600">Ready-to-send template</div>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg text-left hover:shadow-md transition-all"
              >
                <div className="text-sm font-medium text-orange-800">Lab Results Ready</div>
                <div className="text-xs text-orange-600">Ready-to-send template</div>
              </motion.button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsSmsModalOpen(false)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSendSms}
                disabled={isSendingSms || !smsContent.trim() || !smsPhone.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white rounded-xl shadow-lg hover:shadow-2xl transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingSms ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send SMS
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </FormModal>

      {/* Edit Patient Modal */}
      {patient && (
        <FormModal
          isOpen={isEditPatientModalOpen}
          onClose={() => setIsEditPatientModalOpen(false)}
          title="Edit Patient Information"
        >
          <EditPatientForm
            patientId={patient.id}
            initialData={{
              first_name: patient.first_name,
              last_name: patient.last_name,
              email: patient.email || '',
              cell_number: patient.cell_number || '',
              date_of_birth: patient.date_of_birth,
              gender: patient.gender,
              marital_status: patient.marital_status || '',
              occupation: patient.occupation || '',
              employer: patient.employer || '',
              home_language: patient.home_language || '',
              home_address: patient.home_address || '',
              postal_address: patient.postal_address || '',
              postal_code: patient.postal_code || ''
            }}
            onSuccess={async () => {
              setIsEditPatientModalOpen(false);
              // Refresh patient data
              const { data: updatedPatient } = await supabase
                .from('patients')
                .select('*')
                .eq('id', patient.id)
                .single();
              if (updatedPatient) setPatient(updatedPatient);
            }}
          />
        </FormModal>
      )}

      {/* Medical Aid Modal */}
      <FormModal
        isOpen={isMedicalAidModalOpen}
        onClose={() => setIsMedicalAidModalOpen(false)}
        title="Update Medical Aid Details"
      >
        <MedicalAidForm
          patientId={id || ''}
          initialData={medicalAid ? {
            provider: medicalAid.provider,
            scheme: medicalAid.scheme,
            membership_number: medicalAid.membership_number,
            main_member_name: medicalAid.main_member_name,
            main_member_id_number: medicalAid.main_member_id_number,
            relationship_to_main: medicalAid.relationship_to_main
          } : undefined}
          onSuccess={async () => {
            setIsMedicalAidModalOpen(false);
            // Refresh medical aid data
            const { data: updatedMedicalAid } = await supabase
              .from('medical_aid_details')
              .select('*')
              .eq('patient_id', id || '')
              .maybeSingle();
            
            if (updatedMedicalAid) {
              setMedicalAid(updatedMedicalAid);
            }
          }}
        />
      </FormModal>

      {/* Send Message Modal */}
      <SendMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        patient={patient ? {
          id: patient.id,
          first_name: patient.first_name,
          last_name: patient.last_name,
          cell_number: patient.cell_number || ''
        } : null}
      />
      
      {/* Vitals Modal */}
      <FormModal
        isOpen={isVitalsModalOpen}
        onClose={() => setIsVitalsModalOpen(false)}
        title="Record Vitals"
      >
        <VitalsForm
          visitId={visits[0]?.id} // Link to most recent visit
          onSuccess={() => {
            setIsVitalsModalOpen(false);
            fetchData();
          }}
        />
      </FormModal>

      {/* Lab Request Modal */}
      <FormModal
        isOpen={isLabRequestModalOpen}
        onClose={() => setIsLabRequestModalOpen(false)}
        title="Request Laboratory Test"
      >
        <AddLabRequestForm
          patientId={id || ''}
          visitId={visits[0]?.id} // Link to most recent visit
          onSuccess={() => {
            setIsLabRequestModalOpen(false);
            fetchData();
          }}
        />
      </FormModal>

      {/* Media Request Modal */}
      <FormModal
        isOpen={isMediaRequestModalOpen}
        onClose={() => setIsMediaRequestModalOpen(false)}
        title="Request Medical Imaging"
      >
        <AddMediaRequestForm
          patientId={id || ''}
          visitId={visits[0]?.id} // Link to most recent visit
          onSuccess={() => {
            setIsMediaRequestModalOpen(false);
            fetchData();
          }}
        />
      </FormModal>
      </div>
    </div>
  );
};

export default PatientModernDetail;
