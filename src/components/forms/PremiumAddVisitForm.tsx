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
import { ServiceSelection } from '../../types/billing';
import { invoiceService } from '../../services/invoiceService';
import LabResultUpload from '../visits/LabResultUpload';
import MediaUpload from '../visits/MediaUpload';

interface PremiumAddVisitFormData {
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

// Premium Billing Section Component
const PremiumBillingSection: React.FC<{
  selectedServices: ServiceSelection[];
  onServiceChange: (services: ServiceSelection[]) => void;
  practiceType: string;
}> = ({ selectedServices, onServiceChange, practiceType }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [frequentCodes, setFrequentCodes] = useState<any[]>([]);
  const [allCodes, setAllCodes] = useState<any[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<any[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [pendingCalculation, setPendingCalculation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load all codes once on component mount
  useEffect(() => {
    const fetchAllCodes = async () => {
      try {
        setIsLoading(true);
        
        // Fetch frequent codes
        const { data: frequentData } = await supabase
          .from('frequent_tariff_codes')
          .select('*')
          .eq('practice_type_name', practiceType)
          .limit(12);
        
        // Fetch all practice tariffs for search
        const { data: allData } = await supabase
          .from('practice_tariffs_with_types')
          .select('*')
          .eq('practice_type_name', practiceType)
          .order('code');
          
        setFrequentCodes(frequentData || []);
        setAllCodes(allData || []);
        setFilteredCodes(allData || []);
      } catch (err) {
        console.error('Error fetching codes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (practiceType) {
      fetchAllCodes();
    }
  }, [practiceType]);
  
  // Filter codes based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCodes(allCodes);
    } else {
      const filtered = allCodes.filter(code => 
        code.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCodes(filtered);
    }
  }, [searchTerm, allCodes]);

  const addService = (code: any, event?: React.MouseEvent) => {
    // Prevent any form submission or bubbling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    const newService: ServiceSelection = {
      id: crypto.randomUUID(),
      tariffId: code.id,
      code: code.code,
      description: code.description,
      category: 'Service',
      subcategory: 'General',
      unitPrice: code.price,
      quantity: 1,
      totalPrice: code.price,
      requiresPreAuth: false,
      medicalAidCovered: false,
      coveragePercentage: 0,
      businessRule: code.business_rule_formula,
      exampleCalculation: code.example_calculation
    };
    
    // Only add if not already selected
    if (!selectedServices.find(s => s.code === code.code)) {
      onServiceChange([...selectedServices, newService]);
    }
  };

  const removeService = (id: string) => {
    onServiceChange(selectedServices.filter(s => s.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    const updated = selectedServices.map(service => 
      service.id === id 
        ? { ...service, quantity, totalPrice: service.unitPrice * quantity }
        : service
    );
    onServiceChange(updated);
  };

  const totalCost = selectedServices.reduce((sum, service) => sum + service.totalPrice, 0);

  const handleCalculatorSave = () => {
    if (pendingCalculation) {
      const confirmed = window.confirm(
        `Save billing calculation?\n\nTotal: N$ ${totalCost.toFixed(2)}\nServices: ${selectedServices.length}\n\nThis will finalize the billing for this visit.`
      );
      
      if (confirmed) {
        setPendingCalculation(null);
        setShowCalculator(false);
        // Additional save logic here
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Cost Summary */}
      <div className="bg-gradient-to-r from-[#01b9d4]/10 to-purple-600/10 rounded-xl p-4 border border-[#01b9d4]/20">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Total Cost
            </h4>
            <p className="text-2xl font-bold text-[#01b9d4]">N$ {totalCost.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">{selectedServices.length} services</p>
            <button
              onClick={() => {
                setPendingCalculation({ total: totalCost, services: selectedServices });
                setShowCalculator(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#01b9d4] text-white rounded-lg hover:bg-[#01a5c4] transition-colors"
            >
              <Calculator className="w-4 h-4" />
              Calculate
            </button>
          </div>
        </div>
      </div>

      {/* Efficient Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder={`Search ${allCodes.length} available services...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4] transition-all"
        />
        {searchTerm && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
            {filteredCodes.length} found
          </div>
        )}
      </div>
      
      {/* Search Results */}
      {searchTerm && (
        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg bg-white">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
              Loading codes...
            </div>
          ) : filteredCodes.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredCodes.slice(0, 20).map((code) => (
                <button
                  key={code.id}
                  type="button"
                  onClick={(e) => addService(code, e)}
                  className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex justify-between items-center"
                >
                  <div className="flex-1">
                    <div className="font-mono font-medium text-sm text-gray-900">{code.code}</div>
                    <div className="text-xs text-gray-600 truncate">{code.description}</div>
                  </div>
                  <div className="text-sm font-semibold text-[#01b9d4] ml-4">
                    N$ {code.price?.toFixed(2)}
                  </div>
                </button>
              ))}
              {filteredCodes.length > 20 && (
                <div className="p-3 text-center text-xs text-gray-500">
                  Showing first 20 of {filteredCodes.length} results. Refine your search for more.
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              No services found for "{searchTerm}"
            </div>
          )}
        </div>
      )}

      {/* Frequent Services */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Quick Add Services
        </h4>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-3 bg-gray-100 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {frequentCodes.map((code) => (
              <motion.button
                key={code.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => addService(code, e)}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-[#01b9d4] hover:shadow-md transition-all text-left group"
              >
                <div className="font-semibold text-sm text-gray-900 font-mono group-hover:text-[#01b9d4]">
                  {code.code}
                </div>
                <div className="text-xs text-gray-600 mt-1 truncate">
                  {code.description}
                </div>
                <div className="text-sm font-semibold text-[#01b9d4] mt-1">
                  N$ {code.price?.toFixed(2)}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Services */}
      {selectedServices.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Selected Services
          </h4>
          <div className="space-y-3">
            {selectedServices.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-gray-900">{service.code}</span>
                    <span className="text-sm text-gray-600">{service.description}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    N$ {service.unitPrice} × {service.quantity} = N$ {service.totalPrice.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={service.quantity}
                    onChange={(e) => updateQuantity(service.id, parseInt(e.target.value) || 1)}
                    className="w-16 p-1 border border-gray-200 rounded text-center text-sm"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeService(service.id);
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calculator Modal */}
      {showCalculator && pendingCalculation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Billing Summary
            </h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span>Services:</span>
                <span>{pendingCalculation.services.length}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>Total:</span>
                <span className="text-[#01b9d4]">N$ {pendingCalculation.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCalculator(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCalculatorSave}
                className="flex-1 px-4 py-2 text-white bg-[#01b9d4] rounded-lg hover:bg-[#01a5c4] transition-colors"
              >
                Save Billing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [practiceType, setPracticeType] = useState('dental');
  const [labResults, setLabResults] = useState<any[]>([]);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<PremiumAddVisitFormData>({
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

  const visitTypeOptions = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'follow-up', label: 'Follow-up Visit' },
    { value: 'procedure', label: 'Procedure' },
    { value: 'emergency', label: 'Emergency' }
  ];

  const onSubmit = async (data: PremiumAddVisitFormData) => {
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
        try {
          // Get current user practice
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
          
          await invoiceService.generateInvoiceFromVisit({
            visitId: visit.id,
            patientId,
            practiceId,
            services: selectedServices,
            medicalAidId: undefined,
            generatePdf: false,
            notes: 'Generated from visit form'
          });
        } catch (invoiceError) {
          console.warn('Invoice generation failed:', invoiceError);
          // Continue without invoice - don't block visit creation
        }
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

                <PremiumBillingSection
                  selectedServices={selectedServices}
                  onServiceChange={setSelectedServices}
                  practiceType={practiceType}
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
                            status: result.status,
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