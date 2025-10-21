import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import FormModal from '../../modals/FormModal';
import { roomManagementService } from '../../../services/roomManagementService';
import { toast } from 'react-hot-toast';

interface EditRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: any;
  wardId: string;
  onSuccess: () => void;
}

const EditRoomModal: React.FC<EditRoomModalProps> = ({
  isOpen,
  onClose,
  room,
  wardId,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    room_type: 'standard',
    features: [] as string[],
    daily_rate: 0,
    description: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (room) {
      setFormData({
        room_type: room.room_type || 'standard',
        features: room.features || [],
        daily_rate: room.daily_rate || 0,
        description: room.description || ''
      });
    }
  }, [room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await roomManagementService.updateRoom(wardId, room.room_number, formData);

      if (error) throw error;

      toast.success('Room updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating room:', error);
      toast.error(error.message || 'Failed to update room');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete room ${room.room_number}? This will also delete all beds in this room.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await roomManagementService.deleteRoom(wardId, room.room_number);
      if (error) throw error;

      toast.success('Room deleted successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error deleting room:', error);
      toast.error(error.message || 'Failed to delete room');
    } finally {
      setLoading(false);
    }
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
      title={`Edit Room ${room?.room_number || ''}`}
      icon="solar:home-bold-duotone"
      iconClassName="text-indigo-600"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-indigo-800">
            <Icon icon="solar:info-circle-bold-duotone" className="inline w-4 h-4 mr-1" />
            Room {room?.room_number} • {room?.total_beds || 0} beds • {room?.available_beds || 0} available
          </p>
        </div>

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
            Daily Rate
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Room Features
          </label>
          <div className="grid grid-cols-2 gap-2">
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

        <div className="flex gap-3 justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || room?.occupied_beds > 0}
            className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={room?.occupied_beds > 0 ? 'Cannot delete room with occupied beds' : ''}
          >
            <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5 inline mr-1" />
            Delete Room
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
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Updating...
                </>
              ) : (
                <>
                  <Icon icon="solar:diskette-bold-duotone" className="w-5 h-5" />
                  Update Room
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </FormModal>
  );
};

export default EditRoomModal;