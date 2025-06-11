import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  DollarSign, 
  TestTube, 
  Stethoscope,
  User,
  Activity,
  Pill,
  Calendar,
  X,
  Save,
  Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EnhancedServiceSelector from '../billing/EnhancedServiceSelector';
import { ServiceSelection } from '../../types/billing';
import { invoiceService } from '../../services/invoiceService';

interface EnhancedAddVisitFormData {
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
  selectedServices: ServiceSelection[];
  generateInvoice: boolean;
}

interface Props {
  patientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

// Frequent tariff codes component
const FrequentCodesGrid: React.FC<{
  onCodeSelect: (code: any) => void;
  practiceType: string;
  serviceSelector: React.RefObject<any>;
}> = ({ onCodeSelect, practiceType, serviceSelector }) => {
  const [frequentCodes, setFrequentCodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFrequentCodes = async () => {
      try {
        const { data, error } = await supabase
          .from('frequent_tariff_codes')
          .select('*')
          .eq('practice_type_name', practiceType)
          .limit(15);

        if (!error && data) {
          setFrequentCodes(data);
        }
      } catch (err) {
        console.error('Error fetching frequent codes:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFrequentCodes();
  }, [practiceType]);

  const handleCodeSelect = (code: any) => {
    // Trigger the service selector to add this code
    if (serviceSelector.current && serviceSelector.current.addService) {
      serviceSelector.current.addService(code);
    }
    onCodeSelect(code);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#01b9d4]" />
        <span className="ml-2 text-gray-600">Loading frequent codes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Frequently Used Codes
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {frequentCodes.map((code) => (
          <motion.button
            key={code.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleCodeSelect(code)}
            className="p-3 bg-white border border-gray-200 rounded-lg hover:border-[#01b9d4] hover:shadow-md transition-all text-left group"
          >
            <div className="font-semibold text-sm text-gray-900 font-mono group-hover:text-[#01b9d4]">
              {code.code}
            </div>
            <div className="text-xs text-gray-600 mt-1 line-clamp-2">
              {code.description}
            </div>
            <div className="text-sm font-semibold text-[#01b9d4] mt-2">
              N$ {code.price?.toFixed(2)}
            </div>
            {code.requires_tooth_number === 'YES' && (
              <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-1 inline-block">
                Tooth #
              </div>
            )}
          </motion.button>
        ))}
      </div>
      {frequentCodes.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">No frequent codes found for {practiceType} practice</p>
        </div>
      )}
    </div>
  );
};

const EnhancedAddVisitForm: React.FC<Props> = ({ patientId, onSuccess, onCancel }) => {
  const [activeTab, setActiveTab] = useState('encounter');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedServices, setSelectedServices] = useState<ServiceSelection[]>([]);
  const [practiceType, setPracticeType] = useState('dental'); // Default, will be fetched
  const serviceSelectorRef = useRef<any>(null);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<EnhancedAddVisitFormData>({
    defaultValues: {
      visit_type: 'consultation',
      vitals: {},
      selectedServices: [],
      generateInvoice: true
    }
  });

  // Fetch practice type for current user
  useEffect(() => {
    const fetchPracticeType = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('practice_id')
            .eq('id', user.id)
            .single();

          if (userProfile?.practice_id) {
            const { data: practice } = await supabase
              .from('practices')
              .select('practice_type')
              .eq('id', userProfile.practice_id)
              .single();

            if (practice?.practice_type) {
              setPracticeType(practice.practice_type);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching practice type:', err);
      }
    };

    fetchPracticeType();
  }, []);

  const tabs = [
    { id: 'encounter', label: 'Encounter Info', icon: FileText },
    { id: 'billing', label: 'Billing & Services', icon: DollarSign },
    { id: 'results', label: 'Results', icon: TestTube }
  ];

  const onSubmit = async (data: EnhancedAddVisitFormData) => {
    try {
      setIsSubmitting(true);

      // Create the visit record
      const visitData = {
        patient_id: patientId,
        visit_date: new Date().toISOString().split('T')[0],
        visit_time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
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
            recorded_at: new Date().toISOString()
          }]);

        if (vitalsError) throw vitalsError;
      }

