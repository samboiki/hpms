import React, { useState, useEffect, useMemo, useRef } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { 
  Save,
  Loader2,
  Microscope,
  ChevronDown,
  Film,
  ImageIcon,
  Upload,
  FileText,
  Activity,
  Pill,
  Camera,
  Grid,
  List,
  Filter,
  Weight,
  Thermometer,
  AlertCircle,
  Stethoscope,
  ClipboardList,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  Bot,
  Trash2,
  Edit3,
  Sunset,
  Clock,
  ChevronUp,
  Receipt,
  CheckCircle2,
  Plus,
  Minus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ServiceSelection } from '../../types/billing';
import { findInvoiceLineProblems, invoiceService } from '../../services/invoiceService';
import { medicationIssues, useOneSaveAtATime } from './visitSave';
import { takeMedicineToEdit } from './medicineEdit';
import { loadPracticeTariffRows } from '../../services/practiceTariffService';
import { computeLine, normalizeMultiplyRule } from '../../utils/billing/pricing';
import { formatNad, nadParts } from '../../utils/billing/money';
import { formatServiceDate, toDateKey, todayKey } from '../../utils/billing/dates';
import {
  billableVisitTariffs,
  buildInfectionControlLine,
  buildMaterialFactorLine,
  buildTariffLine,
  changeLineQuantity,
  fundPricingNotice,
  priceForPatient,
  quantityControls,
  tariffLineInput,
  withDisciplineRules
} from './visitBillingLines';
import { loadPatientHasMedicalAid } from './patientMedicalAid';
import { useFundPricing } from './useFundPricing';
import BillingLineDetails, { type LineDetailChanges } from './BillingLineDetails';
import InvoiceBillingSummary from './InvoiceBillingSummary';
import { useVisitBilling } from './useVisitBilling';
import { useVisitClaimDetails } from './useVisitClaimDetails';
import VisitClaimDetailsCard from './VisitClaimDetailsCard';
import { useVisitPayer } from './useVisitPayer';
import VisitPayerCard from './VisitPayerCard';
import { useCodeRulesOnVisit } from './useCodeRulesOnVisit';
import { offerVisitRecalls } from './recallOffer';
import { InvoiceAndPayButton, VisitTakePayment } from './VisitTakePayment';
import { useInvoiceFlagCheck } from './InvoiceFlagCheck';
import { AccountFlagBadges } from '../finance/debtors/AccountFlagBadges';
import { canInvoiceAndTakePayment } from '../../utils/billing/invoiceRights';
import { INFECTION_CONTROL_CODE, MATERIAL_FACTOR_CODE, followsDentistSchedule, isDentalPractice, isRestorationCode } from '../../utils/billing/tariffRules';
import BundleMenu from '../quotes/BundleMenu';
import { VisitBillingExtras } from '../billingExtras/VisitBillingExtras';
import VisitServiceSelector from '../billing/VisitServiceSelector';
import TeethBillingPanel from '../dental/TeethBillingPanel';
import ToothPickerDialog from '../dental/ToothPickerDialog';
import FileUploadComponent from '../uploads/FileUploadComponent';
import FileDisplayComponent from '../uploads/FileDisplayComponent';
import MediaUploadWrapper from '../uploads/MediaUploadWrapper';
import LabResultsTable from '../requests/LabResultsTable';
import ImagingTabContentSimple from '../requests/ImagingTabContentSimple';
import LeaveFormTab from './LeaveFormTab';
import HandoffCard from './HandoffCard';
import { DiagnosisToProblems } from '../patients/safety/DiagnosisToProblems';
import Icd10DiagnosisSearch from '../billing/Icd10DiagnosisSearch';
import { useMedicineAllergyCheck } from '../patients/safety/useMedicineAllergyCheck';
import { PremiumInput, PremiumTextarea, PremiumSelect } from '../ui/PremiumInput';
import { documentGenerationService } from '../../services/documentGenerationService';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { toast } from 'react-hot-toast';
import { PrevisitAnswersCard } from '../previsit/PrevisitAnswersCard';
import { VisitDrawingsSection } from '../drawings/VisitDrawingsSection';

interface EditVisitFormData {
  visit_type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  doctor_id?: string;
  visit_date: Date;
  visit_time: string;
  chief_complaint: string;
  diagnosis: string;
  treatment_plan: string;
  prescription?: string;
  follow_up_required: boolean;
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
    oxygen_saturation?: number;
  };
  selectedServices: ServiceSelection[];
  generateInvoice: boolean;
}

interface Props {
  patientId: string;
  appointmentId?: string;
  activeTab: string;
  /** Lets a refused save show the tab that holds the problem (the Billing tab for a line without its tooth) */
  onTabChange?: (tab: string) => void;
  onSuccess: () => void;
  onCancel: () => void;
  selectedServices?: ServiceSelection[];
  onSelectedServicesChange?: (services: ServiceSelection[]) => void;
}

interface Doctor {
  id: string;
  full_name: string;
  role: string;
}

