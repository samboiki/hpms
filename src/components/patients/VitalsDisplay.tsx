import React from 'react';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { cn } from '../../utils/cn';
import { checkBloodPressure, checkTemperature } from '../../utils/vitalSigns';

interface VitalsDisplayProps {
  vitals: {
    blood_pressure?: string;
    temperature?: number;
    pulse_rate?: number;
    respiratory_rate?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  } | null;
}

const VitalsDisplay: React.FC<VitalsDisplayProps> = ({ vitals }) => {
  const isAbnormal = (value: number | undefined, type: string) => {
    if (!value) return false;
    switch (type) {
      case 'pulse_rate':
        return value < 60 || value > 100;
      case 'respiratory_rate':
        return value < 12 || value > 20;
      case 'bmi':
        return value < 18.5 || value > 25;
      default:
        return false;
    }
  };

  const getVitalStyles = (isAbnormal: boolean) => {
    return cn(
      "bg-white p-3 rounded-lg transition-all duration-500 border-2",
      isAbnormal 
        ? "border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse" 
        : "border-gray-100"
    );
  };

  // If no vitals data is available, show a message
  if (!vitals) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center text-sm font-medium text-gray-700">
            <Activity size={16} className="mr-2 text-[#01b9d4]" />
            Latest Vitals
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="text-center text-gray-500 py-4">
            No vitals recorded
          </div>
        </CardContent>
      </Card>
    );
  }

  // Shared limits from utils/vitalSigns: blood pressure flags at 140/90 (the diastolic too), fever at 38.0 °C
  const bloodPressureCheck = checkBloodPressure(vitals.blood_pressure);
  const temperatureCheck = checkTemperature(vitals.temperature);
  const isHighBP = bloodPressureCheck.status !== 'normal';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center text-sm font-medium text-gray-700">
          <Activity size={16} className="mr-2 text-[#01b9d4]" />
          Latest Vitals
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-2 gap-4">
          <div className={getVitalStyles(isHighBP)}>
            <div className="text-xs text-gray-500 mb-1">Blood Pressure</div>
            <div className="text-base font-semibold text-gray-900">{vitals.blood_pressure || '--/--'} mmHg</div>
            {bloodPressureCheck.message && <div className="mt-1 text-xs font-medium text-red-600">{bloodPressureCheck.message}</div>}
          </div>

          <div className={getVitalStyles(temperatureCheck.status !== 'normal')}>
            <div className="text-xs text-gray-500 mb-1">Temperature</div>
            <div className="text-base font-semibold text-gray-900">{vitals.temperature?.toFixed(1) || '--'}°C</div>
            {temperatureCheck.message && <div className="mt-1 text-xs font-medium text-red-600">{temperatureCheck.message}</div>}
          </div>

          <div className={getVitalStyles(isAbnormal(vitals.pulse_rate, 'pulse_rate'))}>
            <div className="text-xs text-gray-500 mb-1">Pulse Rate</div>
            <div className="text-base font-semibold text-gray-900">{vitals.pulse_rate || '--'} bpm</div>
          </div>

          <div className={getVitalStyles(isAbnormal(vitals.respiratory_rate, 'respiratory_rate'))}>
            <div className="text-xs text-gray-500 mb-1">Respiratory Rate</div>
            <div className="text-base font-semibold text-gray-900">{vitals.respiratory_rate || '--'} /min</div>
          </div>

          <div className={getVitalStyles(false)}>
            <div className="text-xs text-gray-500 mb-1">Weight</div>
            <div className="text-base font-semibold text-gray-900">{vitals.weight?.toFixed(1) || '--'} kg</div>
          </div>

          <div className={getVitalStyles(false)}>
            <div className="text-xs text-gray-500 mb-1">Height</div>
            <div className="text-base font-semibold text-gray-900">{vitals.height?.toFixed(1) || '--'} cm</div>
          </div>

          <div className={cn(
            getVitalStyles(isAbnormal(vitals.bmi, 'bmi')),
            "col-span-2"
          )}>
            <div className="text-xs text-gray-500 mb-1">BMI</div>
            <div className="text-base font-semibold text-gray-900">{vitals.bmi?.toFixed(1) || '--'} kg/m²</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VitalsDisplay;