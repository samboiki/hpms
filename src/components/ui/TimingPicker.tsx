import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';
import { motion, AnimatePresence } from 'framer-motion';

export interface TimingOption {
  id: string;
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  when: 'before' | 'after';
  label?: string;
  enabled?: boolean;
}

interface TimingPickerProps {
  value: TimingOption[];
  onChange: (value: TimingOption[]) => void;
  maxTimings?: number;
  presets?: TimingOption[];
  customTemplates?: TimingOption[];
  onCustomTemplateAdd?: (template: TimingOption) => void;
  onCustomTemplateRemove?: (id: string) => void;
  className?: string;
}

const TIME_UNITS = [
  { value: 'minutes', label: 'Minutes', max: 59 },
  { value: 'hours', label: 'Hours', max: 23 },
  { value: 'days', label: 'Days', max: 30 },
  { value: 'weeks', label: 'Weeks', max: 4 },
  { value: 'months', label: 'Months', max: 12 }
];

const PRESET_TIMINGS: TimingOption[] = [
  // Before presets - Short term
  { id: 'preset-1', value: 5, unit: 'minutes', when: 'before', label: '5 minutes before' },
  { id: 'preset-2', value: 10, unit: 'minutes', when: 'before', label: '10 minutes before' },
  { id: 'preset-3', value: 15, unit: 'minutes', when: 'before', label: '15 minutes before' },
  { id: 'preset-4', value: 30, unit: 'minutes', when: 'before', label: '30 minutes before' },
  { id: 'preset-5', value: 45, unit: 'minutes', when: 'before', label: '45 minutes before' },
  { id: 'preset-6', value: 1, unit: 'hours', when: 'before', label: '1 hour before' },
  { id: 'preset-7', value: 2, unit: 'hours', when: 'before', label: '2 hours before' },
  { id: 'preset-8', value: 3, unit: 'hours', when: 'before', label: '3 hours before' },
  { id: 'preset-9', value: 6, unit: 'hours', when: 'before', label: '6 hours before' },
  { id: 'preset-10', value: 12, unit: 'hours', when: 'before', label: '12 hours before' },
  
  // Before presets - Long term
  { id: 'preset-11', value: 1, unit: 'days', when: 'before', label: '1 day before' },
  { id: 'preset-12', value: 2, unit: 'days', when: 'before', label: '2 days before' },
  { id: 'preset-13', value: 3, unit: 'days', when: 'before', label: '3 days before' },
  { id: 'preset-14', value: 5, unit: 'days', when: 'before', label: '5 days before' },
  { id: 'preset-15', value: 1, unit: 'weeks', when: 'before', label: '1 week before' },
  { id: 'preset-16', value: 2, unit: 'weeks', when: 'before', label: '2 weeks before' },
  
  // After presets - Short term
  { id: 'preset-17', value: 15, unit: 'minutes', when: 'after', label: '15 minutes after' },
  { id: 'preset-18', value: 30, unit: 'minutes', when: 'after', label: '30 minutes after' },
  { id: 'preset-19', value: 1, unit: 'hours', when: 'after', label: '1 hour after' },
  { id: 'preset-20', value: 2, unit: 'hours', when: 'after', label: '2 hours after' },
  { id: 'preset-21', value: 4, unit: 'hours', when: 'after', label: '4 hours after' },
  
  // After presets - Long term
  { id: 'preset-22', value: 1, unit: 'days', when: 'after', label: '1 day after' },
  { id: 'preset-23', value: 2, unit: 'days', when: 'after', label: '2 days after' },
  { id: 'preset-24', value: 3, unit: 'days', when: 'after', label: '3 days after' },
  { id: 'preset-25', value: 5, unit: 'days', when: 'after', label: '5 days after' },
  { id: 'preset-26', value: 1, unit: 'weeks', when: 'after', label: '1 week after' },
  { id: 'preset-27', value: 2, unit: 'weeks', when: 'after', label: '2 weeks after' },
  { id: 'preset-28', value: 1, unit: 'months', when: 'after', label: '1 month after' }
];

