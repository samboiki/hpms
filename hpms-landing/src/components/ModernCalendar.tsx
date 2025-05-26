'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface ModernCalendarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  minDate?: Date;
  maxDate?: Date;
  primaryColor: string;
}

export default function ModernCalendar({ 
  selectedDate, 
  onDateSelect, 
  minDate = new Date(),
  maxDate,
  primaryColor 
}: ModernCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(
    selectedDate ? new Date(selectedDate) : null
  );

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    
    return false;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    if (!selectedDateObj) return false;
    return date.getDate() === selectedDateObj.getDate() &&
           date.getMonth() === selectedDateObj.getMonth() &&
           date.getFullYear() === selectedDateObj.getFullYear();
  };

  const handleDateClick = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    if (!isDateDisabled(date)) {
      setSelectedDateObj(date);
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      onDateSelect(formattedDate);
    }
  };

  const changeMonth = (increment: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + increment, 1));
  };

  const renderCalendarDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const startDay = firstDayOfMonth(currentMonth);

    // Empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const disabled = isDateDisabled(date);
      const today = isToday(date);
      const selected = isSelected(date);

      days.push(
        <motion.button
          key={day}
          type="button"
          whileHover={!disabled ? { scale: 1.1 } : {}}
          whileTap={!disabled ? { scale: 0.95 } : {}}
          onClick={() => handleDateClick(day)}
          disabled={disabled}
          className={`
            h-10 w-10 rounded-xl font-medium transition-all duration-200
            ${disabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100'}
            ${today && !selected ? 'border-2 border-gray-300' : ''}
            ${selected ? 'text-white shadow-lg' : ''}
          `}
          style={{
            backgroundColor: selected ? primaryColor : undefined,
            borderColor: today && !selected ? primaryColor : undefined
          }}
        >
          {day}
        </motion.button>
      );
    }

    return days;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <motion.button
          type="button"
          onClick={() => changeMonth(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </motion.button>
        
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
        </div>
        
        <motion.button
          type="button"
          onClick={() => changeMonth(1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </motion.button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-600 h-8 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMonth.toString()}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="contents"
          >
            {renderCalendarDays()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Selected Date Display */}
      {selectedDateObj && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200"
        >
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" style={{ color: primaryColor }} />
            <span className="font-medium text-gray-700">Selected:</span>
            <span className="font-semibold text-gray-900">
              {selectedDateObj.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}