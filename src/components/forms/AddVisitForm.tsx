import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { Image as ImageIcon, X, Upload, Plus, Wand2, Receipt, DollarSign } from 'lucide-react';
import LabResultUpload from '../visits/LabResultUpload';
import MediaUpload from '../visits/MediaUpload';
import EnhancedServiceSelector from '../billing/EnhancedServiceSelector';
import { ServiceSelection } from '../../types/billing';
import { invoiceService } from '../../services/invoiceService';
import ModernDateTimePicker from '../ui/ModernDateTimePicker';

interface AddVisitFormData {
  visit_type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
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
  // Billing integration
  selectedServices: ServiceSelection[];
  generateInvoice: boolean;
}

interface Props {
  patientId: string;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const AddVisitForm: React.FC<Props> = ({ patientId, onSuccess }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AddVisitFormData>({
    defaultValues: {
      encounter_date: new Date(),
      lab_results: [],
      media: [],
      selectedServices: [],
      generateInvoice: true
    }
  });
  const followUpRequired = watch('follow_up_required');
  const encounterDate = watch('encounter_date');
  const weight = watch('vitals.weight');
  const height = watch('vitals.height');
  const labResults = watch('lab_results'); // This will be up-to-date due to react-hook-form's watch
  const media = watch('media');
  const selectedServices = watch('selectedServices');
  const generateInvoice = watch('generateInvoice');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isAiProcessingEnabled, setIsAiProcessingEnabled] = useState<boolean>(true); // Default to true, check will update
  
