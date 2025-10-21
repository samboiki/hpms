import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import FormModal from '../../modals/FormModal';
import { wardManagementService } from '../../../services/wardManagementService';
import { toast } from 'react-hot-toast';

interface EditBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed: any;
  onSuccess: () => void;
}

const EditBedModal: React.FC<EditBedModalProps> = ({
  isOpen,
  onClose,
  bed,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    bed_number: '',
    bed_type: 'standard',
    room_number: '',
    status: 'available',
    features: [] as string[],
    daily_rate: 0,
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bed) {
      setFormData({
        bed_number: bed.bed_number || '',
        bed_type: bed.bed_type || 'standard',
        room_number: bed.room_number || '',
        status: bed.status || 'available',
        features: bed.features || [],
        daily_rate: bed.daily_rate || 0,
        notes: bed.notes || ''
      });
    }
  }, [bed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await wardManagementService.updateBed(bed.id, {
        bed_type: formData.bed_type,
        room_number: formData.room_number || undefined,
        status: formData.status,
        features: formData.features.length > 0 ? formData.features : undefined,
        daily_rate: formData.daily_rate > 0 ? formData.daily_rate : undefined,
        notes: formData.notes || undefined
      });

      if (error) throw error;

      toast.success('Bed updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating bed:', error);
      toast.error(error.message || 'Failed to update bed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (bed.status === 'occupied') {
      toast.error('Cannot delete an occupied bed');
      return;
    }

    if (!confirm(`Are you sure you want to delete bed ${bed.bed_number}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await wardManagementService.deleteBed(bed.id);
      if (error) throw error;

      toast.success('Bed deleted successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error deleting bed:', error);
      toast.error(error.message || 'Failed to delete bed');
    } finally {
      setLoading(false);
    }
  };

  const bedFeatures = [
    'Adjustable Height',
    'Side Rails',
    'Electric Controls',
    'Pressure Relief Mattress',
    'IV Stand',
    'Oxygen Port',
    'Emergency Call Button',
    'Reading Light',
    'Overbed Table',
    'Patient Monitor Mount'
  ];

  const statusColors = {
    available: 'bg-green-100 text-green-700 border-green-300',
    occupied: 'bg-orange-100 text-orange-700 border-orange-300',
    maintenance: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    reserved: 'bg-blue-100 text-blue-700 border-blue-300',
    cleaning: 'bg-purple-100 text-purple-700 border-purple-300',
    blocked: 'bg-red-100 text-red-700 border-red-300'
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Bed ${bed?.bed_number || ''}`}
      icon="solar:bed-bold-duotone"
      iconClassName="text-blue-600"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className={`border-2 rounded-lg p-3 mb-4 ${statusColors[bed?.status as keyof typeof statusColors]}`}>
          <p className="text-sm font-medium">
            <Icon icon="solar:info-circle-bold-duotone" className="inline w-4 h-4 mr-1" />
            Current Status: {bed?.status?.toUpperCase()}
            {bed?.current_patient && ` - Occupied by ${bed.current_patient.first_name} ${bed.current_patient.last_name}`}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bed Number
            </label>
            <input
              type="text"
              value={formData.bed_number}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Number
            </label>
            <input
              type="text"
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 101, A-101"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bed Type
            </label>
            <select
              value={formData.bed_type}
              onChange={(e) => setFormData({ ...formData, bed_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="standard">Standard</option>
              <option value="electric">Electric</option>
              <option value="icu">ICU Bed</option>
              <option value="pediatric">Pediatric</option>
              <option value="maternity">Maternity</option>
              <option value="bariatric">Bariatric</option>
              <option value="stretcher">Stretcher</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={bed?.status === 'occupied'}
            >
              <option value="available">Available</option>
              <option value="occupied" disabled>Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="reserved">Reserved</option>
              <option value="cleaning">Cleaning</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily Rate
          </label>
          <input
            type="number"
            value={formData.daily_rate}
            onChange={(e) => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="0"
            step="0.01"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bed Features
          </label>
          <div className="grid grid-cols-2 gap-2">
            {bedFeatures.map((feature) => (
              <label key={feature} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.features.includes(feature)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, features: [...formData.features, feature] });
                    } else {
                      setFormData({ ...formData, features: formData.features.filter(f => f !== feature) });
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{feature}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Additional notes about the bed..."
          />
        </div>

        <div className="flex gap-3 justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || bed?.status === 'occupied'}
            className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={bed?.status === 'occupied' ? 'Cannot delete an occupied bed' : ''}
          >
            <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5 inline mr-1" />
            Delete Bed
          </button>

          <div className="flex gap-3">
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
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Updating...
                </>
              ) : (
                <>
                  <Icon icon="solar:diskette-bold-duotone" className="w-5 h-5" />
                  Update Bed
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </FormModal>
  );
};

export default EditBedModal;