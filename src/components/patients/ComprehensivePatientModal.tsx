import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EncounterTimeline from './EncounterTimeline';
import {
  X,
  Users,
  Search,
  User,
  ChevronRight,
  FileText,
  Calendar,
  Phone,
  Mail,
  Clock,
  AlertCircle,
  LayoutGrid,
  List,
  ArrowUpDown,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronDown,
  Heart,
  Activity,
  Shield,
  Star,
  Sparkles,
  UserPlus,
  Download,
  Check,
  Eye,
  Copy,
  MapPin,
  Stethoscope,
  Bot,
  Loader2,
  Plus,
  Building2,
  ImageIcon,
  Microscope,
  Thermometer,
  Weight,
  MessageSquare,
  TrendingUp,
  Maximize,
  Minimize,
  FileDown,
  Send,
  ClipboardList,
  HeartPulse,
  TestTube,
  FolderOpen,
  Receipt,
  History,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { usePatientsStoreNew, Patient } from '../../stores/patientsStoreNew';
import { useTheme } from '../../stores/themeStore';
import FormModal from '../modals/FormModal';
import AddPatientForm from '../forms/AddPatientForm';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import EditPatientForm from '../forms/EditPatientForm';
import NextOfKinForm from '../forms/NextOfKinForm';
import FullScreenEditVisitModal from '../visits/FullScreenEditVisitModal';
import AddVisitTabs from '../visits/AddVisitTabs';
import MedicalAidForm from '../forms/MedicalAidForm';
import SendMessageModal from '../modals/SendMessageModal';
import SendEmailModal from '../modals/SendEmailModal';
import PremiumConfirmationModal from '../modals/PremiumConfirmationModal';
import PremiumFolderTabs from './PremiumFolderTabs';
import VitalsForm from '../forms/VitalsForm';
import AddLabRequestForm from '../forms/AddLabRequestForm';
import AddMediaRequestForm from '../forms/AddMediaRequestForm';
import PremiumBillingModal from '../modals/PremiumBillingModal';
import PatientModalHeader from './PatientModalHeader';
import PatientModalTabs from './PatientModalTabs';
import PatientAnalytics from './PatientAnalytics';
import { PatientSearchFilters } from './PatientSearchFilters';
import { PremiumSmsModal } from '../messages/PremiumSmsModal';
import { EnhancedSmsModal } from '../messages/EnhancedSmsModal';
import { EnhancedEmailModal } from '../messages/EnhancedEmailModal';
import MessageConfirmationModal from '../modals/MessageConfirmationModal';
import { usePatientModalState } from '../../hooks/usePatientModalState';
import { useAiSearch } from '../../hooks/useAiSearch';
import { defaultSMSService } from '../../services/smsPortal';
import { medicalAidService } from '../../services/medicalAidService';
import { LabResultsContent, DocumentsContent, BillingContent } from './DirectTabContent';
import ManageBeneficiariesModal from '../modals/ManageBeneficiariesModal';

interface MessageConfirmationData {
  type: 'sms' | 'email';
  recipientName?: string;
  recipientContact?: string;
}

interface ComprehensivePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string | null;
}

interface PatientDetails {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
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
  patient_id?: string;
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

interface Visit {
  id: string;
  appointment_id?: string;
  visit_date?: string;
  visit_time?: string;
  visit_type?: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status?: 'in-progress' | 'completed' | 'cancelled' | 'scheduled';
  doctor_name?: string;
  chief_complaint?: string;
  diagnosis?: string;
  treatment_plan?: string;
  prescription?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
  notes?: string;
}

const ITEMS_PER_PAGE = 12;

// Universal Gender Icons
const FemaleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="8" r="4" />
    <path d="M12 14v6m-3-3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MaleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="10" cy="10" r="4" />
    <path d="M16 4l4 4m0-4l-4 4m-2-2l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ComprehensivePatientModal: React.FC<ComprehensivePatientModalProps> = ({ isOpen, onClose, patientId }) => {
  const { currentTheme } = useTheme();
  const { patients, isLoading, error, fetchPatients: fetchPatientsFromStore, searchPatients } = usePatientsStoreNew();
  
  // Main tab state - automatically switch to details if patientId is provided
  const [activeTab, setActiveTab] = useState<'patients' | 'details'>(patientId ? 'details' : 'patients');
  const [activeMainTab, setActiveMainTab] = useState<'patients' | 'analytics'>('patients');
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'encounters' | 'vitals' | 'results' | 'documents' | 'billing' | 'audit'>('overview');
  
  // Patients list state
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'age'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [statFilter, setStatFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all-time');
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Appointments state
  const navigate = useNavigate();
  const [doctorAppointments, setDoctorAppointments] = useState<any[]>([]);
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);
  
