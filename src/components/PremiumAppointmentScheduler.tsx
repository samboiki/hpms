import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  Search,
  RefreshCw,
  Grid3X3,
  List,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  Stethoscope,
  Trash2,
  Edit2,
  MoreVertical,
  CalendarDays,
  Star,
  Sparkles,
  Bot
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  parseISO,
  setHours,
  setMinutes,
  isToday,
  getHours,
  getMinutes,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import FormModal from './modals/FormModal';
import AddAppointmentForm from './forms/AddAppointmentForm';
import { PremiumDayGridView } from './appointments/PremiumDayGridView';
import { PremiumWeekGridView } from './appointments/PremiumWeekGridView';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface AppointmentPatient {
  id: string;
  first_name: string;
  last_name: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
}

interface Appointment {
  id: string;
  patient: AppointmentPatient;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'pending' | 'scheduled' | 'ready' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
}

interface Doctor {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    role?: string;
  };
}

interface BlockedTime {
  id: string;
  doctor_id: string;
  start_time: string;
  end_time: string;
  reason: string;
}

interface PremiumAppointmentSchedulerProps {
  appointments: Appointment[];
  doctors: Doctor[];
  blockedTimes: BlockedTime[];
  isLoading: boolean;
  error: Error | null;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onEditAppointment?: (appointment: Appointment) => void;
  onCreateAppointment: (doctorId: string, date: string, time: string) => void;
  onBlockTime: (doctorId: string, startTime: string, endTime: string, reason: string) => void;
  onDeleteAppointment?: (appointmentId: string) => void;
  currentUserRole: 'admin' | 'doctor' | 'nurse' | 'receptionist';
  currentUserId: string;
  onRefresh?: () => void;
  viewMode?: 'day' | 'week' | 'month' | 'all';
  internalViewMode?: 'timeline' | 'grid';
  onInternalViewModeChange?: (mode: 'timeline' | 'grid') => void;
}

// Constants
const HOUR_HEIGHT = 60;
const TIME_SLOT_INTERVAL = 30;
const BUSINESS_HOURS = {
  start: 7,
  end: 23,
};

// Premium color scheme matching patients page
const getStatusGradient = (status: Appointment['status']) => {
  switch (status) {
    case 'pending':
      return 'from-yellow-400 to-yellow-500';
    case 'scheduled':
      return 'from-[#01b9d5] to-[#0196be]';
    case 'ready':
      return 'from-green-500 to-green-600';
    case 'in-progress':
      return 'from-amber-500 to-amber-600';
    case 'completed':
      return 'from-gray-400 to-gray-500';
    case 'cancelled':
      return 'from-red-400 to-red-500';
    case 'no-show':
      return 'from-orange-400 to-orange-500';
    default:
      return 'from-gray-400 to-gray-500';
  }
};

const getTypeAccent = (type: Appointment['type']) => {
  switch (type) {
    case 'consultation':
      return 'border-l-4 border-[#01b9d5]';
    case 'follow-up':
      return 'border-l-4 border-purple-500';
    case 'procedure':
      return 'border-l-4 border-amber-500';
    case 'emergency':
      return 'border-l-4 border-red-500 animate-pulse';
    default:
      return 'border-l-4 border-gray-400';
  }
};

const getStatusIcon = (status: Appointment['status']) => {
  switch (status) {
    case 'pending':
      return AlertCircle;
    case 'scheduled':
      return CalendarIcon;
    case 'ready':
      return CheckCircle;
    case 'in-progress':
      return Activity;
    case 'completed':
      return CheckCircle;
    case 'cancelled':
      return XCircle;
    case 'no-show':
      return AlertCircle;
    default:
      return CalendarIcon;
  }
};

