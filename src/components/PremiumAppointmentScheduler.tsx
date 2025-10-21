import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Activity,
  Settings,
  MessageCircle,
  User,
  Calendar,
  Timer,
  Clipboard,
  HandshakeIcon,
  CheckCircle2,
  PhoneIcon,
  TestTube,
  RefreshCcw
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
// Removed motion animations for professional stability
import FormModal from './modals/FormModal';
import PremiumAddAppointmentForm from './forms/PremiumAddAppointmentForm';
import { PremiumDayGridView } from './appointments/PremiumDayGridView';
import { PremiumWeekGridView } from './appointments/PremiumWeekGridView';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useTheme } from '../stores/themeStore';
import DuotoneIcon from './icons/DuotoneIcon';
import { Icon } from '@iconify/react';
import VisitActionModal from './modals/VisitActionModal';
import BookingRequestModal from './modals/BookingRequestModal';
import EnhancedSmsModal from './messages/EnhancedSmsModal';
import ComprehensivePatientModal from './patients/ComprehensivePatientModal';
import { useVisitsStore } from '../stores/visitsStore';
import { HandoffCardPrintButtons } from './dashboard/HandoffCardPrintButtons';

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
  is_handoff?: boolean;
  is_from_website?: boolean;
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

interface Visit {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_date?: string;
  scheduled_time?: string;
  visit_date?: string;
  visit_time?: string;
  is_cancelled: boolean;
}

interface PremiumAppointmentSchedulerProps {
  appointments: Appointment[];
  doctors: Doctor[];
  blockedTimes: BlockedTime[];
  visits?: Visit[];
  isLoading: boolean;
  error: Error | null;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onEditAppointment?: (appointment: Appointment) => void;
  onEditVisit?: (visit: any) => void;
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
    visits = [],
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
  
