import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Edit3,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { format, addDays, subDays, setHours, setMinutes, parse, isToday, parseISO, isSameDay } from 'date-fns';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import AppointmentActionModal from './modals/AppointmentActionModal';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: string;
  notes?: string;
  patient: {
    first_name: string;
    last_name: string;
  };
  doctor?: {
    full_name: string;
  };
}

interface AppointmentTimelineProps {
  date: Date;
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  onCheckIn: (id: string) => void;
  onCancel: (id: string) => void;
  onView: (appointment: Appointment) => void;
  onDateChange: (date: Date) => void;
  onUpdateAppointment: (id: string, updates: Partial<Appointment>) => void;
  onMessagePatient?: (appointment: Appointment) => void;
}

const START_HOUR = 8;
const TOTAL_MINUTES = 11 * 60; // 8AM → 7PM

export const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({
  date,
  appointments,
  isLoading,
  error,
  onCheckIn,
  onCancel,
  onView,
  onDateChange,
  onUpdateAppointment,
  onMessagePatient
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  
  // Generate time slots for every 30 minutes from 8 AM to 7 PM
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minutes = (i % 2) * 30;
    return setMinutes(setHours(date, hour), minutes);
  });

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }));

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const appointment = appointments.find(a => a.id === active.id);
    if (!appointment) return;

    const timeSlot = parse(over.id.toString(), 'HH:mm', new Date());
    const newTime = format(timeSlot, 'HH:mm');

    try {
      await onUpdateAppointment(appointment.id, {
        time: newTime
      });
    } catch (error) {
      console.error('Failed to update appointment time:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'azure';
      case 'confirmed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'completed':
        return 'success';
      default:
        return 'glass';
    }
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsActionModalOpen(true);
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedAppointment) return;

    try {
      await onUpdateAppointment(selectedAppointment.id, { status: status as Appointment['status'] });
      setIsActionModalOpen(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Failed to update appointment status:', error);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Date Navigation */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              className="h-8 px-2"
              onClick={() => onDateChange(subDays(date, 1))}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            >
              <CalendarIcon size={14} className="mr-2 text-[#01b9d4]" />
              {format(date, 'EEEE, dd MMM yyyy')}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="h-8 px-2"
              onClick={() => onDateChange(addDays(date, 1))}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        {/* Calendar Popover */}
        {isCalendarOpen && (
          <div className="absolute z-50 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <DayPicker
              mode="single"
              selected={date}
              onSelect={(day) => {
                if (day) {
                  onDateChange(day);
                  setIsCalendarOpen(false);
                }
              }}
              className="custom-day-picker"
            />
          </div>
        )}
      </div>

      {/* Timeline Content */}
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
        <DndContext 
          sensors={sensors}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <div className="relative" style={{ height: `${TOTAL_MINUTES}px` }}>
            {/* Time slots */}
            {timeSlots.map((timeSlot, i) => (
              <div
                key={i}
                className="absolute left-0 right-0"
                style={{
                  top: `${((timeSlot.getHours() - START_HOUR) * 60 + timeSlot.getMinutes())}px`
                }}
              >
                <div className="flex items-center text-xs text-gray-400">
                  <div className="w-16 text-right">
                    {format(timeSlot, 'h:mm a')}
                  </div>
                  <div className="flex-1 ml-2 border-t border-gray-100 border-dashed" />
                </div>
              </div>
            ))}

            {/* Current time indicator */}
            {isToday(date) && (
              <div 
                className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                style={{
                  top: `${((currentTime.getHours() - START_HOUR) * 60 + currentTime.getMinutes())}px`
                }}
              >
                <div className="absolute -left-1 -top-2 w-4 h-4 rounded-full bg-red-500" />
              </div>
            )}

            {/* Appointments */}
            {appointments
              .filter(a => isSameDay(parseISO(a.date), date))
              .map(appt => {
                const [h, m] = appt.time.split(':').map(Number);
                const minutesFromStart = (h - START_HOUR) * 60 + m;
                
                return (
                  <motion.div
                    key={appt.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{
                      position: 'absolute',
                      left: '4rem',
                      right: '1rem',
                      top: `${minutesFromStart}px`,
                      height: `${appt.duration}px`,
                    }}
                    className={`
                      p-2 rounded-lg shadow-sm cursor-pointer transition-all
                      ${appt.status === 'scheduled' ? 'bg-blue-50 border-l-4 border-blue-500' :
                        appt.status === 'confirmed' ? 'bg-green-50 border-l-4 border-green-500' :
                        appt.status === 'in-progress' ? 'bg-amber-50 border-l-4 border-amber-500' :
                        appt.status === 'cancelled' ? 'bg-red-50 border-l-4 border-red-500' :
                        'bg-gray-50 border-l-4 border-gray-500'
                      }
                    `}
                    onClick={() => handleAppointmentClick(appt)}
                  >
                    <h3 className="text-sm font-medium text-gray-900">
                      {appt.patient.first_name} {appt.patient.last_name}
                    </h3>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock size={12} className="mr-1" />
                      {appt.time} • {appt.type}
                      {appt.doctor?.full_name && (
                        <>
                          <span className="mx-1">•</span>
                          Dr. {appt.doctor.full_name}
                        </>
                      )}
                    </div>
                    <Badge
                      variant={getStatusColor(appt.status)}
                      size="sm"
                      className="mt-1"
                    >
                      {appt.status}
                    </Badge>
                  </motion.div>
                );
              })}
          </div>
        </DndContext>

        {appointments.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <Clock size={40} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No appointments scheduled</p>
          </div>
        )}
      </div>

      {/* Appointment Action Modal */}
      {selectedAppointment && (
        <AppointmentActionModal
          isOpen={isActionModalOpen}
          onClose={() => {
            setIsActionModalOpen(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onStatusChange={handleStatusChange}
          onEdit={() => {
            setIsActionModalOpen(false);
            onView(selectedAppointment);
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