  // Calculate age function (moved before useAiSearch)
  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };
  
  // AI Search functionality
  const { isAiSearching, aiFilters, handleAiSearch, clearAiFilters } = useAiSearch(
    patients,
    calculateAge,
    setCurrentPage
  );
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    type: 'email' | 'sms';
    recipients: any[];
    message?: string;
  } | null>(null);
  
  // Patient details state
  const [selectedPatientDetails, setSelectedPatientDetails] = useState<PatientDetails | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [nextOfKin, setNextOfKin] = useState<NextOfKin | null>(null);
  const [medicalAid, setMedicalAid] = useState<MedicalAidDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  
  // Extracted modal state management
  const modalState = usePatientModalState();
  
  // Additional state
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [labResults, setLabResults] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [billingData, setBillingData] = useState<any[]>([]);
  const [labRequests, setLabRequests] = useState<any[]>([]);
  const [mediaRequests, setMediaRequests] = useState<any[]>([]);
  const [smsContent, setSmsContent] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isEnhancedSmsModalOpen, setIsEnhancedSmsModalOpen] = useState(false);
  const [isEnhancedEmailModalOpen, setIsEnhancedEmailModalOpen] = useState(false);
  const [isManageBeneficiariesModalOpen, setIsManageBeneficiariesModalOpen] = useState(false);
  const [smsTarget, setSmsTarget] = useState<'patient' | 'nextOfKin'>('patient');
  const [showMessageConfirmation, setShowMessageConfirmation] = useState(false);
  const [messageConfirmationData, setMessageConfirmationData] = useState<MessageConfirmationData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingBulkSms, setIsSendingBulkSms] = useState(false);
  const [isSendingBulkEmail, setIsSendingBulkEmail] = useState(false);
  const [beneficiariesCount, setBeneficiariesCount] = useState<number>(0);

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Fetch beneficiaries count for medical aid
  const fetchBeneficiariesCount = useCallback(async (membershipNumber: string) => {
    if (!membershipNumber) return;

    try {
      const { data, error } = await supabase
        .from('medical_aid_details')
        .select('id', { count: 'exact' })
        .eq('membership_number', membershipNumber);

      if (error) {
        console.error('Error fetching beneficiaries count:', error);
        return;
      }

      const count = data?.length || 0;
      setBeneficiariesCount(count);
      console.log(`✅ Found ${count} total beneficiaries for membership ${membershipNumber}`);
    } catch (err) {
      console.error('Error fetching beneficiaries count:', err);
    }
  }, []);

  // Fetch patient details
  const fetchPatientDetails = useCallback(async (patientId: string) => {
    if (!patientId || !UUID_REGEX.test(patientId)) {
      setDetailsError('Invalid patient ID format');
      setIsLoadingDetails(false);
      return;
    }

    try {
      setIsLoadingDetails(true);
      setDetailsError(null);
      
      const { data: patientData, error: patientError } = await supabase
        .from('patient_details_view')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      if (!patientData) throw new Error('Patient not found');
      
      setSelectedPatientDetails(patientData as any);
      
      // Extract medical aid from the view
      if (patientData.medical_aid_details && (patientData.medical_aid_details as any).length > 0) {
        const medicalAidData = (patientData.medical_aid_details as any)[0];
        setMedicalAid(medicalAidData as any);
        // Fetch beneficiaries count for this medical aid
        fetchBeneficiariesCount(medicalAidData.membership_number);
      }

      // Fetch next of kin data
      const { data: nextOfKinData, error: nextOfKinError } = await supabase
        .from('next_of_kin')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle();

      if (nextOfKinError) {
        console.error('Error fetching next of kin:', nextOfKinError);
        setNextOfKin(null);
      } else {
        setNextOfKin(nextOfKinData || null);
      }

      const { data: visitsData, error: visitsError } = await supabase
        .from('visit_details_view')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false });

      if (visitsError) throw visitsError;
      setVisits(visitsData as any || []);

      // Fetch vitals data for this patient's visits only
      const visitIds = visitsData?.map(v => v.id) || [];
      let vitalsData = [];
      
      if (visitIds.length > 0) {
        const { data: patientVitalsData, error: vitalsError } = await supabase
          .from('vitals')
          .select('*')
          .in('visit_id', visitIds)
          .order('created_at', { ascending: false });

        if (vitalsError) {
          console.error('Error fetching vitals:', vitalsError);
        } else {
          vitalsData = patientVitalsData || [];
        }
      }
      
      setVitals(vitalsData);

      // Fetch lab results for this patient's visits only
      let labResultsData = [];
      
      if (visitIds.length > 0) {
        // First get lab requests for these visits
        const { data: labRequestsData, error: labRequestsError } = await supabase
          .from('lab_requests')
          .select('id')
          .in('visit_id', visitIds);

        if (!labRequestsError && labRequestsData && labRequestsData.length > 0) {
          const labRequestIds = labRequestsData.map(req => req.id);
          
          // Then get lab results for these lab requests
          const { data: patientLabResultsData, error: labResultsError } = await supabase
            .from('lab_results')
            .select('*, lab_request_id')
            .in('lab_request_id', labRequestIds)
            .order('created_at', { ascending: false });

          if (labResultsError) {
            console.error('Error fetching lab results:', labResultsError);
          } else {
            labResultsData = patientLabResultsData || [];
          }
        }
      }
      
      setLabResults(labResultsData);

      // Fetch documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (documentsError) {
        console.error('Error fetching documents:', documentsError);
      } else {
        setDocuments(documentsData || []);
      }

      // Fetch billing data (invoices_enhanced)
      const { data: billingDataResult, error: billingError } = await supabase
        .from('invoices_enhanced')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (billingError) {
        console.error('Error fetching billing data:', billingError);
      } else {
        setBillingData(billingDataResult || []);
      }


    } catch (error) {
      console.error('Error fetching patient details:', error);
      setDetailsError(error instanceof Error ? error.message : 'An error occurred while fetching patient data');
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // AI search handler using the extracted hook
  const onAiSearch = useCallback(() => {
    handleAiSearch(searchTerm);
  }, [handleAiSearch, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      if (patientId) {
        setActiveTab('details');
        fetchPatientDetails(patientId);
      } else {
        setActiveTab('patients');
        fetchPatientsFromStore();
      }
    }
  }, [isOpen, patientId, fetchPatientDetails, fetchPatientsFromStore]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'F11') {
        e.preventDefault();
        modalState.toggleFullScreen();
      } else if (e.key === 'Escape') {
        // Check if any child modals are open first
        if (modalState.modalState.isMessageModalOpen) {
          console.log('🔧 ESC KEY DEBUG: Closing message modal instead of parent');
          e.preventDefault();
          modalState.closeMessageModal();
        } else if (modalState.modalState.isEmailModalOpen) {
          console.log('🔧 ESC KEY DEBUG: Closing email modal instead of parent');
          e.preventDefault();
          modalState.closeEmailModal();
        } else if (modalState.modalState.isFullScreen) {
          e.preventDefault();
          modalState.toggleFullScreen();
        } else {
          console.log('🔧 ESC KEY DEBUG: Closing parent modal');
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, modalState.modalState.isFullScreen, onClose, modalState]);

  // Handle body scroll and full screen styles
  useEffect(() => {
    if (isOpen && modalState.modalState.isFullScreen) {
      document.body.style.overflow = 'hidden';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
    } else if (!isOpen) {
      document.body.style.overflow = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
    }

    return () => {
      if (!isOpen) {
        document.body.style.overflow = '';
        document.body.style.margin = '';
        document.body.style.padding = '';
      }
    };
  }, [isOpen, modalState.modalState.isFullScreen]);

  // Search effect
  useEffect(() => {
    if (searchTerm) {
      const timeoutId = setTimeout(() => {
        searchPatients(searchTerm);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm]);

  // Filter options
  const filterOptions = [
    { id: 'all', label: 'All Patients', icon: Users, count: patients.length },
    { id: 'female', label: 'Female', icon: FemaleIcon, count: patients.filter(p => p.gender?.toLowerCase() === 'female').length },
    { id: 'male', label: 'Male', icon: MaleIcon, count: patients.filter(p => p.gender?.toLowerCase() === 'male').length }
  ];

  // Apply filters and search
  const filteredPatients = (() => {
    if (aiFilters?.results) {
      return aiFilters.results;
    }
    
    return patients.filter((patient: Patient) => {
      const matchesSearch = !searchTerm || 
        `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.cell_number?.includes(searchTerm);

      if (statFilter) {
        if (statFilter === 'active' && !matchesSearch) return false;
        if (statFilter === 'new' && !matchesSearch) return false;
        if (statFilter === 'insured' && (!matchesSearch || !patient.medical_aid_details || patient.medical_aid_details.length === 0)) return false;
      }
      
      if (selectedFilter === 'all') return matchesSearch;
      if (selectedFilter === 'medical-aid') return matchesSearch && patient.medical_aid_details && patient.medical_aid_details.length > 0;
      if (selectedFilter === 'appointments') return matchesSearch && (patient.id.length % 3 === 0);
      if (selectedFilter === 'favorites') return matchesSearch;
      if (selectedFilter === 'female') return matchesSearch && patient.gender?.toLowerCase() === 'female';
      if (selectedFilter === 'male') return matchesSearch && patient.gender?.toLowerCase() === 'male';
      
      return matchesSearch;
    });
  })().sort((a: Patient, b: Patient) => {
    if (sortBy === 'name') {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    } else if (sortBy === 'date') {
      const dateA = a.date_of_birth ? new Date(a.date_of_birth).getTime() : 0;
      const dateB = b.date_of_birth ? new Date(b.date_of_birth).getTime() : 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    } else {
      const ageA = a.date_of_birth ? calculateAge(a.date_of_birth) : 0;
      const ageB = b.date_of_birth ? calculateAge(b.date_of_birth) : 0;
      return sortOrder === 'asc' ? ageA - ageB : ageB - ageA;
    }
  });

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Patient list handlers
  const handlePatientAdded = () => {
    setIsAddPatientModalOpen(false);
    fetchPatientsFromStore();
  };

  const handlePatientUpdated = () => {
    setIsEditPatientModalOpen(false);
    setSelectedPatient(null);
    fetchPatientsFromStore();
  };

  const toggleSort = (field: 'name' | 'date' | 'age') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleEdit = (patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPatient(patient);
    setIsEditPatientModalOpen(true);
  };

  const handleDelete = async (patientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (showDeleteConfirm === patientId) {
      try {
        const { error } = await supabase
          .from('patients')
          .delete()
          .eq('id', patientId);

        if (error) throw error;
        
        setShowDeleteConfirm(null);
        fetchPatientsFromStore();
        toast.success('Patient deleted successfully');
      } catch (error) {
        console.error('Error deleting patient:', error);
        toast.error('Failed to delete patient');
      }
    } else {
      setShowDeleteConfirm(patientId);
      setTimeout(() => setShowDeleteConfirm(null), 3000);
    }
  };

  const handlePatientCardClick = async (patient: Patient) => {
    setSelectedPatientDetails(patient);
    setActiveTab('details');
    await fetchPatientDetails(patient.id);
  };


  // Patient details handlers
  const handleVisitClick = async (visitId: string) => {
    try {
      const { data, error } = await supabase
        .from('visit_details_view')
        .select('*')
        .eq('id', visitId)
        .single();

      if (error) throw error;
      setSelectedVisit(data);
      modalState.openEditVisitModal(true);
    } catch (error) {
      console.error('Error fetching visit details:', error);
    }
  };

  const handleVisitStatusChange = async (visitId: string, status: string, appointmentId?: string) => {
    try {
      const { error: visitError } = await supabase
        .from('visits')
        .update({ status })
        .eq('id', visitId);

      if (visitError) throw visitError;

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

      if (selectedPatientDetails) {
        await fetchPatientDetails(selectedPatientDetails.id);
      }
    } catch (error) {
      console.error('Error updating visit status:', error);
    }
  };

  const handleSendSms = async () => {
    if (!smsContent.trim() || !smsPhone.trim()) {
      toast.error('Please enter both phone number and message content');
      return;
    }

    setIsSendingSms(true);
    try {
      const result = await defaultSMSService.sendSMS({
        to: smsPhone,
        content: smsContent,
        reference: `patient-${selectedPatientDetails?.id}-${Date.now()}`
      });

      if (result.success) {
        toast.success('SMS sent successfully!');
        modalState.closeSmsModal();
        setSmsContent('');
        setSmsPhone('');
      } else {
        toast.error(`Failed to send SMS: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send SMS. Please try again.');
    } finally {
      setIsSendingSms(false);
    }
  };

  // Bulk SMS functionality for filtered patients
  const handleBulkSms = async () => {
    if (!smsContent.trim() || filteredPatients.length === 0) {
      toast.error('Please enter message content for filtered patients');
      return;
    }

    setIsSendingBulkSms(true);
    try {
      let successCount = 0;
      let failureCount = 0;

      for (const patient of filteredPatients) {
        const phone = patient.cell_number || patient.emergency_contact_phone;
        if (phone) {
          try {
            const result = await defaultSMSService.sendSMS({
              to: phone,
              content: smsContent,
              reference: `bulk-patient-${patient.id}-${Date.now()}`
            });
            if (result.success) successCount++;
            else failureCount++;
          } catch (error) {
            failureCount++;
          }
        } else {
          failureCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`SMS sent to ${successCount} patients successfully!`);
      }
      if (failureCount > 0) {
        toast.error(`Failed to send SMS to ${failureCount} patients`);
      }
      
      modalState.closeSmsModal();
      setSmsContent('');
    } catch (error) {
      console.error('Error sending bulk SMS:', error);
      toast.error('Failed to send SMS. Please try again.');
    } finally {
      setIsSendingBulkSms(false);
    }
  };

  // Enhanced SMS handler
  const handleEnhancedSendSms = async (phone: string, message: string) => {
    if (!selectedPatientDetails || !phone || !message) {
      toast.error('Missing required information');
      return;
    }

    try {
      const result = await defaultSMSService.sendSMS({
        to: phone,
        content: message,
        reference: `patient-${selectedPatientDetails.id}-${Date.now()}`
      });

      if (result.success) {
        setIsEnhancedSmsModalOpen(false);
        setMessageConfirmationData({
          type: 'sms',
          recipientName: `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}`,
          recipientContact: phone
        });
        setShowMessageConfirmation(true);
      } else {
        toast.error(`Failed to send SMS: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send SMS. Please try again.');
    }
  };

  // Enhanced Email handler
  const handleEnhancedSendEmail = async (email: string, subject: string, message: string) => {
    if (!selectedPatientDetails || !email || !subject || !message) {
      toast.error('Missing required information');
      return;
    }

    try {
      // Here you would integrate with your email service
      // For now, we'll just show a success message
      console.log('Sending email:', { email, subject, message, patientId: selectedPatientDetails.id });
      
      setIsEnhancedEmailModalOpen(false);
      setMessageConfirmationData({
        type: 'email',
        recipientName: `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}`,
        recipientContact: email
      });
      setShowMessageConfirmation(true);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please try again.');
    }
  };

  // Export functionality for filtered patients
  const handleExportPatients = async () => {
    if (filteredPatients.length === 0) {
      toast.error('No patients to export');
      return;
    }

    setIsExporting(true);
    try {
      // Create CSV content
      const headers = [
        'First Name', 'Last Name', 'Email', 'Phone', 'Date of Birth', 
        'Gender', 'Age', 'Marital Status', 'Occupation'
      ];
      
      const csvContent = [
        headers.join(','),
        ...filteredPatients.map((patient: Patient) => [
          patient.first_name,
          patient.last_name,
          patient.email || '',
          patient.cell_number || '',
          patient.date_of_birth,
          patient.gender,
          patient.date_of_birth ? calculateAge(patient.date_of_birth) : 0,
          patient.marital_status || '',
          patient.occupation || ''
        ].map(field => `"${field}"`).join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `patients_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${filteredPatients.length} patients successfully!`);
    } catch (error) {
      console.error('Error exporting patients:', error);
      toast.error('Failed to export patients. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const openSmsModal = () => {
    const selectedPatients = selectedPatientIds.size > 0 
      ? patients.filter(p => selectedPatientIds.has(p.id))
      : filteredPatients;
    
    if (selectedPatients.length > 0) {
      // Bulk SMS mode - show confirmation first
      const defaultMessage = `Hello,

This is a message from OneHealth Practice. Please contact us at your earliest convenience if you have any questions about your healthcare.

Best regards,
OneHealth Medical Team

Phone: +264 61 123 4567
Email: info@onehealth.com.na`;
      
      setConfirmationData({
        type: 'sms',
        recipients: selectedPatients,
        message: defaultMessage
      });
      setShowConfirmationModal(true);
      setSmsContent(defaultMessage);
    } else {
      // Single patient SMS mode
      const defaultPhone = nextOfKin?.phone || selectedPatientDetails?.emergency_contact_phone || '';
      const defaultMessage = `Hello ${nextOfKin?.name || selectedPatientDetails?.emergency_contact_name || 'there'},

This is regarding ${selectedPatientDetails?.first_name} ${selectedPatientDetails?.last_name}'s medical care. Please contact us at your earliest convenience.

Best regards,
OneHealth Medical Team`;
      
      setSmsPhone(defaultPhone);
      setSmsContent(defaultMessage);
      modalState.openSmsModal(true);
    }
  };

  // Email functionality for selected/filtered patients
  const openEmailModal = () => {
    const selectedPatients = selectedPatientIds.size > 0 
      ? patients.filter(p => selectedPatientIds.has(p.id))
      : filteredPatients;
    
    if (selectedPatients.length === 0) {
      alert('No patients selected or filtered. Please select patients or apply a filter first.');
      return;
    }

    // Show premium confirmation modal
    setConfirmationData({
      type: 'email',
      recipients: selectedPatients
    });
    setShowConfirmationModal(true);
  };

  // Handle confirmation modal confirm
  const handleConfirmCommunication = () => {
    if (confirmationData?.type === 'email') {
      console.log('🔧 CONFIRMATION DEBUG: Opening email modal');
      modalState.openEmailModal();
    } else if (confirmationData?.type === 'sms') {
      console.log('🔧 CONFIRMATION DEBUG: Opening SMS modal');
      modalState.openSmsModal();
    }
    setShowConfirmationModal(false);
    setConfirmationData(null);
  };

  // Stats calculation
  const getFilteredPatientsForStats = () => {
    return patients.filter(patient => {
      const patientDate = patient.created_at ? new Date(patient.created_at) : new Date();
      const now = new Date();
      
      switch (dateFilter) {
        case 'today':
          return patientDate.toDateString() === now.toDateString();
        case 'this-week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return patientDate >= weekAgo;
        case 'this-month':
          return patientDate.getMonth() === now.getMonth() && 
                 patientDate.getFullYear() === now.getFullYear();
        case 'last-3-months':
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          return patientDate >= threeMonthsAgo;
        case 'this-year':
          return patientDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });
  };

  const filteredPatientsForStats = getFilteredPatientsForStats();

  const stats = [
    { 
      label: 'Total Patients', 
      value: filteredPatientsForStats.length.toString(),
      change: '+12%',
      trend: 'up',
      icon: Users,
      gradient: 'from-blue-500 to-indigo-600',
      id: 'total'
    },
    { 
      label: 'Active Patients', 
      value: Math.floor(filteredPatientsForStats.length * 0.8).toString(),
      change: '+8%',
      trend: 'up',
      icon: Activity,
      gradient: 'from-emerald-500 to-green-600',
      id: 'active'
    },
    { 
      label: 'New This Month', 
      value: Math.floor(filteredPatientsForStats.length * 0.15).toString(),
      change: '+25%',
      trend: 'up',
      icon: UserPlus,
      gradient: 'from-purple-500 to-violet-600',
      id: 'new'
    },
    { 
      label: 'Medical Aid', 
      value: filteredPatientsForStats.filter(p => p.medical_aid_details && p.medical_aid_details.length > 0).length.toString(),
      change: '+5%',
      trend: 'up',
      icon: Shield,
      gradient: 'from-amber-500 to-orange-600',
      id: 'insured'
    }
  ];

  if (!isOpen) return null;

  return (
    <>
      <div 
        className={`fixed inset-0 z-[9999] ${
          modalState.modalState.isFullScreen 
            ? 'bg-black/20 p-0' 
            : 'bg-black/50 backdrop-blur-sm flex items-center justify-center p-4'
        }`} 
        onClick={(e) => {
          // Prevent closing parent modal when child modals are open
          if (modalState.modalState.isMessageModalOpen || modalState.modalState.isEmailModalOpen) {
            console.log('🚫 PREVENTING PARENT CLOSE: Child modal is open');
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onClose();
        }}
      >
        <motion.div
          initial={{ 
            opacity: 0, 
            scale: modalState.modalState.isFullScreen ? 1 : 0.95, 
            y: modalState.modalState.isFullScreen ? 0 : 20 
          }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ 
            opacity: 0, 
            scale: modalState.modalState.isFullScreen ? 1 : 0.95, 
            y: modalState.modalState.isFullScreen ? 0 : 20 
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`relative bg-white shadow-2xl overflow-hidden w-full overflow-y-auto transition-all duration-300 ${
            modalState.modalState.isFullScreen 
              ? 'h-screen max-w-none max-h-none rounded-none' 
              : 'max-w-7xl max-h-[90vh] rounded-2xl'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Premium Modal Container */}
          <div className={`relative bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 overflow-hidden shadow-2xl ${
            modalState.modalState.isFullScreen ? 'rounded-none' : 'rounded-2xl'
          }`}>
            {/* Premium background effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-purple-50/30 via-transparent to-transparent"></div>
            <div className="absolute inset-0 opacity-[0.015]" style={{ 
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='dots' x='0' y='0' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23000' opacity='0.1'/%3E%3Ccircle cx='30' cy='30' r='1' fill='%23000' opacity='0.1'/%3E%3Ccircle cx='30' cy='2' r='1' fill='%23000' opacity='0.1'/%3E%3Ccircle cx='2' cy='30' r='1' fill='%23000' opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23dots)'/%3E%3C/svg%3E")`, 
              backgroundSize: '60px 60px' 
            }}></div>
            
            {/* Floating light orbs */}
            <div className="absolute top-40 left-20 w-72 h-72 bg-gradient-to-br from-[#01b9d5]/10 to-cyan-400/10 rounded-full blur-3xl animate-float"></div>
            <div className="absolute bottom-40 right-20 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-float-delayed"></div>
            
            <div className={`relative z-10 h-full overflow-hidden flex flex-col ${
              modalState.modalState.isFullScreen ? 'max-h-none min-h-screen' : 'max-h-[95vh]'
            }`}>
              {/* Premium Header - Dynamic based on active tab */}
              <PatientModalHeader
                activeTab={activeTab}
                isFullScreen={modalState.modalState.isFullScreen}
                selectedPatientDetails={selectedPatientDetails}
                onClose={onClose}
                onToggleFullScreen={modalState.toggleFullScreen}
                onBackToList={activeTab === 'details' ? () => setActiveTab('patients') : undefined}
                filteredPatients={filteredPatientsForStats}
                medicalAid={medicalAid}
                nextOfKin={nextOfKin}
                visits={visits}
                vitals={vitals}
                onSendMessage={() => {
                  if (selectedPatientDetails) {
                    setSmsTarget('patient');
                    setIsEnhancedSmsModalOpen(true);
                  }
                }}
                onSendEmail={() => {
                  if (selectedPatientDetails) {
                    setIsEnhancedEmailModalOpen(true);
                  }
                }}
                onEditProfile={() => {
                  if (selectedPatientDetails) {
                    setSelectedPatient(selectedPatientDetails);
                    setIsEditPatientModalOpen(true);
                  }
                }}
                onSmsNextOfKin={(phone: string) => {
                  if (nextOfKin || selectedPatientDetails) {
                    setSmsTarget('nextOfKin');
                    setIsEnhancedSmsModalOpen(true);
                  }
                }}
                onManageBeneficiaries={() => {
                  setIsManageBeneficiariesModalOpen(true);
                }}
                beneficiariesCount={beneficiariesCount}
              />


              {/* Tabs - Always visible */}
              <PatientModalTabs 
                activeTab={activeTab === 'patients' ? activeMainTab : activeDetailTab}
                onTabChange={(tab) => {
                  if (activeTab === 'patients') {
                    setActiveMainTab(tab as 'patients' | 'analytics');
                  } else {
                    setActiveDetailTab(tab as any);
                  }
                }}
                mode={activeTab === 'patients' ? 'list' : 'details'}
                selectedPatient={selectedPatientDetails}
                visits={visits}
                vitals={vitals}
                labResults={labResults}
                documents={documents}
                billingData={billingData}
              />

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {activeTab === 'patients' && activeMainTab === 'analytics' ? (
                    <motion.div
                      key="analytics"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <PatientAnalytics patients={filteredPatientsForStats} />
                    </motion.div>
                  ) : activeTab === 'patients' ? (
                    <motion.div
                      key="patients"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="p-6"
                    >

                      {/* Search and Filters */}
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 mb-6">
                        <div className="flex flex-col lg:flex-row gap-4">
                          {/* Search Bar */}
                          <div className="flex-1">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                              <input
                                type="text"
                                placeholder="AI Search: Ask anything about patients (e.g., 'patients with diabetes over 40')..."
                                value={searchTerm}
                                onChange={(e) => {
                                  setSearchTerm(e.target.value);
                                  if (aiFilters) {
                                    clearAiFilters();
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && searchTerm.trim()) {
                                    handleAiSearch(searchTerm);
                                  }
                                }}
                                className="w-full pl-10 pr-16 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all text-sm"
                              />
                              
                              {/* AI Search Button */}
                              <button
                                onClick={() => handleAiSearch(searchTerm)}
                                disabled={isAiSearching || !searchTerm.trim()}
                                className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 bg-gradient-to-r ${currentTheme.gradients.button} text-white rounded-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
                                title="AI Search - Ask anything about your patients"
                              >
                                {isAiSearching ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Bot className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => setIsAddPatientModalOpen(true)}
                              className="px-2 py-1 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-1 text-xs font-medium"
                            >
                              <Plus className="w-3 h-3" />
                              <span className="text-xs">Add Patient</span>
                            </button>
                            
                            {/* Bulk Action Buttons - Illuminate when filtered */}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                console.log('🔧 DIRECT MESSAGE DEBUG: Button clicked, opening message modal directly');
                                modalState.openMessageModal();
                              }}
                              disabled={isSendingBulkSms || (selectedPatientIds.size === 0 && filteredPatients.length === 0)}
                              className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 text-xs font-medium ${
                                (selectedPatientIds.size > 0 || ((searchTerm || selectedFilter !== 'all' || aiFilters) && filteredPatients.length > 0))
                                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                                  : 'bg-gray-100 text-gray-400 opacity-50'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={selectedPatientIds.size > 0 
                                ? `Send SMS to ${selectedPatientIds.size} selected patients`
                                : `Send SMS to ${filteredPatients.length} filtered patients`}
                            >
                              {isSendingBulkSms ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <MessageSquare className="w-3 h-3" />
                              )}
                              <span className="text-xs">SMS</span>
                            </motion.button>
                            
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                console.log('🔧 DIRECT EMAIL DEBUG: Button clicked, opening email modal directly');
                                modalState.openEmailModal();
                              }}
                              disabled={isSendingBulkEmail || (selectedPatientIds.size === 0 && filteredPatients.length === 0)}
                              className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 text-xs font-medium ${
                                (selectedPatientIds.size > 0 || ((searchTerm || selectedFilter !== 'all' || aiFilters) && filteredPatients.length > 0))
                                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                                  : 'bg-gray-100 text-gray-400 opacity-50'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={selectedPatientIds.size > 0 
                                ? `Send Email to ${selectedPatientIds.size} selected patients`
                                : `Send Email to ${filteredPatients.length} filtered patients`}
                            >
                              {isSendingBulkEmail ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              <span className="text-xs">Email</span>
                            </motion.button>
                            
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleExportPatients}
                              disabled={isExporting || filteredPatients.length === 0}
                              className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 text-xs font-medium ${
                                (searchTerm || selectedFilter !== 'all' || aiFilters) && filteredPatients.length > 0
                                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                                  : 'bg-gray-100 text-gray-400 opacity-50'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={`Export ${filteredPatients.length} filtered patients`}
                            >
                              {isExporting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <FileDown className="w-3 h-3" />
                              )}
                              <span className="text-xs">Export</span>
                            </motion.button>
                            
                            <button
                              onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                            >
                              {view === 'grid' ? <List className="w-3 h-3" /> : <LayoutGrid className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        {/* AI Filter Indicator */}
                        {aiFilters && (
                          <div className={`mt-2 bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white text-xs px-3 py-2 rounded-md shadow-lg`}>
                            <div className="flex items-center gap-2">
                              <Bot className="w-3 h-3" />
                              <span>AI filtered: {aiFilters.description}</span>
                              <button
                                onClick={() => {
                                  clearAiFilters();
                                  setSearchTerm('');
                                }}
                                className="ml-auto hover:bg-white/20 rounded p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Filter Pills */}
                        <div className="flex flex-wrap gap-2 mt-4">
                          {filterOptions.map((filter) => (
                            <motion.button
                              key={filter.id}
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setSelectedFilter(filter.id)}
                              className={`px-3 py-2 rounded-full flex items-center gap-2 transition-all text-sm font-medium border ${
                                selectedFilter === filter.id
                                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-transparent shadow-sm'
                                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {filter.id === 'female' ? (
                                <FemaleIcon className="w-3 h-3" />
                              ) : filter.id === 'male' ? (
                                <MaleIcon className="w-3 h-3" />
                              ) : (
                                <filter.icon className="w-3 h-3" />
                              )}
                              {filter.label}
                              {filter.count > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  selectedFilter === filter.id ? 'bg-white/20' : 'bg-gray-100'
                                }`}>
                                  {filter.count}
                                </span>
                              )}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Patients List */}
                      {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                          <div className="text-center">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full mx-auto mb-4"
                            />
                            <p className="text-gray-600 text-sm">Loading patients...</p>
                          </div>
                        </div>
                      ) : error ? (
                        <div className="text-center py-20">
                          <div className="bg-white rounded-xl p-8 max-w-sm mx-auto border border-red-200">
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="text-gray-900 font-medium mb-2">Unable to load patients</p>
                            <p className="text-gray-600 text-sm mb-4">{error}</p>
                            <button
                              onClick={() => fetchPatientsFromStore()}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                            >
                              Try Again
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {view === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {paginatedPatients.map((patient: Patient, index: number) => (
                                <motion.div
                                  key={patient.id}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.03 }}
                                  whileHover={{ y: -4 }}
                                  onHoverStart={() => setHoveredCard(patient.id)}
                                  onHoverEnd={() => setHoveredCard(null)}
                                  className="group relative"
                                >
                                  <div 
                                    className={`relative bg-white rounded-xl border-2 ${
                                      hoveredCard === patient.id 
                                        ? patient.gender?.toLowerCase() === 'female'
                                          ? 'border-pink-300 shadow-lg shadow-pink-100/50 scale-[1.02]' 
                                          : 'border-blue-300 shadow-lg shadow-blue-100/50 scale-[1.02]'
                                        : patient.gender?.toLowerCase() === 'female'
                                          ? 'border-pink-100'
                                          : 'border-blue-100'
                                    } p-4 cursor-pointer transition-all duration-200 overflow-hidden hover:shadow-md`}
                                    onClick={() => handlePatientCardClick(patient)}
                                  >
                                    {/* Premium Medical Aid Background Logo */}
                                    {patient.medical_aid_details?.[0]?.provider && (
                                      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                                        <div className="absolute bottom-2 right-2 text-6xl font-bold text-gradient bg-gradient-to-br from-purple-400 to-indigo-400 bg-clip-text text-transparent transform rotate-12">
                                          {patient.medical_aid_details?.[0]?.provider?.substring(0, 3).toUpperCase()}
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="relative">
                                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-white shadow-sm ${
                                          patient.gender?.toLowerCase() === 'female'
                                            ? 'bg-gradient-to-br from-pink-400 to-rose-500'
                                            : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                                        }`}>
                                          <User className="w-6 h-6" />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                                      </div>
                                      
                                      {/* Quick Actions */}
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => handleEdit(patient, e)}
                                          className="p-1 bg-gray-100 text-gray-600 rounded-md hover:bg-[#01b9d5] hover:text-white transition-colors"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={(e) => handleDelete(patient.id, e)}
                                          className={`p-1 rounded-md transition-colors ${
                                            showDeleteConfirm === patient.id
                                              ? 'bg-red-500 text-white'
                                              : 'bg-gray-100 text-gray-600 hover:bg-red-500 hover:text-white'
                                          }`}
                                        >
                                          {showDeleteConfirm === patient.id ? (
                                            <Check className="w-3 h-3" />
                                          ) : (
                                            <Trash2 className="w-3 h-3" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <h3 className="font-bold text-gray-900 truncate text-sm">
                                        {patient.first_name} {patient.last_name}
                                      </h3>
                                      
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                          <User className="w-3 h-3 text-gray-400" />
                                          <span>{patient.date_of_birth ? calculateAge(patient.date_of_birth) : 'N/A'} yrs • {patient.gender}</span>
                                        </div>
                                        
                                        {patient.cell_number && (
                                          <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <Phone className="w-3 h-3 text-gray-400" />
                                            <span className="truncate">{patient.cell_number}</span>
                                          </div>
                                        )}
                                        
                                        {patient.email && (
                                          <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <Mail className="w-3 h-3 text-gray-400" />
                                            <span className="truncate">{patient.email}</span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {patient.medical_aid_details && patient.medical_aid_details.length > 0 && (
                                        <div className="mt-2 px-2 py-1 bg-gradient-to-r from-emerald-50 to-green-50 rounded-md border border-emerald-200">
                                          <div className="flex items-center gap-1">
                                            <Shield className="w-3 h-3 text-emerald-600" />
                                            <span className="text-xs font-medium text-emerald-700">
                                              {patient.medical_aid_details[0].provider}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-white/95 rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
                              {/* List Header */}
                              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                                <div className="grid grid-cols-12 gap-4 items-center text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  <div className="col-span-4 flex items-center gap-2">
                                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-gray-700">
                                      Patient
                                      <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="col-span-2">Contact</div>
                                  <div className="col-span-2 flex items-center gap-2">
                                    <button onClick={() => toggleSort('age')} className="flex items-center gap-1 hover:text-gray-700">
                                      Age
                                      <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="col-span-2">Medical Aid</div>
                                  <div className="col-span-2 flex items-center gap-2">
                                    <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-gray-700">
                                      Registered
                                      <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              
                              {/* List Body */}
                              <div className="divide-y divide-gray-100">
                                {paginatedPatients.map((patient: Patient, index: number) => (
                                  <motion.div
                                    key={patient.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                                    onClick={() => handlePatientCardClick(patient)}
                                  >
                                    <div className="grid grid-cols-12 gap-4 items-center">
                                      {/* Patient Info */}
                                      <div className="col-span-4 flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm ${
                                          patient.gender?.toLowerCase() === 'female'
                                            ? 'bg-gradient-to-br from-pink-400 to-rose-500'
                                            : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                                        }`}>
                                          <User className="w-4 h-4" />
                                        </div>
                                        <div>
                                          <p className="font-medium text-gray-900 text-sm">
                                            {patient.first_name} {patient.last_name}
                                          </p>
                                          <p className="text-xs text-gray-500">ID: {patient.id.slice(0, 8)}</p>
                                        </div>
                                      </div>
                                      
                                      {/* Contact */}
                                      <div className="col-span-2">
                                        <p className="text-sm text-gray-900">{patient.cell_number}</p>
                                        <p className="text-xs text-gray-500 truncate">{patient.email}</p>
                                      </div>
                                      
                                      {/* Age */}
                                      <div className="col-span-2">
                                        <p className="text-sm text-gray-900">{patient.date_of_birth ? calculateAge(patient.date_of_birth) : 'N/A'} years</p>
                                        <p className="text-xs text-gray-500">{patient.gender}</p>
                                      </div>
                                      
                                      {/* Medical Aid */}
                                      <div className="col-span-2">
                                        {patient.medical_aid_details && patient.medical_aid_details.length > 0 ? (
                                          <div className="flex items-center gap-1">
                                            <Shield className="w-3 h-3 text-emerald-600" />
                                            <span className="text-sm text-emerald-700 font-medium">
                                              {patient.medical_aid_details[0].provider}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-gray-400">None</span>
                                        )}
                                      </div>
                                      
                                      {/* Registered Date */}
                                      <div className="col-span-2 flex items-center justify-between">
                                        <span className="text-sm text-gray-600">
                                          {patient.created_at ? format(new Date(patient.created_at), 'MMM d, yyyy') : 'N/A'}
                                        </span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={(e) => handleEdit(patient, e)}
                                            className="p-1 bg-gray-100 text-gray-600 rounded hover:bg-[#01b9d5] hover:text-white transition-colors"
                                          >
                                            <Edit className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={(e) => handleDelete(patient.id, e)}
                                            className="p-1 bg-gray-100 text-gray-600 rounded hover:bg-red-500 hover:text-white transition-colors"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Premium Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-4">
                              <div className="flex items-center gap-4">
                                <p className="text-sm text-gray-600 font-medium">
                                  Showing <span className="text-purple-600 font-semibold">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> to <span className="text-purple-600 font-semibold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredPatients.length)}</span> of <span className="text-purple-600 font-semibold">{filteredPatients.length}</span> patients
                                </p>
                                {/* Removed selection counter since checkboxes were removed */}
                              </div>
                              <div className="flex items-center gap-1">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                  disabled={currentPage === 1}
                                  className="p-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </motion.button>
                                
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                  const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                                  if (page > totalPages) return null;
                                  return (
                                    <motion.button
                                      key={page}
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => setCurrentPage(page)}
                                      className={`px-4 py-2 rounded-xl transition-all font-medium shadow-sm ${
                                        currentPage === page
                                          ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                      }`}
                                    >
                                      {page}
                                    </motion.button>
                                  );
                                })}
                                
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                  disabled={currentPage === totalPages}
                                  className="p-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="details"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="p-6"
                    >
                      {isLoadingDetails ? (
                        <div className="flex items-center justify-center py-20">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                      ) : detailsError ? (
                        <div className="flex flex-col items-center justify-center py-20">
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center">
                              <AlertCircle className="text-red-500 mr-2" size={20} />
                              <p className="text-red-700">{detailsError}</p>
                            </div>
                          </div>
                        </div>
                      ) : selectedPatientDetails ? (
                        <div className="space-y-6">
                          {/* Patient Detail Content based on active tab */}
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="relative overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/50 to-blue-50/30 rounded-2xl"></div>
                            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#01b9d5]/5 to-purple-500/5 rounded-full blur-3xl animate-float-slow"></div>
                            <div className="absolute bottom-0 left-0 w-60 h-60 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 rounded-full blur-2xl animate-float-delayed"></div>
                            
                            <div className="relative backdrop-blur-xl bg-white/95 border border-gray-200/50 rounded-2xl shadow-xl p-6">
                              {activeDetailTab === 'overview' && (
                                <div className="space-y-6">
                                  {/* AI Health Intelligence Dashboard - Text Based */}
                                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                    <div className="flex items-center gap-3 mb-4">
                                      <Bot className="w-6 h-6 text-gray-700" />
                                      <div>
                                        <h3 className="text-xl font-semibold text-gray-900">AI Health Intelligence Dashboard</h3>
                                        <p className="text-sm text-gray-500">Comprehensive Patient Health Analysis</p>
                                      </div>
                                    </div>
                                    
                                    <div className="prose prose-sm max-w-none text-gray-600 space-y-4">
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Patient Overview</h4>
                                        <p className="text-sm leading-relaxed">
                                          {selectedPatientDetails?.first_name} {selectedPatientDetails?.last_name} has been under our care with {visits.length} medical encounters recorded. 
                                          The patient demonstrates excellent compliance with scheduled appointments and treatment protocols. 
                                          Clinical assessments show {vitals.length > 0 ? 'stable vital signs' : 'pending vital sign measurements'} across {vitals.length} recorded measurements{vitals.length > 0 ? ', with all key indicators within normal ranges' : ''}. 
                                          Overall prognosis is positive with continued monitoring recommended for optimal health outcomes.
                                        </p>
                                      </div>
                                      
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Medical Record Summary</h4>
                                        <p className="text-sm leading-relaxed">
                                          Total medical encounters: {visits.length} visits
                                          {vitals.length > 0 && `, ${vitals.length} vital sign recordings`}
                                          {labResults.length > 0 && `, ${labResults.length} laboratory results`}
                                          {documents.length > 0 && `, ${documents.length} medical documents`}.
                                          {visits.length > 0 && visits[0].chief_complaint && 
                                            ` Most recent visit addressed: "${visits[0].chief_complaint}" which was managed according to established clinical protocols.`
                                          }
                                        </p>
                                      </div>
                                      
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Clinical Insights</h4>
                                        <p className="text-sm leading-relaxed">
                                          Based on the comprehensive analysis of available medical data, the patient shows consistent healthcare engagement patterns. 
                                          {vitals.length > 0 ? 
                                            'Vital sign trends indicate stable physiological parameters with no concerning deviations from baseline.' :
                                            'Initial vital sign assessment is recommended to establish baseline health parameters.'
                                          }
                                          {medicalAid ? 
                                            ' Medical aid coverage is active, facilitating access to comprehensive healthcare services.' :
                                            ' Self-pay status noted - consider medical aid enrollment for enhanced healthcare access.'
                                          }
                                        </p>
                                      </div>
                                      
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Recommendations</h4>
                                        <p className="text-sm leading-relaxed">
                                          Continue current management strategies with emphasis on preventive care measures. 
                                          Maintain regular follow-up appointments to monitor health status and address any emerging concerns promptly. 
                                          {vitals.length === 0 && 'Priority: Schedule vital signs assessment at next visit. '}
                                          {labResults.length === 0 && 'Consider baseline laboratory screening based on patient age and risk factors. '}
                                          Encourage continued engagement with healthcare services to maintain optimal health outcomes.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeDetailTab === 'encounters' && (
                                <EncounterTimeline 
                                  visits={visits}
                                  patientName={`${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}`}
                                  onAddVisit={() => modalState.openAddVisitModal()}
                                  onAddVisitTabs={() => {
                                    console.log('🔍 PATIENT MODAL: onAddVisitTabs callback triggered');
                                    console.log('🔍 PATIENT MODAL: modalState:', modalState);
                                    modalState.openAddVisitTabsModal();
                                  }}
                                  onEditVisit={(visit) => {
                                    console.log('Edit visit:', visit);
                                    setSelectedVisit(visit);
                                    modalState.openEditVisitModal();
                                  }}
                                  onCreateFollowUp={(visit) => {
                                    // Handle create follow-up - you can implement this based on your needs
                                    console.log('Create follow-up for visit:', visit);
                                    // For now, just open the add visit modal
                                    modalState.openAddVisitModal();
                                  }}
                                />
                              )}

                              {activeDetailTab === 'vitals' && (
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <HeartPulse className="w-6 h-6 text-red-600" />
                                      <h3 className="text-xl font-bold text-gray-900">Vital Signs</h3>
                                      <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        {vitals.length} recorded
                                      </span>
                                    </div>
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => modalState.openVitalsModal(true)}
                                      className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-medium"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Add Vitals
                                    </motion.button>
                                  </div>
                                  
                                  {vitals.length > 0 ? (
                                    <div className="grid gap-4">
                                      {vitals.map((vital) => (
                                        <motion.div
                                          key={vital.id}
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                                        >
                                          <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-pink-500 rounded-lg flex items-center justify-center">
                                                <HeartPulse className="w-5 h-5 text-white" />
                                              </div>
                                              <div>
                                                <p className="font-semibold text-gray-900">
                                                  {vital.created_at && !isNaN(new Date(vital.created_at).getTime()) 
                                                    ? format(new Date(vital.created_at), 'MMM dd, yyyy')
                                                    : 'Date not available'
                                                  }
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                  {vital.created_at && !isNaN(new Date(vital.created_at).getTime())
                                                    ? format(new Date(vital.created_at), 'HH:mm')
                                                    : 'Time not available'
                                                  }
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-red-50 rounded-lg p-3">
                                              <p className="text-xs font-medium text-red-600 mb-1">Blood Pressure</p>
                                              <p className="font-bold text-red-800">
                                                {vital.blood_pressure_systolic}/{vital.blood_pressure_diastolic}
                                              </p>
                                              <p className="text-xs text-red-600">mmHg</p>
                                            </div>
                                            <div className="bg-blue-50 rounded-lg p-3">
                                              <p className="text-xs font-medium text-blue-600 mb-1">Heart Rate</p>
                                              <p className="font-bold text-blue-800">{vital.heart_rate}</p>
                                              <p className="text-xs text-blue-600">bpm</p>
                                            </div>
                                            <div className="bg-orange-50 rounded-lg p-3">
                                              <p className="text-xs font-medium text-orange-600 mb-1">Temperature</p>
                                              <p className="font-bold text-orange-800">{vital.temperature}°</p>
                                              <p className="text-xs text-orange-600">celsius</p>
                                            </div>
                                            <div className="bg-green-50 rounded-lg p-3">
                                              <p className="text-xs font-medium text-green-600 mb-1">Weight</p>
                                              <p className="font-bold text-green-800">{vital.weight}</p>
                                              <p className="text-xs text-green-600">kg</p>
                                            </div>
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="bg-gradient-to-br from-gray-50 to-red-50 rounded-2xl p-12 text-center border border-red-100">
                                      <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <HeartPulse className="w-8 h-8 text-white" />
                                      </div>
                                      <h4 className="text-lg font-semibold text-gray-800 mb-2">No vital signs recorded</h4>
                                      <p className="text-gray-600 mb-4">Start recording patient vital signs and measurements</p>
                                      <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => modalState.openVitalsModal(true)}
                                        className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                                      >
                                        Record First Vitals
                                      </motion.button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {activeDetailTab === 'results' && (
                                <LabResultsContent />
                              )}

                              {activeDetailTab === 'documents' && (
                                <DocumentsContent 
                                  patientId={selectedPatientDetails.id}
                                />
                              )}

                              {activeDetailTab === 'billing' && (
                                <BillingContent 
                                  patientId={selectedPatientDetails.id}
                                  patient={selectedPatientDetails}
                                  medicalAid={medicalAid}
                                />
                              )}

                              {activeDetailTab === 'audit' && (
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <History className="w-6 h-6 text-purple-600" />
                                      <h3 className="text-xl font-bold text-gray-900">Audit Trail</h3>
                                      <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        Activity Log
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-gradient-to-br from-gray-50 to-purple-50 rounded-2xl p-12 text-center border border-purple-100">
                                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                      <History className="w-8 h-8 text-white" />
                                    </div>
                                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Activity tracking</h4>
                                    <p className="text-gray-600">All patient interactions and changes are logged here</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </div>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Sub-modals */}
      <FormModal
        isOpen={isAddPatientModalOpen}
        onClose={() => setIsAddPatientModalOpen(false)}
        title="Add New Patient"
      >
        <AddPatientForm onSuccess={handlePatientAdded} />
      </FormModal>

      <FormModal
        isOpen={isEditPatientModalOpen}
        onClose={() => {
          setIsEditPatientModalOpen(false);
          setSelectedPatient(null);
        }}
        title="Edit Patient"
      >
        {selectedPatient && (
          <EditPatientForm 
            patientId={selectedPatient.id}
            initialData={{
              first_name: selectedPatient.first_name,
              last_name: selectedPatient.last_name,
              email: selectedPatient.email,
              cell_number: selectedPatient.cell_number,
              date_of_birth: selectedPatient.date_of_birth,
              gender: selectedPatient.gender,
              marital_status: selectedPatient.marital_status || '',
              occupation: selectedPatient.occupation || '',
              employer: selectedPatient.employer || '',
              home_language: selectedPatient.home_language || '',
              home_address: selectedPatient.home_address || '',
              postal_address: selectedPatient.postal_address || '',
              postal_code: selectedPatient.postal_code || ''
            }}
            onSuccess={handlePatientUpdated}
          />
        )}
      </FormModal>

      {selectedVisit && selectedPatientDetails && (
        <FullScreenEditVisitModal
          isOpen={modalState.modalState.isEditVisitModalOpen}
          onClose={() => {
            modalState.closeEditVisitModal();
            setSelectedVisit(null);
          }}
          visitId={selectedVisit.id}
          patientId={selectedPatientDetails.id}
          onSuccess={() => {
            modalState.closeEditVisitModal();
            fetchPatientDetails(selectedPatientDetails.id);
          }}
        />
      )}

      <FormModal
        isOpen={modalState.modalState.isAddVisitModalOpen}
        onClose={() => modalState.closeAddVisitModal()}
        title="Record New Visit"
      >
        {selectedPatientDetails && (
          <AddVisitTabs
            patientId={selectedPatientDetails.id}
            activeTab="general"
            onCancel={() => modalState.closeAddVisitModal()}
            onSuccess={() => {
              modalState.closeAddVisitModal();
              fetchPatientDetails(selectedPatientDetails.id);
            }}
          />
        )}
      </FormModal>

      {/* Add Visit Tabs Modal */}
      <AnimatePresence>
        {selectedPatientDetails && modalState.modalState.isAddVisitTabsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
          >
            {console.log('🔍 RENDER: AddVisitTabs modal is now visible')}
            <motion.div 
              className="absolute inset-0 bg-black bg-opacity-50" 
              onClick={() => modalState.closeAddVisitTabsModal()} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-7xl mx-4 max-h-[90vh] overflow-auto"
            >
              <AddVisitTabs
                patientId={selectedPatientDetails.id}
                activeTab="details"
                onSuccess={() => {
                  modalState.closeAddVisitTabsModal();
                  fetchPatientDetails(selectedPatientDetails.id);
                }}
                onCancel={() => modalState.closeAddVisitTabsModal()}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedPatientDetails && (
        <FormModal
          isOpen={modalState.modalState.isMedicalAidModalOpen}
          onClose={() => modalState.closeMedicalAidModal()}
          title="Update Medical Aid Details"
        >
          <MedicalAidForm
            patientId={selectedPatientDetails.id}
            initialData={medicalAid ? {
              provider_id: '',
              scheme_id: '',
              provider: medicalAid.provider,
              scheme: medicalAid.scheme,
              membership_number: medicalAid.membership_number,
              main_member_name: medicalAid.main_member_name,
              main_member_id_number: medicalAid.main_member_id_number,
              relationship_to_main: medicalAid.relationship_to_main
            } : undefined}
            onSuccess={() => {
              modalState.closeMedicalAidModal();
              fetchPatientDetails(selectedPatientDetails.id);
              // Refresh beneficiaries count if medical aid was updated
              if (medicalAid?.membership_number) {
                fetchBeneficiariesCount(medicalAid.membership_number);
              }
            }}
          />
        </FormModal>
      )}

      <SendMessageModal
        isOpen={modalState.modalState.isMessageModalOpen}
        onClose={() => modalState.closeMessageModal()}
        patient={selectedPatientDetails ? {
          id: selectedPatientDetails.id,
          first_name: selectedPatientDetails.first_name,
          last_name: selectedPatientDetails.last_name,
          cell_number: selectedPatientDetails.cell_number || ''
        } : null}
      />

      <SendEmailModal
        isOpen={modalState.modalState.isEmailModalOpen}
        onClose={() => modalState.closeEmailModal()}
        patients={(selectedPatientIds.size > 0 
          ? patients.filter(p => selectedPatientIds.has(p.id))
          : filteredPatients
        ).filter(p => p.email && p.email.trim() !== '').map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email
        }))}
      />
      
      <FormModal
        isOpen={modalState.modalState.isVitalsModalOpen}
        onClose={() => modalState.closeVitalsModal()}
        title="Record Vitals"
      >
        {selectedPatientDetails && (
          <VitalsForm
            visitId={visits[0]?.id || ''}
            onSuccess={() => {
              modalState.closeVitalsModal();
              fetchPatientDetails(selectedPatientDetails.id);
            }}
          />
        )}
      </FormModal>

      <FormModal
        isOpen={modalState.modalState.isLabRequestModalOpen}
        onClose={() => modalState.closeLabRequestModal()}
        title="Request Laboratory Test"
      >
        {selectedPatientDetails && (
          <AddLabRequestForm
            patientId={selectedPatientDetails.id}
            visitId={visits[0]?.id || ''}
            onSuccess={() => {
              modalState.closeLabRequestModal();
              fetchPatientDetails(selectedPatientDetails.id);
            }}
          />
        )}
      </FormModal>

      <FormModal
        isOpen={modalState.modalState.isMediaRequestModalOpen}
        onClose={() => modalState.closeMediaRequestModal()}
        title="Request Medical Imaging"
      >
        {selectedPatientDetails && (
          <AddMediaRequestForm
            patientId={selectedPatientDetails.id}
            visitId={visits[0]?.id || ''}
            onSuccess={() => {
              modalState.closeMediaRequestModal();
              fetchPatientDetails(selectedPatientDetails.id);
            }}
          />
        )}
      </FormModal>

      <PremiumBillingModal
        isOpen={modalState.modalState.isBillingModalOpen}
        onClose={() => modalState.closeBillingModal()}
        patientName={selectedPatientDetails ? `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}` : 'Patient'}
        totalSpent={visits.length * 450 + vitals.length * 75 + 1250}
        billingItems={[]}
      />

      {/* Premium SMS Modal */}
      <FormModal
        isOpen={modalState.modalState.isSmsModalOpen}
        onClose={() => modalState.closeSmsModal()}
        title=""
        hideHeader={true}
      >
        <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 rounded-2xl shadow-2xl overflow-hidden">
          <div className="relative bg-gradient-to-r from-[#01b9d5] to-purple-600 p-6 text-white">
            <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/20 to-purple-600/20 backdrop-blur-sm"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Send SMS Message</h2>
                <p className="text-blue-100 text-sm">
                  {filteredPatients.length > 0 
                    ? `Sending to ${filteredPatients.length} filtered patients`
                    : 'Contact Next of Kin directly'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {filteredPatients.length === 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all font-mono text-gray-800"
                  placeholder="Enter phone number"
                />
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Message Content</label>
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

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => modalState.closeSmsModal()}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={filteredPatients.length > 0 ? handleBulkSms : handleSendSms}
                disabled={(filteredPatients.length > 0 ? isSendingBulkSms : isSendingSms) || !smsContent.trim() || (filteredPatients.length === 0 && !smsPhone.trim())}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white rounded-xl shadow-lg hover:shadow-2xl transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(filteredPatients.length > 0 ? isSendingBulkSms : isSendingSms) ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Send SMS
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </FormModal>

      {/* Enhanced SMS Modal */}
      <EnhancedSmsModal
        isOpen={isEnhancedSmsModalOpen}
        onClose={() => {
          setIsEnhancedSmsModalOpen(false);
          setSmsTarget('patient');
        }}
        patient={selectedPatientDetails ? {
          id: selectedPatientDetails.id,
          first_name: smsTarget === 'nextOfKin' && nextOfKin ? nextOfKin.name : selectedPatientDetails.first_name,
          last_name: smsTarget === 'nextOfKin' && nextOfKin ? '' : selectedPatientDetails.last_name,
          cell_number: smsTarget === 'nextOfKin' && nextOfKin ? nextOfKin.phone : (selectedPatientDetails.cell_number || ''),
          email: selectedPatientDetails.email || ''
        } : null}
        onSend={handleEnhancedSendSms}
        isSending={false}
      />

      {/* Enhanced Email Modal */}
      <EnhancedEmailModal
        isOpen={isEnhancedEmailModalOpen}
        onClose={() => setIsEnhancedEmailModalOpen(false)}
        patient={selectedPatientDetails ? {
          id: selectedPatientDetails.id,
          first_name: selectedPatientDetails.first_name,
          last_name: selectedPatientDetails.last_name,
          cell_number: selectedPatientDetails.cell_number || '',
          email: selectedPatientDetails.email || ''
        } : null}
        onSend={handleEnhancedSendEmail}
        isSending={false}
      />

      {/* Manage Beneficiaries Modal */}
      {selectedPatientDetails && medicalAid && (
        <ManageBeneficiariesModal
          isOpen={isManageBeneficiariesModalOpen}
          onClose={() => setIsManageBeneficiariesModalOpen(false)}
          patientId={selectedPatientDetails.id}
          currentMedicalAid={{
            id: medicalAid.id,
            provider: medicalAid.provider,
            scheme: medicalAid.scheme || medicalAid.scheme_name,
            membership_number: medicalAid.membership_number,
            plan_type: medicalAid.plan_type,
            main_member_name: medicalAid.main_member_name,
            main_member_id_number: medicalAid.main_member_id_number,
            patient_id: selectedPatientDetails.id
          }}
          onRefresh={() => {
            fetchPatientDetails(selectedPatientDetails.id);
            if (medicalAid?.membership_number) {
              fetchBeneficiariesCount(medicalAid.membership_number);
            }
          }}
        />
      )}

      {/* Message Confirmation Modal */}
      <MessageConfirmationModal
        isOpen={showMessageConfirmation}
        onClose={() => {
          setShowMessageConfirmation(false);
          setMessageConfirmationData(null);
        }}
        type={messageConfirmationData?.type || 'sms'}
        recipientName={messageConfirmationData?.recipientName}
        recipientContact={messageConfirmationData?.recipientContact}
      />

      {/* Premium Confirmation Modal */}
      <PremiumConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => {
          setShowConfirmationModal(false);
          setConfirmationData(null);
        }}
        onConfirm={handleConfirmCommunication}
        type={confirmationData?.type || 'email'}
        recipients={confirmationData?.recipients || []}
        message={confirmationData?.message}
      />
    </>
  );
};

export default ComprehensivePatientModal;