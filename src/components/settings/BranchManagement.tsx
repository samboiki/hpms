import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Icon, { SolarIcons } from '../ui/Icon';
import TimePickerModal from '../ui/TimePickerModal';
import { describeDbError, ensureRowsUpdated, formatRole } from './UserManagement/staffUtils';
import { dayClosingBeforeOpening, parseTime12Hour } from './businessHours';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface BusinessHours {
  day: string;
  hours: string;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

interface Branch {
  id: string;
  practice_id: string;
  name: string;
  slug: string;
  address?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  business_hours?: BusinessHours[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Practice {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  contact_phone?: string;
  contact_email?: string;
  logo_url?: string;
}

interface BranchUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  branch_id?: string;
  avatar?: string;
}

// Helper function to convert 24hr time to 12hr format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Helper function to format business hours string
const formatBusinessHours = (openTime: string, closeTime: string): string => {
  if (!openTime || !closeTime) return 'Closed';
  return `${formatTime12Hour(openTime)} - ${formatTime12Hour(closeTime)}`;
};

// Default business hours
const defaultBusinessHours: BusinessHours[] = [
  { day: 'Monday', hours: '9:00 AM - 5:00 PM', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Tuesday', hours: '9:00 AM - 5:00 PM', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Wednesday', hours: '9:00 AM - 5:00 PM', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Thursday', hours: '9:00 AM - 5:00 PM', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Friday', hours: '9:00 AM - 5:00 PM', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Saturday', hours: 'Closed', isOpen: false, openTime: '', closeTime: '' },
  { day: 'Sunday', hours: 'Closed', isOpen: false, openTime: '', closeTime: '' }
];

// Helper function to parse business hours from database
const parseBusinessHours = (hours: BusinessHours[] | undefined | null): BusinessHours[] => {
  if (!hours || !Array.isArray(hours)) {
    return defaultBusinessHours;
  }
  
  return hours.map(h => {
    // If it already has the new format, return as is
    if (h.isOpen !== undefined) {
      return h;
    }
    
    // Parse old format "9:00 AM - 5:00 PM" or "Closed"
    const isClosed = h.hours === 'Closed' || !h.hours;
    let openTime = '09:00';
    let closeTime = '17:00';
    
    if (!isClosed && h.hours && h.hours.includes('-')) {
      // Try to parse existing hours format
      const parts = h.hours.split('-').map((s: string) => s.trim());
      if (parts.length === 2) {
        // Use the stored times; the form used to show 09:00-17:00 whatever was saved
        openTime = parseTime12Hour(parts[0]) ?? '09:00';
        closeTime = parseTime12Hour(parts[1]) ?? '17:00';
      }
    }
    
    return {
      day: h.day,
      hours: h.hours || 'Closed',
      isOpen: !isClosed,
      openTime: isClosed ? '' : openTime,
      closeTime: isClosed ? '' : closeTime
    };
  });
};

const BranchManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [practice, setPractice] = useState<Practice | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [allStaff, setAllStaff] = useState<BranchUser[]>([]);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timePickerConfig, setTimePickerConfig] = useState<{
    dayIndex: number;
    type: 'open' | 'close';
  } | null>(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    address: string;
    city: string;
    state_province: string;
    postal_code: string;
    phone: string;
    email: string;
    is_active: boolean;
    business_hours: BusinessHours[];
  }>({
    name: '',
    slug: '',
    address: '',
    city: '',
    state_province: '',
    postal_code: '',
    phone: '',
    email: '',
    is_active: true,
    business_hours: defaultBusinessHours
  });

  useEffect(() => {
    if (user?.practice_id) {
      loadPracticeAndBranches();
    }
  }, [user?.practice_id]);

  useEffect(() => {
    if (user?.practice_id) {
      loadAllStaff();
    }
  }, [user?.practice_id]);

  const loadPracticeAndBranches = async () => {
    try {
      setLoading(true);
      
      // Load practice details
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('*')
        .eq('id', user?.practice_id)
        .single();

      if (practiceError) throw practiceError;
      setPractice(practiceData);

      // Load branches
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('name');

      if (error) throw error;

      setBranches(data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load practice data');
    } finally {
      setLoading(false);
    }
  };

  const loadAllStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, branch_id, avatar')
        .eq('practice_id', user?.practice_id)
        .order('full_name');

      if (error) throw error;

      setAllStaff(data || []);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load the staff list');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.practice_id) {
      toast.error('No practice ID found. Please refresh and try again.');
      return;
    }

    const badDay = dayClosingBeforeOpening(formData.business_hours);
    if (badDay) {
      toast.error(`${badDay}: the closing time must be after the opening time.`);
      return;
    }
    
    try {
      const branchData = {
        ...formData,
        practice_id: user.practice_id,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
        updated_at: new Date().toISOString()
      };

      if (editingBranch) {
        const { data, error } = await supabase
          .from('branches')
          .update(branchData)
          .eq('id', editingBranch.id)
          .select('id');

        if (error) throw error;
        // The access rules skip a refused update without an error; don't report that as saved
        ensureRowsUpdated(data, 'The branch');
        toast.success('Branch updated successfully');
      } else {
        const { data, error } = await supabase
          .from('branches')
          .insert(branchData)
          .select();

        if (error) throw error;
        ensureRowsUpdated(data, 'The branch');
        toast.success('Branch created successfully');
      }

      setShowForm(false);
      setEditingBranch(null);
      resetForm();
      loadPracticeAndBranches();
    } catch (error) {
      console.error('Error saving branch:', error);
      toast.error(describeDbError(error, 'Failed to save branch'));
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      slug: branch.slug,
      address: branch.address || '',
      city: branch.city || '',
      state_province: branch.state_province || '',
      postal_code: branch.postal_code || '',
      phone: branch.phone || '',
      email: branch.email || '',
      is_active: branch.is_active,
      business_hours: parseBusinessHours(branch.business_hours)
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete the branch "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;
      ensureRowsUpdated(data, 'The branch');

      toast.success('Branch deleted successfully');
      loadPracticeAndBranches();
      
      if (selectedBranch === id) {
        setSelectedBranch(null);
      }
    } catch (error) {
      console.error('Error deleting branch:', error);
      // 23503: other records (staff, expenses, ...) still point at this branch; the raw database
      // message for that names constraints, not what the user can do about it
      const isStillLinked = typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23503';
      toast.error(isStillLinked
        ? `"${name}" still has staff or records linked to it. Move them to another location first, or deactivate the branch instead.`
        : describeDbError(error, 'Failed to delete branch'));
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .update({ is_active: !branch.is_active })
        .eq('id', branch.id)
        .select('id');

      if (error) throw error;
      ensureRowsUpdated(data, 'The branch');

      toast.success(`Branch ${branch.is_active ? 'deactivated' : 'activated'} successfully`);
      loadPracticeAndBranches();
    } catch (error) {
      console.error('Error toggling branch status:', error);
      toast.error(describeDbError(error, 'Failed to update branch status'));
    }
  };

  const handleAssignUser = async (userId: string, branchId: string) => {
    if (assigningUserId) return;
    setAssigningUserId(userId);
    try {
      const updateData = branchId ? { branch_id: branchId } : { branch_id: null };

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('id');

      if (error) throw error;
      // Row-level security can silently skip another user's row; don't report that as success
      ensureRowsUpdated(data, 'The branch assignment');

      if (branchId) {
        toast.success('Staff member assigned to branch successfully');
      } else {
        toast.success('Staff member removed from branch');
      }

      // Reload the staff list (every staff count and list on this screen comes from it)
      loadAllStaff();
    } catch (error) {
      console.error('Error assigning user:', error);
      toast.error(describeDbError(error, 'Failed to update staff assignment'));
    } finally {
      setAssigningUserId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      address: '',
      city: '',
      state_province: '',
      postal_code: '',
      phone: '',
      email: '',
      is_active: true,
      business_hours: defaultBusinessHours
    });
  };

  // Escape closes the branch form (without saving) and the branch staff window, as their X does
  useEscapeToClose(showForm, () => {
    setShowForm(false);
    setEditingBranch(null);
    resetForm();
  });
  useEscapeToClose(showStaffModal, () => setShowStaffModal(false));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading practice locations...</p>
        </div>
      </div>
    );
  }

  const mainStaff = allStaff.filter(staff => !staff.branch_id);

  return (
    <div className="space-y-6">
      {/* World-class Header Section */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Practice Locations</h2>
              <p className="text-gray-600 mt-1">Manage your practice branches and locations</p>
            </div>
            <Button
              onClick={() => {
                setEditingBranch(null);
                resetForm();
                setShowForm(true);
              }}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:shadow-lg transition-all duration-200"
            >
              <Icon icon={SolarIcons.plus} className="w-5 h-5 mr-2" />
              Add Location
            </Button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Locations</p>
                  <p className="text-2xl font-bold text-gray-900">{branches.length + 1}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Icon icon={SolarIcons.building} className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Branches</p>
                  <p className="text-2xl font-bold text-green-600">{branches.filter(b => b.is_active).length}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Icon icon={SolarIcons.checkCircle} className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Staff</p>
                  <p className="text-2xl font-bold text-blue-600">{allStaff.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Icon icon={SolarIcons.usersGroupRounded} className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Main Practice (Parent) */}
          {practice && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Main Practice</h3>
              <div 
                className={`relative bg-gradient-to-r from-purple-50 to-indigo-50 border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                  selectedBranch === 'main' 
                    ? 'border-purple-500 shadow-lg ring-2 ring-purple-100' 
                    : 'border-purple-200 hover:border-purple-400 hover:shadow-md'
                }`}
                onClick={() => setSelectedBranch('main')}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {practice.logo_url ? (
                      <img 
                        src={practice.logo_url} 
                        alt={practice.name}
                        className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-md"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                        <Icon icon={SolarIcons.building} className="w-8 h-8 text-white" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{practice.name}</h4>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-full mt-1">
                        <Icon icon={SolarIcons.shield} className="w-3 h-3" />
                        Headquarters
                      </span>
                      
                      <div className="mt-3 space-y-1.5 text-sm">
                        {practice.address && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Icon icon={SolarIcons.mapPin} className="w-4 h-4 text-gray-400" />
                            <span>{practice.address}, {practice.city} {practice.country}</span>
                          </div>
                        )}
                        {practice.contact_phone && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Icon icon={SolarIcons.phone} className="w-4 h-4 text-gray-400" />
                            <span>{practice.contact_phone}</span>
                          </div>
                        )}
                        {practice.contact_email && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Icon icon={SolarIcons.mail} className="w-4 h-4 text-gray-400" />
                            <span>{practice.contact_email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{mainStaff.length} Staff</p>
                    <p className="text-xs text-gray-500">Members</p>
                  </div>
                </div>

                {selectedBranch === 'main' && mainStaff.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-purple-200">
                    <h6 className="text-sm font-medium text-gray-900 mb-3">Staff at Main Practice</h6>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {mainStaff.slice(0, 4).map((user) => (
                        <div key={user.id} className="flex items-center gap-3 bg-white rounded-lg p-3">
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.full_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                              <Icon icon={SolarIcons.user} className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                            <p className="text-xs text-gray-500 capitalize">{formatRole(user.role)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {mainStaff.length > 4 && (
                      <p className="text-sm text-gray-500 mt-3 text-center">+{mainStaff.length - 4} more staff members</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Branch Locations */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Branch Locations</h3>
            <div className="space-y-4">
              {branches.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                  <Icon icon={SolarIcons.building} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-700 font-medium">No branch locations yet</p>
                  <p className="text-sm text-gray-500 mt-1">Add your first branch location to expand your practice</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {branches.map((branch) => (
                    <div
                      key={branch.id}
                      className={`relative bg-white border rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                        selectedBranch === branch.id 
                          ? 'border-purple-500 shadow-lg ring-2 ring-purple-100' 
                          : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                      }`}
                      onClick={() => {
                        setSelectedBranch(branch.id);
                        handleEdit(branch);
                      }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon icon={SolarIcons.ambulatoryClinic} className="w-5 h-5 text-purple-500" />
                            <h5 className="font-semibold text-gray-900">{branch.name}</h5>
                          </div>
                          {branch.is_active ? (
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
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(branch);
                            }}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              branch.is_active 
                                ? 'text-green-600 hover:bg-green-50' 
                                : 'text-gray-400 hover:bg-gray-50'
                            }`}
                            title={branch.is_active ? 'Deactivate branch' : 'Activate branch'}
                            aria-label={`${branch.is_active ? 'Deactivate' : 'Activate'} branch ${branch.name}`}
                          >
                            <Icon icon={branch.is_active ? SolarIcons.checkCircle : SolarIcons.dangerCircle} className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(branch);
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200"
                            title="Edit branch"
                            aria-label={`Edit branch ${branch.name}`}
                          >
                            <Icon icon={SolarIcons.edit} className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(branch.id, branch.name);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                            title="Delete branch"
                            aria-label={`Delete branch ${branch.name}`}
                          >
                            <Icon icon={SolarIcons.trash} className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        {branch.address && (
                          <div className="flex items-start gap-2 text-gray-600">
                            <Icon icon={SolarIcons.mapPin} className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <span className="block">{branch.address}</span>
                              {branch.city && (
                                <span className="text-gray-500">
                                  {branch.city}{branch.state_province && `, ${branch.state_province}`}
                                  {branch.postal_code && ` ${branch.postal_code}`}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {branch.phone && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Icon icon={SolarIcons.phone} className="w-4 h-4 text-gray-400" />
                            <span>{branch.phone}</span>
                          </div>
                        )}
                        {branch.email && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Icon icon={SolarIcons.mail} className="w-4 h-4 text-gray-400" />
                            <span className="truncate">{branch.email}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Business Hours */}
                      {branch.business_hours && Array.isArray(branch.business_hours) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon icon={SolarIcons.clock} className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-medium text-gray-700">Operating Hours</span>
                          </div>
                          <div className="space-y-1">
                            {branch.business_hours.map((hour: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="font-medium text-gray-700">{hour.day}</span>
                                <span className="text-gray-600">{hour.hours}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Staff section */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon icon={SolarIcons.users} className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-medium text-gray-700">
                              Staff ({allStaff.filter(u => u.branch_id === branch.id).length})
                            </span>
                          </div>
                          {selectedBranch === branch.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowStaffModal(true);
                              }}
                              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                            >
                              Manage
                            </button>
                          )}
                        </div>
                        {/* Staff list with names and roles */}
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {allStaff
                            .filter(u => u.branch_id === branch.id)
                            .length === 0 ? (
                              <p className="text-xs text-gray-500 italic">No staff assigned</p>
                            ) : (
                              allStaff
                                .filter(u => u.branch_id === branch.id)
                                .map((staff) => (
                                  <div key={staff.id} className="flex items-center gap-2">
                                    {staff.avatar ? (
                                      <img
                                        src={staff.avatar}
                                        alt={staff.full_name}
                                        className="w-6 h-6 rounded-full object-cover border border-gray-200"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center border border-purple-200">
                                        <span className="text-xs font-medium text-purple-600">
                                          {staff.full_name.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-900 truncate">{staff.full_name}</p>
                                      <p className="text-xs text-gray-500 capitalize">{formatRole(staff.role)}</p>
                                    </div>
                                  </div>
                                ))
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Branch Form Modal */}
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
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden m-4"
            >
              <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Icon icon={SolarIcons.building} className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      {editingBranch ? 'Edit Branch' : 'Add New Branch'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingBranch(null);
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
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4 scroll-container scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-gray-100" style={{ overflowY: 'auto', maxHeight: 'calc(95vh - 100px)' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Branch Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Short name (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="Made from the branch name if left blank"
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Region
                    </label>
                    <input
                      type="text"
                      value={formData.state_province}
                      onChange={(e) => setFormData({ ...formData, state_province: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    />
                  </div>
                </div>

                {/* Business Hours Section */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Icon icon={SolarIcons.clock} className="w-4 h-4 text-purple-600" />
                    Business Hours
                  </h4>
                  <div className="space-y-2">
                    {formData.business_hours?.map((schedule, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{schedule.day}</span>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={schedule.isOpen}
                              onChange={(e) => {
                                const updatedHours = [...formData.business_hours];
                                updatedHours[idx] = { 
                                  ...updatedHours[idx], 
                                  isOpen: e.target.checked,
                                  hours: e.target.checked ? formatBusinessHours(schedule.openTime || '09:00', schedule.closeTime || '17:00') : 'Closed'
                                };
                                setFormData({ ...formData, business_hours: updatedHours });
                              }}
                              className="sr-only"
                            />
                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              schedule.isOpen ? 'bg-purple-600' : 'bg-gray-300'
                            }`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                schedule.isOpen ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                            </div>
                            <span className="ml-2 text-sm text-gray-600">
                              {schedule.isOpen ? 'Open' : 'Closed'}
                            </span>
                          </label>
                        </div>
                        {schedule.isOpen && (
                          <div className="flex items-center gap-3 mt-3">
                            <button
                              type="button"
                              onClick={() => {
                                setTimePickerConfig({ dayIndex: idx, type: 'open' });
                                setTimePickerOpen(true);
                              }}
                              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all group"
                            >
                              <Icon icon={SolarIcons.sunrise} className="w-5 h-5 text-purple-500 group-hover:text-purple-600" />
                              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                {formatTime12Hour(schedule.openTime || '09:00')}
                              </span>
                            </button>
                            
                            <div className="flex items-center gap-2">
                              <div className="h-px w-8 bg-gray-300"></div>
                              <span className="text-sm text-gray-500 font-medium">to</span>
                              <div className="h-px w-8 bg-gray-300"></div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setTimePickerConfig({ dayIndex: idx, type: 'close' });
                                setTimePickerOpen(true);
                              }}
                              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all group"
                            >
                              <Icon icon={SolarIcons.sunset} className="w-5 h-5 text-indigo-500 group-hover:text-indigo-600" />
                              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                {formatTime12Hour(schedule.closeTime || '17:00')}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const weekdayHours = formData.business_hours[0]; // Monday
                        const updatedHours = formData.business_hours.map((schedule, idx) => {
                          if (idx < 5) { // Monday to Friday
                            return { ...schedule, ...weekdayHours, day: schedule.day };
                          }
                          return schedule;
                        });
                        setFormData({ ...formData, business_hours: updatedHours });
                      }}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Copy Monday's hours to Tuesday-Friday
                    </button>
                  </div>
                </div>

                {/* Staff Management Section */}
                {editingBranch && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Icon icon={SolarIcons.users} className="w-4 h-4 text-purple-600" />
                      Branch Staff ({allStaff.filter(u => u.branch_id === editingBranch.id).length})
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                      {allStaff.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No staff members found</p>
                      ) : (
                        <div className="space-y-2">
                          {allStaff.map((staff) => {
                            const isAssigned = staff.branch_id === editingBranch.id;
                            return (
                              <div key={staff.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                <div className="flex items-center gap-3">
                                  {staff.avatar ? (
                                    <img
                                      src={staff.avatar}
                                      alt={staff.full_name}
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                      <Icon icon={SolarIcons.user} className="w-4 h-4 text-purple-600" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{staff.full_name}</p>
                                    <p className="text-xs text-gray-500">{formatRole(staff.role)}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  // Shared handler: it checks the row really changed (row-level security can
                                  // skip it silently) and blocks double clicks
                                  onClick={() => handleAssignUser(staff.id, isAssigned ? '' : editingBranch.id)}
                                  disabled={!!assigningUserId}
                                  title={isAssigned ? 'Remove from this branch' : 'Assign to this branch'}
                                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait ${
                                    isAssigned
                                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {isAssigned ? 'Assigned' : 'Assign'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-2"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                      Active Branch
                    </label>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingBranch(null);
                      resetForm();
                    }}
                    className="px-6 py-2.5"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-2.5"
                  >
                    <Icon icon={editingBranch ? SolarIcons.save : SolarIcons.plus} className="w-5 h-5 mr-2" />
                    {editingBranch ? 'Update Branch' : 'Create Branch'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff Assignment Modal */}
      <AnimatePresence>
        {showStaffModal && selectedBranch && (
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
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden m-4"
            >
              <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Icon icon={SolarIcons.users} className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Manage Branch Staff
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowStaffModal(false)}
                    aria-label="Close branch staff"
                    title="Close"
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Icon icon={SolarIcons.close} className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    {branches.find(b => b.id === selectedBranch)?.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    Assign staff members to work at this branch
                  </p>
                </div>

                <div className="space-y-4">
                  {allStaff.map((staffMember) => {
                    const isAssigned = staffMember.branch_id === selectedBranch;
                    return (
                      <div 
                        key={staffMember.id} 
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          isAssigned 
                            ? 'bg-purple-50 border-purple-200' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {staffMember.avatar ? (
                            <img
                              src={staffMember.avatar}
                              alt={staffMember.full_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <Icon icon={SolarIcons.user} className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{staffMember.full_name}</p>
                            <p className="text-sm text-gray-600">{formatRole(staffMember.role)}</p>
                          </div>
                        </div>

                        <Button
                          variant={isAssigned ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => handleAssignUser(staffMember.id, isAssigned ? '' : selectedBranch)}
                          isLoading={assigningUserId === staffMember.id}
                          disabled={!!assigningUserId && assigningUserId !== staffMember.id}
                          title={isAssigned ? 'Remove from this branch' : 'Assign to this branch'}
                          className={isAssigned ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                        >
                          {isAssigned ? (
                            <>
                              <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 mr-1" />
                              Assigned
                            </>
                          ) : (
                            <>
                              <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-1" />
                              Assign
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => setShowStaffModal(false)}
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-2.5"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time Picker Modal */}
      <TimePickerModal
        isOpen={timePickerOpen}
        onClose={() => {
          setTimePickerOpen(false);
          setTimePickerConfig(null);
        }}
        onConfirm={(time) => {
          if (timePickerConfig) {
            const updatedHours = [...formData.business_hours];
            const { dayIndex, type } = timePickerConfig;
            
            if (type === 'open') {
              updatedHours[dayIndex] = {
                ...updatedHours[dayIndex],
                openTime: time,
                hours: formatBusinessHours(time, updatedHours[dayIndex].closeTime || '17:00')
              };
            } else {
              updatedHours[dayIndex] = {
                ...updatedHours[dayIndex],
                closeTime: time,
                hours: formatBusinessHours(updatedHours[dayIndex].openTime || '09:00', time)
              };
            }
            
            setFormData({ ...formData, business_hours: updatedHours });
          }
        }}
        initialTime={
          timePickerConfig
            ? timePickerConfig.type === 'open'
              ? formData.business_hours[timePickerConfig.dayIndex].openTime || '09:00'
              : formData.business_hours[timePickerConfig.dayIndex].closeTime || '17:00'
            : '09:00'
        }
        title={
          timePickerConfig
            ? `Select ${timePickerConfig.type === 'open' ? 'Opening' : 'Closing'} Time for ${formData.business_hours[timePickerConfig.dayIndex].day}`
            : 'Select Time'
        }
      />
    </div>
  );
};

export default BranchManagement;