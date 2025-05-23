import React from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface NextOfKinFormData {
  name: string;
  relationship: string;
  phone: string;
  address: string;
}

interface Props {
  patientId: string;
  initialData?: NextOfKinFormData;
  onSuccess: () => void;
}

const NextOfKinForm: React.FC<Props> = ({ patientId, initialData, onSuccess }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<NextOfKinFormData>({
    defaultValues: initialData
  });

  const onSubmit = async (data: NextOfKinFormData) => {
    try {
      if (initialData) {
        // Update existing next of kin
        const { error } = await supabase
          .from('next_of_kin')
          .update(data)
          .eq('patient_id', patientId);

        if (error) throw error;
      } else {
        // Insert new next of kin
        const { error } = await supabase
          .from('next_of_kin')
          .insert([{
            patient_id: patientId,
            ...data
          }]);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving next of kin:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          {...register('name', { required: 'Name is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Relationship</label>
        <input
          type="text"
          {...register('relationship', { required: 'Relationship is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.relationship && (
          <p className="mt-1 text-sm text-red-600">{errors.relationship.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Phone</label>
        <input
          type="tel"
          {...register('phone', { required: 'Phone number is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <textarea
          {...register('address')}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit">
          {initialData ? 'Update' : 'Add'} Next of Kin
        </Button>
      </div>
    </form>
  );
};

export default NextOfKinForm;