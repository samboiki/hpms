import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { errorMessage } from './formErrors';

interface MedicalAidFormData {
  provider: string;
  scheme: string;
  provider_id: string;
  scheme_id: string;
  membership_number: string;
  main_member_name: string;
  main_member_id_number: string;
  relationship_to_main: string;
}

interface MedicalAidProvider {
  id: string;
  name: string;
  short_name: string;
}

interface MedicalAidScheme {
  id: string;
  provider_id: string;
  name: string;
  description: string;
}

interface Props {
  patientId: string;
  initialData?: MedicalAidFormData;
  onSuccess: () => void;
}

const MedicalAidForm: React.FC<Props> = ({ patientId, initialData, onSuccess }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MedicalAidFormData>({
    defaultValues: initialData
  });

  const [providers, setProviders] = useState<MedicalAidProvider[]>([]);
  const [schemes, setSchemes] = useState<MedicalAidScheme[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingSchemes, setLoadingSchemes] = useState(false);

  const selectedProviderId = watch('provider_id');

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
        toast.error(`Couldn't load the medical aid list: ${errorMessage(error)}`);
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);

  // Fetch schemes when provider changes
  useEffect(() => {
    if (selectedProviderId) {
      const fetchSchemes = async () => {
        setLoadingSchemes(true);
        try {
          const { data, error } = await supabase
            .from('medical_aid_schemes')
            .select('id, name, description')
            .eq('provider_id', selectedProviderId)
            .order('name');

          if (error) throw error;
          setSchemes(data || []);
        } catch (error) {
          console.error('Error fetching schemes:', error);
          toast.error(`Couldn't load the schemes for this medical aid: ${errorMessage(error)}`);
        } finally {
          setLoadingSchemes(false);
        }
      };

      fetchSchemes();
    } else {
      setSchemes([]);
      setValue('scheme_id', '');
    }
  }, [selectedProviderId, setValue]);

  const onSubmit = async (data: MedicalAidFormData) => {
    try {
      // Get provider and scheme names
      const selectedProvider = providers.find(p => p.id === data.provider_id);
      const selectedScheme = schemes.find(s => s.id === data.scheme_id);

      // The real medical_aid_details columns, written the same way as EditPatientForm: the old
      // scheme_name, provider_id and scheme_id keys don't exist on the table, so every save failed
      const medicalAidData = {
        provider: selectedProvider?.name || '',
        scheme: selectedScheme?.name || '',
        plan_type: selectedScheme?.name || '',
        medical_aid_provider_id: data.provider_id,
        membership_number: data.membership_number,
        main_member_name: data.main_member_name,
        main_member_id_number: data.main_member_id_number,
        relationship_to_main: data.relationship_to_main
      };

      if (initialData) {
        // Update existing medical aid
        const { error } = await supabase
          .from('medical_aid_details')
          .update(medicalAidData)
          .eq('patient_id', patientId);

        if (error) throw error;
      } else {
        // Insert new medical aid
        const { error } = await supabase
          .from('medical_aid_details')
          .insert([{
            patient_id: patientId,
            ...medicalAidData
          }]);

        if (error) throw error;
      }

    } catch (error) {
      console.error('Error saving medical aid:', error);
      toast.error(`Couldn't save the medical aid details: ${errorMessage(error)}`);
      return;
    }
    toast.success('Medical aid details saved');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Provider</label>
          <select
            {...register('provider_id', { required: 'Provider is required' })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            disabled={loadingProviders}
          >
            <option value="">Select Medical Aid Provider</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          {errors.provider_id && (
            <p className="mt-1 text-sm text-red-600">{errors.provider_id.message}</p>
          )}
          {loadingProviders && (
            <p className="mt-1 text-sm text-gray-500">Loading providers...</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Scheme/Option</label>
          <select
            {...register('scheme_id', { required: 'Scheme is required' })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            disabled={!selectedProviderId || loadingSchemes}
          >
            <option value="">Select Scheme</option>
            {schemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name} {scheme.description && `- ${scheme.description}`}
              </option>
            ))}
          </select>
          {errors.scheme_id && (
            <p className="mt-1 text-sm text-red-600">{errors.scheme_id.message}</p>
          )}
          {loadingSchemes && (
            <p className="mt-1 text-sm text-gray-500">Loading schemes...</p>
          )}
          {!selectedProviderId && schemes.length === 0 && (
            <p className="mt-1 text-sm text-gray-500">Please select a provider first</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Membership Number</label>
          <input
            type="text"
            {...register('membership_number', { required: 'Membership number is required' })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            placeholder="e.g., 123456789"
          />
          {errors.membership_number && (
            <p className="mt-1 text-sm text-red-600">{errors.membership_number.message}</p>
          )}
        </div>


        <div>
          <label className="block text-sm font-medium text-gray-700">Main Member Name</label>
          <input
            type="text"
            {...register('main_member_name', { required: 'Main member name is required' })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            placeholder="Full name of main member"
          />
          {errors.main_member_name && (
            <p className="mt-1 text-sm text-red-600">{errors.main_member_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Main Member ID Number</label>
          <input
            type="text"
            {...register('main_member_id_number', { required: 'ID number is required' })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            placeholder="ID number"
          />
          {errors.main_member_id_number && (
            <p className="mt-1 text-sm text-red-600">{errors.main_member_id_number.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Relationship to Main Member</label>
          <select
            {...register('relationship_to_main', { required: 'Relationship is required' })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          >
            <option value="">Select relationship</option>
            <option value="self">Self (Main Member)</option>
            <option value="spouse">Spouse</option>
            <option value="child">Child</option>
            <option value="parent">Parent</option>
            <option value="other">Other Dependent</option>
          </select>
          {errors.relationship_to_main && (
            <p className="mt-1 text-sm text-red-600">{errors.relationship_to_main.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit">
          {initialData ? 'Update' : 'Add'} Medical Aid
        </Button>
      </div>
    </form>
  );
};

export default MedicalAidForm;