import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { 
  generateTimeSlots, 
  rescheduleAppointment,
  findNextAvailableSlot 
} from '../../utils/appointments';
import Button from '../ui/Button';

interface RescheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: {
    id: string;
    patient_name: string;
    doctor_id: string;
    doctor_name: string;
    scheduled_time?: string;
    date?: string;
    time?: string;
    appointment_type?: string;
    type?: string;
  };
  onReschedule: () => void;
}

const RescheduleAppointmentModal: React.FC<RescheduleAppointmentModalProps> = ({
  isOpen,
  onClose,
  appointment,
  onReschedule
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);

  useEffect(() => {
    if (isOpen && appointment) {
      loadTimeSlots(selectedDate);
    }
  }, [isOpen, selectedDate, appointment]);

  const loadTimeSlots = async (date: Date) => {
    try {
      const slots = await generateTimeSlots(date, appointment.doctor_id);
      setTimeSlots(slots);
    } catch (err) {
      console.error('Error loading time slots:', err);
      setError('Failed to load available time slots');
    }
  };

  const handleQuickReschedule = async (days: number) => {
    const targetDate = addDays(new Date(), days);
    const nextSlot = await findNextAvailableSlot(
      appointment.doctor_id,
      targetDate
    );
    
    if (nextSlot) {
      setSelectedDate(startOfDay(nextSlot.start));
      setSelectedSlot(nextSlot);
      setShowQuickActions(false);
    } else {
      setError(`No available slots found in the next ${days} days`);
    }
  };

  const handleReschedule = async () => {
    if (!selectedSlot) {
      setError('Please select a time slot');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await rescheduleAppointment(
        appointment.id,
        selectedSlot.start,
        reason
      );

      if (result.success) {
        onReschedule();
        onClose();
      } else {
        setError(result.error || 'Failed to reschedule appointment');
      }
    } catch (err) {
      setError('An error occurred while rescheduling');
    } finally {
      setLoading(false);
    }
  };

  const availableSlots = timeSlots.filter(slot => slot.available);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Reschedule Appointment</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Current Appointment Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium mb-2">Current Appointment</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-600">Patient:</span> {appointment.patient_name}</p>
                  <p><span className="text-gray-600">Doctor:</span> {appointment.doctor_name}</p>
                  <p><span className="text-gray-600">Type:</span> {appointment.appointment_type || appointment.type}</p>
                  <p><span className="text-gray-600">Current Time:</span> {
                    appointment.scheduled_time 
                      ? format(new Date(appointment.scheduled_time), 'PPp')
                      : appointment.date && appointment.time
                      ? `${format(new Date(appointment.date), 'PP')} at ${appointment.time}`
                      : 'Unknown'
                  }</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Quick Actions */}
              {showQuickActions && (
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Quick Reschedule Options</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleQuickReschedule(1)}
                      className="text-sm"
                    >
                      Next Day
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleQuickReschedule(3)}
                      className="text-sm"
                    >
                      In 3 Days
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleQuickReschedule(7)}
                      className="text-sm"
                    >
                      Next Week
                    </Button>
                  </div>
                  <div className="text-center mt-3">
                    <button
                      onClick={() => setShowQuickActions(false)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Choose specific date and time
                    </button>
                  </div>
                </div>
              )}

              {/* Date Selection */}
              {!showQuickActions && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">Select Date</label>
                    <input
                      type="date"
                      value={format(selectedDate, 'yyyy-MM-dd')}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(e) => setSelectedDate(new Date(e.target.value))}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>

                  {/* Time Slots */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">
                      Available Time Slots ({availableSlots.length} available)
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                      {availableSlots.length === 0 ? (
                        <p className="col-span-full text-gray-500 text-center py-4">
                          No available slots on this date
                        </p>
                      ) : (
                        availableSlots.map((slot, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedSlot(slot)}
                            className={`p-2 rounded-lg border text-sm transition-colors ${
                              selectedSlot === slot
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'hover:bg-gray-50 border-gray-300'
                            }`}
                          >
                            {format(slot.start, 'HH:mm')}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Selected Time Display */}
              {selectedSlot && (
                <div className="mb-6 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">New Time:</span>
                    <span>{format(selectedSlot.start, 'PPp')}</span>
                  </div>
                </div>
              )}

              {/* Reason for Rescheduling */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Reason for Rescheduling (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full p-2 border rounded-lg resize-none"
                  placeholder="Enter reason for rescheduling..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReschedule}
                disabled={!selectedSlot || loading}
                loading={loading}
              >
                Reschedule Appointment
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RescheduleAppointmentModal;