import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  User,
  Briefcase,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2, // Using Loader2 for a different spinner style
  MessageSquare, // For message patient action
  Edit, // For edit action
  Eye, // For view action
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
  getHours,
  getMinutes,
  differenceInMinutes,
} from 'date-fns';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import Button from './ui/Button'; // Ensure this path is correct
import AppointmentActionModal from './modals/AppointmentActionModal'; // Ensure this path is correct

// --- Interfaces (assuming these are defined elsewhere if used broadly) ---
interface AppointmentPatient {
  first_name: string;
  last_name: string;
  // Consider adding patient_id if needed for messaging/viewing
}

interface AppointmentDoctor {
  full_name: string;
  // Consider adding doctor_id
}

export interface Appointment {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm:ss"
  duration: number; // in minutes
  type: string;
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  patient: AppointmentPatient;
  doctor?: AppointmentDoctor;
  notes?: string; // Important detail that might need space
}

interface AppointmentTimelineProps {
  date: Date;
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  onDateChange: (newDate: Date) => void;
  onUpdateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  onView: (appointment: Appointment) => void;
  onMessagePatient?: (appointment: Appointment) => void;
  // Optional: function to trigger creating a new appointment for a given slot
  onCreateAppointment?: (slotDate: Date, slotTime: string) => void;
}

// --- Constants ---
const START_HOUR = 8;
const END_HOUR = 20; // Display timeline up to 8 PM
const SLOT_DURATION_MINUTES = 30;
const TOTAL_HOURS_DISPLAYED = END_HOUR - START_HOUR;
const TOTAL_GRID_ROWS = TOTAL_HOURS_DISPLAYED * (60 / SLOT_DURATION_MINUTES);

// --- Styling Configuration ---
const statusConfig: Record<Appointment['status'], { cardClasses: string; textClass: string; borderClass: string; icon: React.ElementType; iconClass: string; badgeClass: string }> = {
  scheduled:   { cardClasses: 'bg-gray-50 hover:bg-gray-100', textClass: 'text-gray-700', borderClass: 'border-gray-400', icon: Clock, iconClass: 'text-gray-500', badgeClass: 'bg-gray-200 text-gray-700'},
  confirmed:   { cardClasses: 'bg-green-50 hover:bg-green-100', textClass: 'text-green-800', borderClass: 'border-green-500', icon: CheckCircle, iconClass: 'text-green-600', badgeClass: 'bg-green-200 text-green-800' },
  'in-progress':{ cardClasses: 'bg-amber-50 hover:bg-amber-100', textClass: 'text-amber-800', borderClass: 'border-amber-500', icon: Loader2, iconClass: 'text-amber-600 animate-spin', badgeClass: 'bg-amber-200 text-amber-800' },
  completed:   { cardClasses: 'bg-blue-50 hover:bg-blue-100', textClass: 'text-blue-800', borderClass: 'border-blue-400', icon: CheckCircle, iconClass: 'text-blue-600', badgeClass: 'bg-blue-200 text-blue-800' },
  cancelled:   { cardClasses: 'bg-red-50 hover:bg-red-100 opacity-80', textClass: 'text-red-700', borderClass: 'border-red-400', icon: XCircle, iconClass: 'text-red-600', badgeClass: 'bg-red-200 text-red-700 line-through' },
  'no-show':   { cardClasses: 'bg-purple-50 hover:bg-purple-100 opacity-90', textClass: 'text-purple-700', borderClass: 'border-purple-400', icon: AlertCircle, iconClass: 'text-purple-600', badgeClass: 'bg-purple-200 text-purple-700' },
};

