import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Icon, { SolarIcons } from '../ui/Icon';
import { ConfirmDialog } from './UserManagement/ConfirmDialog';
import { describeDbError, ensureRowsUpdated } from './UserManagement/staffUtils';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface Department {
  id: string;
  practice_id: string;
  name: string;
  description?: string;
  head_user_id?: string;
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
  department?: string | null;
  is_active?: boolean | null;
}

const DepartmentManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Predefined department colors (Cyan is the default), named so the colour swatches - buttons
  // with no text - can be read out by screen readers and show a tooltip
  const departmentColorOptions = [
    { value: '#01b9d4', name: 'Cyan' },
    { value: '#8B5CF6', name: 'Purple' },
    { value: '#10B981', name: 'Green' },
    { value: '#F59E0B', name: 'Amber' },
    { value: '#EF4444', name: 'Red' },
    { value: '#3B82F6', name: 'Blue' },
    { value: '#EC4899', name: 'Pink' },
    { value: '#6366F1', name: 'Indigo' }
  ];

  useEffect(() => {
    if (user?.practice_id) {
      loadDepartments();
      loadUsers();
    }
  }, [user?.practice_id]);

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
        .select('id, full_name, job_title, avatar, department, is_active')
        .eq('practice_id', user?.practice_id)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      // Without staff every department would show "0 members" and an empty head list
      toast.error('Failed to load staff for departments');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!user?.practice_id) {
      toast.error('No practice ID found. Please refresh and try again.');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    setSaving(true);
    try {
      const departmentData = {
        ...formData,
        name: formData.name.trim(),
        // '' is not a valid uuid; "no head" must be stored as null
        head_user_id: formData.head_user_id || null,
        practice_id: user.practice_id,
        updated_at: new Date().toISOString()
      };

      if (editingDepartment) {
        const { data, error } = await supabase
          .from('departments')
          .update(departmentData)
          .eq('id', editingDepartment.id)
          .select('id');

        if (error) throw error;
        // The access rules skip a refused update without an error; don't report that as saved
        ensureRowsUpdated(data, 'The department');

        // Staff belong to a department by its name (users.department): a rename must take them along,
        // or the department shows no staff and they show a department that no longer exists
        const oldName = editingDepartment.name;
        if (oldName && oldName !== departmentData.name) {
          const { error: staffError } = await supabase
            .from('users')
            .update({ department: departmentData.name })
            .eq('practice_id', user.practice_id)
            .eq('department', oldName);
          if (staffError) {
            console.error('Error moving staff to the renamed department:', staffError);
            toast.error(`The department was renamed, but its staff still show "${oldName}". Open each person in Users to choose the department again.`);
          }
        }
        toast.success('Department updated successfully');
      } else {
        const { data, error } = await supabase
          .from('departments')
          .insert(departmentData)
          .select('id');

        if (error) throw error;
        ensureRowsUpdated(data, 'The department');
        toast.success('Department created successfully');
      }

      setShowForm(false);
      setEditingDepartment(null);
      resetForm();
      loadDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      toast.error(describeDbError(error, 'Failed to save department'));
    } finally {
      setSaving(false);
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
    setDeleting(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;
      ensureRowsUpdated(data, 'The department');

      toast.success('Department deleted successfully');
      setDepartmentToDelete(null);
      loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error(describeDbError(error, 'Failed to delete department'));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (department: Department) => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .update({ is_active: !department.is_active })
        .eq('id', department.id)
        .select('id');

      if (error) throw error;
      ensureRowsUpdated(data, 'The department');

      toast.success(`Department ${department.is_active ? 'deactivated' : 'activated'} successfully`);
      loadDepartments();
    } catch (error) {
      console.error('Error toggling department status:', error);
      toast.error(describeDbError(error, 'Failed to update department status'));
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

  // Escape closes the department form without saving, as its X does
  useEscapeToClose(showForm, () => {
    setShowForm(false);
    setEditingDepartment(null);
    resetForm();
  });

  // Staff are linked to a department by its name (users.department); count active staff only
  const getUsersInDepartment = (departmentName: string) => {
    const name = departmentName.trim().toLowerCase();
    return users.filter(u => u.is_active !== false && u.department?.trim().toLowerCase() === name);
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
              <Icon icon={SolarIcons.plus} className="w-5 h-5 mr-2" />
              Add Department
            </Button>
          </div>

          {/* Departments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.length === 0 ? (
              <div className="col-span-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                <Icon icon={SolarIcons.building} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-700 font-medium">No departments yet</p>
                <p className="text-sm text-gray-500 mt-1">Create your first department to organize your team</p>
              </div>
            ) : (
              departments.map((department) => {
                const usersInDept = getUsersInDepartment(department.name);
                const departmentHead = users.find(u => u.id === department.head_user_id);
                
                return (
                  <div
                    key={department.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${department.color}20` }}
                        >
                          <Icon 
                            icon={SolarIcons.building} 
                            className="w-6 h-6" 
                            style={{ color: department.color }}
                          />
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900">{department.name}</h5>
                          {department.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full mt-1">
                              <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-full mt-1">
                              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleToggleActive(department)}
                          className={`p-1.5 rounded-lg transition-all duration-200 ${
                            department.is_active 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-gray-400 hover:bg-gray-50'
                          }`}
                          title={department.is_active ? 'Deactivate department' : 'Activate department'}
                          aria-label={`${department.is_active ? 'Deactivate' : 'Activate'} department ${department.name}`}
                        >
                          <Icon icon={department.is_active ? SolarIcons.checkCircle : SolarIcons.dangerCircle} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(department)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200"
                          title="Edit department"
                          aria-label={`Edit department ${department.name}`}
                        >
                          <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDepartmentToDelete(department)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Delete department"
                          aria-label={`Delete department ${department.name}`}
                        >
                          <Icon icon={SolarIcons.trash} className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {department.description && (
                      <p className="text-sm text-gray-600 mb-3">{department.description}</p>
                    )}

                    <div className="space-y-3">
                      {departmentHead && (
                        <div className="flex items-center gap-2 text-sm">
                          <Icon icon={SolarIcons.userCircle} className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Head:</span>
                          <span className="font-medium text-gray-900">{departmentHead.full_name}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Icon icon={SolarIcons.users} className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Staff:</span>
                        <span className="font-medium text-gray-900">{usersInDept.length} {usersInDept.length === 1 ? 'member' : 'members'}</span>
                      </div>
                    </div>
                  </div>
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
                      <Icon icon={SolarIcons.building} className="w-6 h-6 text-white" />
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
                    aria-label="Close without saving"
                    title="Close"
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Icon icon={SolarIcons.close} className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label htmlFor="department-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="department-name"
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
                    {departmentColorOptions.map(({ value: color, name: colorName }) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        aria-label={`${colorName} department colour`}
                        aria-pressed={formData.color === color}
                        title={colorName}
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
                    isLoading={saving}
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                  >
                    {!saving && <Icon icon={editingDepartment ? SolarIcons.save : SolarIcons.plus} className="w-5 h-5 mr-2" />}
                    {saving ? 'Saving...' : editingDepartment ? 'Update Department' : 'Create Department'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {(() => {
        const assignedCount = departmentToDelete ? getUsersInDepartment(departmentToDelete.name).length : 0;
        return (
          <ConfirmDialog
            isOpen={!!departmentToDelete}
            tone={assignedCount > 0 ? 'warning' : 'danger'}
            title={assignedCount > 0 ? 'Department still has staff' : 'Delete department?'}
            message={departmentToDelete ? (
              assignedCount > 0 ? (
                <p>
                  <strong>{departmentToDelete.name}</strong> has {assignedCount} active staff member{assignedCount === 1 ? '' : 's'}.
                  Move them to another department first, or deactivate the department instead so their records stay consistent.
                </p>
              ) : (
                <p><strong>{departmentToDelete.name}</strong> will be permanently deleted. This cannot be undone.</p>
              )
            ) : null}
            confirmLabel={assignedCount > 0 ? (departmentToDelete?.is_active ? 'Deactivate instead' : 'Close') : 'Delete department'}
            isLoading={deleting}
            onConfirm={async () => {
              if (!departmentToDelete) return;
              if (assignedCount > 0) {
                if (departmentToDelete.is_active) await handleToggleActive(departmentToDelete);
                setDepartmentToDelete(null);
                return;
              }
              handleDelete(departmentToDelete.id);
            }}
            onCancel={() => setDepartmentToDelete(null)}
          />
        );
      })()}
    </div>
  );
};

export default DepartmentManagement;