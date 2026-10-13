import React, { useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TestTube, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  FileText, 
  User,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface LabRequestFormProps {
  patientId: string;
  visitId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  editRequest?: any; // For editing existing requests
}

const LabRequestForm: React.FC<LabRequestFormProps> = ({
  patientId,
  visitId,
  onSuccess,
  onCancel,
  editRequest
}) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    test_name: editRequest?.test_name || '',
    test_code: editRequest?.test_code || '',
    test_category: editRequest?.test_category || 'blood_work',
    lab_facility: editRequest?.lab_facility || '',
    clinical_indication: editRequest?.clinical_indication || '',
    special_instructions: editRequest?.special_instructions || '',
    fasting_required: editRequest?.fasting_required || false,
    priority: editRequest?.priority || 'routine',
    preferred_date: editRequest?.preferred_date || '',
    notes: editRequest?.notes || ''
  });

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'request' | 'expected'>('request');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  // Start from the saved dates when editing, so saving doesn't silently move them to today
  const [requestDate, setRequestDate] = useState(editRequest?.request_date ? new Date(editRequest.request_date) : new Date());
  const [expectedDate, setExpectedDate] = useState(editRequest?.preferred_date ? new Date(editRequest.preferred_date) : new Date());

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

  const testCategories = [
    { value: 'blood_work', label: 'Blood Work' },
    { value: 'urine_analysis', label: 'Urine Analysis' },
    { value: 'microbiology', label: 'Microbiology' },
    { value: 'chemistry', label: 'Chemistry' },
    { value: 'pathology', label: 'Pathology' },
    { value: 'genetics', label: 'Genetics' },
    { value: 'other', label: 'Other' }
  ];

  const priorities = [
    { value: 'routine', label: 'Routine', color: 'bg-blue-100 text-blue-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-orange-100 text-orange-800' },
    { value: 'stat', label: 'STAT', color: 'bg-red-100 text-red-800' }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
      setRequestDate(newDate);
      // Update form data with formatted date
      handleInputChange('request_date', format(newDate, 'yyyy-MM-dd'));
    } else {
      setExpectedDate(newDate);
      handleInputChange('preferred_date', format(newDate, 'yyyy-MM-dd'));
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
      handleInputChange('lab_facility', labName);
      setShowLabModal(false);
    }
  };

  const handleConfirmCustomLab = () => {
    if (customLabName.trim()) {
      handleInputChange('lab_facility', customLabName.trim());
      setShowLabModal(false);
      setShowOtherInput(false);
      setCustomLabName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('🔘 Lab Request Form - handleSubmit called');
    e.preventDefault();
    
    try {
      if (!user) {
        console.error('❌ Lab Request Form - No user logged in');
        toast.error('You must be logged in to create requests');
        return;
      }

      if (!formData.test_name.trim() || !formData.clinical_indication.trim()) {
        console.error('❌ Lab Request Form - Missing required fields:', {
          test_name: formData.test_name,
          clinical_indication: formData.clinical_indication
        });
        toast.error('Please fill in all required fields');
        return;
      }

      console.log('✅ Lab Request Form - Starting submission');
      setLoading(true);
      
      // Create request data with only fields that exist in the lab_requests table
      const requestData = {
        test_name: formData.test_name,
        test_category: formData.test_category,
        clinical_indication: formData.clinical_indication,
        priority: formData.priority,
        status: 'pending',
        patient_id: patientId,
        visit_id: visitId,
        requested_by: user.id,
        // The date shown in the picker, as a local calendar date (toISOString gave the previous day before 02:00)
        request_date: format(requestDate, 'yyyy-MM-dd'),
        // Convert empty dates to null to avoid validation errors
        preferred_date: formData.preferred_date || null,
        notes: formData.notes || null
      };

      let result;
      if (editRequest) {
        // Update existing request
        result = await supabase
          .from('lab_requests')
          .update(requestData)
          .eq('id', editRequest.id)
          .select()
          .single();
      } else {
        // Create new request
        result = await supabase
          .from('lab_requests')
          .insert([requestData])
          .select()
          .single();
      }

      if (result.error) {
        console.error('❌ Error saving lab request:', result.error);
        console.error('❌ Request data that failed:', requestData);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to save lab request.';
        if (result.error.code === '42703') {
          errorMessage = 'Database column missing. The lab_requests table may need to be updated.';
        } else if (result.error.code === '23502') {
          errorMessage = 'Required field missing. Please fill in all required fields.';
        } else if (result.error.message) {
          errorMessage = result.error.message;
        }
        
        toast.error(errorMessage);
        setLoading(false);
        return; // Don't close modal on error
      }

      console.log('✅ Lab request saved successfully:', result.data);
      onSuccess();
      
    } catch (error) {
      console.error('💥 Error saving lab request:', error);
      const errorMessage = error instanceof Error ? plainWords(error.message) : 'Unknown error occurred';
      toast.error(`Failed to save lab request: ${errorMessage}`);
      setLoading(false);
      // Don't close modal on error - let user try again
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg p-6 border border-gray-200"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <TestTube className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {editRequest ? 'Edit Lab Request' : 'New Lab Request'}
            </h3>
            <p className="text-sm text-gray-600">Request laboratory tests for this patient</p>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close lab request form"
          title="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-6">
        {/* Test Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Name *
            </label>
            <input
              type="text"
              value={formData.test_name}
              onChange={(e) => handleInputChange('test_name', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., Complete Blood Count"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Code
            </label>
            <input
              type="text"
              value={formData.test_code}
              onChange={(e) => handleInputChange('test_code', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., CBC"
            />
          </div>
        </div>

        {/* Category and Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Category *
            </label>
            <select
              value={formData.test_category}
              onChange={(e) => handleInputChange('test_category', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            >
              {testCategories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {priorities.map(priority => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleInputChange('priority', priority.value);
                  }}
                  className={`p-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.priority === priority.value
                      ? priority.color
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {priority.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Date *
            </label>
            <div 
              onClick={() => {
                setDatePickerType('request');
                setShowDatePicker(true);
              }}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 cursor-pointer flex items-center justify-between hover:bg-gray-50"
            >
              <span>{format(requestDate, 'dd MMM yyyy')}</span>
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Results Date
            </label>
            <div 
              onClick={() => {
                setDatePickerType('expected');
                setShowDatePicker(true);
              }}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 cursor-pointer flex items-center justify-between hover:bg-gray-50"
            >
              <span className={formData.preferred_date ? 'text-gray-900' : 'text-gray-400'}>
                {formData.preferred_date ? format(expectedDate, 'dd MMM yyyy') : 'Not set'}
              </span>
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Lab Facility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Lab Facility *
          </label>
          <div 
            onClick={() => setShowLabModal(true)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 cursor-pointer flex items-center justify-between hover:bg-gray-50"
          >
            <span className={formData.lab_facility ? 'text-gray-900' : 'text-gray-400'}>
              {formData.lab_facility || 'Select lab facility...'}
            </span>
            <Building2 className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Clinical Indication */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Clinical Indication *
          </label>
          <textarea
            value={formData.clinical_indication}
            onChange={(e) => handleInputChange('clinical_indication', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 h-24"
            placeholder="Reason for requesting this test..."
            required
          />
        </div>

        {/* Special Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Special Instructions
          </label>
          <textarea
            value={formData.special_instructions}
            onChange={(e) => handleInputChange('special_instructions', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 h-20"
            placeholder="Any special preparation or instructions..."
          />
        </div>

        {/* Fasting Required */}
        <div className="flex items-center">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.fasting_required}
              onChange={(e) => handleInputChange('fasting_required', e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm font-medium text-gray-700">Fasting Required</span>
          </label>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 h-20"
            placeholder="Any additional notes or comments..."
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => {
              console.log('🔘 Lab Request Form - Cancel button clicked');
              onCancel();
            }}
            className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔘 Lab Request Form - Submit button clicked');
              
              // Manual validation since we removed the form element
              if (!formData.test_name.trim()) {
                toast.error('Please enter a test name');
                return;
              }
              if (!formData.clinical_indication.trim()) {
                toast.error('Please enter the clinical indication (reason for the test)');
                return;
              }
              
              handleSubmit(e as any);
            }}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {editRequest ? 'Update Request' : 'Create Request'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Date Picker Modal */}
      <AnimatePresence>
        {showDatePicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDatePicker(false)}>
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
                  aria-label="Close date picker"
                  title="Close"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Month/Year Navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => handleMonthChange(-1)}
                  className="p-3 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Previous month"
                  title="Previous month"
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
                  aria-label="Next month"
                  title="Next month"
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLabModal(false)}>
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
                  aria-label="Close lab facility list"
                  title="Close"
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
                      className={`w-full p-4 text-left rounded-lg border transition-all hover:border-green-500 hover:bg-green-50 flex items-center justify-between group
                        ${selectedLab === lab.value ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className={`w-5 h-5 ${selectedLab === lab.value ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${selectedLab === lab.value ? 'text-green-700' : 'text-gray-700'}`}>
                          {lab.label}
                        </span>
                      </div>
                      {selectedLab === lab.value && <Check className="w-5 h-5 text-green-600" />}
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
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
    </motion.div>
  );
};

export default LabRequestForm;