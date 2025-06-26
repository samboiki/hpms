import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, MapPin, Phone, Mail, Clock, Building2, CheckCircle, XCircle, Users, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Icon, { SolarIcons } from '../ui/Icon';

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
  business_hours?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BranchUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  branch_id?: string;
  avatar?: string;
}

const BranchManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [branchUsers, setBranchUsers] = useState<BranchUser[]>([]);
  const [allStaff, setAllStaff] = useState<BranchUser[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    address: '',
    city: '',
    state_province: '',
    postal_code: '',
    phone: '',
    email: '',
    is_active: true
  });

  useEffect(() => {
    if (user?.practice_id) {
      loadBranches();
    }
  }, [user?.practice_id]);

  useEffect(() => {
    if (selectedBranch) {
      loadBranchUsers(selectedBranch);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (user?.practice_id) {
      loadAllStaff();
    }
  }, [user?.practice_id]);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('name');

      if (error) throw error;

      setBranches(data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const loadBranchUsers = async (branchId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, branch_id, avatar')
        .eq('practice_id', user?.practice_id)
        .or(`branch_id.eq.${branchId},allowed_branches.cs.{${branchId}}`)
        .order('full_name');

      if (error) throw error;

      setBranchUsers(data || []);
    } catch (error) {
      console.error('Error loading branch users:', error);
      toast.error('Failed to load branch users');
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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.practice_id) {
      toast.error('No practice ID found. Please refresh and try again.');
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
        const { error } = await supabase
          .from('branches')
          .update(branchData)
          .eq('id', editingBranch.id);

        if (error) throw error;
        toast.success('Branch updated successfully');
      } else {
        console.log('Creating branch with data:', branchData);
        console.log('Current user:', user);
        
        const { data, error } = await supabase
          .from('branches')
          .insert(branchData)
          .select();

        if (error) {
          console.error('Branch creation error:', error);
          throw error;
        }
        
        console.log('Branch created:', data);
        toast.success('Branch created successfully');
      }

      setShowForm(false);
      setEditingBranch(null);
      resetForm();
      loadBranches();
    } catch (error: any) {
      console.error('Error saving branch:', error);
      toast.error(error.message || 'Failed to save branch');
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
      is_active: branch.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this branch? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Branch deleted successfully');
      loadBranches();
      
      if (selectedBranch === id) {
        setSelectedBranch(null);
        setBranchUsers([]);
      }
    } catch (error) {
      console.error('Error deleting branch:', error);
      toast.error('Failed to delete branch');
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    try {
      const { error } = await supabase
        .from('branches')
        .update({ is_active: !branch.is_active })
        .eq('id', branch.id);

      if (error) throw error;

      toast.success(`Branch ${branch.is_active ? 'deactivated' : 'activated'} successfully`);
      loadBranches();
    } catch (error) {
      console.error('Error toggling branch status:', error);
      toast.error('Failed to update branch status');
    }
  };

  const handleAssignUser = async (userId: string, branchId: string) => {
    try {
      const updateData = branchId ? { branch_id: branchId } : { branch_id: null };
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      if (branchId) {
        toast.success('Staff member assigned to branch successfully');
      } else {
        toast.success('Staff member removed from branch');
      }
      
      // Reload both staff lists
      loadAllStaff();
      if (selectedBranch) {
        loadBranchUsers(selectedBranch);
      }
    } catch (error) {
      console.error('Error assigning user:', error);
      toast.error('Failed to update staff assignment');
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
      is_active: true
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading branches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Branch Management</h3>
          <p className="text-sm text-gray-600 mt-1">Manage your practice branches and locations</p>
        </div>
        <Button
          onClick={() => {
            setEditingBranch(null);
            resetForm();
            setShowForm(true);
          }}
          className="bg-gradient-to-r from-[#01b9d4] to-cyan-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Branch
        </Button>
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
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden m-4"
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
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Icon icon={SolarIcons.close} className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
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
                      Slug (URL-friendly name)
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="auto-generated from name"
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
                      State/Province
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
            </div>
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
                            <p className="text-sm text-gray-600 capitalize">{staffMember.role}</p>
                          </div>
                        </div>
                        
                        <Button
                          variant={isAssigned ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleAssignUser(staffMember.id, isAssigned ? '' : selectedBranch)}
                          className={isAssigned ? "bg-purple-600 hover:bg-purple-700" : ""}
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

      {/* Branches Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branches List */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Your Branches</h4>
          
          {branches.length === 0 ? (
            <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
              <CardContent className="py-12 text-center">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No branches created yet</p>
                <p className="text-sm text-gray-500 mt-1">Add your first branch to get started</p>
              </CardContent>
            </Card>
          ) : (
            branches.map((branch) => (
              <Card
                key={branch.id}
                className={`bg-white/90 backdrop-blur-md border cursor-pointer transition-all ${
                  selectedBranch === branch.id 
                    ? 'border-[#01b9d4] shadow-lg' 
                    : 'border-gray-100/50 hover:border-gray-300'
                }`}
                onClick={() => setSelectedBranch(branch.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-semibold text-gray-900">{branch.name}</h5>
                        {branch.is_active ? (
                          <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        {branch.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{branch.address}</span>
                          </div>
                        )}
                        {branch.city && (
                          <div className="flex items-center gap-2 ml-6">
                            <span>{branch.city}{branch.state_province && `, ${branch.state_province}`}</span>
                          </div>
                        )}
                        {branch.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{branch.phone}</span>
                          </div>
                        )}
                        {branch.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span>{branch.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(branch);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          branch.is_active 
                            ? 'text-green-600 hover:bg-green-50' 
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                        title={branch.is_active ? 'Deactivate branch' : 'Activate branch'}
                      >
                        {branch.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(branch);
                        }}
                        className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Edit branch"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(branch.id);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete branch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Branch Users */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Branch Staff</h4>
            {selectedBranch && (
              <Button
                size="sm"
                onClick={() => setShowStaffModal(true)}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
              >
                <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-1" />
                Add Staff Member
              </Button>
            )}
          </div>
          
          {!selectedBranch ? (
            <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Select a branch to view staff</p>
              </CardContent>
            </Card>
          ) : branchUsers.length === 0 ? (
            <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No staff assigned to this branch</p>
                <p className="text-sm text-gray-500 mt-1">Assign users from the Staff tab</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {branchUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-600">{user.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default BranchManagement;