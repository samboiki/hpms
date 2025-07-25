import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';

interface ModernDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label: string;
  placeholder?: string;
  error?: string;
  minDate?: Date;
  maxDate?: Date;
}

const ModernDatePicker: React.FC<ModernDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  error,
  minDate,
  maxDate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDateSelect = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const displayValue = value ? format(new Date(value), 'MMM dd, yyyy') : '';

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-[#01b9d5]/30 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#01b9d5]/20 focus:border-[#01b9d5] transition-all duration-200 shadow-sm hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#01b9d5]/10 to-[#4bc0c8]/10">
            <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-[#01b9d5]" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-sm font-semibold text-gray-900">
              {displayValue || placeholder}
            </p>
          </div>
        </div>
        <Icon 
          icon="solar:alt-arrow-down-bold-duotone" 
          className={`w-5 h-5 text-[#01b9d5]/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-5 h-5 text-gray-600" />
            </button>
            <h3 className="text-sm font-semibold text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="text-xs font-medium text-gray-500 text-center py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth().map((date, idx) => {
              const isSelected = value && isSameDay(date, new Date(value));
              const isCurrentDay = isToday(date);
              const isDisabled = (minDate && date < minDate) || (maxDate && date > maxDate);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => !isDisabled && handleDateSelect(date)}
                  disabled={isDisabled}
                  className={`
                    p-2 text-sm rounded-lg transition-all
                    ${isSelected 
                      ? 'bg-[#01b9d5] text-white font-semibold' 
                      : isCurrentDay
                      ? 'bg-[#01b9d5]/10 text-[#01b9d5] font-semibold'
                      : 'hover:bg-gray-100 text-gray-700'
                    }
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {format(date, 'd')}
                </button>
              );
            })}
          </div>

          {/* Today Button */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                handleDateSelect(today);
                setCurrentMonth(today);
              }}
              className="w-full py-2 text-sm font-medium text-[#01b9d5] hover:bg-[#01b9d5]/5 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernDatePicker;