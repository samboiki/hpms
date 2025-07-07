import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { Calendar, Building2, Loader2, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { format } from 'date-fns';

interface CreateLabRequestProps {
  patientId: string;
  visitId?: string;
  onClose: () => void;
  onRequestCreated: () => void;
}

export default function CreateLabRequest({ 
  patientId, 
  visitId, 
  onClose, 
  onRequestCreated 
}: CreateLabRequestProps) {
  const [requestDate, setRequestDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [preferredDate, setPreferredDate] = useState('');
  const [labFacility, setLabFacility] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'request' | 'expected'>('request');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [requestDateObj, setRequestDateObj] = useState(new Date());
  const [expectedDateObj, setExpectedDateObj] = useState(new Date());

  // Lab facility selection
  const [showLabModal, setShowLabModal] = useState(false);
  const [selectedLab, setSelectedLab] = useState('');
  const [customLabName, setCustomLabName] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);

  const labFacilities = [
    { value: 'nip', label: 'NIP' },
    { value: 'pathcare', label: 'PathCare' },
    { value: 'diagnolab', label: 'Diagnolab' },
    { value: 'nampath', label: 'Nampath' },
    { value: 'access', label: 'Access' },
    { value: 'alpha', label: 'Alpha' },
    { value: 'other', label: 'Other (Specify)' }
  ];

  // Date picker functions
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day);
    setSelectedDate(newDate);
    
    if (datePickerType === 'request') {
      setRequestDateObj(newDate);
      setRequestDate(format(newDate, 'yyyy-MM-dd'));
    } else {
      setExpectedDateObj(newDate);
      setPreferredDate(format(newDate, 'yyyy-MM-dd'));
    }
    
    setShowDatePicker(false);
  };

  const handleMonthChange = (increment: number) => {
    const newDate = new Date(currentYear, currentMonth + increment, 1);
    setCurrentMonth(newDate.getMonth());
    setCurrentYear(newDate.getFullYear());
  };

  const handleLabSelect = (lab: string) => {
    if (lab === 'other') {
      setShowOtherInput(true);
      setSelectedLab(lab);
    } else {
      setSelectedLab(lab);
      const labName = labFacilities.find(f => f.value === lab)?.label || '';
      setLabFacility(labName);
      setShowLabModal(false);
    }
  };

  const handleConfirmCustomLab = () => {
    if (customLabName.trim()) {
      setLabFacility(customLabName.trim());
      setShowLabModal(false);
      setShowOtherInput(false);
      setCustomLabName('');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('lab_requests')
        .insert({
          patient_id: patientId,
          visit_id: visitId,
          request_date: requestDate,
          preferred_date: preferredDate || null,
          lab_facility: labFacility || null,
          notes: notes || null,
          status: 'pending'
        });

      if (error) throw error;
      
      onRequestCreated();
      onClose();
    } catch (error) {
      console.error('Error creating lab request:', error);
      alert('Failed to create lab request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Create Lab Request</h2>
          <p className="text-gray-600 mt-1">Request lab tests for patient</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Request Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Request Date <span className="text-red-500">*</span>
            </label>
            <div 
              onClick={() => {
                setDatePickerType('request');
                setShowDatePicker(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent cursor-pointer flex items-center justify-between hover:bg-gray-50"
            >
              <span>{requestDateObj.toLocaleDateString()}</span>
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Expected Results Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Results Date
            </label>
            <div 
              onClick={() => {
                setDatePickerType('expected');
                setShowDatePicker(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent cursor-pointer flex items-center justify-between hover:bg-gray-50"
            >
              <span>{expectedDateObj.toLocaleDateString()}</span>
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Lab Facility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Laboratory <span className="text-red-500">*</span>
            </label>
            <div 
              onClick={() => setShowLabModal(true)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent cursor-pointer flex items-center justify-between hover:bg-gray-50"
            >
              <span className={labFacility ? 'text-gray-900' : 'text-gray-400'}>
                {labFacility || 'Select laboratory...'}
              </span>
              <Building2 className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any special instructions or tests requested"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Request</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Date Picker Modal */}
      <AnimatePresence>
        {showDatePicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowDatePicker(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 mx-4 w-full max-w-[500px] max-h-[85vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Select {datePickerType === 'request' ? 'Request' : 'Expected Results'} Date
                </h3>
                <button 
                  onClick={() => setShowDatePicker(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Month/Year Navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => handleMonthChange(-1)}
                  className="p-3 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700" />
                </button>
                
                <div className="flex items-center gap-2">
                  <select
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                    className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                      <option key={idx} value={idx}>{month}</option>
                    ))}
                  </select>
                  
                  <select
                    value={currentYear}
                    onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                    className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#01b9d4]/20 focus:border-[#01b9d4]"
                  >
                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - 25 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handleMonthChange(1)}
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
                
                {/* Empty cells for days before month starts */}
                {Array.from({ length: getFirstDayOfMonth(currentMonth, currentYear) }, (_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                
                {/* Days of the month */}
                {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }, (_, i) => {
                  const day = i + 1;
                  const isToday = 
                    day === new Date().getDate() && 
                    currentMonth === new Date().getMonth() && 
                    currentYear === new Date().getFullYear();
                  const isSelected = 
                    day === selectedDate.getDate() && 
                    currentMonth === selectedDate.getMonth() && 
                    currentYear === selectedDate.getFullYear();
                  
                  return (
                    <button
                      key={day}
                      onClick={() => handleDateSelect(day)}
                      className={`h-8 w-8 text-xs rounded-lg transition-all duration-200 font-medium flex items-center justify-center
                        ${isSelected 
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

              {/* Quick Actions */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setCurrentMonth(today.getMonth());
                    setCurrentYear(today.getFullYear());
                    handleDateSelect(today.getDate());
                  }}
                  className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-[#01b9d5] to-[#4bc0c8] text-white rounded-lg transition-all font-medium hover:shadow-md"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lab Facility Selection Modal */}
      <AnimatePresence>
        {showLabModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowLabModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 mx-4 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Select Lab Facility</h3>
                <button 
                  onClick={() => {
                    setShowLabModal(false);
                    setShowOtherInput(false);
                    setCustomLabName('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {!showOtherInput ? (
                <div className="space-y-2">
                  {labFacilities.map(lab => (
                    <button
                      key={lab.value}
                      onClick={() => handleLabSelect(lab.value)}
                      className={`w-full p-4 text-left rounded-lg border transition-all hover:border-cyan-500 hover:bg-cyan-50 flex items-center justify-between group
                        ${selectedLab === lab.value ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className={`w-5 h-5 ${selectedLab === lab.value ? 'text-cyan-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${selectedLab === lab.value ? 'text-cyan-700' : 'text-gray-700'}`}>
                          {lab.label}
                        </span>
                      </div>
                      {selectedLab === lab.value && <Check className="w-5 h-5 text-cyan-600" />}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Please specify the lab facility name:</p>
                  <input
                    type="text"
                    value={customLabName}
                    onChange={(e) => setCustomLabName(e.target.value)}
                    placeholder="Enter lab facility name..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowOtherInput(false);
                        setCustomLabName('');
                      }}
                      className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirmCustomLab}
                      disabled={!customLabName.trim()}
                      className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}