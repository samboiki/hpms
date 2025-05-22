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
  Loader2,
  MessageSquare,
  Edit,
  MoreVertical, // For a subtle action trigger on card
  StickyNote, // For notes
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
} from 'date-fns';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import Button from './ui/Button'; // Ensure this path is correct
import AppointmentActionModal from './modals/AppointmentActionModal'; // Ensure this path is correct

// --- Interfaces ---
interface AppointmentPatient {
  first_name: string;
  last_name: string;
}

interface AppointmentDoctor {
  full_name: string;
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
  notes?: string;
}

interface AppointmentTimelineProps {
  date: Date;
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  onDateChange: (newDate: Date) => void;
  onUpdateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  onView: (appointment: Appointment) => void; // For editing/detailed view
  onMessagePatient?: (appointment: Appointment) => void;
  onCreateAppointment?: (slotDate: Date, slotTime: string) => void;
}

// --- Constants ---
const START_HOUR = 8;
const END_HOUR = 20;
const SLOT_DURATION_MINUTES = 30;
const TOTAL_HOURS_DISPLAYED = END_HOUR - START_HOUR;
const TOTAL_GRID_ROWS = TOTAL_HOURS_DISPLAYED * (60 / SLOT_DURATION_MINUTES);
const SLOT_BASE_HEIGHT_REM = 4; // h-16 (64px) for each 30-min slot

