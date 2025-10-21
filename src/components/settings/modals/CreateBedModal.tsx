import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import FormModal from '../../modals/FormModal';
import { wardManagementService } from '../../../services/wardManagementService';
import { toast } from 'react-hot-toast';

interface CreateBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  wardId: string;
  wards: any[];
  onSuccess: () => void;
}

const CreateBedModal: React.FC<CreateBedModalProps> = ({
  isOpen,
  onClose,
  wardId: defaultWardId,
  wards,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    ward_id: defaultWardId,
    number_of_beds: 1,
    bed_prefix: 'B',
    start_number: 1,
    room_number: '',
    bed_type: 'standard',
    features: [] as string[],
    daily_rate: 0
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const beds = [];
      for (let i = 0; i < formData.number_of_beds; i++) {
        const bedNumber = formData.start_number + i;
        beds.push({
          bed_number: `${formData.bed_prefix}${bedNumber}`,
          bed_type: formData.bed_type,
          room_number: formData.room_number || undefined,
          features: formData.features.length > 0 ? formData.features : undefined,
          daily_rate: formData.daily_rate > 0 ? formData.daily_rate : undefined
        });
      }

      const { error } = await wardManagementService.createMultipleBeds(formData.ward_id, beds);

      if (error) throw error;

      toast.success(`${formData.number_of_beds} bed(s) created successfully`);
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error creating beds:', error);
      toast.error(error.message || 'Failed to create beds');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      ward_id: defaultWardId,
      number_of_beds: 1,
      bed_prefix: 'B',
      start_number: 1,
      room_number: '',
      bed_type: 'standard',
      features: [],
      daily_rate: 0
    });
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

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Beds"
      icon="solar:bed-bold-duotone"
      iconClassName="text-blue-600"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              Room Number (Optional)
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
              Number of Beds <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.number_of_beds}
              onChange={(e) => setFormData({ ...formData, number_of_beds: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="50"
              required
            />
          </div>

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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bed Prefix <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.bed_prefix}
              onChange={(e) => setFormData({ ...formData, bed_prefix: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., B, BED"
              maxLength={5}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Number <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.start_number}
              onChange={(e) => setFormData({ ...formData, start_number: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Rate (Optional)
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
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <Icon icon="solar:info-circle-bold-duotone" className="inline w-4 h-4 mr-1" />
            Beds will be numbered as: {formData.bed_prefix}{formData.start_number}, {formData.bed_prefix}{formData.start_number + 1}, ... {formData.bed_prefix}{formData.start_number + formData.number_of_beds - 1}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bed Features
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                Create {formData.number_of_beds} Bed{formData.number_of_beds > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </form>
    </FormModal>
  );
};

export default CreateBedModal;