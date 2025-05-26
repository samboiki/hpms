import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  User,
  Stethoscope,
  AlertCircle,
  Plus,
  Loader2,
  MoreVertical,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Activity,
  Phone,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  parseISO,
  isToday,
  isSameDay,
  setHours,
  setMinutes,
  addMinutes,
  differenceInMinutes,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { supabase } from '../lib/supabase';
import { 
  checkAppointmentConflict, 
  generateTimeSlots,
  findNextAvailableSlot,
  rescheduleAppointment,
  getAppointmentStats
} from '../utils/appointments';
import FormModal from './modals/FormModal';
import AddAppointmentForm from './forms/AddAppointmentForm';
import RescheduleAppointmentModal from './modals/RescheduleAppointmentModal';

// --- Interfaces ---
interface AppointmentPatient {
  id: string;
  first_name: string;
  last_name: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
}

interface AppointmentDoctor {
  id: string;
  full_name: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  patient: AppointmentPatient;
  doctor?: AppointmentDoctor;
  notes?: string;
}

interface PremiumAppointmentScheduleProps {
  date: Date;
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  onDateChange: (newDate: Date) => void;
  onUpdateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  onView: (appointment: Appointment) => void;
  onCreateAppointment?: (slotDate: Date, slotTime: string) => void;
}

interface ProcessedAppointment extends Appointment {
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  conflictCount: number;
}

interface TimeSlot {
  hour: number;
  minute: number;
  time: string;
  label: string;
  available: boolean;
  appointments: ProcessedAppointment[];
}

// --- Constants ---
const START_HOUR = 7;
const END_HOUR = 19;
const HOUR_HEIGHT = 80; // pixels per hour
const SLOT_DURATION = 15; // 15-minute slots
const TIME_COLUMN_WIDTH = 100; // Wider time column

// --- Styling Configuration ---
const statusConfig: Record<Appointment['status'], { 
  bgGradient: string; 
  borderColor: string; 
  textColor: string;
  hoverBg: string;
  badgeVariant: 'azure' | 'success' | 'warning' | 'error' | 'gray';
  icon: React.ComponentType<{ size: number; className?: string }>;
}> = {
  scheduled: { 
    bgGradient: 'bg-gradient-to-br from-blue-50 to-blue-100', 
    borderColor: 'border-blue-500', 
    textColor: 'text-blue-900',
    hoverBg: 'hover:from-blue-100 hover:to-blue-200',
    badgeVariant: 'azure',
    icon: Clock
  },
  confirmed: { 
    bgGradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100', 
    borderColor: 'border-emerald-500', 
    textColor: 'text-emerald-900',
    hoverBg: 'hover:from-emerald-100 hover:to-emerald-200',
    badgeVariant: 'success',
    icon: CheckCircle2
  },
  'in-progress': { 
    bgGradient: 'bg-gradient-to-br from-purple-50 to-purple-100', 
    borderColor: 'border-purple-500', 
    textColor: 'text-purple-900',
    hoverBg: 'hover:from-purple-100 hover:to-purple-200',
    badgeVariant: 'warning',
    icon: Activity
  },
  completed: { 
    bgGradient: 'bg-gradient-to-br from-gray-50 to-gray-100', 
    borderColor: 'border-gray-400', 
    textColor: 'text-gray-700',
    hoverBg: 'hover:from-gray-100 hover:to-gray-200',
    badgeVariant: 'gray',
    icon: CheckCircle2
  },
  cancelled: { 
    bgGradient: 'bg-gradient-to-br from-red-50 to-red-100 opacity-60', 
    borderColor: 'border-red-400', 
    textColor: 'text-red-700',
    hoverBg: 'hover:from-red-100 hover:to-red-200',
    badgeVariant: 'error',
    icon: XCircle
  },
  'no-show': { 
    bgGradient: 'bg-gradient-to-br from-orange-50 to-orange-100 opacity-60', 
    borderColor: 'border-orange-400', 
    textColor: 'text-orange-700',
    hoverBg: 'hover:from-orange-100 hover:to-orange-200',
    badgeVariant: 'error',
    icon: AlertCircle
  },
};

