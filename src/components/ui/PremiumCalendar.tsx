import React, { useState } from 'react';
import Calendar from 'react-calendar';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import 'react-calendar/dist/Calendar.css';

interface ModernCalendarProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  showTimeSelector?: boolean;
  timeSlots?: string[];
  selectedTime?: string;
  onTimeChange?: (time: string) => void;
}

const PremiumCalendar: React.FC<ModernCalendarProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  className = '',
  showTimeSelector = false,
  timeSlots = [],
  selectedTime,
  onTimeChange
}) => {
  const [view, setView] = useState<'calendar' | 'time'>('calendar');

  const handleDateChange = (date: Date | Date[] | null) => {
    if (date instanceof Date) {
      onChange(date);
      if (showTimeSelector && timeSlots.length > 0) {
        setView('time');
      }
    } else {
      onChange(null);
    }
  };

  const formatShortWeekday = (locale: string | undefined, date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
  };

  const formatMonthYear = (locale: string | undefined, date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = value && date.toDateString() === value.toDateString();
      const isPast = date < today && !isToday;

      let classes = 'calendar-tile';
      
      if (isSelected) {
        classes += ' selected';
      } else if (isToday) {
        classes += ' today';
      }
      
      if (isPast) {
        classes += ' past';
      }

      return classes;
    }
    return null;
  };

  return (
    <div className={`modern-calendar-container ${className}`}>
      <style jsx>{`
        .modern-calendar-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        }

        .modern-calendar-container .react-calendar {
          width: 100%;
          background: white;
          border: none;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          padding: 20px;
          overflow: hidden;
        }

        .modern-calendar-container .react-calendar__navigation {
          height: 60px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modern-calendar-container .react-calendar__navigation button {
          background: none;
          border: none;
          font-size: 18px;
          font-weight: 600;
          color: #374151;
          padding: 12px;
          border-radius: 12px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modern-calendar-container .react-calendar__navigation button:hover {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .modern-calendar-container .react-calendar__navigation__label {
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
        }

        .modern-calendar-container .react-calendar__month-view__weekdays {
          margin-bottom: 10px;
        }

        .modern-calendar-container .react-calendar__month-view__weekdays__weekday {
          padding: 12px 8px;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-align: center;
        }

        .modern-calendar-container .react-calendar__tile {
          background: none;
          border: none;
          padding: 0;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin: 2px;
          transition: all 0.2s ease;
          position: relative;
        }

        .modern-calendar-container .react-calendar__tile:hover {
          background: linear-gradient(135deg, #ddd6fe, #e0e7ff);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .modern-calendar-container .calendar-tile.selected {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6) !important;
          color: white !important;
          transform: scale(1.05);
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
        }

        .modern-calendar-container .calendar-tile.today {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          font-weight: 700;
        }

        .modern-calendar-container .calendar-tile.past {
          color: #9ca3af;
          background: #f9fafb;
        }

        .modern-calendar-container .react-calendar__tile--active {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6) !important;
          color: white !important;
        }

        .modern-calendar-container .react-calendar__tile--active:hover {
          background: linear-gradient(135deg, #2563eb, #7c3aed) !important;
        }

        .modern-calendar-container .react-calendar__month-view__days__day--neighboringMonth {
          color: #d1d5db !important;
        }
      `}</style>

      <AnimatePresence mode="wait">
        {view === 'calendar' ? (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Calendar
              onChange={handleDateChange}
              value={value}
              minDate={minDate}
              maxDate={maxDate}
              formatShortWeekday={formatShortWeekday}
              formatMonthYear={formatMonthYear}
              tileClassName={tileClassName}
              navigationLabel={({ date, view }) => (
                <motion.span
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <CalendarIcon className="w-5 h-5" />
                  {formatMonthYear(undefined, date)}
                </motion.span>
              )}
              prevLabel={<ChevronLeft className="w-5 h-5" />}
              nextLabel={<ChevronRight className="w-5 h-5" />}
              prev2Label={null}
              next2Label={null}
            />
          </motion.div>
        ) : (
          showTimeSelector && (
            <motion.div
              key="time"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setView('calendar')}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Calendar
                </button>
                <div className="text-lg font-semibold text-gray-900">
                  {value?.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {timeSlots.map((time) => (
                  <motion.button
                    key={time}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onTimeChange?.(time)}
                    className={`p-3 rounded-lg font-medium transition-all ${
                      selectedTime === time
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                    }`}
                  >
                    {time}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
};

export default PremiumCalendar;