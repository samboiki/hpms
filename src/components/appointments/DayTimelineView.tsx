import React, { useState, useEffect, useMemo } from 'react';
import { format, setHours, setMinutes } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Calendar, User, Activity, UserCheck, AlertCircle } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: 'pending' | 'scheduled' | 'confirmed' | 'ready' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
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

interface Doctor {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface DayTimelineViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onCheckIn: (appointmentId: string) => void;
  onCancel: (appointmentId: string) => void;
  onReschedule: (appointment: Appointment) => void;
  onMarkReady?: (appointmentId: string) => void;
}

const HOUR_HEIGHT = 80; // pixels per hour
const START_HOUR = 7;
const END_HOUR = 19;
const TIME_COLUMN_WIDTH = 80;

const DayTimelineView: React.FC<DayTimelineViewProps> = ({
  selectedDate,
  appointments,
  onAppointmentClick,
  onCheckIn,
  onCancel,
  onReschedule
}) => {
  const { user } = useAuthStore();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch doctors from the practice
  useEffect(() => {
    const fetchDoctors = async () => {
      if (!user?.practice_id) {
        console.log('No practice_id found for user');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, role')
          .eq('practice_id', user.practice_id)
          .eq('role', 'doctor')
          .order('full_name');

        if (error) {
          console.error('Error fetching doctors:', error);
        } else {
          setDoctors(data || []);
          // If user is a doctor, auto-select them
          if (user.role === 'doctor' && data) {
            setSelectedDoctorIds([user.id]);
          } else if (data && data.length > 0) {
            // Select all doctors by default
            setSelectedDoctorIds(data.map(d => d.id));
          }
        }
      } catch (err) {
        console.error('Error in fetchDoctors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [user]);

  // Filter appointments for the selected date and practice
  const practiceAppointments = useMemo(() => {
    if (!user?.practice_id) return [];
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    return appointments.filter(apt => {
      // Filter by date
      if (apt.date !== dateStr) return false;
      
      // Filter by selected doctors
      if (selectedDoctorIds.length > 0 && !selectedDoctorIds.includes(apt.doctor_id)) {
        return false;
      }
      
      // Only show appointments for doctors in the same practice
      const doctor = doctors.find(d => d.id === apt.doctor_id);
      return doctor !== undefined;
    });
  }, [appointments, selectedDate, selectedDoctorIds, doctors, user]);

  // Process appointments with positioning
  const processedAppointments = useMemo(() => {
    interface ProcessedAppointment extends Appointment {
      top: number;
      height: number;
      doctorColumn: number;
      startMinutes: number;
    }

    const processed: ProcessedAppointment[] = [];
    const doctorColumns: Record<string, number> = {};
    
    // Assign column index to each selected doctor
    selectedDoctorIds.forEach((id, index) => {
      doctorColumns[id] = index;
    });

    practiceAppointments.forEach(apt => {
      const [hours, minutes] = apt.time.split(':').map(Number);
      const startMinutes = (hours - START_HOUR) * 60 + minutes;
      const top = (startMinutes / 60) * HOUR_HEIGHT;
      const height = ((apt.duration || 30) / 60) * HOUR_HEIGHT;

      processed.push({
        ...apt,
        top,
        height: Math.max(height, 30), // Minimum height
        doctorColumn: doctorColumns[apt.doctor_id] || 0,
        startMinutes
      });
    });

    return processed;
  }, [practiceAppointments, selectedDoctorIds]);

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
  const isToday = format(new Date(), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

  const handleDoctorToggle = (doctorId: string) => {
    setSelectedDoctorIds(prev => {
      if (prev.includes(doctorId)) {
        return prev.filter(id => id !== doctorId);
      } else {
        return [...prev, doctorId];
      }
    });
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl shadow-2xl p-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  const columnWidth = selectedDoctorIds.length > 0 ? `${100 / selectedDoctorIds.length}%` : '100%';

  return (
    <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl shadow-2xl overflow-hidden border border-gray-300">
      {/* Header with Doctor Selection */}
      <div className="bg-gradient-to-r from-gray-200 to-gray-100 border-b border-gray-300 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-gray-500" />
            <span className="text-sm text-gray-600">
              {practiceAppointments.length} appointment{practiceAppointments.length !== 1 ? 's' : ''}
            </span>
            {practiceAppointments.filter(apt => apt.status === 'pending').length > 0 && (
              <>
                <span className="text-gray-400">•</span>
                <AlertCircle size={16} className="text-purple-500" />
                <span className="text-sm text-purple-600">
                  {practiceAppointments.filter(apt => apt.status === 'pending').length} pending{practiceAppointments.filter(apt => apt.status === 'pending').length !== 1 ? '' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Doctor filters */}
        {doctors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Show doctors:</span>
            {doctors.map(doctor => (
              <button
                key={doctor.id}
                onClick={() => handleDoctorToggle(doctor.id)}
                className={`
                  px-3 py-1 rounded-full text-sm font-medium transition-all
                  ${selectedDoctorIds.includes(doctor.id)
                    ? 'bg-gray-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                <UserCheck size={14} className="inline mr-1" />
                {doctor.full_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline Body */}
      <div className="flex overflow-auto" style={{ maxHeight: '600px' }}>
        {/* Time column - Fixed */}
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

        {/* Doctor columns */}
        <div className="flex-1 relative bg-gradient-to-br from-gray-50 to-gray-100">
          {selectedDoctorIds.length === 0 ? (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <User size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Select at least one doctor to view their schedule</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full">
              {selectedDoctorIds.map((doctorId, columnIndex) => {
                const doctor = doctors.find(d => d.id === doctorId);
                const doctorAppointments = processedAppointments.filter(apt => apt.doctor_id === doctorId);
                
                return (
                  <div
                    key={doctorId}
                    className="relative border-r border-gray-200 last:border-r-0"
                    style={{ width: columnWidth }}
                  >
                    {/* Doctor name header */}
                    <div className="absolute top-0 left-0 right-0 bg-gray-100/90 backdrop-blur-sm z-10 p-2 border-b border-gray-300">
                      <p className="text-sm font-medium text-gray-700 text-center truncate">
                        {doctor?.full_name || 'Unknown'}
                      </p>
                    </div>

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
                      {doctorAppointments.map((apt) => (
                        <motion.div
                          key={apt.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className={`absolute bg-white/70 backdrop-blur-sm 
                            text-gray-900 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] 
                            transition-all duration-200 cursor-pointer overflow-hidden border border-white/30 p-2`}
                          style={{
                            top: `${apt.top}px`,
                            height: `${apt.height}px`,
                            width: 'calc(100% - 16px)',
                            left: '8px',
                            right: '8px'
                          }}
                          onClick={() => onAppointmentClick(apt)}
                        >
                          <div className="flex flex-col h-full relative">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-1">
                              <span className="text-xs font-bold opacity-90">
                                {apt.time.slice(0, 5)}
                              </span>
                              {apt.status === 'pending' && (
                                <AlertCircle size={14} className="animate-pulse" />
                              )}
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
                                <p className="text-xs opacity-80 truncate mt-0.5">{apt.type}</p>
                              )}
                            </div>

                            {/* Actions - Show on hover if space allows */}
                            {(apt.status === 'scheduled' || apt.status === 'pending' || apt.status === 'ready') && apt.height > 60 && (
                              <div className="absolute bottom-1 left-1 right-1 flex gap-1 
                                opacity-0 hover:opacity-100 transition-opacity">
                                {apt.status === 'scheduled' && onMarkReady && (
                                  <button
                                    className="flex-1 bg-green-500/30 hover:bg-green-500/40 rounded p-1 
                                      backdrop-blur-sm transition-colors" 
                                    title="Mark Ready"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMarkReady(apt.id);
                                    }}
                                  >
                                    <UserCheck size={12} className="mx-auto" />
                                  </button>
                                )}
                                <button
                                  className="flex-1 bg-white/20 hover:bg-white/30 rounded p-1 
                                    backdrop-blur-sm transition-colors"
                                  title="Reschedule"
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
                                  title="Cancel"
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
                      ))}
                    </AnimatePresence>

                    {/* Current time indicator */}
                    {isToday && currentTimeTop !== null && columnIndex === 0 && (
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
          )}
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
              <div className="w-3 h-3 rounded bg-gradient-to-br from-gray-500 to-gray-600" />
              <span className="text-gray-600">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <span className="text-gray-600">Ready</span>
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

export default DayTimelineView;