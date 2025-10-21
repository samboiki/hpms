import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { wardManagementService, Bed, Room } from '../../services/wardManagementService';

interface BedManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  wardId: string;
  wardName: string;
}

interface BedFormData {
  bed_number: string;
  bed_type: string;
  room_number: string;
  room_type: string;
  features: string[];
  daily_rate: number;
}

interface BulkCreateData {
  room_number: string;
  room_type: string;
  bed_prefix: string;
  bed_count: number;
  bed_type: string;
  features: string[];
  daily_rate: number;
}

const BedManagementPanel: React.FC<BedManagementPanelProps> = ({
  isOpen,
  onClose,
  wardId,
  wardName,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'room' | 'list'>('room');

  const [formData, setFormData] = useState<BedFormData>({
    bed_number: '',
    bed_type: 'standard',
    room_number: '',
    room_type: 'single',
    features: [],
    daily_rate: 0,
  });

  const [bulkData, setBulkData] = useState<BulkCreateData>({
    room_number: '',
    room_type: 'double',
    bed_prefix: '',
    bed_count: 2,
    bed_type: 'standard',
    features: [],
    daily_rate: 0,
  });

  const bedTypes = [
    { value: 'standard', label: 'Standard', icon: 'solar:hospital-bed-bold-duotone' },
    { value: 'icu', label: 'ICU', icon: 'solar:heart-pulse-bold-duotone' },
    { value: 'pediatric', label: 'Pediatric', icon: 'solar:baby-bold-duotone' },
    { value: 'isolation', label: 'Isolation', icon: 'solar:shield-warning-bold-duotone' },
    { value: 'vip', label: 'VIP', icon: 'solar:star-bold-duotone' },
    { value: 'emergency', label: 'Emergency', icon: 'solar:siren-bold-duotone' },
  ];

  const roomTypes = [
    { value: 'single', label: 'Single', beds: 1 },
    { value: 'double', label: 'Double', beds: 2 },
    { value: 'ward', label: 'Ward', beds: 6 },
    { value: 'isolation', label: 'Isolation', beds: 1 },
    { value: 'vip', label: 'VIP Suite', beds: 1 },
  ];

  const bedFeatures = [
    'oxygen',
    'cardiac_monitor',
    'ventilator',
    'electric_adjustable',
    'side_rails',
    'call_button',
    'iv_stand',
    'overbed_table',
  ];

  const roomTemplates = [
    {
      name: 'ICU Single',
      room_type: 'single',
      bed_count: 1,
      bed_type: 'icu',
      features: ['cardiac_monitor', 'ventilator', 'electric_adjustable', 'oxygen'],
    },
    {
      name: 'Standard Double',
      room_type: 'double',
      bed_count: 2,
      bed_type: 'standard',
      features: ['call_button', 'side_rails', 'overbed_table'],
    },
    {
      name: 'General Ward',
      room_type: 'ward',
      bed_count: 6,
      bed_type: 'standard',
      features: ['call_button', 'side_rails'],
    },
    {
      name: 'VIP Suite',
      room_type: 'vip',
      bed_count: 1,
      bed_type: 'vip',
      features: ['electric_adjustable', 'call_button', 'oxygen', 'overbed_table'],
    },
  ];

  useEffect(() => {
    if (isOpen && wardId) {
      loadRooms();
    }
  }, [isOpen, wardId]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const { data, error } = await wardManagementService.getRoomsByWard(wardId);
      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load beds');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingBed) {
        const { error } = await wardManagementService.updateBed(editingBed.id, {
          bed_number: formData.bed_number,
          bed_type: formData.bed_type,
          room_number: formData.room_number,
          room_type: formData.room_type,
          features: formData.features,
          daily_rate: formData.daily_rate,
        });
        if (error) throw error;
        toast.success('Bed updated successfully');
      } else {
        const { error } = await wardManagementService.createBed(wardId, formData);
        if (error) throw error;
        toast.success('Bed created successfully');
      }

      setShowForm(false);
      setEditingBed(null);
      resetForm();
      loadRooms();
    } catch (error: any) {
      console.error('Error saving bed:', error);
      toast.error(error.message || 'Failed to save bed');
    }
  };

  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const beds = [];
      for (let i = 1; i <= bulkData.bed_count; i++) {
        beds.push({
          bed_number: `${bulkData.bed_prefix}${i}`,
          bed_type: bulkData.bed_type,
          room_number: bulkData.room_number,
          room_type: bulkData.room_type,
          features: bulkData.features,
          daily_rate: bulkData.daily_rate,
        });
      }

      const { error } = await wardManagementService.createMultipleBeds(wardId, beds);
      if (error) throw error;

      toast.success(`${beds.length} beds created successfully`);
      setShowBulkForm(false);
      resetBulkForm();
      loadRooms();
    } catch (error: any) {
      console.error('Error creating beds:', error);
      toast.error(error.message || 'Failed to create beds');
    }
  };

  const handleEditBed = (bed: Bed) => {
    setEditingBed(bed);
    setFormData({
      bed_number: bed.bed_number,
      bed_type: bed.bed_type || 'standard',
      room_number: bed.room_number || '',
      room_type: bed.room_type || 'single',
      features: bed.features || [],
      daily_rate: bed.daily_rate || 0,
    });
    setShowForm(true);
  };

  const handleDeleteBed = async (bed: Bed) => {
    if (!confirm(`Are you sure you want to delete bed ${bed.bed_number}?`)) {
      return;
    }

    try {
      const { error } = await wardManagementService.deleteBed(bed.id);
      if (error) throw error;
      toast.success('Bed deleted successfully');
      loadRooms();
    } catch (error: any) {
      console.error('Error deleting bed:', error);
      toast.error(error.message || 'Failed to delete bed');
    }
  };

  const handleDeleteRoom = async (roomNumber: string) => {
    if (!confirm(`Are you sure you want to delete all beds in room ${roomNumber}?`)) {
      return;
    }

    try {
      const { error } = await wardManagementService.deleteRoom(wardId, roomNumber);
      if (error) throw error;
      toast.success('Room deleted successfully');
      loadRooms();
    } catch (error: any) {
      console.error('Error deleting room:', error);
      toast.error(error.message || 'Failed to delete room');
    }
  };

  const handleUpdateBedStatus = async (bed: Bed, status: string) => {
    try {
      const { error } = await wardManagementService.updateBed(bed.id, { status: status as any });
      if (error) throw error;
      toast.success('Bed status updated');
      loadRooms();
    } catch (error: any) {
      console.error('Error updating bed status:', error);
      toast.error(error.message || 'Failed to update bed status');
    }
  };

  const applyTemplate = (template: any) => {
    setBulkData({
      ...bulkData,
      room_type: template.room_type,
      bed_count: template.bed_count,
      bed_type: template.bed_type,
      features: template.features,
    });
  };

  const resetForm = () => {
    setFormData({
      bed_number: '',
      bed_type: 'standard',
      room_number: '',
      room_type: 'single',
      features: [],
      daily_rate: 0,
    });
  };

  const resetBulkForm = () => {
    setBulkData({
      room_number: '',
      room_type: 'double',
      bed_prefix: '',
      bed_count: 2,
      bed_type: 'standard',
      features: [],
      daily_rate: 0,
    });
  };

  const getBedStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 border-green-500 text-green-700';
      case 'occupied': return 'bg-red-100 border-red-500 text-red-700';
      case 'maintenance': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'reserved': return 'bg-purple-100 border-purple-500 text-purple-700';
      case 'cleaning': return 'bg-blue-100 border-blue-500 text-blue-700';
      case 'blocked': return 'bg-gray-100 border-gray-500 text-gray-700';
      default: return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  const getBedStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return 'solar:check-circle-bold-duotone';
      case 'occupied': return 'solar:user-bold-duotone';
      case 'maintenance': return 'solar:settings-bold-duotone';
      case 'reserved': return 'solar:clock-circle-bold-duotone';
      case 'cleaning': return 'solar:broom-bold-duotone';
      case 'blocked': return 'solar:close-circle-bold-duotone';
      default: return 'solar:hospital-bed-bold-duotone';
    }
  };

  const filteredRooms = selectedRoom === 'all'
    ? rooms
    : rooms.filter(r => r.room_number === selectedRoom);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-y-0 right-0 w-full md:w-2/3 lg:w-1/2 bg-white shadow-2xl z-[60] overflow-hidden"
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white mr-4 transition-colors"
                  >
                    <Icon icon="solar:arrow-left-bold-duotone" className="w-6 h-6" />
                  </button>
                  <span className="text-white/80">Ward:</span>
                  <h2 className="text-2xl font-bold text-white">{wardName} - Bed Management</h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Stats Bar */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center">
                  <div className="flex gap-6">
                    <div>
                      <span className="text-sm text-gray-500">Total Beds</span>
                      <p className="text-xl font-semibold">
                        {rooms.reduce((sum, r) => sum + r.total_beds, 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Available</span>
                      <p className="text-xl font-semibold text-green-600">
                        {rooms.reduce((sum, r) => sum + r.available_beds, 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Rooms</span>
                      <p className="text-xl font-semibold">
                        {rooms.filter(r => r.room_number !== 'Unassigned').length}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingBed(null);
                        resetForm();
                        setShowForm(true);
                      }}
                      className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                      Add Bed
                    </button>
                    <button
                      onClick={() => setShowBulkForm(true)}
                      className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <Icon icon="solar:layers-bold-duotone" className="w-5 h-5" />
                      Bulk Create
                    </button>
                  </div>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex justify-between items-center mb-4">
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Rooms</option>
                  {rooms
                    .filter(r => r.room_number !== 'Unassigned')
                    .map(room => (
                      <option key={room.room_number} value={room.room_number}>
                        Room {room.room_number} ({room.total_beds} beds)
                      </option>
                    ))}
                </select>

                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('room')}
                    className={`px-3 py-2 rounded-lg ${
                      viewMode === 'room'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Icon icon="solar:widget-bold-duotone" className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 rounded-lg ${
                      viewMode === 'list'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Icon icon="solar:list-bold-duotone" className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Forms */}
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-50 rounded-xl p-6 mb-6"
                >
                  <h3 className="text-lg font-semibold mb-4">
                    {editingBed ? 'Edit Bed' : 'New Bed'}
                  </h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bed Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.bed_number}
                          onChange={(e) => setFormData({ ...formData, bed_number: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., A1, B2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Room Number
                        </label>
                        <input
                          type="text"
                          value={formData.room_number}
                          onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 101, 202"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bed Type
                        </label>
                        <select
                          value={formData.bed_type}
                          onChange={(e) => setFormData({ ...formData, bed_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {bedTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Daily Rate
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.daily_rate}
                          onChange={(e) => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setEditingBed(null);
                          resetForm();
                        }}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition-all"
                      >
                        {editingBed ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {showBulkForm && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-50 rounded-xl p-6 mb-6"
                >
                  <h3 className="text-lg font-semibold mb-4">Bulk Create Beds</h3>

                  {/* Templates */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quick Templates
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {roomTemplates.map(template => (
                        <button
                          key={template.name}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
                        >
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-gray-500">
                            {template.bed_count} {template.bed_type} bed(s)
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleBulkCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Room Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={bulkData.room_number}
                          onChange={(e) => setBulkData({ ...bulkData, room_number: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 101"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Room Type
                        </label>
                        <select
                          value={bulkData.room_type}
                          onChange={(e) => setBulkData({ ...bulkData, room_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {roomTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bed Prefix *
                        </label>
                        <input
                          type="text"
                          required
                          value={bulkData.bed_prefix}
                          onChange={(e) => setBulkData({ ...bulkData, bed_prefix: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., A, B"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number of Beds *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="20"
                          value={bulkData.bed_count}
                          onChange={(e) => setBulkData({ ...bulkData, bed_count: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bed Type
                        </label>
                        <select
                          value={bulkData.bed_type}
                          onChange={(e) => setBulkData({ ...bulkData, bed_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {bedTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBulkForm(false);
                          resetBulkForm();
                        }}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition-all"
                      >
                        Create {bulkData.bed_count} Beds
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Beds Display */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-12">
                  <Icon
                    icon="solar:hospital-bed-bold-duotone"
                    className="w-16 h-16 text-gray-300 mx-auto mb-4"
                  />
                  <p className="text-gray-500">No beds created yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Click "Add Bed" or "Bulk Create" to add beds
                  </p>
                </div>
              ) : viewMode === 'room' ? (
                <div className="space-y-4">
                  {filteredRooms.map((room) => (
                    <div key={room.room_number} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold text-gray-900">
                          {room.room_number === 'Unassigned' ? 'Unassigned Beds' : `Room ${room.room_number}`}
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">
                            {room.available_beds}/{room.total_beds} available
                          </span>
                          {room.room_number !== 'Unassigned' && (
                            <button
                              onClick={() => handleDeleteRoom(room.room_number)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Room"
                            >
                              <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {room.beds.map((bed) => (
                          <div
                            key={bed.id}
                            className={`relative p-3 border-2 rounded-lg ${getBedStatusColor(bed.status)}`}
                          >
                            <Icon
                              icon={getBedStatusIcon(bed.status)}
                              className="w-6 h-6 mx-auto mb-1"
                            />
                            <p className="text-xs font-medium text-center">{bed.bed_number}</p>
                            <div className="absolute top-1 right-1 flex gap-1">
                              <button
                                onClick={() => handleEditBed(bed)}
                                className="p-0.5 hover:bg-white/50 rounded"
                                title="Edit"
                              >
                                <Icon icon="solar:pen-bold-duotone" className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Bed
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Room
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredRooms.flatMap(room =>
                        room.beds.map((bed) => (
                          <tr key={bed.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {bed.bed_number}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {bed.room_number || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {bed.bed_type || 'Standard'}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={bed.status}
                                onChange={(e) => handleUpdateBedStatus(bed, e.target.value)}
                                className={`text-xs px-2 py-1 rounded-full border ${getBedStatusColor(bed.status)}`}
                              >
                                <option value="available">Available</option>
                                <option value="occupied">Occupied</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="reserved">Reserved</option>
                                <option value="cleaning">Cleaning</option>
                                <option value="blocked">Blocked</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleEditBed(bed)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteBed(bed)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BedManagementPanel;