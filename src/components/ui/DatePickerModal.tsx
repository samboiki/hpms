import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  selectedDate?: Date;
  title?: string;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectDate,
  selectedDate: initialDate,
  title = 'Select Request Date'
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

  console.log('DatePickerModal rendering with isOpen:', isOpen, 'title:', title);

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

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day);
    setSelectedDate(newDate);
    onSelectDate(newDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 mx-4 w-full max-w-[500px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        {/* Month/Year Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button 
            onClick={handlePrevMonth}
            className="p-3 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            {/* Month Dropdown */}
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
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
              className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
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
            className="p-3 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-xs font-semibold text-gray-500 text-center py-2">
              {day}
            </div>
          ))}
          {Array.from({ length: getFirstDayOfMonth() }, (_, i) => (
            <div key={`empty-${i}`} className="h-8"></div>
          ))}
          {Array.from({ length: getDaysInMonth() }, (_, i) => {
            const day = i + 1;
            const isToday = 
              new Date().getDate() === day && 
              new Date().getMonth() === currentMonth && 
              new Date().getFullYear() === currentYear;
            const isSelected = 
              selectedDate.getDate() === day && 
              selectedDate.getMonth() === currentMonth && 
              selectedDate.getFullYear() === currentYear;
            
            return (
              <button
                key={day}
                onClick={() => handleDateSelect(day)}
                className={`h-8 w-8 text-xs rounded-lg transition-all duration-200 font-medium flex items-center justify-center ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#01b9d5] to-[#4bc0c8] text-white font-bold shadow-lg scale-110'
                    : isToday
                    ? 'bg-blue-100 text-blue-700 font-bold'
                    : 'hover:bg-gray-100 text-gray-700 hover:scale-105'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              setSelectedDate(today);
              setCurrentMonth(today.getMonth());
              setCurrentYear(today.getFullYear());
              onSelectDate(today);
              onClose();
            }}
            className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-[#01b9d5] to-[#4bc0c8] text-white rounded-lg transition-all font-medium hover:shadow-md"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatePickerModal;