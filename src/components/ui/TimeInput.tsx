import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import TimePickerModal from './TimePickerModal';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select time',
  required = false,
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const formatTimeDisplay = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

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
          <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-gray-400" />
          <span className={value ? 'text-gray-900' : 'text-gray-500'}>
            {value ? formatTimeDisplay(value) : placeholder}
          </span>
        </div>
        {value && !disabled && (
          <button
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
          </button>
        )}
      </div>

      <TimePickerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={onChange}
        initialTime={value || '09:00'}
        title={label || 'Select Time'}
      />
    </div>
  );
};

export default TimeInput;