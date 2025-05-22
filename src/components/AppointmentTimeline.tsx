import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  User,
  Briefcase,
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
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css'; // Ensure this is imported in your main app or here
import Button from './ui/Button'; // Assuming Button component exists
import AppointmentActionModal from './modals/AppointmentActionModal'; // Assuming Modal exists

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
  time: string; // "HH:mm:ss" -> We'll primarily use HH:mm for display
  duration: number; // in minutes
  type: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'in-progress' | 'no-show';
  patient: AppointmentPatient;
  doctor?: AppointmentDoctor;
  notes?: string; // Added for completeness
}

interface AppointmentTimelineProps {
  date: Date;
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  onDateChange: (newDate: Date) => void;
  onUpdateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  onView: (appointment: Appointment) => void; // For editing or detailed view
  onMessagePatient?: (appointment: Appointment) => void;
}

const START_HOUR = 8;
const END_HOUR = 20; // Display timeline up to 8 PM to accommodate slots ending late
const SLOT_DURATION_MINUTES = 30;
const TOTAL_HOURS_DISPLAYED = END_HOUR - START_HOUR;
const TOTAL_SLOTS_PER_HOUR = 60 / SLOT_DURATION_MINUTES;
const TOTAL_GRID_ROWS = TOTAL_HOURS_DISPLAYED * TOTAL_SLOTS_PER_HOUR;