export const TimingPicker: React.FC<TimingPickerProps> = ({
  value = [],
  onChange,
  maxTimings = 5,
  presets = PRESET_TIMINGS,
  customTemplates = [],
  onCustomTemplateAdd,
  onCustomTemplateRemove,
  className
}) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState<number>(1);
  const [customUnit, setCustomUnit] = useState<TimingOption['unit']>('hours');
  const [customWhen, setCustomWhen] = useState<TimingOption['when']>('before');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [customTemplateName, setCustomTemplateName] = useState('');

  const addTiming = (timing: TimingOption) => {
    if (value.length >= maxTimings) return;
    
    const newTiming = {
      ...timing,
      id: `timing-${Date.now()}`,
      enabled: true
    };
    
    onChange([...value, newTiming]);
  };

  const removeTiming = (id: string) => {
    onChange(value.filter(t => t.id !== id));
  };

  const toggleTiming = (id: string) => {
    onChange(value.map(t => 
      t.id === id ? { ...t, enabled: !t.enabled } : t
    ));
  };

  const addCustomTiming = () => {
    const label = customTemplateName || `${customValue} ${customUnit} ${customWhen}`;
    const newTiming: TimingOption = {
      id: `custom-${Date.now()}`,
      value: customValue,
      unit: customUnit,
      when: customWhen,
      label,
      enabled: true
    };
    
    // Add to current timings
    addTiming(newTiming);
    
    // Save as template if requested
    if (saveAsTemplate && onCustomTemplateAdd) {
      onCustomTemplateAdd({
        ...newTiming,
        id: `template-${Date.now()}`,
        enabled: false // Templates start disabled
      });
    }
    
    // Reset form
    setShowCustom(false);
    setCustomValue(1);
    setCustomUnit('hours');
    setCustomWhen('before');
    setSaveAsTemplate(false);
    setCustomTemplateName('');
  };

  const formatTimingLabel = (timing: TimingOption) => {
    if (timing.label) return timing.label;
    return `${timing.value} ${timing.unit} ${timing.when || 'before'}`;
  };

  const getUnitMax = (unit: TimingOption['unit']) => {
    return TIME_UNITS.find(u => u.value === unit)?.max || 99;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Active Timings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">Active Reminders</h4>
          <span className="text-xs text-gray-500">
            {value.length}/{maxTimings} timings
          </span>
        </div>

        <AnimatePresence mode="popLayout">
          {value.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, type: "spring" }}
              className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
              >
                <Icon icon="solar:clock-circle-broken" className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              </motion.div>
              <p className="text-sm text-gray-500">No reminders configured</p>
              <p className="text-xs text-gray-400 mt-1">Add timings from presets below</p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {value.map((timing, index) => (
                <motion.div
                  key={timing.id}
                  layout
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -100, scale: 0.8 }}
                  transition={{ 
                    duration: 0.3, 
                    type: "spring",
                    delay: index * 0.05
                  }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-all shadow-sm hover:shadow-md',
                    timing.enabled 
                      ? 'bg-amber-50 border-amber-200' 
                      : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <motion.button
                      onClick={() => toggleTiming(timing.id)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                        timing.enabled
                          ? 'bg-amber-500 border-amber-500'
                          : 'bg-white border-gray-300'
                      )}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <AnimatePresence>
                        {timing.enabled && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ duration: 0.3, type: "spring" }}
                          >
                            <Icon icon="solar:check-bold" className="w-3 h-3 text-white" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                    
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        timing.enabled ? 'text-gray-900' : 'text-gray-500'
                      )}>
                        Reminder {index + 1}
                      </p>
                      <p className={cn(
                        'text-xs',
                        timing.enabled ? 'text-gray-600' : 'text-gray-400'
                      )}>
                        {formatTimingLabel(timing)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => removeTiming(timing.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Preset Timings */}
      {value.length < maxTimings && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Add Presets</h4>
          
          {/* Before Templates */}
          <div className="mb-4">
            <h5 className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
              <Icon icon="solar:rewind-back-bold-duotone" className="w-4 h-4" />
              Before Event
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {presets.filter(p => p.when === 'before').map(preset => {
                const isAdded = value.some(t => 
                  t.value === preset.value && t.unit === preset.unit && t.when === preset.when
                );
                
                return (
                  <motion.button
                  key={preset.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: presets.indexOf(preset) * 0.03 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => !isAdded && addTiming(preset)}
                  disabled={isAdded}
                  className={cn(
                    'px-3 py-2 text-xs font-medium rounded-lg border transition-all shadow-sm hover:shadow-md',
                    isAdded
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                  )}
                >
                    {isAdded ? (
                      <span className="flex items-center justify-center gap-1">
                        <Icon icon="solar:check-circle-bold" className="w-3 h-3" />
                        Added
                      </span>
                    ) : (
                      preset.label
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* After Templates */}
          <div className="mb-4">
            <h5 className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
              <Icon icon="solar:rewind-forward-bold-duotone" className="w-4 h-4" />
              After Event
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {presets.filter(p => p.when === 'after').map(preset => {
                const isAdded = value.some(t => 
                  t.value === preset.value && t.unit === preset.unit && t.when === preset.when
                );
                
                return (
                  <motion.button
                    key={preset.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: presets.indexOf(preset) * 0.03 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => !isAdded && addTiming(preset)}
                    disabled={isAdded}
                    className={cn(
                      'px-3 py-2 text-xs font-medium rounded-lg border transition-all shadow-sm hover:shadow-md',
                      isAdded
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                    )}
                  >
                    {isAdded ? (
                      <span className="flex items-center justify-center gap-1">
                        <Icon icon="solar:check-circle-bold" className="w-3 h-3" />
                        Added
                      </span>
                    ) : (
                      preset.label
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Custom Templates Section */}
          {customTemplates.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                <Icon icon="solar:star-bold-duotone" className="w-4 h-4" />
                Custom Templates
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {customTemplates.map(template => {
                  const isAdded = value.some(t => 
                    t.value === template.value && t.unit === template.unit && t.when === template.when
                  );
                  
                  return (
                    <div key={template.id} className="relative group">
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => !isAdded && addTiming(template)}
                        disabled={isAdded}
                        className={cn(
                          'w-full px-3 py-2 text-xs font-medium rounded-lg border transition-all shadow-sm hover:shadow-md',
                          isAdded
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-50 border-purple-300 text-purple-700 hover:border-purple-400 hover:bg-purple-100'
                        )}
                      >
                        {isAdded ? (
                          <span className="flex items-center justify-center gap-1">
                            <Icon icon="solar:check-circle-bold" className="w-3 h-3" />
                            Added
                          </span>
                        ) : (
                          template.label
                        )}
                      </motion.button>
                      {onCustomTemplateRemove && (
                        <button
                          onClick={() => onCustomTemplateRemove(template.id)}
                          className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Icon icon="solar:close-bold" className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Timing Button */}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="w-full px-3 py-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
          >
            <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" />
            Create Custom Timing
          </button>
        </div>
      )}

      {/* Custom Timing Input */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Time Value
                  </label>
                  <input
                    type="number"
                    value={customValue}
                    onChange={(e) => setCustomValue(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max={getUnitMax(customUnit)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Time Unit
                  </label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as TimingOption['unit'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    {TIME_UNITS.map(unit => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    When
                  </label>
                  <select
                    value={customWhen}
                    onChange={(e) => setCustomWhen(e.target.value as TimingOption['when'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="before">Before</option>
                    <option value="after">After</option>
                  </select>
                </div>
              </div>

              {/* Save as Template Option */}
              {onCustomTemplateAdd && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsTemplate}
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-xs font-medium text-gray-700">Save as reusable template</span>
                  </label>
                  
                  {saveAsTemplate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <input
                        type="text"
                        value={customTemplateName}
                        onChange={(e) => setCustomTemplateName(e.target.value)}
                        placeholder="Template name (optional)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </motion.div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={addCustomTiming}
                  className="flex-1 px-3 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-all"
                >
                  Add Custom Timing
                </button>
                <button
                  onClick={() => {
                    setShowCustom(false);
                    setSaveAsTemplate(false);
                    setCustomTemplateName('');
                  }}
                  className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-1">Smart Timing Tips</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Send appointment reminders 24 hours and 2 hours before</li>
              <li>Payment reminders work best at 7, 14, and 30 days</li>
              <li>Avoid sending messages too early in the morning or late at night</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimingPicker;