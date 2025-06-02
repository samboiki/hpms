import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isSameDay, parseISO } from 'date-fns';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  AlertCircle,
  CheckCircle2,
  Phone,
  Eye,
  Shield,
  Stethoscope,
  Activity,
  Pill,
  FileText
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  patient?: {
    first_name: string;
    last_name: string;
    cell_number?: string;
    medical_aid_details?: {
      provider?: string;
      scheme_name?: string;
      member_number?: string;
    };
  };
  doctor?: {
    full_name: string;
  };
}

interface Doctor {
  id: string;
  email: string;
  user_metadata: {
    full_name: string;
    role: string;
  };
}

interface PremiumWeekGridViewProps {
  weekDates: Date[];
  appointments: Appointment[];
  doctors: Doctor[];
  onAppointmentClick?: (appointment: Appointment) => void;
  onTimeSlotClick?: (date: Date, time: string, doctorId?: string) => void;
  onMarkReady?: (appointmentId: string) => void;
}

export const PremiumWeekGridView: React.FC<PremiumWeekGridViewProps> = ({
  weekDates,
  appointments,
  doctors,
  onAppointmentClick,
  onTimeSlotClick,
  onMarkReady
}) => {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  // Group appointments by date
  const appointmentsByDate = weekDates.reduce((acc, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    acc[dateStr] = appointments.filter(apt => apt.date === dateStr);
    return acc;
  }, {} as Record<string, Appointment[]>);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'from-blue-400 to-blue-600';
      case 'in-progress': return 'from-amber-400 to-orange-600';
      case 'completed': return 'from-gray-400 to-gray-600';
      case 'cancelled': return 'from-gray-300 to-gray-500';
      case 'pending': return 'from-purple-400 to-indigo-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation': return Stethoscope;
      case 'follow-up': return CheckCircle2;
      case 'procedure': return Activity;
      case 'emergency': return AlertCircle;
      default: return Calendar;
    }
  };

  // Time slots for the grid
  const timeSlots = [];
  for (let hour = 8; hour < 18; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b border-gray-200">
        <div className="flex">
          <div className="w-20 p-3 border-r border-gray-200 bg-gray-50">
            <span className="text-xs font-semibold text-gray-600">Time</span>
          </div>
          {weekDates.map((date, index) => (
            <div
              key={index}
              className={cn(
                "flex-1 p-3 border-r border-gray-200 last:border-r-0 text-center",
                isSameDay(date, new Date()) && "bg-[#01b9d5]/5"
              )}
            >
              <p className="text-xs font-medium text-gray-500">{format(date, 'EEE')}</p>
              <p className={cn(
                "text-lg font-semibold",
                isSameDay(date, new Date()) ? "text-[#01b9d5]" : "text-gray-700"
              )}>
                {format(date, 'd')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Time Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="flex">
          {/* Time Column */}
          <div className="flex-shrink-0 w-20 bg-gray-50">
            {timeSlots.map((time, index) => (
              <div
                key={index}
                className="h-20 border-b border-gray-100 px-2 py-1"
              >
                <span className="text-xs text-gray-500 font-medium">
                  {format(parseISO(`2000-01-01T${time}`), 'h:mm a')}
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDates.map((date, dayIndex) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayAppointments = appointmentsByDate[dateStr] || [];

            return (
              <div key={dayIndex} className="flex-1 border-r border-gray-200 last:border-r-0">
                {timeSlots.map((time, timeIndex) => {
                  const slotKey = `${dateStr}-${time}`;
                  const slotAppointments = dayAppointments.filter(apt => {
                    const aptTime = apt.time?.substring(0, 5);
                    return aptTime === time;
                  });

                  return (
                    <div
                      key={timeIndex}
                      className={cn(
                        "h-20 border-b border-gray-100 p-1 relative transition-colors",
                        hoveredSlot === slotKey && "bg-gray-50",
                        "hover:bg-gray-50 cursor-pointer"
                      )}
                      onMouseEnter={() => setHoveredSlot(slotKey)}
                      onMouseLeave={() => setHoveredSlot(null)}
                      onClick={() => !slotAppointments.length && onTimeSlotClick?.(date, time)}
                    >
                      {/* Appointments in this slot */}
                      <div className="space-y-1">
                        {slotAppointments.map((appointment) => {
                          const TypeIcon = getTypeIcon(appointment.type);
                          
                          return (
                            <motion.div
                              key={appointment.id}
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              whileHover={{ scale: 1.02 }}
                              className="relative group cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentClick?.(appointment);
                              }}
                            >
                              <div className={cn(
                                "p-1.5 rounded-lg border text-xs overflow-hidden",
                                "bg-white hover:shadow-md transition-all",
                                appointment.status === 'pending' && "border-purple-300 bg-purple-50",
                                appointment.status === 'scheduled' && "border-blue-200 bg-blue-50",
                                appointment.status === 'completed' && "border-gray-200 bg-gray-50"
                              )}>
                                {/* Status bar */}
                                <div className={cn(
                                  "absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b",
                                  getStatusColor(appointment.status)
                                )} />
                                
                                {/* Content */}
                                <div className="pl-2">
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                      <TypeIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                                      <p className="font-medium text-gray-900 truncate">
                                        {appointment.patient?.first_name} {appointment.patient?.last_name?.charAt(0)}.
                                      </p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAppointmentClick?.(appointment);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Eye className="w-3 h-3 text-gray-400 hover:text-[#01b9d5]" />
                                    </button>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-gray-500">
                                      {appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : ''}
                                    </span>
                                    {appointment.patient?.medical_aid_details?.provider && (
                                      <div className="flex items-center gap-0.5">
                                        <Shield className="w-2.5 h-2.5 text-gray-400" />
                                        <span className="text-[10px] text-gray-500">
                                          {appointment.patient.medical_aid_details.provider}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Hover actions */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {appointment.status === 'pending' && (
                                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                                  )}
                                  {appointment.status === 'scheduled' && onMarkReady && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMarkReady(appointment.id);
                                      }}
                                      className="px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white text-[10px] rounded shadow-sm transition-colors font-medium"
                                      title="Mark Ready"
                                    >
                                      Ready
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Add appointment indicator */}
                      {!slotAppointments.length && hoveredSlot === slotKey && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <div className="bg-gray-200/50 backdrop-blur-sm rounded-lg p-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};