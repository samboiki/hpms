import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';

interface Department {
  id: string;
  name: string;
  description?: string;
  color?: string;
  is_active: boolean;
}

interface DepartmentSelectionModalProps {
  userId?: string;
  currentDepartment?: string;
  onClose: () => void;
  onSuccess: (departmentName: string) => void;
}

export const DepartmentSelectionModal: React.FC<DepartmentSelectionModalProps> = ({
  userId,
  currentDepartment,
  onClose,
  onSuccess
}) => {
  const { user } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(currentDepartment || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .eq('is_active', true)
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

  const handleSubmit = async () => {
    if (!selectedDepartment) {
      toast.error('Please select a department');
      return;
    }

    // If no userId, just return the selected department (for new users)
    if (!userId || userId === 'new-user') {
      onSuccess(selectedDepartment);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ department: selectedDepartment })
        .eq('id', userId);

      if (error) throw error;

      toast.success('Department updated successfully');
      onSuccess(selectedDepartment);
    } catch (error: any) {
      console.error('Error updating department:', error);
      toast.error(error.message || 'Failed to update department');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDepartment = async () => {
    // If no userId, just return empty department (for new users)
    if (!userId || userId === 'new-user') {
      onSuccess('');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ department: null })
        .eq('id', userId);

      if (error) throw error;

      toast.success('Department cleared successfully');
      onSuccess('');
    } catch (error: any) {
      console.error('Error clearing department:', error);
      toast.error(error.message || 'Failed to clear department');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg"
      >
        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Icon icon={SolarIcons.building} className="w-5 h-5 text-purple-600" />
                </div>
                <CardTitle>Select Department</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <Icon icon={SolarIcons.close} className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            ) : departments.length === 0 ? (
              <div className="text-center py-8">
                <Icon icon={SolarIcons.building} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No departments available</p>
                <p className="text-sm text-gray-500 mt-1">Ask your administrator to create departments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {departments.map((dept) => (
                  <label
                    key={dept.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                      selectedDepartment === dept.name
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="department"
                      value={dept.name}
                      checked={selectedDepartment === dept.name}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${dept.color}20` }}
                    >
                      <Icon
                        icon={SolarIcons.building}
                        className="w-5 h-5"
                        style={{ color: dept.color }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{dept.name}</p>
                      {dept.description && (
                        <p className="text-sm text-gray-600 mt-0.5">{dept.description}</p>
                      )}
                    </div>
                    {selectedDepartment === dept.name && (
                      <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                        <Icon icon={SolarIcons.check} className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearDepartment}
                disabled={saving || !currentDepartment}
                className="text-gray-600"
              >
                Clear Department
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={saving || !selectedDepartment || selectedDepartment === currentDepartment}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Icon icon={SolarIcons.check} className="w-4 h-4 mr-2" />
                      Update Department
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};