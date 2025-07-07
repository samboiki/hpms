import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  job_title?: string;
  department?: string;
  start_date?: string;
  contact_number?: string;
  is_active: boolean;
  avatar?: string;
  employee_number?: string;
  reporting_manager?: {
    full_name: string;
  };
}

export const UserDirectory: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const canManageUsers = user?.role === 'admin' || user?.role === 'doctor';

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          reporting_manager:reporting_manager_id (
            full_name
          )
        `)
        .eq('practice_id', user?.practice_id)
        .order('full_name');

      if (error) throw error;
      return data as UserData[];
    },
    enabled: !!user?.practice_id
  });

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  // Group users by department
  const usersByDepartment = filteredUsers.reduce((acc, user) => {
    const dept = user.department || 'Unassigned';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(user);
    return acc;
  }, {} as Record<string, UserData[]>);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'doctor': return 'bg-blue-100 text-blue-800';
      case 'nurse': return 'bg-green-100 text-green-800';
      case 'receptionist': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return SolarIcons.shield;
      case 'doctor': return SolarIcons.stethoscope;
      case 'nurse': return SolarIcons.heartPulse;
      case 'receptionist': return SolarIcons.headset;
      default: return SolarIcons.user;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1 w-full md:w-auto">
              <div className="relative">
                <Icon 
                  icon={SolarIcons.search} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by name, email, job title, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="doctor">Doctors/Managers</option>
                <option value="nurse">Nurses</option>
                <option value="receptionist">Receptionists</option>
              </select>

              {canManageUsers && (
                <Button
                  onClick={() => setShowAddUser(true)}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{users.length}</div>
              <div className="text-sm text-gray-600">Total Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {users.filter(u => u.is_active).length}
              </div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {users.filter(u => u.role === 'doctor').length}
              </div>
              <div className="text-sm text-gray-600">Doctors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Object.keys(usersByDepartment).length}
              </div>
              <div className="text-sm text-gray-600">Departments</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Directory by Department */}
      {Object.entries(usersByDepartment).map(([department, deptUsers]) => (
        <Card key={department} className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Icon icon={SolarIcons.building} className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {department}
                  </CardTitle>
                  <p className="text-sm text-gray-600">{deptUsers.length} members</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deptUsers.map((user) => (
                <div
                  key={user.id}
                  className="group relative bg-gray-50 rounded-lg p-4 hover:shadow-md transition-all duration-200 border border-gray-200"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.full_name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                          <Icon icon={SolarIcons.user} className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {user.full_name}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">{user.email}</p>
                      {user.job_title && (
                        <p className="text-sm text-gray-700 font-medium mt-1">
                          {user.job_title}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          <Icon icon={getRoleIcon(user.role)} className="w-3 h-3" />
                          {user.role}
                        </span>
                        {!user.is_active && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    {user.employee_number && (
                      <div className="flex items-center gap-1">
                        <Icon icon={SolarIcons.tag} className="w-3 h-3" />
                        <span>ID: {user.employee_number}</span>
                      </div>
                    )}
                    {user.contact_number && (
                      <div className="flex items-center gap-1">
                        <Icon icon={SolarIcons.phone} className="w-3 h-3" />
                        <span>{user.contact_number}</span>
                      </div>
                    )}
                    {user.start_date && (
                      <div className="flex items-center gap-1">
                        <Icon icon={SolarIcons.calendar} className="w-3 h-3" />
                        <span>Since {new Date(user.start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {user.reporting_manager && (
                      <div className="flex items-center gap-1">
                        <Icon icon={SolarIcons.userCheck} className="w-3 h-3" />
                        <span>Reports to: {user.reporting_manager.full_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {canManageUsers && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(user)}
                      >
                        <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardContent className="p-12 text-center">
            <Icon icon={SolarIcons.userSearch} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-600">
              {searchTerm || filterRole !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Add your first user to get started'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};