  // Get practice_id from localStorage or from the first appointment
  const storedPracticeId = localStorage.getItem('selectedPracticeId');
  const firstAppointmentPracticeId = appointments.length > 0 ? appointments[0].practice_id : '';
  const practiceId = storedPracticeId || firstAppointmentPracticeId || '';
  
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
    currentUserRole === 'doctor' ? currentUserId : doctors.length > 0 ? doctors[0].id : null
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ doctorId: string; time: string; date: Date } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [internalViewMode, setInternalViewMode] = useState<'timeline' | 'grid'>(externalInternalViewMode || 'grid');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [selectedVisitForAction, setSelectedVisitForAction] = useState<Appointment | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedVisitForSMS, setSelectedVisitForSMS] = useState<Appointment | null>(null);
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
  const [selectedBookingRequest, setSelectedBookingRequest] = useState<Appointment | null>(null);
  const [isBookingRequestModalOpen, setIsBookingRequestModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle Mark Ready - sets is_ready flag in visits table
  const handleMarkReady = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { markPatientReady } = useVisitsStore.getState();
      await markPatientReady(visitId);
      
      toast.success('Patient marked as ready!');
    } catch (error) {
      console.error('Error marking patient ready:', error);
      toast.error('Failed to mark patient ready');
    }
  };

  // Handle Start Visit - changes status to in-progress
  const handleStartVisit = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { startVisit } = useVisitsStore.getState();
      await startVisit(visitId);
      
      toast.success('Visit started!');
    } catch (error) {
      console.error('Error starting visit:', error);
      toast.error('Failed to start visit');
    }
  };

  // Handle Check In - sets is_checked_in flag in visits table
  const handleCheckIn = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { checkInPatient } = useVisitsStore.getState();
      await checkInPatient(visitId);
      
      toast.success('Patient checked in successfully!');
    } catch (error) {
      console.error('Error checking in patient:', error);
      toast.error('Failed to check in patient');
    }
  };

  // Handle Complete Visit - changes status to completed
  const handleCompleteVisit = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { completeVisit } = useVisitsStore.getState();
      await completeVisit(visitId);
      
      toast.success('Visit marked as completed!');
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
      
      // Don't refresh - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error rescheduling visit:', error);
      toast.error('Failed to reschedule visit');
    }
  };

  // Handle Cancel Visit - marks visit as cancelled
  const handleCancelVisit = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { cancelVisit } = useVisitsStore.getState();
      await cancelVisit(visitId);
      
      toast.success('Visit cancelled successfully!');
    } catch (error) {
      console.error('Error cancelling visit:', error);
      toast.error('Failed to cancel visit');
    }
  };

  // Handle No Show - marks visit as no-show
  const handleNoShow = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { markNoShow } = useVisitsStore.getState();
      await markNoShow(visitId);
      
      toast.success('Visit marked as no-show!');
    } catch (error) {
      console.error('Error marking no-show:', error);
      toast.error('Failed to mark as no-show');
    }
  };

  // Handle Confirm Booking - confirms a website booking request
  const handleConfirmBooking = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { confirmVisit } = useVisitsStore.getState();
      await confirmVisit(visitId);
      
      toast.success('Booking confirmed successfully!', {
        icon: '✅',
        duration: 4000
      });
    } catch (error) {
      console.error('Error confirming booking:', error);
      toast.error('Failed to confirm booking');
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
    
    // Log website bookings
    const websiteBookings = appointments.filter(apt => apt.is_from_website);
    if (websiteBookings.length > 0) {
      console.log('Found website bookings:', websiteBookings.length, {
        viewMode,
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        selectedDoctorId,
        bookings: websiteBookings.map(b => ({
          id: b.id,
          date: b.date,
          status: b.status,
          is_confirmed: b.is_confirmed
        }))
      });
    }

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
      filtered = filtered.filter((apt) => {
        // Include website bookings (no doctor assigned yet) when viewing any doctor
        if (!apt.doctor_id && apt.is_from_website) {
          return true;
        }
        return apt.doctor_id === selectedDoctorId;
      });
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
    
    // Group appointments by sections
    const appointmentSections = useMemo(() => {
      const sections = {
        bookingRequests: [] as typeof filteredAppointments,
        schedule: [] as typeof filteredAppointments,
        handedOff: [] as typeof filteredAppointments,
        completed: [] as typeof filteredAppointments,
        cancelled: [] as typeof filteredAppointments
      };

      filteredAppointments.forEach(apt => {
        if (apt.status === 'cancelled' || apt.is_cancelled) {
          sections.cancelled.push(apt);
        } else if (apt.status === 'completed') {
          sections.completed.push(apt);
        } else if (apt.is_handoff && apt.status !== 'completed') {
          sections.handedOff.push(apt);
        } else if (apt.status === 'scheduled' && !apt.is_confirmed && apt.is_from_website) {
          // Booking requests from website (scheduled but not confirmed)
          sections.bookingRequests.push(apt);
        } else {
          // scheduled, ready, in-progress, checked-in all go to schedule section
          sections.schedule.push(apt);
        }
      });

      // Sort each section
      Object.keys(sections).forEach(key => {
        if (key === 'schedule') {
          // For schedule section: sort by status priority then time
          sections.schedule.sort((a, b) => {
            // Status priority: in-progress (1), ready (2), checked-in (3), scheduled (4)
            const getStatusPriority = (apt: typeof a) => {
              if (apt.status === 'in-progress') return 1;
              if (apt.status === 'ready' || apt.is_ready) return 2;
              if (apt.is_checked_in && !apt.is_ready) return 3;
              return 4; // scheduled
            };
            
            const priorityA = getStatusPriority(a);
            const priorityB = getStatusPriority(b);
            
            // First sort by status priority
            if (priorityA !== priorityB) {
              return priorityA - priorityB;
            }
            
            // Then sort by time within same status
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return timeA.localeCompare(timeB);
          });
        } else {
          // For completed, cancelled, and handedOff sections: sort by time only
          sections[key as keyof typeof sections].sort((a, b) => {
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return timeA.localeCompare(timeB);
          });
        }
      });

      return sections;
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
            {/* Booking Request Section */}
            {appointmentSections.bookingRequests.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    <span className="font-bold text-base">Booking Requests</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.bookingRequests.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-orange-300 via-orange-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.bookingRequests.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          setSelectedBookingRequest(appointment);
                          setIsBookingRequestModalOpen(true);
                        }}
                      >
                          {/* Faint inside border with status color */}
                          <div className="absolute inset-0 rounded-[11px] border-2 border-orange-500/20 pointer-events-none" />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-booking-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill="#f97316" />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-booking-${appointment.id})`} />
                          </svg>

                          {/* Smaller number badge - top left */}
                          <div className="absolute left-3 top-3 z-10">
                            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 border border-orange-200">
                              <span className="font-semibold text-sm text-orange-700">
                                {index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Status badge - top right */}
                          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm bg-orange-100 text-orange-700">
                              Website Booking
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm bg-yellow-100 text-yellow-700">
                              Needs Confirmation
                            </span>
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
                                  <div className="p-1.5 rounded-lg">
                                    <User className="h-4 w-4 text-orange-600" />
                                  </div>
                                  <h3 className="font-bold text-[#4f575e] text-base tracking-tight truncate flex-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                    {appointment.patient.first_name} {appointment.patient.last_name}
                                  </h3>
                                </div>

                                {/* Phone number with badge */}
                                {appointment.patient.cell_number && (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-orange-50/70">
                                      <Phone className="h-3.5 w-3.5 text-orange-600" />
                                    </div>
                                    <span className="text-sm text-gray-600">{appointment.patient.cell_number}</span>
                                  </div>
                                )}
                                
                                {/* Service requested */}
                                {appointment.notes && appointment.notes.includes('Service:') && (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg">
                                      <Clipboard className="h-3.5 w-3.5 text-orange-600" />
                                    </div>
                                    <span className="text-sm text-gray-600">
                                      {appointment.notes.match(/Service: ([^\n]*)/)?.[1] || 'Consultation'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Full width grey line */}
                            <div className="h-px bg-gray-200" />

                            {/* Bottom section with info and button */}
                            <div className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                {/* Info sections */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Date section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm bg-orange-50 text-orange-700">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{format(aptDate, 'MMM d, yyyy')}</span>
                                  </div>

                                  {/* Time section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm bg-orange-50 text-orange-700">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>
                                </div>

                                {/* Action buttons - bottom right */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Confirm the booking
                                      handleConfirmBooking(appointment.id);
                                    }}
                                    className="px-4 py-2 bg-[#01b9d4] hover:bg-[#00a5be] text-white rounded-lg font-medium flex items-center gap-2 shadow-lg text-sm"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    Confirm
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBookingRequest(appointment);
                                      setIsBookingRequestModalOpen(true);
                                    }}
                                    className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl  duration-200 group"
                                    title="Manage Booking"
                                  >
                                    <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}

            {/* Handed Off Section */}
            {appointmentSections.handedOff.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <HandshakeIcon className="h-5 w-5" />
                    <span className="font-bold text-base">Handed Off</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.handedOff.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-purple-300 via-purple-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.handedOff.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                      >
                          {/* Faint inside border with status color */}
                          <div className="absolute inset-0 rounded-[11px] border-2 border-purple-500/20 pointer-events-none" />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-handoff-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill="#a855f7" />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-handoff-${appointment.id})`} />
                          </svg>

                          {/* Smaller number badge - top left */}
                          <div className="absolute left-3 top-3 z-10">
                            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 border border-purple-200">
                              <span className="font-semibold text-sm text-purple-700">
                                {index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Status badge - top right */}
                          <div className="absolute top-3 right-3 z-10">
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm bg-purple-100 text-purple-700">
                              Handed Off
                            </span>
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
                                  <div className="p-1.5 rounded-lg">
                                    <User className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <h3 className="font-bold text-[#4f575e] text-base tracking-tight truncate flex-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                    {appointment.patient.first_name} {appointment.patient.last_name}
                                  </h3>
                                </div>

                                {/* Phone number with badge */}
                                {appointment.patient.cell_number && (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-purple-50/70">
                                      <Phone className="h-3.5 w-3.5 text-purple-600" />
                                    </div>
                                    <span className="text-sm text-gray-600">{appointment.patient.cell_number}</span>
                                  </div>
                                )}
                                
                                {/* Designated doctor with badge */}
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg">
                                    <Stethoscope className="h-3.5 w-3.5 text-purple-600" />
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

                            {/* Handoff indicator and print actions row */}
                            <div className="px-4 py-3 bg-purple-50/30 border-b border-purple-100/50">
                              <div className="flex items-center justify-between gap-3">
                                {/* Ready for checkout badge */}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 animate-pulse">
                                    <Clipboard className="h-4 w-4" />
                                    <span className="text-sm font-semibold">Ready for checkout</span>
                                  </div>
                                </div>

                                {/* Print buttons with labels */}
                                <div className="flex items-center gap-2">
                                  <HandoffCardPrintButtons
                                    visitId={appointment.id}
                                    patientId={appointment.patient_id}
                                    practiceId={appointment.practice_id || practiceId}
                                    showLabels={true}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Bottom section with info and button */}
                            <div className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                {/* Info sections */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Time section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm bg-purple-50 text-purple-700">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>

                                </div>

                                {/* Complete button - bottom right */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCompleteVisit(appointment.id);
                                  }}
                                  className="px-4 py-2 bg-[#01b9d4] hover:bg-[#00a5be] text-white rounded-lg font-medium flex items-center gap-2 shadow-lg text-sm"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>Complete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}

            {/* Schedule Section - Active appointments */}
            {appointmentSections.schedule.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <span className="font-bold text-base">Schedule</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.schedule.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-blue-300 via-blue-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.schedule.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const isUpcoming = appointment.status === 'scheduled';
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                      >
                            {/* Faint inside border with status color */}
                            <div className={`absolute inset-0 rounded-[11px] border-2 ${
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
                                {index + 1}
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
                              <span 
                                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide text-white inline-block shadow-sm"
                                style={{ backgroundColor: '#01b8d8' }}
                              >
                                Ready
                              </span>
                            )}
                            
                            {/* Show in-progress badge with animation */}
                            {appointment.status === 'in-progress' && (
                              <span 
                                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-700 inline-block shadow-sm"
                              >
                                In Progress
                              </span>
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
                                  <div className={`p-1.5 rounded-lg ${
                                    ''
                                  }`}>
                                    <User className={`h-4 w-4 ${
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
                                    <div className={`p-1.5 rounded-lg ${
                                      appointment.status === 'scheduled' ? 'bg-blue-50/70' :
                                      appointment.status === 'ready' ? 'bg-cyan-50/70' :
                                      appointment.status === 'in-progress' ? 'bg-amber-50/70' :
                                      appointment.status === 'completed' ? 'bg-gray-50/70' :
                                      appointment.status === 'cancelled' ? 'bg-red-50/70' :
                                      'bg-purple-50/70'
                                    }`}>
                                      <Phone className={`h-3.5 w-3.5 ${
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
                                  <div className={`p-1.5 rounded-lg ${
                                    ''
                                  }`}>
                                    <Stethoscope className={`h-3.5 w-3.5 ${
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
                                    appointment.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                                    appointment.status === 'ready' ? 'bg-cyan-50 text-[#01b8d8]' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50 text-amber-700' :
                                    appointment.status === 'completed' ? 'bg-gray-50 text-gray-700' :
                                    appointment.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                                    'bg-purple-50 text-purple-700'
                                  }`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>
                                </div>

                                {/* Action buttons - bottom right */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready' || appointment.status === 'in-progress' || appointment.status === 'completed' || appointment.status === 'cancelled') && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Validate appointment data before opening modal
                                        if (!appointment.patient_id) {
                                          console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                                          toast.error('Cannot open visit details - patient information missing');
                                          return;
                                        }
                                        setSelectedVisitForAction(appointment);
                                        setIsActionModalOpen(true);
                                      }}
                                      className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl  duration-200 group"
                                      title="Actions"
                                    >
                                      <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}

            {/* Completed Section */}
            {appointmentSections.completed.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-bold text-base">Completed</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.completed.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 via-gray-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.completed.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const isUpcoming = appointment.status === 'scheduled';
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                      >
                            {/* Faint inside border with status color */}
                            <div className={`absolute inset-0 rounded-[11px] border-2 ${
                            appointment.status === 'scheduled' ? 'border-blue-500/20' :
                            appointment.status === 'ready' ? 'border-emerald-500/20' :
                            appointment.status === 'in-progress' ? 'border-amber-500/20' :
                            appointment.status === 'completed' ? 'border-gray-500/20' :
                            appointment.status === 'cancelled' ? 'border-red-500/20' :
                            'border-purple-500/20'
                          } pointer-events-none`} />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-completed-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill={
                                appointment.status === 'scheduled' ? '#3b82f6' :
                                appointment.status === 'ready' ? '#10b981' :
                                appointment.status === 'in-progress' ? '#f59e0b' :
                                appointment.status === 'completed' ? '#6b7280' :
                                appointment.status === 'cancelled' ? '#ef4444' :
                                '#a855f7'
                              } />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-completed-${appointment.id})`} />
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
                                {appointmentSections.schedule.length + index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Status badge - top right */}
                          <div className="absolute top-3 right-3 z-10">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${
                              appointment.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                              appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {appointment.status}
                            </span>
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
                                  <div className={`p-1.5 rounded-lg ${
                                    ''
                                  }`}>
                                    <User className={`h-4 w-4 ${
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
                                    <div className={`p-1.5 rounded-lg ${
                                      appointment.status === 'scheduled' ? 'bg-blue-50/70' :
                                      appointment.status === 'ready' ? 'bg-cyan-50/70' :
                                      appointment.status === 'in-progress' ? 'bg-amber-50/70' :
                                      appointment.status === 'completed' ? 'bg-gray-50/70' :
                                      appointment.status === 'cancelled' ? 'bg-red-50/70' :
                                      'bg-purple-50/70'
                                    }`}>
                                      <Phone className={`h-3.5 w-3.5 ${
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
                                  <div className={`p-1.5 rounded-lg ${
                                    ''
                                  }`}>
                                    <Stethoscope className={`h-3.5 w-3.5 ${
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
                                    appointment.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                                    appointment.status === 'ready' ? 'bg-cyan-50 text-[#01b8d8]' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50 text-amber-700' :
                                    appointment.status === 'completed' ? 'bg-gray-50 text-gray-700' :
                                    appointment.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                                    'bg-purple-50 text-purple-700'
                                  }`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>
                                </div>

                                {/* Action buttons - bottom right */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready' || appointment.status === 'in-progress' || appointment.status === 'completed' || appointment.status === 'cancelled') && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Validate appointment data before opening modal
                                        if (!appointment.patient_id) {
                                          console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                                          toast.error('Cannot open visit details - patient information missing');
                                          return;
                                        }
                                        setSelectedVisitForAction(appointment);
                                        setIsActionModalOpen(true);
                                      }}
                                      className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl  duration-200 group"
                                      title="Actions"
                                    >
                                      <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}

            {/* Cancelled Section */}
            {appointmentSections.cancelled.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    <span className="font-bold text-base">Cancelled</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.cancelled.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-red-300 via-red-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.cancelled.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const isUpcoming = appointment.status === 'scheduled';
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                      >
                            {/* Faint inside border with status color */}
                            <div className={`absolute inset-0 rounded-[11px] border-2 ${
                            appointment.status === 'scheduled' ? 'border-blue-500/20' :
                            appointment.status === 'ready' ? 'border-emerald-500/20' :
                            appointment.status === 'in-progress' ? 'border-amber-500/20' :
                            appointment.status === 'completed' ? 'border-gray-500/20' :
                            appointment.status === 'cancelled' ? 'border-red-500/20' :
                            'border-purple-500/20'
                          } pointer-events-none`} />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-cancelled-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill={
                                appointment.status === 'scheduled' ? '#3b82f6' :
                                appointment.status === 'ready' ? '#10b981' :
                                appointment.status === 'in-progress' ? '#f59e0b' :
                                appointment.status === 'completed' ? '#6b7280' :
                                appointment.status === 'cancelled' ? '#ef4444' :
                                '#a855f7'
                              } />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-cancelled-${appointment.id})`} />
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
                                {appointmentSections.schedule.length + appointmentSections.completed.length + index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Status badge - top right */}
                          <div className="absolute top-3 right-3 z-10">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${
                              appointment.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                              appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {appointment.status}
                            </span>
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
                                  <div className={`p-1.5 rounded-lg ${
                                    ''
                                  }`}>
                                    <User className={`h-4 w-4 ${
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
                                    <div className={`p-1.5 rounded-lg ${
                                      appointment.status === 'scheduled' ? 'bg-blue-50/70' :
                                      appointment.status === 'ready' ? 'bg-cyan-50/70' :
                                      appointment.status === 'in-progress' ? 'bg-amber-50/70' :
                                      appointment.status === 'completed' ? 'bg-gray-50/70' :
                                      appointment.status === 'cancelled' ? 'bg-red-50/70' :
                                      'bg-purple-50/70'
                                    }`}>
                                      <Phone className={`h-3.5 w-3.5 ${
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
                                  <div className={`p-1.5 rounded-lg ${
                                    ''
                                  }`}>
                                    <Stethoscope className={`h-3.5 w-3.5 ${
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
                                    appointment.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                                    appointment.status === 'ready' ? 'bg-cyan-50 text-[#01b8d8]' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50 text-amber-700' :
                                    appointment.status === 'completed' ? 'bg-gray-50 text-gray-700' :
                                    appointment.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                                    'bg-purple-50 text-purple-700'
                                  }`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>
                                </div>

                                {/* Action buttons - bottom right */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready' || appointment.status === 'in-progress' || appointment.status === 'completed' || appointment.status === 'cancelled') && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Validate appointment data before opening modal
                                        if (!appointment.patient_id) {
                                          console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                                          toast.error('Cannot open visit details - patient information missing');
                                          return;
                                        }
                                        setSelectedVisitForAction(appointment);
                                        setIsActionModalOpen(true);
                                      }}
                                      className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl  duration-200 group"
                                      title="Actions"
                                    >
                                      <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}
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
                            <div
                              key={appointment.id}
                              className={`absolute left-1 right-1 bg-white/70 backdrop-blur-sm rounded-md shadow-sm hover:shadow-md 
                                border border-white/30 transition-shadow cursor-pointer overflow-hidden
                                ${getTypeAccent(appointment.type)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
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
                                          className="px-1.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] rounded shadow-sm "
                                          title="Check In"
                                        >
                                          CI
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkReady(appointment.id);
                                          }}
                                          className="px-1.5 py-0.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] rounded shadow-sm "
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
                                        className="px-1.5 py-0.5 bg-purple-500 hover:bg-purple-600 text-white text-[10px] rounded shadow-sm "
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
                                    } text-white text-[10px] rounded shadow-sm `}
                                    title={appointment.status === 'scheduled' ? 'Mark Ready' : 'Start Visit'}
                                  >
                                    {appointment.status === 'scheduled' ? 'Ready' : 'Start'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Empty slot click areas */}
                        {timeSlots.map((slot, slotIndex) => (
                          <div
                            key={`${date}-${slot}`}
                            className="absolute left-0 right-0 hover:bg-[#01b9d5]/5  cursor-pointer"
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
                            <div
                              key={appointment.id}
                              className={`absolute left-2 right-2 bg-white/70 backdrop-blur-sm rounded-md shadow-sm hover:shadow-md 
                                border border-white/30 transition-shadow cursor-pointer overflow-hidden
                                ${getTypeAccent(appointment.type)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
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
                                          className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-md shadow-md "
                                        >
                                          Check In
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkReady(appointment.id);
                                          }}
                                          className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md shadow-md "
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
                                        className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-md shadow-md "
                                      >
                                        Start Visit
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Empty slots for new appointments */}
                        {timeSlots.map((slot, index) => (
                          <div
                            key={`${doctor.id}-${slot}`}
                            className="absolute left-0 right-0 hover:bg-[#01b9d5]/5  cursor-pointer"
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
      <div className="p-3 md:p-4 bg-gradient-to-r from-white to-gray-50 border-b border-gray-300">
        {/* Filters and Actions - Stack on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 md:mb-4">
          {/* Doctor Filter Button - Full width on mobile */}
          <button
            onClick={() => setShowDoctorModal(true)}
            className="w-full sm:w-auto px-3 md:px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg 
              font-medium flex items-center justify-center sm:justify-start gap-2 text-sm
              border border-gray-200 shadow-sm transition-colors"
          >
            <User className="w-4 h-4 flex-shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-none">
              {selectedDoctorId ? (
                <>
                  <span className="hidden sm:inline">Doctor: </span>
                  <span className="sm:hidden">Dr. </span>
                  {doctors.find(d => d.id === selectedDoctorId)?.user_metadata?.full_name || 
                   doctors.find(d => d.id === selectedDoctorId)?.email?.split('@')[0] || 
                   'Unknown'}
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Doctor: </span>
                  <span>All Doctors</span>
                </>
              )}
            </span>
          </button>

          {/* Right Side Actions - Row on mobile */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4 text-gray-600" />
              </button>
            )}

            {/* Schedule Appointment Button - Flex grow on mobile */}
            <button
              onClick={() => {
                setSelectedTimeSlot(null);
                setIsAddModalOpen(true);
              }}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg 
                hover:from-purple-600 hover:to-indigo-700 font-medium 
                flex items-center justify-center gap-2 disabled:opacity-50 
                disabled:cursor-not-allowed shadow-lg text-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule</span>
            </button>
          </div>
        </div>

        {/* Appointment Status Filters - Improved mobile scrolling */}
        <div className="relative -mx-3 px-3 md:mx-0 md:px-0">
          <div className="flex items-center gap-1.5 sm:gap-1 p-1.5 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg w-full shadow-sm overflow-x-auto scrollbar-hide">
            {[
              { status: 'scheduled', label: 'Scheduled', count: filteredAppointments.filter(a => a.status === 'scheduled' && a.is_confirmed && !a.is_checked_in).length, gradient: 'from-blue-500 to-blue-600', bg: 'bg-white', text: 'text-gray-700' },
              { status: 'checked-in', label: 'Checked In', count: filteredAppointments.filter(a => a.is_checked_in && a.status !== 'completed' && a.status !== 'in-progress').length, gradient: 'from-purple-500 to-purple-600', bg: 'bg-white', text: 'text-gray-700' },
              { status: 'completed', label: 'Completed', count: filteredAppointments.filter(a => a.status === 'completed').length, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-white', text: 'text-gray-700' },
              { status: 'cancelled', label: 'Cancelled', count: filteredAppointments.filter(a => a.status === 'cancelled' || a.is_cancelled).length, gradient: 'from-red-500 to-red-600', bg: 'bg-white', text: 'text-gray-700' }
            ].map((filter) => (
              <button
                key={filter.status}
                className={`flex-shrink-0 flex flex-col sm:flex-row items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-md ${filter.bg} ${filter.text} hover:shadow-md border border-gray-200 hover:border-gray-300 min-w-[80px] sm:min-w-[100px] md:min-w-[120px] transition-all`}
              >
                <span className="whitespace-nowrap text-[11px] sm:text-xs">{filter.label}</span>
                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${filter.gradient} text-white shadow-sm min-w-[24px]`}>
                  {filter.count}
                </span>
              </button>
            ))}
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
            visits={visits}
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

      {/* Doctor Selection Modal */}
      {showDoctorModal && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowDoctorModal(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]"
          />

              {/* Modal Container for Centering */}
              <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
                {/* Modal */}
                <div
                  className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl max-h-[70vh] overflow-hidden pointer-events-auto"
                >
              {/* Header */}
              <div className="flex-shrink-0 p-6 border-b border-gray-100 bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Select Doctor</h2>
                    <p className="text-sm text-gray-500 mt-1">Choose a doctor to filter appointments</p>
                  </div>
                  <button
                    onClick={() => setShowDoctorModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl "
                  >
                    <XCircle className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Doctor List */}
              <div className="p-4 max-h-[400px] overflow-y-auto">
                {/* All Doctors Option */}
                <button
                  onClick={() => {
                    setSelectedDoctorId(null);
                    setShowDoctorModal(false);
                  }}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 ${
                    !selectedDoctorId 
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200' 
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    !selectedDoctorId ? 'bg-blue-100' : 'bg-gray-200'
                  }`}>
                    <Icon 
                      icon="solar:users-group-two-rounded-bold-duotone" 
                      className={`w-5 h-5 ${!selectedDoctorId ? 'text-blue-600' : 'text-gray-600'}`} 
                    />
                  </div>
                  <div className="text-left">
                    <p className={`font-medium ${!selectedDoctorId ? 'text-blue-700' : 'text-gray-700'}`}>
                      All Doctors
                    </p>
                    <p className="text-xs text-gray-500">View appointments for all doctors</p>
                  </div>
                  {!selectedDoctorId && (
                    <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />
                  )}
                </button>

                {/* Individual Doctors */}
                <div className="mt-3 space-y-2">
                  {doctors.map((doctor) => {
                    const isSelected = selectedDoctorId === doctor.id;
                    const doctorName = doctor.user_metadata?.full_name || doctor.email;
                    const doctorRole = doctor.user_metadata?.role || 'Doctor';
                    const doctorSpecialization = doctor.user_metadata?.specialization || '';
                    
                    return (
                      <button
                        key={doctor.id}
                        onClick={() => {
                          setSelectedDoctorId(doctor.id);
                          setShowDoctorModal(false);
                        }}
                        className={`w-full p-3 rounded-lg flex items-center gap-3 ${
                          isSelected 
                            ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200' 
                            : 'bg-white hover:bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          isSelected ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <Icon 
                            icon="solar:user-bold-duotone" 
                            className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} 
                          />
                        </div>
                        <div className="text-left flex-1">
                          <p className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                            {doctorName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {doctorRole}{doctorSpecialization ? ` • ${doctorSpecialization}` : ''}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
                </div>
              </div>
        </>,
        document.body
      )}
      
      {/* Visit Action Modal */}
      {selectedVisitForAction && (
        <VisitActionModal
          isOpen={isActionModalOpen}
          onClose={() => {
            setIsActionModalOpen(false);
            setSelectedVisitForAction(null);
          }}
          visit={selectedVisitForAction}
          visitStatus={
            selectedVisitForAction.status === 'in-progress' ? 'in-progress' :
            selectedVisitForAction.status === 'ready' ? 'ready' :
            selectedVisitForAction.status === 'completed' ? 'completed' :
            'scheduled'
          }
          isCheckedIn={selectedVisitForAction.is_checked_in}
          onStartVisit={() => handleStartVisit(selectedVisitForAction.id)}
          onCompleteVisit={() => handleCompleteVisit(selectedVisitForAction.id)}
          onCheckIn={() => handleCheckIn(selectedVisitForAction.id)}
          onMarkReady={() => handleMarkReady(selectedVisitForAction.id)}
          onReschedule={() => {
            if (props.onEditAppointment) {
              props.onEditAppointment(selectedVisitForAction);
            }
          }}
          onCancel={() => handleCancelVisit(selectedVisitForAction.id)}
          onNoShow={() => handleNoShow(selectedVisitForAction.id)}
          onViewDetails={() => {
            if (props.onEditVisit) {
              props.onEditVisit(selectedVisitForAction);
            } else {
              onAppointmentClick(selectedVisitForAction);
            }
          }}
          onSendSMS={() => {
            setSelectedVisitForSMS(selectedVisitForAction);
            setIsSMSModalOpen(true);
          }}
          onViewPatientProfile={() => {
            console.log('[PremiumAppointmentScheduler] onViewPatientProfile clicked', {
              selectedVisitForAction,
              patient_id: selectedVisitForAction?.patient_id
            });
            if (selectedVisitForAction?.patient_id) {
              console.log('[PremiumAppointmentScheduler] Setting patient modal open for patient:', selectedVisitForAction.patient_id);
              setSelectedPatientId(selectedVisitForAction.patient_id);
              setIsPatientModalOpen(true);
              setIsActionModalOpen(false);
              setSelectedVisitForAction(null);
            } else {
              console.error('[PremiumAppointmentScheduler] No patient_id found in visit');
            }
          }}
        />
      )}

      {/* SMS Modal */}
      {selectedVisitForSMS && (
        <EnhancedSmsModal
          isOpen={isSMSModalOpen}
          onClose={() => {
            setIsSMSModalOpen(false);
            setSelectedVisitForSMS(null);
          }}
          patientId={selectedVisitForSMS.patient_id}
          patientName={`${selectedVisitForSMS.patient?.first_name || ''} ${selectedVisitForSMS.patient?.last_name || ''}`}
          patientPhone={selectedVisitForSMS.patient?.cell_number || ''}
        />
      )}

      {/* Booking Request Modal */}
      {selectedBookingRequest && (
        <BookingRequestModal
          isOpen={isBookingRequestModalOpen}
          onClose={() => {
            setIsBookingRequestModalOpen(false);
            setSelectedBookingRequest(null);
          }}
          visit={selectedBookingRequest}
          onConfirm={() => {
            setIsBookingRequestModalOpen(false);
            setSelectedBookingRequest(null);
            // Refresh appointments
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}

      {/* Patient Profile Modal */}
      {console.log('[PremiumAppointmentScheduler] Patient Modal Render Check:', {
        selectedPatientId,
        isPatientModalOpen,
        shouldRender: !!selectedPatientId
      })}
      {selectedPatientId && (
        <ComprehensivePatientModal
          isOpen={isPatientModalOpen}
          onClose={() => {
            console.log('[PremiumAppointmentScheduler] Closing patient modal');
            setIsPatientModalOpen(false);
            setSelectedPatientId(null);
          }}
          patientId={selectedPatientId}
        />
      )}
    </div>
  );
};

export default PremiumAppointmentScheduler;