import React from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';

interface VitalsFormData {
  bloodPressure: string;
  temperature: number;
  pulseRate: number;
  respiratoryRate: number;
  weight: number;
  height: number;
  bmi: number;
  notes?: string;
}

interface Props {
  medicalRecordId: string;
  onSuccess: () => void;
  initialData?: Partial<VitalsFormData>;
}

const VitalsForm: React.FC<Props> = ({ medicalRecordId, onSuccess, initialData }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<VitalsFormData>({
    defaultValues: initialData
  });

  // Calculate BMI when weight or height changes
  React.useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'weight' || name === 'height') {
        const weight = value.weight;
        const height = value.height;
        if (weight && height) {
          const heightInMeters = height / 100;
          const bmi = weight / (heightInMeters * heightInMeters);
          setValue('bmi', Math.round(bmi * 10) / 10);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue]);

  const onSubmit = async (data: VitalsFormData) => {
    try {
      // Here you would typically make an API call to save the vitals
      console.log('Saving vitals:', data);
      onSuccess();
    } catch (error) {
      console.error('Failed to save vitals:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Blood Pressure (mmHg)</label>
          <input
            type="text"
            placeholder="120/80"
            {...register('bloodPressure', {
              required: 'Blood pressure is required',
              pattern: {
                value: /^\d{2,3}\/\d{2,3}$/,
                message: 'Invalid format. Use systolic/diastolic (e.g., 120/80)'
              }
            })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
          {errors.bloodPressure && (
            <p className="mt-1 text-sm text-red-600">{errors.bloodPressure.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Temperature (°C)</label>
          <input
            type="number"
            step="0.1"
            {...register('temperature', {
              required: 'Temperature is required',
              min: { value: 35, message: 'Temperature too low' },
              max: { value: 42, message: 'Temperature too high' }
            })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
          {errors.temperature && (
            <p className="mt-1 text-sm text-red-600">{errors.temperature.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Pulse Rate (bpm)</label>
          <input
            type="number"
            {...register('pulseRate', {
              required: 'Pulse rate is required',
              min: { value: 40, message: 'Pulse rate too low' },
              max: { value: 200, message: 'Pulse rate too high' }
            })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
          {errors.pulseRate && (
            <p className="mt-1 text-sm text-red-600">{errors.pulseRate.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Respiratory Rate (breaths/min)</label>
          <input
            type="number"
            {...register('respiratoryRate', {
              required: 'Respiratory rate is required',
              min: { value: 8, message: 'Respiratory rate too low' },
              max: { value: 40, message: 'Respiratory rate too high' }
            })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
          {errors.respiratoryRate && (
            <p className="mt-1 text-sm text-red-600">{errors.respiratoryRate.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
          <input
            type="number"
            step="0.1"
            {...register('weight', {
              required: 'Weight is required',
              min: { value: 0, message: 'Weight must be positive' }
            })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
          {errors.weight && (
            <p className="mt-1 text-sm text-red-600">{errors.weight.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
          <input
            type="number"
            {...register('height', {
              required: 'Height is required',
              min: { value: 0, message: 'Height must be positive' }
            })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
          {errors.height && (
            <p className="mt-1 text-sm text-red-600">{errors.height.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">BMI</label>
          <input
            type="number"
            step="0.1"
            {...register('bmi')}
            readOnly
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit" className="bg-gradient-to-r from-[#01b8d8] to-[#01b8d8]">
          Save Vitals
        </Button>
      </div>
    </form>
  );
};

export default VitalsForm;