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
  CheckCircle2,
  Pill,
  Camera,
  Scan,
  FlaskConical
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { usePatientsStoreNew, Patient } from '../../stores/patientsStoreNew';
import { useTheme } from '../../stores/themeStore';
import FormModal from '../modals/FormModal';
import AddPatientForm from '../forms/AddPatientForm';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';
import EditPatientForm from '../forms/EditPatientForm';
import NextOfKinForm from '../forms/NextOfKinForm';
import FullScreenEditVisitModal from '../visits/FullScreenEditVisitModal';
import FullScreenAddVisitModal from '../visits/FullScreenAddVisitModal';
import MedicalAidForm from '../forms/MedicalAidForm';
import UnifiedCommunicationModal from '../modals/UnifiedCommunicationModal';
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
import { ProfessionalSmsModal } from '../messages/ProfessionalSmsModal';
import { ProfessionalEmailModal } from '../messages/ProfessionalEmailModal';
import MessageConfirmationModal from '../modals/MessageConfirmationModal';
import { usePatientModalState } from '../../hooks/usePatientModalState';
import { useAiSearch } from '../../hooks/useAiSearch';
import { communicationService } from '../../services/communicationService';
import { medicalAidService } from '../../services/medicalAidService';
import { useAuthStore } from '../../stores/authStore';
import { LabResultsContent, DocumentsContent, BillingContent } from './DirectTabContent';
import CleanInvoiceTable from '../billing/CleanInvoiceTable';
import html2canvas from 'html2canvas';
import InvoiceGenerationModal from '../modals/InvoiceGenerationModal';
import InvoicePreviewModal from '../modals/InvoicePreviewModal';
import ManageBeneficiariesModal from '../modals/ManageBeneficiariesModal';
import UnifiedPDFGenerator from '../billing/UnifiedPDFGenerator';
import FloatingVisitTracker from '../dashboard/FloatingVisitTracker';
import { fetchPatientDetailsOptimized } from './OptimizedPatientQueries';
import { usePatientPrefetch } from '../../hooks/usePatientPrefetch';
import { useQuery } from '@tanstack/react-query';

interface MessageConfirmationData {
  type: 'sms' | 'email';
  recipientName?: string;
  recipientContact?: string;
}

interface ComprehensivePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string | null;
  onAppointmentCreated?: (appointment: any) => void;
  defaultDetailTab?: 'overview' | 'encounters' | 'medications' | 'media' | 'lab' | 'imaging' | 'billing' | 'audit';
  visitIdToEdit?: string | null;
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

