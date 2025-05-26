import React, { useMemo } from 'react';
import { format, isSameDay, setHours, setMinutes } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Calendar, User, Activity } from 'lucide-react';
import Badge from '../ui/Badge';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show' | 'requested';
  notes?: string;
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    cell_number?: string;
    date_of_birth?: string;
    gender?: string;
  };
  doctor?: {
    id: string;
    full_name: string;
  };
}

interface ModernWeekViewProps {
  weekDays: Date[];
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onCheckIn: (appointmentId: string) => void;
  onCancel: (appointmentId: string) => void;
  onReschedule: (appointment: Appointment) => void;
}

const HOUR_HEIGHT = 80; // pixels per hour
const START_HOUR = 7;
const END_HOUR = 19;
const TIME_COLUMN_WIDTH = 80; // Fixed width for time column

const ModernWeekView: React.FC<ModernWeekViewProps> = ({
  weekDays,
  appointments,
  onAppointmentClick,
  onCheckIn,
  onCancel,
  onReschedule
}) => {
  // Calculate grid height
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  // Process appointments with positioning
  const processedAppointments = useMemo(() => {
    interface ProcessedAppointment extends Appointment {
      top: number;
      height: number;
      startMinutes: number;
      column: number;
      columns: number;
    }
    
    const result: Record<string, ProcessedAppointment[]> = {};

    weekDays.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayAppointments = appointments.filter(apt => {
        return apt.date === dayStr;
      });

      // Process each appointment for positioning
      const processed: ProcessedAppointment[] = dayAppointments.map(apt => {
        const time = apt.time;
        const [hours, minutes] = time.split(':').map(Number);
        const startMinutes = (hours - START_HOUR) * 60 + minutes;
        const top = (startMinutes / 60) * HOUR_HEIGHT;
        const height = ((apt.duration || 30) / 60) * HOUR_HEIGHT;

        return {
          ...apt,
          top,
          height: Math.max(height, 30), // Minimum height
          startMinutes,
          column: 0,
          columns: 1
        };
      });

      // Sort by start time and handle overlaps
      processed.sort((a, b) => a.startMinutes - b.startMinutes);

      // Detect overlaps and adjust positions
      for (let i = 0; i < processed.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = processed[j];
          const b = processed[i];
          
          // Check if they overlap
          if (a.startMinutes < b.startMinutes + (b.duration || 30) &&
              b.startMinutes < a.startMinutes + (a.duration || 30)) {
            processed[i].column = a.column + 1;
            processed[i].columns = Math.max(processed[i].columns, processed[i].column + 1);
            
            // Update all overlapping appointments
            for (let k = 0; k <= i; k++) {
              if (processed[k].columns < processed[i].columns) {
                processed[k].columns = processed[i].columns;
              }
            }
          }
        }
      }

      result[dayStr] = processed;
    });

    return result;
  }, [appointments, weekDays]);

  const getAppointmentColor = (status: string) => {
    switch (status) {
      case 'requested': return 'from-purple-500 to-purple-600 border-purple-700';
      case 'scheduled': return 'from-blue-500 to-blue-600 border-blue-700';
      case 'confirmed': return 'from-emerald-500 to-emerald-600 border-emerald-700';
      case 'in-progress': return 'from-amber-500 to-amber-600 border-amber-700';
      case 'completed': return 'from-gray-500 to-gray-600 border-gray-700';
      case 'cancelled': return 'from-red-500 to-red-600 border-red-700';
      default: return 'from-gray-500 to-gray-600 border-gray-700';
    }
  };

  // Current time indicator
  const getCurrentTimeTop = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours >= START_HOUR && hours < END_HOUR) {
      return ((hours - START_HOUR) * 60 + minutes) / 60 * HOUR_HEIGHT;
    }
    return null;
  };

  const currentTimeTop = getCurrentTimeTop();

  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
        <div className="flex">
          {/* Empty space for time column */}
          <div className="w-20 shrink-0" />
          
          {/* Day headers */}
          <div className="flex-1 grid grid-cols-7">
            {weekDays.map((day, index) => {
              const isToday = isSameDay(new Date(), day);
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayAppts = processedAppointments[dayStr] || [];
              
              return (
                <div
                  key={index}
                  className={`py-4 px-4 text-center border-r border-gray-200 last:border-r-0 
                    ${isToday ? 'bg-gradient-to-b from-blue-50 to-transparent' : ''}`}
                >
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${
                    isToday ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <Activity size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-500">{dayAppts.length}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex overflow-auto" style={{ maxHeight: '600px' }}>
        {/* Time column - Fixed and separate */}
        <div className="w-20 shrink-0 bg-gradient-to-r from-gray-100 to-gray-50 border-r-2 border-gray-300">
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
            const hour = START_HOUR + i;
            const time = format(setHours(setMinutes(new Date(), 0), hour), 'h a');
            
            return (
              <div
                key={i}
                className="h-20 border-b border-gray-200 flex items-center justify-center"
              >
                <span className="text-sm font-semibold text-gray-700">{time}</span>
              </div>
            );
          })}
        </div>

        {/* Days grid */}
        <div className="flex-1 relative">
          <div className="grid grid-cols-7 h-full">
            {weekDays.map((day, dayIndex) => {
              const isToday = isSameDay(new Date(), day);
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayAppointments = processedAppointments[dayStr] || [];
              
              return (
                <div
                  key={dayIndex}
                  className={`relative border-r border-gray-200 last:border-r-0 
                    ${isToday ? 'bg-blue-50/10' : ''}`}
                >
                  {/* Hour lines */}
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <div
                      key={i}
                      className="absolute w-full border-b border-gray-100"
                      style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                    />
                  ))}

                  {/* Appointments */}
                  <AnimatePresence>
                    {dayAppointments.map((apt) => {
                      const width = `${100 / apt.columns}%`;
                      const left = `${(100 / apt.columns) * apt.column}%`;
                      const time = apt.time;
                      const type = apt.type;
                      
                      return (
                        <motion.div
                          key={apt.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className={`absolute bg-gradient-to-br ${getAppointmentColor(apt.status)} 
                            text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] 
                            transition-all duration-200 cursor-pointer overflow-hidden border-l-4 p-2`}
                          style={{
                            top: `${apt.top}px`,
                            height: `${apt.height}px`,
                            width: `calc(${width} - 8px)`,
                            left,
                            marginLeft: '4px',
                            marginRight: '4px'
                          }}
                          onClick={() => onAppointmentClick(apt)}
                        >
                          <div className="flex flex-col h-full relative">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-1">
                              <span className="text-xs font-bold opacity-90">
                                {time.slice(0, 5)}
                              </span>
                              {apt.height > 40 && (
                                <span className="text-xs opacity-75">
                                  {apt.duration || 30}m
                                </span>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-h-0">
                              <p className="font-semibold text-sm truncate">
                                {apt.patient?.first_name} {apt.patient?.last_name}
                              </p>
                              {apt.height > 50 && (
                                <p className="text-xs opacity-80 truncate mt-0.5">{type}</p>
                              )}
                            </div>

                            {/* Actions - Show on hover if space allows */}
                            {apt.status === 'scheduled' && apt.height > 60 && (
                              <div className="absolute bottom-1 left-1 right-1 flex gap-1 
                                opacity-0 hover:opacity-100 transition-opacity">
                                <button
                                  className="flex-1 bg-white/20 hover:bg-white/30 rounded p-1 
                                    backdrop-blur-sm transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCheckIn(apt.id);
                                  }}
                                >
                                  <CheckCircle2 size={12} className="mx-auto" />
                                </button>
                                <button
                                  className="flex-1 bg-white/20 hover:bg-white/30 rounded p-1 
                                    backdrop-blur-sm transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onReschedule(apt);
                                  }}
                                >
                                  <Calendar size={12} className="mx-auto" />
                                </button>
                                <button
                                  className="flex-1 bg-white/20 hover:bg-white/30 rounded p-1 
                                    backdrop-blur-sm transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCancel(apt.id);
                                  }}
                                >
                                  <XCircle size={12} className="mx-auto" />
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Current time indicator */}
                  {isToday && currentTimeTop !== null && (
                    <div
                      className="absolute left-0 right-0 pointer-events-none z-20"
                      style={{ top: `${currentTimeTop}px` }}
                    >
                      <div className="relative">
                        <div className="absolute left-0 right-0 h-0.5 bg-red-500" />
                        <div className="absolute -left-2 -top-2 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-purple-500 to-purple-600" />
              <span className="text-gray-600">Requested</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-500 to-blue-600" />
              <span className="text-gray-600">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <span className="text-gray-600">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-amber-500 to-amber-600" />
              <span className="text-gray-600">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-red-500 to-red-600" />
              <span className="text-gray-600">Cancelled</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            <Clock size={12} className="inline mr-1" />
            Last updated: {format(new Date(), 'h:mm a')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernWeekView;