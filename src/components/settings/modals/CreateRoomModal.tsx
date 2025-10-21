import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import FormModal from '../../modals/FormModal';
import { roomManagementService } from '../../../services/roomManagementService';
import { toast } from 'react-hot-toast';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  wardId: string;
  wards: any[];
  onSuccess: () => void;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  wardId: defaultWardId,
  wards,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    ward_id: defaultWardId,
    room_number: '',
    room_type: 'standard',
    number_of_beds: 2,
    bed_prefix: 'B',
    features: [] as string[],
    daily_rate: 0,
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await roomManagementService.createRoom(formData);

      if (error) throw error;

      toast.success('Room created successfully');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error creating room:', error);
      toast.error(error.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      ward_id: defaultWardId,
      room_number: '',
      room_type: 'standard',
      number_of_beds: 2,
      bed_prefix: 'B',
      features: [],
      daily_rate: 0,
      description: ''
    });
  };

  const roomFeatures = [
    'Air Conditioning',
    'Private Bathroom',
    'Television',
    'Refrigerator',
    'Wifi',
    'Patient Lift',
    'Oxygen Supply',
    'Emergency Call Button',
    'Window View',
    'Visitor Seating'
  ];

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Room"
      icon="solar:home-bold-duotone"
      iconClassName="text-indigo-600"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ward <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.ward_id}
              onChange={(e) => setFormData({ ...formData, ward_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Select Ward</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.ward_name} ({ward.ward_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., 101, A-101"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Type
            </label>
            <select
              value={formData.room_type}
              onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="standard">Standard</option>
              <option value="private">Private</option>
              <option value="semi-private">Semi-Private</option>
              <option value="deluxe">Deluxe</option>
              <option value="vip">VIP Suite</option>
              <option value="isolation">Isolation</option>
              <option value="icu">ICU</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Rate (Optional)
            </label>
            <input
              type="number"
              value={formData.daily_rate}
              onChange={(e) => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Beds <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.number_of_beds}
              onChange={(e) => setFormData({ ...formData, number_of_beds: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              min="1"
              max="10"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bed Prefix <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.bed_prefix}
              onChange={(e) => setFormData({ ...formData, bed_prefix: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., B, BED"
              maxLength={5}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Beds will be numbered as {formData.bed_prefix}1, {formData.bed_prefix}2, etc.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Room Features
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {roomFeatures.map((feature) => (
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
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{feature}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows={3}
            placeholder="Additional notes about the room..."
          />
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
            disabled={loading || !formData.ward_id}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                Create Room
              </>
            )}
          </button>
        </div>
      </form>
    </FormModal>
  );
};

export default CreateRoomModal;