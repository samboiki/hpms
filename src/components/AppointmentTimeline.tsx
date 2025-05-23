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
  Plus,
  XCircle,
  Loader2,
  MoreVertical,
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
  onView: (appointment: Appointment) => void;
  onMessagePatient?: (appointment: Appointment) => void;
  onCreateAppointment?: (slotDate: Date, slotTime: string) => void;
}

// --- Constants ---
const START_HOUR = 8;
const END_HOUR = 20;
const SLOT_DURATION_MINUTES = 30;
const TOTAL_HOURS_DISPLAYED = END_HOUR - START_HOUR;
const TOTAL_GRID_ROWS = TOTAL_HOURS_DISPLAYED * (60 / SLOT_DURATION_MINUTES);
const SLOT_BASE_HEIGHT_REM = 7; // Increased for more space between appointments

// --- Styling Configuration ---
const statusConfig: Record<Appointment['status'], { cardClasses: string; textClass: string; borderClass: string; iconForBadge: React.ElementType; iconClass: string; badgeClasses: string }> = {
  scheduled:   { cardClasses: 'bg-slate-100 hover:bg-slate-200/80', textClass: 'text-slate-700', borderClass: 'border-slate-400', iconForBadge: Clock, iconClass: 'text-slate-500', badgeClasses: 'bg-slate-200 text-slate-600'},
  confirmed:   { cardClasses: 'bg-green-50 hover:bg-green-100', textClass: 'text-green-800', borderClass: 'border-green-500', iconForBadge: CheckCircle, iconClass: 'text-green-600', badgeClasses: 'bg-green-100 text-green-700' },
  'in-progress':{ cardClasses: 'bg-purple-50 hover:bg-purple-100', textClass: 'text-purple-800', borderClass: 'border-purple-500', iconForBadge: Loader2, iconClass: 'text-purple-600 animate-spin', badgeClasses: 'bg-purple-100 text-purple-700' },
  completed:   { cardClasses: 'bg-blue-50 hover:bg-blue-100', textClass: 'text-blue-800', borderClass: 'border-blue-400', iconForBadge: CheckCircle, iconClass: 'text-blue-600', badgeClasses: 'bg-blue-100 text-blue-700' },
  cancelled:   { cardClasses: 'bg-red-50 hover:bg-red-100 opacity-75', textClass: 'text-red-700', borderClass: 'border-red-400', iconForBadge: XCircle, iconClass: 'text-red-600', badgeClasses: 'bg-red-100 text-red-700 line-through' },
  'no-show':   { cardClasses: 'bg-fuchsia-50 hover:bg-fuchsia-100 opacity-85', textClass: 'text-fuchsia-700', borderClass: 'border-fuchsia-400', iconForBadge: AlertCircle, iconClass: 'text-fuchsia-600', badgeClasses: 'bg-fuchsia-100 text-fuchsia-700' },
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
    const targetSlotTime = over.id as string;
    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) return;
    const newTimeForStorage = `${targetSlotTime}:00`;
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
    e?.stopPropagation();
    setSelectedAppointment(appointment);
    setIsActionModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl shadow-lg overflow-hidden border border-gray-200/70">
      {/* Header Section */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-gray-200/70 bg-white/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          <Button size="icon" variant="ghost" className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" onClick={() => onDateChange(subDays(date, 1))} aria-label="Previous day">
            <ChevronLeft size={20} />
          </Button>
          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setIsCalendarOpen(v => !v)} className="flex items-center px-2 py-1.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors">
              <CalendarIcon size={16} className="mr-1.5 text-blue-500" />
              <span className="font-medium text-xs xxs:text-sm md:text-[15px] whitespace-nowrap">
                {format(date, 'MMM dd, EEEE')}
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
          <Button size="icon" variant="ghost" className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" onClick={() => onDateChange(addDays(date, 1))} aria-label="Next day">
            <ChevronRight size={20} />
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={() => onDateChange(new Date())} className="text-xs sm:text-sm px-2.5 py-1 sm:py-1.5 border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors">
          Today
        </Button>
      </div>

      {/* Timeline Body */}
      <div className="flex-1 relative overflow-y-auto min-h-0" id="timeline-scroll-container">
        {isLoading && ( 
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50 backdrop-blur-sm"
          >
            <Loader2 size={40} className="text-blue-600 animate-spin mb-3" />
            <p className="text-gray-600 font-medium">Loading...</p>
          </motion.div> 
        )}
        
        {error && !isLoading && ( 
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-40">
            <AlertCircle size={48} className="text-red-500 mb-3" />
            <p className="font-semibold text-red-700">Error</p>
            <p className="text-sm text-gray-600 mt-1">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-4">Retry</Button>
          </div> 
        )}
        
        {!isLoading && !error && filteredAppointments.length === 0 && ( 
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-6 text-center z-10">
            <CalendarIcon size={48} className="mb-3 opacity-70" />
            <p className="font-semibold text-gray-500">No Appointments</p>
            {onCreateAppointment && <p className="text-sm text-gray-400 mt-1">Click a time slot to create one.</p>}
          </div> 
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
          <div className="relative px-2 sm:px-3 md:px-4 py-4 min-h-full">
            {timeSlots.map((timeStr, i) => (
              <div
                key={`timeslot-${timeStr}`}
                id={timeStr}
                className="relative border-t border-gray-200/60 group"
                style={{ height: `${SLOT_BASE_HEIGHT_REM}rem` }}
                onClickCapture={(e) => { if (e.target === e.currentTarget && onCreateAppointment) { handleSlotClick(timeStr); }}}
              >
                <span className="absolute -top-[9px] left-0 sm:left-0.5 bg-slate-50 px-1.5 text-[9px] sm:text-[10px] text-gray-400 z-10 rounded">
                  {format(parseISO(`2000-01-01T${timeStr}:00`), 'h:mm a')}
                </span>
                {onCreateAppointment && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute inset-0 opacity-0 flex items-center justify-center text-blue-500 text-xs cursor-pointer bg-blue-50/30 rounded hover:bg-blue-100/50 transition-all duration-300"
                  >
                    <Plus size={16} className="mr-1" /> Add Appointment
                  </motion.div>
                )}
              </div>
            ))}

            {isToday(date) && (() => {
              const nowTotalMinutes = getHours(currentTime) * 60 + getMinutes(currentTime);
              const startTotalMinutes = START_HOUR * 60;
              const minutesSinceStart = nowTotalMinutes - startTotalMinutes;
              if (minutesSinceStart >= 0 && minutesSinceStart <= TOTAL_HOURS_DISPLAYED * 60) {
                const topPercentage = (minutesSinceStart / (TOTAL_HOURS_DISPLAYED * 60)) * 100;
                return (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5 }}
                    className="absolute left-0 right-0 h-0.5 bg-red-500 z-30 pointer-events-none"
                    style={{ top: `${topPercentage}%` }}
                    aria-hidden="true"
                  >
                    <div className="absolute left-0 -top-[5px] w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-md" />
                  </motion.div>
                );
              }
              return null;
             })()}

            <AnimatePresence>
              {filteredAppointments.map(appt => {
                const [h, m] = appt.time.split(':').map(Number);
                const appointmentStartTotalMinutes = (h * 60 + m);
                const minutesFromTimelineStart = appointmentStartTotalMinutes - (START_HOUR * 60);

                if (minutesFromTimelineStart < 0 || minutesFromTimelineStart >= TOTAL_HOURS_DISPLAYED * 60) return null;

                const startPixelOffset = (minutesFromTimelineStart / SLOT_DURATION_MINUTES) * SLOT_BASE_HEIGHT_REM * 16;
                const durationSlots = Math.max(1, Math.ceil(appt.duration / SLOT_DURATION_MINUTES));
                
                const currentStyles = statusConfig[appt.status] || statusConfig.scheduled;
                const cardHeight = `calc(${durationSlots * SLOT_BASE_HEIGHT_REM}rem - 12px)`;

                return (
                  <motion.div
                    key={appt.id} id={appt.id.toString()} layout
                    initial={{ opacity: 0, y: 10, scale:0.98 }} 
                    animate={{ opacity: 1, y: 0, scale:1 }} 
                    exit={{ opacity: 0, y: -10, scale:0.98 }}
                    whileHover={{ scale: 1.02, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`
                      absolute left-1 right-1 sm:left-1.5 sm:right-1.5 md:left-2 md:right-2 
                      rounded-lg shadow-lg p-2.5 md:p-3 border-l-4
                      cursor-pointer active:cursor-grabbing 
                      flex flex-col overflow-hidden 
                      ${currentStyles.cardClasses} ${currentStyles.borderClass}
                    `}
                    style={{
                      top: `calc(${startPixelOffset}px + 6px)`,
                      height: cardHeight,
                      zIndex: 20 + Math.floor(minutesFromTimelineStart / SLOT_DURATION_MINUTES),
                    }}
                    onClick={() => openActionModal(appt)}
                  >
                    {/* Card Content - Simplified for clarity */}
                    <div className="flex items-start justify-between mb-1">
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-sm sm:text-base font-semibold ${currentStyles.textClass} leading-tight truncate`}>
                          {appt.patient.first_name} {appt.patient.last_name}
                        </h3>
                        <div className={`flex items-center text-xs ${currentStyles.textClass} opacity-90 mt-0.5`}>
                          <Clock size={12} className="mr-1 flex-shrink-0" />
                          <span>{format(parseISO(`${appt.date}T${appt.time}`), 'HH:mm')} - {getAppointmentEndTime(appt.time, appt.duration)}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1 text-gray-400 hover:text-blue-600 flex-shrink-0" onClick={(e) => openActionModal(appt, e)}>
                        <MoreVertical size={15} />
                      </Button>
                    </div>
                    
                    {/* Doctor Name - Prominently displayed */}
                    {appt.doctor && (
                      <div className={`flex items-center ${currentStyles.textClass} opacity-90 font-medium text-xs sm:text-sm`}>
                        <User size={12} className="mr-1 flex-shrink-0" />
                        <span className="truncate">Dr. {appt.doctor.full_name}</span>
                      </div>
                    )}
                    
                    {/* Type - Simplified */}
                    <div className={`flex items-center ${currentStyles.textClass} opacity-80 text-[10px] xxs:text-[11px] mt-0.5`}>
                      <Briefcase size={12} className="mr-1 flex-shrink-0" />
                      <span className="truncate">{appt.type}</span>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="mt-auto pt-1.5">
                      <div className={`text-[8px] xxs:text-[9px] sm:text-[10px] font-bold uppercase tracking-wider self-start px-1.5 py-0.5 rounded-full inline-flex items-center ${currentStyles.badgeClasses}`}>
                        <currentStyles.iconForBadge size={10} className={`${currentStyles.iconClass} mr-1`} />
                        {appt.status.replace('-', ' ')}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </DndContext>
      </div>

      {selectedAppointment && (
        <AppointmentActionModal
          isOpen={isActionModalOpen}
          appointment={selectedAppointment}
          onClose={() => { setIsActionModalOpen(false); setSelectedAppointment(null); }}
          onStatusChange={async (newStatus) => {
            if (!selectedAppointment) return;
            try {
              await onUpdateAppointment(selectedAppointment.id, { status: newStatus });
              setIsActionModalOpen(false); setSelectedAppointment(null);
            } catch (err) { console.error(err); }
          }}
          onEdit={() => { onView(selectedAppointment); setIsActionModalOpen(false); setSelectedAppointment(null); }}
          onMessage={() => { if (onMessagePatient) { onMessagePatient(selectedAppointment); } }}
        />
      )}
    </div>
  );
};