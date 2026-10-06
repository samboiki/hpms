import React from 'react';
import Icon, { SolarIcons } from '../../ui/Icon';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { formatRole, formatStaffName } from './staffUtils';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  job_title?: string;
  department?: string;
  is_active: boolean;
  employee_number?: string;
  hpcsa_number?: string | null;
  created_at?: string | null;
}

type NavigableTab = 'leave' | 'timesheets' | 'payroll';

interface TeamOverviewProps {
  users: UserData[];
  stats: {
    totalEmployees: number;
    activeEmployees: number;
    departments: number;
    onLeave: number;
    pendingRequests: number;
    pendingLeaveRequests?: number;
    pendingTimesheets?: number;
  };
  onNavigate?: (tab: NavigableTab) => void;
}

interface AttentionItem {
  key: string;
  icon: string;
  tone: string;
  title: string;
  detail: string;
  tab?: NavigableTab;
}

export const TeamOverview: React.FC<TeamOverviewProps> = ({ users, stats, onNavigate }) => {
  const activeUsers = users.filter(u => u.is_active !== false);

  // Calculate role distribution (active staff only)
  const roleDistribution = activeUsers.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const roleData = Object.entries(roleDistribution).map(([role, count]) => ({
    name: formatRole(role),
    value: count,
    percentage: Math.round((count / activeUsers.length) * 100)
  }));

  // Calculate department distribution
  const departmentDistribution = activeUsers
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

  const clinicalWithoutRegistration = activeUsers.filter(
    u => (u.role === 'doctor' || u.role === 'nurse') && !u.hpcsa_number
  );
  const withoutEmployeeNumber = activeUsers.filter(u => !u.employee_number);
  const inactiveCount = users.length - activeUsers.length;

  const attentionItems: AttentionItem[] = [];
  if ((stats.pendingLeaveRequests ?? 0) > 0) {
    attentionItems.push({
      key: 'leave',
      icon: SolarIcons.calendar,
      tone: 'bg-orange-100 text-orange-600',
      title: `${stats.pendingLeaveRequests} leave request${stats.pendingLeaveRequests === 1 ? '' : 's'} awaiting approval`,
      detail: 'Review in the Leave tab',
      tab: 'leave'
    });
  }
  if ((stats.pendingTimesheets ?? 0) > 0) {
    attentionItems.push({
      key: 'timesheets',
      icon: SolarIcons.clock,
      tone: 'bg-blue-100 text-blue-600',
      title: `${stats.pendingTimesheets} timesheet${stats.pendingTimesheets === 1 ? '' : 's'} awaiting approval`,
      detail: 'Review in the Timesheets tab',
      tab: 'timesheets'
    });
  }
  if (clinicalWithoutRegistration.length > 0) {
    attentionItems.push({
      key: 'registration',
      icon: 'solar:diploma-verified-bold-duotone',
      tone: 'bg-red-100 text-red-600',
      title: `${clinicalWithoutRegistration.length} clinician${clinicalWithoutRegistration.length === 1 ? '' : 's'} missing a registration number`,
      detail: clinicalWithoutRegistration.slice(0, 3).map(formatStaffName).join(', ') +
        (clinicalWithoutRegistration.length > 3 ? ` +${clinicalWithoutRegistration.length - 3} more` : '')
    });
  }
  if (withoutEmployeeNumber.length > 0) {
    attentionItems.push({
      key: 'employee-number',
      icon: SolarIcons.userEdit,
      tone: 'bg-gray-100 text-gray-600',
      title: `${withoutEmployeeNumber.length} staff member${withoutEmployeeNumber.length === 1 ? '' : 's'} without an employee number`,
      detail: 'Shown on payslips as the employee code'
    });
  }

  const recentlyAdded = [...activeUsers]
    .filter(u => u.created_at)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.users} className="w-10 h-10 text-purple-600" />
            <span className="text-3xl font-bold text-purple-900">{stats.activeEmployees}</span>
          </div>
          <p className="text-sm text-purple-700">Active Staff</p>
          <p className="text-xs text-purple-600 mt-1">
            {inactiveCount > 0 ? `${inactiveCount} inactive` : 'No inactive staff'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.buildings} className="w-10 h-10 text-blue-600" />
            <span className="text-3xl font-bold text-blue-900">{stats.departments}</span>
          </div>
          <p className="text-sm text-blue-700">Departments</p>
          <p className="text-xs text-blue-600 mt-1">
            With assigned staff
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.calendar} className="w-10 h-10 text-green-600" />
            <span className="text-3xl font-bold text-green-900">{stats.onLeave}</span>
          </div>
          <p className="text-sm text-green-700">On Leave</p>
          <p className="text-xs text-green-600 mt-1">
            Today
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.bell} className="w-10 h-10 text-orange-600" />
            <span className="text-3xl font-bold text-orange-900">{stats.pendingRequests}</span>
          </div>
          <p className="text-sm text-orange-700">Pending Requests</p>
          <p className="text-xs text-orange-600 mt-1">
            Leave and timesheets
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Role Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Role Distribution</h4>
          {roleData.length > 0 ? (
            <>
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
                        <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
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
                    <span className="font-medium text-gray-900">{role.value} staff</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-gray-500 text-sm">No active staff yet</p>
            </div>
          )}
        </div>

        {/* Department Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h4>
          {departmentData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="employees" name="Staff" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-gray-500 text-sm">No staff are assigned to departments yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Needs Attention (live data) */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Icon icon={SolarIcons.bell} className="w-5 h-5 text-orange-500" />
            Needs Attention
          </h4>
          {attentionItems.length === 0 ? (
            <div className="flex items-center gap-3 py-3 text-sm text-gray-600">
              <Icon icon={SolarIcons.checkCircle} className="w-6 h-6 text-green-500" />
              Nothing needs your attention right now.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {attentionItems.map(item => {
                const content = (
                  <>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${item.tone}`}>
                      <Icon icon={item.icon} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-600 truncate">{item.detail}</p>
                    </div>
                    {item.tab && onNavigate && (
                      <Icon icon={SolarIcons.arrowRight} className="w-4 h-4 text-gray-400" />
                    )}
                  </>
                );
                return item.tab && onNavigate ? (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate(item.tab!)}
                    className="w-full flex items-center gap-3 py-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    {content}
                  </button>
                ) : (
                  <div key={item.key} className="flex items-center gap-3 py-3">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recently Added Staff (live data) */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Icon icon={SolarIcons.history} className="w-5 h-5 text-gray-600" />
            Recently Added Staff
          </h4>
          {recentlyAdded.length === 0 ? (
            <p className="text-sm text-gray-500 py-3">No staff records yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentlyAdded.map(member => (
                <div key={member.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon icon="solar:user-plus-bold-duotone" className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{formatStaffName(member)}</p>
                      <p className="text-xs text-gray-600">{member.job_title || formatRole(member.role)}</p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 flex-shrink-0">
                    {formatDistanceToNow(new Date(member.created_at!), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
