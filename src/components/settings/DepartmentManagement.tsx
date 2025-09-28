import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import FullScreenDepartmentModalClean from './FullScreenDepartmentModalClean';
import { wardManagementService } from '../../services/wardManagementService';

interface Department {
  id: string;
  practice_id: string;
  department_name?: string;
  name?: string;
  department_code?: string;
  description?: string;
  head_user_id?: string;
  head_of_department?: string;
  contact_email?: string;
  contact_phone?: string;
  location?: string;
  color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DepartmentUser {
  id: string;
  full_name: string;
  job_title?: string;
  avatar?: string;
}

const DepartmentManagement: React.FC = () => {
  const { user } = useAuthStore();
  const { practiceId } = usePractice();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    head_user_id: '',
    color: '#01b9d4',
    is_active: true
  });
  const [users, setUsers] = useState<DepartmentUser[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [departmentStats, setDepartmentStats] = useState<Record<string, any>>({});

  // Predefined department colors
  const departmentColors = [
    '#01b9d4', // Cyan (default)
    '#8B5CF6', // Purple
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#3B82F6', // Blue
    '#EC4899', // Pink
    '#6366F1', // Indigo
  ];

  useEffect(() => {
    if (user?.practice_id) {
      loadDepartments();
      loadUsers();
    }
  }, [user?.practice_id]);

  useEffect(() => {
    if (departments.length > 0 && practiceId) {
      loadDepartmentStats();
    }
  }, [departments, practiceId]);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, job_title, avatar')
        .eq('practice_id', user?.practice_id)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadDepartmentStats = async () => {
    try {
      const stats: Record<string, any> = {};

      for (const dept of departments) {
        const { data } = await wardManagementService.getDepartmentWardStatistics(dept.id);
        if (data) {
          stats[dept.id] = data;
        }
      }

      setDepartmentStats(stats);
    } catch (error) {
      console.error('Error loading department statistics:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.practice_id) {
      toast.error('No practice ID found. Please refresh and try again.');
      return;
    }
    
    try {
      const departmentData = {
        ...formData,
        practice_id: user.practice_id,
        updated_at: new Date().toISOString()
      };

      if (editingDepartment) {
        const { error } = await supabase
          .from('departments')
          .update(departmentData)
          .eq('id', editingDepartment.id);

        if (error) throw error;
        toast.success('Department updated successfully');
      } else {
        const { error } = await supabase
          .from('departments')
          .insert(departmentData);

        if (error) throw error;
        toast.success('Department created successfully');
      }

      setShowForm(false);
      setEditingDepartment(null);
      resetForm();
      loadDepartments();
    } catch (error: any) {
      console.error('Error saving department:', error);
      toast.error(error.message || 'Failed to save department');
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      head_user_id: department.head_user_id || '',
      color: department.color || '#01b9d4',
      is_active: department.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Department deleted successfully');
      loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error('Failed to delete department');
    }
  };

  const handleToggleActive = async (department: Department) => {
    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: !department.is_active })
        .eq('id', department.id);

      if (error) throw error;

      toast.success(`Department ${department.is_active ? 'deactivated' : 'activated'} successfully`);
      loadDepartments();
    } catch (error) {
      console.error('Error toggling department status:', error);
      toast.error('Failed to update department status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      head_user_id: '',
      color: '#01b9d4',
      is_active: true
    });
  };

  const getUsersInDepartment = (departmentName: string) => {
    return users.filter(u => u.job_title?.toLowerCase().includes(departmentName.toLowerCase()));
  };

  const handleOpenDepartmentModal = (department: Department) => {
    setSelectedDepartment(department);
    setShowDepartmentModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Department Management</h2>
              <p className="text-gray-600 mt-1">Organize your practice into departments</p>
            </div>
            <Button
              onClick={() => {
                setEditingDepartment(null);
                resetForm();
                setShowForm(true);
              }}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:shadow-lg transition-all duration-200"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5 mr-2" />
              Add Department
            </Button>
          </div>

          {/* Departments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.length === 0 ? (
              <div className="col-span-full bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center">
                <Icon icon="solar:hospital-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-700">No departments yet</p>
                <p className="text-sm text-gray-500 mt-2">Create your first department to organize your healthcare facility</p>
              </div>
            ) : (
              departments.map((department) => {
                const usersInDept = getUsersInDepartment(department.name || department.department_name || '');
                const departmentHead = users.find(u => u.id === department.head_user_id);
                const stats = departmentStats[department.id] || {};
                const displayName = department.department_name || department.name || 'Unnamed';

                return (
                  <motion.div
                    key={department.id}
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="relative bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group"
                    onClick={() => handleOpenDepartmentModal(department)}
                  >
                    {/* Decorative Gradient Bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r"
                      style={{
                        backgroundImage: `linear-gradient(90deg, ${department.color || '#8B5CF6'}, ${department.color || '#8B5CF6'}dd)`
                      }}
                    />

                    <div className="p-6">
                      {/* Header Section */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <motion.div
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                            className="relative"
                          >
                            <div
                              className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                              style={{
                                backgroundColor: `${department.color || '#8B5CF6'}15`,
                                border: `2px solid ${department.color || '#8B5CF6'}30`
                              }}
                            >
                              <Icon
                                icon="solar:hospital-bold-duotone"
                                className="w-7 h-7"
                                style={{ color: department.color || '#8B5CF6' }}
                              />
                            </div>
                            {department.is_active && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                            )}
                          </motion.div>
                          <div>
                            <h5 className="font-bold text-gray-900 text-lg">{displayName}</h5>
                            {department.department_code && (
                              <p className="text-sm text-gray-500">{department.department_code}</p>
                            )}
                          </div>
                        </div>

                        {/* Quick Actions (prevent event bubbling) */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(department);
                            }}
                            className={`p-1.5 rounded-lg transition-all duration-200 ${
                              department.is_active
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-gray-400 hover:bg-gray-50'
                            }`}
                            title={department.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Icon icon={department.is_active ? "solar:check-circle-bold-duotone" : "solar:close-circle-bold-duotone"} className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Open the main department management modal instead of separate edit modal
                              handleOpenDepartmentModal(department);
                            }}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200"
                            title="Edit"
                          >
                            <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(department.id);
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                            title="Delete"
                          >
                            <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {department.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{department.description}</p>
                      )}

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-purple-50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:hospital-bold-duotone" className="w-4 h-4 text-purple-600" />
                            <span className="text-xs text-gray-600">Wards</span>
                          </div>
                          <p className="text-lg font-bold text-gray-900 mt-1">{stats.totalWards || 0}</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:bed-bold-duotone" className="w-4 h-4 text-blue-600" />
                            <span className="text-xs text-gray-600">Beds</span>
                          </div>
                          <p className="text-lg font-bold text-gray-900 mt-1">{stats.totalBeds || 0}</p>
                        </div>
                      </div>

                      {/* Department Info */}
                      <div className="space-y-2">
                        {departmentHead && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                              <Icon icon="solar:user-bold-duotone" className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs text-gray-600">Head:</span>
                            <span className="text-xs font-medium text-gray-900">{departmentHead.full_name}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                            <Icon icon="solar:users-group-rounded-bold-duotone" className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs text-gray-600">Staff:</span>
                          <span className="text-xs font-medium text-gray-900">{usersInDept.length} members</span>
                        </div>

                        {stats.availableBeds !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <Icon icon="solar:check-circle-bold-duotone" className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs text-gray-600">Available:</span>
                            <span className="text-xs font-medium text-green-600">{stats.availableBeds} beds</span>
                          </div>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${
                          department.is_active
                            ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700'
                            : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700'
                        }`}>
                          {department.is_active ? (
                            <><Icon icon="solar:check-circle-bold" className="w-3 h-3" /> Active</>
                          ) : (
                            <><Icon icon="solar:close-circle-bold" className="w-3 h-3" /> Inactive</>
                          )}
                        </span>

                        <div className="flex items-center gap-1 text-purple-600">
                          <span className="text-xs font-medium">View Details</span>
                          <Icon icon="solar:arrow-right-bold-duotone" className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Department Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden m-4"
            >
              <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Icon icon="solar:buildings-2-bold-duotone" className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      {editingDepartment ? 'Edit Department' : 'Add New Department'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingDepartment(null);
                      resetForm();
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department Head
                  </label>
                  <select
                    value={formData.head_user_id}
                    onChange={(e) => setFormData({ ...formData, head_user_id: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200"
                  >
                    <option value="">Select department head</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} {user.job_title && `(${user.job_title})`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department Color
                  </label>
                  <div className="grid grid-cols-8 gap-2">
                    {departmentColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-10 h-10 rounded-lg transition-all duration-200 ${
                          formData.color === color 
                            ? 'ring-2 ring-offset-2 ring-purple-500 scale-110' 
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-2"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    Active Department
                  </label>
                </div>
                
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingDepartment(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                  >
                    <Icon icon={editingDepartment ? "solar:diskette-bold-duotone" : "solar:add-circle-bold-duotone"} className="w-5 h-5 mr-2" />
                    {editingDepartment ? 'Update Department' : 'Create Department'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Department Modal */}
      {selectedDepartment && practiceId && (
        <FullScreenDepartmentModalClean
          isOpen={showDepartmentModal}
          onClose={() => {
            setShowDepartmentModal(false);
            setSelectedDepartment(null);
            loadDepartmentStats(); // Refresh statistics after changes
          }}
          department={selectedDepartment}
          onUpdate={loadDepartments}
        />
      )}
    </div>
  );
};

export default DepartmentManagement;