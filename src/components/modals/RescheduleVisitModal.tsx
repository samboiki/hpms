import React, { useState } from 'react';
import { X, Calendar, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { Visit } from '../../types/enhanced-visit.types';
import { supabase } from '../../lib/supabase';
import { format, addDays, addWeeks } from 'date-fns';
import ModernDateTimePicker from '../ui/ModernDateTimePicker';

interface RescheduleVisitModalProps {
  visit: Visit;
  onSuccess: () => void;
  onClose: () => void;
}

export default function RescheduleVisitModal({ 
  visit, 
  onSuccess, 
  onClose 
}: RescheduleVisitModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const currentDate = new Date(visit.scheduled_date || visit.visit_date);
  const currentTime = visit.scheduled_time || visit.visit_time;

  const quickOptions = [
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
    { label: 'In 3 Days', date: addDays(new Date(), 3) },
    { label: 'Next Week', date: addWeeks(new Date(), 1) },
  ];

  const handleQuickReschedule = (newDate: Date) => {
    setSelectedDate(newDate);
    setSelectedTime(currentTime || '09:00');
    setShowCustomPicker(false);
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime) {
      alert('Please select a new date and time');
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
        scheduled_time: selectedTime,
        updated_at: new Date().toISOString()
      };

      // If the visit is already scheduled but not confirmed, keep it that way
      // If it's confirmed, it stays confirmed
      // Add the reschedule reason to notes
      if (reason) {
        updateData.notes = visit.notes 
          ? `${visit.notes}\n\nRescheduled: ${reason}` 
          : `Rescheduled: ${reason}`;
      }

      const { error } = await supabase
        .from('visits')
        .update(updateData)
        .eq('id', visit.id);

      if (error) throw error;

      onSuccess();
    } catch (error) {
      console.error('Error rescheduling visit:', error);
      alert('Failed to reschedule visit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Reschedule Visit
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Schedule */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Current Schedule</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium">
                  {format(currentDate, 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium">
                  {currentTime || 'Not set'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Options */}
          {!showCustomPicker && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Quick Reschedule Options
              </p>
              <div className="space-y-2">
                {quickOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => handleQuickReschedule(option.date)}
                    className={`w-full px-4 py-3 rounded-lg border transition-colors text-left flex items-center justify-between group ${
                      selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(option.date, 'yyyy-MM-dd')
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-300 hover:border-cyan-400 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{option.label}</p>
                      <p className="text-sm text-gray-500">
                        {format(option.date, 'EEEE, MMMM d')}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowCustomPicker(true)}
                className="w-full mt-3 px-4 py-2 text-cyan-600 border border-cyan-300 rounded-lg hover:bg-cyan-50 transition-colors"
              >
                Choose Custom Date & Time
              </button>
            </div>
          )}

          {/* Custom Date/Time Picker */}
          {showCustomPicker && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Select New Date & Time
              </p>
              <div className="space-y-4">
                <ModernDateTimePicker
                  value={selectedDate || new Date()}
                  onChange={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(date ? format(date, 'HH:mm') : '');
                  }}
                  showTime={true}
                />
                <button
                  onClick={() => {
                    setShowCustomPicker(false);
                    setSelectedDate(null);
                    setSelectedTime('');
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  ← Back to quick options
                </button>
              </div>
            </div>
          )}

          {/* New Schedule Preview */}
          {selectedDate && selectedTime && (
            <div className="bg-cyan-50 rounded-lg p-4">
              <p className="text-sm text-cyan-600 mb-2">New Schedule</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm font-medium text-cyan-900">
                    {format(selectedDate, 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm font-medium text-cyan-900">
                    {selectedTime}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Rescheduling (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Patient requested, Doctor unavailable..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReschedule}
              disabled={!selectedDate || !selectedTime || loading}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}