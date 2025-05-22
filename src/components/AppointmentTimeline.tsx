import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  User, Briefcase, AlertCircle, CheckCircle2, XCircle, Loader2, MoreVertical,
} from 'lucide-react';
import {
  format, addWeeks, subWeeks, parseISO, isToday, isSameDay,
  setHours, setMinutes, getHours, getMinutes,
} from 'date-fns';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import Button from './ui/Button';
import AppointmentActionModal from './modals/AppointmentActionModal';

const START_HOUR = 8;
const END_HOUR = 20;
const SLOT_DURATION_MINUTES = 30;
const TOTAL_HOURS_DISPLAYED = END_HOUR - START_HOUR;
const TOTAL_GRID_ROWS = TOTAL_HOURS_DISPLAYED * (60 / SLOT_DURATION_MINUTES);
const SLOT_BASE_HEIGHT_REM = 5;

const statusConfig = {
  scheduled: {
    cardClasses: 'bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200',
    textClass: 'text-slate-700',
    borderClass: 'border-l-4 border-slate-400',
    iconForBadge: Clock,
    iconClass: 'text-slate-500',
    badgeClasses: 'bg-slate-200 text-slate-600',
  },
  confirmed: {
    cardClasses: 'bg-gradient-to-br from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100',
    textClass: 'text-emerald-800',
    borderClass: 'border-l-4 border-emerald-500',
    iconForBadge: CheckCircle2,
    iconClass: 'text-emerald-600',
    badgeClasses: 'bg-emerald-100 text-emerald-700',
  },
  'in-progress': {
    cardClasses: 'bg-gradient-to-br from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100',
    textClass: 'text-purple-800',
    borderClass: 'border-l-4 border-purple-500',
    iconForBadge: Loader2,
    iconClass: 'text-purple-600 animate-spin',
    badgeClasses: 'bg-purple-100 text-purple-700',
  },
  completed: {
    cardClasses: 'bg-gradient-to-br from-blue-50 to-sky-50 hover:from-blue-100 hover:to-sky-100',
    textClass: 'text-blue-800',
    borderClass: 'border-l-4 border-blue-500',
    iconForBadge: CheckCircle2,
    iconClass: 'text-blue-600',
    badgeClasses: 'bg-blue-100 text-blue-700',
  },
  cancelled: {
    cardClasses: 'bg-gradient-to-br from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 opacity-75',
    textClass: 'text-red-700',
    borderClass: 'border-l-4 border-red-400',
    iconForBadge: XCircle,
    iconClass: 'text-red-600',
    badgeClasses: 'bg-red-100 text-red-700 line-through',
  },
  'no-show': {
    cardClasses: 'bg-gradient-to-br from-fuchsia-50 to-pink-50 hover:from-fuchsia-100 hover:to-pink-100 opacity-85',
    textClass: 'text-fuchsia-700',
    borderClass: 'border-l-4 border-fuchsia-400',
    iconForBadge: AlertCircle,
    iconClass: 'text-fuchsia-600',
    badgeClasses: 'bg-fuchsia-100 text-fuchsia-700',
  },
};

