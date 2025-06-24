import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format, setHours, setMinutes, addMinutes } from 'date-fns';

interface PremiumTimeRangePickerProps {
  startTime: string;
  endTime: string;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  startLabel?: string;
  endLabel?: string;
  error?: string;
  bookedTimes?: string[];
  min?: string;
  max?: string;
  step?: number;
}

export const PremiumTimeRangePicker: React.FC<PremiumTimeRangePickerProps> = ({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  startLabel = 'Start Time',
  endLabel = 'End Time',
  error,
  bookedTimes = [],
  min = '08:00',
  max = '18:00',
  step = 15
}) => {
  const [duration, setDuration] = useState(30);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(30);

  // Common duration options
  const durationOptions = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1 hour' },
    { value: 90, label: '1.5 hours' },
    { value: 120, label: '2 hours' }
  ];

  useEffect(() => {
    if (startTime && endTime) {
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const startDate = new Date();
      startDate.setHours(startHours, startMinutes, 0, 0);
      
      const endDate = new Date();
      endDate.setHours(endHours, endMinutes, 0, 0);
      
      const diff = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
      setDuration(diff);
      
      // Check if duration matches a preset
      const matchingOption = durationOptions.find(opt => opt.value === diff);
      setSelectedDuration(matchingOption ? diff : null);
    }
  }, [startTime, endTime]);

  const handleStartTimeChange = (time: string) => {
    onStartTimeChange(time);
    
    // Auto-calculate end time based on selected duration
    if (selectedDuration) {
      const [hours, minutes] = time.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      const endDate = addMinutes(startDate, selectedDuration);
      onEndTimeChange(format(endDate, 'HH:mm'));
    }
  };

  const handleDurationSelect = (durationMinutes: number) => {
    setSelectedDuration(durationMinutes);
    
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      const endDate = addMinutes(startDate, durationMinutes);
      onEndTimeChange(format(endDate, 'HH:mm'));
    }
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    const [minHours, minMinutes] = min.split(':').map(Number);
    const [maxHours, maxMinutes] = max.split(':').map(Number);
    
    let current = new Date();
    current.setHours(minHours, minMinutes, 0, 0);
    
    const end = new Date();
    end.setHours(maxHours, maxMinutes, 0, 0);
    
    while (current <= end) {
      const timeStr = format(current, 'HH:mm');
      const isBooked = bookedTimes.includes(timeStr);
      
      slots.push({
        time: timeStr,
        display: format(current, 'h:mm a'),
        isBooked,
        period: current.getHours() < 12 ? 'morning' : current.getHours() < 17 ? 'afternoon' : 'evening'
      });
      
      current = addMinutes(current, step);
    }
    
    return slots;
  }, [min, max, step, bookedTimes]);

  return (
    <div className="space-y-4">
      {/* Duration Quick Select */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">Select Duration</label>
        <div className="grid grid-cols-3 gap-2">
          {durationOptions.map((option) => (
            <motion.button
              key={option.value}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDurationSelect(option.value)}
              className={`py-2.5 px-3 rounded-xl font-medium text-sm transition-all duration-200
                ${selectedDuration === option.value
                  ? 'bg-cyan-600 text-white shadow-lg'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                }`}
            >
              {option.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Time Selection Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Start Time */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">{startLabel}</label>
          <div className="bg-gray-50 rounded-xl p-3 max-h-60 overflow-y-auto">
            <div className="space-y-1">
              {timeSlots.map((slot) => (
                <motion.button
                  key={slot.time}
                  type="button"
                  disabled={slot.isBooked}
                  whileHover={!slot.isBooked ? { scale: 1.02 } : {}}
                  whileTap={!slot.isBooked ? { scale: 0.98 } : {}}
                  onClick={() => handleStartTimeChange(slot.time)}
                  className={`w-full py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200
                    ${startTime === slot.time
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md'
                      : slot.isBooked
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40 line-through'
                      : 'bg-white hover:bg-cyan-50 text-gray-700 border border-gray-200 hover:border-cyan-300'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{slot.display}</span>
                    {slot.isBooked && (
                      <Icon icon="solar:lock-bold-duotone" className="w-4 h-4 opacity-50" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* End Time Display */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">{endLabel}</label>
          <div className="bg-cyan-50/50 rounded-xl p-4 h-full flex flex-col justify-center">
            <div className="text-center space-y-3">
              <Icon icon="solar:clock-circle-bold-duotone" className="w-16 h-16 text-cyan-500 mx-auto" />
              <div>
                <p className="text-sm text-gray-600 mb-1">Appointment ends at</p>
                <p className="text-2xl font-bold text-gray-800">
                  {endTime ? format(new Date(`2000-01-01 ${endTime}`), 'h:mm a') : '--:--'}
                </p>
              </div>
              {duration > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full text-sm">
                  <Icon icon="solar:timer-bold-duotone" className="w-4 h-4 text-cyan-500" />
                  <span className="font-medium text-gray-700">{duration} minutes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-red-600 flex items-center gap-1"
        >
          <Icon icon="solar:danger-circle-bold" className="w-4 h-4" />
          {error}
        </motion.p>
      )}
    </div>
  );
};

export default PremiumTimeRangePicker;