// --- Main Component ---
export const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({
  date,
  appointments,
  isLoading,
  error,
  onDateChange,
  onUpdateAppointment,
  onView,
  onMessagePatient,
  onCreateAppointment,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timerId);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !active.id || active.id === over.id) return;
    const appointmentId = active.id as string;
    const targetSlotTime = over.id as string; // "HH:mm"

    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) return;

    const newTimeForStorage = `${targetSlotTime}:00`; // "HH:mm:ss"

    try {
      await onUpdateAppointment(appointment.id, { time: newTimeForStorage });
    } catch (err) {
      console.error("Failed to update appointment time:", err);
      // Consider adding user-facing error feedback (e.g., a toast notification)
    }
  };

  const timeSlots = useMemo(() => {
    return Array.from({ length: TOTAL_GRID_ROWS }).map((_, i) => {
      const totalMinutes = i * SLOT_DURATION_MINUTES;
      const hour = START_HOUR + Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      return format(setMinutes(setHours(new Date(0), hour), minute), 'HH:mm');
    });
  }, []);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => isSameDay(parseISO(a.date), date));
  }, [appointments, date]);

  const getAppointmentEndTime = (startTime: string, duration: number): string => {
    const [h, m] = startTime.split(':').map(Number);
    const startDate = setMinutes(setHours(new Date(0), h), m); // Use a fixed base date for time calculations
    const endDate = new Date(startDate.getTime() + duration * 60000);
    return format(endDate, 'HH:mm');
  };
  
  const handleSlotClick = (slotTime: string) => {
    if (onCreateAppointment) {
      const [h,m] = slotTime.split(':').map(Number);
      const slotFullDate = setMinutes(setHours(date, h), m);
      onCreateAppointment(slotFullDate, slotTime);
    }
  }


  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl shadow-2xl overflow-hidden border border-gray-200/80">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3.5 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center space-x-1.5 mb-2 sm:mb-0">
          <Button size="icon" variant="ghost" className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50" onClick={() => onDateChange(subDays(date, 1))} aria-label="Previous day">
            <ChevronLeft size={20} />
          </Button>
          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setIsCalendarOpen(v => !v)} className="flex items-center px-3 py-1.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md">
              <CalendarIcon size={18} className="mr-2 text-blue-600" />
              <span className="font-semibold text-sm md:text-base">
                {format(date, 'EEEE, dd MMM')}
              </span>
            </Button>
            {isCalendarOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-2xl p-1 z-[60]"
              >
                <DayPicker
                  mode="single"
                  selected={date}
                  onSelect={d => { if (d) { onDateChange(d); setIsCalendarOpen(false); }}}
                  showOutsideDays
                  fixedWeeks
                  className="text-sm"
                  classNames={{
                    day_selected: "bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700",
                    day_today: "font-bold text-blue-600",
                  }}
                />
              </motion.div>
            )}
          </div>
          <Button size="icon" variant="ghost" className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50" onClick={() => onDateChange(addDays(date, 1))} aria-label="Next day">
            <ChevronRight size={20} />
          </Button>
        </div>
        <Button size="sm" variant="default" onClick={() => onDateChange(new Date())} className="text-xs sm:text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white">
          Today
        </Button>
      </div>

      {/* Timeline Body */}
      <div className="flex-1 relative overflow-y-auto min-h-0" id="timeline-scroll-container">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 z-50 backdrop-blur-sm">
            <Loader2 size={40} className="text-blue-600 animate-spin mb-3" />
            <p className="text-gray-600 font-medium">Loading Appointments...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-40">
            <AlertCircle size={48} className="text-red-500 mb-3" />
            <p className="font-semibold text-red-700">Error Loading Appointments</p>
            <p className="text-sm text-gray-600 mt-1">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
          </div>
        )}
        {!isLoading && !error && filteredAppointments.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-6 text-center z-40">
            <CalendarIcon size={48} className="mb-3 opacity-70" />
            <p className="font-semibold text-gray-500">No Appointments for {format(date, 'dd MMM')}</p>
            <p className="text-sm text-gray-400 mt-1">You can create a new appointment by clicking on a time slot.</p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-[theme(spacing.16)_1fr] md:grid-cols-[theme(spacing.20)_1fr] p-3 sm:p-4 relative min-h-full"> {/* Ensure min-h-full for drop target */}
            {/* Time Labels & Grid Lines (Droppable Areas) */}
            {timeSlots.map((timeStr, i) => (
              <React.Fragment key={`timeslot-${timeStr}`}>
                <div className="row-start-[--row] col-start-1 text-right pr-2 sm:pr-3 -translate-y-1/2" style={{ '--row': i + 1 } as React.CSSProperties}>
                  <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{format(parseISO(`2000-01-01T${timeStr}:00`), 'h:mm a')}</span>
                </div>
                <div
                  id={timeStr} // Droppable ID
                  className="row-start-[--row] col-start-2 border-t border-gray-200/80 relative h-12 group" // h-12 (48px) for better touch targets and visual space
                  style={{ '--row': i + 1 } as React.CSSProperties}
                  onClickCapture={(e) => {
                    // Prevent click if dragging over, or handle specific logic
                    if (e.target === e.currentTarget && onCreateAppointment) {
                       handleSlotClick(timeStr);
                    }
                  }}
                >
                 {onCreateAppointment && <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-blue-500 text-xs cursor-pointer bg-blue-50/50 rounded"> Add </div>}
                </div>
              </React.Fragment>
            ))}

            {/* "Now" Indicator */}
            {isToday(date) && (() => {
              const nowTotalMinutes = getHours(currentTime) * 60 + getMinutes(currentTime);
              const startTotalMinutes = START_HOUR * 60;
              const minutesSinceStart = nowTotalMinutes - startTotalMinutes;
              if (minutesSinceStart >= 0 && minutesSinceStart <= TOTAL_HOURS_DISPLAYED * 60) {
                const topPercentage = (minutesSinceStart / (TOTAL_HOURS_DISPLAYED * 60)) * 100;
                return (
                  <div
                    className="absolute col-start-1 col-span-full left-0 right-0 h-0.5 bg-red-500 z-30 pointer-events-none shadow-md"
                    style={{ top: `${topPercentage}%` }}
                    aria-hidden="true"
                  >
                    <div className="absolute -left-[5px] -top-[5px] w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-xl" />
                  </div>
                );
              }
              return null;
            })()}

            {/* Appointments Rendering */}
            <AnimatePresence>
              {filteredAppointments.map(appt => {
                const [h, m] = appt.time.split(':').map(Number);
                const appointmentStartTotalMinutes = (h * 60 + m);
                const minutesFromTimelineStart = appointmentStartTotalMinutes - (START_HOUR * 60);

                if (minutesFromTimelineStart < 0 || minutesFromTimelineStart >= TOTAL_HOURS_DISPLAYED * 60) return null; // Not in visible range

                const startRowIndexBased = Math.floor(minutesFromTimelineStart / SLOT_DURATION_MINUTES);
                
                const durationSlots = Math.max(1, Math.ceil(appt.duration / SLOT_DURATION_MINUTES));
                
                const currentStyles = statusConfig[appt.status] || statusConfig.scheduled;
                const StatusIcon = currentStyles.icon;

                // Card height based on duration (h-12 per slot) minus small gap for visual separation
                const cardHeight = `calc(${durationSlots * 3}rem - 4px)`; // 3rem = 48px (h-12)

                return (
                  <motion.div
                    key={appt.id}
                    id={appt.id.toString()} // Draggable ID
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`
                      absolute col-start-2 left-1 right-1 md:left-1.5 md:right-1.5
                      rounded-lg shadow-lg p-2.5 sm:p-3 border-l-4
                      cursor-grab active:cursor-grabbing 
                      flex flex-col justify-between overflow-hidden
                      transition-all duration-150 ease-out
                      ${currentStyles.cardClasses} ${currentStyles.borderClass}
                    `}
                    style={{
                      top: `calc(${startRowIndexBased * 3}rem)`, // 3rem = 48px (h-12 for slot)
                      height: cardHeight,
                      zIndex: 20, // Above grid lines but below "Now" indicator if needed
                    }}
                    onClick={() => { setSelectedAppointment(appt); setIsActionModalOpen(true); }}
                  >
                    <div className="flex-grow min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`text-sm sm:text-base font-semibold ${currentStyles.textClass} truncate`}>
                          {appt.patient.first_name} {appt.patient.last_name}
                        </h3>
                        <StatusIcon size={16} className={`${currentStyles.iconClass} flex-shrink-0 ml-2`} />
                      </div>

                      <div className={`flex items-center text-xs ${currentStyles.textClass} opacity-90 mb-0.5`}>
                        <Clock size={13} className="mr-1.5 flex-shrink-0" />
                        <span className="truncate">{format(parseISO(`${appt.date}T${appt.time}`), 'HH:mm')} - {getAppointmentEndTime(appt.time, appt.duration)}</span>
                      </div>
                      
                      <div className={`flex items-center text-xs ${currentStyles.textClass} opacity-80 mb-1`}>
                        <Briefcase size={13} className="mr-1.5 flex-shrink-0" />
                        <span className="truncate">{appt.type}</span>
                      </div>

                      {appt.doctor && (
                        <div className={`flex items-center text-xs ${currentStyles.textClass} opacity-80`}>
                           <User size={13} className="mr-1.5 flex-shrink-0" />
                           <span className="truncate">Dr. {appt.doctor.full_name}</span>
                        </div>
                      )}
                       {appt.notes && appt.duration > 30 && ( // Show notes only if there's more space
                        <p className={`mt-1.5 text-[11px] leading-tight ${currentStyles.textClass} opacity-70 line-clamp-2`}>
                            Notes: {appt.notes}
                        </p>
                       )}
                    </div>
                    
                    <div className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wider self-start px-2 py-0.5 rounded ${currentStyles.badgeClass}`}>
                      {appt.status.replace('-', ' ')}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </DndContext>
      </div>

      {/* Appointment Action Modal */}
      {selectedAppointment && (
        <AppointmentActionModal
          isOpen={isActionModalOpen}
          appointment={selectedAppointment}
          onClose={() => { setIsActionModalOpen(false); setSelectedAppointment(null); }}
          // Assuming AppointmentActionModal takes these specific props
          onStatusChange={async (newStatus) => {
            if (!selectedAppointment) return;
            try {
              await onUpdateAppointment(selectedAppointment.id, { status: newStatus });
              setIsActionModalOpen(false); setSelectedAppointment(null);
            } catch (err) { console.error(err); /* Add toast */ }
          }}
          onEdit={() => { onView(selectedAppointment); setIsActionModalOpen(false); setSelectedAppointment(null); }}
          onMessage={() => { if (onMessagePatient) { onMessagePatient(selectedAppointment); /* Optionally close setIsActionModalOpen(false); */ } }}
          // You might want to pass other actions like onCancel, onReschedule etc.
        />
      )}
    </div>
  );
};