      // Generate invoice if services are selected
      if (selectedServices.length > 0 && data.generateInvoice) {
        await invoiceService.createInvoice({
          patientId,
          visitId: visit.id,
          services: selectedServices,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error creating visit:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Failed to create visit. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('invalid input syntax for type uuid')) {
          errorMessage = 'Invalid service selection. Please ensure all services are properly selected from the tariff database.';
        } else if (error.message.includes('tariff')) {
          errorMessage = 'Service tariff error: ' + error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleServiceChange = (services: ServiceSelection[]) => {
    setSelectedServices(services);
    setValue('selectedServices', services);
  };

  const handleFrequentCodeSelect = (code: any) => {
    // This will be handled by the EnhancedServiceSelector when we integrate it
    console.log('Selected frequent code:', code);
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
            >
              <tab.icon className="w-4 h-4" />
              <span style={{ fontFamily: 'Poppins, sans-serif' }}>{tab.label}</span>
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

                {/* Visit Type & Chief Complaint */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Visit Type
                    </label>
                    <select
                      {...register('visit_type', { required: 'Visit type is required' })}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all shadow-sm hover:shadow-md"
                    >
                      <option value="consultation">Consultation</option>
                      <option value="follow-up">Follow-up</option>
                      <option value="procedure">Procedure</option>
                      <option value="emergency">Emergency</option>
                    </select>
                    {errors.visit_type && (
                      <p className="text-sm text-red-600">{errors.visit_type.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Chief Complaint
                    </label>
                    <input
                      type="text"
                      {...register('chief_complaint', { required: 'Chief complaint is required' })}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all shadow-sm hover:shadow-md"
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
                    <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Diagnosis
                    </label>
                    <textarea
                      {...register('diagnosis', { required: 'Diagnosis is required' })}
                      rows={4}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all shadow-sm hover:shadow-md resize-none"
                      placeholder="Clinical diagnosis and findings"
                    />
                    {errors.diagnosis && (
                      <p className="text-sm text-red-600">{errors.diagnosis.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Treatment Plan
                    </label>
                    <textarea
                      {...register('treatment_plan', { required: 'Treatment plan is required' })}
                      rows={4}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all shadow-sm hover:shadow-md resize-none"
                      placeholder="Recommended treatment and procedures"
                    />
                    {errors.treatment_plan && (
                      <p className="text-sm text-red-600">{errors.treatment_plan.message}</p>
                    )}
                  </div>
                </div>

                {/* Prescription */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">Blood Pressure</label>
                      <input
                        type="text"
                        {...register('vitals.blood_pressure')}
                        placeholder="120/80"
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Temperature (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        {...register('vitals.temperature')}
                        placeholder="36.5"
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pulse (bpm)</label>
                      <input
                        type="number"
                        {...register('vitals.pulse_rate')}
                        placeholder="72"
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Weight (kg)</label>
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
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Billing & Services
                </h3>

                {/* Frequent Codes Grid */}
                <FrequentCodesGrid 
                  onCodeSelect={handleFrequentCodeSelect}
                  practiceType={practiceType}
                  serviceSelector={serviceSelectorRef}
                />

                {/* Enhanced Service Selector */}
                <div className="border-t pt-6">
                  <EnhancedServiceSelector
                    ref={serviceSelectorRef}
                    selectedServices={selectedServices}
                    onServiceChange={handleServiceChange}
                    readOnly={false}
                  />
                </div>

                {/* Invoice Generation Option */}
                <div className="border-t pt-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...register('generateInvoice')}
                      className="rounded border-gray-300 text-[#01b9d4] focus:ring-[#01b9d4]"
                    />
                    <span className="text-sm font-medium text-gray-700">Generate invoice automatically</span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Lab & Imaging Results
                </h3>
                
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <TestTube className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Lab and imaging results</p>
                  <p className="text-sm text-gray-500">
                    Upload and manage test results, X-rays, and other medical imaging for this visit.
                  </p>
                  <button
                    type="button"
                    className="mt-4 px-4 py-2 bg-[#01b9d4] text-white rounded-lg hover:bg-[#01a5c4] transition-colors"
                  >
                    Upload Results
                  </button>
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

export default EnhancedAddVisitForm;