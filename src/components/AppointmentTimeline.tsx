import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  MoreVertical,
} from 'lucide-react';
import {
  format,
  addDays,
  startOfWeek,
  addWeeks,
  subWeeks,
  parseISO,
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
import Button from './ui/Button';
import AppointmentActionModal from './modals/AppointmentActionModal';

// Constants
const START_HOUR = 8;
const END_HOUR = 20;
const SLOT_DURATION_MINUTES = 30;
const TOTAL_HOURS_DISPLAYED = END_HOUR - START_HOUR;
const TOTAL_GRID_ROWS = TOTAL_HOURS_DISPLAYED * (60 / SLOT_DURATION_MINUTES);
const SLOT_BASE_HEIGHT_REM = 6;

// Status Configuration
const statusConfig = {
  scheduled: {
    cardClasses: 'bg-slate-100/90 hover:bg-slate-200/80',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-400',
    iconForBadge: Clock,
    iconClass: 'text-slate-500',
    badgeClasses: 'bg-slate-200 text-slate-600'
  },
  confirmed: {
    cardClasses: 'bg-green-50/90 hover:bg-green-100/90',
    textClass: 'text-green-800',
    borderClass: 'border-green-500',
    iconForBadge: CheckCircle,
    iconClass: 'text-green-600',
    badgeClasses: 'bg-green-100 text-green-700'
  },
  'in-progress': {
    cardClasses: 'bg-purple-50/90 hover:bg-purple-100/90',
    textClass: 'text-purple-800',
    borderClass: 'border-purple-500',
    iconForBadge: Loader2,
    iconClass: 'text-purple-600 animate-spin',
    badgeClasses: 'bg-purple-100 text-purple-700'
  },
  completed: {
    cardClasses: 'bg-blue-50/90 hover:bg-blue-100/90',
    textClass: 'text-blue-800',
    borderClass: 'border-blue-400',
    iconForBadge: CheckCircle,
    iconClass: 'text-blue-600',
    badgeClasses: 'bg-blue-100 text-blue-700'
  },
  cancelled: {
    cardClasses: 'bg-red-50/90 hover:bg-red-100/90 opacity-75',
    textClass: 'text-red-700',
    borderClass: 'border-red-400',
    iconForBadge: XCircle,
    iconClass: 'text-red-600',
    badgeClasses: 'bg-red-100 text-red-700 line-through'
  },
  'no-show': {
    cardClasses: 'bg-fuchsia-50/90 hover:bg-fuchsia-100/90 opacity-85',
    textClass: 'text-fuchsia-700',
    borderClass: 'border-fuchsia-400',
    iconForBadge: AlertCircle,
    iconClass: 'text-fuchsia-600',
    badgeClasses: 'bg-fuchsia-100 text-fuchsia-700'
  }
};

export const AppointmentTimeline = ({ date, appointments, isLoading, error, onDateChange, onUpdateAppointment, onView, onMessagePatient, onCreateAppointment }) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timerId);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || !active.id || active.id === over.id) return;
    
    const appointmentId = active.id;
    const targetSlotTime = over.id;
    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) return;
    
    try {
      await onUpdateAppointment(appointment.id, { time: `${targetSlotTime}:00` });
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

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl shadow-lg overflow-hidden border border-gray-200/70">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-gray-200/70 bg-white/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          <Button variant="ghost" size="sm" onClick={() => onDateChange(subWeeks(date, 1))} className="p-1.5">
            <ChevronLeft size={20} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="flex items-center px-2 py-1.5">
            <CalendarIcon size={16} className="mr-1.5 text-blue-500" />
            <span className="font-medium">{format(date, 'MMM dd, EEEE')}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDateChange(addWeeks(date, 1))} className="p-1.5">
            <ChevronRight size={20} />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())}>Today</Button>
      </div>

      {/* Timeline Body */}
      <div className="flex-1 relative overflow-y-auto min-h-0">
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <div className="relative px-4 py-4 min-h-full">
            {/* Time slots */}
            {timeSlots.map((timeStr, i) => (
              <div
                key={timeStr}
                id={timeStr}
                className="relative border-t border-gray-200/60 group"
                style={{ height: `${SLOT_BASE_HEIGHT_REM}rem` }}
              >
                <span className="absolute -top-[9px] -left-2 bg-slate-50 px-1.5 text-[10px] text-gray-400 z-10 rounded">
                  {format(parseISO(`2000-01-01T${timeStr}:00`), 'h:mm a')}
                </span>
              </div>
            ))}

            {/* Appointments */}
            {filteredAppointments.map((appt) => {
              const [h, m] = appt.time.split(':').map(Number);
              const minutesFromStart = (h - START_HOUR) * 60 + m;
              const topPixels = (minutesFromStart / SLOT_DURATION_MINUTES) * SLOT_BASE_HEIGHT_REM * 16;
              const durationSlots = Math.max(1, Math.ceil(appt.duration / SLOT_DURATION_MINUTES));
              const styles = statusConfig[appt.status];
              
              return (
                <motion.div
                  key={appt.id}
                  id={appt.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`
                    absolute left-12 right-2
                    rounded-lg shadow-lg hover:shadow-xl p-3
                    border-l-4 cursor-pointer
                    ${styles.cardClasses} ${styles.borderClass}
                  `}
                  style={{
                    top: `${topPixels}px`,
                    height: `${durationSlots * SLOT_BASE_HEIGHT_REM * 16 - 8}px`,
                    zIndex: 20
                  }}
                  onClick={() => openActionModal(appt)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${styles.textClass}`}>
                        {appt.patient.first_name} {appt.patient.last_name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${styles.badgeClasses}`}>
                        {appt.status}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical size={14} />
                    </Button>
                  </div>

                  <div className="text-xs text-gray-600">
                    <div className="flex items-center">
                      <Clock size={12} className="mr-1" />
                      {format(parseISO(`2000-01-01T${appt.time}`), 'HH:mm')}
                      <span className="mx-1">•</span>
                      {appt.type}
                    </div>
                    {appt.doctor && (
                      <div className="mt-0.5">
                        <span className="text-gray-500">Dr. {appt.doctor.full_name}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </DndContext>
      </div>

      {/* Modals */}
      {selectedAppointment && (
        <AppointmentActionModal
          isOpen={isActionModalOpen}
          appointment={selectedAppointment}
          onClose={() => {
            setIsActionModalOpen(false);
            setSelectedAppointment(null);
          }}
          onStatusChange={async (status) => {
            if (!selectedAppointment) return;
            try {
              await onUpdateAppointment(selectedAppointment.id, { status });
              setIsActionModalOpen(false);
              setSelectedAppointment(null);
            } catch (err) {
              console.error(err);
            }
          }}
          onEdit={() => {
            onView(selectedAppointment);
            setIsActionModalOpen(false);
            setSelectedAppointment(null);
          }}
          onMessage={() => {
            if (onMessagePatient) {
              onMessagePatient(selectedAppointment);
            }
          }}
        />
      )}
    </div>
  );
};