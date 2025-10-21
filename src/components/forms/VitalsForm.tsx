import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { FeatureGuard } from '../practice/FeatureGuard';
import { Icon } from '@iconify/react';
import { PremiumInput, PremiumSelect } from '../ui/PremiumInput';
import { cn } from '../../utils/cn';

interface VitalsFormData {
  bloodPressure: string;
  temperature: number;
  pulseRate: number;
  respiratoryRate: number;
  weight: number;
  height: number;
  bmi: number;
  oxygenSaturation: number;
  consciousnessLevel: 'alert' | 'verbal' | 'pain' | 'unresponsive';
  supplementalOxygen: boolean;
  notes?: string;
}

interface Props {
  medicalRecordId: string;
  onSuccess: () => void;
  initialData?: Partial<VitalsFormData>;
  isInpatient?: boolean;
}

const VitalsForm: React.FC<Props> = ({ medicalRecordId, onSuccess, initialData, isInpatient = false }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<VitalsFormData>({
    defaultValues: {
      consciousnessLevel: 'alert',
      supplementalOxygen: false,
      ...initialData
    }
  });

  const [ewsScore, setEwsScore] = useState(0);
  const [ewsCategory, setEwsCategory] = useState<'low' | 'medium' | 'high' | 'critical'>('low');

  // Watch all fields needed for EWS calculation
  const watchedValues = watch();

  // Calculate EWS Score
  const calculateEWS = () => {
    let score = 0;

    // Respiratory Rate Score
    const rr = watchedValues.respiratoryRate;
    if (rr) {
      if (rr <= 8) score += 3;
      else if (rr >= 9 && rr <= 11) score += 1;
      else if (rr >= 12 && rr <= 20) score += 0;
      else if (rr >= 21 && rr <= 24) score += 2;
      else if (rr >= 25) score += 3;
    }

    // Oxygen Saturation Score
    const o2 = watchedValues.oxygenSaturation;
    if (o2) {
      if (o2 <= 91) score += 3;
      else if (o2 >= 92 && o2 <= 93) score += 2;
      else if (o2 >= 94 && o2 <= 95) score += 1;
      else if (o2 >= 96) score += 0;
    }

    // Supplemental Oxygen
    if (watchedValues.supplementalOxygen) score += 2;

    // Temperature Score
    const temp = watchedValues.temperature;
    if (temp) {
      if (temp <= 35.0) score += 3;
      else if (temp >= 35.1 && temp <= 36.0) score += 1;
      else if (temp >= 36.1 && temp <= 38.0) score += 0;
      else if (temp >= 38.1 && temp <= 39.0) score += 1;
      else if (temp >= 39.1) score += 2;
    }

    // Blood Pressure Score (Systolic)
    const bp = watchedValues.bloodPressure;
    if (bp) {
      const systolic = parseInt(bp.split('/')[0]);
      if (!isNaN(systolic)) {
        if (systolic <= 90) score += 3;
        else if (systolic >= 91 && systolic <= 100) score += 2;
        else if (systolic >= 101 && systolic <= 110) score += 1;
        else if (systolic >= 111 && systolic <= 219) score += 0;
        else if (systolic >= 220) score += 3;
      }
    }

    // Pulse Rate Score
    const pulse = watchedValues.pulseRate;
    if (pulse) {
      if (pulse <= 40) score += 3;
      else if (pulse >= 41 && pulse <= 50) score += 1;
      else if (pulse >= 51 && pulse <= 90) score += 0;
      else if (pulse >= 91 && pulse <= 110) score += 1;
      else if (pulse >= 111 && pulse <= 130) score += 2;
      else if (pulse >= 131) score += 3;
    }

    // Consciousness Level Score
    const consciousness = watchedValues.consciousnessLevel;
    if (consciousness && consciousness !== 'alert') {
      score += 3;
    }

    return score;
  };

  // Calculate BMI when weight or height changes
  useEffect(() => {
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

  // Calculate EWS when relevant fields change
  useEffect(() => {
    if (isInpatient) {
      const score = calculateEWS();
      setEwsScore(score);

      // Determine category
      if (score >= 7) setEwsCategory('critical');
      else if (score >= 5) setEwsCategory('high');
      else if (score >= 3) setEwsCategory('medium');
      else setEwsCategory('low');
    }
  }, [
    watchedValues.respiratoryRate,
    watchedValues.oxygenSaturation,
    watchedValues.supplementalOxygen,
    watchedValues.temperature,
    watchedValues.bloodPressure,
    watchedValues.pulseRate,
    watchedValues.consciousnessLevel,
    isInpatient
  ]);

  const onSubmit = async (data: VitalsFormData) => {
    try {
      // Include EWS score if inpatient
      const submitData = isInpatient ? { ...data, ewsScore } : data;
      console.log('Saving vitals:', submitData);
      onSuccess();
    } catch (error) {
      console.error('Failed to save vitals:', error);
    }
  };

  return (
    <FeatureGuard feature="vitals_tracking">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* EWS Score Display for Inpatients */}
        {isInpatient && (
          <div className={cn(
            'p-4 rounded-xl border-2',
            ewsCategory === 'critical' ? 'bg-red-50 border-red-300' :
            ewsCategory === 'high' ? 'bg-orange-50 border-orange-300' :
            ewsCategory === 'medium' ? 'bg-yellow-50 border-yellow-300' :
            'bg-green-50 border-green-300'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl',
                  ewsCategory === 'critical' ? 'bg-red-100' :
                  ewsCategory === 'high' ? 'bg-orange-100' :
                  ewsCategory === 'medium' ? 'bg-yellow-100' :
                  'bg-green-100'
                )}>
                  <Icon
                    icon={
                      ewsCategory === 'critical' ? 'solar:danger-triangle-bold-duotone' :
                      ewsCategory === 'high' ? 'solar:shield-warning-bold-duotone' :
                      ewsCategory === 'medium' ? 'solar:info-circle-bold-duotone' :
                      'solar:shield-check-bold-duotone'
                    }
                    className={cn(
                      'w-6 h-6',
                      ewsCategory === 'critical' ? 'text-red-600' :
                      ewsCategory === 'high' ? 'text-orange-600' :
                      ewsCategory === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    )}
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Early Warning Score (EWS)</h3>
                  <p className="text-sm text-gray-600">
                    {ewsCategory === 'critical' ? 'Critical - Immediate medical attention required' :
                     ewsCategory === 'high' ? 'High - Urgent medical review needed' :
                     ewsCategory === 'medium' ? 'Medium - Increased monitoring required' :
                     'Low - Continue routine monitoring'}
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className={cn(
                  'text-3xl font-bold',
                  ewsCategory === 'critical' ? 'text-red-600' :
                  ewsCategory === 'high' ? 'text-orange-600' :
                  ewsCategory === 'medium' ? 'text-yellow-600' :
                  'text-green-600'
                )}>
                  {ewsScore}
                </div>
                <div className="text-xs text-gray-500 uppercase font-medium">Score</div>
              </div>
            </div>
          </div>
        )}

        {/* Form Fields Container */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
          {/* Basic Vitals Section */}
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Icon icon="solar:heart-pulse-bold-duotone" className="w-5 h-5 text-red-500" />
            Basic Vitals
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure (mmHg)</label>
              <PremiumInput
                type="text"
                placeholder="120/80"
                icon="solar:heart-bold-duotone"
                iconColor="text-red-500"
                {...register('bloodPressure', {
                  required: 'Blood pressure is required',
                  pattern: {
                    value: /^\d{2,3}\/\d{2,3}$/,
                    message: 'Invalid format. Use systolic/diastolic (e.g., 120/80)'
                  }
                })}
                error={errors.bloodPressure?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
              <PremiumInput
                type="number"
                step="0.1"
                icon="solar:temperature-bold-duotone"
                iconColor="text-orange-500"
                {...register('temperature', {
                  required: 'Temperature is required',
                  min: { value: 35, message: 'Temperature too low' },
                  max: { value: 42, message: 'Temperature too high' }
                })}
                error={errors.temperature?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pulse Rate (bpm)</label>
              <PremiumInput
                type="number"
                icon="solar:pulse-bold-duotone"
                iconColor="text-pink-500"
                {...register('pulseRate', {
                  required: 'Pulse rate is required',
                  min: { value: 40, message: 'Pulse rate too low' },
                  max: { value: 200, message: 'Pulse rate too high' }
                })}
                error={errors.pulseRate?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate (breaths/min)</label>
              <PremiumInput
                type="number"
                icon="solar:wind-bold-duotone"
                iconColor="text-blue-500"
                {...register('respiratoryRate', {
                  required: 'Respiratory rate is required',
                  min: { value: 8, message: 'Respiratory rate too low' },
                  max: { value: 40, message: 'Respiratory rate too high' }
                })}
                error={errors.respiratoryRate?.message}
              />
            </div>

            {/* Additional fields for inpatients */}
            {isInpatient && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Oxygen Saturation (%)</label>
                  <PremiumInput
                    type="number"
                    icon="solar:test-tube-bold-duotone"
                    iconColor="text-cyan-500"
                    {...register('oxygenSaturation', {
                      required: 'Oxygen saturation is required',
                      min: { value: 70, message: 'Oxygen saturation too low' },
                      max: { value: 100, message: 'Oxygen saturation cannot exceed 100%' }
                    })}
                    error={errors.oxygenSaturation?.message}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Consciousness Level</label>
                  <PremiumSelect
                    icon="solar:eye-bold-duotone"
                    iconColor="text-purple-500"
                    {...register('consciousnessLevel', {
                      required: 'Consciousness level is required'
                    })}
                  >
                    <option value="alert">Alert</option>
                    <option value="verbal">Responds to Verbal</option>
                    <option value="pain">Responds to Pain</option>
                    <option value="unresponsive">Unresponsive</option>
                  </PremiumSelect>
                  {errors.consciousnessLevel && (
                    <p className="mt-1 text-sm text-red-600">{errors.consciousnessLevel.message}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Physical Measurements Section */}
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Icon icon="solar:ruler-pen-bold-duotone" className="w-5 h-5 text-indigo-500" />
            Physical Measurements
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <PremiumInput
                type="number"
                step="0.1"
                icon="solar:scale-bold-duotone"
                iconColor="text-green-500"
                {...register('weight', {
                  required: 'Weight is required',
                  min: { value: 0, message: 'Weight must be positive' }
                })}
                error={errors.weight?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
              <PremiumInput
                type="number"
                icon="solar:ruler-angular-bold-duotone"
                iconColor="text-teal-500"
                {...register('height', {
                  required: 'Height is required',
                  min: { value: 0, message: 'Height must be positive' }
                })}
                error={errors.height?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BMI (Calculated)</label>
              <PremiumInput
                type="number"
                step="0.1"
                icon="solar:calculator-bold-duotone"
                iconColor="text-amber-500"
                {...register('bmi')}
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>

          {/* Supplemental Oxygen Checkbox for Inpatients */}
          {isInpatient && (
            <div className="mb-6">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  {...register('supplementalOxygen')}
                  className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Icon icon="solar:medical-kit-bold-duotone" className="w-4 h-4 text-cyan-500" />
                  Patient is on supplemental oxygen
                </span>
              </label>
            </div>
          )}

          {/* Notes Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Icon icon="solar:notes-bold-duotone" className="w-4 h-4 text-gray-500" />
              Clinical Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-100 rounded-xl transition-colors duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500/20 border border-transparent hover:border-gray-300"
              placeholder="Additional observations or notes..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={() => onSuccess()}>
            Cancel
          </Button>
          <Button type="submit" className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
            <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 mr-2" />
            Save Vitals
          </Button>
        </div>
      </form>
    </FeatureGuard>
  );
};

export default VitalsForm;