const PremiumAppointmentScheduler: React.FC<PremiumAppointmentSchedulerProps> = (props) => {
  const {
    appointments,
    doctors,
    blockedTimes,
    isLoading,
    error,
    selectedDate,
    onDateChange,
    onAppointmentClick,
    onEditAppointment,
    onCreateAppointment,
    onBlockTime,
    onDeleteAppointment,
    currentUserRole,
    currentUserId,
    onRefresh,
    viewMode = 'week',
    internalViewMode: externalInternalViewMode,
    onInternalViewModeChange
  } = props;

  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
    currentUserRole === 'doctor' ? currentUserId : null
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ doctorId: string; time: string; date: Date } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalViewMode, setInternalViewMode] = useState<'timeline' | 'grid'>(externalInternalViewMode || 'grid');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle Mark Ready
  const handleMarkReady = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) throw error;
      
      toast.success('Patient marked as ready!');
      
      if (props.onRefresh) {
        props.onRefresh();
      }
    } catch (error) {
      console.error('Error marking patient ready:', error);
      toast.error('Failed to mark patient ready');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync with external internalViewMode prop
  useEffect(() => {
    if (externalInternalViewMode && externalInternalViewMode !== internalViewMode) {
      setInternalViewMode(externalInternalViewMode);
    }
  }, [externalInternalViewMode]);

  // Notify parent when internal view mode changes
  const handleInternalViewModeChange = (mode: 'timeline' | 'grid') => {
    setInternalViewMode(mode);
    if (onInternalViewModeChange) {
      onInternalViewModeChange(mode);
    }
  };

  // Get week dates for week view
  const weekDates = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  // Filter appointments based on view mode
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    if (viewMode === 'all') {
      // No date filtering for "all" view - show everything
    } else if (viewMode === 'day') {
      filtered = appointments.filter((apt) => {
        const aptDate = apt.date;
        if (!aptDate) return false;
        return format(parseISO(aptDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      });
    } else if (viewMode === 'week') {
      filtered = appointments.filter((apt) => {
        const aptDate = apt.date;
        if (!aptDate) return false;
        const date = parseISO(aptDate);
        return weekDates.some(weekDate => isSameDay(date, weekDate));
      });
    } else if (viewMode === 'month') {
      filtered = appointments.filter((apt) => {
        const aptDate = apt.date;
        if (!aptDate) return false;
        const date = parseISO(aptDate);
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        return date >= monthStart && date <= monthEnd;
      });
    }

    if (selectedDoctorId) {
      filtered = filtered.filter((apt) => apt.doctor_id === selectedDoctorId);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (apt) =>
          apt.patient.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          apt.patient.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          apt.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by date for "all" view - most recent first
    if (viewMode === 'all') {
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateB.getTime() - dateA.getTime();
      });
    }

    return filtered;
  }, [appointments, selectedDate, selectedDoctorId, searchQuery, viewMode, weekDates]);

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour++) {
      for (let minute = 0; minute < 60; minute += TIME_SLOT_INTERVAL) {
        const time = setMinutes(setHours(selectedDate, hour), minute);
        slots.push(format(time, 'HH:mm'));
      }
    }
    return slots;
  }, [selectedDate]);

  // Premium stats with gradients
  const stats = useMemo(() => {
    const total = filteredAppointments.length;
    const completed = filteredAppointments.filter(a => a.status === 'completed').length;
    const cancelled = filteredAppointments.filter(a => a.status === 'cancelled').length;
    const pending = filteredAppointments.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length;

    return [
      { label: 'Total', value: total, gradient: 'from-[#01b9d5] to-[#0196be]', icon: CalendarIcon },
      { label: 'Completed', value: completed, gradient: 'from-emerald-500 to-emerald-600', icon: CheckCircle },
      { label: 'Pending', value: pending, gradient: 'from-amber-500 to-amber-600', icon: Clock },
      { label: 'Cancelled', value: cancelled, gradient: 'from-red-500 to-red-600', icon: XCircle }
    ];
  }, [filteredAppointments]);

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'all') {
      // No navigation for "all time" view
      return;
    } else if (viewMode === 'week') {
      const newDate = direction === 'prev' ? subWeeks(selectedDate, 1) : addWeeks(selectedDate, 1);
      onDateChange(newDate);
    } else if (viewMode === 'month') {
      const newDate = direction === 'prev' ? subMonths(selectedDate, 1) : addMonths(selectedDate, 1);
      onDateChange(newDate);
    } else {
      const newDate = direction === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1);
      onDateChange(newDate);
    }
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const calculateAppointmentPosition = (appointment: Appointment, dayOffset = 0) => {
    const time = appointment.time;
    if (!time) return { top: 0, height: HOUR_HEIGHT, left: 0, width: 100 };

    const [hours, minutes] = time.split(':').map(Number);
    const startMinutes = (hours - BUSINESS_HOURS.start) * 60 + minutes;
    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = (appointment.duration / 60) * HOUR_HEIGHT;
    
    // For week view, calculate left position based on day
    const left = dayOffset * 14.285; // 100% / 7 days
    const width = 14.285; // Width for one day

    return { top, height: Math.max(height, 40), left, width };
  };

  // Handle appointment drop
  const handleAppointmentDrop = async (appointmentId: string, newTime: Date, newDoctorId: string) => {
    try {
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) return false;

      const newDate = format(newTime, 'yyyy-MM-dd');
      const newTimeStr = format(newTime, 'HH:mm:ss');

      const { error } = await supabase
        .from('appointments')
        .update({
          date: newDate,
          time: newTimeStr,
          doctor_id: newDoctorId,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) {
        console.error('Error updating appointment:', error);
        return false;
      }

      // Refresh data
      if (onRefresh) {
        onRefresh();
      }

      return true;
    } catch (error) {
      console.error('Error in handleAppointmentDrop:', error);
      return false;
    }
  };

  // Premium Grid View Component - Card-based layout for all modes
  const GridView = () => {
    // Card-based grid view for day/week/month/all
    return (
      <div className="p-4 max-h-[600px] overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
        <div className="grid grid-cols-1 gap-3">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
              <CalendarIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">No appointments found</p>
            <p className="text-sm text-gray-400 mt-1">
              {viewMode === 'all'
                ? 'All time appointments'
                : viewMode === 'week' 
                ? `Week of ${format(weekDates[0], 'MMM d')} - ${format(weekDates[6], 'MMM d, yyyy')}`
                : viewMode === 'month'
                ? format(selectedDate, 'MMMM yyyy')
                : format(selectedDate, 'MMMM d, yyyy')
              }
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredAppointments.map((appointment) => {
              const StatusIcon = getStatusIcon(appointment.status);
              const time = appointment.time;
              const isUpcoming = appointment.status === 'scheduled';
              const aptDate = parseISO(appointment.date);

              return (
                <motion.div
                  key={appointment.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`
                    relative bg-white rounded-xl shadow-sm hover:shadow-lg
                    border border-gray-200/60 transition-all cursor-pointer
                    ${getTypeAccent(appointment.type)}
                    overflow-hidden
                  `}
                  onClick={() => onAppointmentClick(appointment)}
                >
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${getStatusGradient(appointment.status)} opacity-5`} />
                  
                  <div className="relative p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getStatusGradient(appointment.status)} 
                          flex items-center justify-center shadow-md`}>
                          <StatusIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {appointment.patient.first_name} {appointment.patient.last_name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">
                              {format(aptDate, 'MMM d')} • {time ? format(parseISO(`2000-01-01T${time}`), 'h:mm a') : 'No time'}
                            </span>
                            {appointment.patient.gender && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                appointment.patient.gender === 'Female' 
                                  ? 'bg-pink-100 text-pink-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {appointment.patient.gender}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {isUpcoming && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowActionMenu(showActionMenu === appointment.id ? null : appointment.id);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-500" />
                          </button>
                          {showActionMenu === appointment.id && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
                            >
                              {onEditAppointment && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditAppointment(appointment);
                                    setShowActionMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                >
                                  <Edit2 className="h-3 w-3" />
                                  Reschedule
                                </button>
                              )}
                              {appointment.status === 'cancelled' && onDeleteAppointment && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete this cancelled appointment?')) {
                                      onDeleteAppointment(appointment.id);
                                    }
                                    setShowActionMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </button>
                              )}
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{appointment.duration} min</span>
                        </div>
                        {appointment.patient.cell_number && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{appointment.patient.cell_number}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-3 py-1 rounded-full font-medium bg-gradient-to-r ${getStatusGradient(appointment.status)} text-white`}>
                            {appointment.status}
                          </span>
                          {appointment.status === 'scheduled' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkReady(appointment.id);
                              }}
                              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-full font-medium shadow-md transition-all hover:shadow-lg"
                            >
                              Mark Ready
                            </button>
                          )}
                        </div>
                        <span className="text-sm text-gray-600 capitalize flex items-center gap-1.5">
                          <Stethoscope className="h-3.5 w-3.5" />
                          {appointment.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
    );
  };

  // Premium Timeline/Week View Component
  const TimelineView = () => {
    const visibleDoctors = selectedDoctorId
      ? doctors.filter((d) => d.id === selectedDoctorId)
      : doctors;
    
    const displayDates = viewMode === 'week' ? weekDates : [selectedDate];

    return (
      <div className="flex flex-col h-[600px] bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden shadow-inner border border-gray-300">
        {/* Premium Timeline Header */}
        <div className="bg-gradient-to-r from-white to-gray-50 border-b border-gray-300 shadow-md">
          <div className="flex">
            <div className="w-20 p-3 border-r border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200">
              <span className="text-xs font-semibold text-gray-600">Time</span>
            </div>
            <div className="flex-1 flex">
              {viewMode === 'week' ? (
                displayDates.map((date, index) => (
                  <div
                    key={index}
                    className={`flex-1 p-3 border-r border-gray-200 last:border-r-0 text-center
                      ${isSameDay(date, new Date()) ? 'bg-[#01b9d5]/5' : ''}`}
                  >
                    <p className="text-xs font-medium text-gray-500">{format(date, 'EEE')}</p>
                    <p className={`text-sm font-semibold ${
                      isSameDay(date, new Date()) ? 'text-[#01b9d5]' : 'text-gray-700'
                    }`}>
                      {format(date, 'd')}
                    </p>
                  </div>
                ))
              ) : (
                visibleDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className="flex-1 p-3 border-r border-gray-200 last:border-r-0"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-xl 
                        flex items-center justify-center text-white text-sm font-bold shadow-md">
                        {doctor.user_metadata?.full_name?.charAt(0) || 'D'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {doctor.user_metadata?.full_name || doctor.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-500">Available</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Timeline Body with premium styling */}
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div className="flex">
            <div className="w-20 bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-300 shadow-sm">
              {timeSlots.map((slot, index) => (
                <div
                  key={slot}
                  className={`h-[${HOUR_HEIGHT}px] border-b border-gray-100 p-2 text-xs 
                    ${index % 2 === 0 ? 'font-medium text-gray-700' : 'text-gray-400'}`}
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  {format(parseISO(`2000-01-01T${slot}`), 'h:mm a')}
                </div>
              ))}
            </div>
            
            <div className="flex-1 relative bg-gradient-to-br from-white to-gray-50" ref={timelineRef}>
              {/* Current time indicator with premium style */}
              {isToday(selectedDate) && viewMode === 'day' && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                  style={{
                    top: `${((getHours(currentTime) - BUSINESS_HOURS.start) * 60 + getMinutes(currentTime)) / 60 * HOUR_HEIGHT}px`
                  }}
                >
                  <div className="absolute -top-2 -left-1 w-4 h-4 bg-red-500 rounded-full shadow-md">
                    <div className="absolute inset-0 bg-red-400 rounded-full animate-ping" />
                  </div>
                  <span className="absolute -top-3 left-6 text-xs font-medium text-red-500 bg-white px-2 rounded">
                    {format(currentTime, 'h:mm a')}
                  </span>
                </div>
              )}

              {/* Time grid with subtle styling */}
              {timeSlots.map((slot, index) => (
                <div
                  key={slot}
                  className={`absolute left-0 right-0 border-b ${
                    index % 2 === 0 ? 'border-gray-200' : 'border-gray-100'
                  }`}
                  style={{ 
                    top: `${index * HOUR_HEIGHT}px`,
                    height: `${HOUR_HEIGHT}px`
                  }}
                />
              ))}

              {/* Appointments or Day columns */}
              {viewMode === 'week' ? (
                <div className="relative h-full">
                  {displayDates.map((date, dayIndex) => {
                    const dayAppointments = filteredAppointments.filter(apt => 
                      isSameDay(parseISO(apt.date), date)
                    );

                    return (
                      <div
                        key={dayIndex}
                        className="absolute border-r border-gray-200 last:border-r-0"
                        style={{
                          left: `${dayIndex * 14.285}%`,
                          width: '14.285%',
                          height: '100%'
                        }}
                      >
                        {dayAppointments.map((appointment) => {
                          const { top, height } = calculateAppointmentPosition(appointment);
                          const StatusIcon = getStatusIcon(appointment.status);

                          return (
                            <motion.div
                              key={appointment.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.05, zIndex: 30 }}
                              className={`absolute left-1 right-1 bg-white rounded-lg shadow-md hover:shadow-xl 
                                border transition-all cursor-pointer overflow-hidden
                                ${getTypeAccent(appointment.type)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => onAppointmentClick(appointment)}
                            >
                              <div className={`absolute inset-0 bg-gradient-to-r ${getStatusGradient(appointment.status)} opacity-10`} />
                              <div className="relative p-2 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-1">
                                  <StatusIcon className="h-3 w-3 text-gray-600" />
                                  <span className="text-[10px] font-medium text-gray-700">
                                    {format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a')}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-gray-800 truncate">
                                  {appointment.patient.first_name} {appointment.patient.last_name}
                                </p>
                                <p className="text-[10px] text-gray-600 truncate">{appointment.type}</p>
                                {/* Mark Ready Button for Week View */}
                                {appointment.status === 'scheduled' && height >= 60 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkReady(appointment.id);
                                    }}
                                    className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white text-[10px] rounded shadow-sm transition-colors"
                                  >
                                    Ready
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}

                        {/* Empty slot click areas */}
                        {timeSlots.map((slot, slotIndex) => (
                          <div
                            key={`${date}-${slot}`}
                            className="absolute left-0 right-0 hover:bg-[#01b9d5]/5 transition-colors cursor-pointer"
                            style={{ 
                              top: `${slotIndex * HOUR_HEIGHT}px`,
                              height: `${HOUR_HEIGHT}px`
                            }}
                            onClick={() => {
                              setSelectedTimeSlot({ 
                                doctorId: selectedDoctorId || doctors[0]?.id || '', 
                                time: slot,
                                date: date 
                              });
                              setIsAddModalOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full">
                  {visibleDoctors.map((doctor) => {
                    const doctorAppointments = filteredAppointments.filter(
                      (apt) => apt.doctor_id === doctor.id
                    );

                    return (
                      <div key={doctor.id} className="flex-1 relative border-r border-gray-200 last:border-r-0">
                        {doctorAppointments.map((appointment) => {
                          const { top, height } = calculateAppointmentPosition(appointment);
                          const StatusIcon = getStatusIcon(appointment.status);

                          return (
                            <motion.div
                              key={appointment.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.05, zIndex: 30 }}
                              className={`absolute left-2 right-2 bg-white rounded-lg shadow-md hover:shadow-xl 
                                border transition-all cursor-pointer overflow-hidden
                                ${getTypeAccent(appointment.type)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => onAppointmentClick(appointment)}
                            >
                              <div className={`absolute inset-0 bg-gradient-to-r ${getStatusGradient(appointment.status)} opacity-10`} />
                              <div className="relative p-3 h-full">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <StatusIcon className="h-4 w-4 text-gray-600" />
                                    <span className="text-xs font-medium text-gray-700">
                                      {format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a')}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${getStatusGradient(appointment.status)} text-white`}>
                                    {appointment.status}
                                  </span>
                                </div>
                                <p className="text-sm font-semibold text-gray-800">
                                  {appointment.patient.first_name} {appointment.patient.last_name}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">{appointment.type}</p>
                                {appointment.duration >= 60 && appointment.notes && (
                                  <p className="text-[10px] text-gray-500 mt-2 truncate">{appointment.notes}</p>
                                )}
                                {/* Mark Ready Button */}
                                {appointment.status === 'scheduled' && (
                                  <div className="absolute bottom-2 right-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkReady(appointment.id);
                                      }}
                                      className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md shadow-md transition-colors"
                                    >
                                      Mark Ready
                                    </button>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}

                        {/* Empty slots for new appointments */}
                        {timeSlots.map((slot, index) => (
                          <div
                            key={`${doctor.id}-${slot}`}
                            className="absolute left-0 right-0 hover:bg-[#01b9d5]/5 transition-colors cursor-pointer"
                            style={{ 
                              top: `${index * HOUR_HEIGHT}px`,
                              height: `${HOUR_HEIGHT}px`
                            }}
                            onClick={() => {
                              setSelectedTimeSlot({ 
                                doctorId: doctor.id, 
                                time: slot,
                                date: selectedDate 
                              });
                              setIsAddModalOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-[#01b9d5] animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Error loading appointments</p>
          <button 
            onClick={onRefresh}
            className="mt-2 text-[#01b9d5] hover:text-[#0196be] text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Premium Header Section */}
      <div className="p-4 bg-gradient-to-r from-white to-gray-50 border-b border-gray-300">
        {/* Appointment Status Filters - Full Width */}
        <div className="mb-4">
          <div className="flex items-center gap-2 p-1 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg w-full shadow-sm">
            {[
              { status: 'total', label: 'Total', count: filteredAppointments.length, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', text: 'text-blue-800' },
              { status: 'completed', label: 'Completed', count: filteredAppointments.filter(a => a.status === 'completed').length, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-800' },
              { status: 'pending', label: 'Pending', count: filteredAppointments.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-800' },
              { status: 'cancelled', label: 'Cancelled', count: filteredAppointments.filter(a => a.status === 'cancelled').length, gradient: 'from-red-500 to-red-600', bg: 'bg-red-50', text: 'text-red-800' }
            ].map((filter) => (
              <button
                key={filter.status}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all capitalize ${filter.bg} ${filter.text} hover:shadow-md border border-transparent hover:border-gray-300`}
              >
                <span>{filter.label}</span>
                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${filter.gradient} text-white shadow-sm`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation and filters */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
              <CalendarIcon className="h-4 w-4 text-[#01b9d5]" />
              <span className="text-sm font-semibold text-gray-800">
                {viewMode === 'all' 
                  ? 'All Appointments'
                  : viewMode === 'week' 
                  ? `${format(weekDates[0], 'MMM d')} - ${format(weekDates[6], 'MMM d, yyyy')}`
                  : viewMode === 'month'
                  ? format(selectedDate, 'MMMM yyyy')
                  : format(selectedDate, 'EEEE, MMMM d, yyyy')
                }
              </span>
            </div>
            
            <button
              onClick={() => navigateDate('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
            
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm font-medium bg-gradient-to-r from-[#01b9d5] to-purple-600 
                text-white rounded-lg hover:shadow-md transition-all"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search appointments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg 
                  focus:outline-none focus:border-[#01b9d5] focus:ring-1 focus:ring-[#01b9d5]/20"
              />
            </div>
            
            <select
              value={selectedDoctorId || ''}
              onChange={(e) => setSelectedDoctorId(e.target.value || null)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg 
                focus:outline-none focus:border-[#01b9d5] focus:ring-1 focus:ring-[#01b9d5]/20"
            >
              <option value="">All Doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.user_metadata?.full_name || doctor.email}
                </option>
              ))}
            </select>


            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-hidden bg-gradient-to-br from-gray-50/50 via-white to-gray-50/30">
        {viewMode === 'day' && internalViewMode === 'timeline' ? (
          // Day Timeline -> Use the drag-and-drop time grid
          <PremiumDayGridView
            selectedDate={selectedDate}
            appointments={filteredAppointments}
            doctors={doctors}
            onAppointmentClick={onAppointmentClick}
            onTimeSlotClick={(time, doctorId) => {
              setSelectedTimeSlot({
                doctorId,
                time: format(time, 'HH:mm'),
                date: time
              });
              setIsAddModalOpen(true);
            }}
            onAppointmentDrop={handleAppointmentDrop}
            onMarkReady={handleMarkReady}
            businessHours={{ start: '08:00', end: '23:00' }}
            slotDuration={30}
          />
        ) : viewMode === 'day' && internalViewMode === 'grid' ? (
          // Day Grid -> Use card-based layout (same as month)
          <GridView />
        ) : viewMode === 'week' && internalViewMode === 'timeline' ? (
          // Week Timeline -> Use the week timeline view
          <PremiumWeekGridView
            weekDates={weekDates}
            appointments={filteredAppointments}
            doctors={doctors}
            onAppointmentClick={onAppointmentClick}
            onTimeSlotClick={(date, time, doctorId) => {
              setSelectedTimeSlot({
                doctorId: doctorId || selectedDoctorId || doctors[0]?.id || '',
                time: time, // time should already be in HH:mm format
                date: date
              });
              setIsAddModalOpen(true);
            }}
            onMarkReady={handleMarkReady}
          />
        ) : viewMode === 'week' && internalViewMode === 'grid' ? (
          // Week Grid -> Use card-based layout (same as month)
          <GridView />
        ) : (
          // Month/All -> Always use card-based grid
          <GridView />
        )}
      </div>

      {/* Premium Floating Add Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setSelectedTimeSlot(null);
          setIsAddModalOpen(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-[#01b9d5] to-purple-600 
          text-white rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center justify-center group"
      >
        <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
      </motion.button>

      {/* Add Appointment Modal */}
      <FormModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedTimeSlot(null);
        }}
        title="Schedule Appointment"
      >
        <AddAppointmentForm
          initialDate={selectedTimeSlot?.date || selectedDate}
          initialTime={selectedTimeSlot?.time}
          initialDoctorId={selectedTimeSlot?.doctorId}
          onSuccess={() => {
            setIsAddModalOpen(false);
            setSelectedTimeSlot(null);
            if (props.onRefresh) {
              props.onRefresh();
            }
          }}
        />
      </FormModal>
    </div>
  );
};

export default PremiumAppointmentScheduler;