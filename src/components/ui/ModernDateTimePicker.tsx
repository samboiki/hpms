import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';

interface ModernDateTimePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  placeholder?: string;
  showTime?: boolean;
  disabled?: boolean;
  className?: string;
}

const ModernDateTimePicker: React.FC<ModernDateTimePickerProps> = ({
  value,
  onChange,
  placeholder = "Select date and time",
  showTime = true,
  disabled = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(value || new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(value || new Date());
  const [selectedTime, setSelectedTime] = useState<string>(
    value ? format(value, 'HH:mm') : format(new Date(), 'HH:mm')
  );
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update internal state when value prop changes
  useEffect(() => {
    if (value) {
      setSelectedDate(value);
      setCurrentMonth(value);
      setSelectedTime(format(value, 'HH:mm'));
    }
  }, [value]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handleDateSelect = (date: Date) => {
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const newDateTime = new Date(date);
    newDateTime.setHours(hours, minutes, 0, 0);
    
    setSelectedDate(newDateTime);
    onChange(newDateTime);
    
    if (!showTime) {
      setIsOpen(false);
    }
  };

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
    const [hours, minutes] = time.split(':').map(Number);
    const newDateTime = new Date(selectedDate);
    newDateTime.setHours(hours, minutes, 0, 0);
    
    setSelectedDate(newDateTime);
    onChange(newDateTime);
  };

  const handleTodayClick = () => {
    const now = new Date();
    setCurrentMonth(now);
    setSelectedDate(now);
    setSelectedTime(format(now, 'HH:mm'));
    onChange(now);
    if (!showTime) {
      setIsOpen(false);
    }
  };

  const handleNowClick = () => {
    const now = new Date();
    setCurrentMonth(now);
    setSelectedDate(now);
    setSelectedTime(format(now, 'HH:mm'));
    onChange(now);
    setIsOpen(false);
  };

  const formatDisplayValue = () => {
    if (!value) return placeholder;
    if (showTime) {
      return format(value, 'MMM dd, yyyy HH:mm');
    }
    return format(value, 'MMM dd, yyyy');
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Input Field */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-3 text-left border rounded-xl transition-all duration-200
          ${disabled 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
            : 'bg-white text-gray-700 border-gray-300 hover:border-[#01b9d5] focus:border-[#01b9d5] focus:ring-2 focus:ring-[#01b9d5]/20'
          }
          ${isOpen ? 'border-[#01b9d5] ring-2 ring-[#01b9d5]/20' : ''}
          flex items-center justify-between
        `}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {formatDisplayValue()}
        </span>
        <div className="flex items-center gap-2">
          {showTime && <Clock className="w-4 h-4 text-gray-400" />}
          <Calendar className="w-4 h-4 text-gray-400" />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              
              <h3 className="text-lg font-semibold text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={handleTodayClick}
                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
              >
                Today
              </button>
              {showTime && (
                <button
                  type="button"
                  onClick={handleNowClick}
                  className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
                >
                  Now
                </button>
              )}
            </div>

            {/* Week Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {calendarDays.map((day) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`
                      w-10 h-10 text-sm rounded-lg transition-all duration-200 hover:bg-gray-100
                      ${!isCurrentMonth 
                        ? 'text-gray-300' 
                        : isSelected 
                          ? 'bg-[#01b9d5] text-white hover:bg-[#01b9d5]/90 shadow-md' 
                          : isTodayDate 
                            ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200' 
                            : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            {/* Time Picker */}
            {showTime && (
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:border-[#01b9d5] focus:ring-2 focus:ring-[#01b9d5]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const now = format(new Date(), 'HH:mm');
                      handleTimeChange(now);
                    }}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Current Time
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm bg-[#01b9d5] text-white rounded-lg hover:bg-[#01b9d5]/90 transition-colors font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernDateTimePicker;