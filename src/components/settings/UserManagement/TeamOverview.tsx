import React from 'react';
import Icon, { SolarIcons } from '../../ui/Icon';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  job_title?: string;
  department?: string;
  is_active: boolean;
}

interface TeamOverviewProps {
  users: UserData[];
  stats: {
    totalEmployees: number;
    activeEmployees: number;
    departments: number;
    onLeave: number;
    pendingRequests: number;
  };
}

export const TeamOverview: React.FC<TeamOverviewProps> = ({ users, stats }) => {
  // Calculate role distribution
  const roleDistribution = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const roleData = Object.entries(roleDistribution).map(([role, count]) => ({
    name: role.charAt(0).toUpperCase() + role.slice(1),
    value: count,
    percentage: Math.round((count / users.length) * 100)
  }));

  // Calculate department distribution
  const departmentDistribution = users
    .filter(u => u.department)
    .reduce((acc, user) => {
      acc[user.department!] = (acc[user.department!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const departmentData = Object.entries(departmentDistribution).map(([dept, count]) => ({
    name: dept,
    employees: count
  }));

  const COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#14b8a6', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.users} className="w-10 h-10 text-purple-600" />
            <span className="text-3xl font-bold text-purple-900">{stats.totalEmployees}</span>
          </div>
          <p className="text-sm text-purple-700">Total Employees</p>
          <p className="text-xs text-purple-600 mt-1">
            {stats.activeEmployees} active
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.buildings} className="w-10 h-10 text-blue-600" />
            <span className="text-3xl font-bold text-blue-900">{stats.departments}</span>
          </div>
          <p className="text-sm text-blue-700">Departments</p>
          <p className="text-xs text-blue-600 mt-1">
            Across organization
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.calendar} className="w-10 h-10 text-green-600" />
            <span className="text-3xl font-bold text-green-900">{stats.onLeave}</span>
          </div>
          <p className="text-sm text-green-700">On Leave</p>
          <p className="text-xs text-green-600 mt-1">
            Currently away
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.bell} className="w-10 h-10 text-orange-600" />
            <span className="text-3xl font-bold text-orange-900">{stats.pendingRequests}</span>
          </div>
          <p className="text-sm text-orange-700">Pending Requests</p>
          <p className="text-xs text-orange-600 mt-1">
            Requires action
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Role Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Role Distribution</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {roleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {roleData.map((role, index) => (
              <div key={role.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-gray-700">{role.name}</span>
                </div>
                <span className="font-medium text-gray-900">{role.value} employees</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h4>
          {departmentData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="employees" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-gray-500 text-sm">No department data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Team Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon icon={SolarIcons.history} className="w-5 h-5 text-gray-600" />
          Recent Team Activity
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Icon icon={SolarIcons.userAdd} className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">New team member joined</p>
                <p className="text-xs text-gray-600">Sarah Johnson - Nurse</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">2 days ago</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Icon icon={SolarIcons.calendar} className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">5 leave requests processed</p>
                <p className="text-xs text-gray-600">3 approved, 2 pending</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">1 week ago</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Icon icon={SolarIcons.wallet} className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Monthly payroll completed</p>
                <p className="text-xs text-gray-600">All {stats.totalEmployees} employees paid</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">1 month ago</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Icon icon={SolarIcons.clock} className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Timesheet reminder sent</p>
                <p className="text-xs text-gray-600">To all team members</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">2 months ago</span>
          </div>
        </div>
      </div>

      {/* Team Performance Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <Icon icon={SolarIcons.chartLine} className="w-8 h-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">98.5%</p>
          <p className="text-sm text-gray-600">Average Attendance</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <Icon icon={SolarIcons.clock} className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">42.5</p>
          <p className="text-sm text-gray-600">Avg Hours/Week</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <Icon icon={SolarIcons.star} className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">4.8</p>
          <p className="text-sm text-gray-600">Team Satisfaction</p>
        </div>
      </div>
    </div>
  );
};