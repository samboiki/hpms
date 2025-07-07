import React from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { usePatientsStore } from '../../stores/patientsStore';

interface AddMedicalRecordFormData {
  title: string;
  type: 'visit' | 'diagnosis' | 'prescription' | 'lab' | 'immunization';
  description: string;
  date: string;
  doctor: string;
}

interface Props {
  patientId: string;
  onSuccess: () => void;
}

const AddMedicalRecordForm: React.FC<Props> = ({ patientId, onSuccess }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<AddMedicalRecordFormData>();
  const { updatePatient, getPatientById } = usePatientsStore();

  const onSubmit = async (data: AddMedicalRecordFormData) => {
    try {
      const patient = getPatientById(patientId);
      if (!patient) return;

      const newRecord = {
        id: Math.random().toString(36).substring(2, 11),
        ...data,
      };

      await updatePatient(patientId, {
        medicalHistory: [...patient.medicalHistory, newRecord],
      });
      
      onSuccess();
    } catch (error) {
      console.error('Failed to add medical record:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Title</label>
        <input
          type="text"
          {...register('title', { required: 'Title is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Type</label>
        <select
          {...register('type', { required: 'Type is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        >
          <option value="">Select type</option>
          <option value="visit">Visit</option>
          <option value="diagnosis">Diagnosis</option>
          <option value="prescription">Prescription</option>
          <option value="lab">Lab Result</option>
          <option value="immunization">Immunization</option>
        </select>
        {errors.type && (
          <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          {...register('description', { required: 'Description is required' })}
          rows={4}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Date</label>
        <input
          type="date"
          {...register('date', { required: 'Date is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.date && (
          <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Doctor</label>
        <input
          type="text"
          {...register('doctor', { required: 'Doctor name is required' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
        />
        {errors.doctor && (
          <p className="mt-1 text-sm text-red-600">{errors.doctor.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit" className="bg-gradient-to-r from-[#01b8d8] to-[#01b8d8]">
          Add Record
        </Button>
      </div>
    </form>
  );
};

export default AddMedicalRecordForm;