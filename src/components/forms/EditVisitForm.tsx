import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { getResultStatus } from '../../utils/labResultStatus';
import { Image as ImageIcon, X, Upload, Plus, Wand2, Receipt, DollarSign } from 'lucide-react';
import LabResultUpload from '../visits/LabResultUpload';
import MediaUpload from '../visits/MediaUpload';
import ServiceSelector from '../billing/ServiceSelector';
import { ServiceSelection } from '../../types/billing';
import { invoiceService } from '../../services/invoiceService';
import ModernDateTimePicker from '../ui/ModernDateTimePicker';

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
  status: 'in-progress' | 'completed' | 'cancelled';
  vitals: {
    blood_pressure?: string;
    temperature?: number;
    pulse_rate?: number;
    respiratory_rate?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
  lab_results: Array<{
    id?: string;
    name: string;
    value: string;
    unit: string;
    reference_range: string;
    status: 'normal' | 'high' | 'low' | 'critical';
    date: string;
  }>;
  media: Array<{
    type: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'photo';
    url: string;
    description: string;
    date: string;
  }>;
  // Enhanced billing integration (matching AddVisitForm)
  selectedServices: ServiceSelection[];
  generateInvoice: boolean;
  updateInvoice: boolean;
}

interface Props {
  visitId: string;
  patientId: string;
  initialData: EditVisitFormData;
  onSuccess: () => void;
}

interface Doctor {
  id: string;
  full_name: string;
  role: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const EnhancedEditVisitForm: React.FC<Props> = ({ visitId, patientId, initialData, onSuccess }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EditVisitFormData>({
    defaultValues: {
      ...initialData,
      encounter_date: initialData.encounter_date || new Date(),
      lab_results: initialData.lab_results?.map(result => ({
        ...result,
        id: result.id || crypto.randomUUID()
      })) || [],
      media: initialData.media || [],
      selectedServices: initialData.selectedServices || [],
      generateInvoice: initialData.generateInvoice || false,
      updateInvoice: initialData.updateInvoice || false,
      vitals: initialData.vitals || {}
    }
  });
  
  const followUpRequired = watch('follow_up_required');
  const encounterDate = watch('encounter_date');
  const weight = watch('vitals.weight');
  const height = watch('vitals.height');
  const labResults = watch('lab_results');
  const media = watch('media');
  const selectedServices = watch('selectedServices');
  const generateInvoice = watch('generateInvoice');
  const updateInvoice = watch('updateInvoice');
  
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isAiProcessingEnabled, setIsAiProcessingEnabled] = useState<boolean>(true);
  
  // Billing integration state (matching AddVisitForm)
  const [practiceId, setPracticeId] = useState<string>('');
  const [medicalAidId, setMedicalAidId] = useState<string | undefined>(undefined);
  const [patient, setPatient] = useState<any>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [existingInvoiceId, setExistingInvoiceId] = useState<string | null>(null);
  
