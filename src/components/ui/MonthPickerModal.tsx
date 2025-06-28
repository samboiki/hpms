import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';

interface MonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMonth: (month: string) => void;
  selectedMonth?: string;
  title?: string;
  minDate?: string;
  maxDate?: string;
}

const MonthPickerModal: React.FC<MonthPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectMonth,
  selectedMonth,
  title = 'Select Month',
  minDate,
  maxDate
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(new Date().getMonth());

  useEffect(() => {
    if (selectedMonth) {
      const date = new Date(selectedMonth);
      setSelectedYear(date.getFullYear());
      setSelectedMonthIndex(date.getMonth());
    }
  }, [selectedMonth]);

  if (!isOpen) return null;

  const months = [
    'January', 'February', 'March', 'April', 
    'May', 'June', 'July', 'August', 
    'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const isMonthDisabled = (year: number, monthIndex: number) => {
    const monthDate = new Date(year, monthIndex, 1);
    
    if (minDate) {
      const min = new Date(minDate);
      if (monthDate < new Date(min.getFullYear(), min.getMonth(), 1)) return true;
    }
    
    if (maxDate) {
      const max = new Date(maxDate);
      if (monthDate > new Date(max.getFullYear(), max.getMonth(), 1)) return true;
    }
    
    return false;
  };

  const handleMonthSelect = (monthIndex: number) => {
    const date = new Date(selectedYear, monthIndex, 1);
    onSelectMonth(format(date, 'yyyy-MM'));
    onClose();
  };

  const handleYearChange = (direction: 'prev' | 'next') => {
    setSelectedYear(prev => direction === 'prev' ? prev - 1 : prev + 1);
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
          
          {/* Year Navigation */}
          <div className="flex items-center justify-between">
            <button 
              onClick={() => handleYearChange('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-5 h-5 text-gray-700" />
            </button>
            
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            
            <button 
              onClick={() => handleYearChange('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Month Grid */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2">
            {months.map((month, index) => {
              const isSelected = selectedYear === new Date(selectedMonth || '').getFullYear() && 
                               index === new Date(selectedMonth || '').getMonth();
              const isDisabled = isMonthDisabled(selectedYear, index);
              const isCurrent = selectedYear === new Date().getFullYear() && 
                               index === new Date().getMonth();
              
              return (
                <button
                  key={month}
                  onClick={() => !isDisabled && handleMonthSelect(index)}
                  disabled={isDisabled}
                  className={`
                    px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                    ${isDisabled
                      ? 'opacity-50 cursor-not-allowed text-gray-400 bg-gray-50'
                      : isSelected
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg transform scale-105'
                      : isCurrent
                      ? 'bg-purple-100 text-purple-900 font-bold'
                      : 'hover:bg-gray-100 text-gray-700 hover:scale-105'
                    }
                  `}
                >
                  {month.slice(0, 3)}
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
              const now = new Date();
              setSelectedYear(now.getFullYear());
              setSelectedMonthIndex(now.getMonth());
              onSelectMonth(format(now, 'yyyy-MM'));
              onClose();
            }}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            Current Month
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
                const date = new Date(selectedYear, selectedMonthIndex, 1);
                onSelectMonth(format(date, 'yyyy-MM'));
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

export default MonthPickerModal;