// Status styling configuration
const statusConfig: Record<Appointment['status'], { base: string; text: string; border: string; iconColor: string }> = {
  scheduled:   { base: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-500',   iconColor: 'text-blue-500' },
  confirmed:   { base: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-500',  iconColor: 'text-green-500' },
  'in-progress':{ base: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-500',  iconColor: 'text-amber-500' },
  completed:   { base: 'bg-gray-100',  text: 'text-gray-700',   border: 'border-gray-400',   iconColor: 'text-gray-500' },
  cancelled:   { base: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-500',    iconColor: 'text-red-500' },
  'no-show':   { base: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-500', iconColor: 'text-purple-500'},
};

export const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({
  date,
  appointments,
  isLoading,
  error,
  onDateChange,
  onUpdateAppointment,
  onView,
  onMessagePatient,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timerId);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !active.id || active.id === over.id) return;

    const appointment = appointments.find(a => a.id === active.id);
    if (!appointment) return;

    // over.id is the target slot time string "HH:mm"
    const newTimeStr = over.id as string;
    const newTimeForStorage = `${newTimeStr}:00`; // Assuming storage needs "HH:mm:ss"

    try {
      await onUpdateAppointment(appointment.id, { time: newTimeForStorage });
    } catch (err) {
      console.error("Failed to update appointment time:", err);
      // TODO: Add user-facing error feedback
    }
  };
  
  const timeSlots = useMemo(() => {
    return Array.from({ length: TOTAL_GRID_ROWS }).map((_, i) => {
      const totalMinutes = i * SLOT_DURATION_MINUTES;
      const hour = START_HOUR + Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      return format(setMinutes(setHours(new Date(), hour), minute), 'HH:mm');
    });
  }, []);


  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => isSameDay(parseISO(a.date), date));
  }, [appointments, date]);

  const getAppointmentEndTime = (startTime: string, duration: number): string => {
    const [h, m] = startTime.split(':').map(Number);
    const startDate = setMinutes(setHours(new Date(), h), m);
    const endDate = new Date(startDate.getTime() + duration * 60000);
    return format(endDate, 'HH:mm');
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsActionModalOpen(true);
  };
  
  const handleStatusUpdateInModal = async (status: Appointment['status']) => {
    if (!selectedAppointment) return;
    try {
      await onUpdateAppointment(selectedAppointment.id, { status });
      setIsActionModalOpen(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Failed to update appointment status:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
      {/* Header Section */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" className="p-2" onClick={() => onDateChange(subDays(date, 1))} aria-label="Previous day">
            <ChevronLeft size={18} />
          </Button>
          <div className="relative">
            <Button size="sm" variant="outline" onClick={() => setIsCalendarOpen(v => !v)} className="flex items-center whitespace-nowrap">
              <CalendarIcon size={16} className="mr-2 text-blue-600" />
              <span className="font-semibold text-gray-700 text-sm sm:text-base">
                {format(date, 'EEEE, dd MMM yyyy')}
              </span>
            </Button>
            {isCalendarOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl p-2 z-50"
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
                  showOutsideDays
                  fixedWeeks
                />
              </motion.div>
            )}
          </div>
          <Button size="sm" variant="outline" className="p-2" onClick={() => onDateChange(addDays(date, 1))} aria-label="Next day">
            <ChevronRight size={18} />
          </Button>
        </div>
        {/* Potential actions: Add new appointment button? */}
      </div>

      {/* Timeline Body */}
      <div className="flex-1 relative overflow-y-auto min-h-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-30">
            <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-600 p-8">
            <Users size={48} className="mb-3"/>
            <p className="font-semibold">Error loading appointments</p>
            <p className="text-sm text-center">{error}</p>
          </div>
        )}
        {!isLoading && !error && filteredAppointments.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8">
            <CalendarIcon size={48} className="mb-3"/>
            <p className="font-semibold">No appointments scheduled</p>
            <p className="text-sm">Try a different date or add a new appointment.</p>
          </div>
        )}

        <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-[max-content,1fr] p-4 sm:p-6 relative">
            {/* Time Labels & Grid Lines */}
            {timeSlots.map((timeStr, i) => (
              <React.Fragment key={`timeslot-${timeStr}`}>
                <div className="row-start-[--row] col-start-1 pr-3 sm:pr-4 text-right -mt-2.5" style={{ '--row': i + 1 } as React.CSSProperties}>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{format(parseISO(`2000-01-01T${timeStr}:00`), 'h:mm a')}</span>
                </div>
                <div 
                  id={timeStr} // ID for dnd-kit droppable area
                  className="row-start-[--row] col-start-2 border-t border-dashed border-gray-200 relative h-10" // h-10 = 40px, min height for a 30min slot
                  style={{ '--row': i + 1 } as React.CSSProperties}
                />
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
                    className="absolute col-start-1 col-span-2 left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
                    style={{ top: `${topPercentage}%` }}
                  >
                    <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                  </div>
                );
              }
              return null;
            })()}

            {/* Appointments Rendering */}
            <AnimatePresence>
              {filteredAppointments.map(appt => {
                const [h, m] = appt.time.split(':').map(Number);
                const appointmentStartMinutes = (h - START_HOUR) * 60 + m;
                const startRowIndex = Math.floor(appointmentStartMinutes / SLOT_DURATION_MINUTES);
                
                // Ensure appointment doesn't start before timeline or isn't valid
                if (startRowIndex < 0 || appointmentStartMinutes < 0) return null;

                const durationSlots = Math.max(1, Math.ceil(appt.duration / SLOT_DURATION_MINUTES));
                const topOffset = (appointmentStartMinutes % SLOT_DURATION_MINUTES) / SLOT_DURATION_MINUTES; // For sub-slot precision if needed, not used here
                
                const currentStatusStyle = statusConfig[appt.status] || statusConfig.scheduled;

                // Card height based on duration, min 1 slot height (h-10, 40px)
                // Multiply by slot height and subtract small amount for border/spacing
                const cardHeight = `calc(${durationSlots * 2.5}rem - 2px)`; // 2.5rem = 40px (h-10 for slot)

                return (
                  <motion.div
                    key={appt.id}
                    id={appt.id.toString()} // ID for dnd-kit draggable
                    layout // Animate layout changes
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={`
                      absolute col-start-2 ml-1 mr-1 sm:ml-2 sm:mr-2 
                      rounded-md shadow-lg p-2 sm:p-3 border-l-4
                      cursor-pointer hover:shadow-xl transition-shadow duration-200
                      flex flex-col justify-between overflow-hidden
                      ${currentStatusStyle.base} ${currentStatusStyle.border}
                    `}
                    style={{
                      top: `calc(${startRowIndex * 2.5}rem)`, // 2.5rem = 40px
                      height: cardHeight,
                      // Width is handled by ml/mr and parent grid
                    }}
                    onClick={() => handleAppointmentClick(appt)}
                  >
                    <div className="flex-grow min-w-0"> {/* For truncation */}
                      <h3 className={`text-xs sm:text-sm font-semibold ${currentStatusStyle.text} truncate`}>
                        {appt.patient.first_name} {appt.patient.last_name}
                      </h3>
                      <div className={`mt-0.5 flex items-center text-xs ${currentStatusStyle.text} opacity-80`}>
                        <Clock size={12} className="mr-1 flex-shrink-0" />
                        <span className="truncate">{format(parseISO(`${appt.date}T${appt.time}`), 'HH:mm')} - {getAppointmentEndTime(appt.time, appt.duration)}</span>
                      </div>
                       <p className={`text-xs ${currentStatusStyle.text} opacity-70 truncate`}>{appt.type}</p>
                      {appt.doctor && (
                        <div className={`mt-0.5 flex items-center text-xs ${currentStatusStyle.text} opacity-70`}>
                           <User size={12} className="mr-1 flex-shrink-0" />
                           <span className="truncate">Dr. {appt.doctor.full_name}</span>
                        </div>
                      )}
                    </div>
                    <div className={`mt-1 text-[10px] sm:text-xs font-medium uppercase tracking-wider self-start px-1.5 py-0.5 rounded-sm ${currentStatusStyle.text} ${currentStatusStyle.base === 'bg-gray-100' ? 'bg-gray-200' : currentStatusStyle.base.replace('-50', '-100')}`}>
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
          onClose={() => {
            setIsActionModalOpen(false);
            setSelectedAppointment(null); // Deselect after close
          }}
          onStatusChange={handleStatusUpdateInModal}
          onEdit={() => {
            onView(selectedAppointment);
            setIsActionModalOpen(false); // Close modal before navigating to edit
            setSelectedAppointment(null);
          }}
          onMessage={() => {
            if (onMessagePatient) {
              onMessagePatient(selectedAppointment);
              // Optionally close modal after messaging
            }
          }}
        />
      )}
    </div>
  );
};