import React, { useState, useEffect } from 'react';
import { Plus, Search, Settings, Users, TrendingUp, Activity, MoreVertical } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

interface Practice {
  id: string;
  slug: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  subscription_tier: 'trial' | 'standard' | 'premium' | 'enterprise';
  contact_email: string;
  contact_phone: string;
  city: string;
  admin_name?: string;
  admin_email?: string;
  total_users: number;
  total_patients: number;
  appointments_last_30_days: number;
  appointments_this_month: number;
  created_at: string;
}

const PracticesManagement: React.FC = () => {
  const { user, isSuperAdmin } = useAuthStore();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin()) {
      // Redirect or show error for non-super admins
      return;
    }
    fetchPractices();
  }, []);

  const fetchPractices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_practice_overview')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPractices(data || []);
    } catch (error) {
      console.error('Error fetching practices:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || colors.inactive;
  };

  const getTierColor = (tier: string) => {
    const colors = {
      trial: 'bg-blue-100 text-blue-800',
      standard: 'bg-purple-100 text-purple-800',
      premium: 'bg-amber-100 text-amber-800',
      enterprise: 'bg-emerald-100 text-emerald-800'
    };
    return colors[tier as keyof typeof colors] || colors.standard;
  };

  // admin_practice_overview columns are nullable: guard text for search and numbers for the totals
  const filteredPractices = practices.filter(practice => {
    const matchesSearch = (practice.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (practice.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (practice.contact_email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || practice.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalStats = practices.reduce((acc, practice) => ({
    totalPractices: acc.totalPractices + 1,
    totalUsers: acc.totalUsers + (practice.total_users || 0),
    totalPatients: acc.totalPatients + (practice.total_patients || 0),
    totalAppointments: acc.totalAppointments + (practice.appointments_this_month || 0)
  }), { totalPractices: 0, totalUsers: 0, totalPatients: 0, totalAppointments: 0 });

  if (!isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access practice management.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Practice Management</h1>
              <p className="text-gray-600 mt-1">Manage all practices in the HPMS system</p>
            </div>
            {/* No create-practice form exists yet (showCreateModal is never rendered) */}
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#01b9d4] hover:bg-[#0196be] text-white"
              disabled
              title="Not available yet: new practices cannot be added from this screen"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Practice
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Practices</p>
                <p className="text-3xl font-bold text-gray-900">{totalStats.totalPractices}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{totalStats.totalUsers}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
                <p className="text-3xl font-bold text-gray-900">{totalStats.totalPatients}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Monthly Appointments</p>
                <p className="text-3xl font-bold text-gray-900">{totalStats.totalAppointments}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search practices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </Card>

        {/* Practices Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#01b9d4]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPractices.map((practice) => (
              <Card key={practice.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{practice.name}</h3>
                    <p className="text-sm text-gray-600">{practice.city}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Badge className={`${getStatusColor(practice.status)} capitalize`}>
                      {practice.status}
                    </Badge>
                    <Badge className={`${getTierColor(practice.subscription_tier)} capitalize`}>
                      {practice.subscription_tier}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Users:</span>
                    <span className="font-medium">{practice.total_users}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Patients:</span>
                    <span className="font-medium">{practice.total_patients}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Monthly Appointments:</span>
                    <span className="font-medium">{practice.appointments_this_month}</span>
                  </div>
                </div>

                {/* View/edit/delete icons had no handlers and no such features exist; use the practice switcher to open a practice */}
                <div className="border-t pt-4">
                  <div className="text-sm text-gray-600">
                    <p>Admin: {practice.admin_name || 'Not assigned'}</p>
                    <p>{practice.admin_email}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {filteredPractices.length === 0 && !loading && (
          <Card className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <Settings className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {loadError ? 'Practices could not be loaded' : 'No practices found'}
            </h3>
            <p className="text-gray-600">
              {loadError ? 'Please refresh the page to try again.' : 'Try adjusting your search or status filter.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PracticesManagement;