import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import Icon, { SolarIcons } from '../ui/Icon';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { PayrollManagement } from './UserManagement/PayrollManagement';
import { LeaveManagement } from './UserManagement/LeaveManagement';
import { ExcelTimesheetManagement } from './UserManagement/ExcelTimesheetManagement';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { AddUserModal } from './UserManagement/AddUserModal';
import { EditUserModal } from './UserManagement/EditUserModal';
import { DeleteUserModal } from './UserManagement/DeleteUserModal';
import { UserOverview } from './UserManagement/UserOverview';
import { TeamOverview } from './UserManagement/TeamOverview';

type TabType = 'overview' | 'payroll' | 'leave' | 'timesheets';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  job_title?: string;
  department?: string;
  is_active: boolean;
  avatar?: string;
  practice_id?: string;
  contact_number?: string;
  address?: string;
  start_date?: string;
  employee_number?: string;
  reporting_manager_id?: string;
}

export const EnhancedUserManagement: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserData | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);

  const isViewingTeam = !selectedUser;
  const canManageUsers = user?.role === 'admin' || user?.role === 'doctor';

  // Get practice_id
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching current user practice:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id && !user?.practice_id
  });

  const practiceId = user?.practice_id || currentUserData?.practice_id;

  // Fetch users
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['users', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('practice_id', practiceId)
        .order('full_name');

      if (error) throw error;
      return data as UserData[];
    },
    enabled: !!practiceId
  });

  // Update selectedUser when users data changes
  React.useEffect(() => {
    if (selectedUser && users.length > 0) {
      const updatedUser = users.find(u => u.id === selectedUser.id);
      if (updatedUser) {
        setSelectedUser(updatedUser);
      }
    }
  }, [users]);

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.job_title && u.job_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Calculate stats
  const stats = {
    totalEmployees: users.length,
    activeEmployees: users.filter(u => u.is_active).length,
    departments: [...new Set(users.map(u => u.department).filter(Boolean))].length,
    onLeave: 0, // Would come from leave requests
    pendingRequests: 0, // Would come from leave/timesheet requests
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: SolarIcons.home },
    { id: 'payroll' as TabType, label: 'Payroll', icon: SolarIcons.wallet },
    { id: 'leave' as TabType, label: 'Leave', icon: SolarIcons.calendar },
    { id: 'timesheets' as TabType, label: 'Timesheets', icon: SolarIcons.clock },
  ];

  const handleAddUser = () => {
    setShowAddUser(true);
  };

  const handleEditUser = (user: UserData) => {
    setUserToEdit(user);
    setShowEditUser(true);
  };

  const handleDeleteUser = (user: UserData) => {
    setUserToDelete(user);
    setShowDeleteUser(true);
  };

  const handleSelectAllUsers = () => {
    setSelectedUser(null);
  };

  return (
    <div className="h-full flex gap-4">
      {/* Left Column - Users List */}
      <div className="w-64 flex-shrink-0 space-y-4">
        {/* Search */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-3">
            <div className="relative">
              <Icon 
                icon={SolarIcons.search} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Team ({users.length})</CardTitle>
              {canManageUsers && (
                <Button size="sm" variant="ghost" onClick={handleAddUser}>
                  <Icon icon={SolarIcons.plus} className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[calc(100vh-300px)] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* All Users Option */}
                <button
                  onClick={handleSelectAllUsers}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
                    isViewingTeam ? 'bg-purple-50 border-l-2 border-purple-500' : ''
                  }`}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <Icon icon={SolarIcons.users} className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">All Team Members</p>
                    <p className="text-xs text-gray-500">{users.length} users</p>
                  </div>
                </button>

                {/* Individual Users */}
                {filteredUsers.map((userData) => (
                  <button
                    key={userData.id}
                    onClick={() => setSelectedUser(userData)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
                      selectedUser?.id === userData.id ? 'bg-purple-50 border-l-2 border-purple-500' : ''
                    }`}
                  >
                    {userData.avatar ? (
                      <img
                        src={userData.avatar}
                        alt={userData.full_name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-medium">
                          {userData.full_name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {userData.full_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {userData.role}
                      </p>
                    </div>
                    {userData.is_active ? (
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    ) : (
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Column - Main Content */}
      <div className="flex-1 space-y-4">
        {/* Header with Tabs */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isViewingTeam ? 'Team Management' : selectedUser?.full_name}
                </h2>
                <p className="text-sm text-gray-600">
                  {isViewingTeam 
                    ? `Managing ${users.length} team members`
                    : selectedUser?.email
                  }
                </p>
              </div>
              {selectedUser && canManageUsers && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditUser(selectedUser)}
                  >
                    <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteUser(selectedUser)}
                  >
                    <Icon icon={SolarIcons.trash} className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
            
            {/* Compact Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon={tab.icon} className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tab Content */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${isViewingTeam ? 'team' : selectedUser?.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {activeTab === 'overview' && (
                isViewingTeam ? (
                  <TeamOverview users={users} stats={stats} />
                ) : (
                  <UserOverview user={selectedUser!} canEdit={canManageUsers} onEdit={handleEditUser} />
                )
              )}

              {activeTab === 'payroll' && (
                <PayrollManagement selectedUserId={selectedUser?.id} isTeamView={isViewingTeam} />
              )}

              {activeTab === 'leave' && (
                <LeaveManagement selectedUserId={selectedUser?.id} isTeamView={isViewingTeam} />
              )}

              {activeTab === 'timesheets' && (
                <ExcelTimesheetManagement selectedUserId={selectedUser?.id} isTeamView={isViewingTeam} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right Column - Stats & Notices */}
      <div className="w-64 flex-shrink-0 space-y-4">
        {/* Context-aware Stats */}
        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {isViewingTeam ? 'Team Overview' : 'User Stats'}
              </h3>
              <Icon icon={SolarIcons.chartSquare} className="w-5 h-5 opacity-70" />
            </div>
            <div className="space-y-3">
              {isViewingTeam ? (
                <>
                  <div>
                    <p className="text-purple-100 text-xs">Total Staff</p>
                    <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-purple-400/30">
                    <div>
                      <p className="text-purple-100 text-xs">Active</p>
                      <p className="text-lg font-semibold">{stats.activeEmployees}</p>
                    </div>
                    <div>
                      <p className="text-purple-100 text-xs">Departments</p>
                      <p className="text-lg font-semibold">{stats.departments}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-purple-100 text-xs">Employee Since</p>
                    <p className="text-lg font-bold">
                      {selectedUser?.start_date 
                        ? format(new Date(selectedUser.start_date), 'MMM yyyy')
                        : 'Not set'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-purple-400/30">
                    <div>
                      <p className="text-purple-100 text-xs">Leave Days</p>
                      <p className="text-lg font-semibold">15</p>
                    </div>
                    <div>
                      <p className="text-purple-100 text-xs">Next Payslip</p>
                      <p className="text-lg font-semibold">28 Jun</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-purple-400/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-xs">Status</p>
                        <p className="text-base font-semibold">
                          {selectedUser?.is_active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-purple-100 text-xs">Timesheet</p>
                        <span className="inline-flex px-2 py-0.5 bg-white/20 text-white rounded-full text-xs font-medium">
                          Submitted
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {isViewingTeam ? (
              <>
                {canManageUsers && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start text-xs"
                    onClick={handleAddUser}
                  >
                    <Icon icon={SolarIcons.userAdd} className="w-3 h-3 mr-2" />
                    Add New User
                  </Button>
                )}
                <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Icon icon={SolarIcons.documentAdd} className="w-3 h-3 mr-2" />
                  Generate Payslips
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Icon icon={SolarIcons.calendar} className="w-3 h-3 mr-2" />
                  View Leave Calendar
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Icon icon={SolarIcons.document} className="w-3 h-3 mr-2" />
                  Export Team Report
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Icon icon={SolarIcons.wallet} className="w-3 h-3 mr-2" />
                  View Payslips
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Icon icon={SolarIcons.calendar} className="w-3 h-3 mr-2" />
                  Check Leave Balance
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Icon icon={SolarIcons.clock} className="w-3 h-3 mr-2" />
                  Submit Timesheet
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Icon icon={SolarIcons.document} className="w-3 h-3 mr-2" />
                  Download Profile
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Team Notifications Only */}
        {isViewingTeam && (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Icon icon={SolarIcons.notification} className="w-4 h-4 text-orange-500" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Pending Leave Requests</span>
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">3</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Timesheets to Approve</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Payroll Due</span>
                  <span className="text-xs text-gray-500">in 3 days</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      {showAddUser && (
        <AddUserModal
          practiceId={practiceId!}
          onClose={() => setShowAddUser(false)}
          onSuccess={() => {
            setShowAddUser(false);
            refetch();
            toast.success('User added successfully');
          }}
        />
      )}

      {showEditUser && userToEdit && (
        <EditUserModal
          user={userToEdit}
          onClose={() => {
            setShowEditUser(false);
            setUserToEdit(null);
          }}
          onSuccess={() => {
            setShowEditUser(false);
            setUserToEdit(null);
            refetch();
            toast.success('User updated successfully');
          }}
        />
      )}

      {showDeleteUser && userToDelete && (
        <DeleteUserModal
          user={userToDelete}
          onClose={() => {
            setShowDeleteUser(false);
            setUserToDelete(null);
          }}
          onSuccess={() => {
            setShowDeleteUser(false);
            setUserToDelete(null);
            setSelectedUser(null);
            refetch();
            toast.success('User deleted successfully');
          }}
        />
      )}
    </div>
  );
};