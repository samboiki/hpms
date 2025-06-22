import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save,
  Loader2,
  Microscope,
  ChevronDown,
  Film,
  ImageIcon,
  Upload,
  Search,
  FileText,
  Activity,
  Pill,
  Camera,
  Grid,
  List,
  Filter,
  Weight,
  Thermometer,
  Calendar,
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
import { invoiceService } from '../../services/invoiceService';
import FileUploadComponent from '../uploads/FileUploadComponent';
import FileDisplayComponent from '../uploads/FileDisplayComponent';
import MediaUploadWrapper from '../uploads/MediaUploadWrapper';
import LabResultsTable from '../requests/LabResultsTable';
import ImagingTabContentSimple from '../requests/ImagingTabContentSimple';

interface EditVisitFormData {
  visit_type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  doctor_id?: string;
  encounter_date: Date;
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
  visitId: string;
  patientId: string;
  activeTab: string;
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
        className={`w-full p-3 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-left flex items-center justify-between h-[60px] ${hasIcon ? 'pl-10' : ''}`}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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

const EditVisitTabs: React.FC<Props> = ({ 
  visitId, 
  patientId, 
  activeTab, 
  onSuccess, 
  onCancel,
  selectedServices: externalSelectedServices,
  onSelectedServicesChange
}) => {
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
  
  // Service selection states
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [showToothModal, setShowToothModal] = useState(false);
  const [selectedTariff, setSelectedTariff] = useState<any>(null);
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [selectedTooth, setSelectedTooth] = useState('');
  const [availableTariffs, setAvailableTariffs] = useState<any[]>([]);
  const [serviceUsageStats, setServiceUsageStats] = useState<{[key: string]: number}>({});

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

  // Function to refresh medications
  const refreshMedications = async () => {
    try {
      const { data: existingMedications, error: medicationError } = await (supabase as any)
        .from('medications_with_details')
        .select('*')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: true });

      if (!medicationError && existingMedications && existingMedications.length > 0) {
        console.log('Refreshed medications:', existingMedications);
        setMedications(existingMedications.map((med: any) => ({
          id: med.id,
          medication_name: med.medication_name,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          instructions: med.instructions,
          notes: med.notes
        })));
      } else {
        setMedications([]);
        console.log('No medications found after refresh');
      }
    } catch (medicationError) {
      console.log('Error refreshing medications:', medicationError);
    }
  };

  // Medication modal states
  const [isDosageModalOpen, setIsDosageModalOpen] = useState(false);
  const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState(false);
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<EditVisitFormData>({
    defaultValues: {
      visit_type: 'consultation',
      encounter_date: new Date(),
      chief_complaint: '',
      diagnosis: '',
      treatment_plan: '',
      prescription: '',
      follow_up_required: false,
      follow_up_date: '',
      notes: '',
      vitals: {},
      selectedServices: [],
      generateInvoice: false
    }
  });

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

  // Load existing visit data
  useEffect(() => {
    const fetchVisitData = async () => {
      try {
        setIsLoading(true);

        // Fetch visit data
        const { data: visit, error: visitError } = await supabase
          .from('visits')
          .select('*')
          .eq('id', visitId)
          .single();

        if (visitError) throw visitError;

        // Fetch vitals
        const { data: vitals } = await supabase
          .from('vitals')
          .select('*')
          .eq('visit_id', visitId)
          .order('created_at', { ascending: false })
          .limit(1);

        // Fetch existing services from invoice
        const { data: invoiceData } = await supabase
          .from('invoices_enhanced')
          .select('*')
          .eq('visit_id', visitId)
          .limit(1);

        let invoiceServices: any[] = [];
        if (invoiceData && invoiceData.length > 0) {
          const { data: services } = await supabase
            .from('invoice_services')
            .select('*')
            .eq('invoice_id', invoiceData[0].id);
          invoiceServices = services || [];
        }

        // Fetch existing medications from the view
        try {
          const { data: existingMedications, error: medicationError } = await (supabase as any)
            .from('medications_with_details')
            .select('*')
            .eq('visit_id', visitId)
            .order('created_at', { ascending: true });

          if (!medicationError && existingMedications && existingMedications.length > 0) {
            console.log('Found existing medications:', existingMedications);
            setMedications(existingMedications.map((med: any) => ({
              id: med.id,
              medication_name: med.medication_name,
              dosage: med.dosage,
              frequency: med.frequency,
              duration: med.duration,
              instructions: med.instructions,
              notes: med.notes
            })));
          } else {
            console.log('No existing medications found for this visit');
          }
        } catch (medicationError) {
          console.log('Error fetching medications:', medicationError);
        }

        // Populate form with existing data
        const encounterDateTime = visit.encounter_date ? new Date(visit.encounter_date) : 
          (visit.visit_date && visit.visit_time ? 
            new Date(`${visit.visit_date}T${visit.visit_time}`) : new Date());

        // Set time states
        setSelectedHour(encounterDateTime.getHours().toString().padStart(2, '0'));
        setSelectedMinute(encounterDateTime.getMinutes().toString().padStart(2, '0'));

        const formData = {
          visit_type: (visit.visit_type as 'consultation' | 'follow-up' | 'procedure' | 'emergency') || 'consultation',
          doctor_id: visit.doctor_id || '',
          encounter_date: encounterDateTime || new Date(),
          chief_complaint: visit.chief_complaint || '',
          diagnosis: visit.diagnosis || '',
          treatment_plan: visit.treatment_plan || '',
          prescription: visit.prescription || '',
          follow_up_required: visit.follow_up_required || false,
          follow_up_date: visit.follow_up_date || '',
          notes: visit.notes || '',
          vitals: vitals?.[0] ? {
            blood_pressure: vitals[0].blood_pressure || '',
            temperature: vitals[0].temperature || undefined,
            pulse_rate: vitals[0].pulse_rate || undefined,
            respiratory_rate: vitals[0].respiratory_rate || undefined,
            weight: vitals[0].weight || undefined,
            height: vitals[0].height || undefined,
            bmi: vitals[0].bmi || undefined
          } : {},
          generateInvoice: true,
          selectedServices: []
        };

        // Load existing services
        if (invoiceServices.length > 0) {
          const existingServices = invoiceServices.map((service: any) => ({
            id: service.id,
            tariffId: service.tariff_id,
            code: service.code,
            description: service.description,
            category: 'Service',
            subcategory: 'General',
            unitPrice: service.unit_price,
            quantity: service.quantity,
            totalPrice: service.total_price,
            requiresPreAuth: false,
            medicalAidCovered: false,
            coveragePercentage: 0,
            notes: service.notes
          }));
          setSelectedServices(existingServices);
        }

        reset(formData);
      } catch (error) {
        console.error('Error fetching visit data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisitData();
  }, [visitId, reset]);

  // Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, role')
          .eq('role', 'doctor')
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

  // Fetch appointment doctor if visit has an appointment_id
  useEffect(() => {
    const fetchAppointmentDoctor = async () => {
      try {
        const { data: visitData, error: visitError } = await supabase
          .from('visits')
          .select('appointment_id')
          .eq('id', visitId)
          .single();

        if (visitError) throw visitError;
        
        if (visitData?.appointment_id) {
          const { data: appointmentData, error: appointmentError } = await supabase
            .from('appointments')
            .select('doctor_id')
            .eq('id', visitData.appointment_id)
            .single();

          if (appointmentError) throw appointmentError;
          if (appointmentData?.doctor_id) {
            setAppointmentDoctor(appointmentData.doctor_id);
          }
        }
      } catch (error) {
        console.error('Error fetching appointment doctor:', error);
      }
    };

    fetchAppointmentDoctor();
  }, [visitId]);

  const onSubmit = async (data: EditVisitFormData) => {
    console.log('📝 Form submitted - this should only happen when clicking Update Visit button');
    console.log('Submit event triggered by:', document.activeElement);
    console.trace('Form submission stack trace');
    
    try {
      setIsSubmitting(true);

      // Determine the doctor ID - prioritize appointment doctor over selected doctor
      const finalDoctorId = appointmentDoctor || data.doctor_id;

      // Update the visit record
      const visitData = {
        visit_type: data.visit_type,
        doctor_id: finalDoctorId,
        encounter_date: data.encounter_date ? data.encounter_date.toISOString() : undefined,
        visit_date: data.encounter_date ? data.encounter_date.toISOString().split('T')[0] : undefined,
        visit_time: data.encounter_date ? data.encounter_date.toLocaleTimeString('en-US', { hour12: false }) : undefined,
        chief_complaint: data.chief_complaint || '',
        diagnosis: data.diagnosis || '',
        treatment_plan: data.treatment_plan || '',
        prescription: data.prescription || undefined,
        follow_up_required: data.follow_up_required || false,
        follow_up_date: data.follow_up_date && data.follow_up_date.trim() ? data.follow_up_date : undefined,
        notes: data.notes || undefined,
        updated_at: new Date().toISOString()
      };

      const { error: visitError } = await supabase
        .from('visits')
        .update(visitData)
        .eq('id', visitId);

      if (visitError) throw visitError;

      // Update vitals if provided
      if (Object.keys(data.vitals).some(key => data.vitals[key as keyof typeof data.vitals])) {
        // First try to update existing vitals
        const { data: existingVitals } = await supabase
          .from('vitals')
          .select('id')
          .eq('visit_id', visitId)
          .limit(1);

        if (existingVitals && existingVitals.length > 0) {
          const { error: vitalsError } = await supabase
            .from('vitals')
            .update({
              ...data.vitals
            })
            .eq('id', existingVitals[0].id);

          if (vitalsError) throw vitalsError;
        } else {
          const { error: vitalsError } = await supabase
            .from('vitals')
            .insert([{
              visit_id: visitId,
              ...data.vitals,
              created_at: new Date().toISOString()
            }]);

          if (vitalsError) throw vitalsError;
        }
      }

      // Handle invoice updates if services changed
      if (selectedServices.length > 0 && data.generateInvoice) {
        try {
          // Check if invoice exists
          const { data: existingInvoice, error: invoiceCheckError } = await supabase
            .from('invoices_enhanced')
            .select('id')
            .eq('visit_id', visitId)
            .limit(1);

          if (invoiceCheckError) throw invoiceCheckError;

          if (existingInvoice && existingInvoice.length > 0) {
            // Update existing invoice by deleting old services and adding new ones
            const { error: deleteError } = await supabase
              .from('invoice_services')
              .delete()
              .eq('invoice_id', existingInvoice[0].id);

            if (deleteError) throw deleteError;

            // Add new services
            const serviceRecords = selectedServices.map(service => ({
              invoice_id: existingInvoice[0].id,
              tariff_id: service.tariffId,
              code: service.code,
              description: service.description,
              quantity: service.quantity,
              unit_price: service.unitPrice,
              total_price: service.totalPrice,
              medical_aid_covered: service.medicalAidCovered ? service.totalPrice : 0,
              patient_portion: service.medicalAidCovered ? 0 : service.totalPrice,
              notes: service.notes || '',
              system_transaction_number: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000)
            }));

            const { error: insertError } = await supabase
              .from('invoice_services')
              .insert(serviceRecords);

            if (insertError) throw insertError;
          } else {
            // Create new invoice
            const { data: { user } } = await supabase.auth.getUser();
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
              visitId: visitId,
              patientId,
              practiceId: practiceId || '',
              services: selectedServices,
              medicalAidId: undefined,
              generatePdf: false,
              notes: 'Updated from edit visit form'
            };
            
            await invoiceService.generateInvoiceFromVisit(invoiceRequest);
          }
        } catch (invoiceError) {
          console.error('Invoice update/creation failed:', invoiceError);
          // Show user-friendly error but don't block the main save
          alert(`Invoice update failed: ${invoiceError instanceof Error ? invoiceError.message : 'Unknown error'}. The visit was updated but invoice changes were not saved.`);
        }
      }

      // Save medications to database
      if (medications.length > 0) {
        try {
          // First, delete all existing medications for this visit
          await (supabase as any)
            .from('medications')
            .delete()
            .eq('visit_id', visitId);

          // Get current user for prescribed_by
          const { data: { user } } = await supabase.auth.getUser();
          
          // Use a batch approach - insert new medications
          const medicationPromises = medications.map(async (med) => {
            // Create individual medication record
            const medicationData = {
              visit_id: visitId,
              patient_id: patientId,
              medication_name: med.medication_name,
              dosage: med.dosage,
              frequency: med.frequency,
              duration: med.duration,
              instructions: med.instructions || '',
              prescribed_by: user?.id,
              prescribed_date: new Date().toISOString(),
              status: 'active',
              notes: med.notes || null
            };

            // Skip deletion for individual medications - we'll do a bulk delete first
            // This is handled outside the loop

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
          console.log('Medications saved successfully:', medications.length, 'medications');
          
          // Refresh the medications list after saving
          setTimeout(() => {
            refreshMedications();
          }, 1000);
        } catch (medicationError) {
          console.error('Error saving medications:', medicationError);
          alert(`Medications save failed: ${medicationError instanceof Error ? medicationError.message : 'Unknown error'}. The visit was updated but medications were not saved.`);
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error updating visit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

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

        const { data: practiceData } = await supabase
          .from('practices')
          .select('practice_type')
          .eq('id', userProfile.practice_id)
          .single();

        if (!practiceData || practiceData.practice_type !== 'dental') return;

        // Load tariffs
        const { data: tariffs } = await supabase
          .from('practice_tariffs_with_types')
          .select('*')
          .eq('practice_type_name', 'dental')
          .order('code', { ascending: true });

        if (tariffs) {
          setAvailableTariffs(tariffs);
        }

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
    if (activeTab === 'billing' && availableTariffs.length > 0) {
      const hasInfectionControl = selectedServices.some(s => s.code === '8109');
      
      if (!hasInfectionControl) {
        console.log('🦠 Auto-adding 8109 Infection Control on billing tab load');
        
        const infectionControlTariff = availableTariffs.find(t => t.code === '8109');
        const infectionControlPrice = infectionControlTariff ? parseFloat(infectionControlTariff.price) : 45.0;
        
        const infectionControlService: ServiceSelection = {
          id: crypto.randomUUID(),
          tariffId: infectionControlTariff?.id || 'manual-8109',
          code: '8109',
          description: 'Infection control per visit (Auto-added)',
          category: 'Dental Service',
          subcategory: 'Infection Control',
          unitPrice: infectionControlPrice,
          quantity: 1,
          totalPrice: infectionControlPrice,
          requiresPreAuth: false,
          medicalAidCovered: true,
          coveragePercentage: 100,
          businessRule: 'Automatically added per visit',
          exampleCalculation: `Fixed rate: ${infectionControlPrice}`,
          requiresTeethNumbers: false,
          canBeMultiplied: false,
          teethNumbers: undefined,
          isAutoGenerated: true,
          isRequired: true
        };
        
        const updatedServices = [infectionControlService, ...selectedServices];
        setSelectedServices(updatedServices);
        
        if (onSelectedServicesChange) {
          onSelectedServicesChange(updatedServices);
        }
        
        console.log('✅ Auto-added 8109 Infection Control on billing tab load');
      }
    }
  }, [activeTab, availableTariffs, selectedServices.length]);

  // Helper functions for service selection

  // Business Rules Engine for Dental Services - 10 iterations of refinement
  const getDentalServiceBusinessRules = (tariff: any) => {
    const code = tariff.code;
    const formula = tariff.business_rule_formula?.toLowerCase() || '';
    const canMultiply = tariff.can_be_multiplied;
    const requiresTooth = tariff.requires_tooth_number;
    
    // Iteration 1: Basic categorization
    let ruleType = 'FIXED';
    if (formula.includes('progressive')) ruleType = 'PROGRESSIVE';
    else if (formula.includes('multiply') || formula.includes('×')) ruleType = 'MULTIPLY';
    else if (formula.includes('per visit') || formula.includes('once per visit')) ruleType = 'PER_VISIT';
    else if (canMultiply === 'YES') ruleType = 'MULTIPLY';
    
    // Iteration 2: Special codes handling
    const specialCodes: {[key: string]: any} = {
      '8109': { type: 'INFECTION_CONTROL', maxQuantity: 1, autoAdd: true },
      '8110': { type: 'STERILIZATION', maxQuantity: 1 },
      '8145': { type: 'ANESTHETIC', maxQuantity: 10 }, // Multiple injections
      '8107': { type: 'XRAY', maxQuantity: 7 }, // Max 7 films
      '8163': { type: 'SEALANT', requiresTooth: true, maxTeeth: 32 },
      '8185': { type: 'QUADRANT', maxQuantity: 4 }, // Max 4 quadrants
      '8346': { type: 'MATERIAL_FACTOR', autoGenerated: true, percentage: 0.10 }
    };
    
    // Iteration 3: Progressive pricing rules
    const progressiveCodes = ['8340', '8202', '8328', '8337', '8348'];
    if (progressiveCodes.includes(code)) {
      ruleType = 'PROGRESSIVE';
    }
    
    // Iteration 4: Tooth-specific logic refinement
    const toothLogic = {
      requiresTooth: requiresTooth === 'YES',
      multipleTeeth: canMultiply === 'YES' && requiresTooth === 'YES',
      singleTooth: requiresTooth === 'YES' && canMultiply !== 'YES',
      toothSpecificPricing: code === '8346' // Special pricing per tooth
    };
    
    // Iteration 5: Quantity rules
    const quantityRules = {
      allowQuantity: canMultiply === 'YES' || specialCodes[code]?.maxQuantity > 1,
      minQuantity: 1,
      maxQuantity: specialCodes[code]?.maxQuantity || (ruleType === 'QUADRANT' ? 4 : 99),
      defaultQuantity: 1
    };
    
    // Iteration 6: Auto-generation rules
    const autoGenerateRules: {[key: string]: string[]} = {
      '8341': ['8346'], // Amalgam procedures auto-generate material factor
      '8342': ['8346'],
      '8343': ['8346'],
      '8344': ['8346'],
      '8351': ['8346'], // Resin procedures
      '8352': ['8346'],
      '8353': ['8346'],
      '8354': ['8346'],
      '8367': ['8346'],
      '8368': ['8346'],
      '8369': ['8346'],
      '8370': ['8346']
    };
    
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
    
    // Iteration 8: Pricing calculation rules
    const pricingRules = {
      basePrice: parseFloat(tariff.price) || 0,
      calculation: (quantity: number, toothNumbers?: string[]) => {
        let total = parseFloat(tariff.price) || 0;
        
        if (ruleType === 'PROGRESSIVE') {
          // First item full price, additional at 50% (example)
          total = total + ((quantity - 1) * total * 0.5);
        } else if (ruleType === 'MULTIPLY') {
          total = total * quantity;
        } else if (code === '8346' && toothNumbers) {
          // Special tooth-specific pricing
          total = toothNumbers.length * total;
        }
        
        return total;
      }
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
      ruleType,
      specialCode: specialCodes[code],
      toothLogic,
      quantityRules,
      autoGenerateRules: autoGenerateRules[code] || [],
      validationRules,
      pricingRules,
      workflowRules,
      description: tariff.description,
      isRequired: code === '8109', // Infection control always required
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
      setSelectedTooth('');
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
      setSelectedTooth('');
      setShowToothModal(true);
    } else {
      console.log('➕ Adding service with quantity only');
      addServiceDirectly(selectedTariff, serviceQuantity, '');
    }
  };

  const handleToothNext = () => {
    console.log('🦷✅ Tooth next clicked:', { tooth: selectedTooth, quantity: serviceQuantity });
    setShowToothModal(false);
    addServiceDirectly(selectedTariff, serviceQuantity, selectedTooth);
  };

  const handleModalCancel = () => {
    // Reset all modal states without affecting parent navigation
    setShowServiceModal(false);
    setShowQuantityModal(false);
    setShowToothModal(false);
    setSelectedTariff(null);
    setServiceQuantity(1);
    setSelectedTooth('');
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

    const rules = getDentalServiceBusinessRules(tariff);
    const basePrice = parseFloat(tariff.price) || 0;
    let totalPrice = rules.pricingRules.calculation(quantity, toothNumber ? [toothNumber] : undefined);

    const newService: ServiceSelection = {
      id: crypto.randomUUID(),
      tariffId: tariff.id,
      code: tariff.code,
      description: `${tariff.description}${toothNumber ? ` (Tooth ${toothNumber})` : ''}`,
      category: 'Dental Service',
      subcategory: 'General',
      unitPrice: basePrice,
      quantity: quantity,
      totalPrice: totalPrice,
      requiresPreAuth: false,
      medicalAidCovered: true,
      coveragePercentage: 100,
      businessRule: tariff.business_rule_formula,
      exampleCalculation: tariff.example_calculation,
      requiresTeethNumbers: tariff.requires_tooth_number === 'YES',
      canBeMultiplied: tariff.can_be_multiplied === 'YES',
      teethNumbers: toothNumber ? [toothNumber] : undefined
    };

    let updatedServices = [...selectedServices, newService];
    
    // Auto-add 8109 Infection Control for EVERY service (if not already present)
    const hasInfectionControl = selectedServices.some(s => s.code === '8109');
    if (!hasInfectionControl && tariff.code !== '8109') {
      console.log('🦠 Auto-adding 8109 Infection Control');
      
      // Create 8109 service (use tariff data if available, otherwise create manually)
      const infectionControlTariff = availableTariffs.find(t => t.code === '8109');
      const infectionControlPrice = infectionControlTariff ? parseFloat(infectionControlTariff.price) : 45.0; // Default price
      
      const infectionControlService: ServiceSelection = {
        id: crypto.randomUUID(),
        tariffId: infectionControlTariff?.id || 'manual-8109',
        code: '8109',
        description: 'Infection control per visit (Auto-added)',
        category: 'Dental Service',
        subcategory: 'Infection Control',
        unitPrice: infectionControlPrice,
        quantity: 1,
        totalPrice: infectionControlPrice,
        requiresPreAuth: false,
        medicalAidCovered: true,
        coveragePercentage: 100,
        businessRule: 'Automatically added per visit',
        exampleCalculation: `Fixed rate: ${infectionControlPrice}`,
        requiresTeethNumbers: false,
        canBeMultiplied: false,
        teethNumbers: undefined,
        isAutoGenerated: true,
        isRequired: true,
        parentServiceId: newService.id
      };
      
      updatedServices.unshift(infectionControlService); // Add at beginning
      console.log('✅ Auto-added 8109 Infection Control:', infectionControlPrice);
    }
    
    // Check for 8346 material factor auto-generation
    if (rules.autoGenerateRules.length > 0) {
      console.log('🔄 Auto-generating material factor for codes:', rules.autoGenerateRules);
      
      for (const autoCode of rules.autoGenerateRules) {
        if (autoCode === '8346') {
          // Create 8346 Material Factor service
          const materialTariff = availableTariffs.find(t => t.code === '8346');
          const materialPrice = basePrice * 0.10; // 10% of the service price
          
          const autoService: ServiceSelection = {
            id: crypto.randomUUID(),
            tariffId: materialTariff?.id || 'manual-8346',
            code: '8346',
            description: `Material factor (10% of ${tariff.code})${toothNumber ? ` - Tooth ${toothNumber}` : ''}`,
            category: 'Dental Service',
            subcategory: 'Material Factor',
            unitPrice: materialPrice,
            quantity: quantity,
            totalPrice: materialPrice * quantity,
            requiresPreAuth: false,
            medicalAidCovered: true,
            coveragePercentage: 100,
            businessRule: '10% material factor of primary service',
            exampleCalculation: `${basePrice} × 0.10 = ${materialPrice.toFixed(2)}`,
            requiresTeethNumbers: toothNumber ? true : false,
            canBeMultiplied: false,
            teethNumbers: toothNumber ? [toothNumber] : undefined,
            isAutoGenerated: true,
            parentServiceId: newService.id
          };
          
          updatedServices.push(autoService);
          console.log('✅ Auto-generated 8346 Material Factor:', {
            baseService: tariff.code,
            basePrice,
            materialPrice,
            calculation: `${basePrice} × 0.10 = ${materialPrice.toFixed(2)}`
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
        infectionControl: !selectedServices.some(s => s.code === '8109') && tariff.code !== '8109',
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
    setSelectedTooth('');
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

  return (
    <div className="flex flex-col">
      <form 
        id="edit-visit-form"
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
                <div className="w-1 h-5 bg-[#01b9d4] rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-800 ml-2">Encounter Details</h3>
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
                          className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 bg-white hover:bg-gray-50 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent hover:border-gray-300 border-gray-300 shadow-lg h-[45px]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br shadow-sm from-blue-400 to-cyan-500">
                              <Calendar className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              {watch('encounter_date') ? (
                                <>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {watch('encounter_date').toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    })}
                                  </p>
                                  <p className="text-xs text-gray-500">Selected date</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-semibold text-gray-900">Select Date</p>
                                  <p className="text-xs text-gray-500">Choose encounter date</p>
                                </>
                              )}
                            </div>
                          </div>
                          <ChevronDown className="w-5 h-5 transition-transform text-[#01b9d5]" />
                        </button>
                      </div>
                      {errors.encounter_date && (
                        <p className="text-sm text-red-600 mt-1">Encounter date is required</p>
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
                          className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 bg-white hover:bg-gray-50 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent hover:border-gray-300 border-gray-300 shadow-lg h-[45px]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br shadow-sm from-purple-400 to-pink-500">
                              <Sunset className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {selectedHour}:{selectedMinute}
                              </p>
                              <p className="text-xs text-gray-500">
                                {parseInt(selectedHour) >= 12 ? 'PM' : 'AM'}
                              </p>
                            </div>
                          </div>
                          <Clock className="w-5 h-5 transition-transform text-[#01b9d5]" />
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
                        className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 bg-white hover:bg-gray-50 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent hover:border-gray-300 border-gray-300 shadow-lg h-[45px]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br shadow-sm from-amber-400 to-orange-500">
                            <Stethoscope className="w-4 h-4 text-white" />
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
                        <ChevronDown className="w-5 h-5 transition-transform text-[#01b9d5]" />
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
                        className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 bg-white hover:bg-gray-50 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent hover:border-gray-300 border-gray-300 shadow-lg h-[45px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br shadow-sm from-green-400 to-emerald-500">
                            <Stethoscope className="w-4 h-4 text-white" />
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
                        <ChevronDown className="w-5 h-5 transition-transform text-[#01b9d5]" />
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
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-red-500 rounded-full"></div>
                Chief Complaint
              </h3>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <div className="relative">
                  <input
                    type="text"
                    {...register('chief_complaint', { required: 'Chief complaint is required' })}
                    className="w-full p-3 bg-white border-2 border-red-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all pl-10"
                    placeholder="Primary reason for visit"
                  />
                  <AlertCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-red-500" />
                </div>
                {errors.chief_complaint && (
                  <p className="text-sm text-red-600 mt-1">{errors.chief_complaint.message}</p>
                )}
              </div>
            </div>

            {/* Clinical Assessment Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-green-600 rounded-full"></div>
                Clinical Assessment
              </h3>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Diagnosis
                    </label>
                    <div className="relative">
                      <textarea
                        {...register('diagnosis', { required: 'Diagnosis is required' })}
                        rows={4}
                        className="w-full p-3 bg-white border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all pl-10 resize-none"
                        placeholder="Clinical diagnosis and findings"
                      />
                      <ClipboardList className="absolute left-3 top-3 w-4 h-4 text-green-500" />
                    </div>
                    {errors.diagnosis && (
                      <p className="text-sm text-red-600 mt-1">{errors.diagnosis.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Treatment Plan
                    </label>
                    <div className="relative">
                      <textarea
                        {...register('treatment_plan', { required: 'Treatment plan is required' })}
                        rows={4}
                        className="w-full p-3 bg-white border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pl-10 resize-none"
                        placeholder="Recommended treatment and procedures"
                      />
                      <Stethoscope className="absolute left-3 top-3 w-4 h-4 text-blue-500" />
                    </div>
                    {errors.treatment_plan && (
                      <p className="text-sm text-red-600 mt-1">{errors.treatment_plan.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-purple-600 rounded-full"></div>
                Additional Information
              </h3>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Clinical Notes
                  </label>
                  <div className="relative">
                    <textarea
                      {...register('notes')}
                      rows={3}
                      className="w-full p-3 bg-white border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all pl-10 resize-none"
                      placeholder="Additional notes and observations (optional)"
                    />
                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-purple-500" />
                  </div>
                </div>
              </div>
            </div>
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
                  <select
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                    className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {new Date(currentYear, i).toLocaleDateString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  {/* Year Dropdown */}
                  <select
                    value={currentYear}
                    onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                    className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                  >
                    {Array.from({ length: 50 }, (_, i) => {
                      const year = new Date().getFullYear() - 25 + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
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
                    const currentEncounterDate = watch('encounter_date') || new Date();
                    const newDateTime = new Date(today);
                    // Keep the existing time, just update the date
                    newDateTime.setHours(currentEncounterDate.getHours(), currentEncounterDate.getMinutes(), 0, 0);
                    setSelectedDate(today);
                    setCurrentMonth(today.getMonth());
                    setCurrentYear(today.getFullYear());
                    setValue('encounter_date', newDateTime);
                    setIsDatePickerOpen(false);
                  }}
                  className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-[#01b9d5] to-[#4bc0c8] text-white rounded-lg transition-all font-medium hover:shadow-md"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentEncounterDate = watch('encounter_date') || new Date();
                    const newDateTime = new Date(selectedDate);
                    // Keep the existing time, just update the date
                    newDateTime.setHours(currentEncounterDate.getHours(), currentEncounterDate.getMinutes(), 0, 0);
                    setValue('encounter_date', newDateTime);
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
                      <input 
                        type="text" 
                        value={selectedHour}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d{0,2}$/.test(value) && (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 23))) {
                            setSelectedHour(value.padStart(2, '0'));
                          }
                        }}
                        className="w-16 h-16 text-2xl font-bold text-center rounded-lg border-2 border-gray-200 focus:border-[#01b9d5] focus:outline-none"
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
                      <input 
                        type="text" 
                        value={selectedMinute}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d{0,2}$/.test(value) && (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59))) {
                            setSelectedMinute(value.padStart(2, '0'));
                          }
                        }}
                        className="w-16 h-16 text-2xl font-bold text-center rounded-lg border-2 border-gray-200 focus:border-[#01b9d5] focus:outline-none"
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
                      // Update the encounter_date with new time
                      const currentDate = watch('encounter_date') || new Date();
                      const newDateTime = new Date(currentDate);
                      newDateTime.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);
                      setValue('encounter_date', newDateTime);
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
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-[#01b9d4] rounded-full"></div>
                Primary Vitals
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-red-50 to-red-100/50 p-4 rounded-xl border border-red-200/50">
                  <label className="block text-sm font-semibold text-red-700 mb-2">Blood Pressure</label>
                  <input
                    type="text"
                    {...register('vitals.blood_pressure')}
                    placeholder="120/80"
                    className="w-full p-3 bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                  />
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 p-4 rounded-xl border border-orange-200/50">
                  <label className="block text-sm font-semibold text-orange-700 mb-2">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    {...register('vitals.temperature')}
                    placeholder="36.5"
                    className="w-full p-3 bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-xl border border-purple-200/50">
                  <label className="block text-sm font-semibold text-purple-700 mb-2">Pulse (bpm)</label>
                  <input
                    type="number"
                    {...register('vitals.pulse_rate')}
                    placeholder="72"
                    className="w-full p-3 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-xl border border-blue-200/50">
                  <label className="block text-sm font-semibold text-blue-700 mb-2">Respiratory Rate</label>
                  <input
                    type="number"
                    {...register('vitals.respiratory_rate')}
                    placeholder="16"
                    className="w-full p-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 p-4 rounded-xl border border-cyan-200/50">
                  <label className="block text-sm font-semibold text-cyan-700 mb-2">Oxygen Saturation (%)</label>
                  <input
                    type="number"
                    {...register('vitals.oxygen_saturation')}
                    placeholder="98"
                    className="w-full p-3 bg-white border border-cyan-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Body Measurements Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-purple-600 rounded-full"></div>
                Body Measurements
              </h3>
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
                        className="w-full p-3 bg-white border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all pl-10"
                      />
                      <Weight className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
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
                        className="w-full p-3 bg-white border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pl-10"
                      />
                      <Thermometer className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-500 rotate-90" />
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
                        className="w-full p-3 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-600 cursor-not-allowed pl-10"
                      />
                      <Activity className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <div className="w-1 h-5 bg-green-600 rounded-full"></div>
                  Prescription Notes
                </h3>
                <button
                  type="button"
                  className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  title="AI-Powered Prescription Assistant"
                >
                  <Bot className="w-4 h-4" />
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <textarea
                  {...register('prescription')}
                  rows={6}
                  className="w-full p-3 bg-white border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all shadow-sm hover:shadow-md resize-none"
                  placeholder="General prescription notes and instructions..."
                />
              </div>
            </div>

            {/* Prescribed Medications Table */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                  Prescribed Medications
                </h3>
                <button
                  type="button"
                  onClick={refreshMedications}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
                >
                  <Activity className="w-3 h-3" />
                  Refresh
                </button>
              </div>
              
              {/* Add New Medication Form */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50 mb-6">
                <h4 className="text-md font-semibold text-gray-700 mb-4">Add New Medication</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name</label>
                    <input
                      type="text"
                      value={newMedication.medication_name}
                      onChange={(e) => setNewMedication({...newMedication, medication_name: e.target.value})}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      placeholder="e.g., Amoxicillin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDosageModalOpen(true);
                      }}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-left flex items-center justify-between"
                    >
                      <span className={newMedication.dosage ? 'text-gray-900' : 'text-gray-500'}>
                        {newMedication.dosage || 'Select dosage'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsFrequencyModalOpen(true);
                      }}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-left flex items-center justify-between"
                    >
                      <span className={newMedication.frequency ? 'text-gray-900' : 'text-gray-500'}>
                        {newMedication.frequency || 'Select frequency'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDurationModalOpen(true);
                      }}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-left flex items-center justify-between"
                    >
                      <span className={newMedication.duration ? 'text-gray-900' : 'text-gray-500'}>
                        {newMedication.duration || 'Select duration'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (newMedication.medication_name && newMedication.dosage) {
                          setMedications([...medications, { ...newMedication, id: Date.now() }]);
                          setNewMedication({
                            medication_name: '',
                            dosage: '',
                            frequency: '',
                            duration: '',
                            instructions: ''
                          });
                        }
                      }}
                      className="w-full p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsInstructionsModalOpen(true);
                    }}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-left flex items-center justify-between"
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
              visitId={visitId}
            />
          </motion.div>
        )}

        {/* Imaging Tab */}
        {activeTab === 'imaging' && (
          <ImagingTabContentSimple patientId={patientId} visitId={visitId} />
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
              visitId={visitId}
              onUploadSuccess={(file) => {
                console.log('✅ Media file uploaded:', file);
                console.log('🔄 Triggering media files refresh');
                // Force FileDisplayComponent to refresh
                setMediaRefreshTrigger(prev => prev + 1);
              }}
              onUploadError={(error) => {
                console.error('❌ Media upload error:', error);
                alert(`Upload failed: ${error}`);
              }}
            />
            
            <FileDisplayComponent
              key={`media-display-${mediaRefreshTrigger}`}
              patientId={patientId}
              visitId={visitId}
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
              
           
            </div>

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
                          </td>
                          
                          {/* Compact Quantity Controls */}
                          <td className="px-4 py-2 text-center">
                            <div className="inline-flex items-center bg-gray-100 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                disabled={!service.canBeMultiplied || service.quantity <= 1 || service.isRequired}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const updatedServices = selectedServices.map(s => 
                                    s.id === service.id 
                                      ? { ...s, quantity: Math.max(1, s.quantity - 1), totalPrice: s.unitPrice * Math.max(1, s.quantity - 1) }
                                      : s
                                  );
                                  setSelectedServices(updatedServices);
                                  if (onSelectedServicesChange) onSelectedServicesChange(updatedServices);
                                }}
                                className={`p-1 text-xs ${
                                  !service.canBeMultiplied || service.quantity <= 1 || service.isRequired
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
                                disabled={!service.canBeMultiplied || service.isRequired}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const updatedServices = selectedServices.map(s => 
                                    s.id === service.id 
                                      ? { ...s, quantity: s.quantity + 1, totalPrice: s.unitPrice * (s.quantity + 1) }
                                      : s
                                  );
                                  setSelectedServices(updatedServices);
                                  if (onSelectedServicesChange) onSelectedServicesChange(updatedServices);
                                }}
                                className={`p-1 text-xs ${
                                  !service.canBeMultiplied || service.isRequired
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                                }`}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          
                          {/* Unit Price */}
                          <td className="px-4 py-2 text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              N${service.unitPrice.toFixed(2)}
                            </span>
                          </td>
                          
                          {/* Total */}
                          <td className="px-4 py-2 text-right">
                            <span className="text-sm font-bold" style={{ color: '#30b4be' }}>
                              N${service.totalPrice.toFixed(2)}
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

                  {/* Additional Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                          <Calendar className="w-4 h-4" style={{ color: '#30b4be' }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">Payment Terms</span>
                      </div>
                      <p className="text-xs text-gray-600">Payment due immediately upon service completion</p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                          <CheckCircle2 className="w-4 h-4" style={{ color: '#30b4be' }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">Medical Aid</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {selectedServices.some(s => s.medicalAidCovered) 
                          ? 'Some services covered by medical aid' 
                          : 'No medical aid coverage applied'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Service Selection Modal */}
      <AnimatePresence>
        {showServiceModal && (
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
              className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => {
                e.stopPropagation();
                console.log('🛡️ Modal content clicked - stopping propagation');
              }}
              onSubmit={(e) => {
                e.preventDefault();
                console.log('🚫 Form submission prevented in modal');
              }}
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Select Service
                  </h3>
                  <p className="text-sm text-gray-600">Choose from {availableTariffs.length} available services</p>
                </div>
                <button
                  onClick={handleModalCancel}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Search Bar */}
                <div className="mb-6 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={serviceSearchTerm}
                    onChange={(e) => setServiceSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                  />
                </div>

                {/* Services Grid - 8 per row */}
                <div className="grid grid-cols-8 gap-3">
                  {availableTariffs
                    .filter(tariff => 
                      serviceSearchTerm === '' || 
                      tariff.code.toLowerCase().includes(serviceSearchTerm.toLowerCase()) ||
                      tariff.description.toLowerCase().includes(serviceSearchTerm.toLowerCase())
                    )
                    .sort((a, b) => {
                      // Sort by frequency (most used first)
                      const aUsage = serviceUsageStats[a.code] || 0;
                      const bUsage = serviceUsageStats[b.code] || 0;
                      if (aUsage !== bUsage) return bUsage - aUsage;
                      // Then by code
                      return parseInt(a.code) - parseInt(b.code);
                    })
                    .map((tariff) => {
                      const usageCount = serviceUsageStats[tariff.code] || 0;
                      const maxUsage = Math.max(...Object.values(serviceUsageStats));
                      const heatLevel = maxUsage > 0 ? (usageCount / maxUsage) : 0;
                      
                      // Gradient from light grey to #30b4be based on usage
                      const getGradientStyle = (level: number) => {
                        if (level === 0) {
                          return {
                            backgroundColor: '#f9fafb',
                            borderColor: '#e5e7eb',
                            color: '#6b7280'
                          };
                        }
                        // Gradient calculation from grey to #30b4be
                        const startColor = { r: 249, g: 250, b: 251 }; // Light grey
                        const endColor = { r: 48, g: 180, b: 190 }; // #30b4be
                        
                        const r = Math.round(startColor.r + (endColor.r - startColor.r) * level);
                        const g = Math.round(startColor.g + (endColor.g - startColor.g) * level);
                        const b = Math.round(startColor.b + (endColor.b - startColor.b) * level);
                        
                        return {
                          backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
                          borderColor: `rgba(${r}, ${g}, ${b}, 0.5)`,
                          color: level > 0.5 ? '#30b4be' : '#374151'
                        };
                      };

                      const gradientStyle = getGradientStyle(heatLevel);
                      
                      return (
                        <motion.button
                          key={tariff.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 Service button clicked:', tariff.code);
                            handleServiceSelect(tariff);
                          }}
                          className="p-3 rounded-lg border-2 transition-all text-left hover:shadow-md"
                          style={gradientStyle}
                        >
                          <div className="text-sm font-bold mb-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                            {tariff.code}
                          </div>
                          <div className="text-xs leading-tight mb-2 line-clamp-2">
                            {tariff.description}
                          </div>
                          <div className="text-xs font-semibold" style={{ color: '#30b4be' }}>
                            N${Math.floor(parseFloat(tariff.price))}<span style={{ color: '#30b4be60' }}>.{String(parseFloat(tariff.price).toFixed(2)).split('.')[1]}</span>
                          </div>
                          {usageCount > 0 && (
                            <div className="text-xs mt-1 opacity-60">
                              Used {usageCount}x
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      N${Math.floor(parseFloat(selectedTariff.price) * serviceQuantity)}<span style={{ color: '#30b4be60' }}>.{String((parseFloat(selectedTariff.price) * serviceQuantity).toFixed(2)).split('.')[1]}</span>
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

      {/* Tooth Selection Modal */}
      <AnimatePresence>
        {showToothModal && selectedTariff && (
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
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Select Tooth Number
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedTariff.code} - {selectedTariff.description}
                </p>
              </div>
              
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <p className="text-sm text-gray-600 mb-4 text-center">
                  Select the tooth number(s) for this procedure (FDI notation)
                </p>
                
                {/* Dental Chart */}
                <div className="space-y-4">
                  {/* Upper Jaw */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Upper Jaw</h4>
                    <div className="grid grid-cols-8 gap-2">
                      {/* Right upper quadrant (18-11) */}
                      {[18, 17, 16, 15, 14, 13, 12, 11].map(tooth => (
                        <button
                          type="button"
                          key={tooth}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const toothStr = tooth.toString();
                            if (selectedTooth === toothStr) {
                              setSelectedTooth('');
                            } else {
                              setSelectedTooth(toothStr);
                            }
                          }}
                          className={`p-3 text-sm font-bold rounded-lg border-2 transition-all ${
                            selectedTooth === tooth.toString()
                              ? 'border-2 text-white'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                          style={{
                            backgroundColor: selectedTooth === tooth.toString() ? '#30b4be' : undefined,
                            borderColor: selectedTooth === tooth.toString() ? '#30b4be' : undefined
                          }}
                        >
                          {tooth}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-8 gap-2 mt-2">
                      {/* Left upper quadrant (21-28) */}
                      {[21, 22, 23, 24, 25, 26, 27, 28].map(tooth => (
                        <button
                          type="button"
                          key={tooth}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const toothStr = tooth.toString();
                            if (selectedTooth === toothStr) {
                              setSelectedTooth('');
                            } else {
                              setSelectedTooth(toothStr);
                            }
                          }}
                          className={`p-3 text-sm font-bold rounded-lg border-2 transition-all ${
                            selectedTooth === tooth.toString()
                              ? 'border-2 text-white'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                          style={{
                            backgroundColor: selectedTooth === tooth.toString() ? '#30b4be' : undefined,
                            borderColor: selectedTooth === tooth.toString() ? '#30b4be' : undefined
                          }}
                        >
                          {tooth}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lower Jaw */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Lower Jaw</h4>
                    <div className="grid grid-cols-8 gap-2">
                      {/* Right lower quadrant (48-41) */}
                      {[48, 47, 46, 45, 44, 43, 42, 41].map(tooth => (
                        <button
                          type="button"
                          key={tooth}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const toothStr = tooth.toString();
                            if (selectedTooth === toothStr) {
                              setSelectedTooth('');
                            } else {
                              setSelectedTooth(toothStr);
                            }
                          }}
                          className={`p-3 text-sm font-bold rounded-lg border-2 transition-all ${
                            selectedTooth === tooth.toString()
                              ? 'border-2 text-white'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                          style={{
                            backgroundColor: selectedTooth === tooth.toString() ? '#30b4be' : undefined,
                            borderColor: selectedTooth === tooth.toString() ? '#30b4be' : undefined
                          }}
                        >
                          {tooth}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-8 gap-2 mt-2">
                      {/* Left lower quadrant (31-38) */}
                      {[31, 32, 33, 34, 35, 36, 37, 38].map(tooth => (
                        <button
                          type="button"
                          key={tooth}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const toothStr = tooth.toString();
                            if (selectedTooth === toothStr) {
                              setSelectedTooth('');
                            } else {
                              setSelectedTooth(toothStr);
                            }
                          }}
                          className={`p-3 text-sm font-bold rounded-lg border-2 transition-all ${
                            selectedTooth === tooth.toString()
                              ? 'border-2 text-white'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                          style={{
                            backgroundColor: selectedTooth === tooth.toString() ? '#30b4be' : undefined,
                            borderColor: selectedTooth === tooth.toString() ? '#30b4be' : undefined
                          }}
                        >
                          {tooth}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
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
                      handleToothNext();
                    }}
                    disabled={!selectedTooth}
                    className="flex-1 px-4 py-2 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#30b4be' }}
                  >
                    Add Service
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          form="edit-visit-form"
          disabled={isSubmitting}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Updating Visit...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Update Visit
            </>
          )}
        </button>
      </div>

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
                  <Stethoscope className="w-6 h-6" />
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
                            <Stethoscope className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{doctor.full_name}</p>
                            <p className="text-sm text-gray-500">Doctor</p>
                          </div>
                          {watch('doctor_id') === doctor.id && (
                            <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
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
                  <Stethoscope className="w-6 h-6" />
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
                          <Stethoscope className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{option.label}</p>
                          <p className="text-sm text-gray-500">Medical visit</p>
                        </div>
                        {watch('visit_type') === option.value && (
                          <CheckCircle2 className="w-5 h-5 text-amber-500 ml-auto" />
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

export default EditVisitTabs;