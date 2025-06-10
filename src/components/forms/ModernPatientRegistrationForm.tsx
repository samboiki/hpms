import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  MapPin, 
  Heart,
  Users, 
  ChevronRight, 
  ChevronLeft, 
  Check,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  Shield,
  CreditCard,
  ArrowRight
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import 'react-day-picker/dist/style.css';

interface PatientRegistrationFormData {
  // Personal Details
  firstName: string;
  lastName: string;
  idNumber: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  occupation: string;
  cellNo: string;
  homeLanguage: string;
  email: string;

  // Contact Details
  homeAddress: string;
  postalAddress: string;
  postalCode: string;

  // Medical Aid
  medicalAid: {
    provider: string;
    scheme: string;
    membershipNumber: string;
    mainMemberName: string;
    mainMemberIdNumber: string;
    relationship: string;
  };

  // Next of Kin
  nextOfKin: {
    name: string;
    relationship: string;
    phone: string;
    address: string;
  };
}

interface MedicalAidProvider {
  id: string;
  name: string;
  short_name: string;
}


interface Props {
  onSuccess?: () => void;
}

const steps = [
  {
    id: 1,
    title: 'Personal',
    icon: User,
    color: '#3b82f6'
  },
  {
    id: 2,
    title: 'Contact',
    icon: MapPin,
    color: '#10b981'
  },
  {
    id: 3,
    title: 'Medical Aid',
    icon: Shield,
    color: '#8b5cf6'
  },
  {
    id: 4,
    title: 'Emergency',
    icon: Users,
    color: '#f59e0b'
  }
];

const ModernPatientRegistrationForm: React.FC<Props> = ({ onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providers, setProviders] = useState<MedicalAidProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue,
    formState: { errors },
    trigger
  } = useForm<PatientRegistrationFormData>();

  const selectedProvider = watch('medicalAid.provider');

  // Fetch medical aid providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const { data, error } = await supabase
          .from('medical_aid_providers')
          .select('id, name, short_name')
          .order('name');

        if (error) throw error;
        setProviders(data || []);
      } catch (error) {
        console.error('Error fetching providers:', error);
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);


  const nextStep = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isValid = await trigger(fieldsToValidate);
    
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const getFieldsForStep = (step: number) => {
    switch (step) {
      case 1:
        return ['firstName', 'lastName', 'idNumber', 'dateOfBirth', 'gender', 'homeLanguage'] as const;
      case 2:
        return ['cellNo', 'email'] as const;
      case 3:
        return [] as const; // Medical aid is optional
      case 4:
        return [] as const; // Next of kin is optional - don't auto-advance
      default:
        return [] as const;
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setValue('dateOfBirth', format(date, 'yyyy-MM-dd'));
      setShowDatePicker(false);
    }
  };

  const onSubmit = async (data: PatientRegistrationFormData) => {
    // Only allow submission if explicitly allowed (via submit button click)
    if (!allowSubmit || currentStep !== steps.length) {
      return;
    }
    
    setAllowSubmit(false); // Reset to prevent accidental re-submission
    setIsSubmitting(true);
    try {
      // Check for duplicate ID number first
      const { data: existingPatient, error: checkError } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .eq('id_number', data.idNumber)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingPatient) {
        alert(`Patient with ID number ${data.idNumber} already exists: ${existingPatient.first_name} ${existingPatient.last_name}`);
        return;
      }

      // Add practice_id to patient data
      const { data: { user } } = await supabase.auth.getUser();
      let practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'; // Default to Dr. Polina's practice

      // Try to get user's practice from users table
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('practice_id')
          .eq('id', user.id)
          .single();
        
        if (userData?.practice_id) {
          practiceId = userData.practice_id;
        }
      }

      // Insert patient data
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert([{
          first_name: data.firstName,
          last_name: data.lastName,
          id_number: data.idNumber,
          date_of_birth: data.dateOfBirth,
          gender: data.gender,
          marital_status: data.maritalStatus || null,
          occupation: data.occupation || null,
          cell_number: data.cellNo || null,
          home_language: data.homeLanguage || 'English', // Default to English if not selected
          email: data.email || null,
          home_address: data.homeAddress || null,
          postal_address: data.postalAddress || null,
          postal_code: data.postalCode || null,
          practice_id: practiceId
        }])
        .select()
        .single();

      if (patientError) throw patientError;

      // Insert medical aid details if provided
      if (data.medicalAid.provider) {
        const selectedProviderData = providers.find(p => p.id === data.medicalAid.provider);

        const { error: medicalAidError } = await supabase
          .from('medical_aid_details')
          .insert([{
            patient_id: patientData.id,
            provider: selectedProviderData?.name || data.medicalAid.provider,
            scheme: data.medicalAid.scheme,
            medical_aid_provider_id: data.medicalAid.provider,
            membership_number: data.medicalAid.membershipNumber,
            main_member_name: data.medicalAid.mainMemberName,
            main_member_id_number: data.medicalAid.mainMemberIdNumber,
            relationship_to_main: data.medicalAid.relationship
          }]);

        if (medicalAidError) throw medicalAidError;
      }

      // Insert next of kin
      if (data.nextOfKin.name) {
        const { error: nextOfKinError } = await supabase
          .from('next_of_kin')
          .insert([{
            patient_id: patientData.id,
            name: data.nextOfKin.name,
            relationship: data.nextOfKin.relationship,
            phone: data.nextOfKin.phone,
            address: data.nextOfKin.address
          }]);

        if (nextOfKinError) throw nextOfKinError;
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error registering patient:', error);
      alert('Error registering patient. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Modern Step Progress Bar */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    currentStep > step.id
                      ? 'bg-green-500 text-white shadow-lg'
                      : currentStep === step.id
                      ? 'text-white shadow-lg'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                  style={{
                    backgroundColor: currentStep === step.id ? step.color : undefined
                  }}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`text-xs mt-2 font-medium ${
                  currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 transition-all duration-300 ${
                  currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    First Name *
                  </label>
                  <input
                    type="text"
                    {...register('firstName', { required: 'First name is required' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter first name"
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-500">{errors.firstName.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Last Name *</label>
                  <input
                    type="text"
                    {...register('lastName', { required: 'Last name is required' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter last name"
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-500">{errors.lastName.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">ID Number *</label>
                  <input
                    type="text"
                    {...register('idNumber', { required: 'ID number is required' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter ID number"
                  />
                  {errors.idNumber && (
                    <p className="text-xs text-red-500">{errors.idNumber.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    Date of Birth *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      {...register('dateOfBirth', { required: 'Date of birth is required' })}
                      value={selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''}
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      readOnly
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                      placeholder="Select date"
                    />
                    {showDatePicker && (
                      <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                        <DayPicker
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleDateSelect}
                          captionLayout="dropdown-buttons"
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                          disabled={(date) => date > new Date()}
                          className="text-sm"
                          styles={{
                            day_selected: {
                              backgroundColor: '#3b82f6',
                              color: 'white'
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {errors.dateOfBirth && (
                    <p className="text-xs text-red-500">{errors.dateOfBirth.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Gender *</label>
                  <select
                    {...register('gender', { required: 'Gender is required' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && (
                    <p className="text-xs text-red-500">{errors.gender.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Marital Status</label>
                  <select
                    {...register('maritalStatus')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select status</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    Occupation
                  </label>
                  <input
                    type="text"
                    {...register('occupation')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter occupation"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Home Language</label>
                  <select
                    {...register('homeLanguage', { required: 'Home language is required' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    defaultValue="English"
                  >
                    <option value="English">English</option>
                    <option value="Afrikaans">Afrikaans</option>
                    <option value="Oshiwambo">Oshiwambo</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.homeLanguage && (
                    <p className="text-xs text-red-500">{errors.homeLanguage.message}</p>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-500" />
                    Cell Number
                  </label>
                  <input
                    type="tel"
                    {...register('cellNo')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter cell number"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-green-500" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter email address"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-500" />
                    Home Address
                  </label>
                  <textarea
                    {...register('homeAddress')}
                    rows={2}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    placeholder="Enter home address"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Postal Address</label>
                  <textarea
                    {...register('postalAddress')}
                    rows={2}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    placeholder="Enter postal address"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Postal Code</label>
                  <input
                    type="text"
                    {...register('postalCode')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter postal code"
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-500" />
                    Medical Aid Provider
                  </label>
                  <select
                    {...register('medicalAid.provider')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    disabled={loadingProviders}
                  >
                    <option value="">Select provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-500" />
                    Scheme/Option
                  </label>
                  <select
                    {...register('medicalAid.scheme')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    disabled={!selectedProvider || loadingSchemes}
                  >
                    <option value="">Select scheme</option>
                    {schemes.map((scheme) => (
                      <option key={scheme.id} value={scheme.id}>
                        {scheme.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-sm font-medium text-gray-700">Membership Number</label>
                  <input
                    type="text"
                    {...register('medicalAid.membershipNumber')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter membership number"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Main Member Name</label>
                  <input
                    type="text"
                    {...register('medicalAid.mainMemberName')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter main member name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Main Member ID</label>
                  <input
                    type="text"
                    {...register('medicalAid.mainMemberIdNumber')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter main member ID"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-sm font-medium text-gray-700">Relationship to Main Member</label>
                  <select
                    {...register('medicalAid.relationship')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Select relationship</option>
                    <option value="self">Self (Main Member)</option>
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="parent">Parent</option>
                    <option value="other">Other Dependent</option>
                  </select>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-500" />
                    Next of Kin Name
                  </label>
                  <input
                    type="text"
                    {...register('nextOfKin.name')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter next of kin name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-orange-500" />
                    Relationship
                  </label>
                  <input
                    type="text"
                    {...register('nextOfKin.relationship')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="e.g., Spouse, Parent, Sibling"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-orange-500" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    {...register('nextOfKin.phone')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    Address
                  </label>
                  <textarea
                    {...register('nextOfKin.address')}
                    rows={2}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                    placeholder="Enter address"
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          {currentStep < steps.length ? (
            <button
              type="button"
              onClick={nextStep}
              className="justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={() => setAllowSubmit(true)}
              className={`justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 px-4 py-2 flex items-center gap-2 ${
                isSubmitting 
                  ? 'opacity-50 cursor-not-allowed bg-gradient-to-r from-blue-600 to-purple-600' 
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
              } text-white`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Complete Registration
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ModernPatientRegistrationForm;