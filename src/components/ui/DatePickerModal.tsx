import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, isAfter, isBefore } from 'date-fns';
import { Icon } from '@iconify/react';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  selectedDate?: Date;
  title?: string;
  minDate?: Date;
  maxDate?: Date;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectDate,
  selectedDate: initialDate,
  title = 'Select Date',
  minDate,
  maxDate
}) => {
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
      setCurrentMonth(initialDate.getMonth());
      setCurrentYear(initialDate.getFullYear());
    }
  }, [initialDate]);

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const getDaysInMonth = () => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  };

  const getFirstDayOfMonth = () => {
    return new Date(currentYear, currentMonth, 1).getDay();
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day);
    if (!isDateDisabled(newDate)) {
      setSelectedDate(newDate);
      onSelectDate(newDate);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-[400px] w-full mx-4">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
            </button>
          </div>
          
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex items-center gap-2">
              {/* Month Dropdown */}
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                {['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'].map((month, i) => (
                  <option key={i} value={i}>{month}</option>
                ))}
              </select>
              {/* Year Dropdown */}
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                {Array.from({ length: 50 }, (_, i) => {
                  const year = 2000 + i;
                  return (
                    <option key={year} value={year}>{year}</option>
                  );
                })}
              </select>
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Calendar Body */}
        <div className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="text-xs font-semibold text-gray-500 text-center py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getFirstDayOfMonth() }, (_, i) => (
              <div key={`empty-${i}`} className="h-10"></div>
            ))}
            {Array.from({ length: getDaysInMonth() }, (_, i) => {
              const day = i + 1;
              const date = new Date(currentYear, currentMonth, day);
              const isToday = 
                new Date().getDate() === day && 
                new Date().getMonth() === currentMonth && 
                new Date().getFullYear() === currentYear;
              const isSelected = 
                selectedDate.getDate() === day && 
                selectedDate.getMonth() === currentMonth && 
                selectedDate.getFullYear() === currentYear;
              const isDisabled = isDateDisabled(date);
              
              return (
                <button
                  key={day}
                  onClick={() => handleDateSelect(day)}
                  disabled={isDisabled}
                  className={`h-10 w-10 text-sm rounded-lg transition-all duration-200 font-medium flex items-center justify-center ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed text-gray-400'
                      : isSelected
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold shadow-lg transform scale-110'
                      : isToday
                      ? 'bg-purple-100 text-purple-900 font-bold'
                      : 'hover:bg-gray-100 text-gray-700 hover:scale-105'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              if (!isDateDisabled(today)) {
                setSelectedDate(today);
                setCurrentMonth(today.getMonth());
                setCurrentYear(today.getFullYear());
                onSelectDate(today);
                onClose();
              }
            }}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            Today
          </button>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectDate(selectedDate);
                onClose();
              }}
              className="px-4 py-2 text-sm bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 font-medium shadow-md"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatePickerModal;