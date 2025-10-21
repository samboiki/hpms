import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import FormModal from '../../modals/FormModal';
import { wardManagementService } from '../../../services/wardManagementService';
import { toast } from 'react-hot-toast';

interface EditWardModalProps {
  isOpen: boolean;
  onClose: () => void;
  ward: any;
  onSuccess: () => void;
}

const EditWardModal: React.FC<EditWardModalProps> = ({
  isOpen,
  onClose,
  ward,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    ward_name: '',
    ward_code: '',
    ward_type: 'general',
    description: '',
    capacity: 20,
    floor_number: '1',
    building: 'Main',
    is_active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ward) {
      setFormData({
        ward_name: ward.ward_name || '',
        ward_code: ward.ward_code || '',
        ward_type: ward.ward_type || 'general',
        description: ward.description || '',
        capacity: ward.capacity || 20,
        floor_number: ward.floor_number || '1',
        building: ward.building || 'Main',
        is_active: ward.is_active !== undefined ? ward.is_active : true
      });
    }
  }, [ward]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await wardManagementService.updateWard(ward.id, formData);

      if (error) throw error;

      toast.success('Ward updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating ward:', error);
      toast.error(error.message || 'Failed to update ward');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Ward"
      icon="solar:hospital-bold-duotone"
      iconClassName="text-purple-600"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ward Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.ward_name}
              onChange={(e) => setFormData({ ...formData, ward_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., Pediatric Ward"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ward Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.ward_code}
              onChange={(e) => setFormData({ ...formData, ward_code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., PED-01"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ward Type
            </label>
            <select
              value={formData.ward_type}
              onChange={(e) => setFormData({ ...formData, ward_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="general">General Ward</option>
              <option value="private">Private Ward</option>
              <option value="semi-private">Semi-Private Ward</option>
              <option value="icu">ICU</option>
              <option value="nicu">NICU</option>
              <option value="maternity">Maternity Ward</option>
              <option value="pediatric">Pediatric Ward</option>
              <option value="surgical">Surgical Ward</option>
              <option value="medical">Medical Ward</option>
              <option value="emergency">Emergency Ward</option>
              <option value="psychiatric">Psychiatric Ward</option>
              <option value="isolation">Isolation Ward</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (beds)
            </label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              min="1"
              max="100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Floor Number
            </label>
            <input
              type="text"
              value={formData.floor_number}
              onChange={(e) => setFormData({ ...formData, floor_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., Ground, 1, 2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Building
            </label>
            <input
              type="text"
              value={formData.building}
              onChange={(e) => setFormData({ ...formData, building: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., Main, East Wing"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={3}
            placeholder="Additional notes about the ward..."
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
            Ward is active and available for admissions
          </label>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <Icon icon="solar:info-circle-bold-duotone" className="inline w-4 h-4 mr-1" />
            Total beds in ward: {ward.total_beds || 0} | Available: {ward.available_beds || 0} | Occupied: {ward.occupied_beds || 0}
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Updating...
              </>
            ) : (
              <>
                <Icon icon="solar:diskette-bold-duotone" className="w-5 h-5" />
                Update Ward
              </>
            )}
          </button>
        </div>
      </form>
    </FormModal>
  );
};

export default EditWardModal;