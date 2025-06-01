import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Heart,
  Activity,
  Brain,
  Stethoscope,
  Plus,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Edit3,
  ImageIcon,
  Microscope,
  ChevronRight,
  Clock,
  Calendar,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import AddVisitForm from '../components/forms/AddVisitForm';
import EditVisitForm from '../components/forms/EditVisitForm';
import VisitModal from '../components/visits/VisitModal';
import MedicalAidForm from '../components/forms/MedicalAidForm';
import { defaultSMSService } from '../services/smsPortal';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
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
  const [showHealthSummary, setShowHealthSummary] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isVisitDetailModalOpen, setIsVisitDetailModalOpen] = useState(false);
  const [isEditVisitModalOpen, setIsEditVisitModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isMedicalAidModalOpen, setIsMedicalAidModalOpen] = useState(false);
  const [smsContent, setSmsContent] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!id || !UUID_REGEX.test(id)) {
          throw new Error('Invalid patient ID format. Please use a valid UUID.');
        }
        
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', id)
          .single();

        if (patientError) throw patientError;
        if (!patientData) throw new Error('Patient not found');
        
        setPatient(patientData);

        const { data: visitsData, error: visitsError } = await supabase
          .from('visit_details_view')
          .select('*')
          .eq('patient_id', id)
          .order('visit_date', { ascending: false });

        if (visitsError) throw visitsError;
        setVisits(visitsData || []);

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

        // Fetch Medical Aid Details
        const { data: medicalAidData, error: medicalAidError } = await supabase
          .from('medical_aid_details')
          .select('*')
          .eq('patient_id', id)
          .maybeSingle();

        if (medicalAidError && medicalAidError.code !== 'PGRST116') {
          console.error('Error fetching medical aid:', medicalAidError);
        } else {
          setMedicalAid(medicalAidData);
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

    if (id) {
      fetchData();
    }
  }, [id, navigate]);

  const calculateAge = (dateOfBirth: string) => {
    return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
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
          <div className="relative bg-white/95 backdrop-blur-xl shadow-2xl border border-gray-200/50 overflow-hidden">
            {/* Premium glass morphism background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/20 to-gray-100/10"></div>
            
            {/* Soft rounded corners for the bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50/50 to-transparent rounded-t-[2rem]"></div>
            
            <div className="relative p-6">
              {/* Compact header with back button */}
              <div className="absolute top-4 left-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/patients')}
                  className="p-2 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/50 hover:border-[#01b9d5]/50 shadow-sm hover:shadow-md transition-all duration-300 group"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600 group-hover:text-[#01b9d5] transition-colors" />
                </motion.button>
              </div>
            
            {patient && (
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                {/* Enhanced Avatar Section */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                  <div className="relative h-20 w-20 rounded-3xl overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                    <img 
                      src="https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200"
                      alt={`${patient.first_name} ${patient.last_name}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-3 border-white rounded-full shadow-lg animate-pulse"></div>
                  <div className="absolute -top-1 -left-1 w-5 h-5 bg-[#01b9d5] border-2 border-white rounded-full shadow-md"></div>
                </div>
                
                {/* Enhanced Patient Info */}
                <div className="flex-1">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
                    <div>
                      <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
                        {patient.first_name} {patient.last_name}
                      </h1>
                      <p className="text-xs text-gray-500 font-medium">Patient ID: {patient.id.slice(0, 8)}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowHealthSummary(true)}
                        className="px-3 py-1.5 bg-white/80 hover:bg-white border border-gray-200/50 text-gray-700 hover:text-[#01b9d5] rounded-lg flex items-center gap-2 hover:shadow-lg transition-all duration-300 text-xs font-medium"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        AI Summary
                      </motion.button>
                      
                    </div>
                  </div>
                  
                  {/* Premium Contact Pills */}
                  <div className="flex flex-wrap items-center gap-2 text-sm mt-3">
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-full border border-cyan-100/50 shadow-sm"
                    >
                      <Phone className="w-3 h-3 text-[#01b9d5]" />
                      <span className="text-gray-700 text-xs font-medium">{patient.cell_number}</span>
                    </motion.div>
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-50 to-green-50 rounded-full border border-emerald-100/50 shadow-sm"
                    >
                      <Mail className="w-3 h-3 text-emerald-500" />
                      <span className="text-gray-700 text-xs font-medium truncate max-w-[180px]">{patient.email}</span>
                    </motion.div>
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-50 to-pink-50 rounded-full border border-purple-100/50 shadow-sm"
                    >
                      <User className="w-3 h-3 text-purple-500" />
                      <span className="text-gray-700 text-xs font-medium">{calculateAge(patient.date_of_birth)} yrs • {patient.gender}</span>
                    </motion.div>
                  </div>
                  
                  {/* 🌟 ULTRA-PREMIUM VITALS DISPLAY - One Row WOW Factor */}
                  <div className="mt-6 relative group/vitals">
                    {/* Magical floating background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5 rounded-2xl blur-xl opacity-0 group-hover/vitals:opacity-100 transition-opacity duration-700"></div>
                    
                    <div className="relative p-5 bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl overflow-hidden">
                      {/* Animated header with pulse effect */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-lg blur-md opacity-60 animate-pulse"></div>
                          <div className="relative p-2 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-lg shadow-lg">
                            <Activity className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Latest Vitals</h3>
                          {latestVitals && (
                            <p className="text-xs text-gray-500 font-medium">
                              {format(new Date(latestVitals.created_at), 'MMM d, yyyy')} • Live Monitoring
                            </p>
                          )}
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-emerald-600 font-semibold">ACTIVE</span>
                        </div>
                      </div>
                      
                      {latestVitals ? (
                        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
                          {/* Blood Pressure - Heart Theme */}
                          {latestVitals.blood_pressure && (
                            <motion.div 
                              whileHover={{ scale: 1.05, y: -2 }}
                              className="flex-shrink-0 relative group/bp"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-pink-500/20 rounded-xl blur-lg opacity-0 group-hover/bp:opacity-100 transition-opacity duration-300"></div>
                              <div className="relative p-3 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200/50 shadow-lg min-w-[120px]">
                                <div className="flex items-center gap-2 mb-1">
                                  <Heart className="w-3 h-3 text-red-500 animate-pulse" />
                                  <span className="text-xs font-semibold text-red-700">BP</span>
                                </div>
                                <p className="text-lg font-bold text-red-800">{latestVitals.blood_pressure}</p>
                                <div className="absolute top-2 right-2 w-1 h-1 bg-red-400 rounded-full animate-ping"></div>
                              </div>
                            </motion.div>
                          )}
                          
                          {/* Heart Rate - Pulse Theme */}
                          {latestVitals.pulse_rate && (
                            <motion.div 
                              whileHover={{ scale: 1.05, y: -2 }}
                              className="flex-shrink-0 relative group/hr"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-amber-500/20 rounded-xl blur-lg opacity-0 group-hover/hr:opacity-100 transition-opacity duration-300"></div>
                              <div className="relative p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200/50 shadow-lg min-w-[120px]">
                                <div className="flex items-center gap-2 mb-1">
                                  <Activity className="w-3 h-3 text-orange-500" />
                                  <span className="text-xs font-semibold text-orange-700">PULSE</span>
                                </div>
                                <p className="text-lg font-bold text-orange-800">{latestVitals.pulse_rate}</p>
                                <p className="text-xs text-orange-600">bpm</p>
                              </div>
                            </motion.div>
                          )}
                          
                          {/* Temperature - Fire Theme */}
                          {latestVitals.temperature && (
                            <motion.div 
                              whileHover={{ scale: 1.05, y: -2 }}
                              className="flex-shrink-0 relative group/temp"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-indigo-500/20 rounded-xl blur-lg opacity-0 group-hover/temp:opacity-100 transition-opacity duration-300"></div>
                              <div className="relative p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200/50 shadow-lg min-w-[120px]">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"></div>
                                  <span className="text-xs font-semibold text-purple-700">TEMP</span>
                                </div>
                                <p className="text-lg font-bold text-purple-800">{latestVitals.temperature}°C</p>
                                <div className="absolute bottom-1 right-2 w-1 h-4 bg-gradient-to-t from-purple-400 to-transparent rounded-full"></div>
                              </div>
                            </motion.div>
                          )}
                          
                          {/* Weight - Scale Theme */}
                          {latestVitals.weight && (
                            <motion.div 
                              whileHover={{ scale: 1.05, y: -2 }}
                              className="flex-shrink-0 relative group/weight"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-green-500/20 rounded-xl blur-lg opacity-0 group-hover/weight:opacity-100 transition-opacity duration-300"></div>
                              <div className="relative p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200/50 shadow-lg min-w-[120px]">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-green-500 rounded"></div>
                                  <span className="text-xs font-semibold text-emerald-700">WEIGHT</span>
                                </div>
                                <p className="text-lg font-bold text-emerald-800">{latestVitals.weight} kg</p>
                              </div>
                            </motion.div>
                          )}
                          
                          {/* BMI - Target Theme */}
                          {latestVitals.bmi && (
                            <motion.div 
                              whileHover={{ scale: 1.05, y: -2 }}
                              className="flex-shrink-0 relative group/bmi"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-cyan-500/20 rounded-xl blur-lg opacity-0 group-hover/bmi:opacity-100 transition-opacity duration-300"></div>
                              <div className="relative p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200/50 shadow-lg min-w-[120px]">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full border-2 border-white shadow-sm"></div>
                                  <span className="text-xs font-semibold text-blue-700">BMI</span>
                                </div>
                                <p className="text-lg font-bold text-blue-800">{latestVitals.bmi}</p>
                                <div className="absolute top-2 right-2">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full opacity-60"></div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center justify-center py-8 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300"
                        >
                          <div className="text-center">
                            <div className="w-12 h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl flex items-center justify-center mx-auto mb-3">
                              <Activity className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-sm font-semibold text-gray-600">No vitals recorded yet</p>
                            <p className="text-xs text-gray-500">Patient vitals will appear here</p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 🌟 ULTRA-3D View Profile Button with Real Bulges - positioned at top right */}
                <div className="absolute top-4 right-4">
                  <motion.button
                    whileHover={{ 
                      scale: 1.08, 
                      y: -4, 
                      rotateX: 8,
                      transition: { type: "spring", damping: 15 }
                    }}
                    whileTap={{ 
                      scale: 0.92, 
                      y: 0, 
                      rotateX: 2,
                      transition: { duration: 0.1 }
                    }}
                    onClick={() => setIsProfileModalOpen(true)}
                    className="relative px-8 py-4 text-white rounded-2xl flex items-center gap-3 font-bold text-sm overflow-hidden group transform-gpu"
                    style={{
                      background: 'linear-gradient(145deg, #01b9d4, #0197b0, #016b7a)',
                      boxShadow: `
                        0 12px 24px -8px rgba(1, 185, 212, 0.6),
                        0 6px 16px -4px rgba(1, 185, 212, 0.4),
                        inset 0 3px 0 rgba(255,255,255,0.4),
                        inset 0 -3px 0 rgba(0,0,0,0.2),
                        inset 2px 0 0 rgba(255,255,255,0.1),
                        inset -2px 0 0 rgba(0,0,0,0.1)
                      `,
                      transform: 'perspective(1200px) rotateX(8deg) rotateY(-2deg)',
                      filter: 'drop-shadow(0 8px 16px rgba(1, 185, 212, 0.3))'
                    }}
                  >
                    {/* Multi-layered glow background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d4] via-[#0197b0] to-[#016b7a] rounded-2xl"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/20 rounded-2xl"></div>
                    
                    {/* Left bulge highlight */}
                    <div className="absolute left-1 top-1 bottom-1 w-2 bg-gradient-to-b from-white/40 via-white/20 to-transparent rounded-l-2xl"></div>
                    
                    {/* Right bulge shadow */}
                    <div className="absolute right-1 top-1 bottom-1 w-2 bg-gradient-to-b from-transparent via-black/10 to-black/20 rounded-r-2xl"></div>
                    
                    {/* Top bulge highlight */}
                    <div className="absolute top-1 left-1 right-1 h-2 bg-gradient-to-r from-white/30 via-white/40 to-white/30 rounded-t-2xl"></div>
                    
                    {/* Bottom bulge shadow */}
                    <div className="absolute bottom-1 left-1 right-1 h-2 bg-gradient-to-r from-black/20 via-black/30 to-black/20 rounded-b-2xl"></div>
                    
                    {/* Premium shine sweep effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] group-hover:duration-1000 rounded-2xl"></div>
                    
                    {/* Micro texture overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl opacity-60"></div>
                    
                    {/* Button content with enhanced positioning */}
                    <div className="relative z-20 flex items-center gap-3">
                      <div className="relative">
                        <User className="w-5 h-5 drop-shadow-md" />
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-sm"></div>
                      </div>
                      <span className="drop-shadow-md tracking-wide">View Profile</span>
                    </div>
                    
                    {/* Floating particles effect */}
                    <div className="absolute top-2 right-3 w-1 h-1 bg-white/60 rounded-full animate-pulse"></div>
                    <div className="absolute bottom-3 left-3 w-0.5 h-0.5 bg-white/40 rounded-full animate-ping"></div>
                    
                    {/* Press state indicator */}
                    <div className="absolute inset-0 bg-black/10 rounded-2xl opacity-0 group-active:opacity-100 transition-opacity duration-75"></div>
                  </motion.button>
                </div>
              </div>
            )}
          </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
          {/* Premium Medical Aid Card */}
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
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
              
              {/* Floating orbs background */}
              <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-[#01b9d4]/10 to-purple-500/10 rounded-full blur-2xl opacity-60"></div>
              <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-xl opacity-40"></div>
              
              <div className="relative p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-[#01b9d4] to-purple-600 rounded-xl shadow-lg">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Medical Aid</h3>
                      <p className="text-xs text-gray-500 font-medium">Insurance Coverage</p>
                    </div>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsMedicalAidModalOpen(true)}
                    className="p-2.5 bg-gray-50 hover:bg-white rounded-xl border border-gray-200 hover:border-[#01b9d4]/50 transition-all duration-300 shadow-sm"
                  >
                    <Edit3 className="w-4 h-4 text-gray-600 hover:text-[#01b9d4] transition-colors" />
                  </motion.button>
                </div>
                
                <div className="space-y-5">
                  {/* Provider Info with glassmorphism */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-blue-500/5 rounded-xl"></div>
                    <div className="relative p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base font-bold text-gray-800 flex items-center gap-2">
                            {medicalAid?.provider || 'No Medical Aid'}
                            {medicalAid && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>}
                          </p>
                          <p className="text-xs font-medium bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                            {medicalAid?.scheme || 'No scheme'}
                          </p>
                        </div>
                        <div className="text-center">
                          <Badge variant={medicalAid ? "emerald" : "glass"} size="sm" className="shadow-md">
                            {medicalAid ? 'Active' : 'None'}
                          </Badge>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {medicalAid?.scheme || 'No scheme'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Membership Card */}
                  <div className="relative group/card">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 rounded-lg opacity-5 group-hover/card:opacity-10 transition-opacity"></div>
                    <div className="relative p-4 bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-lg border border-gray-200/50 shadow-inner">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-5 bg-gradient-to-r from-[#01b9d4] to-purple-600 rounded-sm flex items-center justify-center">
                          <div className="w-4 h-3 bg-white/20 rounded-xs"></div>
                        </div>
                        <p className="text-xs font-bold text-gray-600 tracking-wider">MEMBERSHIP CARD</p>
                      </div>
                      <p className="text-xs text-gray-500 mb-1 font-medium">Member ID</p>
                      <p className="font-mono text-base font-bold text-gray-800 tracking-wider">
                        {medicalAid?.membership_number || 'No membership'}
                      </p>
                      <div className="mt-3 flex justify-between text-xs text-gray-500">
                        <span>Valid From: 01/24</span>
                        <span>Expires: 12/24</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Main Member Info */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-xl border border-blue-200/50 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Main Member</p>
                        <p className="text-sm font-bold text-gray-800">
                          {medicalAid?.main_member_name || 'No main member'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                      <span>ID: {medicalAid?.main_member_id_number || 'N/A'}</span>
                      <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                      <span>Relationship: {medicalAid?.relationship_to_main || 'N/A'}</span>
                    </div>
                  </div>
                  
                  {/* Quick actions */}
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        // Create a modal for viewing benefits
                        const modal = document.createElement('div');
                        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';
                        modal.innerHTML = `
                          <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
                            <h3 class="text-xl font-bold text-gray-800 mb-4">Medical Aid Benefits</h3>
                            <div class="space-y-3">
                              <div class="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <p class="text-sm font-medium text-emerald-800">✓ Hospital Cover: 100%</p>
                              </div>
                              <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p class="text-sm font-medium text-blue-800">✓ Specialist Visits: 80%</p>
                              </div>
                              <div class="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <p class="text-sm font-medium text-purple-800">✓ Medication: R5,000/year</p>
                              </div>
                            </div>
                            <button onclick="this.closest('.fixed').remove()" class="mt-6 w-full px-4 py-2 bg-gradient-to-r from-[#01b9d4] to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all">Close</button>
                          </div>
                        `;
                        document.body.appendChild(modal);
                        modal.addEventListener('click', (e) => {
                          if (e.target === modal) modal.remove();
                        });
                      }}
                      className="flex-1 p-3 bg-gradient-to-r from-[#01b9d4] to-blue-600 text-white rounded-lg font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      View Benefits
                    </motion.button>
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

          {/* Premium Next of Kin Card */}
          <motion.div
            initial={{ opacity: 0, y: 20, rotateX: -5 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -2, scale: 1.01 }}
            className="relative group"
          >
            {/* Floating glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/20 via-pink-500/20 to-rose-600/20 rounded-xl blur-xl opacity-0 group-hover:opacity-70 transition-all duration-500 -z-10"></div>
            
            {/* Main card */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 overflow-hidden">
              {/* Animated gradient header */}
              <div className="h-2 bg-gradient-to-r from-red-500 via-pink-500 to-rose-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
              
              {/* Floating orbs background */}
              <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-red-400/10 to-pink-500/10 rounded-full blur-2xl opacity-60"></div>
              <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-rose-500/10 to-pink-500/10 rounded-full blur-xl opacity-40"></div>
              
              <div className="relative p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Next of Kin</h3>
                      <p className="text-xs text-gray-500 font-medium">Emergency Contact</p>
                    </div>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsNextOfKinModalOpen(true)}
                    className="p-2.5 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-red-500/10 hover:to-pink-500/10 rounded-xl border border-gray-200 hover:border-red-400/30 transition-all duration-300 shadow-sm"
                  >
                    <Edit3 className="w-4 h-4 text-gray-600 hover:text-red-500 transition-colors" />
                  </motion.button>
                </div>
                
                <div className="space-y-5">
                  {/* Contact Person with enhanced design */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-pink-500/5 to-rose-500/5 rounded-xl"></div>
                    <div className="relative p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <Heart className="w-7 h-7 text-white" />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-bold text-gray-900">
                            {nextOfKin?.name || patient?.emergency_contact_name || 'No emergency contact'}
                          </p>
                          <p className="text-sm font-medium text-gray-600 bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                            {nextOfKin?.relationship || patient?.emergency_contact_relationship || 'Not specified'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-600 font-medium">Available</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contact Details - Compact */}
                  <div className="space-y-2">
                    <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-blue-400" />
                        <p className="text-xs text-gray-600">
                          {nextOfKin?.phone || patient?.emergency_contact_phone || 'No phone number'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        <p className="text-xs text-gray-600">
                          {nextOfKin?.address || 'No address provided'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Emergency Actions */}
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={openSmsModal}
                      className="flex-1 p-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg font-medium text-xs shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      Quick Contact
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="p-2 bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors shadow-sm"
                    >
                      <Mail className="w-3 h-3 text-gray-300" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

          {/* Sophisticated Visit History */}
          <div className="lg:col-span-6 space-y-4 md:space-y-6">
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
                {/* Enhanced Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-[#01b9d5] to-indigo-600 rounded-2xl shadow-lg">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                        Medical Timeline
                      </h2>
                      <p className="text-sm text-gray-500 font-medium">
                        {visits.length} visits • Comprehensive care history
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="relative"
                    >
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search timeline..."
                        className="pl-10 pr-4 py-2.5 text-sm bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4] transition-all backdrop-blur-sm shadow-sm text-gray-700 placeholder:text-gray-400"
                      />
                    </motion.div>
                    
                    {/* New Visit Button */}
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsAddVisitModalOpen(true)}
                      className="px-4 py-2.5 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-xl flex items-center gap-2 shadow-lg hover:shadow-2xl hover:shadow-[#01b9d5]/30 transition-all duration-300 font-semibold text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      New Visit
                    </motion.button>
                  </div>
                </div>

                {/* 🚀 ULTRA-PREMIUM MEDICAL TIMELINE - WOW Factor */}
                <div className="relative">
                  {/* Revolutionary animated timeline spine */}
                  <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-[#01b9d5] via-purple-500 via-pink-500 to-indigo-600 rounded-full shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-transparent rounded-full animate-pulse"></div>
                  </div>

                  {visits.map((visit, index) => (
                    <motion.div
                      key={visit.id}
                      initial={{ opacity: 0, x: -50, rotateY: -15 }}
                      animate={{ opacity: 1, x: 0, rotateY: 0 }}
                      transition={{ delay: index * 0.15, type: "spring", damping: 20 }}
                      whileHover={{ 
                        y: -8, 
                        scale: 1.02,
                        rotateY: 2,
                        transition: { type: "spring", damping: 15 }
                      }}
                      className="relative group mb-8 last:mb-0 perspective-1000"
                    >
                      {/* Floating glow effect behind card */}
                      <div className={`absolute inset-0 ml-16 rounded-3xl blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 ${
                        visit.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                        visit.status === 'in-progress' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                        'bg-gradient-to-r from-gray-400 to-slate-500'
                      }`}></div>
                      
                      {/* Revolutionary 3D Timeline Node */}
                      <div className="absolute left-5 top-8 z-20">
                        <div className={`relative w-8 h-8 rounded-2xl shadow-2xl transform-gpu group-hover:scale-110 transition-transform duration-300 ${
                          visit.status === 'completed' ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600' :
                          visit.status === 'in-progress' ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 animate-pulse' :
                          'bg-gradient-to-br from-gray-400 via-slate-500 to-gray-600'
                        }`} style={{
                          boxShadow: visit.status === 'completed' 
                            ? '0 8px 32px -8px rgba(16, 185, 129, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)'
                            : visit.status === 'in-progress'
                            ? '0 8px 32px -8px rgba(245, 158, 11, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)'
                            : '0 8px 32px -8px rgba(107, 114, 128, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)'
                        }}>
                          <div className="absolute inset-1 rounded-xl bg-white/20"></div>
                          {visit.status === 'completed' && (
                            <CheckCircle2 className="absolute inset-0 m-auto w-4 h-4 text-white" />
                          )}
                          {visit.status === 'in-progress' && (
                            <Activity className="absolute inset-0 m-auto w-4 h-4 text-white animate-pulse" />
                          )}
                          {visit.status === 'scheduled' && (
                            <Clock className="absolute inset-0 m-auto w-4 h-4 text-white" />
                          )}
                        </div>
                        
                        {/* Ripple effect for active visits */}
                        {visit.status === 'in-progress' && (
                          <div className="absolute inset-0 w-8 h-8 rounded-2xl bg-orange-400/30 animate-ping"></div>
                        )}
                      </div>

                      {/* Premium glass-morphism visit card */}
                      <motion.div 
                        className={`relative ml-20 p-8 backdrop-blur-xl rounded-3xl border-2 cursor-pointer transition-all duration-500 group-hover:shadow-2xl overflow-hidden ${
                          visit.status === 'completed' ? 'bg-gradient-to-br from-emerald-50/90 to-green-50/90 border-emerald-200/50 hover:border-emerald-300' :
                          visit.status === 'in-progress' ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/90 border-amber-200/50 hover:border-orange-300' :
                          'bg-gradient-to-br from-gray-50/90 to-slate-50/90 border-gray-200/50 hover:border-gray-300'
                        }`}
                        onClick={() => handleVisitClick(visit.id)}
                        whileHover={{ 
                          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                        }}
                      >
                        {/* Shine effect overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] group-hover:duration-1000"></div>
                        
                        {/* Floating particles background */}
                        <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl opacity-60"></div>
                        <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-lg opacity-40"></div>
                        {/* Card header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-bold text-gray-800">
                                {visit.visit_type}
                              </h3>
                              <Badge 
                                variant={getStatusColor(visit.status)} 
                                size="md"
                                className="shadow-sm"
                              >
                                {visit.status}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="font-medium text-gray-600">{format(new Date(visit.visit_date), 'MMM d, yyyy')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <span className="font-medium text-gray-600">{visit.visit_time}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-500" />
                                <span className="font-medium text-gray-600">Dr. {visit.doctor_name}</span>
                              </div>
                            </div>
                          </div>
                          
                          <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            className="p-2 bg-white/70 rounded-xl shadow-sm group-hover:bg-white transition-colors"
                          >
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#01b9d5] transition-colors" />
                          </motion.div>
                        </div>
                        
                        {/* Chief complaint with enhanced styling */}
                        {visit.chief_complaint && (
                          <div className="mb-4 p-4 bg-gray-50/80 backdrop-blur-sm rounded-xl border border-gray-100">
                            <p className="text-sm text-gray-700">
                              <span className="font-semibold text-gray-800">Chief Complaint: </span>
                              {visit.chief_complaint}
                            </p>
                          </div>
                        )}
                        
                        {/* Enhanced attachments section */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <motion.div 
                              whileHover={{ scale: 1.05 }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-purple-100 rounded-full text-xs font-medium text-purple-700 shadow-sm border border-purple-200"
                            >
                              <Microscope className="w-3.5 h-3.5 text-purple-600" />
                              <span>2 Lab Results</span>
                            </motion.div>
                            <motion.div 
                              whileHover={{ scale: 1.05 }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 rounded-full text-xs font-medium text-blue-700 shadow-sm border border-blue-200"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                              <span>3 Images</span>
                            </motion.div>
                            {visit.diagnosis && (
                              <motion.div 
                                whileHover={{ scale: 1.05 }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-full text-xs font-medium text-emerald-700 shadow-sm border border-emerald-200"
                              >
                                <Stethoscope className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Clinical Notes</span>
                              </motion.div>
                            )}
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex gap-2">
                            {visit.status === 'in-progress' && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVisitStatusChange(visit.id, 'completed', visit.appointment_id);
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all text-sm font-semibold flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Complete
                              </motion.button>
                            )}
                            {visit.status === 'scheduled' && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVisitStatusChange(visit.id, 'in-progress', visit.appointment_id);
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all text-sm font-semibold flex items-center gap-2"
                              >
                                <Activity className="w-4 h-4" />
                                Start Visit
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  ))}
                  
                  {visits.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", damping: 20 }}
                      className="text-center py-20"
                    >
                      <div className="relative mx-auto mb-6">
                        <div className="w-32 h-32 bg-gradient-to-br from-[#01b9d5]/10 via-purple-500/10 to-indigo-600/10 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-xl border border-gray-200/50">
                          <div className="w-20 h-20 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <Activity className="w-10 h-10 text-white animate-pulse" />
                          </div>
                        </div>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full animate-ping"></div>
                        <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full animate-pulse"></div>
                      </div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-3">No visits recorded yet</h3>
                      <p className="text-gray-500 mb-6 max-w-md mx-auto">This patient's comprehensive medical timeline will appear here as visits are recorded</p>
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsAddVisitModalOpen(true)}
                        className="px-6 py-3 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center gap-2 mx-auto"
                      >
                        <Plus className="w-5 h-5" />
                        Record First Visit
                      </motion.button>
                    </motion.div>
                  )}
                </div>
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
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
              
              {/* Main content */}
              <div className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-[#01b9d4] to-purple-600 rounded-xl shadow-lg">
                      <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Appointments Today</h3>
                      <p className="text-xs text-gray-400 font-medium">Live Queue Management</p>
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
                    <p className="text-2xl font-bold text-emerald-600">8</p>
                  </motion.div>
                  
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="p-3 bg-gradient-to-br from-amber-500/10 to-yellow-600/10 rounded-xl border border-amber-500/20 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium text-amber-700">In Queue</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-600">3</p>
                  </motion.div>
                </div>
                
                {/* Live Queue */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-800">Next Patients</h4>
                    <span className="text-xs text-gray-500">Updated now</span>
                  </div>
                  
                  {/* Queue Items */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative group/queue"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-lg opacity-0 group-hover/queue:opacity-100 transition-opacity"></div>
                    <div className="relative p-3 bg-white/90 rounded-lg border border-blue-200/50 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                          1
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800">Maria Rodriguez</p>
                          <p className="text-xs text-gray-600">Follow-up • 2:30 PM</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-600 font-medium">Ready</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative group/queue"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-lg opacity-0 group-hover/queue:opacity-100 transition-opacity"></div>
                    <div className="relative p-3 bg-white/90 rounded-lg border border-amber-200/50 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                          2
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800">James Wilson</p>
                          <p className="text-xs text-gray-600">Consultation • 3:00 PM</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-amber-600 font-medium">Waiting</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative group/queue"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-500/5 to-slate-500/5 rounded-lg opacity-0 group-hover/queue:opacity-100 transition-opacity"></div>
                    <div className="relative p-3 bg-white/90 rounded-lg border border-gray-200/50 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-slate-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                          3
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800">Sarah Johnson</p>
                          <p className="text-xs text-gray-600">Check-up • 3:30 PM</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-xs text-gray-500 font-medium">Scheduled</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
                
                {/* Quick Actions */}
                <div className="space-y-2">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full p-3 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    Start Next Visit
                  </motion.button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="p-2.5 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2 text-xs font-medium text-gray-600"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Schedule
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="p-2.5 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2 text-xs font-medium text-gray-600"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Records
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
        isOpen={showHealthSummary}
        onClose={() => setShowHealthSummary(false)}
        title="Health Summary"
      >
        <div className="bg-gradient-to-r from-[#a855f7] to-[#00B4D8] p-6 rounded-xl text-white">
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Patient Overview</h3>
              <p className="text-white/90">
                {patient?.first_name} {patient?.last_name} is a {calculateAge(patient?.date_of_birth || '')} year old patient with a history of regular check-ups.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Recent Activity</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <CheckCircle2 size={16} className="mr-2" />
                    Last visit: {format(new Date(), 'MMM d, yyyy')}
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={16} className="mr-2" />
                    Vitals: Normal range
                  </li>
                </ul>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <ArrowRight size={16} className="mr-2" />
                    Schedule follow-up in 3 months
                  </li>
                  <li className="flex items-center">
                    <ArrowRight size={16} className="mr-2" />
                    Continue current treatment plan
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
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
              <h3 className="text-lg font-semibold text-gray-800">Personal Information</h3>
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
            const { data } = await supabase
              .from('medical_aid_details')
              .select('*')
              .eq('patient_id', id)
              .maybeSingle();
            if (data) setMedicalAid(data);
          }}
        />
      </FormModal>
      </div>
    </div>
  );
};

export default PatientModernDetail;
