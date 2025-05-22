import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MoreVertical,
  Plus,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  parseISO,
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
import Button from './ui/Button';
import AppointmentActionModal from './modals/AppointmentActionModal';

const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_HEIGHT = 120; // pixels per hour

interface AppointmentTimelineProps {
  date: Date;
  appointments: any[];
  isLoading: boolean;
  error: string | null;
  onDateChange: (date: Date) => void;
  onUpdateAppointment: (id: string, updates: any) => Promise<void>;
  onView: (appointment: any) => void;
  onMessagePatient?: (appointment: any) => void;
  onCreateAppointment?: (date: Date, time: string) => void;
}

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
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    })
  );

  // Generate hours for the day
  const hours = useMemo(() => {
    return Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  }, []);

  // Filter appointments for current date
  const todaysAppointments = useMemo(() => {
    return appointments.filter(appt => isSameDay(parseISO(appt.date), date));
  }, [appointments, date]);

  const getAppointmentStyle = (appointment: any) => {
    const [hours, minutes] = appointment.time.split(':').map(Number);
    const startMinutes = (hours - START_HOUR) * 60 + minutes;
    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = (appointment.duration / 60) * HOUR_HEIGHT;

    const baseStyle = {
      top: `${top}px`,
      height: `${height}px`,
      left: '76px', // Width of time column
      right: '12px',
    };

    const statusStyles = {
      scheduled: {
        background: 'linear-gradient(to right, #f3f4f6, #f9fafb)',
        borderLeft: '4px solid #6366f1',
      },
      confirmed: {
        background: 'linear-gradient(to right, #ecfdf5, #f8fafc)',
        borderLeft: '4px solid #10b981',
      },
      'in-progress': {
        background: 'linear-gradient(to right, #ede9fe, #f5f3ff)',
        borderLeft: '4px solid #8b5cf6',
      },
      completed: {
        background: 'linear-gradient(to right, #e0f2fe, #f0f9ff)',
        borderLeft: '4px solid #0ea5e9',
      },
      cancelled: {
        background: 'linear-gradient(to right, #fef2f2, #fff1f2)',
        borderLeft: '4px solid #ef4444',
        opacity: 0.75,
      },
    };

    return {
      ...baseStyle,
      ...statusStyles[appointment.status],
    };
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;
    if (!active) return;

    const appointment = appointments.find(a => a.id === active.id);
    if (!appointment) return;

    const minutesDelta = Math.round(delta.y / (HOUR_HEIGHT / 60));
    const [hours, minutes] = appointment.time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + minutesDelta;
    
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    const newTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;

    try {
      await onUpdateAppointment(appointment.id, { time: newTime });
    } catch (error) {
      console.error('Failed to update appointment time:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onDateChange(subDays(date, 1))}>
            <ChevronLeft size={16} />
          </Button>
          
          <div className="relative">
            <Button 
              variant="ghost"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="font-medium"
            >
              {format(date, 'EEEE, MMMM d')}
            </Button>
            
            {isCalendarOpen && (
              <div className="absolute top-full left-0 mt-1 z-50">
                <DayPicker
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      onDateChange(d);
                      setIsCalendarOpen(false);
                    }
                  }}
                  className="bg-white rounded-lg shadow-lg border p-2"
                />
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={() => onDateChange(addDays(date, 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onDateChange(new Date())}
        >
          Today
        </Button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <div 
            className="relative" 
            style={{ height: `${HOUR_HEIGHT * (END_HOUR - START_HOUR)}px` }}
          >
            {/* Time markers */}
            {hours.map(hour => (
              <div
                key={hour}
                className="absolute left-0 w-full border-t border-gray-100"
                style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}
              >
                <span className="absolute -top-3 left-4 text-xs text-gray-400">
                  {format(setHours(new Date(), hour), 'h:mm a')}
                </span>
              </div>
            ))}

            {/* Current time indicator */}
            {isSameDay(date, new Date()) && (
              <div
                className="absolute left-0 right-0 flex items-center z-20"
                style={{
                  top: `${((getHours(new Date()) - START_HOUR) * 60 + getMinutes(new Date())) / 60 * HOUR_HEIGHT}px`,
                }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 ml-3" />
                <div className="flex-1 h-px bg-red-500 opacity-50" />
              </div>
            )}

            {/* Appointments */}
            <AnimatePresence>
              {todaysAppointments.map(appointment => (
                <motion.div
                  key={appointment.id}
                  layoutId={appointment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  style={getAppointmentStyle(appointment)}
                  onClick={() => {
                    setSelectedAppointment(appointment);
                    setIsActionModalOpen(true);
                  }}
                >
                  <div className="p-3 h-full">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {appointment.patient.first_name} {appointment.patient.last_name}
                      </span>
                      <Button variant="ghost" size="sm" className="-mr-2 h-6 w-6">
                        <MoreVertical size={14} />
                      </Button>
                    </div>
                    
                    <div className="space-y-1 text-xs text-gray-500">
                      <div className="flex items-center">
                        <Clock size={12} className="mr-1" />
                        {format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a')}
                        <span className="mx-1">•</span>
                        {appointment.type}
                      </div>
                      {appointment.doctor && (
                        <div className="text-gray-600">
                          Dr. {appointment.doctor.full_name}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </DndContext>
      </div>

      {/* Add appointment button */}
      {onCreateAppointment && (
        <Button
          className="absolute bottom-4 right-4 rounded-full shadow-lg"
          onClick={() => onCreateAppointment(date, '09:00')}
        >
          <Plus size={20} />
        </Button>
      )}

      {/* Action Modal */}
      {selectedAppointment && (
        <AppointmentActionModal
          isOpen={isActionModalOpen}
          appointment={selectedAppointment}
          onClose={() => {
            setIsActionModalOpen(false);
            setSelectedAppointment(null);
          }}
          onStatusChange={async (status) => {
            try {
              await onUpdateAppointment(selectedAppointment.id, { status });
              setIsActionModalOpen(false);
              setSelectedAppointment(null);
            } catch (error) {
              console.error('Failed to update status:', error);
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