import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { PremiumInput, PremiumTextarea, PremiumSelect } from '../../ui/PremiumInput';

interface Bed {
  id: string;
  room_id: string;
  ward_id: string;
  bed_number: string;
  bed_type: string;
  bed_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  room?: any;
}

interface BedFormData {
  bed_number: string;
  room_id: string;
  ward_id: string;
  bed_type: string;
  bed_status: string;
  is_active: boolean;
}

interface DepartmentBedsTabProps {
  selectedDepartment: any;
}

const DepartmentBedsTab: React.FC<DepartmentBedsTabProps> = ({
  selectedDepartment,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm<BedFormData>({
    defaultValues: {
      bed_number: '',
      room_id: '',
      ward_id: '',
      bed_type: 'standard',
      bed_status: 'Available',
      is_active: true
    }
  });

  const bedStatus = watch('bed_status');

  // Load beds and rooms for this department
  useEffect(() => {
    if (selectedDepartment?.id) {
      loadBeds();
      loadRooms();
    }
  }, [selectedDepartment?.id]);

  const loadBeds = async () => {
    try {
      setIsLoading(true);

      // Single optimized query with inner join to filter by department
      const { data, error } = await supabase
        .from('beds')
        .select(`
          *,
          room:rooms(room_number, room_name, ward_id),
          ward:wards!inner(department_id)
        `)
        .eq('ward.department_id', selectedDepartment.id)
        .eq('is_active', true)
        .order('bed_number', { ascending: true });

      if (error) {
        console.error('Error loading beds:', error);
        toast.error('Failed to load beds');
      } else {
        // Clean up the ward reference from each bed object
        const cleanedBeds = (data || []).map((bed: any) => {
          const { ward: _, ...bedWithoutWard } = bed;
          return bedWithoutWard;
        });
        setBeds(cleanedBeds);
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Failed to load beds');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRooms = async () => {
    try {
      // Single optimized query with inner join
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          ward:wards!inner(department_id)
        `)
        .eq('ward.department_id', selectedDepartment.id)
        .eq('is_active', true)
        .order('room_number', { ascending: true });

      if (error) {
        console.error('Error loading rooms:', error);
      } else {
        // Clean up the ward reference
        const cleanedRooms = (data || []).map((room: any) => {
          const { ward: _, ...roomWithoutWard } = room;
          return roomWithoutWard;
        });
        setRooms(cleanedRooms);
      }
    } catch (error: any) {
      console.error('Error:', error);
    }
  };

  const onSubmit = async (data: BedFormData) => {
    try {
      setIsSaving(true);

      // Find the selected room to get ward_id
      const selectedRoom = rooms.find(r => r.id === data.room_id);

      const bedData = {
        ...data,
        ward_id: selectedRoom?.ward_id || data.ward_id,
        updated_at: new Date().toISOString()
      };

      let result;
      if (editingBed) {
        // Update existing bed
        result = await supabase
          .from('beds')
          .update(bedData)
          .eq('id', editingBed.id)
          .select()
          .single();
      } else {
        // Create new bed
        result = await supabase
          .from('beds')
          .insert([bedData])
          .select()
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      toast.success(editingBed ? 'Bed updated successfully' : 'Bed created successfully');

      // Reset form and reload data
      reset();
      setIsFormOpen(false);
      setEditingBed(null);
      await loadBeds();
    } catch (error: any) {
      console.error('Error saving bed:', error);
      toast.error(error.message || 'Failed to save bed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (bed: Bed) => {
    setEditingBed(bed);
    setIsFormOpen(true);

    // Set form values
    setValue('bed_number', bed.bed_number);
    setValue('bed_name', bed.bed_name || '');
    setValue('room_id', bed.room_id);
    setValue('bed_type', bed.bed_type);
    setValue('bed_status', bed.bed_status);
    setValue('patient_name', bed.patient_name || '');
    setValue('admission_date', bed.admission_date || '');
    setValue('expected_discharge', bed.expected_discharge || '');
    setValue('is_active', bed.is_active);
  };

  const handleDelete = async (bedId: string) => {
    if (!confirm('Are you sure you want to delete this bed?')) return;

    try {
      const { error } = await supabase
        .from('beds')
        .update({ is_active: false })
        .eq('id', bedId);

      if (error) throw error;

      toast.success('Bed deleted successfully');
      await loadBeds();
    } catch (error: any) {
      console.error('Error deleting bed:', error);
      toast.error('Failed to delete bed');
    }
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingBed(null);
    reset();
  };

  const getBedStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'bg-gradient-to-br from-[#00c1d0]/10 to-[#00c1d0]/5 text-[#00c1d0] border-[#00c1d0]/30';
      case 'occupied':
        return 'bg-gradient-to-br from-red-100 to-red-50 text-red-700 border-red-300';
      case 'maintenance':
        return 'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 border-amber-300';
      case 'reserved':
        return 'bg-gradient-to-br from-violet-100 to-violet-50 text-violet-700 border-violet-300';
      default:
        return 'bg-gradient-to-br from-gray-100 to-gray-50 text-gray-700 border-gray-300';
    }
  };

  const getBedStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'bg-[#00c1d0] animate-pulse';
      case 'occupied':
        return 'bg-red-500';
      case 'maintenance':
        return 'bg-amber-500';
      case 'reserved':
        return 'bg-violet-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getBedStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'solar:check-circle-bold-duotone';
      case 'occupied':
        return 'solar:user-bold-duotone';
      case 'maintenance':
        return 'solar:settings-bold-duotone';
      case 'reserved':
        return 'solar:clock-circle-bold-duotone';
      default:
        return 'solar:info-circle-bold-duotone';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon icon="solar:spinner-bold-duotone" className="w-8 h-8 animate-spin text-[#01b9d4]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Section with White Background */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
              <Icon icon="solar:bed-bold-duotone" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Bed Management
              </h3>
              <p className="text-sm text-gray-600">
                Manage beds and occupancy for this department
              </p>
            </div>
          </div>
          {isFormOpen ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-purple-100 text-purple-600 hover:bg-purple-200"
              >
                {isSaving ? (
                  <>
                    <Icon icon="solar:spinner-bold-duotone" className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:diskette-bold-duotone" className="w-4 h-4" />
                    {editingBed ? 'Update Bed' : 'Save Bed'}
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-purple-100 text-purple-600 hover:bg-purple-200"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
              Add New Bed
            </button>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl border-2 border-dashed border-gray-300/50 shadow-sm overflow-hidden"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Bed Information Section */}
              <div className="bg-white rounded-lg p-6 border border-gray-200/50">
                <h4 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-blue-50">
                    <Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4 text-blue-600" />
                  </div>
                  Bed Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Bed Number</label>
                    <PremiumInput
                      {...register('bed_number', { required: 'Bed number is required' })}
                      error={errors.bed_number?.message}
                      icon="solar:hashtag-bold-duotone"
                      placeholder="e.g., B101-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Bed Name</label>
                    <PremiumInput
                      {...register('bed_name')}
                      error={errors.bed_name?.message}
                      icon="solar:text-field-bold-duotone"
                      placeholder="e.g., Bed 1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Bed Type</label>
                    <PremiumSelect
                      {...register('bed_type')}
                      error={errors.bed_type?.message}
                      icon="solar:bed-bold-duotone"
                    >
                      <option value="Standard">Standard</option>
                      <option value="ICU">ICU</option>
                      <option value="Private">Private</option>
                      <option value="Semi-Private">Semi-Private</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Pediatric">Pediatric</option>
                      <option value="Maternity">Maternity</option>
                    </PremiumSelect>
                  </div>
                </div>
              </div>

              {/* Assignment Section */}
              <div className="bg-white rounded-lg p-6 border border-gray-200/50">
                <h4 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-purple-50">
                    <Icon icon="solar:home-2-bold-duotone" className="w-4 h-4 text-purple-600" />
                  </div>
                  Room Assignment
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Assign to Room</label>
                    <PremiumSelect
                      {...register('room_id', { required: 'Room selection is required' })}
                      error={errors.room_id?.message}
                      icon="solar:door-open-bold-duotone"
                    >
                      <option value="">Select Room</option>
                      {rooms.map(room => (
                        <option key={room.id} value={room.id}>
                          {room.room_name || room.room_number} - {room.room_type}
                        </option>
                      ))}
                    </PremiumSelect>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Bed Status</label>
                    <PremiumSelect
                      {...register('bed_status')}
                      error={errors.bed_status?.message}
                      icon="solar:shield-check-bold-duotone"
                    >
                      <option value="Available">Available</option>
                      <option value="Occupied">Occupied</option>
                      <option value="Maintenance">Under Maintenance</option>
                      <option value="Reserved">Reserved</option>
                    </PremiumSelect>
                  </div>
                </div>
              </div>

              {/* Patient Information (if occupied) */}
              {bedStatus === 'Occupied' && (
                <div className="bg-white rounded-lg p-6 border border-gray-200/50">
                  <h4 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-green-50">
                      <Icon icon="solar:user-bold-duotone" className="w-4 h-4 text-green-600" />
                    </div>
                    Patient Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Patient Name</label>
                      <PremiumInput
                        {...register('patient_name')}
                        error={errors.patient_name?.message}
                        icon="solar:user-id-bold-duotone"
                        placeholder="Patient full name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Admission Date</label>
                      <PremiumInput
                        type="datetime-local"
                        {...register('admission_date')}
                        error={errors.admission_date?.message}
                        icon="solar:calendar-bold-duotone"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Expected Discharge</label>
                      <PremiumInput
                        type="datetime-local"
                        {...register('expected_discharge')}
                        error={errors.expected_discharge?.message}
                        icon="solar:calendar-check-bold-duotone"
                      />
                    </div>
                  </div>
                </div>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Beds Grid Display */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
          <Icon icon="solar:bed-bold-duotone" className="w-4 h-4 text-gray-600" />
          Bed Overview ({beds.length} beds)
        </h4>

        {beds.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Icon icon="solar:bed-bold-duotone" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No beds found. Click "Add New Bed" to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
            {beds.map((bed, index) => (
              <motion.div
                key={bed.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEdit(bed)}
                className="relative group cursor-pointer"
                style={{
                  minWidth: '350px',
                  height: '140px'
                }}
              >
                {/* Card Container */}
                <div
                  className="relative rounded-3xl transition-all duration-300 overflow-hidden h-full"
                  style={{
                    height: '140px',
                    background: bed.bed_status?.toLowerCase() === 'available'
                      ? 'rgba(0,193,208,0.05)'
                      : bed.bed_status?.toLowerCase() === 'occupied'
                      ? 'rgba(239,68,68,0.03)'
                      : bed.bed_status?.toLowerCase() === 'maintenance'
                      ? 'rgba(245,158,11,0.03)'
                      : 'rgba(156,163,175,0.03)',
                    border: bed.bed_status?.toLowerCase() === 'available'
                      ? '2px solid rgba(0,193,208,0.2)'
                      : bed.bed_status?.toLowerCase() === 'occupied'
                      ? '2px solid rgba(239,68,68,0.15)'
                      : bed.bed_status?.toLowerCase() === 'maintenance'
                      ? '2px solid rgba(245,158,11,0.15)'
                      : '2px solid rgba(156,163,175,0.1)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >

                {/* Status Badge - No animation */}
                <div className="absolute top-2 right-2 z-10">
                  {bed.bed_status?.toLowerCase() === 'available' ? (
                    <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-[#00c1d0]" />
                  ) : null}
                </div>

                {/* Delete Button - Always Visible Top Left */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(bed.id);
                  }}
                  className="absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-500 hover:text-white hover:scale-110"
                >
                  <Icon icon="solar:trash-bin-2-bold-duotone" className="w-4 h-4" />
                </button>

                  {/* Main Content - Horizontal Layout */}
                  <div className="p-4 flex items-center justify-between relative z-0 h-full">
                    {/* Left Section: Icon and Basic Info */}
                    <div className="flex items-center gap-4">
                      {/* Icon Container */}
                      <div>
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300"
                      style={{
                        background: bed.bed_status?.toLowerCase() === 'available'
                          ? 'rgba(0,193,208,0.08)'
                          : 'rgba(0,0,0,0.03)',
                        border: bed.bed_status?.toLowerCase() === 'available'
                          ? '1px solid rgba(0,193,208,0.15)'
                          : '1px solid rgba(0,0,0,0.1)'
                      }}
                    >
                          <Icon
                            icon="solar:bed-bold-duotone"
                            className="w-10 h-10"
                        style={{
                          color: bed.bed_status?.toLowerCase() === 'available' ? '#00c1d0' : undefined
                        }}
                          />
                        </div>
                      </div>

                      {/* Bed Info */}
                      <div className="text-left">
                        {/* Bed Number */}
                        <h4
                          className="font-black text-lg tracking-wide"
                          style={{
                            color: bed.bed_status?.toLowerCase() === 'available'
                              ? '#00c1d0'
                              : '#1f2937'
                          }}
                        >
                          {bed.bed_number}
                        </h4>

                        {/* Room and Type in one line */}
                        <div className="flex items-center gap-2 mt-1">
                          {bed.room && (
                            <span className="text-xs font-medium text-gray-600">
                              <Icon icon="solar:home-2-bold-duotone" className="w-3 h-3 inline mr-1" style={{ color: bed.bed_status?.toLowerCase() === 'available' ? '#00c1d0' : '#6b7280' }} />
                              {bed.room.room_name || bed.room.room_number}
                            </span>
                          )}
                          <span className="text-xs font-medium text-gray-500">•</span>
                          <span className="text-xs font-bold text-gray-600">{bed.bed_type}</span>
                        </div>

                        {/* Status directly under room info */}
                        <div className="mt-1">
                          <span
                            className="text-xs font-bold capitalize"
                            style={{
                              color: bed.bed_status?.toLowerCase() === 'available'
                                ? '#00c1d0'
                                : bed.bed_status?.toLowerCase() === 'occupied'
                                ? '#dc2626'
                                : bed.bed_status?.toLowerCase() === 'maintenance'
                                ? '#f59e0b'
                                : '#6b7280'
                            }}
                          >
                            {bed.bed_status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Section: Patient Info Only */}
                    <div className="flex flex-col items-end justify-center">

                      {/* Patient Info if Occupied */}
                      {bed.bed_status?.toLowerCase() === 'occupied' && bed.patient_name && (
                        <div className="text-right">
                          <p className="text-xs font-medium text-gray-700">
                            <Icon icon="solar:user-bold-duotone" className="w-3 h-3 inline mr-1" />
                            {bed.patient_name.split(' ')[0]}
                          </p>
                          {bed.admission_date && (
                            <p className="text-xs text-gray-500">
                              {new Date(bed.admission_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </motion.div>
            ))}

            {/* Add New Bed Card - Simple Design */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: beds.length * 0.02 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsFormOpen(true)}
              className="relative cursor-pointer"
              style={{ minWidth: '350px', height: '140px' }}
            >
              <div
                className="relative rounded-3xl overflow-hidden flex items-center justify-center transition-all duration-300 h-full"
                style={{
                  height: '140px',
                  background: 'rgba(0,193,208,0.03)',
                  border: '2px dashed rgba(0,193,208,0.2)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >

                {/* Premium Content */}
                <div className="relative z-10 text-center p-4">
                  <div
                    className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'rgba(0,193,208,0.08)',
                      border: '1px solid rgba(0,193,208,0.15)'
                    }}
                  >
                    <Icon icon="solar:add-circle-bold-duotone" className="w-10 h-10 text-[#00c1d0]" />
                  </div>
                  <h4
                    className="text-base font-black mb-1 text-[#00c1d0]"
                  >
                    Add New Bed
                  </h4>
                  <p className="text-sm text-gray-500 font-medium">Click to create</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

    </div>
  );
};

export default DepartmentBedsTab;