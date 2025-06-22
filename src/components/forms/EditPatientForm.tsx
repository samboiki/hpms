import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { User, Phone, Stethoscope, Shield, Users, MapPin, Heart } from 'lucide-react';

interface EditPatientFormData {
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  occupation: string;
  employer: string;
  home_language: string;
  home_address: string;
  postal_address: string;
  postal_code: string;
  
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
  short_name: string | null;
}

interface MedicalAidScheme {
  id: string;
  provider_id?: string;
  name: string;
  description: string | null;
}

interface MedicalAidDetails {
  id: string;
  provider: string;
  scheme: string;
  membership_number: string;
  main_member_name: string;
  main_member_id_number: string;
  relationship_to_main: string;
  medical_aid_provider_id: string | null;
}

interface NextOfKinDetails {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  address: string | null;
}

interface Props {
  patientId: string;
  initialData: Partial<EditPatientFormData>;
  onSuccess: () => void;
}

const EditPatientForm: React.FC<Props> = ({ patientId, initialData, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [providers, setProviders] = useState<MedicalAidProvider[]>([]);
  const [schemes, setSchemes] = useState<MedicalAidScheme[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [medicalAidDetails, setMedicalAidDetails] = useState<MedicalAidDetails | null>(null);
  const [nextOfKinDetails, setNextOfKinDetails] = useState<NextOfKinDetails | null>(null);
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EditPatientFormData>({
    defaultValues: {
      ...initialData,
      medicalAid: {
        provider: '',
        scheme: '',
        membershipNumber: '',
        mainMemberName: '',
        mainMemberIdNumber: '',
        relationship: '',
        ...initialData?.medicalAid
      },
      nextOfKin: {
        name: '',
        relationship: '',
        phone: '',
        address: '',
        ...initialData?.nextOfKin
      }
    }
  });
  
  const selectedProvider = watch('medicalAid.provider');

  // Fetch medical aid providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        let data, error;
        
        try {
          const result = await supabase.rpc('get_medical_aid_providers');
          data = result.data;
          error = result.error;
        } catch (funcError) {
          const result = await supabase
            .from('medical_aid_providers')
            .select('id, name, short_name')
            .order('name');
          data = result.data;
          error = result.error;
        }

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

  // Fetch schemes when provider changes
  useEffect(() => {
    if (selectedProvider) {
      const fetchSchemes = async () => {
        setLoadingSchemes(true);
        try {
          const { data, error } = await supabase
            .from('medical_aid_schemes')
            .select('id, name, description')
            .eq('provider_id', selectedProvider)
            .order('name');

          if (error) throw error;
          setSchemes(data || []);
        } catch (error) {
          console.error('Error fetching schemes:', error);
        } finally {
          setLoadingSchemes(false);
        }
      };

      fetchSchemes();
    } else {
      setSchemes([]);
    }
  }, [selectedProvider]);

  // Fetch existing medical aid details
  useEffect(() => {
    const fetchMedicalAidDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('medical_aid_details')
          .select('*')
          .eq('patient_id', patientId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setMedicalAidDetails(data);
          // Set form values
          setValue('medicalAid.provider', data.medical_aid_provider_id || '');
          setValue('medicalAid.scheme', data.scheme || '');
          setValue('medicalAid.membershipNumber', data.membership_number || '');
          setValue('medicalAid.mainMemberName', data.main_member_name || '');
          setValue('medicalAid.mainMemberIdNumber', data.main_member_id_number || '');
          setValue('medicalAid.relationship', data.relationship_to_main || '');
        }
      } catch (error) {
        console.error('Error fetching medical aid details:', error);
      }
    };

    fetchMedicalAidDetails();
  }, [patientId, setValue]);

  // Fetch existing next of kin details
  useEffect(() => {
    const fetchNextOfKinDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('next_of_kin')
          .select('*')
          .eq('patient_id', patientId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setNextOfKinDetails(data);
          // Set form values
          setValue('nextOfKin.name', data.name || '');
          setValue('nextOfKin.relationship', data.relationship || '');
          setValue('nextOfKin.phone', data.phone || '');
          setValue('nextOfKin.address', data.address || '');
        }
      } catch (error) {
        console.error('Error fetching next of kin details:', error);
      }
    };

    fetchNextOfKinDetails();
  }, [patientId, setValue]);

  const onSubmit = async (data: EditPatientFormData) => {
    try {
      // Update patient basic info (exclude medical aid and nextOfKin from patient update)
      const { medicalAid, nextOfKin, ...patientData } = data;
      const { error: patientError } = await supabase
        .from('patients')
        .update(patientData)
        .eq('id', patientId);

      if (patientError) throw patientError;

      // Handle medical aid details
      if (data.medicalAid.provider) {
        const selectedProviderData = providers.find(p => p.id === data.medicalAid.provider);
        const selectedSchemeData = schemes.find(s => s.id === data.medicalAid.scheme);

        const medicalAidData = {
          patient_id: patientId,
          provider: selectedProviderData?.name || data.medicalAid.provider,
          scheme: selectedSchemeData?.name || data.medicalAid.scheme,
          plan_type: selectedSchemeData?.name || data.medicalAid.scheme,
          medical_aid_provider_id: data.medicalAid.provider,
          membership_number: data.medicalAid.membershipNumber,
          main_member_name: data.medicalAid.mainMemberName,
          main_member_id_number: data.medicalAid.mainMemberIdNumber,
          relationship_to_main: data.medicalAid.relationship
        };

        if (medicalAidDetails) {
          // Update existing medical aid details
          const { error: medicalAidError } = await supabase
            .from('medical_aid_details')
            .update(medicalAidData)
            .eq('id', medicalAidDetails.id);

          if (medicalAidError) throw medicalAidError;
        } else {
          // Insert new medical aid details
          const { error: medicalAidError } = await supabase
            .from('medical_aid_details')
            .insert([medicalAidData]);

          if (medicalAidError) throw medicalAidError;
        }
      } else if (medicalAidDetails) {
        // Remove medical aid details if provider is cleared
        const { error: deleteError } = await supabase
          .from('medical_aid_details')
          .delete()
          .eq('id', medicalAidDetails.id);

        if (deleteError) throw deleteError;
      }

      // Handle next of kin details
      if (data.nextOfKin.name) {
        const nextOfKinData = {
          patient_id: patientId,
          name: data.nextOfKin.name,
          relationship: data.nextOfKin.relationship,
          phone: data.nextOfKin.phone,
          address: data.nextOfKin.address
        };

        if (nextOfKinDetails) {
          // Update existing next of kin details
          const { error: nextOfKinError } = await supabase
            .from('next_of_kin')
            .update(nextOfKinData)
            .eq('id', nextOfKinDetails.id);

          if (nextOfKinError) throw nextOfKinError;
        } else {
          // Insert new next of kin details
          const { error: nextOfKinError } = await supabase
            .from('next_of_kin')
            .insert([nextOfKinData]);

          if (nextOfKinError) throw nextOfKinError;
        }
      } else if (nextOfKinDetails) {
        // Remove next of kin details if cleared
        const { error: deleteError } = await supabase
          .from('next_of_kin')
          .delete()
          .eq('id', nextOfKinDetails.id);

        if (deleteError) throw deleteError;
      }

      onSuccess();
    } catch (error) {
      console.error('Error updating patient:', error);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'contact', label: 'Contact Details', icon: Phone },
    { id: 'medical', label: 'Medical Info', icon: Stethoscope },
    { id: 'medicalaid', label: 'Medical Aid', icon: Shield },
    { id: 'nextofkin', label: 'Next of Kin', icon: Users }
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Premium Tabs */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 relative">
        <div className="px-6">
          <div className="flex w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-300 relative ${
                  activeTab === tab.id
                    ? 'text-white border-white bg-gradient-to-t from-white/10 to-transparent'
                    : 'text-white/80 border-transparent hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon className={`w-4 h-4 transition-all duration-300 ${
                  activeTab === tab.id ? 'text-white drop-shadow-sm' : ''
                }`} />
                <span className="hidden sm:inline font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">First Name</label>
              <input
                type="text"
                {...register('first_name', { required: 'First name is required' })}
                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
              />
              {errors.first_name && (
                <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                type="text"
                {...register('last_name', { required: 'Last name is required' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              />
              {errors.last_name && (
                <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                {...register('date_of_birth', { required: 'Date of birth is required' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              />
              {errors.date_of_birth && (
                <p className="mt-1 text-sm text-red-600">{errors.date_of_birth.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Gender</label>
              <select
                {...register('gender', { required: 'Gender is required' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Marital Status</label>
              <select
                {...register('marital_status')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              >
                <option value="">Select Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Home Language</label>
              <select
                {...register('home_language')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              >
                <option value="">Select Language</option>
                <option value="English">English</option>
                <option value="Afrikaans">Afrikaans</option>
                <option value="Oshiwambo">Oshiwambo</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  {...register('email')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cell Number</label>
                <input
                  type="tel"
                  {...register('cell_number')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Home Address</label>
              <textarea
                {...register('home_address')}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter home address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Postal Address</label>
              <textarea
                {...register('postal_address')}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter postal address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Postal Code</label>
              <input
                type="text"
                {...register('postal_code')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter postal code"
              />
            </div>
          </div>
        )}

        {activeTab === 'medical' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Occupation</label>
              <input
                type="text"
                {...register('occupation')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter occupation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Employer</label>
              <input
                type="text"
                {...register('employer')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter employer name"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Medical History</label>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p>Medical history information will be managed through patient visits and medical records.</p>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Allergies & Conditions</label>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p>Allergies and chronic conditions are tracked in the patient's medical records.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medicalaid' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Medical Aid Information</h3>
              <p className="text-sm text-gray-600">Manage the patient's medical aid coverage and benefits.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Medical Aid Provider */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Medical Aid Provider</label>
                <select
                  {...register('medicalAid.provider')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  disabled={loadingProviders}
                >
                  <option value="">Select Medical Aid Provider</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.short_name})
                    </option>
                  ))}
                </select>
                {loadingProviders && (
                  <p className="mt-1 text-sm text-gray-500">Loading providers...</p>
                )}
              </div>

              {/* Medical Aid Scheme */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Scheme/Plan</label>
                <select
                  {...register('medicalAid.scheme')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  disabled={!selectedProvider || loadingSchemes}
                >
                  <option value="">Select scheme</option>
                  {schemes.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.name}
                    </option>
                  ))}
                </select>
                {loadingSchemes && (
                  <p className="mt-1 text-sm text-gray-500">Loading schemes...</p>
                )}
                {!selectedProvider && (
                  <p className="mt-1 text-sm text-gray-500">Please select a provider first</p>
                )}
              </div>

              {/* Membership Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Membership Number</label>
                <input
                  type="text"
                  {...register('medicalAid.membershipNumber')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="Enter membership number"
                />
              </div>

              {/* Main Member Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Main Member Name</label>
                <input
                  type="text"
                  {...register('medicalAid.mainMemberName')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="Name of the main member"
                />
              </div>

              {/* Main Member ID Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Main Member ID Number</label>
                <input
                  type="text"
                  {...register('medicalAid.mainMemberIdNumber')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="ID number of the main member"
                />
              </div>

              {/* Relationship to Main Member */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Relationship to Main Member</label>
                <select
                  {...register('medicalAid.relationship')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
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

            {medicalAidDetails && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-green-800">Current Medical Aid Coverage</h4>
                </div>
                <div className="text-sm text-green-700">
                  <p><strong>Provider:</strong> {medicalAidDetails.provider}</p>
                  <p><strong>Scheme:</strong> {medicalAidDetails.scheme}</p>
                  <p><strong>Member Number:</strong> {medicalAidDetails.membership_number}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'nextofkin' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-50 to-purple-50 rounded-lg p-4 border border-orange-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Emergency Contact Information</h3>
              <p className="text-sm text-gray-600">Provide details for the patient's emergency contact or next of kin.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-500" />
                  Next of Kin Name
                </label>
                <input
                  type="text"
                  {...register('nextOfKin.name')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="Enter next of kin name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-orange-500" />
                  Relationship
                </label>
                <input
                  type="text"
                  {...register('nextOfKin.relationship')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="e.g., Spouse, Parent, Sibling"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-orange-500" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  {...register('nextOfKin.phone')}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  Address
                </label>
                <textarea
                  {...register('nextOfKin.address')}
                  rows={3}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all shadow-sm hover:shadow-md resize-none"
                  placeholder="Enter address"
                />
              </div>
            </div>

            {nextOfKinDetails && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-green-800">Current Emergency Contact</h4>
                </div>
                <div className="text-sm text-green-700">
                  <p><strong>Name:</strong> {nextOfKinDetails.name}</p>
                  <p><strong>Relationship:</strong> {nextOfKinDetails.relationship}</p>
                  <p><strong>Phone:</strong> {nextOfKinDetails.phone}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={() => onSuccess()}
          className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all hover:shadow-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2.5 rounded-lg hover:shadow-lg transition-all font-medium transform hover:scale-105"
        >
          Update Patient
        </button>
      </div>
    </form>
  );
};

export default EditPatientForm;