import React from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface MediaRequestFormData {
  type: 'xray' | 'ct' | 'mri' | 'ultrasound';
  body_part: string;
  priority: 'routine' | 'urgent' | 'stat';
  expected_completion_date: string;
  notes?: string;
}

interface Props {
  visitId: string;
  doctorId: string;
  onSuccess: () => void;
}

const AddMediaRequestForm: React.FC<Props> = ({ visitId, doctorId, onSuccess }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<MediaRequestFormData>();

  const onSubmit = async (data: MediaRequestFormData) => {
    try {
      const { error } = await supabase
        .from('media_requests')
        .insert([{
          visit_id: visitId,
          requesting_doctor_id: doctorId,
          type: data.type,
          body_part: data.body_part,
          priority: data.priority,
          status: 'pending',
          expected_completion_date: data.expected_completion_date,
          notes: data.notes
        }]);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error creating media request:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Type</label>
        <select
          {...register('type', { required: 'Type is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        >
          <option value="xray">X-Ray</option>
          <option value="ct">CT Scan</option>
          <option value="mri">MRI</option>
          <option value="ultrasound">Ultrasound</option>
        </select>
        {errors.type && (
          <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Body Part</label>
        <input
          type="text"
          {...register('body_part', { required: 'Body part is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.body_part && (
          <p className="mt-1 text-sm text-red-600">{errors.body_part.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Priority</label>
        <select
          {...register('priority', { required: 'Priority is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        >
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="stat">STAT</option>
        </select>
        {errors.priority && (
          <p className="mt-1 text-sm text-red-600">{errors.priority.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Expected Completion Date</label>
        <input
          type="datetime-local"
          {...register('expected_completion_date', { required: 'Expected completion date is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.expected_completion_date && (
          <p className="mt-1 text-sm text-red-600">{errors.expected_completion_date.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          {...register('notes')}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit">
          Submit Request
        </Button>
      </div>
    </form>
  );
};

export default AddMediaRequestForm;