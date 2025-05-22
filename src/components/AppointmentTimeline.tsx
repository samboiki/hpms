import React, { useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  User, 
  ChevronLeft,
  ChevronRight,
  Calendar,
  Edit3
} from 'lucide-react';
import { format, addDays, subDays, setHours, setMinutes } from 'date-fns';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
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
}

export const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({
  date, 
  appointments, 
  isLoading, 
  error, 
  onCheckIn, 
  onCancel, 
  onView,
  onDateChange,
  onUpdateAppointment
}) => {
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 08 → 19
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const appointment = appointments.find(a => a.id === active.id);
    if (!appointment) return;

    const hour = parseInt(over.id.toString());
    const newTime = `${hour.toString().padStart(2, '0')}:00`;

    onUpdateAppointment(appointment.id, {
      time: newTime
    });
  };

  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'scheduled':
        return 'azure';
      case 'confirmed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'completed':
        return 'success';
      case 'no-show':
        return 'error';
      default:
        return 'glass';
    }
  };

  return (
    <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Date Navigation */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onDateChange(subDays(date, 1))}
          >
            <ChevronLeft size={16} className="mr-1" />
            Previous
          </Button>
          <h2 className="font-rubik font-semibold text-lg flex items-center">
            <Calendar size={18} className="mr-2 text-[#01b9d4]" />
            {format(date, 'EEEE, dd MMM yyyy')}
          </h2>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onDateChange(addDays(date, 1))}
          >
            Next
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <DndContext 
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            {hours.map((h) => {
              const bucket = appointments.filter(
                a => a.date === format(date, 'yyyy-MM-dd') &&
                    parseInt(a.time.split(':')[0]) === h
              );

              return (
                <div key={h} className="mb-6" id={h.toString()}>
                  <div className="text-xs text-gray-400 mb-2 flex items-center">
                    <div className="w-12 text-right">
                      {format(setMinutes(setHours(date, h), 0), 'h:00 a')}
                    </div>
                    <div className="flex-1 ml-2 border-t border-gray-100 border-dashed"></div>
                  </div>

                  <div className="pl-12">
                    <AnimatePresence>
                      {bucket.map(appt => (
                        <motion.div
                          key={appt.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          whileHover={{ scale: 1.02 }}
                          className={`
                            flex items-center justify-between p-4 mb-2 rounded-lg shadow-sm
                            cursor-pointer transition-all duration-200
                            ${appt.status === 'scheduled' ? 'bg-blue-50 border-l-4 border-blue-500' : 
                              appt.status === 'confirmed' ? 'bg-green-50 border-l-4 border-green-500' :
                              appt.status === 'in-progress' ? 'bg-amber-50 border-l-4 border-amber-500' :
                              appt.status === 'cancelled' ? 'bg-red-50 border-l-4 border-red-500' :
                              appt.status === 'no-show' ? 'bg-purple-50 border-l-4 border-purple-500' :
                              'bg-gray-50 border-l-4 border-gray-500'}
                          `}
                          onClick={() => onView(appt)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                                <User size={20} className={`
                                  ${appt.status === 'scheduled' ? 'text-blue-500' : 
                                    appt.status === 'confirmed' ? 'text-green-500' :
                                    appt.status === 'in-progress' ? 'text-amber-500' :
                                    appt.status === 'cancelled' ? 'text-red-500' :
                                    'text-gray-500'}
                                `} />
                              </div>
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">
                                {appt.patient.first_name} {appt.patient.last_name}
                              </h3>
                              <div className="flex items-center text-sm text-gray-500">
                                <Clock size={14} className="mr-1" />
                                {appt.time} • {appt.type} • {appt.doctor?.full_name || 'No doctor assigned'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={getStatusColor(appt.status)}
                              size="sm"
                            >
                              {appt.status}
                            </Badge>
                            
                            {appt.status === 'scheduled' && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="bg-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCheckIn(appt.id);
                                  }}
                                >
                                  <CheckCircle2 size={14} className="mr-1" />
                                  Check-in
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="bg-white text-red-600 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCancel(appt.id);
                                  }}
                                >
                                  <XCircle size={14} className="mr-1" />
                                  Cancel
                                </Button>
                              </>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                onView(appt);
                              }}
                            >
                              <Edit3 size={14} className="mr-1" />
                              Edit
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {bucket.length === 0 && (
                      <div className="h-4" />
                    )}
                  </div>
                </div>
              );
            })}
          </DndContext>
        )}

        {appointments.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Clock size={40} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No appointments scheduled</p>
          </div>
        )}
      </div>
    </div>
  );
};