  // Doctor selection state
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentDoctor, setAppointmentDoctor] = useState<string | null>(null);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // Fetch doctors
  React.useEffect(() => {
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
  React.useEffect(() => {
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

  // Check if AI processing is available when component mounts
  React.useEffect(() => {
    const checkAiProcessing = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        });
        
        console.log('AI processing check response:', {
          status: response.status,
          ok: response.ok
        });

        if (!response.ok) {
          console.warn('AI processing check failed:', {
            status: response.status
          });
          setIsAiProcessingEnabled(false);
          return;
        }

        const responseData = await response.json();
        console.log('AI processing check response data:', responseData);
        setIsAiProcessingEnabled(responseData.status === 'available');
      } catch (error) {
        console.error('Error checking AI processing availability:', error);
        setIsAiProcessingEnabled(false);
      }
    };

    checkAiProcessing();
  }, []);

  // Calculate BMI when weight or height changes
  React.useEffect(() => {
    if (weight && height) {
      const heightInMeters = height / 100;
      const bmi = weight / (heightInMeters * heightInMeters);
      setValue('vitals.bmi', Math.round(bmi * 10) / 10);
    }
  }, [weight, height, setValue]);

  // Fetch patient and practice information for billing
  React.useEffect(() => {
    const fetchPatientInfo = async () => {
      try {
        // Fetch patient details including medical aid
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select(`
            *,
            medical_aid_details(*)
          `)
          .eq('id', patientId)
          .single();

        if (patientError) throw patientError;
        
        setPatient(patientData);
        
        // Set medical aid ID if patient has medical aid
        if (patientData.medical_aid_details && patientData.medical_aid_details.length > 0) {
          setMedicalAidId(patientData.medical_aid_details[0].id);
        }

        // Get current user's practice
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('practice_id')
            .eq('id', user.id)
            .single();
          
          if (userData?.practice_id) {
            setPracticeId(userData.practice_id);
          }
        }

        // Check if there's an existing invoice for this visit
        const { data: invoiceData } = await supabase
          .from('invoices_enhanced')
          .select('id, invoice_number, total, payment_status')
          .eq('visit_id', visitId)
          .single();

        if (invoiceData) {
          setExistingInvoiceId(invoiceData.id);
          setValue('updateInvoice', true);
        }
      } catch (error) {
        console.error('Error fetching patient info:', error);
      }
    };

    if (patientId) {
      fetchPatientInfo();
    }
  }, [patientId, visitId, setValue]);

  // Fetch existing visit services when component mounts
  React.useEffect(() => {
    const fetchVisitServices = async () => {
      try {
        // Fetch visit services with tariff details
        const { data: visitServicesData, error: servicesError } = await supabase
          .from('visit_services')
          .select(`
            *,
            practice_tariffs(
              id,
              code,
              namaf_prace_2025,
              category,
              subcategory,
              price
            )
          `)
          .eq('visit_id', visitId);

        if (servicesError) {
          console.error('Error fetching visit services:', servicesError);
          return;
        }

        if (visitServicesData && visitServicesData.length > 0) {
          // Convert to ServiceSelection format
          const existingServices: ServiceSelection[] = visitServicesData.map(service => ({
            id: crypto.randomUUID(),
            tariffId: service.tariff_id,
            code: service.practice_tariffs?.code || 'UNKNOWN',
            description: service.practice_tariffs?.namaf_prace_2025 || service.notes || 'Unknown Service',
            category: service.practice_tariffs?.category || 'General',
            subcategory: service.practice_tariffs?.subcategory || '',
            unitPrice: service.unit_price || 0,
            quantity: service.quantity || 1,
            totalPrice: service.total_price || 0,
            requiresPreAuth: false,
            medicalAidCovered: false,
            coveragePercentage: 0
          }));

          setValue('selectedServices', existingServices);
        }
      } catch (error) {
        console.error('Error fetching visit services:', error);
      }
    };

    if (visitId) {
      fetchVisitServices();
    }
  }, [visitId, setValue]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload a JPEG, PNG, or WebP image.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File is too large. Maximum size is 5MB.';
    }
    return null;
  };

  const addLabResult = () => {
    setValue('lab_results', [
      ...labResults,
      {
        id: crypto.randomUUID(),
        name: '',
        value: '',
        unit: '',
        reference_range: '',
        status: 'normal',
        date: new Date().toISOString().split('T')[0]
      }
    ]);
  };

  const removeLabResult = (index: number) => {
    setValue('lab_results', labResults.filter((_, i) => i !== index));
  };

  const addMedia = () => {
    setValue('media', [
      ...media,
      {
        type: 'photo',
        url: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      }
    ]);
  };

  const removeMedia = (index: number) => {
    setValue('media', media.filter((_, i) => i !== index));
  };

  const processLabImage = async () => {
    if (!isAiProcessingEnabled) {
      setProcessingError('AI processing is not available. Please try again later.');
      return;
    }

    setProcessingError(null);
    let uploadedFilePath: string | null = null;
    
    try {
      setIsProcessingImage(true);
      
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      
      input.onchange = async (e) => {
        try {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            throw new Error('No file selected');
          }

          console.log('Processing file:', {
            name: file.name,
            type: file.type,
            size: file.size
          });

          const validationError = validateFile(file);
          if (validationError) {
            throw new Error(validationError);
          }

          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
          const filePath = `lab-results/${fileName}`;
          uploadedFilePath = filePath;

          console.log('Uploading file to storage:', filePath);

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('media')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error(`Failed to upload image: ${uploadError.message}`);
          }

          console.log('File uploaded successfully:', uploadData);

          const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);

          console.log('Processing image with AI:', publicUrl);

          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl: publicUrl })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('AI processing failed:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            throw new Error(`AI processing failed: ${response.statusText || errorText}`);
          }

          const responseData = await response.json();
          console.log('AI processing response:', responseData);

          if (responseData.error) {
            throw new Error(`AI processing error: ${responseData.error}`);
          }

          if (Array.isArray(responseData.results)) {
            const newAiLabResults = responseData.results.map((item: any) => {
              const aiStatus = item.status ? String(item.status).toLowerCase() : 'normal';
              // Keep the AI's high/low/critical; anything else ("normal", "borderline", unknown) is checked
              // against the reference range, so an out-of-range value is never shown as Normal
              const formStatus: 'normal' | 'high' | 'low' | 'critical' =
                aiStatus === 'low' || aiStatus === 'high' || aiStatus === 'critical'
                  ? aiStatus
                  : getResultStatus(item.value, item.referenceRange);

              return {
                id: crypto.randomUUID(),
                name: item.testName || 'Untitled Test',
                value: item.value || 'Pending',
                unit: item.unit || '',
                reference_range: item.referenceRange || '',
                status: formStatus,
                date: new Date().toISOString().split('T')[0]
              };
            });

            setValue('lab_results', [
              ...labResults,
              ...newAiLabResults
            ]);
          } else {
            console.error('AI processing response did not contain a results array:', responseData);
            throw new Error('AI processing returned unexpected data format.');
          }

          setProcessingError(null);
        } catch (error) {
          console.error('Error in image processing:', error);

          if (uploadedFilePath) {
            try {
              await supabase.storage
                .from('media')
                .remove([uploadedFilePath]);
              console.log('Cleaned up uploaded file:', uploadedFilePath);
            } catch (cleanupError) {
              console.error('Error cleaning up uploaded file:', cleanupError);
            }
          }

          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while processing the image';
          // No placeholder result: a row named "Processing Failed" with the value "Error" passed
          // validation and was saved to the patient's record as a real lab result
          setProcessingError(errorMessage);
        } finally {
          setIsProcessingImage(false);
        }
      };

      input.click();
    } catch (error) {
      console.error('Error initiating image processing:', error);
      setIsProcessingImage(false);
      setProcessingError('Failed to initiate image processing. Please try again.');
    }
  };

  // Helper function to convert empty strings to null for numeric fields
  const sanitizeVitals = (vitalsData: EditVisitFormData['vitals']) => {
    return {
      blood_pressure: vitalsData.blood_pressure?.trim() || null,
      temperature: vitalsData.temperature || null,
      pulse_rate: vitalsData.pulse_rate || null,
      respiratory_rate: vitalsData.respiratory_rate || null,
      weight: vitalsData.weight || null,
      height: vitalsData.height || null,
      bmi: vitalsData.bmi || null
    };
  };

  const onSubmit = async (data: EditVisitFormData) => {
    try {
      // Determine the doctor ID - prioritize appointment doctor over selected doctor
      const finalDoctorId = appointmentDoctor || data.doctor_id;
      
      // Update the visit
      const { error: visitError } = await supabase
        .from('visits')
        .update({
          visit_type: data.visit_type,
          doctor_id: finalDoctorId,
          encounter_date: data.encounter_date.toISOString(),
          visit_date: data.encounter_date.toISOString().split('T')[0],
          visit_time: data.encounter_date.toLocaleTimeString('en-US', { hour12: false }),
          chief_complaint: data.chief_complaint,
          diagnosis: data.diagnosis,
          treatment_plan: data.treatment_plan,
          prescription: data.prescription || null,
          follow_up_required: data.follow_up_required,
          follow_up_date: data.follow_up_required ? data.follow_up_date : null,
          notes: data.notes || null,
          status: data.status
        })
        .eq('id', visitId);

      if (visitError) throw visitError;

      // Update vitals
      if (data.vitals) {
        const sanitizedVitals = sanitizeVitals(data.vitals);
        if (Object.keys(sanitizedVitals).some(key => sanitizedVitals[key as keyof typeof sanitizedVitals] !== null)) {
          const { error: vitalsError } = await supabase
            .from('vitals')
            .upsert({
              visit_id: visitId,
              ...sanitizedVitals
            });

          if (vitalsError) throw vitalsError;
        }
      }

      // Update lab results
      if (data.lab_results?.length > 0) {
        const labResultsWithIds = data.lab_results.map(result => ({
          id: result.id || crypto.randomUUID(),
          visit_id: visitId,
          ...result
        }));

        const { error: labError } = await supabase
          .from('lab_results')
          .upsert(labResultsWithIds);

        if (labError) throw labError;
      }

      // Update media
      if (data.media?.length > 0) {
        const { error: mediaError } = await supabase
          .from('visit_media')
          .upsert(
            data.media.map(item => ({
              visit_id: visitId,
              ...item
            }))
          );

        if (mediaError) throw mediaError;
      }

      // Save/Update selected services to visit_services table
      if (data.selectedServices.length > 0) {
        // First, delete existing services for this visit
        const { error: deleteError } = await supabase
          .from('visit_services')
          .delete()
          .eq('visit_id', visitId);

        if (deleteError) {
          console.error('Error deleting existing visit services:', deleteError);
          throw deleteError;
        }

        // Then insert the new services
        const visitServices = data.selectedServices.map(service => ({
          visit_id: visitId,
          tariff_id: service.tariffId,
          quantity: service.quantity,
          unit_price: service.unitPrice,
          total_price: service.totalPrice,
          notes: `${service.code} - ${service.description}`
        }));

        const { error: servicesError } = await supabase
          .from('visit_services')
          .insert(visitServices);

        if (servicesError) {
          console.error('Error saving visit services:', servicesError);
          throw servicesError;
        }
      }

      // Handle invoice generation/update
      if ((data.generateInvoice || data.updateInvoice) && data.selectedServices.length > 0 && practiceId) {
        try {
          setIsGeneratingInvoice(true);
          
          if (existingInvoiceId && data.updateInvoice) {
            // Update existing invoice
            const updatedInvoice = await invoiceService.updateInvoiceFromVisit({
              invoiceId: existingInvoiceId,
              visitId: visitId,
              services: data.selectedServices,
              notes: `Updated invoice for ${data.visit_type} visit - ${data.diagnosis}`,
              generatePdf: true
            });

            console.log('Invoice updated successfully:', updatedInvoice.invoiceNumber);
            alert(`Visit updated successfully! Invoice ${updatedInvoice.invoiceNumber} updated to N$ ${updatedInvoice.total.toFixed(2)}`);
          } else if (data.generateInvoice) {
            // Generate new invoice
            const invoice = await invoiceService.generateInvoiceFromVisit({
              visitId: visitId,
              patientId: patientId,
              practiceId: practiceId,
              services: data.selectedServices,
              medicalAidId: medicalAidId,
              notes: `Invoice generated for updated ${data.visit_type} visit - ${data.diagnosis}`,
              generatePdf: true,
              emailToPatient: false
            });

            console.log('Invoice generated successfully:', invoice.invoiceNumber);
            alert(`Visit updated successfully! Invoice ${invoice.invoiceNumber} generated for N$ ${invoice.total.toFixed(2)}`);
          }
        } catch (invoiceError) {
          console.error('Error handling invoice:', invoiceError);
          alert(`Visit updated successfully, but failed to handle invoice: ${invoiceError instanceof Error ? invoiceError.message : 'Unknown error'}`);
        } finally {
          setIsGeneratingInvoice(false);
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error updating visit:', error);
      alert(`Error updating visit: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Encounter Date Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 space-y-4">
        <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Encounter Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Encounter Date & Time *
            </label>
            <ModernDateTimePicker
              value={encounterDate}
              onChange={(date) => setValue('encounter_date', date)}
              placeholder="Select encounter date and time"
              showTime={true}
              className="w-full"
            />
            {errors.encounter_date && (
              <p className="mt-1 text-sm text-red-600">Encounter date is required</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visit Type *
            </label>
            <select
              {...register('visit_type', { required: 'Visit type is required' })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="">Select type</option>
              <option value="consultation">Consultation</option>
              <option value="follow-up">Follow-up</option>
              <option value="procedure">Procedure</option>
              <option value="emergency">Emergency</option>
            </select>
            {errors.visit_type && (
              <p className="mt-1 text-sm text-red-600">{errors.visit_type.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Treating Doctor
              {appointmentDoctor && (
                <span className="text-sm text-blue-600 ml-1">(From Appointment)</span>
              )}
            </label>
            <select
              {...register('doctor_id')}
              disabled={!!appointmentDoctor || loadingDoctors}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Select doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.full_name} ({doctor.role})
                </option>
              ))}
            </select>
            {appointmentDoctor && (
              <p className="mt-1 text-sm text-blue-600">
                Doctor automatically selected from appointment
              </p>
            )}
            {loadingDoctors && (
              <p className="mt-1 text-sm text-gray-500">Loading doctors...</p>
            )}
          </div>
        </div>
      </div>

      {/* Vitals Section - First like AddVisitForm */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Vitals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Blood Pressure (mmHg)</label>
            <input
              type="text"
              placeholder="120/80"
              {...register('vitals.blood_pressure', {
                pattern: {
                  value: /^\d{2,3}\/\d{2,3}$/,
                  message: 'Invalid format. Use systolic/diastolic (e.g., 120/80)'
                }
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.vitals?.blood_pressure && (
              <p className="mt-1 text-sm text-red-600">{errors.vitals.blood_pressure.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Temperature (°C)</label>
            <input
              type="number"
              step="0.1"
              {...register('vitals.temperature', {
                min: { value: 35, message: 'Temperature too low' },
                max: { value: 42, message: 'Temperature too high' },
                valueAsNumber: true,
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.vitals?.temperature && (
              <p className="mt-1 text-sm text-red-600">{errors.vitals.temperature.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Pulse Rate (bpm)</label>
            <input
              type="number"
              {...register('vitals.pulse_rate', {
                min: { value: 40, message: 'Pulse rate too low' },
                max: { value: 200, message: 'Pulse rate too high' },
                valueAsNumber: true,
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.vitals?.pulse_rate && (
              <p className="mt-1 text-sm text-red-600">{errors.vitals.pulse_rate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Respiratory Rate (breaths/min)</label>
            <input
              type="number"
              {...register('vitals.respiratory_rate', {
                min: { value: 8, message: 'Respiratory rate too low' },
                max: { value: 40, message: 'Respiratory rate too high' },
                valueAsNumber: true,
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.vitals?.respiratory_rate && (
              <p className="mt-1 text-sm text-red-600">{errors.vitals.respiratory_rate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              {...register('vitals.weight', {
                min: { value: 0, message: 'Weight must be positive' },
                valueAsNumber: true,
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.vitals?.weight && (
              <p className="mt-1 text-sm text-red-600">{errors.vitals.weight.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
            <input
              type="number"
              {...register('vitals.height', {
                min: { value: 0, message: 'Height must be positive' },
                valueAsNumber: true,
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.vitals?.height && (
              <p className="mt-1 text-sm text-red-600">{errors.vitals.height.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">BMI</label>
            <input
              type="number"
              step="0.1"
              {...register('vitals.bmi', { valueAsNumber: true })}
              readOnly
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Lab Results Section */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Lab Results</h3>
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={processLabImage}
              disabled={isProcessingImage || !isAiProcessingEnabled}
              title={!isAiProcessingEnabled ? 'AI processing is not available' : (isProcessingImage ? 'Processing image...' : 'Process lab image with AI')}
            >
              <Wand2 size={16} className="mr-2" />
              {isProcessingImage ? 'Processing...' : 'Process Lab Image'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addLabResult}>
              <Plus size={16} className="mr-2" />
              Add Result
            </Button>
          </div>
        </div>

        {processingError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{processingError}</span>
          </div>
        )}

        {!isAiProcessingEnabled && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">
              AI processing is currently unavailable. Please try again later or add results manually.
            </span>
          </div>
        )}

        {labResults.map((resultItem, index) => (
          <div key={resultItem.id || index} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-sm font-medium text-gray-900">Result #{index + 1}</h4>
              <button
                type="button"
                onClick={() => removeLabResult(index)}
                className="text-gray-400 hover:text-red-600"
                title="Remove this lab result"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Test Name</label>
                <input
                  type="text"
                  {...register(`lab_results.${index}.name` as const, { required: "Test name is required" })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
                 {errors.lab_results?.[index]?.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.lab_results[index]?.name?.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Value</label>
                <input
                  type="text"
                  {...register(`lab_results.${index}.value` as const, { required: "Value is required" })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
                {errors.lab_results?.[index]?.value && (
                  <p className="mt-1 text-sm text-red-600">{errors.lab_results[index]?.value?.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Unit</label>
                <input
                  type="text"
                  {...register(`lab_results.${index}.unit` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Reference Range</label>
                <input
                  type="text"
                  {...register(`lab_results.${index}.reference_range` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  {...register(`lab_results.${index}.status` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  {...register(`lab_results.${index}.date` as const, { required: "Date is required"})}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
                 {errors.lab_results?.[index]?.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.lab_results[index]?.date?.message}</p>
                )}
              </div>
            </div>
          </div>
        ))}
         {labResults.length === 0 && !isProcessingImage && (
            <p className="text-sm text-gray-500">No lab results added. Click "Process Lab Image" or "Add Result".</p>
        )}
      </div>

      {/* Media Section */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Media</h3>
          <Button type="button" variant="outline" size="sm" onClick={addMedia}>
            <ImageIcon size={16} className="mr-2" />
            Add Media
          </Button>
        </div>

        {media.map((mediaItem, index) => (
          <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-sm font-medium text-gray-900">Media #{index + 1}</h4>
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="text-gray-400 hover:text-red-600"
                title="Remove this media item"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  {...register(`media.${index}.type` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="photo">Photo</option>
                  <option value="xray">X-Ray</option>
                  <option value="ct">CT Scan</option>
                  <option value="mri">MRI</option>
                  <option value="ultrasound">Ultrasound</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  {...register(`media.${index}.description` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  {...register(`media.${index}.date` as const, { required: "Media date is required"})}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
                 {errors.media?.[index]?.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.media[index]?.date?.message}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <MediaUpload
                type={watch(`media.${index}.type`)}
                onUpload={(url) => {
                  setValue(`media.${index}.url`, url);
                }}
              />
               {watch(`media.${index}.url`) && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500">Uploaded: <a href={watch(`media.${index}.url`)} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">{watch(`media.${index}.url`)}</a></p>
                </div>
              )}
            </div>
          </div>
        ))}
        {media.length === 0 && (
            <p className="text-sm text-gray-500">No media items added. Click "Add Media".</p>
        )}
      </div>


      <div>
        <label className="block text-sm font-medium text-gray-700">Chief Complaint</label>
        <textarea
          {...register('chief_complaint', { required: 'Chief complaint is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.chief_complaint && (
          <p className="mt-1 text-sm text-red-600">{errors.chief_complaint.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Diagnosis</label>
        <textarea
          {...register('diagnosis', { required: 'Diagnosis is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.diagnosis && (
          <p className="mt-1 text-sm text-red-600">{errors.diagnosis.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Treatment Plan</label>
        <textarea
          {...register('treatment_plan', { required: 'Treatment plan is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.treatment_plan && (
          <p className="mt-1 text-sm text-red-600">{errors.treatment_plan.message}</p>
        )}
      </div>

      {/* Enhanced Billing Services Section */}
      {practiceId && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900">Billing & Services</h3>
            </div>
            <div className="flex items-center space-x-4">
              {existingInvoiceId && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('updateInvoice')}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    id="update_invoice"
                  />
                  <label htmlFor="update_invoice" className="ml-2 block text-sm text-blue-700 font-medium">
                    Update Existing Invoice
                  </label>
                </div>
              )}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('generateInvoice')}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  id="generate_invoice"
                />
                <label htmlFor="generate_invoice" className="ml-2 block text-sm text-blue-700 font-medium">
                  Generate New Invoice
                </label>
              </div>
            </div>
          </div>
          
          {existingInvoiceId && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This visit already has an associated invoice. You can update the existing invoice or generate a new one.
              </p>
            </div>
          )}
          
          <ServiceSelector
            practiceId={practiceId}
            selectedServices={selectedServices}
            onServiceChange={(services) => setValue('selectedServices', services)}
            medicalAidId={medicalAidId}
            readOnly={false}
          />
          
          {selectedServices.length > 0 && (
            <div className="mt-4 p-4 bg-white border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Services Cost:</span>
                <span className="text-lg font-bold text-blue-600">
                  N$ {selectedServices.reduce((total, service) => total + service.totalPrice, 0).toFixed(2)}
                </span>
              </div>
              {medicalAidId && (
                <div className="mt-2 text-xs text-green-600">
                  * Medical aid coverage will be calculated during invoice generation
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Prescription</label>
        <textarea
          {...register('prescription')}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          placeholder="Enter prescription details if applicable"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          {...register('follow_up_required')}
          className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
          id="follow_up_required"
        />
        <label htmlFor="follow_up_required" className="ml-2 block text-sm text-gray-700">
          Follow-up Required
        </label>
      </div>

      {followUpRequired && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Follow-up Date</label>
          <input
            type="date"
            {...register('follow_up_date', {
              required: followUpRequired ? 'Follow-up date is required' : false
            })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
          {errors.follow_up_date && (
            <p className="mt-1 text-sm text-red-600">{errors.follow_up_date.message}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Status</label>
        <select
          {...register('status', { required: 'Status is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        >
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {errors.status && (
          <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Additional Notes</label>
        <textarea
          {...register('notes')}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          placeholder="Any additional notes or observations"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isProcessingImage || isGeneratingInvoice}>
          {isGeneratingInvoice ? 'Updating & Processing Invoice...' : 'Update Visit'}
        </Button>
      </div>
    </form>
  );
};

export default EnhancedEditVisitForm;

// Maintain backward compatibility
export { EnhancedEditVisitForm as EditVisitForm };