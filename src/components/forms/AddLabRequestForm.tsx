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

interface LabRequestFormData {
  patient_id: string;
  visit_id: string;
  test_name: string;
  priority: 'routine' | 'urgent' | 'stat';
  expected_completion_date: string;
  notes?: string;
}

interface Props {
  doctorId: string;
  onSuccess: () => void;
}

const PRIORITY_LABELS: Record<LabRequestFormData['priority'], string> = {
  routine: 'Routine',
  urgent: 'Urgent',
  stat: 'STAT'
};

// lab_requests has no column for the requesting doctor, so doctorId is accepted but not stored
const AddLabRequestForm: React.FC<Props> = ({ onSuccess }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const { register, handleSubmit, formState: { errors }, watch } = useForm<LabRequestFormData>();
  
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

  const onSubmit = async (data: LabRequestFormData) => {
    // Lab requests are listed per practice, so record the patient's practice (as CreateLabRequest does)
    const patient = patients.find(p => p.id === data.patient_id);
    if (!patient?.practice_id) {
      toast.error("Can't create the lab request: this patient isn't linked to a practice.");
      return;
    }
    try {
      // Only real lab_requests columns: the old insert named test_name, priority, requesting_doctor_id and
      // expected_completion_date, which the table doesn't have, so every request failed. The test and
      // priority are kept in the notes.
      const { error } = await supabase
        .from('lab_requests')
        .insert([{
          patient_id: data.patient_id,
          visit_id: data.visit_id,
          practice_id: patient.practice_id,
          request_date: format(new Date(), 'yyyy-MM-dd'),
          preferred_date: data.expected_completion_date || null,
          status: 'pending',
          notes: [`Test: ${data.test_name}`, `Priority: ${PRIORITY_LABELS[data.priority]}`, data.notes?.trim()]
            .filter(Boolean)
            .join('\n')
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating lab request:', error);
      toast.error(`Couldn't create the lab request: ${errorMessage(error)}`);
      return;
    }
    toast.success('Lab request created');
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
        <label className="block text-sm font-medium text-gray-700">Test Name</label>
        <input
          type="text"
          {...register('test_name', { required: 'Test name is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.test_name && (
          <p className="mt-1 text-sm text-red-600">{errors.test_name.message}</p>
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
          // Saved as the request's preferred date, which has no time of day
          type="date"
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

export default AddLabRequestForm;