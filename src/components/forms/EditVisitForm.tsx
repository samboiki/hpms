import React from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface EditVisitFormData {
  visit_type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  chief_complaint: string;
  diagnosis: string;
  treatment_plan: string;
  prescription?: string;
  follow_up_required: boolean;
  follow_up_date?: string;
  notes?: string;
  status: 'in-progress' | 'completed';
}

interface Props {
  visitId: string;
  initialData: EditVisitFormData;
  onSuccess: () => void;
}

const EditVisitForm: React.FC<Props> = ({ visitId, initialData, onSuccess }) => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<EditVisitFormData>({
    defaultValues: initialData
  });

  const followUpRequired = watch('follow_up_required');

  const onSubmit = async (data: EditVisitFormData) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({
          visit_type: data.visit_type,
          chief_complaint: data.chief_complaint,
          diagnosis: data.diagnosis,
          treatment_plan: data.treatment_plan,
          prescription: data.prescription,
          follow_up_required: data.follow_up_required,
          follow_up_date: data.follow_up_required ? data.follow_up_date : null,
          notes: data.notes,
          status: data.status
        })
        .eq('id', visitId);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error updating visit:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Visit Type</label>
        <select
          {...register('visit_type', { required: 'Visit type is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        >
          <option value="consultation">Consultation</option>
          <option value="follow-up">Follow-up</option>
          <option value="procedure">Procedure</option>
          <option value="emergency">Emergency</option>
        </select>
        {errors.visit_type && (
          <p className="mt-1 text-sm text-red-600">{errors.visit_type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Chief Complaint</label>
        <textarea
          {...register('chief_complaint', { required: 'Chief complaint is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.chief_complaint && (
          <p className="mt-1 text-sm text-red-600">{errors.chief_complaint.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Diagnosis</label>
        <textarea
          {...register('diagnosis', { required: 'Diagnosis is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.diagnosis && (
          <p className="mt-1 text-sm text-red-600">{errors.diagnosis.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Treatment Plan</label>
        <textarea
          {...register('treatment_plan', { required: 'Treatment plan is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.treatment_plan && (
          <p className="mt-1 text-sm text-red-600">{errors.treatment_plan.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Prescription</label>
        <textarea
          {...register('prescription')}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          placeholder="Enter prescription details if applicable"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          {...register('follow_up_required')}
          className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
        />
        <label className="ml-2 block text-sm text-gray-700">
          Follow-up Required
        </label>
      </div>

      {followUpRequired && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Follow-up Date</label>
          <input
            type="date"
            {...register('follow_up_date', {
              required: followUpRequired ? 'Follow-up date is required' : false
            })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
          {errors.follow_up_date && (
            <p className="mt-1 text-sm text-red-600">{errors.follow_up_date.message}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Status</label>
        <select
          {...register('status', { required: 'Status is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        >
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        {errors.status && (
          <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Additional Notes</label>
        <textarea
          {...register('notes')}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          placeholder="Any additional notes or observations"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit">
          Update Visit
        </Button>
      </div>
    </form>
  );
};

export default EditVisitForm;