// Professional Visit Type Dropdown
const ProfessionalDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: string }[];
  placeholder?: string;
  hasIcon?: boolean;
}> = ({ value, onChange, options, placeholder, hasIcon = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-gray-100 border-0 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-left flex items-center justify-between h-[60px] ${hasIcon ? 'pl-10' : ''}`}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Icon icon="solar:alt-arrow-down-bold-duotone" className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-amber-200 rounded-lg shadow-lg z-10">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full p-3 text-left hover:bg-amber-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AddVisitTabs: React.FC<Props> = ({ 
  patientId,
  appointmentId,
  activeTab,
  onTabChange,
  onSuccess,
  onCancel,
  selectedServices: externalSelectedServices,
  onSelectedServicesChange
}) => {
  const user = useAuthStore((s) => s.user);
  const { practiceId: contextPracticeId } = usePractice();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [internalSelectedServices, setInternalSelectedServices] = useState<ServiceSelection[]>([]);
  
  // Doctor selection state
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentDoctor, setAppointmentDoctor] = useState<string | null>(null);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [isVisitTypeModalOpen, setIsVisitTypeModalOpen] = useState(false);
  
  // Add refresh triggers for file displays
  const [mediaRefreshTrigger, setMediaRefreshTrigger] = useState(0);
  
  // Use external services if provided, otherwise use internal state
  const selectedServices = externalSelectedServices || internalSelectedServices;
  const setSelectedServices = onSelectedServicesChange || setInternalSelectedServices;
  
  // View mode states
  const [labViewMode, setLabViewMode] = useState<'grid' | 'list'>('grid');
  const [imagingViewMode, setImagingViewMode] = useState<'grid' | 'list'>('grid');
  const [mediaViewMode, setMediaViewMode] = useState<'grid' | 'list'>('grid');
  
  // Drag states
  const [labDragging, setLabDragging] = useState(false);
  const [imagingDragging, setImagingDragging] = useState(false);
  const [mediaDragging, setMediaDragging] = useState(false);
  
  // Service selection states (the tooth picker keeps the teeth it is choosing)
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [showToothModal, setShowToothModal] = useState(false);
  const [selectedTariff, setSelectedTariff] = useState<any>(null);
  const [serviceQuantity, setServiceQuantity] = useState(1);
  // Every tariff row of the practice type; billableTariffs (below) is what may be billed
  const [availableTariffs, setAvailableTariffs] = useState<any[]>([]);
  const [serviceUsageStats, setServiceUsageStats] = useState<{[key: string]: number}>({});
  const [practiceId, setPracticeId] = useState<string>('');
  // practices.practice_type: decides the tariff list and whether the dental rules (8109, 8346, teeth) apply
  const [practiceType, setPracticeType] = useState<string | null>(null);
  const [newVisitId, setNewVisitId] = useState<string>('');
  // "Invoice and take payment": the invoice just created, paid over this screen before it closes
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  // From the patient's medical aid record (null until read or when it can't be read)
  const [patientHasMedicalAid, setPatientHasMedicalAid] = useState<boolean | null>(null);

  // Date picker modal states
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(() => {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0');
  });
  const [selectedMinute, setSelectedMinute] = useState(() => {
    const now = new Date();
    return now.getMinutes().toString().padStart(2, '0');
  });
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Medications state
  const [medications, setMedications] = useState<any[]>([]);
  const [newMedication, setNewMedication] = useState({
    medication_name: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: ''
  });
  // Checks each medicine against the patient's recorded allergies before it is added
  const allergyCheck = useMedicineAllergyCheck({ patientId, practiceId: user?.practice_id, visitId: newVisitId || null });

  // Function to refresh medications (for new visit, just reset to empty)
  const refreshMedications = async () => {
    console.log('🔄 Refreshing medications for new visit');
    setMedications([]);
    console.log('✅ Medications reset for new visit');
  };

  // Medication modal states
  const [isDosageModalOpen, setIsDosageModalOpen] = useState(false);
  const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState(false);
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<EditVisitFormData>({
    defaultValues: {
      visit_type: 'consultation',
      visit_date: new Date(),
      visit_time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      chief_complaint: '',
      diagnosis: '',
      treatment_plan: '',
      prescription: '',
      follow_up_required: false,
      follow_up_date: '',
      notes: '',
      vitals: {},
      selectedServices: [],
      // A visit with billing lines is invoiced when it is saved, unless staff switch this off (parity D1)
      generateInvoice: true
    }
  });

  // What can be billed: tariffs active and in effect on the visit date, one version per code. The 8109
  // and 8346 lookups use this list too, so they find the current tariff rather than the first row.
  // Priced for the patient: the fund's own price where its schedule has the code, otherwise the practice tariff.
  // Nothing is priced until the patient's fund is known, so a medical aid patient never gets the wrong schedule.
  const visitDate = watch('visit_date');
  const visitDateKey = toDateKey(visitDate) ?? todayKey();
  // Who treated: new lines are priced at that practitioner's own rate when they have one (parity D31)
  const visitPractitionerId = appointmentDoctor || watch('doctor_id') || null;
  const fundPricing = useFundPricing({ practiceId: practiceId || null, practiceType, patientId, practitionerId: visitPractitionerId });
  const isDental = isDentalPractice(practiceType);
  const billingBlocked =
    fundPricing.status !== 'ready' ? "Loading the patient's medical aid prices. Try again in a moment." : fundPricing.blockMessage;
  const billingNotice = billingBlocked ?? fundPricingNotice(fundPricing.status === 'ready' ? fundPricing.pricing : null, visitDateKey);
  const billableTariffs = useMemo(
    () =>
      priceForPatient(
        withDisciplineRules(billableVisitTariffs(availableTariffs, visitDateKey), practiceType),
        visitDateKey,
        fundPricing.status === 'ready' ? fundPricing.pricing : null
      ),
    [availableTariffs, visitDateKey, practiceType, fundPricing]
  );

  // Who treated, who pays what (co-payment) and services already billed to the patient (Billing tab)
  const billing = useVisitBilling({
    services: selectedServices,
    practiceId: contextPracticeId || practiceId || null,
    patientId,
    visitId: null,
    visitDateKey,
    visitPractitionerId,
    hasMedicalAid: patientHasMedicalAid === true,
    fund: fundPricing.status === 'ready' ? fundPricing.pricing.fund : null,
    // A line's ICD-10 codes are chosen by a person (the usual code and the diagnosis's codes are only offered); a changed fee is recorded
    practiceType,
    diagnosis: watch('diagnosis'),
    tariffs: billableTariffs,
    user,
    // Each practitioner's own practice number and rate: the lines follow the visit practitioner's rate (D31)
    practitionerBilling: fundPricing.practitionerBilling,
    onServicesChange: setSelectedServices
  });
  // The visit's referral, hospital stay and place of service (claim fields 25, 30, 42-44), saved once the visit exists
  const claimDetails = useVisitClaimDetails(null);
  // Who pays (parity A14, A19): the patient, a company account or an injury case; saved once the visit exists
  const visitPayer = useVisitPayer({ practiceId: contextPracticeId || practiceId || null, patientId, visitId: null });
  // The practice's rules per code: linked codes come with a code, a default place of service, each line's notices
  const codeRules = useCodeRulesOnVisit({
    ready: !isLoading,
    services: selectedServices,
    setServices: setSelectedServices,
    tariffs: billableTariffs,
    hasMedicalAid: patientHasMedicalAid === true,
    practiceType,
    lineAuthorisations: billing.lineAuthorisations,
    claimDetails
  });
  // Account flags checked when the visit is invoiced: cash only (confirm), credit limit (administrators only)
  const invoiceFlags = useInvoiceFlagCheck({ patientId, practiceId: contextPracticeId || practiceId || null, role: user?.role ?? null });
  const changeLineDetails = (serviceId: string, changes: LineDetailChanges) => {
    const updated = billing.withLineDetails(serviceId, changes);
    setSelectedServices(updated);
    if (onSelectedServicesChange) onSelectedServicesChange(updated);
  };

  // Calculate BMI when height or weight changes
  const weight = watch('vitals.weight');
  const height = watch('vitals.height');

  useEffect(() => {
    if (weight && height && height > 0) {
      const heightInMeters = height / 100;
      const bmi = weight / (heightInMeters * heightInMeters);
      setValue('vitals.bmi', Math.round(bmi * 10) / 10);
    }
  }, [weight, height, setValue]);

  // Listen for service modal trigger from header
  useEffect(() => {
    const handleTriggerServiceModal = () => {
      console.log('🎯 Received triggerServiceModal event');
      setShowServiceModal(true);
    };

    window.addEventListener('triggerServiceModal', handleTriggerServiceModal);
    
    return () => {
      window.removeEventListener('triggerServiceModal', handleTriggerServiceModal);
    };
  }, []);

  const visitTypeOptions = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'follow-up', label: 'Follow-up Visit' },
    { value: 'procedure', label: 'Procedure' },
    { value: 'emergency', label: 'Emergency' }
  ];

  // Camera functionality
  const handleTakePicture = async (type: 'lab' | 'media') => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      // This would open a camera modal - implementation depends on your camera component
      console.log('Opening camera for:', type);
      // You would implement the actual camera functionality here
    } catch (error) {
      console.error('Camera access denied:', error);
      alert('Camera access is required to take pictures. Please enable camera permissions.');
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent, type: 'lab' | 'imaging' | 'media') => {
    e.preventDefault();
    if (type === 'lab') setLabDragging(true);
    if (type === 'imaging') setImagingDragging(true);
    if (type === 'media') setMediaDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent, type: 'lab' | 'imaging' | 'media') => {
    e.preventDefault();
    if (type === 'lab') setLabDragging(false);
    if (type === 'imaging') setImagingDragging(false);
    if (type === 'media') setMediaDragging(false);
  };

  const handleDrop = (e: React.DragEvent, type: 'lab' | 'imaging' | 'media') => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    console.log(`Files dropped for ${type}:`, files);
    // Handle file upload here
    if (type === 'lab') setLabDragging(false);
    if (type === 'imaging') setImagingDragging(false);
    if (type === 'media') setMediaDragging(false);
  };

  // Initialize form for new visit
  useEffect(() => {
    console.log('🆕 Initializing new visit form');
    // Set default time to current time
    const now = new Date();
    setSelectedHour(now.getHours().toString().padStart(2, '0'));
    setSelectedMinute(now.getMinutes().toString().padStart(2, '0'));
    setSelectedDate(now);
    
    // Initialize empty medications list
    setMedications([]);
    
    // Set loading to false since we don't need to fetch anything
    setIsLoading(false);
    
    console.log('✅ New visit form initialized');
  }, []);

  // Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, role')
          .eq('role', 'doctor')
          // New visits can only be assigned to active doctors
          .or('is_active.is.null,is_active.eq.true')
          .order('full_name');

        if (error) throw error;
        setDoctors(data || []);
      } catch (error) {
        console.error('Error fetching doctors:', error);
      } finally {
        setLoadingDoctors(false);
      }
    };

    fetchDoctors();
  }, []);

  // Medical aid or private follows the patient's medical aid record, as in invoiceService
  useEffect(() => {
    let cancelled = false;
    loadPatientHasMedicalAid(patientId).then(hasMedicalAid => {
      if (!cancelled) setPatientHasMedicalAid(hasMedicalAid);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  // Fetch appointment doctor if appointmentId is provided
  useEffect(() => {
    const fetchAppointmentDoctor = async () => {
      if (!appointmentId) return;
      
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('doctor_id')
          .eq('id', appointmentId)
          .single();

        if (error) throw error;
        if (data?.doctor_id) {
          setAppointmentDoctor(data.doctor_id);
          setValue('doctor_id', data.doctor_id);
        }
      } catch (error) {
        console.error('Error fetching appointment doctor:', error);
      }
    };

    fetchAppointmentDoctor();
  }, [appointmentId, setValue]);

  // Create Visit writes a visit once: one save at a time (a double click does nothing), and a retry after a step
  // failed updates the visit the first try wrote, keeping its invoice and medicines: never a second visit or invoice
  const runOneSave = useOneSaveAtATime();
  const written = useRef<{ visitId: string | null; invoiceId: string | null; medicinesSaved: boolean }>({ visitId: null, invoiceId: null, medicinesSaved: false });

  // takePaymentAfterSave: "Invoice and take payment" saves exactly as "Create Visit", then opens Receive payment
  const saveNewVisit = (data: EditVisitFormData, takePaymentAfterSave: boolean) => runOneSave(() => saveNewVisitOnce(data, takePaymentAfterSave));

  const saveNewVisitOnce = async (data: EditVisitFormData, takePaymentAfterSave: boolean) => {
    console.log('📝 Form submitted - this should only happen when clicking Create Visit button');
    console.log('Submit event triggered by:', document.activeElement);
    console.trace('Form submission stack trace');
    let createdInvoiceId: string | null = written.current.invoiceId;

    // Every check runs before anything is written, as on Update Visit: a refused save writes nothing, so pressing
    // Create Visit again can never leave a second visit or invoice behind
    const medicineProblems = medicationIssues(medications);
    if (medicineProblems.length > 0) {
      toast.error(`Visit not saved. ${medicineProblems.join('. ')}.`, { duration: 8000 });
      if (activeTab !== 'medications') onTabChange?.('medications');
      return;
    }

    // Dental practices: a fund rejects a claim line without the tooth its code needs, so nothing is saved until the
    // lines that will be invoiced have their tooth (the visit stays open on the Billing tab)
    if (data.generateInvoice && selectedServices.length > 0 && billing.toothProblem) {
      toast.error(`Visit not saved. ${billing.toothProblem}`, { duration: 8000 });
      if (activeTab !== 'billing') onTabChange?.('billing');
      return;
    }

    // The checks the invoice makes on its lines (invoiceService), here before the visit is written
    const lineProblems = data.generateInvoice && selectedServices.length > 0 && !written.current.invoiceId ? findInvoiceLineProblems(selectedServices) : [];
    if (lineProblems.length > 0) {
      toast.error(`Visit not saved. ${lineProblems.join(' ')}`, { duration: 8000 });
      if (activeTab !== 'billing') onTabChange?.('billing');
      return;
    }

    // Account flags, before anything is saved: "Back" leaves the visit open as it is (an invoice already made by an
    // earlier try of this visit is not made again, so nothing to confirm)
    const flagDecision = data.generateInvoice && selectedServices.length > 0 && !written.current.invoiceId
      ? await invoiceFlags.confirm({ totalCents: billing.totals.totalCents, patientCents: billing.totals.patientCents })
      : { billPatientOnly: false };
    if (!flagDecision) return;

    try {
      setIsSubmitting(true);

      // Get current user for fallback doctor_id
      const { data: { user } } = await supabase.auth.getUser();

      // SSOT: prefer PracticeContext, fall back to legacy local state
      const finalPracticeId = contextPracticeId || practiceId;
      if (!finalPracticeId) {
        toast.error('No practice context — cannot create visit. Please reload.');
        setIsSubmitting(false);
        return;
      }

      // Determine the doctor ID - prioritize appointment doctor over selected doctor over current user
      const finalDoctorId = appointmentDoctor || data.doctor_id || user?.id;

      // Create the visit record
      const visitData = {
        patient_id: patientId,
        doctor_id: finalDoctorId,
        practice_id: finalPracticeId,
        visit_type: data.visit_type,
        visit_date: data.visit_date ? format(data.visit_date, 'yyyy-MM-dd') : undefined,
        visit_time: data.visit_time || undefined,
        chief_complaint: data.chief_complaint || '',
        diagnosis: data.diagnosis || '',
        treatment_plan: data.treatment_plan || '',
        prescription: data.prescription || undefined,
        follow_up_required: data.follow_up_required || false,
        follow_up_date: data.follow_up_date && data.follow_up_date.trim() ? data.follow_up_date : undefined,
        notes: data.notes || undefined,
        status: 'in-progress',
        is_scheduled: appointmentId ? true : false,
        updated_at: new Date().toISOString()
      };

      console.log('🏥 Creating new visit with data:', visitData);

      // The first try inserts the visit; a retry (a later step failed) updates the visit that try wrote
      const earlierVisitId = written.current.visitId;
      const { data: newVisit, error: visitError } = earlierVisitId
        ? await supabase.from('visits').update(visitData).eq('id', earlierVisitId).select('id').single()
        : await supabase
            .from('visits')
            .insert([{ ...visitData, created_at: new Date().toISOString() }])
            .select('id')
            .single();

      if (visitError) throw visitError;

      const newVisitId = newVisit.id;
      written.current.visitId = newVisitId;
      setNewVisitId(newVisitId);
      console.log('✅ New visit created with ID:', newVisitId);

      // Who pays, before the invoice: a visit billed to an account is all the account's, nothing claimed (A14, A19)
      const payer = await visitPayer.save(newVisitId);
      if (payer.problem) toast.error(`The visit was created but who pays for it was not saved: ${payer.problem}`, { duration: 8000 });

      // Create vitals if provided (a retry updates the vitals an earlier try saved)
      if (Object.keys(data.vitals).some(key => data.vitals[key as keyof typeof data.vitals])) {
        console.log('💓 Creating vitals for new visit:', data.vitals);
        const { data: earlierVitals } = earlierVisitId
          ? await supabase.from('vitals').select('id').eq('visit_id', newVisitId).limit(1)
          : { data: [] as { id: string }[] };
        const { error: vitalsError } = earlierVitals && earlierVitals.length > 0
          ? await supabase.from('vitals').update({ ...data.vitals }).eq('id', earlierVitals[0].id)
          : await supabase
              .from('vitals')
              .insert([{
                visit_id: newVisitId,
                ...data.vitals,
                created_at: new Date().toISOString()
              }]);

        if (vitalsError) throw vitalsError;
        console.log('✅ Vitals created successfully');
      }

      // Handle invoice creation if services selected (once: an invoice an earlier try made is kept, never made again)
      if (selectedServices.length > 0 && data.generateInvoice && !written.current.invoiceId) {
        try {
          console.log('🧾 Creating invoice for new visit with services:', selectedServices.length);
          
          let practiceId = undefined;
          
          if (user) {
            const { data: userProfile } = await supabase
              .from('users')
              .select('practice_id')
              .eq('id', user.id)
              .single();
            
            practiceId = userProfile?.practice_id;
          }
          
          const invoiceRequest = {
            visitId: newVisitId,
            patientId,
            practiceId: practiceId || '',
            // Each line with the ICD-10 codes the Billing tab shows for it (chosen on the line, or confirmed at claim review)
            services: billing.servicesForInvoice,
            medicalAidId: undefined,
            // The visit's practitioner treats; whoever saves (reception too) only raises the invoice
            practitionerId: finalDoctorId || null,
            generatePdf: false,
            notes: 'Generated from new visit form',
            // A cash-only account, confirmed above: the invoice is the patient's and is not claimed; nor is an account's
            billPatientOnly: flagDecision.billPatientOnly || payer.billsAccount
          };

          const created = await invoiceService.generateInvoiceFromVisit(invoiceRequest);
          createdInvoiceId = created.id;
          written.current.invoiceId = created.id;
          // Codes with a recall: offer one for the patient (one tap to set, one to skip; never stops the save)
          void offerVisitRecalls({
            practiceId: contextPracticeId || practiceId || null,
            patientId,
            visitId: newVisitId,
            visitDate: visitData.visit_date ?? visitDateKey,
            lines: billing.servicesForInvoice,
            tariffs: billableTariffs
          });
          (created.warnings ?? []).forEach(warning => toast(warning, { duration: 8000 }));
          console.log('✅ Invoice created successfully');
        } catch (invoiceError) {
          console.error('Invoice creation failed:', invoiceError);
          // Show user-friendly error but don't block the main save
          alert(`Invoice creation failed: ${invoiceError instanceof Error ? plainWords(invoiceError.message) : 'Unknown error'}. The visit was created but invoice was not generated.`);
        }
      }

      // The referral, hospital stay and place of service: after the invoice, so its claim lines carry them
      const claimDetailsProblem = await claimDetails.save(newVisitId, visitData.visit_date ?? null);
      if (claimDetailsProblem) {
        toast.error(`The visit was created but its referral and hospital details were not saved: ${claimDetailsProblem}`, { duration: 8000 });
      }

      // Save medications to database (once: medicines an earlier try saved are not saved again)
      if (medications.length > 0 && !written.current.medicinesSaved) {
        try {
          console.log('💊 Creating medications for new visit:', medications.length);

          // Every medication was checked before the visit was written (medicationIssues)
          const validMedications = medications;

          // Get current user for prescribed_by
          const { data: { user } } = await supabase.auth.getUser();
          
          // Insert new medications
          const medicationPromises = validMedications.map(async (med) => {
            // Create individual medication record
            const medicationData = {
              visit_id: newVisitId,
              patient_id: patientId,
              medication_name: med.medication_name.trim(),
              dosage: med.dosage.trim(),
              frequency: med.frequency.trim(),
              duration: med.duration || '',
              instructions: med.instructions || '',
              prescribed_by: user?.id,
              prescribed_date: new Date().toISOString(),
              status: 'active',
              notes: med.notes || null
            };

            // Insert the new medication using direct table access (bypass type checking)
            const { error } = await (supabase as any)
              .from('medications')
              .insert([medicationData]);

            if (error) {
              console.error('Error inserting medication:', error);
              throw new Error(`Failed to save medication: ${med.medication_name}`);
            }

            return medicationData;
          });

          await Promise.all(medicationPromises);
          written.current.medicinesSaved = true;
          console.log('✅ Medications saved successfully:', validMedications.length, 'medications');

        } catch (medicationError) {
          console.error('Error saving medications:', medicationError);
          alert(`Medications save failed: ${medicationError instanceof Error ? plainWords(medicationError.message) : 'Unknown error'}. The visit was created but medications were not saved.`);
        }
      }

      console.log('🎉 Visit creation completed successfully!');
      
      // Automatically generate documents after successful creation
      if (newVisitId) {
        try {
          console.log('🚀 Automatically generating visit documents...');
          const documentsToGenerate: ('prescription' | 'leave_form' | 'invoice')[] = [];
          
          // Check if prescription should be generated
          if (medications.length > 0) {
            documentsToGenerate.push('prescription');
          }
          
          // Check if leave form should be generated (we just created the visit, so check if leave form tab was used)
          const { data: leaveFormExists } = await supabase
            .from('leave_forms')
            .select('id')
            .eq('visit_id', newVisitId)
            .single();
          
          if (leaveFormExists) {
            documentsToGenerate.push('leave_form');
          }
          
          // Check if invoice should be generated
          if (selectedServices.length > 0 && data.generateInvoice) {
            documentsToGenerate.push('invoice');
          }
          
          if (documentsToGenerate.length > 0) {
            const generatedDocs = await documentGenerationService.generateVisitDocuments({
              visitId: newVisitId,
              patientId,
              practiceId: user?.practice_id || '',
              documents: documentsToGenerate
            });
            
            if (generatedDocs.length > 0) {
              console.log('✅ Documents generated successfully:', generatedDocs);
            }
          }
        } catch (docError) {
          console.error('Error generating documents:', docError);
          // Don't fail the whole creation if document generation fails
        }
      }

      // Receive payment opens over this screen; it closes (onSuccess) when the payment is done or skipped
      if (takePaymentAfterSave && createdInvoiceId) {
        setPaymentInvoiceId(createdInvoiceId);
        return;
      }
      onSuccess();
    } catch (error) {
      console.error('❌ Error creating visit:', error);
      alert(`Failed to create visit: ${error instanceof Error ? plainWords(error.message) : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const onSubmit = (data: EditVisitFormData) => saveNewVisit(data, false);
  const onSubmitAndTakePayment = (data: EditVisitFormData) => saveNewVisit(data, true);
  // Raising the invoice and recording the receipt are both allowed here (invoiceRights, ar_post_receipt)
  const canTakePayment = canInvoiceAndTakePayment(user, contextPracticeId || practiceId);

  // Load available tariffs and usage statistics
  useEffect(() => {
    const loadTariffs = async () => {
      try {
        console.log('🔍 Loading tariffs - checking auth state');
        // Fetch tariffs from practice_tariffs_with_types view
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error('❌ Auth error:', authError);
          return;
        }
        
        if (!authUser) return;

        const { data: userProfile } = await supabase
          .from('users')
          .select('practice_id')
          .eq('id', authUser.id)
          .single();

        if (!userProfile?.practice_id) return;

        setPracticeId(userProfile.practice_id);

        const { data: practiceData } = await supabase
          .from('practices')
          .select('practice_type')
          .eq('id', userProfile.practice_id)
          .single();

        // Every discipline bills from its own practice type's tariff list (it was dental only)
        if (!practiceData?.practice_type) return;
        setPracticeType(practiceData.practice_type);

        // Load tariffs: the practice type's shared list with the practice's own codes (its own price wins) and each
        // code's default portion (Admin > Tariffs)
        const { rows: tariffs, problems: tariffProblems } = await loadPracticeTariffRows(userProfile.practice_id, practiceData.practice_type);
        tariffProblems.forEach(problem => console.warn(problem));
        setAvailableTariffs(tariffs);

        // Load real usage statistics from invoice_services
        const { data: usageData } = await supabase
          .from('invoice_services')
          .select('code')
          .order('created_at', { ascending: false })
          .limit(1000); // Get last 1000 services

        if (usageData) {
          const usageCount: {[key: string]: number} = {};
          usageData.forEach(service => {
            if (service.code) {
              usageCount[service.code] = (usageCount[service.code] || 0) + 1;
            }
          });
          setServiceUsageStats(usageCount);
        }
      } catch (error) {
        console.error('Error loading tariffs:', error);
      }
    };

    loadTariffs();
  }, []);

  // Auto-add 8109 Infection Control when billing tab is accessed for the first time
  useEffect(() => {
    // Dental practices only, and only once the patient's prices are known
    if (activeTab === 'billing' && availableTariffs.length > 0 && isDental && followsDentistSchedule(availableTariffs) && !billingBlocked) {
      const hasInfectionControl = selectedServices.some(s => s.code === INFECTION_CONTROL_CODE);

      if (!hasInfectionControl) {
        console.log('🦠 Auto-adding 8109 Infection Control on billing tab load');

        // Priced from the 8109 tariff only; without a usable 8109 tariff no line is added. Quantity: the practice's
        // clinical staff count (NAMAF bills 8109 per dentist, hygienist and assistant)
        const infectionControl = buildInfectionControlLine(billableTariffs, patientHasMedicalAid === true, undefined, fundPricing.infectionControlStaff);
        if (!infectionControl.ok) {
          toast.error(infectionControl.message, { id: 'tariff-8109' });
          return;
        }

        const updatedServices = [infectionControl.service, ...selectedServices];
        setSelectedServices(updatedServices);
        
        if (onSelectedServicesChange) {
          onSelectedServicesChange(updatedServices);
        }
        
        console.log('✅ Auto-added 8109 Infection Control on billing tab load');
      }
    }
  }, [activeTab, availableTariffs, selectedServices.length, isDental, billingBlocked]);

  // Helper functions for service selection

  // Business Rules Engine for Dental Services - 10 iterations of refinement
  const getDentalServiceBusinessRules = (tariff: any) => {
    const code = tariff.code;
    const canMultiply = tariff.can_be_multiplied;
    const requiresTooth = tariff.requires_tooth_number;

    // Iteration 1: The tariff's own quantity rule; computeLine prices every line from it
    const multiplyRule = normalizeMultiplyRule(canMultiply);

    // Iteration 2: Special codes handling
    const specialCodes: {[key: string]: any} = {
      [INFECTION_CONTROL_CODE]: { type: 'INFECTION_CONTROL', maxQuantity: 1, autoAdd: true },
      '8110': { type: 'STERILIZATION', maxQuantity: 1 },
      '8145': { type: 'ANESTHETIC', maxQuantity: 10 }, // Multiple injections
      '8107': { type: 'XRAY', maxQuantity: 7 }, // Max 7 films
      '8163': { type: 'SEALANT', requiresTooth: true, maxTeeth: 32 },
      '8185': { type: 'QUADRANT', maxQuantity: 4 }, // Max 4 quadrants
      [MATERIAL_FACTOR_CODE]: { type: 'MATERIAL_FACTOR', autoGenerated: true }
    };

    // Iteration 4: Tooth-specific logic refinement
    // Tooth numbers are a dental rule (withDisciplineRules clears the flag for other practice types)
    const toothLogic = {
      requiresTooth: requiresTooth === 'YES',
      multipleTeeth: canMultiply === 'YES' && requiresTooth === 'YES',
      singleTooth: requiresTooth === 'YES' && canMultiply !== 'YES'
    };

    // Iteration 5: Quantity rules
    const quantityRules = {
      // From the tariff only: a maxQuantity entry offered a quantity for once-per-line codes, which were then billed as one unit
      allowQuantity: multiplyRule !== 'NO',
      minQuantity: 1,
      maxQuantity: specialCodes[code]?.maxQuantity || 99,
      defaultQuantity: 1
    };

    // Iteration 6: Auto-generation rules: a restoration brings its 8346 material factor (dental practices only;
    // the code lists live in tariffRules.ts)
    const autoGenerateRules: string[] = isDental && isRestorationCode(code) ? [MATERIAL_FACTOR_CODE] : [];

    // Iteration 7: Validation rules
    const validationRules = {
      requiresToothValidation: toothLogic.requiresTooth,
      validToothNumbers: ['11','12','13','14','15','16','17','18',
                         '21','22','23','24','25','26','27','28',
                         '31','32','33','34','35','36','37','38',
                         '41','42','43','44','45','46','47','48'],
      requiresQuantityValidation: quantityRules.allowQuantity,
      conflictsWithCodes: [] // Some codes can't be used together
    };

    // Iteration 9: UI workflow rules
    const workflowRules = {
      showQuantityModal: quantityRules.allowQuantity && !toothLogic.requiresTooth,
      showToothModal: toothLogic.requiresTooth && !quantityRules.allowQuantity,
      showBothModals: quantityRules.allowQuantity && toothLogic.requiresTooth,
      skipAllModals: !quantityRules.allowQuantity && !toothLogic.requiresTooth
    };

    // Iteration 10: Final comprehensive rule object
    return {
      code,
      multiplyRule,
      specialCode: specialCodes[code],
      toothLogic,
      quantityRules,
      autoGenerateRules,
      validationRules,
      workflowRules,
      description: tariff.description,
      isRequired: code === INFECTION_CONTROL_CODE, // Infection control always required
      allowDuplicates: toothLogic.requiresTooth // Can add same service for different teeth
    };
  };

  const handleServiceSelect = (tariff: any) => {
    console.log('🎯 Service selected:', {
      code: tariff.code,
      description: tariff.description,
      can_be_multiplied: tariff.can_be_multiplied,
      requires_tooth_number: tariff.requires_tooth_number
    });
    
    setSelectedTariff(tariff);
    setShowServiceModal(false);
    
    // Get comprehensive business rules
    const rules = getDentalServiceBusinessRules(tariff);
    console.log('📋 Business rules:', rules);
    
    // Determine workflow based on refined rules
    if (rules.workflowRules.showBothModals) {
      console.log('🔢➡🦷 Showing quantity modal first (tooth will follow)');
      setServiceQuantity(rules.quantityRules.defaultQuantity);
      setShowQuantityModal(true);
    } else if (rules.workflowRules.showQuantityModal) {
      console.log('🔢 Showing quantity modal only');
      setServiceQuantity(rules.quantityRules.defaultQuantity);
      setShowQuantityModal(true);
    } else if (rules.workflowRules.showToothModal) {
      console.log('🦷 Showing tooth selection modal only');
      setShowToothModal(true);
    } else {
      console.log('➕ Adding service directly');
      addServiceDirectly(tariff, 1, '');
    }
  };

  const handleQuantityNext = () => {
    console.log('🔢✅ Quantity next clicked:', { quantity: serviceQuantity, needsTooth: selectedTariff?.requires_tooth_number });
    setShowQuantityModal(false);
    if (selectedTariff?.requires_tooth_number === 'YES') {
      console.log('🦷 Moving to tooth selection');
      setShowToothModal(true);
    } else {
      console.log('➕ Adding service with quantity only');
      addServiceDirectly(selectedTariff, serviceQuantity, '');
    }
  };

  const handleModalCancel = () => {
    // Reset all modal states without affecting parent navigation
    setShowServiceModal(false);
    setShowQuantityModal(false);
    setShowToothModal(false);
    setSelectedTariff(null);
    setServiceQuantity(1);
  };

  const addServiceDirectly = (tariff: any, quantity: number, toothNumber: string) => {
    if (!tariff) {
      console.log('❌ No tariff provided to addServiceDirectly');
      return;
    }

    console.log('➕ Adding service:', {
      code: tariff.code,
      quantity,
      toothNumber,
      price: tariff.price
    });

    // A medical aid patient's lines wait for the fund's prices (never the practice tariff by accident)
    if (billingBlocked) {
      toast.error(billingBlocked, { id: 'fund-prices' });
      handleModalCancel();
      return;
    }

    const rules = getDentalServiceBusinessRules(tariff);
    const hasMedicalAid = patientHasMedicalAid === true;
    // Priced by computeLine from the tariff; a line it refuses (no price, quantity, tooth) is not added
    const added = buildTariffLine(tariff, quantity, toothNumber, hasMedicalAid);
    if (!added.ok) {
      toast.error(added.message, { duration: 8000 });
      handleModalCancel();
      return;
    }
    if (added.warnings.length > 0) toast(added.warnings.join(' '), { duration: 8000 });
    const newService = added.service;

    const updatedServices = [...selectedServices, newService];

    // Auto-add 8109 Infection Control for EVERY service (dental practices, if not already present)
    const hasInfectionControl = selectedServices.some(s => s.code === INFECTION_CONTROL_CODE);
    if (isDental && followsDentistSchedule(availableTariffs) && !hasInfectionControl && tariff.code !== INFECTION_CONTROL_CODE) {
      console.log('🦠 Auto-adding 8109 Infection Control');

      // Priced from the 8109 tariff only; without a usable 8109 tariff no line is added
      const infectionControl = buildInfectionControlLine(billableTariffs, hasMedicalAid, newService.id, fundPricing.infectionControlStaff);
      if (infectionControl.ok) {
        updatedServices.unshift(infectionControl.service); // Add at beginning
        console.log('✅ Auto-added 8109 Infection Control:', infectionControl.service.unitPrice);
      } else {
        toast.error(infectionControl.message, { id: 'tariff-8109' });
      }
    }

    // Check for 8346 material factor auto-generation
    if (rules.autoGenerateRules.length > 0) {
      console.log('🔄 Auto-generating material factor for codes:', rules.autoGenerateRules);

      for (const autoCode of rules.autoGenerateRules) {
        if (autoCode === MATERIAL_FACTOR_CODE) {
          // 10% of the procedure's unit price, rounded to the cent, for the same quantity
          const material = buildMaterialFactorLine(billableTariffs, newService, hasMedicalAid);
          if (!material.ok) {
            toast.error(material.message, { id: 'tariff-8346' });
            continue;
          }

          updatedServices.push(material.service);
          console.log('✅ Auto-generated 8346 Material Factor:', {
            baseService: tariff.code,
            basePrice: newService.unitPrice,
            materialPrice: material.service.unitPrice,
            calculation: material.service.exampleCalculation
          });
        }
      }
    }
    
    setSelectedServices(updatedServices);
    
    console.log('📋 Services updated:', {
      oldCount: selectedServices.length,
      newCount: updatedServices.length,
      newService: newService.code,
      autoGenerated: {
        infectionControl: isDental && !selectedServices.some(s => s.code === INFECTION_CONTROL_CODE) && tariff.code !== INFECTION_CONTROL_CODE,
        materialFactor: rules.autoGenerateRules.length
      }
    });
    
    // Notify parent component about the change
    if (onSelectedServicesChange) {
      onSelectedServicesChange(updatedServices);
      console.log('📡 Parent notified of service changes');
    }
    
    // Reset states
    setSelectedTariff(null);
    setServiceQuantity(1);
  };

  // Quantity changes in the services table are priced by computeLine; an auto-added 8346 line follows
  const changeServiceQuantity = (serviceId: string, quantity: number) => {
    const { services, line } = changeLineQuantity(selectedServices, serviceId, quantity, billableTariffs, patientHasMedicalAid === true);
    if (!line) return;
    if (!line.ok) {
      toast.error(line.errors.join(' '), { duration: 8000 });
      return;
    }
    if (line.warnings.length > 0) toast(line.warnings.join(' '), { id: `quantity-${serviceId}`, duration: 8000 });
    setSelectedServices(services);
    if (onSelectedServicesChange) onSelectedServicesChange(services);
  };

  // Dental tooth numbering system (FDI notation) - removed unused array

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#01b9d4]" />
          <p className="text-gray-600">Loading visit data...</p>
        </div>
      </div>
    );
  }

  // The quantity dialog shows the total computeLine will bill (a tooth, if needed, is chosen next)
  const quantityPreviewInput = selectedTariff ? tariffLineInput(selectedTariff, serviceQuantity, patientHasMedicalAid === true) : null;
  const quantityPreview = quantityPreviewInput ? computeLine(quantityPreviewInput) : null;

  return (
    <div className="flex flex-col">
      <form 
        id="add-visit-form"
        onSubmit={handleSubmit(onSubmit)}
        className="hidden"
        noValidate />
      <div className="flex-1">
        {/* General Tab */}
        {activeTab === 'general' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Encounter Information Section */}
            <div>
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-md">
                  <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 ml-3">Encounter Details</h3>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Date and Time Container */}
                  <div className="flex flex-col sm:flex-row gap-4 md:w-1/2">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Encounter Date
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsDatePickerOpen(true)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-[#01b9d5]/30 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#01b9d5]/20 focus:border-[#01b9d5] transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-[#01b9d5]/10 to-[#4bc0c8]/10">
                              <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-[#01b9d5]" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Encounter Date</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {/* Day first, as Namibian practices write dates: 7 Oct 2026 */}
                                {watch('visit_date') ? formatServiceDate(watch('visit_date')) : 'Select date'}
                              </p>
                            </div>
                          </div>
                          <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-5 h-5 text-[#01b9d5]/60" />
                        </button>
                      </div>
                      {errors.visit_date && (
                        <p className="text-sm text-red-600 mt-1">Visit date is required</p>
                      )}
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Encounter Time
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsTimePickerOpen(true)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-[#01b9d5]/30 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#01b9d5]/20 focus:border-[#01b9d5] transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-[#4bc0c8]/10 to-[#01b9d5]/10">
                              <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-[#4bc0c8]" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Encounter Time</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {(() => {
                                  const hour = parseInt(selectedHour);
                                  const period = hour >= 12 ? 'PM' : 'AM';
                                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                  return `${displayHour}:${selectedMinute} ${period}`;
                                })()}
                              </p>
                            </div>
                          </div>
                          <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-5 h-5 text-[#4bc0c8]/60" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Visit Type Container */}
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Visit Type
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsVisitTypeModalOpen(true)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-amber-500/30 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br shadow-sm from-amber-400 to-orange-500">
                            <Icon icon="solar:stethoscope-bold-duotone" className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            {(() => {
                              const selectedType = visitTypeOptions.find(opt => opt.value === watch('visit_type'));
                              return (
                                <>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {selectedType ? selectedType.label : 'Select Visit Type'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {selectedType ? 'Visit category' : 'Choose type'}
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-5 h-5 transition-transform text-gray-400" />
                      </button>
                    </div>
                    {errors.visit_type && (
                      <p className="text-sm text-red-600 mt-1">{errors.visit_type.message}</p>
                    )}
                  </div>

                  {/* Doctor Selection Container */}
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Treating Doctor
                      {appointmentDoctor && (
                        <span className="text-sm text-blue-600 ml-1">(From Appointment)</span>
                      )}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => !appointmentDoctor && !loadingDoctors && setIsDoctorModalOpen(true)}
                        disabled={!!appointmentDoctor || loadingDoctors}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-emerald-500/30 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br shadow-sm from-green-400 to-emerald-500">
                            <Icon icon="solar:user-check-bold-duotone" className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            {(() => {
                              const selectedDoctor = doctors.find(d => d.id === (appointmentDoctor || watch('doctor_id')));
                              return (
                                <>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {selectedDoctor ? selectedDoctor.full_name : (loadingDoctors ? 'Loading...' : 'Select Doctor')}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {selectedDoctor ? 'Treating physician' : (appointmentDoctor ? 'From appointment' : 'Choose doctor')}
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-5 h-5 transition-transform text-gray-400" />
                      </button>
                    </div>
                    {appointmentDoctor && (
                      <p className="text-sm text-blue-600 mt-1">
                        Doctor automatically selected from appointment
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Chief Complaint Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 shadow-md">
                  <Icon icon="solar:clipboard-text-bold-duotone" className="w-5 h-5 text-white" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-800">Chief Complaint</h3>
                  <p className="text-sm text-gray-600">Primary reason for today's visit</p>
                </div>
              </div>
              <div>
                <PremiumInput
                  type="text"
                  {...register('chief_complaint', { required: 'Chief complaint is required' })}
                  icon="solar:danger-circle-bold-duotone"
                  iconColor="text-red-500"
                  placeholder="Primary reason for visit"
                />
                {errors.chief_complaint && (
                  <p className="text-sm text-red-600 mt-1">{errors.chief_complaint.message}</p>
                )}
              </div>
            </div>

            {/* Clinical Assessment Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-md">
                  <Icon icon="solar:health-bold-duotone" className="w-5 h-5 text-white" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-800">Clinical Assessment</h3>
                  <p className="text-sm text-gray-600">Diagnosis and treatment planning</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Diagnosis
                  </label>
                  <PremiumTextarea
                    {...register('diagnosis', { required: 'Diagnosis is required' })}
                    rows={4}
                    icon="solar:clipboard-text-bold-duotone"
                    iconColor="text-green-500"
                    placeholder="Clinical diagnosis and findings"
                  />
                  {errors.diagnosis && (
                    <p className="text-sm text-red-600 mt-1">{errors.diagnosis.message}</p>
                  )}
                  {/* The full ICD-10 list, by code or words: a chosen code is added to the diagnosis for billing */}
                  <Icd10DiagnosisSearch
                    diagnosis={watch('diagnosis') ?? ''}
                    onDiagnosisChange={(next) => setValue('diagnosis', next, { shouldDirty: true, shouldValidate: true })}
                  />
                  {/* One tap puts this diagnosis (each ICD-10 code in it) on the patient's problem list */}
                  <DiagnosisToProblems patientId={patientId} practiceId={user?.practice_id} visitId={newVisitId || null} diagnosis={watch('diagnosis')} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Treatment Plan
                  </label>
                  <PremiumTextarea
                    {...register('treatment_plan', { required: 'Treatment plan is required' })}
                    rows={4}
                    icon="solar:stethoscope-bold-duotone"
                    iconColor="text-blue-500"
                    placeholder="Recommended treatment and procedures"
                  />
                  {errors.treatment_plan && (
                    <p className="text-sm text-red-600 mt-1">{errors.treatment_plan.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
                  <Icon icon="solar:notes-bold-duotone" className="w-5 h-5 text-white" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-800">Additional Information</h3>
                  <p className="text-sm text-gray-600">Notes and observations</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Clinical Notes
                </label>
                <PremiumTextarea
                  {...register('notes')}
                  rows={3}
                  icon="solar:chat-square-bold-duotone"
                  iconColor="text-purple-500"
                  placeholder="Additional notes and observations (optional)"
                />
              </div>
            </div>

            {/* The patient's answers before the visit (parity B17); shown only when they answered */}
            <PrevisitAnswersCard visitId={newVisitId} />
            {/* Drawings on a body or tooth chart, kept with the visit's notes (parity C9); once the visit is saved */}
            <VisitDrawingsSection patientId={patientId} visitId={newVisitId} isDental={isDental} />
          </motion.div>
        )}

        {/* Date Picker Modal */}
        {isDatePickerOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 mx-4 w-full max-w-[500px] max-h-[85vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Select Date & Time</h3>
                <button 
                  onClick={() => setIsDatePickerOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              
              {/* Month/Year Navigation */}
              <div className="flex items-center justify-between mb-3">
                <button 
                  onClick={() => {
                    if (currentMonth === 0) {
                      setCurrentMonth(11);
                      setCurrentYear(currentYear - 1);
                    } else {
                      setCurrentMonth(currentMonth - 1);
                    }
                  }}
                  className="p-3 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700" />
                </button>
                <div className="flex items-center gap-2">
                  {/* Month Dropdown */}
                  <PremiumSelect
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                    icon="solar:calendar-bold-duotone"
                    iconColor="text-cyan-500"
                    className="text-lg font-bold"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {new Date(currentYear, i).toLocaleDateString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </PremiumSelect>
                  {/* Year Dropdown */}
                  <PremiumSelect
                    value={currentYear}
                    onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                    icon="solar:calendar-date-bold-duotone"
                    iconColor="text-cyan-500"
                    className="text-lg font-bold"
                  >
                    {Array.from({ length: 50 }, (_, i) => {
                      const year = new Date().getFullYear() - 25 + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </PremiumSelect>
                </div>
                <button 
                  onClick={() => {
                    if (currentMonth === 11) {
                      setCurrentMonth(0);
                      setCurrentYear(currentYear + 1);
                    } else {
                      setCurrentMonth(currentMonth + 1);
                    }
                  }}
                  className="p-3 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} className="text-xs font-semibold text-gray-500 text-center py-2">
                    {day}
                  </div>
                ))}
                {Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }, (_, i) => (
                  <div key={`empty-${i}`} className="h-8"></div>
                ))}
                {Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() }, (_, i) => {
                  const day = i + 1;
                  const isToday = 
                    new Date().getDate() === day && 
                    new Date().getMonth() === currentMonth && 
                    new Date().getFullYear() === currentYear;
                  const isSelected = 
                    selectedDate.getDate() === day && 
                    selectedDate.getMonth() === currentMonth && 
                    selectedDate.getFullYear() === currentYear;
                  
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        const newDate = new Date(currentYear, currentMonth, day);
                        setSelectedDate(newDate);
                      }}
                      className={`h-8 w-8 text-xs rounded-lg transition-all duration-200 font-medium flex items-center justify-center ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#01b9d5] to-[#4bc0c8] text-white font-bold shadow-lg scale-110'
                          : isToday
                          ? 'bg-blue-100 text-blue-700 font-bold'
                          : 'hover:bg-gray-100 text-gray-700 hover:scale-105'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>


              {/* Quick Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setSelectedDate(today);
                    setCurrentMonth(today.getMonth());
                    setCurrentYear(today.getFullYear());
                    setValue('visit_date', today);
                    setIsDatePickerOpen(false);
                  }}
                  className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-[#01b9d5] to-[#4bc0c8] text-white rounded-lg transition-all font-medium hover:shadow-md"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue('visit_date', selectedDate);
                    setIsDatePickerOpen(false);
                  }}
                  className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-[#01b9d5] to-[#4bc0c8] text-white rounded-lg transition-all font-medium hover:shadow-md"
                >
                  Set Date
                </button>
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(false)}
                  className="flex-1 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Time Picker Modal */}
        {isTimePickerOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsTimePickerOpen(false);
            }
          }}>
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 mx-4 w-full max-w-[500px] max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Select Time</h3>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsTimePickerOpen(false);
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Quick Select */}
              <div className="p-3 border-b border-gray-100 bg-gray-50 rounded-xl mb-4">
                <p className="text-xs font-medium text-gray-600 mb-2">Quick Select</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { time: '09:00', label: 'Morning', hour: '09', minute: '00' },
                    { time: '12:00', label: 'Noon', hour: '12', minute: '00' },
                    { time: '15:00', label: 'Afternoon', hour: '15', minute: '00' },
                    { time: '18:00', label: 'Evening', hour: '18', minute: '00' }
                  ].map((preset) => (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => {
                        setSelectedHour(preset.hour);
                        setSelectedMinute(preset.minute);
                      }}
                      className="p-2 rounded-lg text-xs font-medium transition-all bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                    >
                      <p>{preset.time}</p>
                      <p className="text-[10px] opacity-75">{preset.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Selector */}
              <div className="p-4">
                <div className="flex items-center justify-center gap-4">
                  {/* Hour Selector */}
                  <div className="text-center">
                    <button 
                      type="button" 
                      onClick={() => {
                        const newHour = (parseInt(selectedHour) + 1) % 24;
                        setSelectedHour(newHour.toString().padStart(2, '0'));
                      }}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    </button>
                    <div className="my-2">
                      <PremiumInput
                        type="text" 
                        value={selectedHour}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d{0,2}$/.test(value) && (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 23))) {
                            setSelectedHour(value.padStart(2, '0'));
                          }
                        }}
                        className="w-16 h-16 text-2xl font-bold text-center"
                        icon="solar:clock-circle-bold-duotone"
                        iconColor="text-cyan-500"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        const newHour = parseInt(selectedHour) === 0 ? 23 : parseInt(selectedHour) - 1;
                        setSelectedHour(newHour.toString().padStart(2, '0'));
                      }}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="text-2xl font-bold text-gray-400">:</div>

                  {/* Minute Selector */}
                  <div className="text-center">
                    <button 
                      type="button"
                      onClick={() => {
                        const newMinute = (parseInt(selectedMinute) + 15) % 60;
                        setSelectedMinute(newMinute.toString().padStart(2, '0'));
                      }}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    </button>
                    <div className="my-2">
                      <PremiumInput
                        type="text" 
                        value={selectedMinute}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d{0,2}$/.test(value) && (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59))) {
                            setSelectedMinute(value.padStart(2, '0'));
                          }
                        }}
                        className="w-16 h-16 text-2xl font-bold text-center"
                        icon="solar:clock-circle-bold-duotone"
                        iconColor="text-cyan-500"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        const newMinute = parseInt(selectedMinute) === 0 ? 45 : parseInt(selectedMinute) - 15;
                        setSelectedMinute(newMinute.toString().padStart(2, '0'));
                      }}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {/* AM/PM Indicator */}
                  <div className="ml-2">
                    <div className={`px-3 py-2 rounded-lg font-medium text-sm ${
                      parseInt(selectedHour) >= 12 ? 'bg-indigo-100 text-indigo-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {parseInt(selectedHour) >= 12 ? 'PM' : 'AM'}
                    </div>
                  </div>
                </div>

                {/* Available Slots */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-600 mb-2">Available Slots</p>
                  <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                    {Array.from({ length: 96 }, (_, i) => {
                      const totalMinutes = i * 15;
                      const hours = Math.floor(totalMinutes / 60);
                      const minutes = totalMinutes % 60;
                      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                      
                      return (
                        <button
                          key={timeString}
                          type="button"
                          onClick={() => {
                            setSelectedHour(hours.toString().padStart(2, '0'));
                            setSelectedMinute(minutes.toString().padStart(2, '0'));
                          }}
                          className="p-1.5 text-xs rounded transition-all relative text-gray-500 hover:bg-gray-50"
                        >
                          {timeString}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const now = new Date();
                      setSelectedHour(now.getHours().toString().padStart(2, '0'));
                      setSelectedMinute(now.getMinutes().toString().padStart(2, '0'));
                    }}
                    className="px-4 py-2 text-sm bg-gradient-to-r from-[#01b9d5] to-[#4bc0c8] text-white rounded-lg transition-all font-medium hover:shadow-md"
                  >
                    Now
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Update the visit_time
                      const timeString = `${selectedHour}:${selectedMinute}`;
                      setValue('visit_time', timeString);
                      setIsTimePickerOpen(false);
                    }}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-[#01b9d5] to-[#0197a4] text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
                  >
                    Set Time
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsTimePickerOpen(false);
                    }}
                    className="flex-1 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dosage Modal */}
        {isDosageModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 mx-4 w-full max-w-4xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Select Dosage</h3>
                <button 
                  onClick={() => setIsDosageModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Common Dosages Grid */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Common Dosages</h4>
                <div className="grid grid-cols-6 gap-3">
                  {[
                    '5mg', '10mg', '15mg', '20mg', '25mg', '30mg',
                    '50mg', '75mg', '100mg', '125mg', '150mg', '200mg',
                    '250mg', '300mg', '400mg', '500mg', '750mg', '1000mg',
                    '1g', '1.5g', '2g', '2.5g', '3g', '5g',
                    '5ml', '10ml', '15ml', '20ml', '25ml', '50ml'
                  ].map((dosage) => (
                    <button
                      key={dosage}
                      type="button"
                      onClick={() => {
                        setNewMedication({...newMedication, dosage});
                        setIsDosageModalOpen(false);
                      }}
                      className="p-3 text-sm font-medium text-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-blue-50 hover:to-blue-100 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded-xl transition-all duration-200 hover:shadow-md"
                    >
                      {dosage}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Dosage */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Custom Dosage</h4>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Enter custom dosage (e.g., 375mg, 2.5ml)"
                    className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        setNewMedication({...newMedication, dosage: e.currentTarget.value.trim()});
                        setIsDosageModalOpen(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input.value.trim()) {
                        setNewMedication({...newMedication, dosage: input.value.trim()});
                        setIsDosageModalOpen(false);
                      }
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Frequency Modal */}
        {isFrequencyModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 mx-4 w-full max-w-3xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Select Frequency</h3>
                <button 
                  onClick={() => setIsFrequencyModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Common Frequencies Grid */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Common Frequencies</h4>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    'Once daily', 'Twice daily', '3 times daily', '4 times daily',
                    'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours',
                    'Morning only', 'Evening only', 'With meals', 'Before meals',
                    'As needed', 'Weekly', 'Twice weekly', 'Monthly'
                  ].map((frequency) => (
                    <button
                      key={frequency}
                      type="button"
                      onClick={() => {
                        setNewMedication({...newMedication, frequency});
                        setIsFrequencyModalOpen(false);
                      }}
                      className="p-3 text-sm font-medium text-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-green-50 hover:to-green-100 hover:text-green-700 border border-gray-200 hover:border-green-300 rounded-xl transition-all duration-200 hover:shadow-md text-center"
                    >
                      {frequency}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Frequency */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Custom Frequency</h4>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Enter custom frequency (e.g., Every 2 hours as needed)"
                    className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        setNewMedication({...newMedication, frequency: e.currentTarget.value.trim()});
                        setIsFrequencyModalOpen(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input.value.trim()) {
                        setNewMedication({...newMedication, frequency: input.value.trim()});
                        setIsFrequencyModalOpen(false);
                      }
                    }}
                    className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duration Modal */}
        {isDurationModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 mx-4 w-full max-w-3xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Select Duration</h3>
                <button 
                  onClick={() => setIsDurationModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Common Durations Grid */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Common Durations</h4>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    '3 days', '5 days', '7 days', '10 days', '14 days',
                    '2 weeks', '3 weeks', '4 weeks', '1 month', '2 months',
                    '3 months', '6 months', '1 year', 'Until finished', 'Ongoing'
                  ].map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => {
                        setNewMedication({...newMedication, duration});
                        setIsDurationModalOpen(false);
                      }}
                      className="p-3 text-sm font-medium text-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-purple-50 hover:to-purple-100 hover:text-purple-700 border border-gray-200 hover:border-purple-300 rounded-xl transition-all duration-200 hover:shadow-md text-center"
                    >
                      {duration}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Duration */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Custom Duration</h4>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Enter custom duration (e.g., 21 days, 6 weeks)"
                    className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        setNewMedication({...newMedication, duration: e.currentTarget.value.trim()});
                        setIsDurationModalOpen(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input.value.trim()) {
                        setNewMedication({...newMedication, duration: input.value.trim()});
                        setIsDurationModalOpen(false);
                      }
                    }}
                    className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Special Instructions Modal */}
        {isInstructionsModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 mx-4 w-full max-w-4xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Select Special Instructions</h3>
                <button 
                  onClick={() => setIsInstructionsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Common Instructions Grid */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Common Instructions</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    'Take with food', 'Take on empty stomach', 'Take with plenty of water',
                    'Avoid alcohol', 'Take at bedtime', 'Take in the morning',
                    'Do not crush or chew', 'May cause drowsiness', 'Avoid dairy products',
                    'Complete full course', 'Store in refrigerator', 'Shake well before use'
                  ].map((instruction) => (
                    <button
                      key={instruction}
                      type="button"
                      onClick={() => {
                        setNewMedication({...newMedication, instructions: instruction});
                        setIsInstructionsModalOpen(false);
                      }}
                      className="p-3 text-sm font-medium text-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-orange-50 hover:to-orange-100 hover:text-orange-700 border border-gray-200 hover:border-orange-300 rounded-xl transition-all duration-200 hover:shadow-md text-center"
                    >
                      {instruction}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Instructions */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Custom Instructions</h4>
                <div className="flex gap-3">
                  <textarea
                    placeholder="Enter custom instructions..."
                    rows={3}
                    className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey && e.currentTarget.value.trim()) {
                        setNewMedication({...newMedication, instructions: e.currentTarget.value.trim()});
                        setIsInstructionsModalOpen(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const textarea = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
                      if (textarea.value.trim()) {
                        setNewMedication({...newMedication, instructions: textarea.value.trim()});
                        setIsInstructionsModalOpen(false);
                      }
                    }}
                    className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium self-start"
                  >
                    Set
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Tip: Press Ctrl+Enter to set custom instructions</p>
              </div>
            </div>
          </div>
        )}

        {/* Vitals Tab */}
        {activeTab === 'vitals' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Primary Vitals Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 shadow-md">
                  <Icon icon="solar:heart-pulse-bold-duotone" className="w-5 h-5 text-white" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-800">Primary Vitals</h3>
                  <p className="text-sm text-gray-600">Record patient vital signs</p>
                </div>
              </div>
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Blood Pressure</label>
                    <PremiumInput
                      type="text"
                      {...register('vitals.blood_pressure')}
                      placeholder="120/80"
                      icon="solar:heart-bold-duotone"
                      iconColor="text-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Temperature (°C)</label>
                    <PremiumInput
                      type="number"
                      step="0.1"
                      {...register('vitals.temperature')}
                      placeholder="36.5"
                      icon="solar:temperature-bold-duotone"
                      iconColor="text-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Pulse (bpm)</label>
                    <PremiumInput
                      type="number"
                      {...register('vitals.pulse_rate')}
                      placeholder="72"
                      icon="solar:pulse-bold-duotone"
                      iconColor="text-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Respiratory Rate</label>
                    <PremiumInput
                      type="number"
                      {...register('vitals.respiratory_rate')}
                      placeholder="16"
                      icon="solar:wind-bold-duotone"
                      iconColor="text-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Oxygen Saturation (%)</label>
                    <PremiumInput
                      type="number"
                      {...register('vitals.oxygen_saturation')}
                      placeholder="98"
                      icon="solar:cloud-bold-duotone"
                      iconColor="text-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Body Measurements Section */}
            <div>
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
                  <Icon icon="solar:ruler-bold-duotone" className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 ml-3">Body Measurements</h3>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Weight (kg)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        {...register('vitals.weight')}
                        placeholder="70.0"
                        className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all pl-10 hover:bg-gray-200"
                      />
                      <Icon icon="solar:scale-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Height (cm)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        {...register('vitals.height')}
                        placeholder="175.0"
                        className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all pl-10 hover:bg-gray-200"
                      />
                      <Icon icon="solar:ruler-pen-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      BMI
                      <span className="text-xs font-normal text-gray-500">(Auto-calculated)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        {...register('vitals.bmi')}
                        value={watch('vitals.bmi') || ''}
                        readOnly
                        className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg text-gray-600 cursor-not-allowed pl-10"
                      />
                      <Icon icon="solar:chart-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                    {watch('vitals.bmi') && (
                      <p className="text-xs mt-1 text-gray-500">
                        {(watch('vitals.bmi') || 0) < 18.5 && 'Underweight'}
                        {(watch('vitals.bmi') || 0) >= 18.5 && (watch('vitals.bmi') || 0) < 25 && 'Normal weight'}
                        {(watch('vitals.bmi') || 0) >= 25 && (watch('vitals.bmi') || 0) < 30 && 'Overweight'}
                        {(watch('vitals.bmi') || 0) >= 30 && 'Obese'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Medications Tab */}
        {activeTab === 'medications' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Prescription Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-md">
                    <Icon icon="solar:pill-bold-duotone" className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Prescription Notes</h3>
                </div>
                {/* The "AI-Powered Prescription Assistant" button is hidden until a service exists behind it (no buttons that do nothing) */}
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <textarea
                  {...register('prescription')}
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none hover:bg-gray-200"
                  placeholder="General prescription notes and instructions..."
                />
              </div>
            </div>

            {/* Prescribed Medications Table */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                    <Icon icon="solar:pills-bold-duotone" className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Prescribed Medications</h3>
                </div>
                <button
                  type="button"
                  onClick={refreshMedications}
                  className="px-4 py-2 text-sm bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-blue-50 hover:border-blue-500/30 hover:text-blue-700 transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4" />
                  Refresh
                </button>
              </div>
              
              {/* Add New Medication Form */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50 mb-6">
                <h4 className="text-md font-semibold text-gray-700 mb-4">Add New Medication</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Medication Name</label>
                    <PremiumInput
                      type="text"
                      value={newMedication.medication_name}
                      onChange={(e) => setNewMedication({...newMedication, medication_name: e.target.value})}
                      placeholder="e.g., Amoxicillin"
                      icon="solar:pills-bold-duotone"
                      iconColor="text-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dosage</label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDosageModalOpen(true);
                      }}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm text-left flex items-center justify-between shadow-sm hover:shadow-md"
                    >
                      <span className={newMedication.dosage ? 'text-gray-900' : 'text-gray-500'}>
                        {newMedication.dosage || 'Select dosage'}
                      </span>
                      <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsFrequencyModalOpen(true);
                      }}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm text-left flex items-center justify-between shadow-sm hover:shadow-md"
                    >
                      <span className={newMedication.frequency ? 'text-gray-900' : 'text-gray-500'}>
                        {newMedication.frequency || 'Select frequency'}
                      </span>
                      <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDurationModalOpen(true);
                      }}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm text-left flex items-center justify-between shadow-sm hover:shadow-md"
                    >
                      <span className={newMedication.duration ? 'text-gray-900' : 'text-gray-500'}>
                        {newMedication.duration || 'Select duration'}
                      </span>
                      <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (newMedication.medication_name && newMedication.dosage) {
                          const medication = { ...newMedication, id: Date.now() };
                          // Added only after the allergy check (straight away when nothing matches)
                          allergyCheck.confirmMedicine(medication.medication_name, () => {
                            setMedications(current => [...current, medication]);
                            setNewMedication({
                              medication_name: '',
                              dosage: '',
                              frequency: '',
                              duration: '',
                              instructions: ''
                            });
                          });
                        }
                      }}
                      className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 text-sm font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                    >
                      Add
                    </button>
                    {allergyCheck.dialog}
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsInstructionsModalOpen(true);
                    }}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-purple-500/30 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 text-sm text-left flex items-center justify-between shadow-sm hover:shadow-md"
                  >
                    <span className={newMedication.instructions ? 'text-gray-900' : 'text-gray-500'}>
                      {newMedication.instructions || 'Select special instructions'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Medications Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Medication</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Dosage</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Frequency</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Duration</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Instructions</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {medications.length > 0 ? (
                        medications.map((med: any) => (
                          <tr key={med.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{med.medication_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{med.dosage}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{med.frequency}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{med.duration}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{med.instructions}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Back into the "Add New Medication" form to change it and add it again, as on Update Visit
                                    const edit = takeMedicineToEdit(medications, med.id);
                                    if (!edit) return;
                                    setNewMedication(edit.form);
                                    setMedications(edit.rest);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                  title="Edit medication"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMedications(medications.filter((m: any) => m.id !== med.id));
                                  }}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                  title="Remove medication"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center">
                              <Pill className="w-12 h-12 text-gray-300 mb-3" />
                              <p className="text-sm">No medications prescribed yet</p>
                              <p className="text-xs text-gray-400 mt-1">Add medications using the form above</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Laboratory Tab */}
        {activeTab === 'laboratory' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <LabResultsTable
              patientId={patientId}
              visitId={newVisitId}
            />
          </motion.div>
        )}

        {/* Imaging Tab */}
        {activeTab === 'imaging' && (
          <ImagingTabContentSimple patientId={patientId} visitId={newVisitId} />
        )}

        {/* Leave Form Tab */}
        {activeTab === 'leave' && (
          newVisitId ? (
            <LeaveFormTab 
              visitId={newVisitId} 
              patientId={patientId} 
              practiceId={practiceId}
              doctorId={appointmentDoctor || user?.id}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Icon icon="solar:document-add-bold-duotone" className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Please save the visit first to create a leave form</p>
              </div>
            </div>
          )
        )}

        {/* Handoff/Documents Tab */}
        {activeTab === 'handoff' && (
          newVisitId ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <HandoffCard 
                visitId={newVisitId}
                patientId={patientId}
                practiceId={practiceId}
                onDocumentsGenerated={() => {
                  console.log('Documents generated successfully');
                }}
              />
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Icon icon="solar:hand-shake-bold-duotone" className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Please save the visit first to generate documents</p>
              </div>
            </div>
          )
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Media Files</h3>
              <p className="text-sm text-gray-600">Upload photos, videos, and other media files for this visit</p>
            </div>
            
            <MediaUploadWrapper
              patientId={patientId}
              visitId={newVisitId}
              onUploadSuccess={(file) => {
                console.log('✅ Media file uploaded:', file);
                console.log('🔄 Triggering media files refresh');
                // Force FileDisplayComponent to refresh
                setMediaRefreshTrigger(prev => prev + 1);
              }}
              onUploadError={(error) => {
                console.error('❌ Media upload error:', error);
                toast.error(`Upload failed: ${error}`);
              }}
            />

            <FileDisplayComponent
              key={`media-display-${mediaRefreshTrigger}`}
              patientId={patientId}
              visitId={newVisitId}
              uploadType="media"
              onFileDelete={(fileId) => {
                console.log('🗑️ Media file deleted:', fileId);
                // Also refresh after delete
                setMediaRefreshTrigger(prev => prev + 1);
              }}
            />
          </motion.div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Services Header with Add Button and Total */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-gray-500">Services</h3>

              </div>

              {/* Code bundles: a set of codes in one click, priced from the tariffs for the visit date */}
              <BundleMenu
                practiceId={practiceId || null}
                practiceType={practiceType}
                tariffs={billableTariffs}
                lines={selectedServices}
                hasMedicalAid={patientHasMedicalAid === true}
                autoInfectionControl={isDental}
                infectionControlStaff={fundPricing.infectionControlStaff}
                askAuthorisation
                disabled={Boolean(billingBlocked)}
                disabledReason={billingBlocked ?? undefined}
                onApply={setSelectedServices}
              />
            </div>

            {/* The account flags that change how this visit is billed or paid (cash only, credit limit, dispute ...) */}
            <AccountFlagBadges patientId={patientId} practiceId={contextPracticeId || practiceId || null} billing label="Account" max={0} className="-mt-4" />

            {/* How this patient's lines are priced: the fund's own schedule, or why billing has to wait */}
            {billingNotice && (
              <div
                role="status"
                className={`-mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  billingBlocked ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-cyan-200 bg-cyan-50 text-cyan-800'
                }`}
              >
                <Icon icon={billingBlocked ? 'solar:danger-triangle-bold-duotone' : 'solar:tag-price-bold-duotone'} className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{billingNotice}</span>
              </div>
            )}

            {/* Prepaid packages and promotions (parity D17, D18): applied to lines added now, each can be undone */}
            <VisitBillingExtras
              ready={!isLoading}
              practiceId={contextPracticeId || practiceId || null}
              patientId={patientId || null}
              invoiceId={null}
              services={selectedServices}
              setServices={setSelectedServices}
              hasMedicalAid={patientHasMedicalAid === true}
              visitDateKey={visitDateKey}
              tariffs={billableTariffs}
              locked={false}
            />

            {/* Dental practices: the tooth chart; tap teeth, then the work for them (one line per tooth) */}
            <TeethBillingPanel
              practiceId={contextPracticeId || practiceId || null}
              practiceType={practiceType}
              patientId={patientId}
              tariffs={billableTariffs}
              lines={selectedServices}
              usage={serviceUsageStats}
              hasMedicalAid={patientHasMedicalAid === true}
              infectionControlStaff={fundPricing.infectionControlStaff}
              disabledReason={billingBlocked ?? null}
              onApply={setSelectedServices}
              canRecordSurfaces={billing.lineTeethEditable}
            />

            {/* Clean Services Table */}
            {selectedServices.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Description</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Unit</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedServices.map((service, index) => (
                        <tr 
                          key={service.id} 
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Row Number */}
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-gray-400 rounded-full">
                              {index + 1}
                            </span>
                          </td>
                          
                          {/* Code with Badges */}
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{service.code}</span>
                              <div className="flex gap-1">
                                {service.isRequired && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded">
                                    Required
                                  </span>
                                )}
                                {service.isAutoGenerated && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-xs font-medium rounded">
                                    Auto
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          
                          {/* Description with Tooth Numbers */}
                          <td className="px-4 py-2">
                            <div className="text-sm text-gray-900 font-medium">
                              {service.description}
                            </div>
                            <div className="flex gap-1 mt-1">
                              {service.teethNumbers && service.teethNumbers.length > 0 && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs font-medium rounded">
                                  Teeth: {service.teethNumbers.join(', ')}
                                </span>
                              )}
                            </div>
                            <BillingLineDetails
                              service={service}
                              visitDate={visitDateKey}
                              visitPractitionerId={visitPractitionerId}
                              practitioners={billing.invoiceContext.practitioners}
                              editable={billing.lineDetailsEditable}
                              hasMedicalAid={patientHasMedicalAid === true}
                              amounts={billing.lineAmounts.get(service.id) ?? null}
                              today={todayKey()}
                              onChange={changes => changeLineDetails(service.id, changes)}
                              icd10={billing.lineIcd10.get(service.id)}
                              codesEditable={billing.lineCodesEditable}
                              canChangeFee={billing.canChangeFee}
                              portionsEditable={billing.linePortionsEditable}
                              teethEditable={billing.lineTeethEditable}
                              authorisation={billing.lineAuthorisations.get(service.id)}
                              people={billing.linePeople}
                              ruleNotices={codeRules.lineNotices.get(service.id)}
                            />
                          </td>
                          
                          {/* Compact Quantity Controls */}
                          <td className="px-4 py-2 text-center">
                            <div className="inline-flex items-center bg-gray-100 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                disabled={!quantityControls(service).editable || service.quantity <= 1}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  changeServiceQuantity(service.id, Math.max(1, service.quantity - 1));
                                }}
                                className={`p-1 text-xs ${
                                  !quantityControls(service).editable || service.quantity <= 1
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                                }`}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-3 py-1 text-sm font-semibold text-gray-900 min-w-[30px] text-center">
                                {service.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={!quantityControls(service).editable || service.quantity >= quantityControls(service).max}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  changeServiceQuantity(service.id, service.quantity + 1);
                                }}
                                className={`p-1 text-xs ${
                                  !quantityControls(service).editable || service.quantity >= quantityControls(service).max
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                                }`}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          
                          {/* Unit Price */}
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatNad(service.unitPrice)}
                            </span>
                          </td>
                          
                          {/* Total */}
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <span className="text-sm font-bold" style={{ color: '#30b4be' }}>
                              {formatNad(service.totalPrice)}
                            </span>
                          </td>
                          
                          {/* Remove Button */}
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              disabled={service.isRequired}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (service.isRequired) return;
                                
                                console.log('🗑️ Removing service:', service.code);
                                const updatedServices = selectedServices.filter(s => s.id !== service.id);
                                
                                // Also remove any auto-generated services that depend on this one
                                const finalServices = updatedServices.filter(s => s.parentServiceId !== service.id);
                                
                                setSelectedServices(finalServices);
                                if (onSelectedServicesChange) onSelectedServicesChange(finalServices);
                              }}
                              className={`p-1 rounded transition-colors ${
                                service.isRequired
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              }`}
                              title={service.isRequired ? 'Required service cannot be removed' : 'Remove service'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* Who pays: the patient, a company account or an injury case (shown when the patient has one) */}
            <VisitPayerCard state={visitPayer} />

            {/* Medical aid patients: who referred the patient, a hospital stay and the place of service (saved with the visit) */}
            <VisitClaimDetailsCard
              state={claimDetails}
              visitDate={visitDateKey}
              hasMedicalAid={patientHasMedicalAid === true}
              practiceId={contextPracticeId || practiceId || null}
              patientId={patientId || null}
              registers={billing.registers}
              authorisationNotices={billing.authorisationNotices}
            />

            {/* Invoice Generation Options */}
            <div>
              <div className="flex items-center mb-4">
                <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, #30b4be, #2a9da6)' }}></div>
                <h4 className="text-md font-semibold text-gray-700 ml-2">Invoice & Payment Options</h4>
              </div>
              
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <div className="space-y-4">
                  {/* Auto Invoice Generation */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          {...register('generateInvoice')}
                          className="sr-only"
                        />
                        <div className={`w-6 h-6 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${
                          watch('generateInvoice') 
                            ? 'border-cyan-500' 
                            : 'border-gray-300 hover:border-cyan-300'
                        }`} style={{
                          background: watch('generateInvoice') 
                            ? 'linear-gradient(135deg, #30b4be, #2a9da6)' 
                            : 'transparent'
                        }}>
                          {watch('generateInvoice') && (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                          <Receipt className="w-4 h-4" style={{ color: '#30b4be' }} />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-900">Generate Invoice Automatically</span>
                          <p className="text-xs text-gray-600">Create and save invoice when visit is updated</p>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* What the invoice comes to, who pays what, and services that look billed twice */}
                  {selectedServices.length > 0 && (
                    <InvoiceBillingSummary
                      totals={billing.totals}
                      hasMedicalAid={patientHasMedicalAid === true}
                      copay={billing.copayRule}
                      invoice={null}
                      duplicates={billing.duplicates}
                      problems={billing.invoiceContext.problems}
                    />
                  )}

                  {/* One step at the desk: the visit and its invoice are saved, then Receive payment opens */}
                  {canTakePayment && selectedServices.length > 0 && (
                    <InvoiceAndPayButton
                      disabled={isSubmitting}
                      onClick={() => {
                        setValue('generateInvoice', true);
                        void handleSubmit(onSubmitAndTakePayment)();
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Add a service: search on top, the practice's most used codes first (every discipline) */}
      <VisitServiceSelector
        open={showServiceModal}
        tariffs={billableTariffs}
        usage={serviceUsageStats}
        onSelect={handleServiceSelect}
        onClose={handleModalCancel}
      />

      {/* Quantity Selection Modal */}
      <AnimatePresence>
        {showQuantityModal && selectedTariff && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={handleModalCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Select Quantity
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedTariff.code} - {selectedTariff.description}
                </p>
              </div>
              
              <div className="p-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">How many of this service?</p>
                  
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setServiceQuantity(Math.max(1, serviceQuantity - 1));
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      style={{ color: '#30b4be' }}
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    
                    <div className="text-3xl font-bold min-w-[60px]" style={{ color: '#30b4be', fontFamily: 'Rubik, sans-serif' }}>
                      {serviceQuantity}
                    </div>
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setServiceQuantity(serviceQuantity + 1);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      style={{ color: '#30b4be' }}
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="text-sm text-gray-600">Total Cost</div>
                    <div className="text-xl font-bold" style={{ color: '#30b4be', fontFamily: 'Rubik, sans-serif' }}>
                      {quantityPreview?.ok ? (
                        <>N${nadParts(quantityPreview.total).whole}<span style={{ color: '#30b4be60' }}>.{nadParts(quantityPreview.total).cents}</span></>
                      ) : quantityPreview ? '—' : 'No valid price'}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleModalCancel();
                      }}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleQuantityNext();
                      }}
                      className="flex-1 px-4 py-2 text-white rounded-lg hover:shadow-lg transition-all"
                      style={{ backgroundColor: '#30b4be' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The teeth for a code that needs one: one or more teeth (milk teeth too), one line per tooth */}
      <ToothPickerDialog
        open={showToothModal && Boolean(selectedTariff)}
        tariff={selectedTariff}
        quantity={serviceQuantity}
        practiceId={practiceId || null}
        patientId={patientId}
        lines={selectedServices}
        tariffs={billableTariffs}
        hasMedicalAid={patientHasMedicalAid === true}
        autoInfectionControl={isDental}
        infectionControlStaff={fundPricing.infectionControlStaff}
        disabledReason={billingBlocked ?? null}
        onApply={lines => {
          setSelectedServices(lines);
          handleModalCancel();
        }}
        onCancel={handleModalCancel}
        canRecordSurfaces={billing.lineTeethEditable}
      />

      {/* Form Actions */}
      <div className="border-t border-gray-200 pt-6 mt-8 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all hover:shadow-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="add-visit-form"
          disabled={isSubmitting}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Visit...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Create Visit
            </>
          )}
        </button>
      </div>

      {/* Cash only / credit limit check when the visit is invoiced */}
      {invoiceFlags.dialog}

      {paymentInvoiceId && user?.practice_id && (
        <VisitTakePayment
          practiceId={user.practice_id}
          patientId={patientId}
          invoiceId={paymentInvoiceId}
          onDone={() => {
            setPaymentInvoiceId(null);
            onSuccess();
          }}
        />
      )}

      {/* Premium Doctor Selection Modal */}
      <AnimatePresence>
        {isDoctorModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsDoctorModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
            >
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Icon icon="solar:user-check-bold-duotone" className="w-6 h-6" />
                  Select Treating Doctor
                </h3>
                <p className="text-green-100 mt-2">Choose the physician for this visit</p>
              </div>
              
              <div className="p-6 max-h-96 overflow-y-auto">
                {loadingDoctors ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                    <span className="ml-2 text-gray-600">Loading doctors...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {doctors.map((doctor) => (
                      <button
                        key={doctor.id}
                        type="button"
                        onClick={() => {
                          setValue('doctor_id', doctor.id);
                          setIsDoctorModalOpen(false);
                        }}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left hover:bg-green-50 hover:border-green-300 ${
                          watch('doctor_id') === doctor.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                            <Icon icon="solar:user-check-bold-duotone" className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{doctor.full_name}</p>
                            <p className="text-sm text-gray-500">Doctor</p>
                          </div>
                          {watch('doctor_id') === doctor.id && (
                            <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-green-500 ml-auto" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setIsDoctorModalOpen(false)}
                  className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Visit Type Selection Modal */}
      <AnimatePresence>
        {isVisitTypeModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsVisitTypeModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
            >
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Icon icon="solar:stethoscope-bold-duotone" className="w-6 h-6" />
                  Select Visit Type
                </h3>
                <p className="text-orange-100 mt-2">Choose the type of medical visit</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-2">
                  {visitTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setValue('visit_type', option.value as any);
                        setIsVisitTypeModalOpen(false);
                      }}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left hover:bg-amber-50 hover:border-amber-300 ${
                        watch('visit_type') === option.value
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                          <Icon icon="solar:stethoscope-bold-duotone" className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{option.label}</p>
                          <p className="text-sm text-gray-500">Medical visit</p>
                        </div>
                        {watch('visit_type') === option.value && (
                          <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-amber-500 ml-auto" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setIsVisitTypeModalOpen(false)}
                  className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddVisitTabs;
