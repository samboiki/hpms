import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import Icon, { SolarIcons } from '../ui/Icon';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { PayrollManagement } from './UserManagement/PayrollManagement';
import { LeaveManagement } from './UserManagement/LeaveManagement';
import { ExcelTimesheetManagement } from './UserManagement/ExcelTimesheetManagement';
import { motion, AnimatePresence } from 'framer-motion';
import { format, endOfMonth, startOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { AddUserModal } from './UserManagement/AddUserModal';
import { EditUserModal } from './UserManagement/EditUserModal';
import { DeleteUserModal } from './UserManagement/DeleteUserModal';
import { UserOverview } from './UserManagement/UserOverview';
import { TeamOverview } from './UserManagement/TeamOverview';
import { getGenderAppropriateAvatar, getFallbackAvatarColors } from '../../utils/avatarUtils';

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
  bank_name?: string;
  account_number?: string;
  account_type?: string;
}

interface UserStats {
  leaveDaysRemaining: number;
  nextPayslipDate: string;
  timesheetStatus: 'draft' | 'submitted' | 'approved' | 'rejected';
}

export const EnhancedUserManagement: React.FC = () => {
  const { user } = useAuthStore();
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

  // Fetch user stats
  const { data: userStats } = useQuery<UserStats>({
    queryKey: ['user-stats', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser?.id) return null;
      
      const currentDate = new Date();
      const monthEnd = endOfMonth(currentDate);
      
      // Fetch leave balance
      // First get the Annual Leave type ID
      const { data: leaveType } = await supabase
        .from('leave_types')
        .select('id')
        .eq('practice_id', practiceId)
        .eq('name', 'Annual Leave')
        .single();
      
      let leaveDays = 0;
      if (leaveType?.id) {
        const { data: leaveBalance, error } = await supabase
          .from('leave_balances')
          .select('balance_days')
          .eq('user_id', selectedUser.id)
          .eq('year', currentDate.getFullYear())
          .eq('leave_type_id', leaveType.id)
          .single();
        
        if (!error && leaveBalance) {
          leaveDays = leaveBalance.balance_days;
        }
      }
      
      // Calculate next payslip date (last day of current month)
      const nextPayslipDate = format(monthEnd, 'dd MMM');
      
      // Fetch current month timesheet status
      const { data: timesheet } = await supabase
        .from('timesheets')
        .select('status')
        .eq('user_id', selectedUser.id)
        .eq('period_start', startOfMonth(currentDate).toISOString().split('T')[0])
        .single();
      
      return {
        leaveDaysRemaining: leaveDays,
        nextPayslipDate,
        timesheetStatus: timesheet?.status || 'draft'
      };
    },
    enabled: !!selectedUser?.id && !!practiceId
  });

  // Update selectedUser when users data changes
  React.useEffect(() => {
    if (selectedUser && users.length > 0) {
      const updatedUser = users.find(u => u.id === selectedUser.id);
      if (updatedUser) {
        setSelectedUser(updatedUser);
      }
    }
  }, [users, selectedUser]);

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.job_title && u.job_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Fetch team stats
  const { data: teamStats } = useQuery({
    queryKey: ['team-stats', practiceId],
    queryFn: async () => {
      if (!practiceId) return null;
      
      const currentDate = new Date();
      
      // Count employees currently on leave
      const { count: onLeaveCount } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('practice_id', practiceId)
        .eq('status', 'approved')
        .lte('start_date', currentDate.toISOString())
        .gte('end_date', currentDate.toISOString());
      
      // Count pending leave requests
      const { count: pendingLeaveCount } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('practice_id', practiceId)
        .eq('status', 'pending');
      
      // Count pending (submitted) timesheets
      const { count: pendingTimesheetCount } = await supabase
        .from('timesheets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'submitted')
        .in('user_id', users.map(u => u.id));
      
      return {
        onLeave: onLeaveCount || 0,
        pendingLeaveRequests: pendingLeaveCount || 0,
        pendingTimesheets: pendingTimesheetCount || 0,
        totalPendingRequests: (pendingLeaveCount || 0) + (pendingTimesheetCount || 0)
      };
    },
    enabled: !!practiceId && isViewingTeam && users.length > 0
  });

  // Calculate stats
  const stats = {
    totalEmployees: users.length,
    activeEmployees: users.filter(u => u.is_active).length,
    departments: [...new Set(users.map(u => u.department).filter(Boolean))].length,
    onLeave: teamStats?.onLeave || 0,
    pendingRequests: teamStats?.totalPendingRequests || 0,
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
                    <div className="w-8 h-8 rounded-full overflow-hidden">
                      <img
                        src={userData.avatar || getGenderAppropriateAvatar(userData.gender, userData.email)}
                        alt={userData.full_name}
                        className="w-full h-full object-cover"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          const target = e.currentTarget;
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-full bg-gradient-to-br ${getFallbackAvatarColors(userData.gender)} flex items-center justify-center">
                                <span class="text-white text-xs font-medium">${userData.full_name.charAt(0).toUpperCase()}</span>
                              </div>
                            `;
                          }
                        }}
                      />
                    </div>
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
                  <UserOverview 
                    user={selectedUser!} 
                    canEdit={canManageUsers} 
                    onEdit={handleEditUser}
                    leaveDaysRemaining={userStats?.leaveDaysRemaining}
                  />
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
                      <p className="text-lg font-semibold">{userStats?.leaveDaysRemaining || 0}</p>
                    </div>
                    <div>
                      <p className="text-purple-100 text-xs">Next Payslip</p>
                      <p className="text-lg font-semibold">{userStats?.nextPayslipDate || 'N/A'}</p>
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
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          userStats?.timesheetStatus === 'submitted' ? 'bg-green-500/20 text-green-100' :
                          userStats?.timesheetStatus === 'approved' ? 'bg-blue-500/20 text-blue-100' :
                          userStats?.timesheetStatus === 'rejected' ? 'bg-red-500/20 text-red-100' :
                          'bg-white/20 text-white'
                        }`}>
                          {userStats?.timesheetStatus ? userStats.timesheetStatus.charAt(0).toUpperCase() + userStats.timesheetStatus.slice(1) : 'Draft'}
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