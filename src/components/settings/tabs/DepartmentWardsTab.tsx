import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { PremiumInput, PremiumTextarea, PremiumSelect } from '../../ui/PremiumInput';

interface Ward {
  id: string;
  ward_name: string;
  ward_code: string;
  department_id: string;
  capacity: number;
  current_occupancy: number;
  ward_type: string;
  floor_number: number;
  building: string;
  nurse_station_phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  bed_count?: number;
  available_bed_count?: number;
}

interface WardFormData {
  ward_name: string;
  ward_code: string;
  capacity: number;
  current_occupancy: number;
  ward_type: string;
  floor_number: number;
  building: string;
  nurse_station_phone: string;
  is_active: boolean;
}

interface DepartmentWardsTabProps {
  selectedDepartment: any;
}

const DepartmentWardsTab: React.FC<DepartmentWardsTabProps> = ({
  selectedDepartment,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [wards, setWards] = useState<Ward[]>([]);
  const [editingWard, setEditingWard] = useState<Ward | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm<WardFormData>({
    defaultValues: {
      ward_name: '',
      ward_code: '',
      capacity: 20,
      current_occupancy: 0,
      ward_type: 'General',
      floor_number: 1,
      building: 'Main Building',
      nurse_station_phone: '',
      is_active: true
    }
  });

  // Load all wards for this department
  useEffect(() => {
    if (selectedDepartment?.id) {
      loadWards();
    }
  }, [selectedDepartment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWards = async () => {
    try {
      setIsLoading(true);

      // Single optimized query: get wards with bed counts in ONE call
      const { data: wardsData, error: wardsError } = await supabase
        .from('wards')
        .select(`
          *,
          beds:beds(id, bed_status)
        `)
        .eq('department_id', selectedDepartment.id)
        .order('ward_name', { ascending: true });

      if (wardsError) {
        console.error('Error loading wards:', wardsError);
        toast.error('Failed to load wards');
      } else {
        // Calculate bed counts from the joined data (no additional queries!)
        const wardsWithBedCounts = (wardsData || []).map((ward: any) => {
          const beds = ward.beds || [];
          const totalBeds = beds.length;
          const availableBeds = beds.filter((b: any) => b.bed_status === 'Available').length;

          // Remove the beds array from the ward object to keep it clean
          const { beds: _, ...wardWithoutBeds } = ward;

          return {
            ...wardWithoutBeds,
            bed_count: totalBeds,
            available_bed_count: availableBeds
          };
        });

        setWards(wardsWithBedCounts);
      }
    } catch (err) {
      console.error('Error loading wards:', err);
      toast.error('Failed to load wards');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (formData: WardFormData) => {
    try {
      setIsSaving(true);

      const wardData = {
        ...formData,
        department_id: selectedDepartment.id,
        practice_id: selectedDepartment.practice_id,
        updated_at: new Date().toISOString()
      };

      if (editingWard) {
        // Update existing ward
        const { error } = await supabase
          .from('wards')
          .update(wardData)
          .eq('id', editingWard.id);

        if (error) throw error;
        toast.success('Ward updated successfully');
      } else {
        // Create new ward
        const { error } = await supabase
          .from('wards')
          .insert({
            ...wardData,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        toast.success('Ward created successfully');
      }

      // Reset form and reload
      setEditingWard(null);
      setIsFormOpen(false);
      reset();
      loadWards();
    } catch (error) {
      console.error('Error saving ward:', error);
      toast.error('Failed to save ward');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (ward: Ward) => {
    setEditingWard(ward);
    reset({
      ward_name: ward.ward_name,
      ward_code: ward.ward_code,
      capacity: ward.capacity,
      current_occupancy: ward.current_occupancy,
      ward_type: ward.ward_type,
      floor_number: ward.floor_number,
      building: ward.building,
      nurse_station_phone: ward.nurse_station_phone,
      is_active: ward.is_active
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ward?')) return;

    try {
      const { error } = await supabase
        .from('wards')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Ward deleted successfully');
      loadWards();
    } catch (error) {
      console.error('Error deleting ward:', error);
      toast.error('Failed to delete ward');
    }
  };

  const getOccupancyColor = (occupancy: number, capacity: number) => {
    const percentage = (occupancy / capacity) * 100;
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 70) return 'text-orange-600 bg-orange-100';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getWardTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'intensive care':
      case 'icu':
        return 'solar:heart-pulse-bold-duotone';
      case 'maternity':
        return 'solar:baby-bold-duotone';
      case 'pediatrics':
      case 'pediatric':
        return 'solar:teddy-bear-bold-duotone';
      case 'surgery':
      case 'surgical':
        return 'solar:medical-kit-bold-duotone';
      case 'emergency':
        return 'solar:siren-rounded-bold-duotone';
      default:
        return 'solar:bed-bold-duotone';
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
              <Icon icon="solar:bed-bold-duotone" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Hospital Wards
              </h3>
              <p className="text-sm text-gray-600">
                Ward management and configuration
              </p>
            </div>
          </div>
          {isFormOpen ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingWard(null);
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
                {isSaving ? 'Saving...' : editingWard ? 'Update Ward' : 'Save Ward'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingWard(null);
                reset({
                  ward_name: '',
                  ward_code: '',
                  capacity: 20,
                  current_occupancy: 0,
                  ward_type: 'General',
                  floor_number: 1,
                  building: 'Main Building',
                  nurse_station_phone: '',
                  is_active: true
                });
                setIsFormOpen(true);
              }}
              className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-purple-100 text-purple-600 hover:bg-purple-200"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" />
              Add Ward
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
              {editingWard ? 'Edit Ward' : 'Add New Ward'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Fill in the ward details below
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Ward Information Section */}
            <div className="bg-white rounded-lg p-6 border border-gray-200/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-50">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4 text-blue-600" />
                </div>
                Ward Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Ward Name</label>
                  <PremiumInput
                    {...register('ward_name', { required: 'Ward name is required' })}
                    error={errors.ward_name?.message}
                    icon="solar:bed-bold-duotone"
                    placeholder="e.g., General Ward A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Ward Code</label>
                  <PremiumInput
                    {...register('ward_code', { required: 'Ward code is required' })}
                    error={errors.ward_code?.message}
                    icon="solar:code-square-bold-duotone"
                    placeholder="e.g., GWA-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Ward Type</label>
                  <PremiumSelect
                    {...register('ward_type')}
                    error={errors.ward_type?.message}
                    icon="solar:clipboard-heart-bold-duotone"
                  >
                    <option value="General">General</option>
                    <option value="Intensive Care">Intensive Care (ICU)</option>
                    <option value="Maternity">Maternity</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Surgery">Surgery</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Isolation">Isolation</option>
                    <option value="Psychiatric">Psychiatric</option>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Total Bed Capacity</label>
                  <PremiumInput
                    type="number"
                    {...register('capacity', {
                      required: 'Capacity is required',
                      min: { value: 1, message: 'Must be at least 1' }
                    })}
                    error={errors.capacity?.message}
                    icon="solar:users-group-rounded-bold-duotone"
                    placeholder="20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Current Occupancy</label>
                  <PremiumInput
                    type="number"
                    {...register('current_occupancy', {
                      min: { value: 0, message: 'Cannot be negative' }
                    })}
                    error={errors.current_occupancy?.message}
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
              </div>
            </div>

            {/* Contact Section */}
            <div className="bg-white rounded-lg p-6 border border-gray-200/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-green-50">
                  <Icon icon="solar:phone-calling-bold-duotone" className="w-4 h-4 text-green-600" />
                </div>
                Contact Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nurse Station Phone Number</label>
                  <PremiumInput
                    {...register('nurse_station_phone')}
                    error={errors.nurse_station_phone?.message}
                    icon="solar:phone-bold-duotone"
                    placeholder="+27 11 123 4567"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-3 cursor-pointer bg-gray-50 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      {...register('is_active')}
                      className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Ward is Active</span>
                      <p className="text-xs text-gray-500">Enable or disable this ward</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

          </form>
        </motion.div>
      )}

      {/* Wards Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50">
            <h3 className="text-sm font-semibold text-gray-700">Ward Records</h3>
            <p className="text-xs text-gray-500 mt-1">Manage and monitor all hospital wards</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ward Details</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Bed Occupancy</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nurse Station</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {wards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Icon icon="solar:bed-bold-duotone" className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No wards created yet</p>
                        <p className="text-gray-400 text-sm mt-1">Click "Add Ward" to create your first ward</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  wards.map((ward) => (
                    <tr key={ward.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50">
                            <Icon
                              icon={getWardTypeIcon(ward.ward_type)}
                              className="w-5 h-5 text-purple-600"
                            />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{ward.ward_name}</div>
                            <div className="text-xs text-gray-500 font-mono">{ward.ward_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 font-medium">{ward.ward_type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="text-gray-900 font-medium">{ward.building}</div>
                          <div className="text-xs text-gray-500">Floor {ward.floor_number}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getOccupancyColor(ward.current_occupancy, ward.capacity)}`}>
                              {ward.current_occupancy}/{ward.capacity} beds
                            </span>
                            <span className="text-xs text-gray-500">
                              ({Math.round((ward.current_occupancy / ward.capacity) * 100)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                (ward.current_occupancy / ward.capacity) * 100 >= 90 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                                (ward.current_occupancy / ward.capacity) * 100 >= 70 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                                (ward.current_occupancy / ward.capacity) * 100 >= 50 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                                'bg-gradient-to-r from-green-400 to-green-600'
                              }`}
                              style={{ width: `${Math.min((ward.current_occupancy / ward.capacity) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {ward.nurse_station_phone ? (
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:phone-bold-duotone" className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">{ward.nurse_station_phone}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                          ward.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            ward.is_active ? 'bg-green-500' : 'bg-gray-500'
                          }`} />
                          {ward.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(ward)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all group"
                            title="Edit Ward"
                          >
                            <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
                          <button
                            onClick={() => handleDelete(ward.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all group"
                            title="Delete Ward"
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
          {wards.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{wards.length}</span> ward{wards.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:bed-bold-duotone" className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Total Beds:</span>
                    <span className="font-semibold text-gray-900">
                      {wards.reduce((sum, ward) => sum + (ward.bed_count || 0), 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:user-check-bold-duotone" className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Available:</span>
                    <span className="font-semibold text-gray-900">
                      {wards.reduce((sum, ward) => sum + (ward.available_bed_count || 0), 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:chart-bold-duotone" className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Overall Occupancy:</span>
                    <span className={`font-bold ${
                      (() => {
                        const totalBeds = wards.reduce((sum, ward) => sum + (ward.bed_count || 0), 0);
                        const availableBeds = wards.reduce((sum, ward) => sum + (ward.available_bed_count || 0), 0);
                        const occupiedBeds = totalBeds - availableBeds;
                        const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
                        return occupancyRate >= 80 ? 'text-red-600' : 'text-green-600';
                      })()
                    }`}>
                      {(() => {
                        const totalBeds = wards.reduce((sum, ward) => sum + (ward.bed_count || 0), 0);
                        const availableBeds = wards.reduce((sum, ward) => sum + (ward.available_bed_count || 0), 0);
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

export default DepartmentWardsTab;