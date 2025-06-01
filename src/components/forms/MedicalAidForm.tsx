import React from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface MedicalAidFormData {
  provider: string;
  scheme: string;
  membership_number: string;
  main_member_name: string;
  main_member_id_number: string;
  relationship_to_main: string;
}

interface Props {
  patientId: string;
  initialData?: MedicalAidFormData;
  onSuccess: () => void;
}

const MedicalAidForm: React.FC<Props> = ({ patientId, initialData, onSuccess }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<MedicalAidFormData>({
    defaultValues: initialData
  });

  const onSubmit = async (data: MedicalAidFormData) => {
    try {
      if (initialData) {
        // Update existing medical aid
        const { error } = await supabase
          .from('medical_aid_details')
          .update(data)
          .eq('patient_id', patientId);

        if (error) throw error;
      } else {
        // Insert new medical aid
        const { error } = await supabase
          .from('medical_aid_details')
          .insert([{
            patient_id: patientId,
            ...data
          }]);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving medical aid:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Provider</label>
          <select
            {...register('provider', { required: 'Provider is required' })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          >
            <option value="">Select Medical Aid Provider</option>
            <option value="Namibia Medical Care (NMC)">Namibia Medical Care (NMC)</option>
            <option value="Namibia Health Plan (NHP)">Namibia Health Plan (NHP)</option>
            <option value="Nammed Medical Aid Fund">Nammed Medical Aid Fund</option>
            <option value="Gemhealth Medical Aid">Gemhealth Medical Aid</option>
            <option value="Bonitas Medical Fund">Bonitas Medical Fund</option>
            <option value="Discovery Health">Discovery Health</option>
            <option value="Old Mutual Health">Old Mutual Health</option>
            <option value="Momentum Health">Momentum Health</option>
            <option value="Medshield">Medshield</option>
            <option value="Napotel Medical Aid">Napotel Medical Aid</option>
            <option value="Bankmed Namibia">Bankmed Namibia</option>
            <option value="Renaissance Health Medical Aid Fund">Renaissance Health Medical Aid Fund</option>
            <option value="Methealth Namibia">Methealth Namibia</option>
          </select>
          {errors.provider && (
            <p className="mt-1 text-sm text-red-600">{errors.provider.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Scheme/Option</label>
          <select
            {...register('scheme', { required: 'Scheme is required' })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          >
            <option value="">Select Scheme</option>
            {/* NMC Options */}
            <option value="Diamond">Diamond</option>
            <option value="Platinum">Platinum</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Bronze">Bronze</option>
            {/* NHP Options */}
            <option value="Comprehensive">Comprehensive</option>
            <option value="Executive">Executive</option>
            <option value="Standard">Standard</option>
            <option value="Essential">Essential</option>
            {/* Discovery Options */}
            <option value="Executive Plan">Executive Plan</option>
            <option value="Smart Plan">Smart Plan</option>
            {/* Bonitas Options */}
            <option value="BonComprehensive">BonComprehensive</option>
            <option value="BonEssential">BonEssential</option>
            <option value="BonCap">BonCap</option>
            <option value="BonStart">BonStart</option>
            {/* General Options */}
            <option value="Premium">Premium</option>
            <option value="Hospital">Hospital</option>
            <option value="Access">Access</option>
            <option value="Pinnacle">Pinnacle</option>
            <option value="Extender">Extender</option>
            <option value="Option A">Option A</option>
            <option value="Option B">Option B</option>
            <option value="Option C">Option C</option>
          </select>
          {errors.scheme && (
            <p className="mt-1 text-sm text-red-600">{errors.scheme.message}</p>
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