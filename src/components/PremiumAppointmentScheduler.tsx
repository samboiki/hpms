import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import {
  Plus,
  RefreshCw,
  Phone,
  AlertCircle,
  Trash2,
  Edit2,
  MoreVertical,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  XCircle,
  Stethoscope,
  Activity
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
import PremiumAddAppointmentForm from './forms/PremiumAddAppointmentForm';
import { PremiumDayGridView } from './appointments/PremiumDayGridView';
import { PremiumWeekGridView } from './appointments/PremiumWeekGridView';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useTheme } from '../stores/themeStore';
import DuotoneIcon from './icons/DuotoneIcon';

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
  is_checked_in?: boolean;
  is_ready?: boolean;
  is_confirmed?: boolean;
  is_cancelled?: boolean;
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

const getStatusColorClasses = (status: Appointment['status']) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'ready':
      return 'bg-green-100 text-green-800';
    case 'in-progress':
      return 'bg-orange-100 text-orange-800';
    case 'completed':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'no-show':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
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

  const { currentTheme } = useTheme();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
    currentUserRole === 'doctor' ? currentUserId : null
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ doctorId: string; time: string; date: Date } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [internalViewMode, setInternalViewMode] = useState<'timeline' | 'grid'>(externalInternalViewMode || 'grid');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle Mark Ready - sets is_ready flag in visits table
  const handleMarkReady = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          is_ready: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

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

  // Handle Start Visit - changes status to in-progress and opens edit form
  const handleStartVisit = async (visitId: string) => {
    try {
      // Update visit status to in-progress
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'in-progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      toast.success('Visit started!');
      
      // Refresh the data
      if (props.onRefresh) {
        props.onRefresh();
      }
      
      // Open the edit visit form
      const appointment = appointments.find(a => a.id === visitId);
      if (appointment && props.onEditAppointment) {
        props.onEditAppointment(appointment);
      }
    } catch (error) {
      console.error('Error starting visit:', error);
      toast.error('Failed to start visit');
    }
  };

  // Handle Check In - sets is_checked_in flag in visits table
  const handleCheckIn = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          is_checked_in: true,
          is_confirmed: true, // Also confirm the visit when checking in
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      toast.success('Patient checked in successfully!');
      
      if (props.onRefresh) {
        props.onRefresh();
      }
    } catch (error) {
      console.error('Error checking in patient:', error);
      toast.error('Failed to check in patient');
    }
  };

  // Handle Complete Visit - changes status to completed
  const handleCompleteVisit = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      toast.success('Visit marked as completed!');
      
      if (props.onRefresh) {
        props.onRefresh();
      }
    } catch (error) {
      console.error('Error completing visit:', error);
      toast.error('Failed to complete visit');
    }
  };

  // Handle Re-schedule - changes status back to scheduled from completed or cancelled
  const handleRevertToScheduled = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'scheduled',
          is_ready: false, // Reset ready status
          is_checked_in: false, // Reset checked in status
          is_cancelled: false, // Reset cancelled status
          is_confirmed: true, // Set as confirmed when rescheduling
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      toast.success('Visit rescheduled successfully!');
      
      if (props.onRefresh) {
        props.onRefresh();
      }
    } catch (error) {
      console.error('Error rescheduling visit:', error);
      toast.error('Failed to reschedule visit');
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


    // Sort by date for "all" view - most recent first
    if (viewMode === 'all') {
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateB.getTime() - dateA.getTime();
      });
    }

    return filtered;
  }, [appointments, selectedDate, selectedDoctorId, viewMode, weekDates]);

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
    const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
    
    // Group appointments by time slots for better organization
    const appointmentsByTime = useMemo(() => {
      const grouped = filteredAppointments.reduce((acc, apt) => {
        const time = apt.time || '00:00';
        if (!acc[time]) {
          acc[time] = [];
        }
        acc[time].push(apt);
        return acc;
      }, {} as Record<string, typeof filteredAppointments>);

      return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    }, [filteredAppointments]);

    // Card-based grid view for day/week/month/all
    return (
      <div className="p-6">
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
          <div className="space-y-8">
            {appointmentsByTime.map(([time, appointments], groupIndex) => {
              // Calculate cumulative card numbers
              const previousCardsCount = appointmentsByTime
                .slice(0, groupIndex)
                .reduce((sum, [_, apps]) => sum + apps.length, 0);
              
              return (
              <div key={time} className="relative">
                {/* Time header with premium design */}
                <div className="flex items-center mb-4">
                  <div className="bg-white rounded-full px-4 py-2 shadow-sm border border-gray-200 flex items-center gap-2">
                    <DuotoneIcon icon="Clock" className="h-4 w-4 text-brand-primary" />
                    <span className="font-semibold text-gray-900">
                      {format(parseISO(`2000-01-01T${time}`), 'h:mm a')}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {appointments.length} appointment{appointments.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 via-gray-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid - Full width */}
                <div className="grid grid-cols-1 gap-3">
                  <AnimatePresence mode="popLayout">
                    {appointments.map((appointment, index) => {
                      const StatusIcon = getStatusIcon(appointment.status);
                      const isUpcoming = appointment.status === 'scheduled';
                      const aptDate = parseISO(appointment.date);

                      return (
                        <motion.div
                          key={appointment.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ 
                            delay: index * 0.02, 
                            type: "spring", 
                            stiffness: 500, 
                            damping: 30 
                          }}
                          whileHover={{ scale: 1.01 }}
                          className="relative bg-white/70 backdrop-blur-md rounded-xl border border-white/50 shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
                          onClick={() => onAppointmentClick(appointment)}
                        >
                          {/* Faint inside border with status color */}
                          <div className={`absolute inset-0 rounded-xl border-2 ${
                            appointment.status === 'scheduled' ? 'border-blue-500/20' :
                            appointment.status === 'ready' ? 'border-emerald-500/20' :
                            appointment.status === 'in-progress' ? 'border-amber-500/20' :
                            appointment.status === 'completed' ? 'border-gray-500/20' :
                            appointment.status === 'cancelled' ? 'border-red-500/20' :
                            'border-purple-500/20'
                          } pointer-events-none`} />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill={
                                appointment.status === 'scheduled' ? '#3b82f6' :
                                appointment.status === 'ready' ? '#10b981' :
                                appointment.status === 'in-progress' ? '#f59e0b' :
                                appointment.status === 'completed' ? '#6b7280' :
                                appointment.status === 'cancelled' ? '#ef4444' :
                                '#a855f7'
                              } />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-${appointment.id})`} />
                          </svg>

                          {/* Smaller number badge - top left */}
                          <div className="absolute left-3 top-3 z-10">
                            <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg ${
                              appointment.status === 'scheduled' ? 'bg-blue-100 border border-blue-200' :
                              appointment.status === 'in-progress' ? 'bg-amber-100 border border-amber-200' :
                              appointment.status === 'completed' ? 'bg-gray-100 border border-gray-200' :
                              appointment.status === 'cancelled' ? 'bg-red-100 border border-red-200' :
                              'bg-purple-100 border border-purple-200'
                            }`} style={appointment.status === 'ready' ? { backgroundColor: '#01b8d8', border: 'none' } : {}}>
                              <span className={`font-semibold text-sm ${
                                appointment.status === 'scheduled' ? 'text-blue-700' :
                                appointment.status === 'ready' ? 'text-white' :
                                appointment.status === 'in-progress' ? 'text-amber-700' :
                                appointment.status === 'completed' ? 'text-gray-700' :
                                appointment.status === 'cancelled' ? 'text-red-700' :
                                'text-purple-700'
                              }`}>
                                {previousCardsCount + index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Status badge - top right */}
                          <div className="absolute top-3 right-3 z-10">
                            {/* Show scheduled badge when: scheduled, confirmed, not checked in, not ready, not cancelled */}
                            {appointment.status === 'scheduled' && 
                             appointment.is_confirmed && 
                             !appointment.is_checked_in && 
                             !appointment.is_ready && 
                             !appointment.is_cancelled && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm bg-blue-100 text-blue-700">
                                Scheduled
                              </span>
                            )}
                            
                            {/* Show checked in badge if checked in but not ready */}
                            {appointment.status === 'scheduled' && appointment.is_checked_in && !appointment.is_ready && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm bg-emerald-100 text-emerald-700">
                                Checked In
                              </span>
                            )}
                            
                            {/* Show ready badge for ready status */}
                            {appointment.status === 'ready' && (
                              <motion.span 
                                animate={{
                                  scale: [1, 1.05, 1],
                                  boxShadow: [
                                    "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                                    "0 4px 8px 0 rgba(1, 184, 216, 0.3)",
                                    "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                                  ]
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide text-white inline-block"
                                style={{ backgroundColor: '#01b8d8' }}
                              >
                                Ready
                              </motion.span>
                            )}
                            
                            {/* Show in-progress badge with animation */}
                            {appointment.status === 'in-progress' && (
                              <motion.span 
                                animate={{
                                  scale: [1, 1.05, 1],
                                  boxShadow: [
                                    "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                                    "0 4px 8px 0 rgba(245, 158, 11, 0.3)",
                                    "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                                  ]
                                }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-700 inline-block"
                              >
                                In Progress
                              </motion.span>
                            )}
                            
                            {/* Show other status badges */}
                            {appointment.status !== 'scheduled' && appointment.status !== 'ready' && appointment.status !== 'in-progress' && (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${
                                appointment.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                                appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-purple-100 text-purple-700'
                              }`}>
                                {appointment.status}
                              </span>
                            )}
                          </div>

                          {/* Clean compact content */}
                          <div className="relative">
                            {/* Top section with number badge and patient info side by side */}
                            <div className="flex gap-3 px-4 pt-4 pb-4">
                              {/* Space for number badge on the left */}
                              <div className="w-8"></div>
                              
                              {/* Patient details column - positioned next to number badge */}
                              <div className="flex-1 space-y-2">
                                {/* Patient name with icon */}
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg backdrop-blur-sm ${
                                    appointment.status === 'scheduled' ? 'bg-blue-50/70' :
                                    appointment.status === 'ready' ? 'bg-cyan-50/70' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50/70' :
                                    appointment.status === 'completed' ? 'bg-gray-50/70' :
                                    appointment.status === 'cancelled' ? 'bg-red-50/70' :
                                    'bg-purple-50/70'
                                  }`}>
                                    <Icon icon="duo-icons:user" className={`h-4 w-4 ${
                                      appointment.status === 'scheduled' ? 'text-blue-600' :
                                      appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                      appointment.status === 'in-progress' ? 'text-amber-600' :
                                      appointment.status === 'completed' ? 'text-gray-600' :
                                      appointment.status === 'cancelled' ? 'text-red-600' :
                                      'text-purple-600'
                                    }`} />
                                  </div>
                                  <h3 className="font-bold text-[#4f575e] text-base tracking-tight truncate flex-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                    {appointment.patient.first_name} {appointment.patient.last_name}
                                  </h3>
                                </div>

                                {/* Phone number with badge */}
                                {appointment.patient.cell_number && (
                                  <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg backdrop-blur-sm ${
                                      appointment.status === 'scheduled' ? 'bg-blue-50/70' :
                                      appointment.status === 'ready' ? 'bg-cyan-50/70' :
                                      appointment.status === 'in-progress' ? 'bg-amber-50/70' :
                                      appointment.status === 'completed' ? 'bg-gray-50/70' :
                                      appointment.status === 'cancelled' ? 'bg-red-50/70' :
                                      'bg-purple-50/70'
                                    }`}>
                                      <Icon icon="solar:phone-bold-duotone" className={`h-3.5 w-3.5 ${
                                        appointment.status === 'scheduled' ? 'text-blue-600' :
                                        appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                        appointment.status === 'in-progress' ? 'text-amber-600' :
                                        appointment.status === 'completed' ? 'text-gray-600' :
                                        appointment.status === 'cancelled' ? 'text-red-600' :
                                        'text-purple-600'
                                      }`} />
                                    </div>
                                    <span className="text-sm text-gray-600">{appointment.patient.cell_number}</span>
                                  </div>
                                )}
                                
                                {/* Designated doctor with badge */}
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg backdrop-blur-sm ${
                                    appointment.status === 'scheduled' ? 'bg-blue-50/70' :
                                    appointment.status === 'ready' ? 'bg-cyan-50/70' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50/70' :
                                    appointment.status === 'completed' ? 'bg-gray-50/70' :
                                    appointment.status === 'cancelled' ? 'bg-red-50/70' :
                                    'bg-purple-50/70'
                                  }`}>
                                    <Icon icon="solar:stethoscope-bold-duotone" className={`h-3.5 w-3.5 ${
                                      appointment.status === 'scheduled' ? 'text-blue-600' :
                                      appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                      appointment.status === 'in-progress' ? 'text-amber-600' :
                                      appointment.status === 'completed' ? 'text-gray-600' :
                                      appointment.status === 'cancelled' ? 'text-red-600' :
                                      'text-purple-600'
                                    }`} />
                                  </div>
                                  <span className="text-sm text-gray-600">Dr. {(() => {
                                    const doctor = doctors.find(d => d.id === appointment.doctor_id);
                                    return doctor?.user_metadata?.full_name || doctor?.email || 'Unassigned';
                                  })()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Full width grey line */}
                            <div className="h-px bg-gray-200" />

                            {/* Bottom section with info and button */}
                            <div className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                {/* Info sections */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Time section */}
                                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm ${
                                    appointment.status === 'scheduled' ? 'bg-blue-50/70 text-blue-700' :
                                    appointment.status === 'ready' ? 'bg-cyan-50/70 text-[#01b8d8]' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50/70 text-amber-700' :
                                    appointment.status === 'completed' ? 'bg-gray-50/70 text-gray-700' :
                                    appointment.status === 'cancelled' ? 'bg-red-50/70 text-red-700' :
                                    'bg-purple-50/70 text-purple-700'
                                  }`}>
                                    <Icon icon="duo-icons:clock" className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{time ? format(parseISO(`2000-01-01T${time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100/70 backdrop-blur-sm text-gray-700">
                                    <Icon icon={
                                      appointment.type === 'consultation' ? 'duo-icons:stethoscope' :
                                      appointment.type === 'follow-up' ? 'duo-icons:refresh' :
                                      appointment.type === 'procedure' ? 'duo-icons:syringe' :
                                      'duo-icons:calendar'
                                    } className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100/70 backdrop-blur-sm text-gray-700">
                                    <Icon icon="duo-icons:timer" className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>
                                </div>

                                {/* Action buttons - bottom right */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready' || appointment.status === 'in-progress' || appointment.status === 'completed' || appointment.status === 'cancelled') && (
                                  <div className="flex gap-2">
                                    {/* Show different buttons based on status */}
                                    {appointment.status === 'scheduled' && (
                                      <>
                                        {/* Check if patient is checked in */}
                                        {(() => {
                                          const isCheckedIn = appointment.is_checked_in;
                                          
                                          if (!isCheckedIn) {
                                            // Show Check In button only if not checked in
                                            return (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCheckIn(appointment.id);
                                                }}
                                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                                              >
                                                <Icon icon="solar:login-3-bold-duotone" className="h-4 w-4" />
                                                <span>Check In</span>
                                              </button>
                                            );
                                          } else {
                                            // Show Mark Ready button after check in
                                            return (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleMarkReady(appointment.id);
                                                }}
                                                className="px-3 py-1.5 bg-gradient-to-r from-[#01b9d5] to-[#0196be] hover:from-[#0196be] hover:to-[#017a8a] text-white rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                                              >
                                                <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" />
                                                <span>Mark Ready</span>
                                              </button>
                                            );
                                          }
                                        })()}
                                      </>
                                    )}
                                    
                                    {/* When ready, show Start Visit button */}
                                    {appointment.status === 'ready' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartVisit(appointment.id);
                                        }}
                                        className="px-3 py-1.5 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                                        style={{ background: '#079dbe', ':hover': { background: '#0689a8' } }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#0689a8'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#079dbe'}
                                      >
                                        <Icon icon="solar:play-bold-duotone" className="h-4 w-4" />
                                        <span>Start Visit</span>
                                      </button>
                                    )}
                                    
                                    {/* When in-progress, show Mark Complete button */}
                                    {appointment.status === 'in-progress' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCompleteVisit(appointment.id);
                                        }}
                                        className="px-3 py-1.5 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                                        style={{ background: '#01b9d5', ':hover': { background: '#0196be' } }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#0196be'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#01b9d5'}
                                      >
                                        <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" />
                                        <span>Mark Complete</span>
                                      </button>
                                    )}
                                    
                                    {/* When completed or cancelled, show Re-schedule button with radio switch style */}
                                    {(appointment.status === 'completed' || appointment.status === 'cancelled') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRevertToScheduled(appointment.id);
                                        }}
                                        className="relative px-4 py-1.5 bg-gray-200 hover:bg-gray-250 text-gray-600 rounded-full text-xs font-medium transition-all flex items-center gap-2 border border-gray-300"
                                        style={{ 
                                          boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
                                          background: '#f3f4f6'
                                        }}
                                      >
                                        {/* Radio switch circle */}
                                        <div className="w-3 h-3 rounded-full bg-gray-400 shadow-sm" />
                                        <span>Re-schedule</span>
                                      </button>
                                    )}
                                    
                                    {/* Edit button - always visible */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (props.onEditAppointment) {
                                          props.onEditAppointment(appointment);
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                                    >
                                      <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" />
                                      <span>Edit Visit</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Professional Timeline/Week View Component
  const TimelineView = () => {
    const visibleDoctors = selectedDoctorId
      ? doctors.filter((d) => d.id === selectedDoctorId)
      : doctors;
    
    const displayDates = viewMode === 'week' ? weekDates : [selectedDate];

    return (
      <div className="flex flex-col h-[600px] bg-white rounded-lg overflow-hidden border border-gray-200">
        {/* Professional Timeline Header */}
        <div className="bg-white/30 backdrop-blur-sm border-b border-dotted border-[#01b9d5]/40">
          <div className="flex">
            <div className="w-20 p-3 border-r border-dotted border-[#01b9d5]/40 bg-white/20 backdrop-blur-sm">
              <span className="text-xs font-medium text-gray-700">Time</span>
            </div>
            <div className="flex-1 flex">
              {viewMode === 'week' ? (
                displayDates.map((date, index) => (
                  <div
                    key={index}
                    className={`flex-1 p-3 border-r border-dotted border-[#01b9d5]/40 last:border-r-0 text-center
                      ${isSameDay(date, new Date()) ? 'bg-blue-100/30 backdrop-blur-sm border-dotted border-[#01b9d5]/60' : ''}`}
                  >
                    <p className="text-xs font-medium text-gray-600">{format(date, 'EEE')}</p>
                    <p className={`text-sm font-semibold ${
                      isSameDay(date, new Date()) ? 'text-blue-600' : 'text-gray-800'
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
                      <div className="w-8 h-8 bg-[#01b9d5] rounded-lg flex items-center justify-center text-white text-sm font-semibold">
                        {doctor.user_metadata?.full_name?.charAt(0) || 'D'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {doctor.user_metadata?.full_name || doctor.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-green-600">Available</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Professional Timeline Body */}
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div className="flex">
            <div className="w-20 bg-white/20 backdrop-blur-sm border-r border-dotted border-[#01b9d5]/40">
              {timeSlots.map((slot, index) => (
                <div
                  key={slot}
                  className="h-[60px] border-b border-dotted border-[#01b9d5]/30 p-2 text-xs font-medium text-gray-600 flex items-center"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  {format(parseISO(`2000-01-01T${slot}`), 'h:mm a')}
                </div>
              ))}
            </div>
            
            <div className="flex-1 relative bg-white" ref={timelineRef}>
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

              {/* Clean time grid */}
              {timeSlots.map((slot, index) => (
                <div
                  key={slot}
                  className="absolute left-0 right-0 border-b border-dotted border-[#01b9d5]/30"
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
                        className="absolute border-r border-dotted border-[#01b9d5]/30 last:border-r-0"
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
                              className={`absolute left-1 right-1 bg-white/70 backdrop-blur-sm rounded-md shadow-sm hover:shadow-md 
                                border border-white/30 transition-shadow cursor-pointer overflow-hidden
                                ${getTypeAccent(appointment.type)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => onAppointmentClick(appointment)}
                            >
                              <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${getStatusGradient(appointment.status)}`} />
                              <div className="relative p-2 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-900">
                                    {format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a')}
                                  </span>
                                  <StatusIcon className="h-3 w-3 text-gray-500" />
                                </div>
                                <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                                  {appointment.patient.first_name} {appointment.patient.last_name}
                                </p>
                                <p className="text-xs text-gray-600 truncate capitalize">{appointment.type}</p>
                                {/* Action Buttons for Week View - only show if height allows */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready') && height >= 80 && (
                                  <div className="absolute bottom-1 right-1 flex gap-1">
                                    {appointment.status === 'scheduled' ? (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCheckIn(appointment.id);
                                          }}
                                          className="px-1.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] rounded shadow-sm transition-colors"
                                          title="Check In"
                                        >
                                          CI
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkReady(appointment.id);
                                          }}
                                          className="px-1.5 py-0.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] rounded shadow-sm transition-colors"
                                          title="Mark Ready"
                                        >
                                          R
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartVisit(appointment.id);
                                        }}
                                        className="px-1.5 py-0.5 bg-purple-500 hover:bg-purple-600 text-white text-[10px] rounded shadow-sm transition-colors"
                                        title="Start Visit"
                                      >
                                        SV
                                      </button>
                                    )}
                                  </div>
                                )}
                                {/* Single button for smaller appointments */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready') && height >= 60 && height < 80 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (appointment.status === 'scheduled') {
                                        handleMarkReady(appointment.id);
                                      } else {
                                        handleStartVisit(appointment.id);
                                      }
                                    }}
                                    className={`absolute bottom-1 right-1 px-1.5 py-0.5 ${
                                      appointment.status === 'scheduled' 
                                        ? 'bg-blue-500 hover:bg-blue-600' 
                                        : 'bg-purple-500 hover:bg-purple-600'
                                    } text-white text-[10px] rounded shadow-sm transition-colors`}
                                    title={appointment.status === 'scheduled' ? 'Mark Ready' : 'Start Visit'}
                                  >
                                    {appointment.status === 'scheduled' ? 'Ready' : 'Start'}
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
                      <div key={doctor.id} className="flex-1 relative border-r border-dashed border-gray-300 last:border-r-0">
                        {doctorAppointments.map((appointment) => {
                          const { top, height } = calculateAppointmentPosition(appointment);
                          const StatusIcon = getStatusIcon(appointment.status);

                          return (
                            <motion.div
                              key={appointment.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.05, zIndex: 30 }}
                              className={`absolute left-2 right-2 bg-white/70 backdrop-blur-sm rounded-md shadow-sm hover:shadow-md 
                                border border-white/30 transition-shadow cursor-pointer overflow-hidden
                                ${getTypeAccent(appointment.type)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => onAppointmentClick(appointment)}
                            >
                              <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${getStatusGradient(appointment.status)}`} />
                              <div className="relative p-3 h-full">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a')}
                                  </span>
                                  <StatusIcon className="h-4 w-4 text-gray-500" />
                                </div>
                                <p className="text-base font-medium text-gray-900 mb-1">
                                  {appointment.patient.first_name} {appointment.patient.last_name}
                                </p>
                                <p className="text-sm text-gray-600 capitalize">{appointment.type}</p>
                                <div className={`inline-block px-2 py-1 mt-2 text-xs font-medium rounded ${getStatusColorClasses(appointment.status)}`}>
                                  {appointment.status}
                                </div>
                                {appointment.duration >= 60 && appointment.notes && (
                                  <p className="text-[10px] text-gray-500 mt-2 truncate">{appointment.notes}</p>
                                )}
                                {/* Action Buttons */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready') && (
                                  <div className="absolute bottom-2 right-2 flex gap-1">
                                    {appointment.status === 'scheduled' ? (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCheckIn(appointment.id);
                                          }}
                                          className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-md shadow-md transition-colors"
                                        >
                                          Check In
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkReady(appointment.id);
                                          }}
                                          className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md shadow-md transition-colors"
                                        >
                                          Ready
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartVisit(appointment.id);
                                        }}
                                        className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-md shadow-md transition-colors"
                                      >
                                        Start Visit
                                      </button>
                                    )}
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-[#01b9d5] animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
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
    <div className="flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
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

        {/* Filters and Actions */}
        <div className="flex items-center justify-between gap-4">
          {/* Schedule Appointment Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedTimeSlot(null);
              setIsAddModalOpen(true);
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg 
              hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 font-medium 
              flex items-center gap-2 disabled:opacity-50 
              disabled:cursor-not-allowed shadow-lg"
          >
            <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5" />
            <span>Schedule Appointment</span>
          </motion.button>

          <div className="flex items-center gap-3">
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
      <div className="bg-gradient-to-br from-gray-50/50 via-white to-gray-50/30">
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
        <PremiumAddAppointmentForm
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