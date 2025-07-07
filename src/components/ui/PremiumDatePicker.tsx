import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  getDay,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  setMonth,
  setYear,
  getMonth,
  getYear
} from 'date-fns';

interface PremiumDatePickerProps {
  value: Date | string;
  onChange: (date: string) => void;
  label?: string;
  error?: string;
  min?: Date;
  max?: Date;
  className?: string;
}

export const PremiumDatePicker: React.FC<PremiumDatePickerProps> = ({
  value,
  onChange,
  label = 'Select Date',
  error,
  min,
  max,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedDate = typeof value === 'string' ? new Date(value) : value;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowMonthDropdown(false);
        setShowYearDropdown(false);
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
    const days = eachDayOfInterval({ start, end });
    
    // Add empty cells for days before month starts
    const startDay = getDay(start);
    const emptyDays = Array(startDay).fill(null);
    
    return [...emptyDays, ...days];
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      )}
      
      <motion.button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`w-full px-4 py-3 bg-white border rounded-xl text-left flex items-center justify-between
          ${error ? 'border-red-300' : 'border-gray-200'} 
          hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500
          transition-all duration-200`}
      >
        <div className="flex items-center gap-3">
          <Icon icon="solar:calendar-date-bold-duotone" className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-700">
            {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select date'}
          </span>
        </div>
        <Icon 
          icon="solar:alt-arrow-down-bold-duotone" 
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </motion.button>

      {error && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-1 text-sm text-red-600 flex items-center gap-1"
        >
          <Icon icon="solar:danger-circle-bold" className="w-4 h-4" />
          {error}
        </motion.p>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-[380px]"
            style={{
              zIndex: 9999,
              left: buttonRef.current ? 
                (buttonRef.current.offsetLeft + 380 > window.innerWidth ? 'auto' : '0') : '0',
              right: buttonRef.current ? 
                (buttonRef.current.offsetLeft + 380 > window.innerWidth ? '0' : 'auto') : 'auto'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Select Date</h3>
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Icon icon="solar:arrow-left-bold" className="w-5 h-5 text-gray-700" />
              </button>

              <div className="flex items-center gap-2">
                {/* Month Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMonthDropdown(!showMonthDropdown);
                      setShowYearDropdown(false);
                    }}
                    className="px-4 py-2 text-lg font-bold text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {months[getMonth(currentMonth)]}
                    <Icon 
                      icon="solar:alt-arrow-down-bold" 
                      className={`w-4 h-4 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} 
                    />
                  </button>
                  
                  {showMonthDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-10"
                    >
                      {months.map((month, index) => (
                        <button
                          key={month}
                          type="button"
                          onClick={() => {
                            setCurrentMonth(setMonth(currentMonth, index));
                            setShowMonthDropdown(false);
                          }}
                          className="block w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                        >
                          {month}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Year Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowYearDropdown(!showYearDropdown);
                      setShowMonthDropdown(false);
                    }}
                    className="px-4 py-2 text-lg font-bold text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {getYear(currentMonth)}
                    <Icon 
                      icon="solar:alt-arrow-down-bold" 
                      className={`w-4 h-4 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} 
                    />
                  </button>
                  
                  {showYearDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-10"
                    >
                      {years.map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            setCurrentMonth(setYear(currentMonth, year));
                            setShowYearDropdown(false);
                          }}
                          className="block w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                        >
                          {year}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Icon icon="solar:arrow-right-bold" className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-6">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="text-sm font-semibold text-gray-500 text-center py-3">
                  {day}
                </div>
              ))}
              
              {getDaysInMonth().map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} />;
                }
                
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isCurrentDay = isToday(date);
                const isDisabled = (min && date < min) || (max && date > max);
                
                return (
                  <motion.button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => !isDisabled && handleDateSelect(date)}
                    disabled={isDisabled}
                    whileHover={!isDisabled ? { scale: 1.05 } : {}}
                    whileTap={!isDisabled ? { scale: 0.95 } : {}}
                    className={`h-12 w-12 text-sm rounded-xl transition-all duration-200 font-medium 
                      flex items-center justify-center
                      ${isSelected 
                        ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold shadow-lg scale-110' 
                        : isCurrentDay
                        ? 'bg-cyan-50 text-cyan-600 font-bold'
                        : isDisabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    {format(date, 'd')}
                  </motion.button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDateSelect(new Date())}
                className="flex-1 px-4 py-3 text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl transition-all font-semibold hover:shadow-lg"
              >
                Today
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-semibold"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PremiumDatePicker;