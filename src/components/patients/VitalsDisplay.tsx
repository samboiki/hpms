import React from 'react';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { cn } from '../../utils/cn';

interface VitalsDisplayProps {
  vitals: {
    blood_pressure?: string;
    temperature?: number;
    pulse_rate?: number;
    respiratory_rate?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
}

const VitalsDisplay: React.FC<VitalsDisplayProps> = ({ vitals }) => {
  const isAbnormal = (value: number | undefined, type: string) => {
    if (!value) return false;
    switch (type) {
      case 'temperature':
        return value < 36 || value > 37.5;
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center text-sm font-medium text-gray-700">
          <Activity size={16} className="mr-2 text-[#01b9d4]" />
          Latest Vitals
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(
            "bg-gray-50 p-3 rounded-lg transition-colors",
            vitals.blood_pressure?.split('/')[0] && parseInt(vitals.blood_pressure.split('/')[0]) > 140 && 'animate-pulse bg-red-50'
          )}>
            <div className="text-xs text-gray-500">Blood Pressure</div>
            <div className="text-base font-semibold text-gray-900">{vitals.blood_pressure || '--/--'} mmHg</div>
          </div>

          <div className={cn(
            "bg-gray-50 p-3 rounded-lg transition-colors",
            isAbnormal(vitals.temperature, 'temperature') && 'animate-pulse bg-red-50'
          )}>
            <div className="text-xs text-gray-500">Temperature</div>
            <div className="text-base font-semibold text-gray-900">{vitals.temperature?.toFixed(1) || '--'}°C</div>
          </div>

          <div className={cn(
            "bg-gray-50 p-3 rounded-lg transition-colors",
            isAbnormal(vitals.pulse_rate, 'pulse_rate') && 'animate-pulse bg-red-50'
          )}>
            <div className="text-xs text-gray-500">Pulse Rate</div>
            <div className="text-base font-semibold text-gray-900">{vitals.pulse_rate || '--'} bpm</div>
          </div>

          <div className={cn(
            "bg-gray-50 p-3 rounded-lg transition-colors",
            isAbnormal(vitals.respiratory_rate, 'respiratory_rate') && 'animate-pulse bg-red-50'
          )}>
            <div className="text-xs text-gray-500">Respiratory Rate</div>
            <div className="text-base font-semibold text-gray-900">{vitals.respiratory_rate || '--'} /min</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs text-gray-500">Weight</div>
            <div className="text-base font-semibold text-gray-900">{vitals.weight?.toFixed(1) || '--'} kg</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs text-gray-500">Height</div>
            <div className="text-base font-semibold text-gray-900">{vitals.height?.toFixed(1) || '--'} cm</div>
          </div>

          <div className={cn(
            "bg-gray-50 p-3 rounded-lg col-span-2 transition-colors",
            isAbnormal(vitals.bmi, 'bmi') && 'animate-pulse bg-red-50'
          )}>
            <div className="text-xs text-gray-500">BMI</div>
            <div className="text-base font-semibold text-gray-900">{vitals.bmi?.toFixed(1) || '--'} kg/m²</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VitalsDisplay;