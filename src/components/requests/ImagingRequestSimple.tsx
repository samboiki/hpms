import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Building2, Camera, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';
import DatePickerModal from '../ui/DatePickerModal';

interface ImagingRequestSimpleProps {
  patientId: string;
  visitId?: string;
  onClose: () => void;
  onRequestCreated: () => void;
  editRequest?: any;
}

export default function ImagingRequestSimple({ 
  patientId, 
  visitId, 
  onClose, 
  onRequestCreated,
  editRequest
}: ImagingRequestSimpleProps) {
  const { user } = useAuthStore();
  const [imagingType, setImagingType] = useState(editRequest?.imaging_type || 'x_ray');
  const [requestDate, setRequestDate] = useState(
    editRequest?.request_date ? new Date(editRequest.request_date) : new Date()
  );
  const [expectedResultsDate, setExpectedResultsDate] = useState<Date | null>(
    editRequest?.expected_results_date ? new Date(editRequest.expected_results_date) : null
  );
  const [imagingFacility, setImagingFacility] = useState(editRequest?.facility_name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRequestDatePicker, setShowRequestDatePicker] = useState(false);
  const [showExpectedDatePicker, setShowExpectedDatePicker] = useState(false);

  console.log('ImagingRequestSimple state:', {
    showRequestDatePicker,
    showExpectedDatePicker
  });

  const imagingTypes = [
    { value: 'x_ray', label: 'X-Ray' },
    { value: 'ct_scan', label: 'CT Scan' },
    { value: 'mri', label: 'MRI' },
    { value: 'ultrasound', label: 'Ultrasound' },
    { value: 'mammography', label: 'Mammography' },
    { value: 'nuclear_medicine', label: 'Nuclear Medicine' },
    { value: 'dental_x_ray', label: 'Dental X-Ray' },
    { value: 'panoramic_x_ray', label: 'Panoramic X-Ray' },
    { value: 'cbct', label: 'CBCT' },
    { value: 'other', label: 'Other' }
  ];

  const handleSubmit = async () => {
    if (!user) {
      alert('You must be logged in to create requests');
      return;
    }

    setIsSubmitting(true);

    try {
      const requestData = {
        patient_id: patientId,
        visit_id: visitId,
        imaging_type: imagingType,
        request_date: format(requestDate, 'yyyy-MM-dd'),
        expected_results_date: expectedResultsDate ? format(expectedResultsDate, 'yyyy-MM-dd') : null,
        facility_name: imagingFacility || null,
        requested_by: user.id,
        status: 'pending',
        // Set default values for required fields
        body_part: 'Not specified',
        clinical_indication: 'As per clinical assessment',
        priority: 'routine'
      };

      let result;
      if (editRequest) {
        result = await supabase
          .from('imaging_requests')
          .update(requestData)
          .eq('id', editRequest.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('imaging_requests')
          .insert([requestData])
          .select()
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      onRequestCreated();
      onClose();
    } catch (error) {
      console.error('Error saving imaging request:', error);
      alert('Failed to save imaging request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">
            {editRequest ? 'Edit Imaging Request' : 'Create Imaging Request'}
          </h2>
          <p className="text-gray-600 mt-1">Request medical imaging for this patient</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Imaging Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Camera className="w-4 h-4 inline mr-1" />
              Imaging Type
            </label>
            <select
              value={imagingType}
              onChange={(e) => setImagingType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {imagingTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Request Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Request Date
            </label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Request date button clicked');
                setShowRequestDatePicker(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left hover:bg-gray-50 transition-colors"
            >
              {format(requestDate, 'dd MMM yyyy')}
            </button>
          </div>

          {/* Expected Results Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Expected Results Date (Optional)
            </label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Expected date button clicked');
                setShowExpectedDatePicker(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left hover:bg-gray-50 transition-colors"
            >
              {expectedResultsDate ? format(expectedResultsDate, 'dd MMM yyyy') : 'Select date'}
            </button>
          </div>

          {/* Imaging Facility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              Imaging Facility (Optional)
            </label>
            <input
              type="text"
              value={imagingFacility}
              onChange={(e) => setImagingFacility(e.target.value)}
              placeholder="e.g., Windhoek Radiology, In-house imaging"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editRequest ? 'Update Request' : 'Create Request'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Date Picker Modals */}
      <DatePickerModal
        isOpen={showRequestDatePicker}
        onClose={() => setShowRequestDatePicker(false)}
        onSelectDate={(date) => setRequestDate(date)}
        selectedDate={requestDate}
        title="Select Request Date"
      />
      
      <DatePickerModal
        isOpen={showExpectedDatePicker}
        onClose={() => setShowExpectedDatePicker(false)}
        onSelectDate={(date) => setExpectedResultsDate(date)}
        selectedDate={expectedResultsDate || undefined}
        title="Select Expected Results Date"
      />
    </div>
  );
}