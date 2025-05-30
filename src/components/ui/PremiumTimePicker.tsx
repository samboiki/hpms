import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronUp, ChevronDown, Sunrise, Sun, Sunset, Moon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface PremiumTimePickerProps {
  value?: string;
  onChange: (time: string) => void;
  label?: string;
  error?: string;
  min?: string;
  max?: string;
  step?: number;
  className?: string;
}

export const PremiumTimePicker: React.FC<PremiumTimePickerProps> = ({
  value = '09:00',
  onChange,
  label = 'Select Time',
  error,
  min = '00:00',
  max = '23:59',
  step = 15,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState(parseInt(value.split(':')[0]));
  const [minutes, setMinutes] = useState(parseInt(value.split(':')[1]));
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (h: number, m: number) => {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleTimeSelect = (h: number, m: number) => {
    setHours(h);
    setMinutes(m);
    onChange(formatTime(h, m));
    setIsOpen(false);
  };

  const getTimeOfDayIcon = (hour: number) => {
    if (hour >= 5 && hour < 12) return Sunrise;
    if (hour >= 12 && hour < 17) return Sun;
    if (hour >= 17 && hour < 21) return Sunset;
    return Moon;
  };

  const getTimeOfDayColor = (hour: number) => {
    if (hour >= 5 && hour < 12) return 'from-amber-400 to-orange-500';
    if (hour >= 12 && hour < 17) return 'from-blue-400 to-cyan-500';
    if (hour >= 17 && hour < 21) return 'from-purple-400 to-pink-500';
    return 'from-indigo-400 to-purple-500';
  };

  const popularTimes = [
    { time: '09:00', label: 'Morning' },
    { time: '12:00', label: 'Noon' },
    { time: '15:00', label: 'Afternoon' },
    { time: '18:00', label: 'Evening' }
  ];

  const TimeIcon = getTimeOfDayIcon(hours);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-3 rounded-xl border transition-all duration-200",
          "bg-white hover:bg-gray-50 text-left flex items-center justify-between",
          "focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent",
          error ? "border-red-300" : "border-gray-200 hover:border-gray-300",
          isOpen && "border-[#01b9d5] shadow-lg"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg bg-gradient-to-br shadow-sm",
            getTimeOfDayColor(hours)
          )}>
            <TimeIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {formatTime(hours, minutes)}
            </p>
            <p className="text-xs text-gray-500">
              {hours < 12 ? 'AM' : 'PM'}
            </p>
          </div>
        </div>
        <Clock className={cn(
          "w-5 h-5 transition-transform",
          isOpen ? "text-[#01b9d5] rotate-180" : "text-gray-400"
        )} />
      </motion.button>

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
          >
            {/* Popular Times */}
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-medium text-gray-600 mb-2">Quick Select</p>
              <div className="grid grid-cols-4 gap-2">
                {popularTimes.map((item) => {
                  const [h, m] = item.time.split(':').map(Number);
                  return (
                    <motion.button
                      key={item.time}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTimeSelect(h, m)}
                      className={cn(
                        "p-2 rounded-lg text-xs font-medium transition-all",
                        formatTime(hours, minutes) === item.time
                          ? "bg-[#01b9d5] text-white shadow-sm"
                          : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                      )}
                    >
                      <p>{item.time}</p>
                      <p className="text-[10px] opacity-75">{item.label}</p>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Custom Time Selection */}
            <div className="p-4">
              <div className="flex items-center justify-center gap-4">
                {/* Hours */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setHours(h => (h + 1) % 24)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  </button>
                  <div className="my-2">
                    <input
                      type="text"
                      value={hours.toString().padStart(2, '0')}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 0 && val < 24) {
                          setHours(val);
                        }
                      }}
                      className="w-16 h-16 text-2xl font-bold text-center rounded-lg border-2 border-gray-200 focus:border-[#01b9d5] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setHours(h => (h - 1 + 24) % 24)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="text-2xl font-bold text-gray-400">:</div>

                {/* Minutes */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMinutes(m => (m + step) % 60)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  </button>
                  <div className="my-2">
                    <input
                      type="text"
                      value={minutes.toString().padStart(2, '0')}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 0 && val < 60) {
                          setMinutes(val);
                        }
                      }}
                      className="w-16 h-16 text-2xl font-bold text-center rounded-lg border-2 border-gray-200 focus:border-[#01b9d5] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMinutes(m => (m - step + 60) % 60)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* AM/PM Display */}
                <div className="ml-2">
                  <div className={cn(
                    "px-3 py-2 rounded-lg font-medium text-sm",
                    hours < 12 
                      ? "bg-amber-100 text-amber-700" 
                      : "bg-indigo-100 text-indigo-700"
                  )}>
                    {hours < 12 ? 'AM' : 'PM'}
                  </div>
                </div>
              </div>

              {/* Time Slots Grid */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-2">Common Slots</p>
                <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {Array.from({ length: 24 }, (_, h) => 
                    Array.from({ length: 60 / step }, (_, m) => {
                      const hour = h;
                      const minute = m * step;
                      const timeStr = formatTime(hour, minute);
                      
                      return (
                        <motion.button
                          key={timeStr}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onMouseEnter={() => setHoveredSlot(timeStr)}
                          onMouseLeave={() => setHoveredSlot(null)}
                          onClick={() => handleTimeSelect(hour, minute)}
                          className={cn(
                            "p-1.5 text-xs rounded transition-all",
                            formatTime(hours, minutes) === timeStr
                              ? "bg-[#01b9d5] text-white font-medium shadow-sm"
                              : hoveredSlot === timeStr
                              ? "bg-gray-100 text-gray-700"
                              : "text-gray-500 hover:bg-gray-50"
                          )}
                        >
                          {timeStr}
                        </motion.button>
                      );
                    })
                  ).flat()}
                </div>
              </div>

              {/* Set Time Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTimeSelect(hours, minutes)}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-[#01b9d5] to-[#0197a4] text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                Set Time
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};