// --- Helper Functions ---
const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// --- Main Component ---
const PremiumAppointmentSchedule: React.FC<PremiumAppointmentScheduleProps> = ({
  date,
  appointments,
  isLoading,
  error,
  onDateChange,
  onUpdateAppointment,
  onView,
  onCreateAppointment,
}) => {
  console.log('=== PremiumAppointmentSchedule Component Rendered ===');
  console.log('Props:', {
    date,
    appointmentsCount: appointments.length,
    appointments,
    isLoading,
    error,
    hasOnCreateAppointment: !!onCreateAppointment
  });
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; time: string } | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<AppointmentDoctor[]>([]);
  const [stats, setStats] = useState<any>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Fetch doctors
  useEffect(() => {
    fetchDoctors();
  }, []);

  // Update current time every minute
  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timerId);
  }, []);

  // Fetch appointment stats
  useEffect(() => {
    fetchStats();
  }, [appointments, date]);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'doctor');
      
      if (!error && data) {
        setDoctors(data);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const dayStats = await getAppointmentStats(undefined, {
        start: startOfDay(date),
        end: endOfDay(date)
      });
      setStats(dayStats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Generate time slots
  const timeSlots = useMemo((): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
        const time = setMinutes(setHours(date, hour), minute);
        const timeStr = format(time, 'HH:mm');
        
        slots.push({
          hour,
          minute,
          time: timeStr,
          label: format(time, minute === 0 ? 'h:mm a' : 'h:mm'),
          available: true,
          appointments: []
        });
      }
    }
    
    return slots;
  }, [date]);

  // Process appointments with advanced overlap detection
  const processedAppointments = useMemo((): ProcessedAppointment[] => {
    console.log('=== PremiumAppointmentSchedule: Processing appointments ===');
    console.log('Input appointments:', appointments);
    console.log('Current date:', date);
    
    const dayAppointments = appointments.filter(a => {
      const isMatch = isSameDay(parseISO(a.date), date);
      console.log(`Checking appointment ${a.id}: date=${a.date}, matches=${isMatch}`);
      return isMatch;
    });
    
    console.log('Filtered day appointments:', dayAppointments);
    
    // Sort by start time
    const sorted = [...dayAppointments].sort((a, b) => {
      const timeA = parseISO(`2000-01-01T${a.time}`);
      const timeB = parseISO(`2000-01-01T${b.time}`);
      return timeA.getTime() - timeB.getTime();
    });
    
    console.log('Sorted appointments:', sorted);

    // First pass: create base processed appointments
    console.log('First pass: Creating base processed appointments');
    const processed: ProcessedAppointment[] = sorted.map((apt, idx) => {
      const [hours, minutes] = apt.time.split(':').map(Number);
      const startMinutes = (hours - START_HOUR) * 60 + minutes;
      const top = (startMinutes / 60) * HOUR_HEIGHT;
      const height = Math.max((apt.duration / 60) * HOUR_HEIGHT, 40);
      
      console.log(`Processing appointment ${idx}:`, {
        id: apt.id,
        time: apt.time,
        hours,
        minutes,
        startMinutes,
        top,
        height
      });
      
      return {
        ...apt,
        top,
        height,
        column: 0,
        totalColumns: 1,
        conflictCount: 0
      };
    });
    
    console.log('After first pass:', processed);
    
    // Second pass: find overlaps and calculate columns
    for (let i = 0; i < processed.length; i++) {
      const apt = processed[i];
      const aptStart = parseISO(`2000-01-01T${apt.time}`);
      const aptEnd = addMinutes(parseISO(`2000-01-01T${apt.time}`), apt.duration);
      
      const overlapping: typeof processed = [];
      
      for (let j = 0; j < i; j++) {
        const other = processed[j];
        const otherStart = parseISO(`2000-01-01T${other.time}`);
        const otherEnd = addMinutes(parseISO(`2000-01-01T${other.time}`), other.duration);
        
        // Check if they overlap
        if (aptStart < otherEnd && aptEnd > otherStart) {
          overlapping.push(other);
        }
      }
      
      // Calculate column position
      const usedColumns = new Set(overlapping.map(o => o.column));
      let column = 0;
      
      while (usedColumns.has(column)) {
        column++;
      }
      
      apt.column = column;
      apt.conflictCount = overlapping.length;
      
      // Update total columns for all overlapping appointments
      const totalColumns = Math.max(column + 1, ...overlapping.map(o => o.totalColumns));
      apt.totalColumns = totalColumns;
      
      overlapping.forEach(o => {
        o.totalColumns = Math.max(o.totalColumns, totalColumns);
      });
    }
    
    console.log('Final processed appointments:', processed);
    return processed;
  }, [appointments, date]);

  // Add appointments to time slots
  const timeSlotsWithAppointments = useMemo(() => {
    const slotsWithAppts = [...timeSlots];
    
    processedAppointments.forEach(apt => {
      const [hour, minute] = apt.time.split(':').map(Number);
      const slotIndex = slotsWithAppts.findIndex(s => 
        s.hour === hour && s.minute === minute
      );
      
      if (slotIndex !== -1) {
        slotsWithAppts[slotIndex].appointments.push(apt);
        
        // Mark slots as unavailable during appointment duration
        const slotsToBlock = Math.ceil(apt.duration / SLOT_DURATION);
        for (let i = 0; i < slotsToBlock && (slotIndex + i) < slotsWithAppts.length; i++) {
          slotsWithAppts[slotIndex + i].available = false;
        }
      }
    });
    
    return slotsWithAppts;
  }, [timeSlots, processedAppointments]);

  const getAppointmentEndTime = (startTime: string, duration: number): string => {
    const [h, m] = startTime.split(':').map(Number);
    const startDate = setMinutes(setHours(new Date(), h), m);
    const endDate = addMinutes(startDate, duration);
    return format(endDate, 'h:mm a');
  };

  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours >= START_HOUR && hours < END_HOUR) {
      const minutesSinceStart = (hours - START_HOUR) * 60 + minutes;
      return (minutesSinceStart / 60) * HOUR_HEIGHT;
    }
    return null;
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (!onCreateAppointment || !slot.available) return;
    
    const slotDate = setMinutes(setHours(date, slot.hour), slot.minute);
    setSelectedTimeSlot({ date: slotDate, time: slot.time });
    setIsAddModalOpen(true);
  };

  const handleAppointmentDrop = async (appointmentId: string, newTime: string) => {
    try {
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) return;

      // Check for conflicts
      const [hour, minute] = newTime.split(':').map(Number);
      const newDateTime = setMinutes(setHours(date, hour), minute);
      
      const hasConflict = await checkAppointmentConflict(
        appointment.doctor_id,
        newDateTime,
        appointment.duration,
        appointmentId
      );

      if (hasConflict) {
        alert('This time slot conflicts with another appointment');
        return;
      }

      await onUpdateAppointment(appointmentId, { time: newTime + ':00' });
    } catch (error) {
      console.error('Error moving appointment:', error);
    }
  };

  const handleReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsRescheduleModalOpen(true);
  };

  const currentTimePosition = getCurrentTimePosition();

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header Section with Stats */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 hover:bg-[#01b9d4]/10 hover:text-[#01b9d4]" 
                onClick={() => onDateChange(subDays(date, 1))}
              >
                <ChevronLeft size={16} />
              </Button>
              <div className="relative">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className="flex items-center gap-2 hover:bg-[#01b9d4]/10"
                >
                  <CalendarIcon size={16} className="text-[#01b9d4]" />
                  <span className="font-semibold">{format(date, 'EEEE, MMMM d')}</span>
                </Button>
                {isCalendarOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-xl p-2 z-50"
                  >
                    <DayPicker
                      mode="single" 
                      selected={date} 
                      onSelect={d => { 
                        if (d) { 
                          onDateChange(d); 
                          setIsCalendarOpen(false); 
                        }
                      }}
                    />
                  </motion.div>
                )}
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 hover:bg-[#01b9d4]/10 hover:text-[#01b9d4]" 
                onClick={() => onDateChange(addDays(date, 1))}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onDateChange(new Date())}
                className="hover:bg-[#01b9d4] hover:text-white hover:border-[#01b9d4]"
              >
                Today
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setSelectedTimeSlot(null);
                  setIsAddModalOpen(true);
                }}
                className="bg-[#01b9d4] hover:bg-[#01b9d4]/90"
              >
                <Plus size={16} className="mr-1" />
                New Appointment
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          {stats && (
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-white/50 rounded-lg px-3 py-1.5 text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-center">
                <p className="text-xs text-blue-600">Scheduled</p>
                <p className="text-lg font-bold text-blue-700">{stats.pending}</p>
              </div>
              <div className="bg-purple-50 rounded-lg px-3 py-1.5 text-center">
                <p className="text-xs text-purple-600">In Progress</p>
                <p className="text-lg font-bold text-purple-700">
                  {appointments.filter(a => a.status === 'in-progress').length}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg px-3 py-1.5 text-center">
                <p className="text-xs text-green-600">Completed</p>
                <p className="text-lg font-bold text-green-700">{stats.completed}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-1.5 text-center">
                <p className="text-xs text-gray-600">Completion</p>
                <p className="text-lg font-bold text-gray-700">{stats.completionRate}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Body with Separated Time Column */}
      <div className="flex-1 flex overflow-hidden">
        {/* Fixed Time Column - Absolutely separated */}
        <div className="w-[100px] flex-shrink-0 bg-gradient-to-b from-gray-50 to-gray-100 border-r-2 border-gray-300 relative z-10">
          {timeSlots.map((slot, index) => (
            <div
              key={`time-${slot.time}`}
              className={`h-[${HOUR_HEIGHT / 4}px] border-b ${
                slot.minute === 0 ? 'border-gray-300' : 'border-gray-200'
              } flex items-center justify-end px-3`}
              style={{ height: `${HOUR_HEIGHT / 4}px` }}
            >
              {slot.minute === 0 && (
                <span className="text-sm font-semibold text-gray-700">{slot.label}</span>
              )}
              {slot.minute === 30 && (
                <span className="text-xs text-gray-500">{slot.label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Appointments Area - Completely separated */}
        <div className="flex-1 relative overflow-y-auto bg-white" ref={scheduleRef}>
          {/* Hour grid lines */}
          {timeSlots.map((slot, index) => (
            <div
              key={`grid-${slot.time}`}
              className={`absolute w-full ${
                slot.minute === 0 ? 'border-b border-gray-200' : 
                slot.minute === 30 ? 'border-b border-gray-100' : ''
              }`}
              style={{ 
                top: `${index * (HOUR_HEIGHT / 4)}px`, 
                height: `${HOUR_HEIGHT / 4}px` 
              }}
            />
          ))}

          {/* Clickable time slots for adding appointments */}
          {onCreateAppointment && timeSlotsWithAppointments.map((slot, index) => (
            <motion.div
              key={`slot-${slot.time}`}
              className={`absolute w-full cursor-pointer transition-colors ${
                slot.available && hoveredSlot === slot.time 
                  ? 'bg-blue-50/30' 
                  : ''
              }`}
              style={{ 
                top: `${index * (HOUR_HEIGHT / 4)}px`, 
                height: `${HOUR_HEIGHT / 4}px` 
              }}
              onMouseEnter={() => setHoveredSlot(slot.time)}
              onMouseLeave={() => setHoveredSlot(null)}
              onClick={() => handleSlotClick(slot)}
            >
              {slot.available && hoveredSlot === slot.time && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Plus size={14} />
                    Add appointment at {slot.label}
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {/* Loading State */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50 backdrop-blur-sm">
              <div className="text-center">
                <Loader2 size={32} className="text-[#01b9d4] animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-600">Loading appointments...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
              <AlertCircle size={32} className="text-red-500 mb-2" />
              <p className="text-sm text-gray-600">{error}</p>
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2"
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={14} className="mr-1" />
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && processedAppointments.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
              <CalendarIcon size={32} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 mb-1">No appointments scheduled</p>
              <p className="text-xs text-gray-400 mb-3">Click on any time slot to add one</p>
              {onCreateAppointment && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setSelectedTimeSlot(null);
                    setIsAddModalOpen(true);
                  }}
                >
                  <Plus size={14} className="mr-1" />
                  Add Appointment
                </Button>
              )}
            </div>
          )}

          {/* Appointments */}
          <AnimatePresence>
            {processedAppointments.map((apt) => {
              const config = statusConfig[apt.status];
              const width = apt.totalColumns > 1 
                ? `${(100 / apt.totalColumns) - 2}%` 
                : '96%';
              const left = apt.totalColumns > 1
                ? `${(apt.column * (100 / apt.totalColumns)) + 1}%`
                : '2%';
              
              return (
                <motion.div
                  key={apt.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, x: -20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  whileHover={{ scale: 1.02, zIndex: 50 }}
                  drag="y"
                  dragControls={dragControls}
                  dragConstraints={scheduleRef}
                  dragElastic={0.2}
                  onDragEnd={(e, info) => {
                    const newTop = apt.top + info.offset.y;
                    const newSlotIndex = Math.round(newTop / (HOUR_HEIGHT / 4));
                    if (newSlotIndex >= 0 && newSlotIndex < timeSlots.length) {
                      handleAppointmentDrop(apt.id, timeSlots[newSlotIndex].time);
                    }
                  }}
                  className={`absolute cursor-pointer ${config.bgGradient} ${config.textColor} 
                    ${config.hoverBg} border-l-4 ${config.borderColor} rounded-r-lg shadow-md 
                    hover:shadow-xl transition-all duration-200 group p-3 overflow-hidden`}
                  style={{
                    top: `${apt.top}px`,
                    height: `${apt.height}px`,
                    width,
                    left,
                    minHeight: '50px',
                  }}
                  onClick={() => onView(apt)}
                >
                  <div className="h-full flex flex-col relative">
                    {/* Drag Handle */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-0.5">
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                      </div>
                      <div className="flex gap-0.5 mt-0.5">
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                      </div>
                    </div>

                    {/* Time and Status Icon */}
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <config.icon size={14} className="flex-shrink-0" />
                        <span className="text-xs font-bold">
                          {format(parseISO(`2000-01-01T${apt.time}`), 'h:mm a')}
                        </span>
                        {apt.conflictCount > 0 && (
                          <div className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                            {apt.conflictCount + 1} overlapping
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Patient Name and Age */}
                    <div className="mb-1">
                      <h4 className="font-semibold text-sm truncate">
                        {apt.patient.first_name} {apt.patient.last_name}
                      </h4>
                      {apt.patient.date_of_birth && apt.height > 55 && (
                        <div className="text-xs opacity-70 flex items-center gap-1">
                          <User size={10} />
                          <span>{calculateAge(apt.patient.date_of_birth)} years • {apt.patient.gender}</span>
                        </div>
                      )}
                    </div>

                    {/* Doctor and Type */}
                    {apt.height > 60 && (
                      <div className="space-y-0.5 text-xs opacity-80 mb-1">
                        {apt.doctor && (
                          <div className="flex items-center gap-1">
                            <Stethoscope size={11} />
                            <span className="truncate">{apt.doctor.full_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Info size={11} />
                          <span className="truncate font-medium">{apt.type}</span>
                        </div>
                        {apt.patient.cell_number && apt.height > 85 && (
                          <div className="flex items-center gap-1">
                            <Phone size={11} />
                            <span className="truncate">{apt.patient.cell_number}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Duration */}
                    {apt.height > 50 && (
                      <div className="text-xs opacity-70 flex items-center gap-1">
                        <Clock size={11} />
                        <span>{apt.duration} min</span>
                        <span className="mx-1">•</span>
                        <span>Until {getAppointmentEndTime(apt.time, apt.duration)}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {apt.status === 'scheduled' && apt.height > 80 && (
                      <div className="mt-auto pt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="primary"
                          className="flex-1 text-xs py-1 bg-white/20 hover:bg-white/30 backdrop-blur"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateAppointment(apt.id, { status: 'in-progress' });
                          }}
                        >
                          <CheckCircle2 size={12} className="mr-0.5" />
                          Check In
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs py-1 bg-white/20 hover:bg-white/30 backdrop-blur"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReschedule(apt);
                          }}
                        >
                          <RefreshCw size={12} className="mr-0.5" />
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs py-1 px-2 bg-white/20 hover:bg-red-100 backdrop-blur"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Cancel this appointment?')) {
                              onUpdateAppointment(apt.id, { status: 'cancelled' });
                            }
                          }}
                        >
                          <XCircle size={12} />
                        </Button>
                      </div>
                    )}

                    {/* Status Badge */}
                    {apt.height > 70 && (
                      <div className="absolute bottom-2 right-2">
                        <Badge 
                          variant={config.badgeVariant} 
                          size="sm"
                          className="text-xs shadow-sm"
                        >
                          {apt.status === 'in-progress' ? 'IN PROGRESS' : apt.status.toUpperCase()}
                        </Badge>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Current Time Indicator */}
          {isToday(date) && currentTimePosition !== null && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              className="absolute left-0 right-0 h-0.5 bg-red-500 z-40 pointer-events-none"
              style={{ top: `${currentTimePosition}px` }}
            >
              <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-lg" />
              <div className="absolute right-2 -top-3 bg-red-500 text-white text-xs px-2 py-0.5 rounded shadow-lg">
                {format(currentTime, 'h:mm a')}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Add Appointment Modal */}
      <FormModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedTimeSlot(null);
        }}
        title="Schedule New Appointment"
      >
        <AddAppointmentForm 
          initialDate={selectedTimeSlot?.date}
          initialTime={selectedTimeSlot?.time}
          onSuccess={() => {
            setIsAddModalOpen(false);
            setSelectedTimeSlot(null);
            // Refresh appointments
            window.location.reload();
          }}
        />
      </FormModal>

      {/* Reschedule Modal */}
      {selectedAppointment && (
        <RescheduleAppointmentModal
          isOpen={isRescheduleModalOpen}
          onClose={() => {
            setIsRescheduleModalOpen(false);
            setSelectedAppointment(null);
          }}
          appointment={{
            ...selectedAppointment,
            patient_name: `${selectedAppointment.patient.first_name} ${selectedAppointment.patient.last_name}`,
            doctor_name: selectedAppointment.doctor?.full_name || 'Unknown',
            doctor_id: selectedAppointment.doctor_id,
            appointment_type: selectedAppointment.type
          }}
          onReschedule={() => {
            setIsRescheduleModalOpen(false);
            setSelectedAppointment(null);
            // Refresh appointments
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default PremiumAppointmentSchedule;