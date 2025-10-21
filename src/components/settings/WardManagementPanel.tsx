import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { wardManagementService, Ward, WardFormData } from '../../services/wardManagementService';
import { supabase } from '../../lib/supabase';
import BedManagementPanel from './BedManagementPanel';

interface WardManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId: string;
  departmentName: string;
  practiceId: string;
}

const WardManagementPanel: React.FC<WardManagementPanelProps> = ({
  isOpen,
  onClose,
  departmentId,
  departmentName,
  practiceId,
}) => {
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWard, setEditingWard] = useState<Ward | null>(null);
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
  const [showBedManagement, setShowBedManagement] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);

  const [formData, setFormData] = useState<WardFormData>({
    ward_name: '',
    ward_code: '',
    ward_type: 'general',
    floor_number: 1,
    branch_id: '',
    department_id: departmentId,
    nurse_station_ext: '',
    head_nurse_id: '',
    description: '',
    features: [],
    visiting_hours_start: '08:00',
    visiting_hours_end: '20:00',
    max_visitors_per_patient: 2,
    is_active: true,
  });

  const wardTypes = [
    { value: 'general', label: 'General Ward', icon: 'solar:hospital-bed-bold-duotone' },
    { value: 'icu', label: 'ICU', icon: 'solar:heart-pulse-bold-duotone' },
    { value: 'pediatric', label: 'Pediatric', icon: 'solar:baby-bold-duotone' },
    { value: 'maternity', label: 'Maternity', icon: 'solar:user-heart-bold-duotone' },
    { value: 'emergency', label: 'Emergency', icon: 'solar:siren-bold-duotone' },
    { value: 'surgical', label: 'Surgical', icon: 'solar:medical-kit-bold-duotone' },
    { value: 'psychiatric', label: 'Psychiatric', icon: 'solar:head-bold-duotone' },
    { value: 'oncology', label: 'Oncology', icon: 'solar:shield-plus-bold-duotone' },
  ];

  const wardFeatures = [
    'cardiac_monitoring',
    'ventilators',
    'telemetry',
    'isolation_capable',
    'oxygen_supply',
    'central_monitoring',
    'emergency_equipment',
    'specialized_nursing',
  ];

  useEffect(() => {
    if (isOpen && departmentId) {
      loadWards();
      loadBranches();
      loadNurses();
    }
  }, [isOpen, departmentId]);

  const loadWards = async () => {
    setLoading(true);
    try {
      const { data, error } = await wardManagementService.getWardsByDepartment(departmentId);
      if (error) throw error;
      setWards(data || []);
    } catch (error) {
      console.error('Error loading wards:', error);
      toast.error('Failed to load wards');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadNurses = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('practice_id', practiceId)
        .or('role.eq.nurse,role.eq.head_nurse')
        .order('name');

      if (error) throw error;
      setNurses(data || []);
    } catch (error) {
      console.error('Error loading nurses:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingWard) {
        const { error } = await wardManagementService.updateWard(editingWard.id, formData);
        if (error) throw error;
        toast.success('Ward updated successfully');
      } else {
        const { error } = await wardManagementService.createWard(practiceId, formData);
        if (error) throw error;
        toast.success('Ward created successfully');
      }

      setShowForm(false);
      setEditingWard(null);
      resetForm();
      loadWards();
    } catch (error: any) {
      console.error('Error saving ward:', error);
      toast.error(error.message || 'Failed to save ward');
    }
  };

  const handleEdit = (ward: Ward) => {
    setEditingWard(ward);
    setFormData({
      ward_name: ward.ward_name,
      ward_code: ward.ward_code || '',
      ward_type: ward.ward_type || 'general',
      floor_number: ward.floor_number || 1,
      branch_id: ward.branch_id || '',
      department_id: departmentId,
      nurse_station_ext: ward.nurse_station_ext || '',
      head_nurse_id: ward.head_nurse_id || '',
      description: ward.description || '',
      features: ward.features || [],
      visiting_hours_start: ward.visiting_hours_start || '08:00',
      visiting_hours_end: ward.visiting_hours_end || '20:00',
      max_visitors_per_patient: ward.max_visitors_per_patient || 2,
      is_active: ward.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (ward: Ward) => {
    if (!confirm(`Are you sure you want to delete ${ward.ward_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await wardManagementService.deleteWard(ward.id);
      if (error) throw error;
      toast.success('Ward deleted successfully');
      loadWards();
    } catch (error: any) {
      console.error('Error deleting ward:', error);
      toast.error(error.message || 'Failed to delete ward');
    }
  };

  const handleManageBeds = (ward: Ward) => {
    setSelectedWard(ward);
    setShowBedManagement(true);
  };

  const resetForm = () => {
    setFormData({
      ward_name: '',
      ward_code: '',
      ward_type: 'general',
      floor_number: 1,
      branch_id: '',
      department_id: departmentId,
      nurse_station_ext: '',
      head_nurse_id: '',
      description: '',
      features: [],
      visiting_hours_start: '08:00',
      visiting_hours_end: '20:00',
      max_visitors_per_patient: 2,
      is_active: true,
    });
  };

  const getWardTypeIcon = (type: string) => {
    const wardType = wardTypes.find(wt => wt.value === type);
    return wardType?.icon || 'solar:hospital-bed-bold-duotone';
  };

  const getOccupancyColor = (occupied: number, total: number) => {
    if (total === 0) return 'bg-gray-500';
    const rate = (occupied / total) * 100;
    if (rate >= 90) return 'bg-red-500';
    if (rate >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-full md:w-2/3 lg:w-1/2 bg-white shadow-2xl z-50 overflow-hidden"
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <button
                      onClick={onClose}
                      className="text-white/80 hover:text-white mr-4 transition-colors"
                    >
                      <Icon icon="solar:arrow-left-bold-duotone" className="w-6 h-6" />
                    </button>
                    <span className="text-white/80">Department:</span>
                    <h2 className="text-2xl font-bold text-white">{departmentName} - Ward Management</h2>
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
                {/* Action Bar */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">{wards.length}</span> Wards
                    </div>
                    {wards.length > 0 && (
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold">
                          {wards.reduce((sum, w) => sum + w.occupied_beds, 0)}/
                          {wards.reduce((sum, w) => sum + w.total_beds, 0)}
                        </span> Beds Occupied
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setEditingWard(null);
                      resetForm();
                      setShowForm(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                    Add Ward
                  </button>
                </div>

                {/* Form */}
                {showForm && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 rounded-xl p-6 mb-6"
                  >
                    <h3 className="text-lg font-semibold mb-4">
                      {editingWard ? 'Edit Ward' : 'New Ward'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ward Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.ward_name}
                            onChange={(e) => setFormData({ ...formData, ward_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            placeholder="e.g., ICU Ward A"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ward Code
                          </label>
                          <input
                            type="text"
                            value={formData.ward_code}
                            onChange={(e) => setFormData({ ...formData, ward_code: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            placeholder="e.g., ICU-A"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ward Type
                          </label>
                          <select
                            value={formData.ward_type}
                            onChange={(e) => setFormData({ ...formData, ward_type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          >
                            {wardTypes.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Floor Number
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.floor_number}
                            onChange={(e) => setFormData({ ...formData, floor_number: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Branch
                          </label>
                          <select
                            value={formData.branch_id}
                            onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">No specific branch</option>
                            {branches.map(branch => (
                              <option key={branch.id} value={branch.id}>
                                {branch.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Head Nurse
                          </label>
                          <select
                            value={formData.head_nurse_id}
                            onChange={(e) => setFormData({ ...formData, head_nurse_id: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Not assigned</option>
                            {nurses.map(nurse => (
                              <option key={nurse.id} value={nurse.id}>
                                {nurse.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ward Features
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {wardFeatures.map(feature => (
                            <label key={feature} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={formData.features?.includes(feature)}
                                onChange={(e) => {
                                  const newFeatures = e.target.checked
                                    ? [...(formData.features || []), feature]
                                    : formData.features?.filter(f => f !== feature) || [];
                                  setFormData({ ...formData, features: newFeatures });
                                }}
                                className="rounded text-purple-600 focus:ring-purple-500"
                              />
                              <span className="text-sm">{feature.replace(/_/g, ' ')}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowForm(false);
                            setEditingWard(null);
                            resetForm();
                          }}
                          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all"
                        >
                          {editingWard ? 'Update Ward' : 'Create Ward'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* Wards List */}
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : wards.length === 0 ? (
                  <div className="text-center py-12">
                    <Icon
                      icon="solar:hospital-bold-duotone"
                      className="w-16 h-16 text-gray-300 mx-auto mb-4"
                    />
                    <p className="text-gray-500">No wards created yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Click "Add Ward" to create your first ward
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {wards.map((ward) => (
                      <motion.div
                        key={ward.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              ward.is_active ? 'bg-purple-100' : 'bg-gray-100'
                            }`}>
                              <Icon
                                icon={getWardTypeIcon(ward.ward_type || 'general')}
                                className={`w-6 h-6 ${ward.is_active ? 'text-purple-600' : 'text-gray-400'}`}
                              />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{ward.ward_name}</h4>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-sm text-gray-500">
                                  {ward.ward_code || 'No code'}
                                </span>
                                {ward.branch?.name && (
                                  <span className="text-sm text-gray-500">
                                    Branch: {ward.branch.name}
                                  </span>
                                )}
                                <span className="text-sm text-gray-500">
                                  Floor {ward.floor_number || 'N/A'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-2">
                                  <Icon icon="solar:hospital-bed-bold-duotone" className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium">
                                    {ward.occupied_beds}/{ward.total_beds} beds
                                  </span>
                                </div>
                                {ward.total_beds > 0 && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${getOccupancyColor(ward.occupied_beds, ward.total_beds)}`}
                                        style={{ width: `${(ward.occupied_beds / ward.total_beds) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-sm text-gray-500">
                                      {Math.round((ward.occupied_beds / ward.total_beds) * 100)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleManageBeds(ward)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Manage Beds"
                            >
                              <Icon icon="solar:hospital-bed-bold-duotone" className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleEdit(ward)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Edit Ward"
                            >
                              <Icon icon="solar:pen-bold-duotone" className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(ward)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Ward"
                            >
                              <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bed Management Panel */}
      {selectedWard && (
        <BedManagementPanel
          isOpen={showBedManagement}
          onClose={() => {
            setShowBedManagement(false);
            loadWards(); // Refresh ward data after bed changes
          }}
          wardId={selectedWard.id}
          wardName={selectedWard.ward_name}
        />
      )}
    </>
  );
};

export default WardManagementPanel;