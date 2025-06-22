import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Camera, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  FileText, 
  User,
  Save,
  X,
  ImageIcon
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface ImagingRequestFormProps {
  patientId: string;
  visitId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  editRequest?: any; // For editing existing requests
}

const ImagingRequestForm: React.FC<ImagingRequestFormProps> = ({
  patientId,
  visitId,
  onSuccess,
  onCancel,
  editRequest
}) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    imaging_type: editRequest?.imaging_type || 'x_ray',
    body_part: editRequest?.body_part || '',
    view_position: editRequest?.view_position || '',
    contrast_required: editRequest?.contrast_required || false,
    clinical_indication: editRequest?.clinical_indication || '',
    clinical_history: editRequest?.clinical_history || '',
    special_instructions: editRequest?.special_instructions || '',
    priority: editRequest?.priority || 'routine',
    preferred_date: editRequest?.preferred_date || '',
    facility_name: editRequest?.facility_name || '',
    notes: editRequest?.notes || ''
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

  const priorities = [
    { value: 'routine', label: 'Routine', color: 'bg-blue-100 text-blue-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-orange-100 text-orange-800' },
    { value: 'stat', label: 'STAT', color: 'bg-red-100 text-red-800' }
  ];

  const commonBodyParts = [
    'Chest', 'Abdomen', 'Pelvis', 'Head/Brain', 'Neck', 'Spine (Cervical)', 
    'Spine (Thoracic)', 'Spine (Lumbar)', 'Shoulder', 'Arm', 'Elbow', 
    'Wrist', 'Hand', 'Hip', 'Thigh', 'Knee', 'Leg', 'Ankle', 'Foot'
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('🔘 Imaging Request Form - handleSubmit called');
    e.preventDefault();
    
    try {
      if (!user) {
        console.error('❌ Imaging Request Form - No user logged in');
        alert('You must be logged in to create requests');
        return;
      }

      if (!formData.imaging_type || !formData.body_part.trim() || !formData.clinical_indication.trim()) {
        console.error('❌ Imaging Request Form - Missing required fields:', {
          imaging_type: formData.imaging_type,
          body_part: formData.body_part,
          clinical_indication: formData.clinical_indication
        });
        alert('Please fill in all required fields');
        return;
      }

      console.log('✅ Imaging Request Form - Starting submission');
      setLoading(true);
      const requestData = {
        ...formData,
        patient_id: patientId,
        visit_id: visitId,
        requested_by: user.id,
        request_date: new Date().toISOString().split('T')[0],
        // Convert empty string dates to null to avoid PostgreSQL date validation errors
        preferred_date: formData.preferred_date || null
      };

      let result;
      if (editRequest) {
        // Update existing request
        result = await supabase
          .from('imaging_requests')
          .update(requestData)
          .eq('id', editRequest.id)
          .select()
          .single();
      } else {
        // Create new request
        result = await supabase
          .from('imaging_requests')
          .insert([requestData])
          .select()
          .single();
      }

      if (result.error) {
        console.error('Error saving imaging request:', result.error);
        throw new Error(result.error.message);
      }

      console.log('✅ Imaging request saved successfully:', result.data);
      onSuccess();
      
    } catch (error) {
      console.error('💥 Error saving imaging request:', error);
      alert(`Failed to save imaging request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
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
          <div className="p-2 bg-purple-100 rounded-lg">
            <Camera className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {editRequest ? 'Edit Imaging Request' : 'New Imaging Request'}
            </h3>
            <p className="text-sm text-gray-600">Request medical imaging for this patient</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-6">
        {/* Imaging Type and Body Part */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imaging Type *
            </label>
            <select
              value={formData.imaging_type}
              onChange={(e) => handleInputChange('imaging_type', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              required
            >
              {imagingTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Body Part *
            </label>
            <input
              type="text"
              list="body-parts"
              value={formData.body_part}
              onChange={(e) => handleInputChange('body_part', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g., Chest, Abdomen, Left Knee"
              required
            />
            <datalist id="body-parts">
              {commonBodyParts.map(part => (
                <option key={part} value={part} />
              ))}
            </datalist>
          </div>
        </div>

        {/* View Position and Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              View/Position
            </label>
            <input
              type="text"
              value={formData.view_position}
              onChange={(e) => handleInputChange('view_position', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g., AP, Lateral, Oblique"
            />
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
                  onClick={() => handleInputChange('priority', priority.value)}
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

        {/* Facility and Contrast */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imaging Facility
            </label>
            <input
              type="text"
              value={formData.facility_name}
              onChange={(e) => handleInputChange('facility_name', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g., Windhoek Radiology, In-house imaging"
            />
          </div>

          <div className="flex items-center pt-8">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.contrast_required}
                onChange={(e) => handleInputChange('contrast_required', e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">Contrast Required</span>
            </label>
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
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 h-24"
            placeholder="Reason for requesting this imaging study..."
            required
          />
        </div>

        {/* Clinical History */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Clinical History
          </label>
          <textarea
            value={formData.clinical_history}
            onChange={(e) => handleInputChange('clinical_history', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 h-20"
            placeholder="Relevant patient history..."
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
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 h-20"
            placeholder="Any special preparation or instructions..."
          />
        </div>

        {/* Preferred Date and Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Date
            </label>
            <input
              type="date"
              value={formData.preferred_date}
              onChange={(e) => handleInputChange('preferred_date', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 h-[60px]"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => {
              console.log('🔘 Imaging Request Form - Cancel button clicked');
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
              console.log('🔘 Imaging Request Form - Submit button clicked');
              e.preventDefault();
              handleSubmit(e as any);
            }}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
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
    </motion.div>
  );
};

export default ImagingRequestForm;