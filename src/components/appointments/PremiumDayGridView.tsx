import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMinutes, startOfDay, differenceInMinutes, isSameDay } from 'date-fns';
import { 
  Clock, 
  User, 
  Calendar, 
  MapPin, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
  ChevronDown,
  Sparkles,
  Zap,
  Activity,
  Eye,
  Shield
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  patient?: {
    first_name: string;
    last_name: string;
    cell_number?: string;
    medical_aid_details?: {
      provider?: string;
      scheme_name?: string;
      member_number?: string;
    };
  };
  doctor?: {
    full_name: string;
  };
}

interface Doctor {
  id: string;
  email: string;
  user_metadata: {
    full_name: string;
    role: string;
  };
}

interface PremiumDayGridViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  doctors: Doctor[];
  onAppointmentClick?: (appointment: Appointment) => void;
  onTimeSlotClick?: (time: Date, doctorId: string) => void;
  onAppointmentDrop?: (appointmentId: string, newTime: Date, newDoctorId: string) => Promise<boolean>;
  businessHours?: { start: string; end: string };
  slotDuration?: number;
}

export const PremiumDayGridView: React.FC<PremiumDayGridViewProps> = ({
  selectedDate,
  appointments,
  doctors,
  onAppointmentClick,
  onTimeSlotClick,
  onAppointmentDrop,
  businessHours = { start: '08:00', end: '17:00' },
  slotDuration = 30
}) => {
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);
  const [dropTarget, setDropTarget] = useState<{ time: Date; doctorId: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate time slots
  const timeSlots = [];
  const [startHour, startMinute] = businessHours.start.split(':').map(Number);
  const [endHour, endMinute] = businessHours.end.split(':').map(Number);
  const startTime = new Date(selectedDate);
  startTime.setHours(startHour, startMinute, 0, 0);
  const endTime = new Date(selectedDate);
  endTime.setHours(endHour, endMinute, 0, 0);

  let currentTime = new Date(startTime);
  while (currentTime < endTime) {
    timeSlots.push(new Date(currentTime));
    currentTime = addMinutes(currentTime, slotDuration);
  }

  // Get appointments for a specific time and doctor
  const getAppointmentForSlot = (time: Date, doctorId: string) => {
    return appointments.find(apt => {
      if (apt.doctor_id !== doctorId) return false;
      const aptTime = new Date(`${apt.date}T${apt.time}`);
      return isSameDay(aptTime, time) && 
             aptTime.getHours() === time.getHours() && 
             aptTime.getMinutes() === time.getMinutes();
    });
  };

  // Calculate appointment height based on duration
  const getAppointmentHeight = (duration: number) => {
    return (duration / slotDuration) * 60; // 60px per slot
  };

  // Get appointment position
  const getAppointmentTop = (appointment: Appointment) => {
    const aptTime = new Date(`${appointment.date}T${appointment.time}`);
    const minutesFromStart = differenceInMinutes(aptTime, startTime);
    return (minutesFromStart / slotDuration) * 60;
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, appointment: Appointment) => {
    setDraggedAppointment(appointment);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create custom drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'bg-white shadow-lg rounded-lg p-3 border-2 border-[#01b9d5]';
    dragImage.innerHTML = `
      <div class="font-medium text-sm">${appointment.patient?.first_name} ${appointment.patient?.last_name}</div>
      <div class="text-xs text-gray-500">${appointment.type}</div>
    `;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, time: Date, doctorId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ time, doctorId });
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent, time: Date, doctorId: string) => {
    e.preventDefault();
    if (!draggedAppointment || !onAppointmentDrop) return;

    // Check if dropping on the same slot
    const originalTime = new Date(`${draggedAppointment.date}T${draggedAppointment.time}`);
    if (
      isSameDay(originalTime, time) &&
      originalTime.getHours() === time.getHours() &&
      originalTime.getMinutes() === time.getMinutes() &&
      draggedAppointment.doctor_id === doctorId
    ) {
      setDraggedAppointment(null);
      setDropTarget(null);
      setIsDragging(false);
      return;
    }

    // Show loading toast
    const toastId = toast.loading('Moving appointment...');

    try {
      const success = await onAppointmentDrop(draggedAppointment.id, time, doctorId);
      if (success) {
        toast.success('Appointment rescheduled successfully', { id: toastId });
      } else {
        toast.error('Failed to move appointment', { id: toastId });
      }
    } catch (error) {
      toast.error('Error moving appointment', { id: toastId });
      console.error('Error dropping appointment:', error);
    }

    setDraggedAppointment(null);
    setDropTarget(null);
    setIsDragging(false);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedAppointment(null);
    setDropTarget(null);
    setIsDragging(false);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'from-blue-400 to-blue-600';
      case 'in-progress': return 'from-amber-400 to-orange-600';
      case 'completed': return 'from-green-400 to-emerald-600';
      case 'cancelled': return 'from-gray-400 to-gray-600';
      case 'pending': return 'from-purple-400 to-indigo-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation': return User;
      case 'follow-up': return CheckCircle2;
      case 'procedure': return Activity;
      case 'emergency': return AlertCircle;
      default: return Calendar;
    }
  };

  // Check if slot is available
  const isSlotAvailable = (time: Date, doctorId: string) => {
    const slotEnd = addMinutes(time, slotDuration);
    return !appointments.some(apt => {
      if (apt.doctor_id !== doctorId || apt.status === 'cancelled') return false;
      const aptStart = new Date(`${apt.date}T${apt.time}`);
      const aptEnd = addMinutes(aptStart, apt.duration);
      return (
        (aptStart >= time && aptStart < slotEnd) ||
        (aptEnd > time && aptEnd <= slotEnd) ||
        (aptStart <= time && aptEnd >= slotEnd)
      );
    });
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#01b9d5]" />
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-gray-600">Drag appointments to reschedule</span>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto custom-scrollbar" ref={gridRef}>
        <div className="flex">
          {/* Time Column */}
          <div className="flex-shrink-0 w-20 bg-gray-50 border-r border-gray-200">
            <div className="sticky top-0 bg-gray-50 z-20 h-12 border-b border-gray-200" />
            {timeSlots.map((time, index) => (
              <div
                key={index}
                className="h-[60px] border-b border-gray-100 px-2 py-1 relative"
              >
                <span className="text-xs text-gray-500 font-medium">
                  {format(time, 'h:mm a')}
                </span>
                {/* Current time indicator */}
                {isSameDay(time, new Date()) && 
                 time.getHours() === new Date().getHours() && 
                 Math.abs(time.getMinutes() - new Date().getMinutes()) < slotDuration && (
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 bg-red-500"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    style={{ 
                      top: `${((new Date().getMinutes() - time.getMinutes()) / slotDuration) * 60}px` 
                    }}
                  >
                    <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Doctor Columns */}
          <div className="flex-1 flex">
            {doctors.map((doctor) => (
              <div key={doctor.id} className="flex-1 min-w-[200px] border-r border-gray-200 last:border-r-0">
                {/* Doctor Header */}
                <div className="sticky top-0 bg-white z-20 h-12 border-b border-gray-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#01b9d5] to-[#0197a4] rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {doctor.user_metadata.full_name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time Slots */}
                <div className="relative">
                  {timeSlots.map((time, index) => {
                    const appointment = getAppointmentForSlot(time, doctor.id);
                    const isAvailable = isSlotAvailable(time, doctor.id);
                    const isDropTarget = dropTarget?.doctorId === doctor.id && 
                                       dropTarget.time.getTime() === time.getTime();

                    return (
                      <div
                        key={index}
                        className={cn(
                          "h-[60px] border-b border-gray-100 relative transition-all duration-200",
                          isDropTarget && isDragging && "bg-[#01b9d5]/10 border-[#01b9d5]",
                          !appointment && isAvailable && "hover:bg-gray-50 cursor-pointer"
                        )}
                        onDragOver={(e) => handleDragOver(e, time, doctor.id)}
                        onDrop={(e) => handleDrop(e, time, doctor.id)}
                        onClick={() => !appointment && isAvailable && onTimeSlotClick?.(time, doctor.id)}
                      >
                        {/* Add slot indicator */}
                        {!appointment && isAvailable && (
                          <motion.div
                            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                            whileHover={{ scale: 1.1 }}
                          >
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <Zap className="w-4 h-4 text-gray-400" />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}

                  {/* Appointments */}
                  {appointments
                    .filter(apt => apt.doctor_id === doctor.id && apt.status !== 'cancelled')
                    .map((appointment) => {
                      const TypeIcon = getTypeIcon(appointment.type);
                      const isExpanded = expandedAppointment === appointment.id;
                      const height = getAppointmentHeight(appointment.duration);
                      const top = getAppointmentTop(appointment);

                      return (
                        <motion.div
                          key={appointment.id}
                          className={cn(
                            "absolute left-1 right-1 bg-white rounded-lg shadow-lg border cursor-move overflow-hidden",
                            "hover:shadow-xl hover:z-30 transition-shadow",
                            draggedAppointment?.id === appointment.id && "opacity-50"
                          )}
                          style={{
                            height: isExpanded ? 'auto' : `${height - 8}px`,
                            minHeight: `${height - 8}px`,
                            top: `${top + 4}px`,
                            borderColor: appointment.status === 'pending' ? '#818cf8' : '#e5e7eb'
                          }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, appointment)}
                          onDragEnd={handleDragEnd}
                          onClick={() => onAppointmentClick?.(appointment)}
                          whileHover={{ scale: 1.02 }}
                          layout
                        >
                          {/* Status gradient bar */}
                          <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b",
                            getStatusColor(appointment.status)
                          )} />

                          {/* Content */}
                          <div className="p-2 pl-3">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {appointment.patient?.first_name} {appointment.patient?.last_name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <TypeIcon className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{appointment.type}</span>
                                  <span className="text-xs text-gray-400">
                                    {appointment.duration}min
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAppointmentClick?.(appointment);
                                  }}
                                  className="p-1 hover:bg-[#01b9d5]/10 rounded transition-all group"
                                  title="View details"
                                >
                                  <Eye className="w-3 h-3 text-gray-400 group-hover:text-[#01b9d5]" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedAppointment(isExpanded ? null : appointment.id);
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                >
                                  <ChevronDown className={cn(
                                    "w-3 h-3 text-gray-400 transition-transform",
                                    isExpanded && "rotate-180"
                                  )} />
                                </button>
                              </div>
                            </div>

                            {/* Expanded content */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="mt-2 pt-2 border-t border-gray-100"
                                >
                                  {appointment.patient?.cell_number && (
                                    <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                                      <Phone className="w-3 h-3" />
                                      {appointment.patient.cell_number}
                                    </div>
                                  )}
                                  {appointment.patient?.medical_aid_details && (
                                    <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                                      <Shield className="w-3 h-3" />
                                      <span className="font-medium">
                                        {appointment.patient.medical_aid_details.provider}
                                      </span>
                                      {appointment.patient.medical_aid_details.scheme_name && (
                                        <span className="text-gray-400">
                                          • {appointment.patient.medical_aid_details.scheme_name}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {appointment.notes && (
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                                      {appointment.notes}
                                    </p>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Loading indicator for pending */}
                          {appointment.status === 'pending' && (
                            <div className="absolute top-1 right-1">
                              <Loader2 className="w-3 h-3 text-purple-500 animate-spin" />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};