// --- Styling Configuration ---
// Ensures "scheduled" is neutral gray, others are distinct.
const statusConfig: Record<Appointment['status'], { cardClasses: string; textClass: string; borderClass: string; icon: React.ElementType; iconClass: string; badgeClasses: string }> = {
  scheduled:   { cardClasses: 'bg-slate-50 hover:bg-slate-100', textClass: 'text-slate-700', borderClass: 'border-slate-400', icon: Clock, iconClass: 'text-slate-500', badgeClasses: 'bg-slate-200 text-slate-700'},
  confirmed:   { cardClasses: 'bg-green-50 hover:bg-green-100', textClass: 'text-green-800', borderClass: 'border-green-500', icon: CheckCircle, iconClass: 'text-green-600', badgeClasses: 'bg-green-100 text-green-700' },
  'in-progress':{ cardClasses: 'bg-amber-50 hover:bg-amber-100', textClass: 'text-amber-800', borderClass: 'border-amber-500', icon: Loader2, iconClass: 'text-amber-600 animate-spin', badgeClasses: 'bg-amber-100 text-amber-700' },
  completed:   { cardClasses: 'bg-blue-50 hover:bg-blue-100', textClass: 'text-blue-800', borderClass: 'border-blue-400', icon: CheckCircle, iconClass: 'text-blue-600', badgeClasses: 'bg-blue-100 text-blue-700' },
  cancelled:   { cardClasses: 'bg-red-50 hover:bg-red-100 opacity-80', textClass: 'text-red-700', borderClass: 'border-red-400', icon: XCircle, iconClass: 'text-red-600', badgeClasses: 'bg-red-100 text-red-700 line-through' },
  'no-show':   { cardClasses: 'bg-purple-50 hover:bg-purple-100 opacity-90', textClass: 'text-purple-700', borderClass: 'border-purple-400', icon: AlertCircle, iconClass: 'text-purple-600', badgeClasses: 'bg-purple-100 text-purple-700' },
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
    const startDate = setMinutes(setHours(new Date(0), h), m);
    const endDate = new Date(startDate.getTime() + duration * 60000);
    return format(endDate, 'HH:mm');
  };

  const handleSlotClick = (slotTime: string) => {
    if (onCreateAppointment) {
      const [h,m] = slotTime.split(':').map(Number);
      const slotFullDate = setMinutes(setHours(date, h), m);
      onCreateAppointment(slotFullDate, slotTime);
    }
  };

  const openActionModal = (appointment: Appointment, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent card click if clicking on action button
    setSelectedAppointment(appointment);
    setIsActionModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200/70">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200/70 bg-gray-50/50">
        <div className="flex items-center space-x-1.5">
          <Button size="icon" variant="ghost" className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full" onClick={() => onDateChange(subDays(date, 1))} aria-label="Previous day">
            <ChevronLeft size={20} />
          </Button>
          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setIsCalendarOpen(v => !v)} className="flex items-center px-3 py-1.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md">
              <CalendarIcon size={16} className="mr-2 text-blue-500" />
              <span className="font-medium text-sm md:text-[15px] whitespace-nowrap">
                {format(date, 'EEEE, dd MMM')}
              </span>
            </Button>
            {isCalendarOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-1.5 bg-white border border-gray-300 rounded-lg shadow-xl p-1 z-[60]"
              >
                <DayPicker
                  mode="single" selected={date} onSelect={d => { if (d) { onDateChange(d); setIsCalendarOpen(false); }}}
                  showOutsideDays fixedWeeks className="text-sm"
                  classNames={{
                    day_selected: "bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700 rounded-md",
                    day_today: "font-bold text-blue-600 rounded-md border border-blue-300",
                    button: "hover:bg-blue-50 rounded-md"
                  }}
                />
              </motion.div>
            )}
          </div>
          <Button size="icon" variant="ghost" className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full" onClick={() => onDateChange(addDays(date, 1))} aria-label="Next day">
            <ChevronRight size={20} />
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={() => onDateChange(new Date())} className="text-xs sm:text-sm px-3 py-1.5 border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600">
          Today
        </Button>
      </div>

      {/* Timeline Body */}
      <div className="flex-1 relative overflow-y-auto min-h-0" id="timeline-scroll-container">
        {isLoading && ( /* Loading State */ )}
        {error && !isLoading && ( /* Error State */ )}
        {!isLoading && !error && filteredAppointments.length === 0 && ( /* No Appointments State */ )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className={`grid grid-cols-[theme(spacing.14)_1fr] sm:grid-cols-[theme(spacing.16)_1fr] md:grid-cols-[theme(spacing.20)_1fr] p-3 sm:p-4 relative min-h-full gap-x-2 sm:gap-x-3`}>
            {/* Time Labels & Grid Lines (Droppable Areas) */}
            {timeSlots.map((timeStr, i) => (
              <React.Fragment key={`timeslot-${timeStr}`}>
                <div className="row-start-[--row] col-start-1 text-right -translate-y-1/2" style={{ '--row': i + 1 } as React.CSSProperties}>
                  <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{format(parseISO(`2000-01-01T${timeStr}:00`), 'h:mm a')}</span>
                </div>
                <div
                  id={timeStr}
                  className="row-start-[--row] col-start-2 border-t border-gray-200/70 relative group"
                  style={{ '--row': i + 1, height: `${SLOT_BASE_HEIGHT_REM}rem` } as React.CSSProperties}
                  onClickCapture={(e) => { if (e.target === e.currentTarget && onCreateAppointment) { handleSlotClick(timeStr); }}}
                >
                 {onCreateAppointment && <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-blue-500 text-xs cursor-pointer bg-blue-50/30 rounded hover:bg-blue-100/50"> Add Appt. </div>}
                </div>
              </React.Fragment>
            ))}

            {/* "Now" Indicator */}
            {isToday(date) && (() => { /* ... "Now" indicator logic remains similar ... */ })()}

            {/* Appointments Rendering */}
            <AnimatePresence>
              {filteredAppointments.map(appt => {
                const [h, m] = appt.time.split(':').map(Number);
                const appointmentStartTotalMinutes = (h * 60 + m);
                const minutesFromTimelineStart = appointmentStartTotalMinutes - (START_HOUR * 60);

                if (minutesFromTimelineStart < 0 || minutesFromTimelineStart >= TOTAL_HOURS_DISPLAYED * 60) return null;

                const startRowIndexBased = Math.floor(minutesFromTimelineStart / SLOT_DURATION_MINUTES);
                const durationSlots = Math.max(1, Math.ceil(appt.duration / SLOT_DURATION_MINUTES));
                
                const currentStyles = statusConfig[appt.status] || statusConfig.scheduled;
                const StatusIcon = currentStyles.icon;
                const cardHeight = `calc(${durationSlots * SLOT_BASE_HEIGHT_REM}rem - 4px)`;

                return (
                  <motion.div
                    key={appt.id} id={appt.id.toString()} layout
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`
                      absolute col-start-2 left-0.5 right-0.5 sm:left-1 sm:right-1
                      rounded-lg shadow-md hover:shadow-lg p-2 sm:p-2.5 border-l-[5px]
                      cursor-pointer active:cursor-grabbing 
                      flex flex-col justify-between overflow-hidden
                      transition-all duration-150 ease-out
                      ${currentStyles.cardClasses} ${currentStyles.borderClass}
                    `}
                    style={{
                      top: `calc(${startRowIndexBased * SLOT_BASE_HEIGHT_REM}rem)`,
                      height: cardHeight,
                      zIndex: 20 + startRowIndexBased, // Basic overlap management
                    }}
                    onClick={() => openActionModal(appt)}
                  >
                    <div className="flex flex-col flex-grow min-h-0 justify-between h-full"> {/* Ensure full height distribution */}
                        {/* Top part: Name & Action Button */}
                        <div className="flex items-start justify-between mb-1">
                            <h3 className={`text-xs sm:text-sm font-semibold ${currentStyles.textClass} truncate mr-1`}>
                                <StatusIcon size={14} className={`${currentStyles.iconClass} inline mr-1.5 mb-px`} />
                                {appt.patient.first_name} {appt.patient.last_name}
                            </h3>
                            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-gray-400 hover:text-blue-600" onClick={(e) => openActionModal(appt, e)}>
                                <MoreVertical size={14} />
                            </Button>
                        </div>

                        {/* Middle part: Details - this needs to be flexible */}
                        <div className="flex-grow space-y-0.5 text-[11px] sm:text-xs min-h-0 overflow-y-auto pr-0.5 custom-scrollbar-thin">
                            <div className={`flex items-center ${currentStyles.textClass} opacity-80`}>
                                <Clock size={12} className="mr-1 flex-shrink-0" />
                                <span className="truncate">{format(parseISO(`${appt.date}T${appt.time}`), 'HH:mm')} - {getAppointmentEndTime(appt.time, appt.duration)}</span>
                            </div>
                            
                            <div className={`flex items-center ${currentStyles.textClass} opacity-70`}>
                                <Briefcase size={12} className="mr-1 flex-shrink-0" />
                                <span className="truncate">{appt.type}</span>
                            </div>

                            {appt.doctor && (
                                <div className={`flex items-center ${currentStyles.textClass} opacity-70`}>
                                    <User size={12} className="mr-1 flex-shrink-0" />
                                    <span className="truncate">Dr. {appt.doctor.full_name}</span>
                                </div>
                            )}
                            {appt.notes && (
                                <div className={`flex items-start ${currentStyles.textClass} opacity-60 mt-0.5`}>
                                    <StickyNote size={12} className="mr-1 mt-px flex-shrink-0" />
                                    <p className="line-clamp-2 leading-tight">{appt.notes}</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Bottom part: Status Badge */}
                        <div className="mt-1 shrink-0">
                            <div className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wide self-start px-1.5 py-0.5 rounded-full inline-block ${currentStyles.badgeClasses}`}>
                                {appt.status.replace('-', ' ')}
                            </div>
                        </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </DndContext>
      </div>

      {selectedAppointment && ( /* Action Modal */ )}
    </div>
  );
};

// Add this to your global CSS or a Tailwind CSS plugin for custom scrollbars if desired:
/*
.custom-scrollbar-thin::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.custom-scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar-thin::-webkit-scrollbar-thumb {
  background: #cbd5e1; // cool-gray-300
  border-radius: 10px;
}
.custom-scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #94a3b8; // cool-gray-400
}
*/