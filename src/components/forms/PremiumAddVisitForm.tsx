import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  DollarSign, 
  TestTube, 
  ChevronDown,
  Calculator,
  Search,
  Save,
  Loader2,
  Upload,
  Image as ImageIcon,
  Microscope,
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getResultStatus } from '../../utils/labResultStatus';
import { ServiceSelection } from '../../types/billing';
import { invoiceService } from '../../services/invoiceService';
import LabResultUpload from '../visits/LabResultUpload';
import MediaUpload from '../visits/MediaUpload';
import { usePracticeTariffs } from '../../contexts/PracticeTariffsContext';
import EnhancedDentalServiceSelector from '../billing/EnhancedDentalServiceSelector';
import ModernDateTimePicker from '../ui/ModernDateTimePicker';

interface PremiumAddVisitFormData {
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
  selectedServices: ServiceSelection[];
  generateInvoice: boolean;
}

interface Props {
  patientId: string;
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PremiumAddVisitForm: React.FC<Props> = ({ patientId, onSuccess, onCancel }) => {
  const [activeTab, setActiveTab] = useState('encounter');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedServices, setSelectedServices] = useState<ServiceSelection[]>([]);
  const [labResults, setLabResults] = useState<any[]>([]);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<PremiumAddVisitFormData>({
    defaultValues: {
      visit_type: 'consultation',
      encounter_date: new Date(),
      vitals: {},
      selectedServices: [],
      generateInvoice: true
    }
  });

  const tabs = [
    { id: 'encounter', label: 'Encounter Info', icon: FileText },
    { id: 'billing', label: 'Billing & Services', icon: DollarSign },
    { id: 'results', label: 'Results', icon: TestTube }
  ];

