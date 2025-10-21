import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { PremiumInput, PremiumTextarea, PremiumSelect } from '../../ui/PremiumInput';

interface Room {
  id: string;
  ward_id: string;
  room_number: string;
  room_name: string;
  room_type: string;
  bed_capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  actual_bed_count?: number;
  available_bed_count?: number;
}

interface RoomFormData {
  room_number: string;
  room_name: string;
  room_type: string;
  ward_id: string;
  bed_capacity: number;
  is_active: boolean;
}

interface DepartmentRoomsTabProps {
  selectedDepartment: any;
}

const DepartmentRoomsTab: React.FC<DepartmentRoomsTabProps> = ({
  selectedDepartment,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm<RoomFormData>({
    defaultValues: {
      room_number: '',
      room_name: '',
      room_type: 'standard',
      ward_id: '',
      bed_capacity: 2,
      is_active: true
    }
  });

  // Load all rooms and wards for this department
  useEffect(() => {
    if (selectedDepartment?.id) {
      loadRooms();
      loadWards();
    }
  }, [selectedDepartment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRooms = async () => {
    try {
      setIsLoading(true);

      // Single optimized query: get rooms with bed counts in ONE call
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          *,
          ward:wards!inner(department_id),
          beds:beds(id, bed_status, is_active)
        `)
        .eq('ward.department_id', selectedDepartment.id)
        .order('room_number', { ascending: true });

      if (roomsError) {
        console.error('Error loading rooms:', roomsError);
        toast.error('Failed to load rooms');
      } else {
        // Calculate bed counts from the joined data (no additional queries!)
        const roomsWithBedCounts = (roomsData || []).map((room: any) => {
          const beds = room.beds || [];
          const activeBeds = beds.filter((b: any) => b.is_active);
          const totalBeds = activeBeds.length;
          const availableBeds = activeBeds.filter((b: any) => b.bed_status === 'Available').length;

          // Remove the beds and ward arrays to keep it clean
          const { beds: _, ward: __, ...roomWithoutBeds } = room;

          return {
            ...roomWithoutBeds,
            actual_bed_count: totalBeds,
            available_bed_count: availableBeds
          };
        });

        setRooms(roomsWithBedCounts);
      }
    } catch (err) {
      console.error('Error loading rooms:', err);
      toast.error('Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  };

  const loadWards = async () => {
    try {
      const { data, error } = await supabase
        .from('wards')
        .select('*')
        .eq('department_id', selectedDepartment.id)
        .eq('is_active', true)
        .order('ward_name', { ascending: true });

      if (!error) {
        setWards(data || []);
      }
    } catch (err) {
      console.error('Error loading wards:', err);
    }
  };

  const onSubmit = async (formData: RoomFormData) => {
    try {
      setIsSaving(true);

      const roomData = {
        ...formData,
        updated_at: new Date().toISOString()
      };

      if (editingRoom) {
        // Update existing room
        const { error } = await supabase
          .from('rooms')
          .update(roomData)
          .eq('id', editingRoom.id);

        if (error) throw error;
        toast.success('Room updated successfully');
      } else {
        // Create new room
        const { error } = await supabase
          .from('rooms')
          .insert({
            ...roomData,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        toast.success('Room created successfully');
      }

      // Reset form and reload
      setEditingRoom(null);
      setIsFormOpen(false);
      reset();
      loadRooms();
    } catch (error) {
      console.error('Error saving room:', error);
      toast.error('Failed to save room');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    reset({
      room_number: room.room_number,
      room_name: room.room_name,
      room_type: room.room_type,
      ward_id: room.ward_id,
      floor_number: room.floor_number,
      building: room.building,
      bed_count: room.bed_count,
      occupied_beds: room.occupied_beds,
      room_status: room.room_status,
      daily_rate: room.daily_rate,
      is_active: room.is_active
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Room deleted successfully');
      loadRooms();
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error('Failed to delete room');
    }
  };

  const getOccupancyColor = (occupied: number, total: number) => {
    if (total === 0) return 'text-gray-600 bg-gray-100';
    const percentage = (occupied / total) * 100;
    if (percentage === 0) return 'text-green-600 bg-green-100';
    if (percentage === 100) return 'text-red-600 bg-red-100';
    if (percentage >= 75) return 'text-orange-600 bg-orange-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getRoomStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'bg-green-100 text-green-700';
      case 'occupied':
        return 'bg-red-100 text-red-700';
      case 'partially occupied':
        return 'bg-yellow-100 text-yellow-700';
      case 'maintenance':
        return 'bg-gray-100 text-gray-700';
      case 'reserved':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoomTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'icu':
        return 'solar:heart-pulse-bold-duotone';
      case 'private':
        return 'solar:key-bold-duotone';
      case 'semi-private':
        return 'solar:users-group-two-bold-duotone';
      case 'general':
        return 'solar:users-group-rounded-bold-duotone';
      case 'emergency':
        return 'solar:siren-rounded-bold-duotone';
      case 'surgery':
      case 'operating':
        return 'solar:medical-kit-bold-duotone';
      default:
        return 'solar:door-open-bold-duotone';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon icon="solar:spinner-bold-duotone" className="w-8 h-8 animate-spin text-[#01b9d4]" />
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Section with White Background */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
              <Icon icon="solar:door-open-bold-duotone" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Hospital Rooms
              </h3>
              <p className="text-sm text-gray-600">
                Room management and configuration
              </p>
            </div>
          </div>
          {isFormOpen ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingRoom(null);
                  reset();
                }}
                className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-purple-100 text-purple-600 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon icon="solar:diskette-bold-duotone" className="w-4 h-4" />
                )}
                {isSaving ? 'Saving...' : editingRoom ? 'Update Room' : 'Save Room'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingRoom(null);
                reset({
                  room_number: '',
                  room_name: '',
                  room_type: 'Private',
                  floor_number: 1,
                  building: 'Main Building',
                  bed_count: 1,
                  occupied_beds: 0,
                  room_status: 'Available',
                  daily_rate: 0,
                  is_active: true
                });
                setIsFormOpen(true);
              }}
              className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-purple-100 text-purple-600 hover:bg-purple-200"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" />
              Add Room
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {isFormOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-8 rounded-xl border-2 border-dashed border-gray-300/50 shadow-sm"
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              {editingRoom ? 'Edit Room' : 'Add New Room'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Fill in the room details below
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Room Information Section */}
            <div className="bg-white rounded-lg p-6 border border-gray-200/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-50">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4 text-blue-600" />
                </div>
                Room Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Room Number</label>
                  <PremiumInput
                    {...register('room_number', { required: 'Room number is required' })}
                    error={errors.room_number?.message}
                    icon="solar:hashtag-bold-duotone"
                    placeholder="e.g., 101"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Room Name</label>
                  <PremiumInput
                    {...register('room_name')}
                    error={errors.room_name?.message}
                    icon="solar:text-field-bold-duotone"
                    placeholder="e.g., Recovery Room A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Room Type</label>
                  <PremiumSelect
                    {...register('room_type')}
                    error={errors.room_type?.message}
                    icon="solar:clipboard-heart-bold-duotone"
                  >
                    <option value="Private">Private</option>
                    <option value="Semi-Private">Semi-Private</option>
                    <option value="General">General</option>
                    <option value="ICU">ICU</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Operating">Operating Room</option>
                    <option value="Recovery">Recovery</option>
                    <option value="Isolation">Isolation</option>
                  </PremiumSelect>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Associated Ward</label>
                  <PremiumSelect
                    {...register('ward_id')}
                    error={errors.ward_id?.message}
                    icon="solar:bed-bold-duotone"
                  >
                    <option value="">No Ward Association</option>
                    {wards.map(ward => (
                      <option key={ward.id} value={ward.id}>
                        {ward.ward_name} ({ward.ward_code})
                      </option>
                    ))}
                  </PremiumSelect>
                </div>
              </div>
            </div>

            {/* Capacity & Location Section */}
            <div className="bg-white rounded-lg p-6 border border-gray-200/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-50">
                  <Icon icon="solar:buildings-2-bold-duotone" className="w-4 h-4 text-purple-600" />
                </div>
                Capacity & Location
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Total Beds</label>
                  <PremiumInput
                    type="number"
                    {...register('bed_count', {
                      required: 'Bed count is required',
                      min: { value: 1, message: 'Must be at least 1' }
                    })}
                    error={errors.bed_count?.message}
                    icon="solar:bed-bold-duotone"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Occupied Beds</label>
                  <PremiumInput
                    type="number"
                    {...register('occupied_beds', {
                      min: { value: 0, message: 'Cannot be negative' }
                    })}
                    error={errors.occupied_beds?.message}
                    icon="solar:user-check-bold-duotone"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Floor Number</label>
                  <PremiumInput
                    type="number"
                    {...register('floor_number', {
                      required: 'Floor number is required',
                      min: { value: 0, message: 'Must be 0 or higher' }
                    })}
                    error={errors.floor_number?.message}
                    icon="solar:stairs-up-bold-duotone"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Building Name</label>
                  <PremiumInput
                    {...register('building', { required: 'Building is required' })}
                    error={errors.building?.message}
                    icon="solar:buildings-bold-duotone"
                    placeholder="Main Building"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Daily Rate (R)</label>
                  <PremiumInput
                    type="number"
                    step="0.01"
                    {...register('daily_rate', {
                      min: { value: 0, message: 'Cannot be negative' }
                    })}
                    error={errors.daily_rate?.message}
                    icon="solar:tag-price-bold-duotone"
                    placeholder="1500.00"
                  />
                </div>
              </div>
            </div>

            {/* Status Section */}
            <div className="bg-white rounded-lg p-6 border border-gray-200/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-green-50">
                  <Icon icon="solar:info-square-bold-duotone" className="w-4 h-4 text-green-600" />
                </div>
                Room Status
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Room Status</label>
                  <PremiumSelect
                    {...register('room_status')}
                    error={errors.room_status?.message}
                    icon="solar:shield-check-bold-duotone"
                  >
                    <option value="Available">Available</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Partially Occupied">Partially Occupied</option>
                    <option value="Maintenance">Under Maintenance</option>
                    <option value="Reserved">Reserved</option>
                  </PremiumSelect>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-3 cursor-pointer bg-gray-50 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      {...register('is_active')}
                      className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Room is Active</span>
                      <p className="text-xs text-gray-500">Enable or disable this room</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

          </form>
        </motion.div>
      )}

      {/* Rooms Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50">
          <h3 className="text-sm font-semibold text-gray-700">Room Records</h3>
          <p className="text-xs text-gray-500 mt-1">Manage and monitor all hospital rooms</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Room Details</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Bed Occupancy</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Daily Rate</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Icon icon="solar:door-open-bold-duotone" className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No rooms created yet</p>
                      <p className="text-gray-400 text-sm mt-1">Click "Add Room" to create your first room</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50">
                          <Icon
                            icon={getRoomTypeIcon(room.room_type)}
                            className="w-5 h-5 text-purple-600"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">Room {room.room_number}</div>
                          {room.room_name && (
                            <div className="text-xs text-gray-500">{room.room_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700 font-medium">{room.room_type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-gray-900 font-medium">{room.building}</div>
                        <div className="text-xs text-gray-500">Floor {room.floor_number}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getOccupancyColor((room.actual_bed_count || 0) - (room.available_bed_count || 0), room.actual_bed_count || 0)}`}>
                            {(room.actual_bed_count || 0) - (room.available_bed_count || 0)}/{room.actual_bed_count || 0} beds
                          </span>
                          {(room.actual_bed_count || 0) > 0 && (
                            <span className="text-xs text-gray-500">
                              ({Math.round((((room.actual_bed_count || 0) - (room.available_bed_count || 0)) / (room.actual_bed_count || 0)) * 100)}%)
                            </span>
                          )}
                        </div>
                        {(room.actual_bed_count || 0) > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                (room.available_bed_count || 0) === (room.actual_bed_count || 0) ? 'bg-gradient-to-r from-green-400 to-green-600' :
                                (room.available_bed_count || 0) === 0 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                                (((room.actual_bed_count || 0) - (room.available_bed_count || 0)) / (room.actual_bed_count || 0)) * 100 >= 75 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                                'bg-gradient-to-r from-yellow-400 to-yellow-600'
                              }`}
                              style={{ width: `${Math.min((((room.actual_bed_count || 0) - (room.available_bed_count || 0)) / (room.actual_bed_count || 0)) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {room.daily_rate ? (
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:tag-price-bold-duotone" className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-700">R {room.daily_rate.toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${getRoomStatusColor(room.room_status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          room.room_status?.toLowerCase() === 'available' ? 'bg-green-500' :
                          room.room_status?.toLowerCase() === 'occupied' ? 'bg-red-500' :
                          room.room_status?.toLowerCase() === 'partially occupied' ? 'bg-yellow-500' :
                          room.room_status?.toLowerCase() === 'reserved' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`} />
                        {room.room_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(room)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all group"
                          title="Edit Room"
                        >
                          <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all group"
                          title="Delete Room"
                        >
                          <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary */}
        {rooms.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{rooms.length}</span> room{rooms.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:door-open-bold-duotone" className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Total Rooms:</span>
                  <span className="font-semibold text-gray-900">
                    {rooms.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:bed-bold-duotone" className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Total Beds:</span>
                  <span className="font-semibold text-gray-900">
                    {rooms.reduce((sum, room) => sum + (room.actual_bed_count || 0), 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:user-check-bold-duotone" className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Available:</span>
                  <span className="font-semibold text-gray-900">
                    {rooms.reduce((sum, room) => sum + (room.available_bed_count || 0), 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:chart-bold-duotone" className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Occupancy Rate:</span>
                  <span className={`font-bold ${
                    (() => {
                      const totalBeds = rooms.reduce((sum, room) => sum + (room.actual_bed_count || 0), 0);
                      const availableBeds = rooms.reduce((sum, room) => sum + (room.available_bed_count || 0), 0);
                      const occupiedBeds = totalBeds - availableBeds;
                      const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
                      return occupancyRate >= 80 ? 'text-red-600' : 'text-green-600';
                    })()
                  }`}>
                    {(() => {
                      const totalBeds = rooms.reduce((sum, room) => sum + (room.actual_bed_count || 0), 0);
                      const availableBeds = rooms.reduce((sum, room) => sum + (room.available_bed_count || 0), 0);
                      const occupiedBeds = totalBeds - availableBeds;
                      return totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
                    })()}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentRoomsTab;