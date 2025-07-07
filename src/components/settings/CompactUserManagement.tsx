import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import Icon, { SolarIcons } from '../ui/Icon';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { UserDirectory } from './UserManagement/UserDirectory';
import { PayrollManagement } from './UserManagement/PayrollManagement';
import { LeaveManagement } from './UserManagement/LeaveManagement';
import { TimesheetManagement } from './UserManagement/TimesheetManagement';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

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
}

export const CompactUserManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Debug logging
  console.log('Current auth user:', user);
  console.log('Practice ID:', user?.practice_id);

  // First, let's get the practice_id from the users table if not in auth store
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

  // Use practice_id from either auth store or database query
  const practiceId = user?.practice_id || currentUserData?.practice_id;
  console.log('Using practice ID:', practiceId);

  // Fetch users
  const { data: users = [], isLoading, error: fetchError } = useQuery({
    queryKey: ['users', practiceId],
    queryFn: async () => {
      console.log('Fetching users for practice:', practiceId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('practice_id', practiceId)
        .order('full_name');

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
      
      console.log('Users fetched:', data?.length, 'users');
      console.log('User data:', data);
      return data as UserData[];
    },
    enabled: !!practiceId
  });

  // Log any fetch errors
  if (fetchError) {
    console.error('Query error:', fetchError);
  }

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const stats = {
    totalEmployees: users.length,
    activeEmployees: users.filter(u => u.is_active).length,
    onLeave: 0, // Would come from leave requests
    pendingRequests: 0, // Would come from leave/timesheet requests
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: SolarIcons.home },
    { id: 'payroll' as TabType, label: 'Payroll', icon: SolarIcons.wallet },
    { id: 'leave' as TabType, label: 'Leave', icon: SolarIcons.calendar },
    { id: 'timesheets' as TabType, label: 'Timesheets', icon: SolarIcons.clock },
  ];

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
              <Button size="sm" variant="ghost">
                <Icon icon={SolarIcons.plus} className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[calc(100vh-300px)] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
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
              <h2 className="text-xl font-bold text-gray-900">Human Resources</h2>
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
              >
                <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-1" />
                Quick Action
              </Button>
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
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600">Total Staff</p>
                          <p className="text-2xl font-bold text-blue-900">{stats.totalEmployees}</p>
                        </div>
                        <Icon icon={SolarIcons.users} className="w-8 h-8 text-blue-500 opacity-50" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-600">Active</p>
                          <p className="text-2xl font-bold text-green-900">{stats.activeEmployees}</p>
                        </div>
                        <Icon icon={SolarIcons.checkCircle} className="w-8 h-8 text-green-500 opacity-50" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-orange-600">On Leave</p>
                          <p className="text-2xl font-bold text-orange-900">{stats.onLeave}</p>
                        </div>
                        <Icon icon={SolarIcons.plane} className="w-8 h-8 text-orange-500 opacity-50" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-purple-600">Pending</p>
                          <p className="text-2xl font-bold text-purple-900">{stats.pendingRequests}</p>
                        </div>
                        <Icon icon={SolarIcons.clock} className="w-8 h-8 text-purple-500 opacity-50" />
                      </div>
                    </div>
                  </div>

                  {/* Selected User Details */}
                  {selectedUser && (
                    <Card className="bg-gray-50 border border-gray-200">
                      <CardHeader>
                        <CardTitle className="text-lg">Employee Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-start gap-4">
                          {selectedUser.avatar ? (
                            <img
                              src={selectedUser.avatar}
                              alt={selectedUser.full_name}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-xl font-medium">
                                {selectedUser.full_name.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">{selectedUser.full_name}</h3>
                            <p className="text-sm text-gray-600">{selectedUser.email}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                {selectedUser.role}
                              </span>
                              {selectedUser.job_title && (
                                <span className="text-sm text-gray-700">{selectedUser.job_title}</span>
                              )}
                              {selectedUser.is_active ? (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Active</span>
                              ) : (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Inactive</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Icon icon={SolarIcons.more} className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Quick Actions for Selected User */}
                        <div className="grid grid-cols-4 gap-3 mt-4">
                          <Button variant="outline" size="sm" className="text-xs">
                            <Icon icon={SolarIcons.wallet} className="w-3 h-3 mr-1" />
                            View Payslips
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs">
                            <Icon icon={SolarIcons.calendar} className="w-3 h-3 mr-1" />
                            Leave Balance
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs">
                            <Icon icon={SolarIcons.clock} className="w-3 h-3 mr-1" />
                            Timesheets
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs">
                            <Icon icon={SolarIcons.document} className="w-3 h-3 mr-1" />
                            Documents
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recent Activity */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { icon: SolarIcons.checkCircle, text: 'John Doe submitted timesheet for approval', time: '2 hours ago', color: 'text-green-600' },
                          { icon: SolarIcons.plane, text: 'Sarah Smith requested 5 days leave', time: '3 hours ago', color: 'text-blue-600' },
                          { icon: SolarIcons.wallet, text: 'March payslips generated', time: '1 day ago', color: 'text-purple-600' },
                          { icon: SolarIcons.userAdd, text: 'New employee Michael Brown added', time: '2 days ago', color: 'text-orange-600' },
                        ].map((activity, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-sm">
                            <Icon icon={activity.icon} className={`w-4 h-4 ${activity.color}`} />
                            <span className="flex-1 text-gray-700">{activity.text}</span>
                            <span className="text-xs text-gray-500">{activity.time}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'payroll' && <PayrollManagement />}
              {activeTab === 'leave' && <LeaveManagement />}
              {activeTab === 'timesheets' && <TimesheetManagement />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right Column - Stats & Notices */}
      <div className="w-64 flex-shrink-0 space-y-4">
        {/* Quick Stats */}
        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">HR Overview</h3>
              <Icon icon={SolarIcons.chartSquare} className="w-5 h-5 opacity-70" />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-purple-100 text-xs">This Month</p>
                <p className="text-2xl font-bold">{format(new Date(), 'MMMM yyyy')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-purple-400/30">
                <div>
                  <p className="text-purple-100 text-xs">Attendance</p>
                  <p className="text-lg font-semibold">95.2%</p>
                </div>
                <div>
                  <p className="text-purple-100 text-xs">Overtime</p>
                  <p className="text-lg font-semibold">32h</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Icon icon={SolarIcons.notification} className="w-4 h-4 text-orange-500" />
              Pending Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Leave Requests</span>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">3</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Timesheets</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">5</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Documents</span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">2</span>
              </div>
            </div>
            <Button size="sm" variant="outline" className="w-full mt-3">
              View All
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Icon icon={SolarIcons.calendar} className="w-4 h-4 text-blue-500" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-3">
              {[
                { date: '28', month: 'Jun', event: 'Payroll Processing', type: 'payroll' },
                { date: '30', month: 'Jun', event: 'Month End Reports', type: 'report' },
                { date: '03', month: 'Jul', event: 'Team Meeting', type: 'meeting' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="text-center bg-gray-50 rounded-lg p-2 min-w-[50px]">
                    <p className="text-lg font-bold text-gray-900">{item.date}</p>
                    <p className="text-xs text-gray-500">{item.month}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.event}</p>
                    <p className="text-xs text-gray-500 capitalize">{item.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                <Icon icon={SolarIcons.download} className="w-3 h-3 mr-2" />
                Download Reports
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                <Icon icon={SolarIcons.settings} className="w-3 h-3 mr-2" />
                HR Settings
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                <Icon icon={SolarIcons.help} className="w-3 h-3 mr-2" />
                Help & Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};