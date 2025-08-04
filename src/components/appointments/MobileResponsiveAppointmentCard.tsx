import React from 'react';
import { cn } from '../../utils/cn';

interface AppointmentCardProps {
  number: number;
  time: string;
  patientName: string;
  visitType: string;
  doctorName: string;
  status: 'scheduled' | 'checked-in' | 'completed' | 'cancelled';
  statusColor: string;
  numberBgColor?: string;
  onClick?: () => void;
}

const statusConfig = {
  'scheduled': { dotColor: 'bg-blue-500', textColor: 'text-blue-600' },
  'checked-in': { dotColor: 'bg-purple-500', textColor: 'text-purple-600' },
  'completed': { dotColor: 'bg-emerald-500', textColor: 'text-emerald-600' },
  'cancelled': { dotColor: 'bg-red-500', textColor: 'text-red-600' }
};

export const MobileResponsiveAppointmentCard: React.FC<AppointmentCardProps> = ({
  number,
  time,
  patientName,
  visitType,
  doctorName,
  status,
  numberBgColor = '#489bfd',
  onClick
}) => {
  const config = statusConfig[status] || statusConfig['scheduled'];
  
  return (
    <div 
      onClick={onClick}
      className="relative flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:pl-12 bg-white rounded-lg border border-gray-100 group hover:border-gray-200 hover:shadow-sm cursor-pointer"
    >
      {/* Number badge - inline on mobile, absolute on desktop */}
      <div 
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md text-white",
          "sm:absolute sm:left-2 sm:top-1/2 sm:-translate-y-1/2"
        )}
        style={{ backgroundColor: numberBgColor }}
      >
        {number}
      </div>
      
      {/* Main content area */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
        {/* Time */}
        <div className="sm:text-center sm:min-w-[50px]">
          <p className="text-sm font-semibold text-gray-800">{time}</p>
        </div>
        
        {/* Patient details */}
        <div className="flex-1">
          <p className="font-medium text-gray-800 group-hover:text-brand-primary">{patientName}</p>
          <p className="text-xs text-gray-500">{visitType} • Dr. {doctorName}</p>
        </div>
        
        {/* Status - below on mobile, right side on desktop */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <div className={cn("w-2 h-2 rounded-full", config.dotColor)}></div>
          <span className={cn("text-xs font-medium capitalize", config.textColor)}>
            {status.replace('-', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
};

// Usage example:
/*
<MobileResponsiveAppointmentCard
  number={1}
  time="09:30"
  patientName="Mirjam Lukas"
  visitType="consultation"
  doctorName="Dr. Hilma Amalwa"
  status="scheduled"
  numberBgColor="#489bfd"
  onClick={() => handleAppointmentClick(appointment)}
/>
*/