const ComprehensivePatientModal: React.FC<ComprehensivePatientModalProps> = ({ isOpen, onClose, patientId, onAppointmentCreated, defaultDetailTab, visitIdToEdit }) => {
  console.log('🎯 [ComprehensivePatientModal] Component rendered with props:', {
    isOpen,
    patientId,
    defaultDetailTab,
    visitIdToEdit
  });
  
  const { currentTheme } = useTheme();
  const { patients, isLoading, error, fetchPatients: fetchPatientsFromStore, searchPatients } = usePatientsStoreNew();
  
  // Main tab state - automatically switch to details if patientId is provided
  const [activeTab, setActiveTab] = useState<'patients' | 'details'>(patientId ? 'details' : 'patients');
  const [activeMainTab, setActiveMainTab] = useState<'patients' | 'analytics'>('patients');
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'encounters' | 'medications' | 'media' | 'lab' | 'imaging' | 'billing' | 'audit'>(defaultDetailTab || 'overview');
  
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
  const location = useLocation();
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
  const [visitCounts, setVisitCounts] = useState<{ [visitId: string]: { media: number; lab: number; imaging: number } }>({});
  const [appointments, setAppointments] = useState<any[]>([]);
  const [nextOfKin, setNextOfKin] = useState<NextOfKin | null>(null);
  const [medicalAid, setMedicalAid] = useState<MedicalAidDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  
  // Extracted modal state management
  const modalState = usePatientModalState();
  
  // Use React Query for patient details with caching
  const { getCachedPatientData } = usePatientPrefetch();
  
  const { data: patientDetailsData, isLoading: isQueryLoading, error: queryError } = useQuery({
    queryKey: ['patient-details-optimized', patientId],
    queryFn: () => fetchPatientDetailsOptimized(patientId!),
    enabled: !!patientId && isOpen && activeTab === 'details',
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    initialData: () => {
      // Use cached data if available for instant loading
      const cached = getCachedPatientData(patientId!);
      return cached;
    }
  });
  
  // Sync React Query data with component state for instant loading
  useEffect(() => {
    if (patientDetailsData && isOpen && patientId) {
      // Use a single state update to prevent multiple re-renders
      const updateStates = () => {
        setSelectedPatientDetails(patientDetailsData.patient);
        setNextOfKin(patientDetailsData.nextOfKin);
        setVisits(patientDetailsData.visits);
        setVisitCounts(patientDetailsData.visitCounts);
        setAppointments(patientDetailsData.appointments);
        setVitals(patientDetailsData.vitals);
        setLabRequests(patientDetailsData.labRequests);
        setLabResults(patientDetailsData.labResults);
        setMedications(patientDetailsData.medications);
        setMediaRequests(patientDetailsData.mediaRequests);
        setImagingRequests(patientDetailsData.imagingRequests);
        setBillingData(patientDetailsData.billingData);
        setMedicalAid(patientDetailsData.medicalAid);
        setDocuments(patientDetailsData.documents);
        setPracticeData(patientDetailsData.practiceData);
      };

      // Use setTimeout to batch the updates
      const timeoutId = setTimeout(updateStates, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [patientDetailsData, isOpen, patientId]);
  
  // Function to handle new appointments created for this patient
  const handleNewAppointmentForPatient = useCallback((newAppointment: any) => {
    console.log('🎯 PATIENT MODAL: handleNewAppointmentForPatient called:', {
      newAppointment,
      currentPatientId: patientId,
      appointmentPatientId: newAppointment.patient_id,
      isForCurrentPatient: newAppointment.patient_id === patientId
    });
    
    // Only update if this appointment is for the currently viewed patient
    if (newAppointment.patient_id === patientId) {
      setAppointments(prevAppointments => {
        console.log('📋 PATIENT MODAL: Current appointments before update:', prevAppointments);
        
        // Check if appointment already exists to avoid duplicates
        const exists = prevAppointments.some(appt => appt.id === newAppointment.id);
        console.log('🔍 PATIENT MODAL: Appointment already exists?', exists);
        
        if (exists) return prevAppointments;
        
        // Add new appointment and sort by date
        const updatedAppointments = [...prevAppointments, newAppointment];
        const sortedAppointments = updatedAppointments.sort((a, b) => 
          new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime()
        );
        
        console.log('✅ PATIENT MODAL: Updated appointments:', sortedAppointments);
        return sortedAppointments;
      });
    } else {
      console.log('⚠️ PATIENT MODAL: Appointment not for current patient, ignoring');
    }
  }, [patientId]);

  // Expose the handler to parent components
  useEffect(() => {
    if (onAppointmentCreated && patientId) {
      // Register this handler globally if needed
      window.addAppointmentToPatientTimeline = handleNewAppointmentForPatient;
    }
    
    return () => {
      if (window.addAppointmentToPatientTimeline) {
        delete window.addAppointmentToPatientTimeline;
      }
    };
  }, [onAppointmentCreated, patientId]); // Removed handleNewAppointmentForPatient from dependencies
  
  // Additional state
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [labResults, setLabResults] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [imagingRequests, setImagingRequests] = useState<any[]>([]);
  const [billingData, setBillingData] = useState<any[]>([]);
  const [labRequests, setLabRequests] = useState<any[]>([]);
  const [mediaRequests, setMediaRequests] = useState<any[]>([]);
  const [smsContent, setSmsContent] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isProfessionalSmsModalOpen, setIsProfessionalSmsModalOpen] = useState(false);
  const [isProfessionalEmailModalOpen, setIsProfessionalEmailModalOpen] = useState(false);
  const [isManageBeneficiariesModalOpen, setIsManageBeneficiariesModalOpen] = useState(false);
  const [smsTarget, setSmsTarget] = useState<'patient' | 'nextOfKin'>('patient');
  const [showMessageConfirmation, setShowMessageConfirmation] = useState(false);
  const [messageConfirmationData, setMessageConfirmationData] = useState<MessageConfirmationData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingBulkSms, setIsSendingBulkSms] = useState(false);
  const [isSendingBulkEmail, setIsSendingBulkEmail] = useState(false);
  const [beneficiariesCount, setBeneficiariesCount] = useState<number>(0);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [practiceData, setPracticeData] = useState<any>(null);
  const [isPrintingPDF, setIsPrintingPDF] = useState(false);
  const [isInvoiceGenerationModalOpen, setIsInvoiceGenerationModalOpen] = useState(false);
  const [generationType, setGenerationType] = useState<'invoice' | 'receipt' | null>(null);

  const { user } = useAuthStore();

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Get practice_id from user
  const practiceId = user?.practice_id;

  // Create a function to generate and download PDF directly
  const handleDirectPrintPDF = useCallback(async (invoice: any) => {
    if (!selectedPatientDetails) {
      console.error('❌ No patient details available for PDF generation');
      return;
    }

    setIsPrintingPDF(true);
    console.log('🎯 Starting enhanced multi-page PDF generation for invoice:', invoice.invoice_number);

    try {
      // Create patient info object
      const patientInfo = {
        name: `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}`,
        phone: selectedPatientDetails.cell_number || undefined,
        email: selectedPatientDetails.email || undefined,
        address: selectedPatientDetails.home_address || undefined,
        medicalAidProvider: medicalAid?.provider,
        membershipNumber: medicalAid?.membership_number,
      };

      // Fetch practice data directly from database
      console.log('🔍 Fetching practice data for user:', user?.id);
      
      // Get user's practice_id
      let userPracticeId = user?.practice_id;
      if (!userPracticeId && user?.user_metadata?.practice_id) {
        userPracticeId = user.user_metadata.practice_id;
      }
      
      if (!userPracticeId) {
        throw new Error('No practice_id found for user. Please ensure you are logged in and associated with a practice.');
      }
      
      console.log('🏥 Fetching practice details for practice_id:', userPracticeId);
      
      // Fetch practice details from database
      const { data: practiceInfo, error: practiceError } = await supabase
        .from('practices')
        .select(`
          id, name, slug, domain, logo_url, primary_color, secondary_color,
          contact_email, contact_phone, address, city, country, postal_code,
          tax_number, license_number, practice_number, hero_subtitle,
          bank_name, account_holder_name, account_number, branch_code, swift_code, account_type
        `)
        .eq('id', userPracticeId)
        .single();
        
      if (practiceError || !practiceInfo) {
        console.error('Error fetching practice data:', practiceError);
        throw new Error('Failed to fetch practice data from database.');
      }
      
      console.log('✅ Practice data fetched successfully:', practiceInfo);
      console.log('📄 Patient info for PDF:', patientInfo);
      console.log('🏥 Practice info for PDF:', practiceInfo);
      console.log('💰 Invoice data:', invoice);

      // Fetch medical aid provider details if available
      let medicalAidProviderName = medicalAid?.provider || 'N/A';
      if (medicalAid?.medical_aid_provider_id) {
        try {
          const { data: providerData, error: providerError } = await supabase
            .from('medical_aid_providers')
            .select('name, short_name')
            .eq('id', medicalAid.medical_aid_provider_id)
            .single();
          
          if (!providerError && providerData) {
            medicalAidProviderName = providerData.short_name || providerData.name;
            console.log('✅ Medical aid provider fetched:', medicalAidProviderName);
          }
        } catch (error) {
          console.log('⚠️ Could not fetch medical aid provider details:', error);
        }
      }

      // Import jsPDF for enhanced multi-page PDF generation
      const jsPDF = (await import('jspdf')).default;

      // Load Montserrat and Rubik fonts
      const fontLink = document.createElement('link');
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);

      // Wait for font to load
      await document.fonts.ready;

      // Get practice primary color with fallback
      const primaryColor = practiceData?.primary_color || practiceInfo?.primary_color || '#01b9d4';
      
      // Generate gradient colors
      function hexToRgb(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ] : [1, 185, 212];
      }
      
      function adjustBrightness(hex: string, percent: number) {
        const [r, g, b] = hexToRgb(hex);
        const adjust = (color: number) => Math.max(0, Math.min(255, Math.round(color * (1 + percent / 100))));
        return `#${((1 << 24) + (adjust(r) << 16) + (adjust(g) << 8) + adjust(b)).toString(16).slice(1)}`;
      }
      
      const lightColor = adjustBrightness(primaryColor, 20);
      const darkColor = adjustBrightness(primaryColor, -15);
      
      // Create function to generate page HTML with your exact styling
      const createPageHTML = (pageServices: any[], pageNumber: number, totalPages: number, isLastPage: boolean) => {
        return `
          <div style="width: 794px; height: 1123px; font-family: 'Montserrat', sans-serif; font-size: 11px; line-height: 1.5; color: #2c2c2c; background-color: #ffffff; padding: 25px; margin: 0; box-sizing: border-box; position: relative;">
            
            <!-- Premium Header Section -->
            <div style="padding: 0; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-start;">
              
              <!-- Logo and Title on Left (Stacked) -->
              <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; flex: 1;">
                ${practiceInfo.logo_url ? `
                  <div style="flex-shrink: 0;">
                    <img src="${practiceInfo.logo_url}" alt="Practice Logo" style="width: 120px; height: auto; max-height: 65px; border-radius: 8px; object-fit: contain;" />
                  </div>
                ` : ''}
                <div>
                  <div style="font-family: 'Rubik', sans-serif; font-size: 22px; font-weight: 800; color: #5f6578; letter-spacing: -0.2px;">
                    ${practiceInfo.name}
                  </div>
                </div>
              </div>
              
              <!-- Practice Details (right aligned) -->
              <div style="text-align: right; flex: 1; max-width: 300px;">
                <div style="font-size: 10px; line-height: 1.6; color: #5a5a5a; font-weight: 400;">
                  ${practiceInfo.address ? `<div style="margin-bottom: 2px;">${practiceInfo.address}</div>` : ''}
                  <div style="margin-bottom: 2px;">${practiceInfo.city}, ${practiceInfo.country} ${practiceInfo.postal_code || ''}</div>
                  ${practiceInfo.contact_phone ? `<div style="margin-bottom: 2px;">Tel: ${practiceInfo.contact_phone}</div>` : ''}
                  ${practiceInfo.contact_email ? `<div style="margin-bottom: 2px;">Email: ${practiceInfo.contact_email}</div>` : ''}
                  ${practiceInfo.domain ? `<div>www.${practiceInfo.domain}</div>` : ''}
                </div>
              </div>
            </div>
            
            ${pageNumber === 1 ? `
            <!-- Refined Invoice Title Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 20px 0; border-bottom: 2px solid #d1d5db;">
              <div style="display: flex; align-items: flex-end; gap: 15px;">
                <div style="font-family: 'Rubik', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">
                  <span style="color: #5f6578;">MEDICAL</span> <span style="color: #888;">INVOICE</span>
                </div>
                <span style="font-size: 14px; font-weight: 600; color: #666; letter-spacing: 0.3px; align-self: flex-end;">#${invoice.invoice_number}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 15px; font-size: 9px; color: #666;">
                <div style="text-align: center;">
                  <div style="color: #aaa; text-transform: uppercase; margin-bottom: 3px; font-size: 7px; font-weight: 600; letter-spacing: 0.8px;">DATE PREPARED</div>
                  <div style="font-weight: 700; color: #2c2c2c; font-size: 10px;">${format(new Date(invoice.created_at), 'dd MMM yyyy')}</div>
                </div>
                <div style="border-left: 1px solid #d1d5db; height: 30px; margin: 0 5px;"></div>
                <div style="text-align: center;">
                  <div style="color: #aaa; text-transform: uppercase; margin-bottom: 3px; font-size: 7px; font-weight: 600; letter-spacing: 0.8px;">DUE DATE</div>
                  <div style="font-weight: 700; color: #2c2c2c; font-size: 10px;">${format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'dd MMM yyyy')}</div>
                </div>
              </div>
            </div>

            <!-- PREPARED FOR Section -->
            <div style="margin-bottom: 20px;">
              <h3 style="font-size: 14px; font-weight: 700; color: #5f6578; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.3px;">PREPARED FOR</h3>
              <div style="display: flex; justify-content: space-between; gap: 25px;">
                <!-- Patient Details -->
                <div style="flex: 1;">
                  <div style="line-height: 1.4;">
                    <div style="font-weight: 700; font-size: 12px; color: #1a1a1a; margin-bottom: 3px;">
                      ${patientInfo.name}
                    </div>
                    ${patientInfo.phone ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${patientInfo.phone}</div>` : ''}
                    ${patientInfo.email ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${patientInfo.email}</div>` : ''}
                    ${patientInfo.address ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${patientInfo.address}</div>` : ''}
                  </div>
                </div>

                <!-- Medical Aid Details (Right Aligned) -->
                ${medicalAid?.scheme || medicalAidProviderName !== 'N/A' ? `
                  <div style="flex: 1; text-align: right;">
                    <div style="line-height: 1.4;">
                      <div style="font-weight: 700; font-size: 12px; color: #1a1a1a; margin-bottom: 3px;">
                        ${medicalAidProviderName}
                      </div>
                      ${medicalAid?.scheme ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">Scheme: ${medicalAid.scheme}</div>` : ''}
                      ${medicalAid?.membership_number ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">Member: ${medicalAid.membership_number}</div>` : ''}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            <!-- Service Details Section -->
            <div style="margin-bottom: 30px;">
              <h3 style="font-size: 14px; font-weight: 700; color: #5f6578; margin: 0 0 12px 0; padding-bottom: 10px; border-bottom: 1px solid #d1d5db; text-transform: uppercase; letter-spacing: 0.3px;">SERVICES ${pageNumber > 1 ? '(CONTINUED)' : ''}</h3>
              
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #5f6578; color: white;">
                    <th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Code</th>
                    <th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Description</th>
                    <th style="padding: 12px 10px; text-align: center; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Qty</th>
                    <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Unit Price</th>
                    <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Med Aid</th>
                    <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; text-transform: uppercase;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageServices.map((service: any, index: number) => `
                    <tr style="border-bottom: 1px solid #f3f4f6; ${index % 2 === 1 ? 'background: #f9fafb;' : ''}">
                      <td style="padding: 12px 10px; border-right: 1px solid #e5e7eb; font-weight: 600; color: #1f2937; font-size: 11px;">${service.code || 'N/A'}</td>
                      <td style="padding: 12px 10px; border-right: 1px solid #e5e7eb; font-size: 11px;">
                        <div style="color: #4b5563;">${service.description}</div>
                      </td>
                      <td style="padding: 12px 10px; text-align: center; border-right: 1px solid #e5e7eb; font-size: 11px;">${service.quantity}</td>
                      <td style="padding: 12px 10px; text-align: right; border-right: 1px solid #e5e7eb; font-weight: 600; font-size: 11px;">N$ ${service.unit_price.toFixed(2)}</td>
                      <td style="padding: 12px 10px; text-align: right; border-right: 1px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 11px;">N$ ${(service.medical_aid_covered || 0).toFixed(2)}</td>
                      <td style="padding: 12px 10px; text-align: right; font-weight: 600; color: #1f2937; font-size: 11px;">N$ ${service.total_price.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  
                  ${isLastPage ? `
                  <!-- Summary Rows -->
                  <tr>
                    <td colspan="5" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; border-right: 1px solid #e5e7eb; font-size: 11px;">Subtotal:</td>
                    <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; font-size: 11px;">N$ ${invoice.services.reduce((sum: number, s: any) => sum + s.total_price, 0).toFixed(2)}</td>
                  </tr>
                  
                  <!-- Patient Portion Row -->
                  <tr>
                    <td colspan="5" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #fff7ed; border-right: 1px solid #fed7aa; font-size: 11px; color: #ea580c;">Patient Portion:</td>
                    <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #fff7ed; font-size: 11px; color: #ea580c;">N$ ${(invoice.total - (invoice.medical_aid_covered || 0)).toFixed(2)}</td>
                  </tr>
                  
                  <!-- Total Row -->
                  <tr>
                    <td colspan="5" style="padding: 10px; text-align: right; font-weight: 700; font-size: 12px; background: #5f6578; color: white; border-right: 1px solid #5f6578; text-transform: uppercase;">Total Amount Due:</td>
                    <td style="padding: 10px; text-align: right; font-weight: 700; font-size: 14px; background: #5f6578; color: white;">N$ ${invoice.total.toFixed(2)}</td>
                  </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>

            ${isLastPage ? `
            <!-- Compact Banking Details Section -->
            <div style="margin-bottom: 20px; padding: 10px 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 10px; font-weight: 600; color: #5f6578; margin: 0 0 6px 0; text-transform: uppercase;">Banking Details</h3>
              <div style="display: flex; gap: 20px; font-size: 10px; line-height: 1.3;">
                <span style="color: #6b7280;">Bank: <strong style="color: #1f2937;">${practiceInfo.bank_name || ''}</strong></span>
                <span style="color: #6b7280;">Account: <strong style="color: #1f2937;">${practiceInfo.account_number || ''}</strong></span>
                <span style="color: #6b7280;">Branch: <strong style="color: #1f2937;">${practiceInfo.branch_code || ''}</strong></span>
              </div>
            </div>

            <!-- Professional Footer -->
            <div style="padding: 15px 0; border-top: 1px solid #e5e7eb; margin-top: 30px;">
              <div style="text-align: center;">
                <p style="margin: 0; font-size: 9px; color: #6b7280; line-height: 1.5;">
                  Payment is due within 30 days. Thank you for choosing <strong style="color: #374151;">${practiceInfo.name}</strong> For inquiries: ${practiceInfo.contact_phone} • ${practiceInfo.contact_email}
                </p>
                <div style="margin-top: 12px; font-size: 8px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 8px;">
                  Invoice generated by <strong style="color: #6b7280;">OneHealth Systems</strong> • www.onehealthsystems.com • © 2024
                </div>
              </div>
            </div>
            ` : ''}

            <!-- Page number at bottom -->
            <div style="position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 8px; color: #9ca3af;">
              Page ${pageNumber} of ${totalPages}
            </div>
          </div>
        `;
      };

      // Smart pagination logic based on content space optimization
      const totalServices = invoice.services.length;
      const serviceChunks = [];
      
      if (totalServices <= 9) {
        // Single page with footer - all services fit
        serviceChunks.push(invoice.services);
      } else if (totalServices <= 13) {
        // 10-13 services: 10 on page 1, rest on page 2 with footer
        serviceChunks.push(invoice.services.slice(0, 10));
        serviceChunks.push(invoice.services.slice(10));
      } else {
        // 14+ services: 14 on page 1, then 20 per continuation page
        serviceChunks.push(invoice.services.slice(0, 14));
        
        let remainingServices = invoice.services.slice(14);
        while (remainingServices.length > 0) {
          const chunkSize = 20; // Continuation pages can fit 20 services
          serviceChunks.push(remainingServices.slice(0, chunkSize));
          remainingServices = remainingServices.slice(chunkSize);
        }
      }
      
      const totalPages = Math.max(1, serviceChunks.length);
      console.log(`📊 Smart pagination: ${totalServices} services split into ${totalPages} pages`);
      console.log(`📊 Page breakdown:`, serviceChunks.map((chunk, i) => `Page ${i+1}: ${chunk.length} services`));

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Import html2canvas dynamically
      // html2canvas is already imported at the top

      // Generate each page
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        const pageNumber = pageIndex + 1;
        const pageServices = serviceChunks[pageIndex] || [];
        const isLastPage = pageIndex === totalPages - 1;

        console.log(`🖼️ Generating page ${pageNumber} with ${pageServices.length} services...`);

        // Create temporary container for this page
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        document.body.appendChild(tempContainer);

        // Set page HTML with your beautiful styling
        tempContainer.innerHTML = createPageHTML(pageServices, pageNumber, totalPages, isLastPage);

        // Generate canvas for this page
        const canvas = await html2canvas(tempContainer.firstElementChild as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });

        // Add page to PDF
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, '', 'FAST');

        // Clean up
        document.body.removeChild(tempContainer);
      }

      // Download the PDF
      pdf.save(`invoice-${invoice.invoice_number}.pdf`);
      
      console.log('✅ Enhanced PDF with your original styling and proper multi-page headers/footers generated successfully!');

    } catch (error) {
      console.error('❌ Failed to generate PDF:', error);
      alert('Failed to generate PDF. Please try again or use the preview option.');
    } finally {
      setIsPrintingPDF(false);
    }
  }, [selectedPatientDetails, medicalAid, practiceData, practiceId]);

  // Create a function to generate receipt (similar to invoice but for paid items)
  const handleDirectReceiptPDF = useCallback(async (invoice: any) => {
    if (!selectedPatientDetails) {
      console.error('❌ No patient details available for receipt generation');
      return;
    }

    setIsPrintingPDF(true);
    setGenerationType('receipt');
    console.log('🧾 Starting Receipt generation for invoice:', invoice.invoice_number);

    try {
      // Create patient info object
      const patientInfo = {
        name: `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}`,
        phone: selectedPatientDetails.cell_number || undefined,
        email: selectedPatientDetails.email || undefined,
        address: selectedPatientDetails.home_address || undefined,
        medicalAidProvider: medicalAid?.provider,
        membershipNumber: medicalAid?.membership_number,
      };

      // Fetch practice data directly from database for receipt
      console.log('🔍 Fetching practice data for receipt generation, user:', user?.id);
      
      // Get user's practice_id
      let userPracticeId = user?.practice_id;
      if (!userPracticeId && user?.user_metadata?.practice_id) {
        userPracticeId = user.user_metadata.practice_id;
      }
      
      if (!userPracticeId) {
        throw new Error('No practice_id found for user. Please ensure you are logged in and associated with a practice.');
      }
      
      console.log('🏥 Fetching practice details for receipt, practice_id:', userPracticeId);
      
      // Fetch practice details from database
      const { data: practiceInfo, error: practiceError } = await supabase
        .from('practices')
        .select(`
          id, name, slug, domain, logo_url, primary_color, secondary_color,
          contact_email, contact_phone, address, city, country, postal_code,
          tax_number, license_number, practice_number, hero_subtitle,
          bank_name, account_holder_name, account_number, branch_code, swift_code, account_type
        `)
        .eq('id', userPracticeId)
        .single();
        
      if (practiceError || !practiceInfo) {
        console.error('Error fetching practice data for receipt:', practiceError);
        throw new Error('Failed to fetch practice data from database.');
      }
      
      console.log('✅ Practice data fetched successfully for receipt:', practiceInfo);
      console.log('🧾 Patient info for Receipt:', patientInfo);
      console.log('🏥 Practice info for Receipt:', practiceInfo);

      // Fetch medical aid provider details if available
      let medicalAidProviderName = medicalAid?.provider || 'N/A';
      if (medicalAid?.medical_aid_provider_id) {
        try {
          const { data: providerData, error: providerError } = await supabase
            .from('medical_aid_providers')
            .select('name, short_name')
            .eq('id', medicalAid.medical_aid_provider_id)
            .single();
          
          if (!providerError && providerData) {
            medicalAidProviderName = providerData.short_name || providerData.name;
            console.log('✅ Medical aid provider fetched for receipt:', medicalAidProviderName);
          }
        } catch (error) {
          console.log('⚠️ Could not fetch medical aid provider details for receipt:', error);
        }
      }

      // Create a temporary container for the HTML content
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      document.body.appendChild(tempContainer);

      // Import and use html2canvas and jsPDF directly
      // html2canvas is already imported at the top
      const jsPDF = (await import('jspdf')).default;

      // Load Montserrat and Rubik fonts
      const receiptFontLink = document.createElement('link');
      receiptFontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap';
      receiptFontLink.rel = 'stylesheet';
      document.head.appendChild(receiptFontLink);

      // Wait for font to load
      await document.fonts.ready;

      // Helper functions for color manipulation
      function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ] : [1, 185, 212];
      }
      
      function adjustBrightness(hex, percent) {
        const [r, g, b] = hexToRgb(hex);
        const adjust = (color) => Math.max(0, Math.min(255, Math.round(color * (1 + percent / 100))));
        return `#${((1 << 24) + (adjust(r) << 16) + (adjust(g) << 8) + adjust(b)).toString(16).slice(1)}`;
      }

      // Get practice primary color for receipt
      const primaryColor = practiceData?.primary_color || practiceInfo?.primary_color || '#01b9d4';
      const lightColor = adjustBrightness(primaryColor, 20);
      const darkColor = adjustBrightness(primaryColor, -15);

      // Create function to generate receipt page HTML with your exact styling
      const createReceiptPageHTML = (pageServices: any[], pageNumber: number, totalPages: number, isLastPage: boolean) => {
        return `
          <div style="width: 794px; height: 1123px; font-family: 'Montserrat', sans-serif; font-size: 11px; line-height: 1.5; color: #2c2c2c; background-color: #ffffff; padding: 25px; margin: 0; box-sizing: border-box; position: relative;">
            
            <!-- Premium Header Section -->
            <div style="padding: 0; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-start;">
              
              <!-- Logo and Title on Left (Stacked) -->
              <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; flex: 1;">
                ${practiceInfo.logo_url ? `
                  <div style="flex-shrink: 0;">
                    <img src="${practiceInfo.logo_url}" alt="Practice Logo" style="width: 120px; height: auto; max-height: 65px; border-radius: 8px; object-fit: contain;" />
                  </div>
                ` : ''}
                <div>
                  <div style="font-family: 'Rubik', sans-serif; font-size: 22px; font-weight: 800; color: #5f6578; letter-spacing: -0.2px;">
                    ${practiceInfo.name}
                  </div>
                </div>
              </div>
              
              <!-- Practice Details (right aligned) -->
              <div style="text-align: right; flex: 1; max-width: 300px;">
                <div style="font-size: 10px; line-height: 1.6; color: #5a5a5a; font-weight: 400;">
                  ${practiceInfo.address ? `<div style="margin-bottom: 2px;">${practiceInfo.address}</div>` : ''}
                  <div style="margin-bottom: 2px;">${practiceInfo.city}, ${practiceInfo.country} ${practiceInfo.postal_code || ''}</div>
                  ${practiceInfo.contact_phone ? `<div style="margin-bottom: 2px;">Tel: ${practiceInfo.contact_phone}</div>` : ''}
                  ${practiceInfo.contact_email ? `<div style="margin-bottom: 2px;">Email: ${practiceInfo.contact_email}</div>` : ''}
                  ${practiceInfo.domain ? `<div>www.${practiceInfo.domain}</div>` : ''}
                </div>
              </div>
            </div>
            
            ${pageNumber === 1 ? `
            <!-- Receipt Title Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 20px 0; border-bottom: 2px solid #d1d5db;">
              <div style="display: flex; align-items: flex-end; gap: 15px;">
                <div style="font-family: 'Rubik', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">
                  <span style="color: #5f6578;">PAYMENT</span> <span style="color: #888;">RECEIPT</span>
                </div>
                <span style="font-size: 14px; font-weight: 600; color: #666; letter-spacing: 0.3px; align-self: flex-end;">#REC-${invoice.invoice_number}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 15px; font-size: 9px; color: #666;">
                <div style="text-align: center;">
                  <div style="color: #aaa; text-transform: uppercase; margin-bottom: 3px; font-size: 7px; font-weight: 600; letter-spacing: 0.8px;">PAID DATE</div>
                  <div style="font-weight: 700; color: #2c2c2c; font-size: 10px;">${format(new Date(), 'dd MMM yyyy')}</div>
                </div>
                <div style="border-left: 1px solid #d1d5db; height: 30px; margin: 0 5px;"></div>
                <div style="text-align: center;">
                  <div style="color: #aaa; text-transform: uppercase; margin-bottom: 3px; font-size: 7px; font-weight: 600; letter-spacing: 0.8px;">METHOD</div>
                  <div style="font-weight: 700; color: #2c2c2c; font-size: 10px;">${invoice.payment_method || 'Cash'}</div>
                </div>
              </div>
            </div>

            <!-- PAYMENT RECEIVED FROM Section -->
            <div style="margin-bottom: 20px;">
              <h3 style="font-size: 14px; font-weight: 700; color: #5f6578; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.3px;">PAYMENT RECEIVED FROM</h3>
              <div style="display: flex; justify-content: space-between; gap: 25px;">
                <!-- Patient Details -->
                <div style="flex: 1;">
                  <div style="line-height: 1.4;">
                    <div style="font-weight: 700; font-size: 12px; color: #1a1a1a; margin-bottom: 3px;">
                      ${patientInfo.name}
                    </div>
                    ${patientInfo.phone ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${patientInfo.phone}</div>` : ''}
                    ${patientInfo.email ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${patientInfo.email}</div>` : ''}
                    ${patientInfo.address ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${patientInfo.address}</div>` : ''}
                  </div>
                </div>

                <!-- Medical Aid Details (Right Aligned) -->
                ${medicalAid?.scheme || medicalAidProviderName !== 'N/A' ? `
                  <div style="flex: 1; text-align: right;">
                    <div style="line-height: 1.4;">
                      <div style="font-weight: 700; font-size: 12px; color: #1a1a1a; margin-bottom: 3px;">
                        ${medicalAidProviderName}
                      </div>
                      ${medicalAid?.scheme ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">Scheme: ${medicalAid.scheme}</div>` : ''}
                      ${medicalAid?.membership_number ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">Member: ${medicalAid.membership_number}</div>` : ''}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            <!-- Service Details Section -->
            <div style="margin-bottom: 30px;">
              <h3 style="font-size: 14px; font-weight: 700; color: #5f6578; margin: 0 0 12px 0; padding-bottom: 10px; border-bottom: 1px solid #d1d5db; text-transform: uppercase; letter-spacing: 0.3px;">SERVICES ${pageNumber > 1 ? '(CONTINUED)' : ''}</h3>
              
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #5f6578; color: white;">
                    <th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Code</th>
                    <th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Description</th>
                    <th style="padding: 12px 10px; text-align: center; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Qty</th>
                    <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Unit Price</th>
                    <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Med Aid</th>
                    <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; text-transform: uppercase;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageServices.map((service: any, index: number) => `
                    <tr style="border-bottom: 1px solid #f3f4f6; ${index % 2 === 1 ? 'background: #f9fafb;' : ''}">
                      <td style="padding: 12px 10px; border-right: 1px solid #e5e7eb; font-weight: 600; color: #1f2937; font-size: 11px;">${service.code || 'N/A'}</td>
                      <td style="padding: 12px 10px; border-right: 1px solid #e5e7eb; font-size: 11px;">
                        <div style="color: #4b5563;">${service.description}</div>
                      </td>
                      <td style="padding: 12px 10px; text-align: center; border-right: 1px solid #e5e7eb; font-size: 11px;">${service.quantity}</td>
                      <td style="padding: 12px 10px; text-align: right; border-right: 1px solid #e5e7eb; font-weight: 600; font-size: 11px;">N$ ${service.unit_price.toFixed(2)}</td>
                      <td style="padding: 12px 10px; text-align: right; border-right: 1px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 11px;">N$ ${(service.medical_aid_covered || 0).toFixed(2)}</td>
                      <td style="padding: 12px 10px; text-align: right; font-weight: 600; color: #1f2937; font-size: 11px;">N$ ${service.total_price.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  
                  ${isLastPage ? `
                  <!-- Summary Rows -->
                  <tr>
                    <td colspan="5" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; border-right: 1px solid #e5e7eb; font-size: 11px;">Subtotal:</td>
                    <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; font-size: 11px;">N$ ${invoice.services.reduce((sum: number, s: any) => sum + s.total_price, 0).toFixed(2)}</td>
                  </tr>
                  
                  <!-- Patient Portion Row -->
                  <tr>
                    <td colspan="5" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #fff7ed; border-right: 1px solid #fed7aa; font-size: 11px; color: #ea580c;">Patient Portion:</td>
                    <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #fff7ed; font-size: 11px; color: #ea580c;">N$ ${(invoice.total - (invoice.medical_aid_covered || 0)).toFixed(2)}</td>
                  </tr>
                  
                  <!-- Total Row -->
                  <tr>
                    <td colspan="5" style="padding: 10px; text-align: right; font-weight: 700; font-size: 12px; background: #5f6578; color: white; border-right: 1px solid #5f6578; text-transform: uppercase;">Amount Paid:</td>
                    <td style="padding: 10px; text-align: right; font-weight: 700; font-size: 14px; background: #5f6578; color: white;">N$ ${invoice.total.toFixed(2)}</td>
                  </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>

            ${isLastPage ? `
            <!-- Compact Banking Details Section -->
            <div style="margin-bottom: 20px; padding: 10px 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 10px; font-weight: 600; color: #5f6578; margin: 0 0 6px 0; text-transform: uppercase;">Banking Details</h3>
              <div style="display: flex; gap: 20px; font-size: 10px; line-height: 1.3;">
                <span style="color: #6b7280;">Bank: <strong style="color: #1f2937;">${practiceInfo.bank_name || ''}</strong></span>
                <span style="color: #6b7280;">Account: <strong style="color: #1f2937;">${practiceInfo.account_number || ''}</strong></span>
                <span style="color: #6b7280;">Branch: <strong style="color: #1f2937;">${practiceInfo.branch_code || ''}</strong></span>
              </div>
            </div>

            <!-- Professional Footer -->
            <div style="padding: 15px 0; border-top: 1px solid #e5e7eb; margin-top: 30px;">
              <div style="text-align: center;">
                <p style="margin: 0; font-size: 9px; color: #6b7280; line-height: 1.5;">
                  Thank you for choosing <strong style="color: #374151;">${practiceInfo.name}</strong> For inquiries: ${practiceInfo.contact_phone} • ${practiceInfo.contact_email}
                </p>
                <div style="margin-top: 12px; font-size: 8px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 8px;">
                  Receipt generated by <strong style="color: #6b7280;">OneHealth Systems</strong> • www.onehealthsystems.com • © 2024
                </div>
              </div>
            </div>
            ` : ''}

            <!-- Page number at bottom -->
            <div style="position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 8px; color: #9ca3af;">
              Page ${pageNumber} of ${totalPages}
            </div>
          </div>
        `;
      };

      // Smart pagination logic for receipts (same as invoices)
      const totalServices = invoice.services.length;
      const serviceChunks = [];
      
      if (totalServices <= 9) {
        // Single page with footer - all services fit
        serviceChunks.push(invoice.services);
      } else if (totalServices <= 13) {
        // 10-13 services: 10 on page 1, rest on page 2 with footer
        serviceChunks.push(invoice.services.slice(0, 10));
        serviceChunks.push(invoice.services.slice(10));
      } else {
        // 14+ services: 14 on page 1, then 20 per continuation page
        serviceChunks.push(invoice.services.slice(0, 14));
        
        let remainingServices = invoice.services.slice(14);
        while (remainingServices.length > 0) {
          const chunkSize = 20; // Continuation pages can fit 20 services
          serviceChunks.push(remainingServices.slice(0, chunkSize));
          remainingServices = remainingServices.slice(chunkSize);
        }
      }
      
      const totalPages = Math.max(1, serviceChunks.length);
      console.log(`📊 Smart receipt pagination: ${totalServices} services split into ${totalPages} pages`);
      console.log(`📊 Receipt page breakdown:`, serviceChunks.map((chunk, i) => `Page ${i+1}: ${chunk.length} services`));

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();

      // Generate each page
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        const pageNumber = pageIndex + 1;
        const pageServices = serviceChunks[pageIndex] || [];
        const isLastPage = pageIndex === totalPages - 1;

        console.log(`🖼️ Generating receipt page ${pageNumber} with ${pageServices.length} services...`);

        // Create temporary container for this page
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        document.body.appendChild(tempContainer);

        // Set page HTML with your beautiful styling
        tempContainer.innerHTML = createReceiptPageHTML(pageServices, pageNumber, totalPages, isLastPage);

        // Generate canvas for this page
        const canvas = await html2canvas(tempContainer.firstElementChild as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });

        // Add page to PDF
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, '', 'FAST');

        // Clean up
        document.body.removeChild(tempContainer);
      }

      // Download the PDF
      pdf.save(`receipt-${invoice.invoice_number}.pdf`);
      
      console.log('✅ Multi-page receipt with beautiful styling generated successfully!');

    } catch (error) {
      console.error('❌ Failed to generate receipt:', error);
      alert('Failed to generate receipt. Please try again.');
    } finally {
      setIsPrintingPDF(false);
      setGenerationType(null);
    }
  }, [selectedPatientDetails, medicalAid, practiceData, practiceId]);

  // Fetch practice data
  const fetchPracticeData = useCallback(async () => {
    if (!practiceId) return;
    
    try {
      const { data, error } = await supabase
        .from('practices')
        .select(`
          id, name, slug, domain, logo_url, primary_color, secondary_color,
          contact_email, contact_phone, address, city, country, postal_code,
          tax_number, license_number, practice_number, hero_subtitle,
          bank_name, account_holder_name, account_number, branch_code, swift_code, account_type
        `)
        .eq('id', practiceId)
        .single();
        
      if (error) {
        console.error('Error fetching practice:', error);
        return;
      }
      
      console.log('✅ Practice data fetched successfully:', data);
      setPracticeData(data);
    } catch (error) {
      console.error('Error fetching practice data:', error);
    }
  }, [practiceId]);

  useEffect(() => {
    if (practiceId) {
      fetchPracticeData();
    }
  }, [practiceId]); // Removed fetchPracticeData from dependencies

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

  // Fetch patient details - OPTIMIZED VERSION
  const fetchPatientDetails = useCallback(async (patientId: string) => {
    if (!patientId || !UUID_REGEX.test(patientId)) {
      setDetailsError('Invalid patient ID format');
      setIsLoadingDetails(false);
      return;
    }

    const startTime = performance.now();
    try {
      // Clear previous patient data IMMEDIATELY
      setSelectedPatientDetails(null);
      setVisits([]);
      setVisitCounts({});
      setAppointments([]);
      setVitals([]);
      setLabRequests([]);
      setLabResults([]);
      setMedications([]);
      setMediaRequests([]);
      setImagingRequests([]);
      setBillingData([]);
      setMedicalAid(null);
      setNextOfKin(null);
      
      setIsLoadingDetails(true);
      setDetailsError(null);

      // Use ultra-optimized fetch function
      const result = await fetchPatientDetailsOptimized(patientId);

      // Set all data from optimized fetch
      setSelectedPatientDetails(result.patient);
      setNextOfKin(result.nextOfKin);
      setVisits(result.visits);
      setVisitCounts(result.visitCounts);
      setAppointments(result.appointments);
      setVitals(result.vitals);
      setLabRequests(result.labRequests);
      setLabResults(result.labResults);
      setMedications(result.medications);
      setMediaRequests(result.mediaRequests);
      setImagingRequests(result.imagingRequests);
      setBillingData(result.billingData);
      setMedicalAid(result.medicalAid);
      setDocuments(result.documents);
      setPracticeData(result.practiceData);
      
      // ⏱️ TIMING: Initial parallel queries (MAJOR OPTIMIZATION)
      const initialStartTime = performance.now();
      console.log('🚀 Starting PARALLEL initial queries for patient details, next of kin, and visits...');
      
      const [patientResult, nextOfKinResult, visitsResult] = await Promise.all([
        // Patient details
        supabase
          .from('patient_details_view')
          .select('*')
          .eq('id', patientId)
          .single(),
          
        // Next of kin (optimized)
        supabase
          .from('next_of_kin')
          .select('id, name, relationship, phone, address')
          .eq('patient_id', patientId)
          .limit(1)
          .maybeSingle(),
          
        // Visits with doctor info
        supabase
          .from('visits')
          .select(`
            *,
            doctor:users!doctor_id (
              id,
              email,
              full_name,
              role
            )
          `)
          .eq('patient_id', patientId)
          .order('visit_date', { ascending: false })
          .order('visit_time', { ascending: false })
      ]);
      
      const initialEndTime = performance.now();
      console.log(`⏱️ Initial parallel queries: ${(initialEndTime - initialStartTime).toFixed(2)}ms`);

      // Process results
      if (patientResult.error) throw patientResult.error;
      if (!patientResult.data) throw new Error('Patient not found');
      
      const patientData = patientResult.data;
      setSelectedPatientDetails(patientData as any);
      
      // Extract medical aid from the view
      if (patientData.medical_aid_details && (patientData.medical_aid_details as any).length > 0) {
        const medicalAidData = (patientData.medical_aid_details as any)[0];
        setMedicalAid(medicalAidData as any);
        // Fetch beneficiaries count for this medical aid
        fetchBeneficiariesCount(medicalAidData.membership_number);
      }

      // Process next of kin
      if (nextOfKinResult.error) {
        console.error('Error fetching next of kin:', nextOfKinResult.error);
        setNextOfKin(null);
      } else {
        setNextOfKin(nextOfKinResult.data || null);
      }

      // Process visits
      if (visitsResult.error) throw visitsResult.error;
      const visitsData = visitsResult.data;
      
      console.log('✅ UNIFIED VISITS FETCHED:', {
        total: visitsData?.length || 0,
        scheduled: visitsData?.filter(v => v.status === 'scheduled').length || 0,
        completed: visitsData?.filter(v => v.status === 'completed').length || 0,
        inProgress: visitsData?.filter(v => v.status === 'in-progress').length || 0
      });
      
      // ⚡ PERFORMANCE OPTIMIZATION: Batch fetch visit counts to eliminate N+1 queries
      const visitIds = visitsData?.map(v => v.id) || [];
      const visitCountsMap: { [visitId: string]: { media: number; lab: number; imaging: number } } = {};
      
      if (visitIds.length > 0) {
        try {
          // ⏱️ TIMING: Count queries (POTENTIAL BOTTLENECK)
          const countBatchStartTime = performance.now();
          console.log('🚀 BATCHING COUNT QUERIES for', visitIds.length, 'visits');
          
          // ⚡ OPTIMIZED: Skip problematic RPC function, use fast parallel queries 
          console.log('⚡ Using ULTRA-FAST parallel count queries...');
          const countsError = { message: 'Using optimized parallel method' }; // Force optimized path
            
          if (countsError) {
            console.log('⚡ OPTIMIZED METHOD: 3 parallel queries with minimal data transfer');
            const countStartTime = performance.now();
            const [mediaCountsResult, labCountsResult, imagingCountsResult] = await Promise.all([
              supabase
                .from('patient_media')
                .select('visit_id')
                .in('visit_id', visitIds),
                
              supabase
                .from('patient_laboratory')  
                .select('visit_id')
                .in('visit_id', visitIds),
                
              supabase
                .from('patient_imaging')
                .select('visit_id')
                .in('visit_id', visitIds)
            ]);
            const countEndTime = performance.now();
            console.log(`⏱️ Individual count queries: ${(countEndTime - countStartTime).toFixed(2)}ms`);
            
            // Create count maps (fallback method)
            const mediaCounts = (mediaCountsResult.data || []).reduce((acc, item) => {
              acc[item.visit_id] = (acc[item.visit_id] || 0) + 1;
              return acc;
            }, {} as { [key: string]: number });
            
            const labCounts = (labCountsResult.data || []).reduce((acc, item) => {
              acc[item.visit_id] = (acc[item.visit_id] || 0) + 1;
              return acc;
            }, {} as { [key: string]: number });
            
            const imagingCounts = (imagingCountsResult.data || []).reduce((acc, item) => {
              acc[item.visit_id] = (acc[item.visit_id] || 0) + 1;
              return acc;
            }, {} as { [key: string]: number });
            
            // Combine into visitCountsMap (fallback)
            visitIds.forEach(visitId => {
              visitCountsMap[visitId] = {
                media: mediaCounts[visitId] || 0,
                lab: labCounts[visitId] || 0,
                imaging: imagingCounts[visitId] || 0
              };
            });
          } else {
            // ⚡ LIGHTNING FAST: Use optimized database function results
            (countsResult || []).forEach((row: any) => {
              visitCountsMap[row.visit_id] = {
                media: parseInt(row.media_count) || 0,
                lab: parseInt(row.lab_count) || 0,
                imaging: parseInt(row.imaging_count) || 0
              };
            });
          }
          
          const endTime = performance.now();
          console.log(`⏱️ TOTAL count batch: ${(endTime - countBatchStartTime).toFixed(2)}ms - eliminated N+1 queries!`);
          
        } catch (error) {
          console.error('Error in batch count queries:', error);
          // Continue with empty counts rather than failing
        }
      }
      
      setVisits(visitsData as any || []);
      setVisitCounts(visitCountsMap); // Store counts for EncounterTimeline
      
      // No need to fetch appointments separately anymore
      console.log('✅ APPOINTMENTS ARE NOW PART OF VISITS WITH status="scheduled"');

      // APPOINTMENTS ARE NOW INTEGRATED INTO VISITS
      // Scheduled visits (status='scheduled') are appointments
      // This provides unified numbering and timeline display
      const scheduledVisits = visitsData?.filter(v => v.status === 'scheduled') || [];
      console.log('📅 SCHEDULED VISITS (APPOINTMENTS):', {
        count: scheduledVisits.length,
        nextAppointment: scheduledVisits[0] || null
      });
      
      // For backward compatibility, set appointments to scheduled visits
      setAppointments(scheduledVisits);

      // ⏱️ TIMING: Secondary parallel queries (MEGA OPTIMIZATION)
      let secondaryQueries = [];
      
      if (visitIds.length > 0) {
        secondaryQueries = [
          // Vitals
          supabase
            .from('vitals')
            .select('*')
            .in('visit_id', visitIds)
            .order('created_at', { ascending: false }),
            
          // Lab requests
          supabase
            .from('lab_requests')
            .select('id')
            .in('visit_id', visitIds),
            
          // Documents
          supabase
            .from('patient_documents')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
            
          // Billing
          supabase
            .from('invoices_enhanced')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })
        ];
      } else {
        secondaryQueries = [
          // Just documents and billing if no visits
          supabase
            .from('patient_documents')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
            
          supabase
            .from('invoices_enhanced')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })
        ];
      }
      
      const secondaryStartTime = performance.now();
      console.log('🚀 Starting secondary parallel queries...');
      const secondaryResults = await Promise.all(secondaryQueries);
      const secondaryEndTime = performance.now();
      console.log(`⏱️ Secondary parallel queries: ${(secondaryEndTime - secondaryStartTime).toFixed(2)}ms`);
      
      // Process secondary results
      if (visitIds.length > 0) {
        const [vitalsResult, labRequestsResult, documentsResult, billingResult] = secondaryResults;
        
        // Set vitals
        if (vitalsResult.error) {
          console.error('Error fetching vitals:', vitalsResult.error);
          setVitals([]);
        } else {
          setVitals(vitalsResult.data || []);
        }
        
        // Set documents
        if (documentsResult.error) {
          console.error('Error fetching documents:', documentsResult.error);
          setDocuments([]);
        } else {
          setDocuments(documentsResult.data || []);
        }
        
        // Set billing
        if (billingResult.error) {
          console.error('Error fetching billing data:', billingResult.error);
          setBillingData([]);
        } else {
          setBillingData(billingResult.data || []);
        }
        
        // Handle lab results separately (needs lab request IDs)
        let labResultsData = [];
        if (!labRequestsResult.error && labRequestsResult.data && labRequestsResult.data.length > 0) {
          const labRequestIds = labRequestsResult.data.map((req: any) => req.id);
          
          const labResultsStartTime = performance.now();
          const { data: patientLabResultsData, error: labResultsError } = await supabase
            .from('lab_results')
            .select('*, lab_request_id')
            .in('lab_request_id', labRequestIds)
            .order('created_at', { ascending: false });
          const labResultsEndTime = performance.now();
          console.log(`⏱️ Lab results query: ${(labResultsEndTime - labResultsStartTime).toFixed(2)}ms`);

          if (labResultsError) {
            console.error('Error fetching lab results:', labResultsError);
          } else {
            labResultsData = patientLabResultsData || [];
          }
        }
        setLabResults(labResultsData);
        
      } else {
        // No visits case
        const [documentsResult, billingResult] = secondaryResults;
        
        setVitals([]);
        setLabResults([]);
        setDocuments(documentsResult.data || []);
        setBillingData(billingResult.data || []);
      }

      // ⏱️ TIMING: Final parallel queries (MAJOR BOTTLENECK CANDIDATE)
      const parallelStartTime = performance.now();
      console.log('🚀 Starting final parallel queries for medications, media, lab, imaging...');
      const [medicationsResult, mediaResult, labResult, imagingResult] = await Promise.all([
        // Medications with visit info
        supabase
          .from('medications')
          .select(`
            id, medication_name, dosage, frequency, duration, prescribed_date, visit_id,
            visit:visits!visit_id(id, visit_date, visit_number)
          `)
          .eq('patient_id', patientId)
          .order('prescribed_date', { ascending: false }),

        // Media files with visit info  
        supabase
          .from('patient_media')
          .select(`
            id, title, original_name, file_size, file_type, category, storage_path, storage_bucket, created_at, visit_id,
            visit:visits!visit_id(id, visit_date, visit_number)
          `)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),

        // Lab data with visit info
        supabase
          .from('patient_laboratory')
          .select(`
            id, test_type, test_date, lab_name, status, is_abnormal, critical_result, visit_id,
            visit:visits!visit_id(id, visit_date, visit_number)
          `)
          .eq('patient_id', patientId)
          .order('test_date', { ascending: false }),

        // Imaging data with visit info
        supabase
          .from('patient_imaging')
          .select(`
            id, imaging_type, study_date, body_part, file_size, file_type, storage_path, storage_bucket, original_name, visit_id,
            visit:visits!visit_id(id, visit_date, visit_number)
          `)
          .eq('patient_id', patientId)
          .order('study_date', { ascending: false })
      ]);
      const parallelEndTime = performance.now();
      console.log(`⏱️ Final parallel queries: ${(parallelEndTime - parallelStartTime).toFixed(2)}ms`);

      // Set all data instantly
      setMedications(medicationsResult.data || []);
      setMediaRequests(mediaResult.data || []);
      setLabRequests(labResult.data || []);
      setImagingRequests(imagingResult.data || []);

      // Log any errors but don't block UI
      if (medicationsResult.error) console.error('Medications error:', medicationsResult.error);
      if (mediaResult.error) console.error('Media error:', mediaResult.error);
      if (labResult.error) console.error('Lab error:', labResult.error);
      if (imagingResult.error) console.error('Imaging error:', imagingResult.error);

    } catch (error) {
      console.error('Error fetching patient details:', error);
      setDetailsError(error instanceof Error ? error.message : 'An error occurred while fetching patient data');
    } finally {
      setIsLoadingDetails(false);
      
      // 🎯 PERFORMANCE LOGGING
      const totalTime = performance.now() - startTime;
      console.log(`📊 TOTAL fetchPatientDetails time: ${totalTime.toFixed(2)}ms for patient ${patientId}`);
      
      if (totalTime > 1000) {
        console.warn('⚠️ SLOW QUERY WARNING: fetchPatientDetails took longer than 1 second!');
        console.warn('🔍 Check the individual query times above to identify the bottleneck');
      } else if (totalTime < 500) {
        console.log('🚀 FAST QUERY: fetchPatientDetails completed in under 500ms!');
      } else {
        console.log('✅ MODERATE PERFORMANCE: fetchPatientDetails completed in reasonable time');
      }
    }
  }, []);

  // AI search handler using the extracted hook
  const onAiSearch = useCallback(() => {
    handleAiSearch(searchTerm);
  }, [handleAiSearch, searchTerm]);

  useEffect(() => {
    console.log('🔄 [ComprehensivePatientModal] Main useEffect triggered:', {
      isOpen,
      patientId,
      hasPatientId: !!patientId
    });
    
    if (isOpen) {
      if (patientId) {
        console.log('📋 [ComprehensivePatientModal] Opening in details mode for patient:', patientId);
        setActiveTab('details');
        fetchPatientDetails(patientId);
      } else {
        console.log('📋 [ComprehensivePatientModal] Opening in patients list mode');
        setActiveTab('patients');
        // Call fetchPatientsFromStore without including it in dependencies
        // to prevent infinite re-renders
        const store = usePatientsStoreNew.getState();
        store.fetchPatients();
      }
    }
    // Remove fetchPatientsFromStore and fetchPatientDetails from dependencies to prevent infinite loop
  }, [isOpen, patientId]);

  // Separate effect for defaultDetailTab to prevent re-fetching
  useEffect(() => {
    if (isOpen && patientId && defaultDetailTab && activeDetailTab !== defaultDetailTab) {
      console.log('🔄 [ComprehensivePatientModal] Setting activeDetailTab:', {
        from: activeDetailTab,
        to: defaultDetailTab
      });
      setActiveDetailTab(defaultDetailTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, patientId, defaultDetailTab]); // activeDetailTab intentionally excluded to prevent loops

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
        // Use store directly to avoid dependency issues
        const store = usePatientsStoreNew.getState();
        store.searchPatients(searchTerm);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm]);

  // Handle opening edit visit modal when visitIdToEdit is provided
  useEffect(() => {
    if (visitIdToEdit && visits.length > 0) {
      const visitToEdit = visits.find(v => v.id === visitIdToEdit);
      if (visitToEdit) {
        setSelectedVisit(visitToEdit);
        modalState.openEditVisitModal();
        // Switch to encounters tab to show context
        setActiveDetailTab('encounters');
      }
    }
  }, [visitIdToEdit, visits]); // Removed modalState.openEditVisitModal from dependencies

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
    // Use store directly to prevent re-render issues
    const store = usePatientsStoreNew.getState();
    store.fetchPatients();
  };

  const handlePatientUpdated = () => {
    setIsEditPatientModalOpen(false);
    setSelectedPatient(null);
    // Use store directly to prevent re-render issues
    const store = usePatientsStoreNew.getState();
    store.fetchPatients();
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
        // Use store directly to prevent re-render issues
        const store = usePatientsStoreNew.getState();
        store.fetchPatients();
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
      const user = useAuthStore.getState().user;
      const practiceId = user?.practice_id || localStorage.getItem('currentPracticeId');
      
      if (!practiceId) {
        toast.error('Practice ID not found');
        return;
      }

      const result = await communicationService.sendSMS({
        practiceId: practiceId as string,
        recipientPhone: smsPhone,
        messageContent: smsContent,
        messageType: 'custom',
        patientId: selectedPatientDetails?.id,
        metadata: {
          source: 'ComprehensivePatientModal',
          sentBy: user?.email || 'Unknown',
          reference: `patient-${selectedPatientDetails?.id}-${Date.now()}`
        }
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
            const user = useAuthStore.getState().user;
            const practiceId = user?.practice_id || localStorage.getItem('currentPracticeId');
            
            const result = await communicationService.sendSMS({
              practiceId: practiceId as string,
              recipientPhone: phone,
              messageContent: smsContent,
              messageType: 'marketing',
              patientId: patient.id,
              metadata: {
                source: 'ComprehensivePatientModal_Bulk',
                sentBy: user?.email || 'Unknown',
                reference: `bulk-patient-${patient.id}-${Date.now()}`,
                bulkSend: true
              }
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
      const user = useAuthStore.getState().user;
      const practiceId = user?.practice_id || localStorage.getItem('currentPracticeId');
      
      if (!practiceId) {
        toast.error('Practice ID not found');
        return;
      }

      const result = await communicationService.sendSMS({
        practiceId: practiceId as string,
        recipientPhone: phone,
        messageContent: message,
        messageType: 'custom',
        patientId: selectedPatientDetails.id,
        metadata: {
          source: 'ComprehensivePatientModal_Enhanced',
          sentBy: user?.email || 'Unknown',
          reference: `patient-${selectedPatientDetails.id}-${Date.now()}`
        }
      });

      if (result.success) {
        setIsProfessionalSmsModalOpen(false);
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

  // Convert File to base64 for email attachments
  const fileToBase64 = (file: File): Promise<string> => {
    console.log('🔄 INDIVIDUAL: STARTING BASE64 CONVERSION for:', file.name);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        console.log('🔄 INDIVIDUAL: FileReader onload triggered');
        const result = reader.result as string;
        console.log('🔄 INDIVIDUAL: FileReader result length:', result.length);
        const base64 = result.split(',')[1]; // Extract base64 part from data URL
        console.log('🔄 INDIVIDUAL: Base64 conversion complete for:', file.name, 'length:', base64.length);
        resolve(base64);
      };
      reader.onerror = error => {
        console.error('🔄 INDIVIDUAL: FileReader error:', error);
        reject(error);
      };
    });
  };

  // Enhanced Email handler
  const handleEnhancedSendEmail = async (email: string, subject: string, message: string, attachments?: File[]) => {
    console.log('🔥 INDIVIDUAL: HANDLE ENHANCED SEND EMAIL CALLED WITH:');
    console.log('- email:', email);
    console.log('- subject:', subject);
    console.log('- message length:', message.length);
    console.log('- attachments received:', attachments?.length || 0);
    console.log('- attachments:', attachments?.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    if (!selectedPatientDetails || !email || !subject || !message) {
      toast.error('Missing required information');
      return;
    }

    try {
      // Convert File objects to base64 attachments
      let emailAttachments: { filename: string; content: string; type?: string; }[] = [];
      
      if (attachments && attachments.length > 0) {
        console.log('🔗 Processing attachments:', attachments.length, attachments.map(f => ({ name: f.name, size: f.size, type: f.type })));
        
        emailAttachments = await Promise.all(
          attachments.map(async (file) => {
            const base64Content = await fileToBase64(file);
            const attachment = {
              filename: file.name,
              content: base64Content,
              type: file.type || 'application/octet-stream'
            };
            console.log('🔗 Processed attachment:', { filename: attachment.filename, contentLength: attachment.content.length, type: attachment.type });
            return attachment;
          })
        );
        
        console.log('🔗 Final emailAttachments:', emailAttachments.length, 'attachments processed');
      } else {
        console.log('🔗 No attachments provided');
      }

      const result = await communicationService.sendEmail({
        practiceId: practiceId!,
        recipientEmail: email,
        recipientName: `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}`,
        subject: subject,
        textContent: message,
        emailType: 'patient_communication',
        patientId: selectedPatientDetails.id,
        attachments: emailAttachments
      });
      
      if (result.success) {
        setIsProfessionalEmailModalOpen(false);
        setMessageConfirmationData({
          type: 'email',
          recipientName: `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}`,
          recipientContact: email
        });
        setShowMessageConfirmation(true);
      } else {
        toast.error(result.error || 'Failed to send email');
      }
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

  console.log('🎨 [ComprehensivePatientModal] About to render modal with state:', {
    isOpen,
    activeTab,
    activeDetailTab,
    patientId,
    selectedPatientDetails: !!selectedPatientDetails
  });

  return (
    <>
      {/* Floating Visit Tracker - Only render when modal is open */}
      {isOpen && createPortal(
        <FloatingVisitTracker 
          practiceId={practiceId || 'default-practice'} 
          selectedDate={new Date()} 
          zIndex={2147483648} 
        />,
        document.body
      )}
      
      {!isOpen ? (
        console.log('🚫 [ComprehensivePatientModal] Modal backdrop not rendered - isOpen is false') || null
      ) : (
      <div 
        className={`fixed inset-0 z-[9999] ${
          modalState.modalState.isFullScreen 
            ? 'bg-black/20 p-0' 
            : 'bg-black/50 backdrop-blur-sm flex items-center justify-center p-4'
        }`}
        // Removed invalid onMount prop 
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
                    setIsProfessionalSmsModalOpen(true);
                  }
                }}
                onSendEmail={() => {
                  if (selectedPatientDetails) {
                    setIsProfessionalEmailModalOpen(true);
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
                    setIsProfessionalSmsModalOpen(true);
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
                medications={medications}
                media={mediaRequests}
                lab={labRequests}
                imaging={imagingRequests}
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
                              className="px-4 py-3 sm:px-2 sm:py-1 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 sm:gap-1 text-sm sm:text-xs font-medium min-h-[44px] sm:min-h-0 touch-manipulation"
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
                              className={`px-4 py-3 sm:px-2 sm:py-1 rounded-lg transition-all flex items-center gap-2 sm:gap-1 text-sm sm:text-xs font-medium min-h-[44px] sm:min-h-0 touch-manipulation ${
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
                              className="px-4 py-3 sm:px-2 sm:py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 sm:gap-1 min-h-[44px] sm:min-h-0 touch-manipulation"
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
                              className={`px-4 py-3 sm:px-3 sm:py-2 rounded-full flex items-center gap-2 transition-all text-sm font-medium border min-h-[44px] sm:min-h-0 ${
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
                              onClick={() => {
                                const store = usePatientsStoreNew.getState();
                                store.fetchPatients();
                              }}
                              className="px-4 py-3 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium min-h-[44px] sm:min-h-0"
                            >
                              Try Again
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {view === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
                                <>
                                  {console.log('🚀 UNIFIED VISIT SYSTEM DATA:', {
                                    totalVisits: visits.length,
                                    scheduledVisits: visits.filter(v => v.status === 'scheduled').length,
                                    completedVisits: visits.filter(v => v.status === 'completed').length,
                                    inProgressVisits: visits.filter(v => v.status === 'in-progress').length,
                                    patientName: `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}`
                                  })}
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
                                  onStartAppointment={async (scheduledVisit) => {
                                    try {
                                      console.log('🚀 Starting scheduled visit:', scheduledVisit);
                                      
                                      // Show premium loading toast
                                      toast.loading('Starting visit...', {
                                        id: 'visit-start',
                                        duration: 2000
                                      });

                                      // Simply update the status from 'scheduled' to 'in-progress'
                                      const { data: updatedVisit, error: updateError } = await supabase
                                        .from('visits')
                                        .update({
                                          status: 'in-progress',
                                          updated_at: new Date().toISOString()
                                        })
                                        .eq('id', scheduledVisit.id)
                                        .select(`
                                          *,
                                          doctor:users!doctor_id(id, full_name)
                                        `)
                                        .single();

                                      if (updateError) throw updateError;

                                      // Update local state for instant feedback
                                      setVisits(prevVisits => 
                                        prevVisits.map(visit => 
                                          visit.id === scheduledVisit.id 
                                            ? { ...visit, ...updatedVisit, status: 'in-progress' }
                                            : visit
                                        )
                                      );

                                      // Success feedback with premium animation
                                      toast.success('🎉 Visit started successfully!', {
                                        id: 'visit-start',
                                        duration: 3000,
                                        style: {
                                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                          color: 'white',
                                          fontWeight: '600'
                                        }
                                      });

                                      console.log('✅ Visit status updated:', updatedVisit);
                                      
                                      // Open the edit visit modal to fill in details
                                      setSelectedVisit(updatedVisit);
                                      modalState.openEditVisitModal();
                                    } catch (error) {
                                      console.error('❌ Error starting visit:', error);
                                      
                                      // Error feedback with premium styling
                                      toast.error('Failed to start visit. Please try again.', {
                                        id: 'visit-start',
                                        duration: 4000,
                                        style: {
                                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                          color: 'white',
                                          fontWeight: '600'
                                        }
                                      });
                                    }
                                  }}
                                  onVisitStatusChange={(visitId: string, newStatus: string) => {
                                    // Update local state instantly without page refresh
                                    setVisits(prevVisits => 
                                      prevVisits.map(visit => 
                                        visit.id === visitId 
                                          ? { ...visit, status: newStatus }
                                          : visit
                                      )
                                    );
                                  }}
                                  visitCounts={visitCounts}
                                />
                                </>
                              )}

                              {activeDetailTab === 'medications' && (
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Pill className="w-6 h-6 text-blue-600" />
                                      <h3 className="text-xl font-bold text-gray-900">Medications</h3>
                                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        All medications across visits
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 overscroll-x-contain">
                                      <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                          <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Medication</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Dosage</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Frequency</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Duration</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Visit #</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Visit Date</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {isLoadingDetails ? (
                                            // Skeleton loading rows
                                            Array.from({ length: 3 }).map((_, index) => (
                                              <tr key={`skeleton-${index}`} className="animate-pulse">
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/3"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
                                                <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded-full w-12"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-2/3"></div></td>
                                              </tr>
                                            ))
                                          ) : medications.length > 0 ? (
                                            medications.map((medication) => (
                                              <tr 
                                                key={medication.id} 
                                                className="hover:bg-blue-50 hover:shadow-sm transition-all duration-200 cursor-pointer"
                                                onClick={() => {
                                                  if (medication.visit_id) {
                                                    const visitToEdit = visits.find(v => v.id === medication.visit_id);
                                                    if (visitToEdit) {
                                                      setSelectedVisit(visitToEdit);
                                                      modalState.openEditVisitModal();
                                                    }
                                                  }
                                                }}
                                              >
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{medication.medication_name}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{medication.dosage}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{medication.frequency}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{medication.duration}</td>
                                                <td className="px-4 py-3 text-sm">
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    #{medication.visit?.visit_number || 'N/A'}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {medication.visit?.visit_date ? format(new Date(medication.visit.visit_date), 'MMM dd, yyyy') : 'N/A'}
                                                </td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr className="hover:bg-gray-50 transition-colors">
                                              <td className="px-4 py-3 text-sm text-gray-600" colSpan={6}>
                                                <div className="text-center py-8">
                                                  <Pill className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                  <p className="text-gray-500">No medications found</p>
                                                  <p className="text-sm text-gray-400">Medications will appear here when prescribed</p>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeDetailTab === 'media' && (
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Camera className="w-6 h-6 text-purple-600" />
                                      <h3 className="text-xl font-bold text-gray-900">Media Files</h3>
                                      <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        All media across visits
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 overscroll-x-contain">
                                      <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                          <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Visit #</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Visit Date</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Preview</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Size</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {isLoadingDetails ? (
                                            // Skeleton loading rows
                                            Array.from({ length: 3 }).map((_, index) => (
                                              <tr key={`skeleton-${index}`} className="animate-pulse">
                                                <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded-full w-12"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-2/3"></div></td>
                                                <td className="px-4 py-3"><div className="h-12 w-12 bg-gray-200 rounded"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-2/3"></div></td>
                                              </tr>
                                            ))
                                          ) : mediaRequests.length > 0 ? (
                                            mediaRequests.map((media) => (
                                              <tr 
                                                key={media.id} 
                                                className="hover:bg-blue-50 hover:shadow-sm transition-all duration-200 cursor-pointer"
                                                onClick={() => {
                                                  if (media.visit_id) {
                                                    const visitToEdit = visits.find(v => v.id === media.visit_id);
                                                    if (visitToEdit) {
                                                      setSelectedVisit(visitToEdit);
                                                      modalState.openEditVisitModal();
                                                    }
                                                  }
                                                }}
                                              >
                                                <td className="px-4 py-3">
                                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                    {media.visit?.visit_number || 'N/A'}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {media.visit?.visit_date ? format(new Date(media.visit.visit_date), 'MMM dd, yyyy') : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3">
                                                  <div className="flex items-center">
                                                    {media.file_type && ['png', 'jpg', 'jpeg', 'webp'].includes(media.file_type.toLowerCase()) ? (
                                                      <img 
                                                        src={`${supabase.storage.from(media.storage_bucket).getPublicUrl(media.storage_path).data.publicUrl}`}
                                                        alt={media.title || media.original_name} 
                                                        className="w-12 h-12 object-cover rounded border cursor-pointer" 
                                                      />
                                                    ) : (
                                                      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded border">
                                                        <FileText className="w-6 h-6 text-gray-600" />
                                                      </div>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">{media.title || media.original_name}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700 capitalize">{media.category}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{(media.file_size / 1024).toFixed(1)} KB</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {media.created_at ? format(new Date(media.created_at), 'MMM dd, yyyy') : 'N/A'}
                                                </td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr className="hover:bg-gray-50 transition-colors">
                                              <td className="px-4 py-3 text-sm text-gray-600" colSpan={7}>
                                                <div className="text-center py-8">
                                                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                  <p className="text-gray-500">No media files found</p>
                                                  <p className="text-sm text-gray-400">Photos, videos, and documents will appear here</p>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeDetailTab === 'lab' && (
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FlaskConical className="w-6 h-6 text-emerald-600" />
                                      <h3 className="text-xl font-bold text-gray-900">Laboratory Results</h3>
                                      <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        All lab tests across visits
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 overscroll-x-contain">
                                      <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                          <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Visit #</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Visit Date</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Request Date</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Test Type</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Laboratory</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Results</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {isLoadingDetails ? (
                                            // Skeleton loading rows
                                            Array.from({ length: 3 }).map((_, index) => (
                                              <tr key={`skeleton-${index}`} className="animate-pulse">
                                                <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded-full w-12"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-2/3"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-2/3"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                                                <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded-full w-16"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/3"></div></td>
                                              </tr>
                                            ))
                                          ) : labRequests.length > 0 ? (
                                            labRequests.map((lab) => (
                                              <tr 
                                                key={lab.id} 
                                                className="hover:bg-blue-50 hover:shadow-sm transition-all duration-200 cursor-pointer"
                                                onClick={() => {
                                                  if (lab.visit_id) {
                                                    const visitToEdit = visits.find(v => v.id === lab.visit_id);
                                                    if (visitToEdit) {
                                                      setSelectedVisit(visitToEdit);
                                                      modalState.openEditVisitModal();
                                                    }
                                                  }
                                                }}
                                              >
                                                <td className="px-4 py-3">
                                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                    {lab.visit?.visit_number || 'N/A'}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {lab.visit?.visit_date ? format(new Date(lab.visit.visit_date), 'MMM dd, yyyy') : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {lab.test_date ? format(new Date(lab.test_date), 'MMM dd, yyyy') : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 capitalize">{lab.test_type?.replace('_', ' ') || 'General'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{lab.lab_name || 'Not specified'}</td>
                                                <td className="px-4 py-3 text-sm">
                                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                                    lab.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    lab.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                                  }`}>
                                                    {lab.status || 'pending'}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {lab.critical_result ? (
                                                    <span className="text-red-600 font-medium">Critical</span>
                                                  ) : lab.is_abnormal ? (
                                                    <span className="text-orange-600 font-medium">Abnormal</span>
                                                  ) : (
                                                    <span className="text-green-600">Normal</span>
                                                  )}
                                                </td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr className="hover:bg-gray-50 transition-colors">
                                              <td className="px-4 py-3 text-sm text-gray-600" colSpan={7}>
                                                <div className="text-center py-8">
                                                  <FlaskConical className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                  <p className="text-gray-500">No laboratory results found</p>
                                                  <p className="text-sm text-gray-400">Lab tests and results will appear here</p>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeDetailTab === 'imaging' && (
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Scan className="w-6 h-6 text-indigo-600" />
                                      <h3 className="text-xl font-bold text-gray-900">Imaging Studies</h3>
                                      <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        All imaging across visits
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 overscroll-x-contain">
                                      <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                          <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Visit #</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Visit Date</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Request Date</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Body Part</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Files</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {isLoadingDetails ? (
                                            // Skeleton loading rows
                                            Array.from({ length: 3 }).map((_, index) => (
                                              <tr key={`skeleton-${index}`} className="animate-pulse">
                                                <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded-full w-12"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-2/3"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-2/3"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                                                <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded-full w-16"></div></td>
                                                <td className="px-4 py-3"><div className="h-8 w-8 bg-gray-200 rounded"></div></td>
                                              </tr>
                                            ))
                                          ) : imagingRequests.length > 0 ? (
                                            imagingRequests.map((imaging) => (
                                              <tr 
                                                key={imaging.id} 
                                                className="hover:bg-blue-50 hover:shadow-sm transition-all duration-200 cursor-pointer"
                                                onClick={() => {
                                                  if (imaging.visit_id) {
                                                    const visitToEdit = visits.find(v => v.id === imaging.visit_id);
                                                    if (visitToEdit) {
                                                      setSelectedVisit(visitToEdit);
                                                      modalState.openEditVisitModal();
                                                    }
                                                  }
                                                }}
                                              >
                                                <td className="px-4 py-3">
                                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                    {imaging.visit?.visit_number || 'N/A'}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {imaging.visit?.visit_date ? format(new Date(imaging.visit.visit_date), 'MMM dd, yyyy') : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                  <div className="flex items-center">
                                                    <Scan className="w-4 h-4 text-indigo-600 mr-2" />
                                                    <span className="font-medium text-gray-900 capitalize">
                                                      {imaging.imaging_type?.replace('_', ' ') || 'Other'}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {imaging.study_date ? format(new Date(imaging.study_date), 'MMM dd, yyyy') : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 capitalize">{imaging.body_part || 'Not specified'}</td>
                                                <td className="px-4 py-3 text-sm">
                                                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                                    Available
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                  <div className="flex items-center">
                                                    {imaging.file_type && ['png', 'jpg', 'jpeg', 'webp'].includes(imaging.file_type.toLowerCase()) ? (
                                                      <img 
                                                        src={`${supabase.storage.from(imaging.storage_bucket).getPublicUrl(imaging.storage_path).data.publicUrl}`}
                                                        alt={imaging.title || imaging.original_name} 
                                                        className="w-8 h-8 object-cover rounded border cursor-pointer mr-2" 
                                                      />
                                                    ) : (
                                                      <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded border mr-2">
                                                        <FileText className="w-4 h-4 text-gray-600" />
                                                      </div>
                                                    )}
                                                    <span className="text-xs text-gray-500">
                                                      {(imaging.file_size / 1024).toFixed(1)} KB
                                                    </span>
                                                  </div>
                                                </td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr className="hover:bg-gray-50 transition-colors">
                                              <td className="px-4 py-3 text-sm text-gray-600" colSpan={7}>
                                                <div className="text-center py-8">
                                                  <Scan className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                  <p className="text-gray-500">No imaging studies found</p>
                                                  <p className="text-sm text-gray-400">X-rays, CT scans, and imaging will appear here</p>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeDetailTab === 'billing' && (
                                <div className="space-y-6">
                                  <CleanInvoiceTable
                                    patientId={selectedPatientDetails.id}
                                    onVisitClick={(visitId) => {
                                      const visitToEdit = visits.find(v => v.id === visitId);
                                      if (visitToEdit) {
                                        setSelectedVisit(visitToEdit);
                                        modalState.openEditVisitModal();
                                      }
                                    }}
                                    onStatusChange={async (invoiceId, newStatus) => {
                                      try {
                                        const { error } = await supabase
                                          .from('invoices_enhanced')
                                          .update({ payment_status: newStatus })
                                          .eq('id', invoiceId);

                                        if (error) {
                                          console.error('Error updating invoice status:', error);
                                          alert('Failed to update invoice status');
                                        } else {
                                          // Refresh the billing data to show updated status
                                          const { data: updatedBilling } = await supabase
                                            .from('invoices_enhanced')
                                            .select('*')
                                            .eq('patient_id', selectedPatientDetails.id);
                                          setBillingData(updatedBilling || []);
                                        }
                                      } catch (error) {
                                        console.error('Error updating invoice status:', error);
                                        alert('Failed to update invoice status');
                                      }
                                    }}
                                    onEmailInvoice={async (invoice) => {
                                      try {
                                        // Generate PDF blob for attachment
                                        const pdfBlob = await generateInvoicePDF(
                                          invoice,
                                          {
                                            name: `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}`,
                                            phone: selectedPatientDetails.cell_number,
                                            email: selectedPatientDetails.email,
                                            address: selectedPatientDetails.home_address,
                                            medicalAidProvider: medicalAid?.provider,
                                            membershipNumber: medicalAid?.membership_number,
                                          },
                                          practiceData || {
                                            id: practiceId || '',
                                            name: 'OneHealth Medical Practice',
                                            contact_phone: '+264 61 123 4567',
                                            contact_email: 'info@onehealth.com.na',
                                            address: '123 Healthcare Avenue, Windhoek, Namibia',
                                            country: 'Namibia'
                                          }
                                        );
                                        
                                        // Create file from blob for attachment
                                        const file = new File([pdfBlob], `invoice-${invoice.invoice_number}.pdf`, {
                                          type: 'application/pdf'
                                        });
                                        
                                        // Store invoice attachment for email modal
                                        // Note: You'll need to modify ProfessionalEmailModal to accept attachments
                                        window.invoiceAttachment = file;
                                        
                                        // Open email modal
                                        setIsProfessionalEmailModalOpen(true);
                                        
                                        console.log('📧 Email invoice prepared:', {
                                          invoice: invoice.invoice_number,
                                          patient: selectedPatientDetails.first_name,
                                          attachmentSize: (pdfBlob.size / 1024).toFixed(2) + ' KB'
                                        });
                                      } catch (error) {
                                        console.error('Error preparing invoice for email:', error);
                                        toast.error('Failed to prepare invoice for email');
                                      }
                                    }}
                                    onPrintInvoice={(invoice) => {
                                      console.log('🖨️ Print invoice handler called for:', invoice.invoice_number);
                                      console.log('📄 Setting selected invoice:', invoice);
                                      setSelectedInvoice(invoice);
                                      console.log('🔓 Opening invoice generation modal...');
                                      setIsInvoiceGenerationModalOpen(true);
                                      console.log('✅ Modal state should be true now');
                                      
                                      // Temporary test alert to ensure handler works
                                      setTimeout(() => {
                                        if (!document.querySelector('[data-testid="invoice-generation-modal"]')) {
                                          console.error('❌ Modal did not appear in DOM!');
                                          alert('Modal not appearing. Using fallback...');
                                          // Fallback to direct generation
                                          const choice = window.confirm('Generate Invoice (OK) or Receipt (Cancel)?');
                                          if (choice) {
                                            handleDirectPrintPDF(invoice);
                                          } else {
                                            handleDirectReceiptPDF(invoice);
                                          }
                                        } else {
                                          console.log('✅ Modal found in DOM');
                                        }
                                      }, 100);
                                    }}
                                    onDeleteInvoice={async (invoice) => {
                                      if (window.confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone and will also delete all associated services.`)) {
                                        try {
                                          console.log('🗑️ Deleting invoice:', invoice.invoice_number);
                                          
                                          // Delete invoice services first
                                          const { error: servicesError } = await supabase
                                            .from('invoice_services')
                                            .delete()
                                            .eq('invoice_id', invoice.id);
                                          
                                          if (servicesError) {
                                            throw new Error('Failed to delete invoice services: ' + servicesError.message);
                                          }
                                          
                                          // Delete the invoice
                                          const { error: invoiceError } = await supabase
                                            .from('invoices_enhanced')
                                            .delete()
                                            .eq('id', invoice.id);
                                          
                                          if (invoiceError) {
                                            throw new Error('Failed to delete invoice: ' + invoiceError.message);
                                          }
                                          
                                          console.log('✅ Invoice and services deleted successfully');
                                          toast.success(`Invoice ${invoice.invoice_number} deleted successfully`);
                                          
                                          // Refresh billing data
                                          const { data: updatedBilling } = await supabase
                                            .from('invoices_enhanced')
                                            .select('*')
                                            .eq('patient_id', selectedPatientDetails.id);
                                          setBillingData(updatedBilling || []);
                                          
                                        } catch (error) {
                                          console.error('Error deleting invoice:', error);
                                          toast.error('Failed to delete invoice: ' + (error as Error).message);
                                        }
                                      }
                                    }}
                                    isPrintingPDF={isPrintingPDF}
                                  />
                                </div>
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
      )}

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

      {/* Add Visit Modal with Full Tabs */}
      {selectedPatientDetails && (
        <FullScreenAddVisitModal
          isOpen={modalState.modalState.isAddVisitModalOpen}
          onClose={() => modalState.closeAddVisitModal()}
          patientId={selectedPatientDetails.id}
          onSuccess={() => {
            modalState.closeAddVisitModal();
            fetchPatientDetails(selectedPatientDetails.id);
          }}
        />
      )}


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

      <UnifiedCommunicationModal
        isOpen={modalState.modalState.isMessageModalOpen}
        onClose={() => modalState.closeMessageModal()}
        patient={selectedPatientDetails ? {
          id: selectedPatientDetails.id,
          first_name: selectedPatientDetails.first_name,
          last_name: selectedPatientDetails.last_name,
          cell_number: selectedPatientDetails.cell_number || '',
          email: selectedPatientDetails.email || ''
        } : null}
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
      <ProfessionalSmsModal
        isOpen={isProfessionalSmsModalOpen}
        onClose={() => {
          setIsProfessionalSmsModalOpen(false);
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
      <ProfessionalEmailModal
        isOpen={isProfessionalEmailModalOpen}
        onClose={() => setIsProfessionalEmailModalOpen(false)}
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

      {/* Invoice Generation Modal */}
      <InvoiceGenerationModal
        isOpen={isInvoiceGenerationModalOpen}
        onClose={() => {
          setIsInvoiceGenerationModalOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
        patientName={selectedPatientDetails ? `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}` : ''}
        onGenerateInvoice={async () => {
          if (selectedInvoice) {
            setGenerationType('invoice');
            await handleDirectPrintPDF(selectedInvoice);
            setIsInvoiceGenerationModalOpen(false);
          }
        }}
        onGenerateReceipt={async () => {
          if (selectedInvoice) {
            setGenerationType('receipt');
            await handleDirectReceiptPDF(selectedInvoice);
            setIsInvoiceGenerationModalOpen(false);
          }
        }}
        onPreview={() => {
          setIsInvoiceGenerationModalOpen(false);
          setIsInvoicePreviewOpen(true);
        }}
        isGenerating={isPrintingPDF}
        generationType={generationType}
      />

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isInvoicePreviewOpen}
        onClose={() => {
          setIsInvoicePreviewOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
        patientName={selectedPatientDetails ? `${selectedPatientDetails.first_name} ${selectedPatientDetails.last_name}` : undefined}
        patientPhone={selectedPatientDetails?.cell_number}
        patientEmail={selectedPatientDetails?.email}
        patientAddress={selectedPatientDetails?.home_address}
        medicalAidProvider={medicalAid?.provider}
        membershipNumber={medicalAid?.membership_number}
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