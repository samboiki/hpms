import React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import Button from '../ui/Button';
import { FeatureGuard } from '../practice/FeatureGuard';
import { supabase } from '../../lib/supabase';
import { checkBloodPressure, checkTemperature } from '../../utils/vitalSigns';
import { errorMessage } from './formErrors';
import VitalFlagNote from './VitalFlagNote';

interface VitalsFormData {
  bloodPressure: string;
  temperature: number;
  pulseRate: number;
  respiratoryRate: number;
  weight: number;
  height: number;
  bmi: number;
}

interface Props {
  /** The visit the vitals belong to: the vitals table is keyed by visit (the caller already passes it) */
  visitId: string;
  onSuccess: () => void;
  initialData?: Partial<VitalsFormData>;
}

const VitalsForm: React.FC<Props> = ({ visitId, onSuccess, initialData }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<VitalsFormData>({
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

  // "Save Vitals" used to log the values and close, so nothing was ever recorded
  const onSubmit = async (data: VitalsFormData) => {
    if (!visitId) {
      toast.error('Vitals are recorded against a visit. Start a visit for this patient first.');
      return;
    }
    try {
      const { error } = await supabase
        .from('vitals')
        .insert([{
          visit_id: visitId,
          blood_pressure: data.bloodPressure.trim(),
          temperature: data.temperature,
          pulse_rate: data.pulseRate,
          respiratory_rate: data.respiratoryRate,
          weight: data.weight,
          height: data.height,
          bmi: data.bmi || null
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save vitals:', error);
      toast.error(`Couldn't save the vitals: ${errorMessage(error)}`);
      return;
    }
    toast.success('Vitals saved');
    onSuccess();
  };

  return (
    <FeatureGuard feature="vitals_tracking">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {!visitId && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This patient has no visit to save vitals to. Start a visit first, then record the vitals.
        </p>
      )}
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
          <VitalFlagNote check={checkBloodPressure(watch('bloodPressure'))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Temperature (°C)</label>
          <input
            type="number"
            step="0.1"
            // Wide limits only catch typing mistakes: a real reading below 35 °C (hypothermia) must be
            // recordable, so it is flagged below rather than refused
            {...register('temperature', {
              required: 'Temperature is required',
              min: { value: 25, message: 'Check the reading: enter a temperature between 25 and 45 °C' },
              max: { value: 45, message: 'Check the reading: enter a temperature between 25 and 45 °C' },
              valueAsNumber: true
            })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
          />
          {errors.temperature && (
            <p className="mt-1 text-sm text-red-600">{errors.temperature.message}</p>
          )}
          <VitalFlagNote check={checkTemperature(watch('temperature'))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Pulse Rate (bpm)</label>
          <input
            type="number"
            // Typing-mistake limits only: the old 40-200 refused real bradycardia and fast infant pulses
            {...register('pulseRate', {
              required: 'Pulse rate is required',
              min: { value: 20, message: 'Check the reading: enter a pulse between 20 and 250 bpm' },
              max: { value: 250, message: 'Check the reading: enter a pulse between 20 and 250 bpm' },
              valueAsNumber: true
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
            // Typing-mistake limits only: the old maximum of 40 refused a newborn's normal breathing rate
            {...register('respiratoryRate', {
              required: 'Respiratory rate is required',
              min: { value: 4, message: 'Check the reading: enter a breathing rate between 4 and 100 per minute' },
              max: { value: 100, message: 'Check the reading: enter a breathing rate between 4 and 100 per minute' },
              valueAsNumber: true
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
              min: { value: 0, message: 'Weight must be positive' },
              valueAsNumber: true
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
              min: { value: 0, message: 'Height must be positive' },
              valueAsNumber: true
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

      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#01b8d8] to-[#01b8d8]">
          {isSubmitting ? 'Saving...' : 'Save Vitals'}
        </Button>
      </div>
      </form>
    </FeatureGuard>
  );
};

export default VitalsForm;