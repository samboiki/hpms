import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon, { SolarIcons } from './Icon';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (time: string) => void;
  initialTime?: string;
  title?: string;
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialTime = '09:00',
  title = 'Select Time'
}) => {
  // Escape closes the time picker, as its X does
  useEscapeToClose(isOpen, onClose);
  const [hours, setHours] = useState(9);
  const [minutes, setMinutes] = useState(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    if (isOpen && initialTime) {
      const [h, m] = initialTime.split(':').map(Number);
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      setHours(hour12);
      setMinutes(m);
      setPeriod(h >= 12 ? 'PM' : 'AM');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;
    
    const timeString = `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    onConfirm(timeString);
    onClose();
  };

  const quickTimes = [
    { label: '9:00 AM', value: '09:00' },
    { label: '12:00 PM', value: '12:00' },
    { label: '2:00 PM', value: '14:00' },
    { label: '5:00 PM', value: '17:00' },
    { label: '6:00 PM', value: '18:00' },
    { label: '8:00 PM', value: '20:00' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Icon icon={SolarIcons.close} className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Time Display */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-center gap-2 text-5xl font-bold text-gray-900">
                <span>{hours.toString().padStart(2, '0')}</span>
                <span className="animate-pulse">:</span>
                <span>{minutes.toString().padStart(2, '0')}</span>
                <span className="text-3xl ml-2 text-purple-600">{period}</span>
              </div>
            </div>

            {/* Time Selectors */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Hours */}
              <div className="text-center">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Hours</label>
                <div className="relative">
                  <select
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full appearance-none bg-gray-100 rounded-xl px-4 py-3 text-center font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                      <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                  <Icon icon={SolarIcons.arrowDown} className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* Minutes */}
              <div className="text-center">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Minutes</label>
                <div className="relative">
                  <select
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="w-full appearance-none bg-gray-100 rounded-xl px-4 py-3 text-center font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {Array.from({ length: 60 }, (_, i) => i).filter(m => m % 5 === 0).map(m => (
                      <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                  <Icon icon={SolarIcons.arrowDown} className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* AM/PM */}
              <div className="text-center">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Period</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPeriod('AM')}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      period === 'AM' 
                        ? 'bg-purple-600 text-white shadow-lg' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('PM')}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      period === 'PM' 
                        ? 'bg-purple-600 text-white shadow-lg' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Time Selection */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-600 mb-3">Quick Select</p>
              <div className="grid grid-cols-3 gap-2">
                {quickTimes.map((qt) => (
                  <button
                    key={qt.value}
                    type="button"
                    onClick={() => {
                      const [h, m] = qt.value.split(':').map(Number);
                      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                      setHours(hour12);
                      setMinutes(m);
                      setPeriod(h >= 12 ? 'PM' : 'AM');
                    }}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-all hover:shadow-md"
                  >
                    {qt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all transform hover:scale-[1.02]"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TimePickerModal;