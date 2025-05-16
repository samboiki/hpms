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
  } | null;
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

  const systolicBP = vitals.blood_pressure?.split('/')?.[0];
  const isHighBP = systolicBP ? parseInt(systolicBP) > 140 : false;

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
            <div className="text-base font-semibold text-gray-