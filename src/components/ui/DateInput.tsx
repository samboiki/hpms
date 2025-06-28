import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import DatePickerModal from './DatePickerModal';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select a date',
  minDate,
  maxDate,
  required = false,
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleDateSelect = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const displayValue = value ? format(new Date(value), 'MMM dd, yyyy') : '';
  const selectedDate = value ? new Date(value) : undefined;
  const minDateObj = minDate ? new Date(minDate) : undefined;
  const maxDateObj = maxDate ? new Date(maxDate) : undefined;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div
        onClick={() => !disabled && setIsOpen(true)}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg flex items-center justify-between transition-colors ${
          disabled 
            ? 'bg-gray-100 cursor-not-allowed opacity-60' 
            : 'cursor-pointer hover:border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-gray-400" />
          <span className={displayValue ? 'text-gray-900' : 'text-gray-500'}>
            {displayValue || placeholder}
          </span>
        </div>
        {displayValue && !disabled && (
          <button
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
          </button>
        )}
      </div>

      <DatePickerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelectDate={handleDateSelect}
        selectedDate={selectedDate}
        title={label || 'Select Date'}
        minDate={minDateObj}
        maxDate={maxDateObj}
      />
    </div>
  );
};

export default DateInput;