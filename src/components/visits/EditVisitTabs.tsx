import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { 
  Save,
  Loader2,
  Microscope,
  CheckCircle,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ModernDateTimePicker from '../ui/ModernDateTimePicker';

interface EditVisitFormData {
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
    oxygen_saturation?: number;
  };
}

interface Props {
  visitId: string;
  patientId: string;
  activeTab: string;
  onSuccess: () => void;
  onCancel: () => void;
}

// Professional Visit Type Dropdown
const ProfessionalDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: string }[];
  placeholder?: string;
}> = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-white border-2 border-[#01b9d4]/20 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all shadow-sm hover:shadow-md text-left flex items-center justify-between"
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full p-3 text-left hover:bg-[#01b9d4]/5 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const EditVisitTabs: React.FC<Props> = ({ visitId, patientId, activeTab, onSuccess, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<EditVisitFormData>({
    defaultValues: {
      visit_type: 'consultation',
      encounter_date: new Date(),
      vitals: {}
    }
  });

  const visitTypeOptions = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'follow-up', label: 'Follow-up Visit' },
    { value: 'procedure', label: 'Procedure' },
    { value: 'emergency', label: 'Emergency' }
  ];

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

        // Populate form with existing data
        const formData = {
          visit_type: visit.visit_type || 'consultation',
          encounter_date: visit.encounter_date ? new Date(visit.encounter_date) : 
            (visit.visit_date && visit.visit_time ? 
              new Date(`${visit.visit_date}T${visit.visit_time}`) : new Date()),
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
            bmi: vitals[0].bmi || undefined,
            oxygen_saturation: vitals[0].oxygen_saturation || undefined
          } : {}
        };

        reset(formData);
      } catch (error) {
        console.error('Error fetching visit data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisitData();
  }, [visitId, reset]);

  const onSubmit = async (data: EditVisitFormData) => {
    try {
      setIsSubmitting(true);

      // Update the visit record
      const visitData = {
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

      onSuccess();
    } catch (error) {
      console.error('Error updating visit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        {/* General Tab */}
        {activeTab === 'general' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Encounter Date & Time */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Encounter Date & Time
              </label>
              <ModernDateTimePicker
                value={watch('encounter_date')}
                onChange={(date) => setValue('encounter_date', date)}
                placeholder="Select encounter date and time"
                showTime={true}
                className="w-full max-w-md"
              />
              {errors.encounter_date && (
                <p className="text-sm text-red-600 mt-1">Encounter date is required</p>
              )}
            </div>

            {/* Visit Type & Chief Complaint */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Visit Type
                </label>
                <ProfessionalDropdown
                  value={watch('visit_type') || ''}
                  onChange={(value) => setValue('visit_type', value as any)}
                  options={visitTypeOptions}
                  placeholder="Select visit type"
                />
                {errors.visit_type && (
                  <p className="text-sm text-red-600">{errors.visit_type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Chief Complaint
                </label>
                <input
                  type="text"
                  {...register('chief_complaint', { required: 'Chief complaint is required' })}
                  className="w-full p-3 bg-white border-2 border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm hover:shadow-md"
                  placeholder="Primary reason for visit"
                />
                {errors.chief_complaint && (
                  <p className="text-sm text-red-600">{errors.chief_complaint.message}</p>
                )}
              </div>
            </div>

            {/* Diagnosis & Treatment Plan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Diagnosis
                </label>
                <textarea
                  {...register('diagnosis', { required: 'Diagnosis is required' })}
                  rows={4}
                  className="w-full p-3 bg-white border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all shadow-sm hover:shadow-md resize-none"
                  placeholder="Clinical diagnosis and findings"
                />
                {errors.diagnosis && (
                  <p className="text-sm text-red-600">{errors.diagnosis.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Treatment Plan
                </label>
                <textarea
                  {...register('treatment_plan', { required: 'Treatment plan is required' })}
                  rows={4}
                  className="w-full p-3 bg-white border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm hover:shadow-md resize-none"
                  placeholder="Recommended treatment and procedures"
                />
                {errors.treatment_plan && (
                  <p className="text-sm text-red-600">{errors.treatment_plan.message}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Additional Notes
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all shadow-sm hover:shadow-md resize-none"
                placeholder="Additional notes and observations (optional)"
              />
            </div>

            {/* Follow-up */}
            <div className="border-t pt-6">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('follow_up_required')}
                    className="rounded border-gray-300 text-[#01b9d4] focus:ring-[#01b9d4]"
                  />
                  <span className="text-sm font-medium text-gray-700">Follow-up Required</span>
                </label>
                {watch('follow_up_required') && (
                  <input
                    type="date"
                    {...register('follow_up_date')}
                    className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Vitals Tab */}
        {activeTab === 'vitals' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Blood Pressure</label>
                <input
                  type="text"
                  {...register('vitals.blood_pressure')}
                  placeholder="120/80"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  {...register('vitals.temperature')}
                  placeholder="36.5"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Pulse (bpm)</label>
                <input
                  type="number"
                  {...register('vitals.pulse_rate')}
                  placeholder="72"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Respiratory Rate</label>
                <input
                  type="number"
                  {...register('vitals.respiratory_rate')}
                  placeholder="16"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  {...register('vitals.weight')}
                  placeholder="70.0"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Height (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  {...register('vitals.height')}
                  placeholder="175.0"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">BMI</label>
                <input
                  type="number"
                  step="0.1"
                  {...register('vitals.bmi')}
                  placeholder="22.9"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Oxygen Saturation (%)</label>
                <input
                  type="number"
                  {...register('vitals.oxygen_saturation')}
                  placeholder="98"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Medications Tab */}
        {activeTab === 'medications' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Prescription
              </label>
              <textarea
                {...register('prescription')}
                rows={8}
                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all shadow-sm hover:shadow-md resize-none"
                placeholder="Medications and dosage instructions (optional)"
              />
            </div>
          </motion.div>
        )}

        {/* Lab Results Tab */}
        {activeTab === 'results' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center py-8">
              <Microscope className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Lab Results</h3>
              <p className="text-gray-600">Lab results functionality will be implemented here</p>
            </div>
          </motion.div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Visit History</h3>
              <p className="text-gray-600">Visit history functionality will be implemented here</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Form Actions - Sticky at bottom */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all hover:shadow-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Updating Visit...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Update Visit
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default EditVisitTabs;