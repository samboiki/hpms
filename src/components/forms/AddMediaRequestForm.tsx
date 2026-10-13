import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { User } from 'lucide-react';
import { errorMessage } from './formErrors';
import { EXCLUDE_CARRIER_VISITS } from '../../utils/carrierVisits';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  practice_id: string | null;
}

interface MediaRequestFormData {
  patient_id: string;
  visit_id: string;
  type: 'xray' | 'ct' | 'mri' | 'ultrasound';
  body_part: string;
  priority: 'routine' | 'urgent' | 'stat';
  expected_completion_date: string;
  notes?: string;
}

interface Props {
  doctorId: string;
  onSuccess: () => void;
}

const AddMediaRequestForm: React.FC<Props> = ({ doctorId, onSuccess }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const { register, handleSubmit, formState: { errors }, watch } = useForm<MediaRequestFormData>();
  
  const patientId = watch('patient_id');

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (patientId) {
      fetchPatientVisits(patientId);
    }
  }, [patientId]);

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, practice_id')
        .order('last_name', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error(`Couldn't load the patient list: ${errorMessage(error)}`);
    }
  };

  const fetchPatientVisits = async (patientId: string) => {
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('id, visit_date, visit_time, visit_type')
        .eq('patient_id', patientId)
        // A row that only carries a payment plan's, package's or opening balance's invoices is not a visit to pick
        .or(EXCLUDE_CARRIER_VISITS)
        .order('visit_date', { ascending: false });

      if (error) throw error;
      setVisits(data || []);
    } catch (error) {
      console.error('Error fetching visits:', error);
      toast.error(`Couldn't load this patient's visits: ${errorMessage(error)}`);
    }
  };

  const onSubmit = async (data: MediaRequestFormData) => {
    // Media requests are listed per practice, so record the patient's practice
    const patient = patients.find(p => p.id === data.patient_id);
    if (!patient?.practice_id) {
      toast.error("Can't create the media request: this patient isn't linked to a practice.");
      return;
    }
    try {
      const { error } = await supabase
        .from('media_requests')
        .insert([{
          practice_id: patient.practice_id,
          visit_id: data.visit_id,
          requesting_doctor_id: doctorId,
          type: data.type,
          body_part: data.body_part,
          priority: data.priority,
          status: 'pending',
          expected_completion_date: data.expected_completion_date,
          notes: data.notes
        }]);

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          toast.error('Media requests are not available yet. Please contact your administrator.');
          return;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error creating media request:', error);
      toast.error(`Couldn't create the media request: ${errorMessage(error)}`);
      return;
    }
    toast.success('Media request created');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Patient</label>
        <select
          {...register('patient_id', { required: 'Patient is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        >
          <option value="">Select patient</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.last_name}, {patient.first_name}
            </option>
          ))}
        </select>
        {errors.patient_id && (
          <p className="mt-1 text-sm text-red-600">{errors.patient_id.message}</p>
        )}
      </div>

      {patientId && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Visit</label>
          <select
            {...register('visit_id', { required: 'Visit is required' })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          >
            <option value="">Select visit</option>
            {visits.map((visit) => (
              <option key={visit.id} value={visit.id}>
                {visit.visit_date ? format(new Date(visit.visit_date), 'dd MMM yyyy') : 'No date'} - {visit.visit_type}
              </option>
            ))}
          </select>
          {errors.visit_id && (
            <p className="mt-1 text-sm text-red-600">{errors.visit_id.message}</p>
          )}
        </div>
      )}

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