  // Billing integration state
  const [practiceId, setPracticeId] = useState<string>('');
  const [medicalAidId, setMedicalAidId] = useState<string | undefined>(undefined);
  const [patient, setPatient] = useState<any>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

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
      } catch (error) {
        console.error('Error fetching patient info:', error);
      }
    };

    if (patientId) {
      fetchPatientInfo();
    }
  }, [patientId]);

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
      ...labResults, // labResults from watch is up-to-date
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
      ...media, // media from watch is up-to-date
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

          // ***** MODIFIED SECTION START *****
          if (Array.isArray(responseData.results)) {
            const newAiLabResults = responseData.results.map((item: any) => {
              let formStatus: 'normal' | 'high' | 'low' | 'critical' = 'normal'; // Default
              const aiStatus = item.status ? String(item.status).toLowerCase() : 'normal';

              if (aiStatus === 'low') {
                formStatus = 'low';
              } else if (aiStatus === 'high') {
                formStatus = 'high';
              } else if (aiStatus === 'critical') {
                formStatus = 'critical';
              } else if (aiStatus === 'normal' || aiStatus === 'borderline') {
                formStatus = 'normal';
              }

              return {
                id: crypto.randomUUID(),
                name: item.testName || 'Untitled Test',
                value: item.value || 'Pending',
                unit: item.unit || '',
                reference_range: item.referenceRange || '', // Maps AI's referenceRange to form's reference_range
                status: formStatus,
                date: new Date().toISOString().split('T')[0]
              };
            });

            setValue('lab_results', [
              ...labResults, // labResults from watch() is the current state of the array in the form
              ...newAiLabResults
            ]);
          } else {
            console.error('AI processing response did not contain a results array:', responseData);
            throw new Error('AI processing returned unexpected data format.');
          }
          // ***** MODIFIED SECTION END *****

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
          setProcessingError(errorMessage);
          
          // Add a blank lab result even if processing fails (original behavior)
          // Consider if this is desired or if the error message alone is sufficient
          setValue('lab_results', [
            ...labResults,
            {
              id: crypto.randomUUID(),
              name: 'Untitled Test (Processing Failed)',
              value: 'Error',
              unit: '',
              reference_range: '',
              status: 'normal', // Or a specific error status if you add one
              date: new Date().toISOString().split('T')[0]
            }
          ]);
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
  const sanitizeVitals = (vitalsData: AddVisitFormData['vitals']) => {
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

  const onSubmit = async (data: AddVisitFormData) => {
    try {
      // First insert the visit
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .insert([{
          patient_id: patientId,
          visit_type: data.visit_type,
          encounter_date: data.encounter_date.toISOString(),
          visit_date: data.encounter_date.toISOString().split('T')[0],
          visit_time: data.encounter_date.toLocaleTimeString('en-US', { hour12: false }),
          chief_complaint: data.chief_complaint,
          diagnosis: data.diagnosis,
          treatment_plan: data.treatment_plan,
          prescription: data.prescription,
          follow_up_required: data.follow_up_required,
          follow_up_date: data.follow_up_date,
          notes: data.notes,
          status: 'in-progress' // Consider making this dynamic if needed
        }])
        .select()
        .single();

      if (visitError) throw visitError;

      if (visitData) {
        // Insert vitals with correct column names for actual database schema
        const vitalsData = {
          visit_id: visitData.id,
          blood_pressure: data.vitals.blood_pressure?.trim() || null,
          temperature: data.vitals.temperature || null,
          pulse_rate: data.vitals.pulse_rate || null,
          respiratory_rate: data.vitals.respiratory_rate || null,
          weight: data.vitals.weight || null,
          height: data.vitals.height || null,
          bmi: data.vitals.bmi || null
        };

        const { error: vitalsError } = await supabase
          .from('vitals')
          .insert([vitalsData]);

        if (vitalsError) throw vitalsError;

        // Insert lab results
        if (data.lab_results.length > 0) {
          const { error: labError } = await supabase
            .from('lab_results')
            .insert(
              data.lab_results.map(result => ({
                visit_id: visitData.id,
                // Ensure 'id' from form (crypto.randomUUID()) is not sent if your DB auto-generates it
                // If your DB's lab_results table has its own auto-incrementing ID, you might want to omit `result.id`
                // For now, assuming your DB schema for lab_results can take an `id` or ignores it if it's a primary key.
                ...result 
              }))
            );

          if (labError) throw labError;
        }

        // Insert media
        if (data.media.length > 0) {
          const { error: mediaError } = await supabase
            .from('visit_media')
            .insert(
              data.media.map(item => ({
                visit_id: visitData.id,
                ...item
              }))
            );

          if (mediaError) throw mediaError;
        }

        // Save selected services to visit_services table
        if (data.selectedServices.length > 0) {
          const visitServices = data.selectedServices.map(service => ({
            visit_id: visitData.id,
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

        // Generate invoice if services are selected and invoice generation is enabled
        if (data.generateInvoice && data.selectedServices.length > 0 && practiceId) {
          try {
            setIsGeneratingInvoice(true);
            
            console.log('🔍 ADD VISIT FORM - STEP 5: About to generate invoice');
            console.log('🔍 ADD VISIT FORM - STEP 5: Patient ID:', patientId);
            console.log('🔍 ADD VISIT FORM - STEP 5: Medical Aid ID:', medicalAidId);
            console.log('🔍 ADD VISIT FORM - STEP 5: Services being sent to invoice service:');
            data.selectedServices.forEach((service, i) => {
              console.log(`🔍 ADD VISIT FORM - STEP 5: Service ${i+1}:`, {
                code: service.code,
                medicalAidCovered: service.medicalAidCovered,
                coveragePercentage: service.coveragePercentage,
                totalPrice: service.totalPrice
              });
            });
            
            const invoice = await invoiceService.generateInvoiceFromVisit({
              visitId: visitData.id,
              patientId: patientId,
              practiceId: practiceId,
              services: data.selectedServices,
              medicalAidId: medicalAidId,
              notes: `Invoice generated for ${data.visit_type} visit - ${data.diagnosis}`,
              generatePdf: true,
              emailToPatient: false // TODO: Make this configurable
            });

            console.log('Invoice generated successfully:', invoice.invoiceNumber);
            
            // Show success message with invoice number
            alert(`Visit recorded successfully! Invoice ${invoice.invoiceNumber} generated for N$ ${invoice.total.toFixed(2)}`);
          } catch (invoiceError) {
            console.error('Error generating invoice:', invoiceError);
            // Don't fail the entire visit creation if invoice generation fails
            alert(`Visit recorded successfully, but failed to generate invoice: ${invoiceError instanceof Error ? invoiceError.message : 'Unknown error'}`);
          } finally {
            setIsGeneratingInvoice(false);
          }
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error adding visit:', error);
      // Consider setting a form-level error message for the user here
      // For example, using a state variable and displaying it in the UI.
      // For now, it just throws, which might not be user-friendly.
      alert(`Error adding visit: ${error instanceof Error ? error.message : String(error)}`);

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
        </div>
      </div>

      {/* Vitals Section */}
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100" // Slightly different bg for readonly
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

        {labResults.map((resultItem, index) => ( // Use resultItem to avoid confusion with outer scope 'labResults'
          <div key={resultItem.id || index} className="bg-white p-4 rounded-lg border border-gray-200"> {/* Use resultItem.id for key if available */}
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-sm font-medium text-gray-900">Result #{index + 1}</h4>
              <button
                type="button"
                onClick={() => removeLabResult(index)}
                className="text-gray-400 hover:text-red-600" // More indicative color on hover for removal
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

            {/* Conditionally render LabResultUpload or remove if not used per item */}
            {/* <div className="mt-4">
              <LabResultUpload
                onUpload={(data) => { // This data structure needs to match lab_results item
                  const currentLabResultItem = watch(`lab_results.${index}`);
                  setValue(`lab_results.${index}`, {
                    ...currentLabResultItem, // preserve existing fields like ID
                    ...data, // data from LabResultUpload (name, value, unit etc.)
                    date: new Date().toISOString().split('T')[0] // Overwrite date or use data.date if provided
                  });
                }}
              />
            </div> */}
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

        {media.map((mediaItem, index) => ( // Use mediaItem
          <div key={index} className="bg-white p-4 rounded-lg border border-gray-200"> {/* Consider using a unique ID for key if media items have one */}
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
                  // Potentially set description or other fields based on upload if needed
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

      {/* Billing Services Section */}
      {practiceId && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900">Billing & Services</h3>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('generateInvoice')}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                id="generate_invoice"
              />
              <label htmlFor="generate_invoice" className="ml-2 block text-sm text-blue-700 font-medium">
                Generate Invoice
              </label>
            </div>
          </div>
          
          <EnhancedServiceSelector
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
          id="follow_up_required" // Added id for label association
        />
        <label htmlFor="follow_up_required" className="ml-2 block text-sm text-gray-700"> {/* Use htmlFor */}
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
        <Button type="submit" disabled={isProcessingImage}> {/* Disable submit while AI processing */}
          Record Visit
        </Button>
      </div>
    </form>
  );
};

export default AddVisitForm;