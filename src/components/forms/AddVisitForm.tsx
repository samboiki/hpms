import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { Image as ImageIcon, X, Upload, Plus, Wand2 } from 'lucide-react';
import LabResultUpload from '../visits/LabResultUpload';
import MediaUpload from '../visits/MediaUpload';

interface AddVisitFormData {
  visit_type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
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
      lab_results: [],
      media: []
    }
  });
  const followUpRequired = watch('follow_up_required');
  const weight = watch('vitals.weight');
  const height = watch('vitals.height');
  const labResults = watch('lab_results');
  const media = watch('media');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isAiProcessingEnabled, setIsAiProcessingEnabled] = useState<boolean>(true);

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
            throw new Error(`AI processing failed: ${response.statusText}`);
          }

          const responseData = await response.json();
          console.log('AI processing response:', responseData);

          if (responseData.error) {
            throw new Error(`AI processing error: ${responseData.error}`);
          }

          if (!responseData.testName && !responseData.value) {
            throw new Error('AI processing could not extract required data from the image');
          }

          setValue('lab_results', [
            ...labResults,
            {
              id: crypto.randomUUID(),
              name: responseData.testName || 'Unknown Test',
              value: responseData.value || '',
              unit: responseData.unit || '',
              reference_range: responseData.referenceRange || '',
              status: responseData.status || 'normal',
              date: new Date().toISOString().split('T')[0]
            }
          ]);

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
          
          // Add a blank lab result even if processing fails
          setValue('lab_results', [
            ...labResults,
            {
              id: crypto.randomUUID(),
              name: 'Unknown Test',
              value: '',
              unit: '',
              reference_range: '',
              status: 'normal',
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
  const sanitizeVitals = (vitals: AddVisitFormData['vitals']) => {
    return {
      blood_pressure: vitals.blood_pressure?.trim() || null,
      temperature: vitals.temperature || null,
      pulse_rate: vitals.pulse_rate || null,
      respiratory_rate: vitals.respiratory_rate || null,
      weight: vitals.weight || null,
      height: vitals.height || null,
      bmi: vitals.bmi || null
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
          visit_date: new Date().toISOString().split('T')[0],
          visit_time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          chief_complaint: data.chief_complaint,
          diagnosis: data.diagnosis,
          treatment_plan: data.treatment_plan,
          prescription: data.prescription,
          follow_up_required: data.follow_up_required,
          follow_up_date: data.follow_up_date,
          notes: data.notes,
          status: 'in-progress'
        }])
        .select()
        .single();

      if (visitError) throw visitError;

      if (visitData) {
        // Insert vitals with sanitized values and link to visit
        const sanitizedVitals = sanitizeVitals(data.vitals);
        const { error: vitalsError } = await supabase
          .from('vitals')
          .insert([{
            visit_id: visitData.id,
            ...sanitizedVitals
          }]);

        if (vitalsError) throw vitalsError;

        // Insert lab results
        if (data.lab_results.length > 0) {
          const { error: labError } = await supabase
            .from('lab_results')
            .insert(
              data.lab_results.map(result => ({
                visit_id: visitData.id,
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
      }

      onSuccess();
    } catch (error) {
      console.error('Error adding visit:', error);
      throw error;
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                max: { value: 42, message: 'Temperature too high' }
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
                max: { value: 200, message: 'Pulse rate too high' }
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
                max: { value: 40, message: 'Respiratory rate too high' }
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
                min: { value: 0, message: 'Weight must be positive' }
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
                min: { value: 0, message: 'Height must be positive' }
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
              {...register('vitals.bmi')}
              readOnly
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
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
              title={!isAiProcessingEnabled ? 'AI processing is not available' : undefined}
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
              AI processing is currently unavailable. Please try again later.
            </span>
          </div>
        )}

        {labResults.map((_, index) => (
          <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-sm font-medium text-gray-900">Result #{index + 1}</h4>
              <button
                type="button"
                onClick={() => removeLabResult(index)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Test Name</label>
                <input
                  type="text"
                  {...register(`lab_results.${index}.name` as const, { required: true })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Value</label>
                <input
                  type="text"
                  {...register(`lab_results.${index}.value` as const, { required: true })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
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
                  {...register(`lab_results.${index}.date` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-4">
              <LabResultUpload
                onUpload={(data) => {
                  setValue(`lab_results.${index}`, {
                    ...data,
                    date: new Date().toISOString().split('T')[0]
                  });
                }}
              />
            </div>
          </div>
        ))}
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

        {media.map((_, index) => (
          <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-sm font-medium text-gray-900">Media #{index + 1}</h4>
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="text-gray-400 hover:text-gray-600"
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
                  {...register(`media.${index}.date` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-4">
              <MediaUpload
                type={watch(`media.${index}.type`)}
                onUpload={(url) => {
                  setValue(`media.${index}.url`, url);
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Visit Type</label>
        <select
          {...register('visit_type', { required: 'Visit type is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
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
        />
        <label className="ml-2 block text-sm text-gray-700">
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
        <Button type="submit">
          Record Visit
        </Button>
      </div>
    </form>
  );
};

export default AddVisitForm;