import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface MedicalAidFormData {
  medical_aid_provider_id: string;
  scheme_name: string;
  scheme_type: string;
  member_number: string;
  main_member_name: string;
  main_member_id_number: string;
  relationship_to_main_member: string;
  dependent_code: string;
  valid_from: string;
  valid_to: string;
}

interface MedicalAidProvider {
  id: string;
  name: string;
  short_name: string;
  logo_url?: string;
  medical_aid_reference: string;
}

interface Props {
  patientId: string;
  initialData?: Partial<MedicalAidFormData>;
  onSuccess: () => void;
}

const FixedMedicalAidForm: React.FC<Props> = ({ patientId, initialData, onSuccess }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MedicalAidFormData>({
    defaultValues: initialData
  });

  const [providers, setProviders] = useState<MedicalAidProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch medical aid providers using the new function
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoadingProviders(true);
        
        // Use the new function we created
        const { data, error } = await supabase.rpc('get_medical_aid_providers');
        
        if (error) {
          console.error('Error fetching medical aid providers:', error);
          setError('Failed to load medical aid providers');
          return;
        }

        setProviders(data || []);
      } catch (err) {
        console.error('Error in fetchProviders:', err);
        setError('Failed to load medical aid providers');
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);

  const onSubmit = async (data: MedicalAidFormData) => {
    try {
      setError('');

      // Validate required fields
      if (!data.medical_aid_provider_id) {
        setError('Please select a medical aid provider');
        return;
      }

      if (!data.member_number) {
        setError('Please enter a member number');
        return;
      }

      // Prepare the data for insertion
      const medicalAidData = {
        patient_id: patientId,
        medical_aid_provider_id: data.medical_aid_provider_id,
        scheme_name: data.scheme_name || '',
        scheme_type: data.scheme_type || '',
        member_number: data.member_number,
        main_member_name: data.main_member_name || '',
        main_member_id_number: data.main_member_id_number || '',
        relationship_to_main_member: data.relationship_to_main_member || '',
        dependent_code: data.dependent_code || '',
        valid_from: data.valid_from ? new Date(data.valid_from).toISOString().split('T')[0] : null,
        valid_to: data.valid_to ? new Date(data.valid_to).toISOString().split('T')[0] : null,
      };

      console.log('Submitting medical aid data:', medicalAidData);

      // Insert or update the medical aid details
      const { error: submitError } = await supabase
        .from('medical_aid_details')
        .upsert(medicalAidData, {
          onConflict: 'patient_id'
        });

      if (submitError) {
        console.error('Error saving medical aid details:', submitError);
        setError(`Failed to save medical aid details: ${submitError.message}`);
        return;
      }

      console.log('Medical aid details saved successfully');
      onSuccess();
    } catch (err) {
      console.error('Error in onSubmit:', err);
      setError('An unexpected error occurred');
    }
  };

  if (loadingProviders) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Medical Aid Provider Selection */}
      <div>
        <label htmlFor="medical_aid_provider_id" className="block text-sm font-medium text-gray-700 mb-1">
          Medical Aid Provider *
        </label>
        <select
          id="medical_aid_provider_id"
          {...register('medical_aid_provider_id', { required: 'Please select a medical aid provider' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        >
          <option value="">Select Medical Aid Provider</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name} ({provider.short_name})
            </option>
          ))}
        </select>
        {errors.medical_aid_provider_id && (
          <p className="text-red-500 text-xs mt-1">{errors.medical_aid_provider_id.message}</p>
        )}
      </div>

      {/* Scheme Name */}
      <div>
        <label htmlFor="scheme_name" className="block text-sm font-medium text-gray-700 mb-1">
          Scheme Name
        </label>
        <input
          type="text"
          id="scheme_name"
          {...register('scheme_name')}
          placeholder="e.g., Family Plan, Executive Plan"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        />
      </div>

      {/* Scheme Type */}
      <div>
        <label htmlFor="scheme_type" className="block text-sm font-medium text-gray-700 mb-1">
          Scheme Type
        </label>
        <select
          id="scheme_type"
          {...register('scheme_type')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        >
          <option value="">Select Scheme Type</option>
          <option value="medical_aid">Medical Aid</option>
          <option value="health_insurance">Health Insurance</option>
          <option value="hospital_plan">Hospital Plan</option>
          <option value="comprehensive">Comprehensive Cover</option>
        </select>
      </div>

      {/* Member Number */}
      <div>
        <label htmlFor="member_number" className="block text-sm font-medium text-gray-700 mb-1">
          Member Number *
        </label>
        <input
          type="text"
          id="member_number"
          {...register('member_number', { required: 'Member number is required' })}
          placeholder="Enter member number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        />
        {errors.member_number && (
          <p className="text-red-500 text-xs mt-1">{errors.member_number.message}</p>
        )}
      </div>

      {/* Main Member Name */}
      <div>
        <label htmlFor="main_member_name" className="block text-sm font-medium text-gray-700 mb-1">
          Main Member Name
        </label>
        <input
          type="text"
          id="main_member_name"
          {...register('main_member_name')}
          placeholder="Name of the main member"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        />
      </div>

      {/* Main Member ID Number */}
      <div>
        <label htmlFor="main_member_id_number" className="block text-sm font-medium text-gray-700 mb-1">
          Main Member ID Number
        </label>
        <input
          type="text"
          id="main_member_id_number"
          {...register('main_member_id_number')}
          placeholder="ID number of the main member"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        />
      </div>

      {/* Relationship to Main Member */}
      <div>
        <label htmlFor="relationship_to_main_member" className="block text-sm font-medium text-gray-700 mb-1">
          Relationship to Main Member
        </label>
        <select
          id="relationship_to_main_member"
          {...register('relationship_to_main_member')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        >
          <option value="">Select relationship</option>
          <option value="main_member">Main Member</option>
          <option value="spouse">Spouse</option>
          <option value="child">Child</option>
          <option value="dependent">Dependent</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Dependent Code */}
      <div>
        <label htmlFor="dependent_code" className="block text-sm font-medium text-gray-700 mb-1">
          Dependent Code
        </label>
        <input
          type="text"
          id="dependent_code"
          {...register('dependent_code')}
          placeholder="Dependent code (if applicable)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        />
      </div>

      {/* Valid From */}
      <div>
        <label htmlFor="valid_from" className="block text-sm font-medium text-gray-700 mb-1">
          Valid From
        </label>
        <input
          type="date"
          id="valid_from"
          {...register('valid_from')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        />
      </div>

      {/* Valid To */}
      <div>
        <label htmlFor="valid_to" className="block text-sm font-medium text-gray-700 mb-1">
          Valid To
        </label>
        <input
          type="date"
          id="valid_to"
          {...register('valid_to')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
        />
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? 'Saving...' : 'Save Medical Aid Details'}
        </Button>
      </div>
    </form>
  );
};

export default FixedMedicalAidForm;