  const visitTypeOptions = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'follow-up', label: 'Follow-up Visit' },
    { value: 'procedure', label: 'Procedure' },
    { value: 'emergency', label: 'Emergency' }
  ];

  const onSubmit = async (data: PremiumAddVisitFormData) => {
    try {
      setIsSubmitting(true);

      // Get current user practice
      const { data: { user } } = await supabase.auth.getUser();
      let practiceId = undefined;
      
      if (user) {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('practice_id')
          .eq('id', user.id)
          .single();
        
        if (!profileError && userProfile?.practice_id) {
          practiceId = userProfile.practice_id;
        }
      }

      // Create the visit record
      const visitData = {
        patient_id: patientId,
        practice_id: practiceId,
        doctor_id: user?.id,
        encounter_date: data.encounter_date.toISOString(),
        visit_date: data.encounter_date.toISOString().split('T')[0],
        visit_time: data.encounter_date.toLocaleTimeString('en-US', { hour12: false }),
        visit_type: data.visit_type,
        chief_complaint: data.chief_complaint,
        diagnosis: data.diagnosis,
        treatment_plan: data.treatment_plan,
        prescription: data.prescription,
        follow_up_required: data.follow_up_required,
        follow_up_date: data.follow_up_date,
        notes: data.notes,
        status: 'completed'
      };

      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert([visitData])
        .select()
        .single();

      if (visitError) throw visitError;

      // Add vitals if provided
      if (Object.keys(data.vitals).some(key => data.vitals[key as keyof typeof data.vitals])) {
        const { error: vitalsError } = await supabase
          .from('vitals')
          .insert([{
            visit_id: visit.id,
            ...data.vitals,
            created_at: new Date().toISOString()
          }]);

        if (vitalsError) throw vitalsError;
      }

      // Generate invoice if services are selected
      if (selectedServices.length > 0 && data.generateInvoice) {
        console.log('🧾 Starting invoice generation...');
        console.log('📋 Selected services:', selectedServices);
        console.log('✅ Generate invoice enabled:', data.generateInvoice);
        
        try {
          // Get current user practice
          console.log('👤 Getting current user...');
          const { data: { user } } = await supabase.auth.getUser();
          let practiceId = undefined;
          
          if (user) {
            console.log('👤 User found:', user.id);
            const { data: userProfile, error: profileError } = await supabase
              .from('users')
              .select('practice_id')
              .eq('id', user.id)
              .single();
            
            if (profileError) {
              console.error('❌ Error fetching user profile:', profileError);
            } else {
              practiceId = userProfile?.practice_id;
              console.log('🏢 Practice ID:', practiceId);
            }
          } else {
            console.warn('⚠️ No user found');
          }
          
          const invoiceRequest = {
            visitId: visit.id,
            patientId,
            practiceId,
            services: selectedServices,
            medicalAidId: undefined,
            generatePdf: false,
            notes: 'Generated from visit form'
          };
          
          console.log('📄 Invoice request:', invoiceRequest);
          console.log('🚀 Calling invoiceService.generateInvoiceFromVisit...');
          
          const generatedInvoice = await invoiceService.generateInvoiceFromVisit(invoiceRequest);
          
          console.log('✅ Invoice generated successfully:', generatedInvoice);
          
        } catch (invoiceError) {
          console.error('💥 Invoice generation failed:', invoiceError);
          console.error('📊 Error details:', {
            message: invoiceError.message,
            stack: invoiceError.stack,
            selectedServicesCount: selectedServices.length,
            visitId: visit.id,
            patientId: patientId
          });
          
          // Show user-friendly error
          alert(`Invoice generation failed: ${invoiceError.message || 'Unknown error'}. The visit was saved but no invoice was created.`);
        }
      } else {
        console.log('⏭️ Skipping invoice generation:');
        console.log('   - Services selected:', selectedServices.length);
        console.log('   - Generate invoice:', data.generateInvoice);
      }

      onSuccess();
    } catch (error) {
      console.error('Error creating visit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Premium Tabs */}
        <div className="flex space-x-1 bg-gradient-to-r from-blue-50 to-purple-50 p-1 rounded-xl border border-blue-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          >
            {activeTab === 'encounter' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Encounter Information
                </h3>

                {/* Encounter Date & Time */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
                    <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
                    <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
                    <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
                    <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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

                {/* Prescription */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Prescription
                  </label>
                  <textarea
                    {...register('prescription')}
                    rows={3}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all shadow-sm hover:shadow-md resize-none"
                    placeholder="Medications and dosage instructions (optional)"
                  />
                </div>

                {/* Vitals Section */}
                <div className="border-t pt-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Vital Signs
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>Blood Pressure</label>
                      <input
                        type="text"
                        {...register('vitals.blood_pressure')}
                        placeholder="120/80"
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>Temperature (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        {...register('vitals.temperature')}
                        placeholder="36.5"
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>Pulse (bpm)</label>
                      <input
                        type="number"
                        {...register('vitals.pulse_rate')}
                        placeholder="72"
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        {...register('vitals.weight')}
                        placeholder="70.0"
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                      />
                    </div>
                  </div>
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
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>Follow-up Required</span>
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
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Billing & Services
                </h3>

                <EnhancedDentalServiceSelector
                  selectedServices={selectedServices}
                  onServiceChange={setSelectedServices}
                />

                {/* Invoice Generation Option */}
                <div className="border-t pt-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...register('generateInvoice')}
                      className="rounded border-gray-300 text-[#01b9d4] focus:ring-[#01b9d4]"
                    />
                    <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>Generate invoice automatically</span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Lab & Imaging Results
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Lab Results Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Microscope className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Laboratory Results
                      </h4>
                    </div>
                    
                    <div className="border-2 border-dashed border-green-200 rounded-lg p-6 text-center hover:border-green-300 transition-colors">
                      <Microscope className="w-8 h-8 text-green-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-3">Upload and process lab results with AI</p>
                      <LabResultUpload
                        onUpload={(result) => {
                          setLabResults(prev => [...prev, {
                            name: result.name,
                            description: `${result.value} ${result.unit} (Ref: ${result.reference_range})`,
                            // The upload defaults to "normal", so check the value against its range rather
                            // than show an out-of-range result with a green Normal badge
                            status: result.status === 'normal'
                              ? getResultStatus(result.value, result.reference_range)
                              : result.status,
                            value: result.value,
                            unit: result.unit,
                            reference_range: result.reference_range
                          }]);
                        }}
                      />
                    </div>
                    
                    {labResults.length > 0 && (
                      <div className="space-y-2">
                        {labResults.map((result, index) => (
                          <div key={index} className={`p-3 border rounded-lg ${
                            result.status === 'critical' ? 'bg-red-50 border-red-200' :
                            result.status === 'high' || result.status === 'low' ? 'bg-yellow-50 border-yellow-200' :
                            'bg-green-50 border-green-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">{result.name}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  result.status === 'critical' ? 'bg-red-100 text-red-700' :
                                  result.status === 'high' || result.status === 'low' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {result.status}
                                </span>
                                {result.status === 'normal' ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{result.description}</p>
                            {result.value && (
                              <div className="text-xs text-gray-500 mt-2">
                                Value: {result.value} {result.unit} | Ref: {result.reference_range}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Imaging Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Medical Imaging
                      </h4>
                    </div>
                    
                    <div className="border-2 border-dashed border-blue-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors">
                      <ImageIcon className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-3">Upload medical imaging files</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <MediaUpload
                          type="xray"
                          onUpload={(url) => {
                            setMediaFiles(prev => [...prev, {
                              type: 'X-Ray',
                              description: 'X-Ray Image',
                              url: url
                            }]);
                          }}
                        />
                        <MediaUpload
                          type="photo"
                          onUpload={(url) => {
                            setMediaFiles(prev => [...prev, {
                              type: 'Photo',
                              description: 'Clinical Photo',
                              url: url
                            }]);
                          }}
                        />
                        <MediaUpload
                          type="ultrasound"
                          onUpload={(url) => {
                            setMediaFiles(prev => [...prev, {
                              type: 'Ultrasound',
                              description: 'Ultrasound Image',
                              url: url
                            }]);
                          }}
                        />
                      </div>
                    </div>
                    
                    {mediaFiles.length > 0 && (
                      <div className="space-y-2">
                        {mediaFiles.map((media, index) => (
                          <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-blue-900">{media.type}</span>
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                            </div>
                            <p className="text-sm text-blue-700 mt-1">{media.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
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
                Creating Visit...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Create Visit
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PremiumAddVisitForm;