export function AppointmentTimeline({
  date, appointments, isLoading, error, onDateChange, onUpdateAppointment, onView, onMessagePatient, onCreateAppointment,
}) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  useEffect(() => {
    const tid = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(tid);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const timeSlots = useMemo(() => (
    Array.from({ length: TOTAL_GRID_ROWS }).map((_, i) => {
      const totalMinutes = i * SLOT_DURATION_MINUTES;
      const hour = START_HOUR + Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      return format(setMinutes(setHours(new Date(0), hour), minute), 'HH:mm');
    })
  ), []);

  const filteredAppointments = useMemo(() =>
    appointments.filter(a => isSameDay(parseISO(a.date), date)), [appointments, date]
  );

  const getAppointmentEndTime = (startTime, duration) => {
    const [h, m] = startTime.split(':').map(Number);
    const startDate = setMinutes(setHours(new Date(0), h), m);
    const endDate = new Date(startDate.getTime() + duration * 60000);
    return format(endDate, 'h:mm a');
  };

  const handleSlotClick = (slotTime) => {
    if (onCreateAppointment) {
      const [h, m] = slotTime.split(':').map(Number);
      const slotFullDate = setMinutes(setHours(date, h), m);
      onCreateAppointment(slotFullDate, slotTime);
    }
  };

  const openActionModal = (appointment, e) => {
    e?.stopPropagation();
    setSelectedAppointment(appointment);
    setIsActionModalOpen(true);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || !active.id || active.id === over.id) return;
    const appointmentId = active.id;
    const targetSlotTime = over.id;
    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) return;
    try {
      await onUpdateAppointment(appointment.id, { time: `${targetSlotTime}:00` });
    } catch (err) { }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl shadow-lg overflow-hidden border border-gray-200/70">
      <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-gray-200/70 bg-white shadow-sm sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <Button size="icon" variant="ghost" className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full" onClick={() => onDateChange(subWeeks(date, 1))}>
            <ChevronLeft size={20} />
          </Button>
          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setIsCalendarOpen(v => !v)} className="flex items-center px-3 py-1.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md">
              <CalendarIcon size={16} className="mr-2 text-blue-500" />
              <span className="font-medium" style={{ fontSize: 30, color: '#494c61' }}>
                {format(date, 'MMM dd, EEEE')}
              </span>
            </Button>
            {isCalendarOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-1.5 bg-white border border-gray-200 rounded-lg shadow-xl p-1 z-[60]"
              >
                <DayPicker
                  mode="single"
                  selected={date}
                  onSelect={d => { if (d) { onDateChange(d); setIsCalendarOpen(false); } }}
                  showOutsideDays
                  fixedWeeks
                  className="text-sm"
                  classNames={{
                    day_selected: "bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700 rounded-md",
                    day_today: "font-bold text-blue-600 rounded-md border border-blue-300",
                    button: "hover:bg-blue-50 rounded-md"
                  }}
                />
              </motion.div>
            )}
          </div>
          <Button size="icon" variant="ghost" className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full" onClick={() => onDateChange(addWeeks(date, 1))}>
            <ChevronRight size={20} />
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={() => onDateChange(new Date())} className="text-xs sm:text-sm px-2.5 py-1 sm:py-1.5 border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600">
          Today
        </Button>
      </div>
      <div className="flex-1 relative overflow-y-auto min-h-0 custom-scrollbar" id="timeline-scroll-container">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50 backdrop-blur-sm">
            <Loader2 size={40} className="text-blue-600 animate-spin mb-3" />
            <p className="text-gray-600 font-medium">Loading...</p>
          </div>
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
          <div className="relative px-4 py-4 min-h-full">
            {timeSlots.map((timeStr, i) => (
              <div
                key={`timeslot-${timeStr}`}
                id={timeStr}
                className="relative border-t border-gray-200/60 group"
                style={{ height: `${SLOT_BASE_HEIGHT_REM}rem` }}
                onClickCapture={(e) => {
                  if (e.target === e.currentTarget && onCreateAppointment) {
                    handleSlotClick(timeStr);
                  }
                }}
              >
                <span className="absolute -top-[9px] left-0 bg-gradient-to-br from-slate-50 to-gray-50 px-2 text-[10px] font-medium text-gray-400 z-10 rounded">
                  {format(parseISO(`2000-01-01T${timeStr}:00`), 'h:mm a')}
                </span>
                {onCreateAppointment && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-blue-500 text-xs cursor-pointer bg-blue-50/30 rounded hover:bg-blue-100/50">
                    Add
                  </div>
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
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-red-500 z-30 pointer-events-none"
                    style={{ top: `${topPercentage}%` }}
                    aria-hidden="true"
                  >
                    <div className="absolute left-0 -top-[5px] w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-md" />
                  </div>
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
                const cardHeight = `calc(${durationSlots * SLOT_BASE_HEIGHT_REM}rem - 8px)`;
                return (
                  <motion.div
                    key={appt.id}
                    id={appt.id.toString()}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`
                      absolute ml-28 right-4
                      rounded-lg shadow-lg hover:shadow-xl p-4
                      cursor-pointer active:cursor-grabbing
                      flex flex-col overflow-hidden
                      transition-all duration-200 ease-out
                      backdrop-blur-sm
                      ${currentStyles.cardClasses} ${currentStyles.borderClass}
                    `}
                    style={{
                      top: `calc(${startPixelOffset}px + 4px)`,
                      height: cardHeight,
                      zIndex: 20 + Math.floor(minutesFromTimelineStart / SLOT_DURATION_MINUTES),
                      minWidth: "240px",
                      maxWidth: "360px"
                    }}
                    onClick={() => openActionModal(appt)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <User size={18} className="text-blue-400" />
                      <div className="font-semibold text-[#494c61] text-[18px] truncate">
                        {appt.patient.first_name} {appt.patient.last_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-[2px]">
                      <Clock size={14} className="text-gray-400" />
                      {format(parseISO(`${appt.date}T${appt.time}`), 'h:mm a')} - {getAppointmentEndTime(appt.time, appt.duration)}
                    </div>
                    <div className="flex items-center gap-3 mt-2 mb-2">
                      {appt.doctor && (
                        <div className="flex items-center text-sm text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded-md">
                          <Briefcase className="w-4 h-4 mr-1 text-blue-500" />
                          Dr. {appt.doctor.full_name}
                        </div>
                      )}
                      <div className="flex items-center text-sm text-violet-800 bg-violet-100/70 px-2 py-0.5 rounded-md capitalize">
                        <CalendarIcon className="w-4 h-4 mr-1 text-violet-500" />
                        {appt.type}
                      </div>
                    </div>
                    <div className="flex justify-end mt-auto pt-2">
                      <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full inline-flex items-center shadow-sm ${currentStyles.badgeClasses}`}>
                        <currentStyles.iconForBadge size={15} className={`${currentStyles.iconClass} mr-1`} />
                        {appt.status.replace('-', ' ')}
                      </span>
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
            await onUpdateAppointment(selectedAppointment.id, { status: newStatus });
            setIsActionModalOpen(false); setSelectedAppointment(null);
          }}
          onEdit={() => { onView(selectedAppointment); setIsActionModalOpen(false); setSelectedAppointment(null); }}
          onMessage={() => { if (onMessagePatient) { onMessagePatient(selectedAppointment); } }}
        />
      )}
    </div>
  );
}