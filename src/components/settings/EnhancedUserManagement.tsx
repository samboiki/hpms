import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import Icon, { SolarIcons } from '../ui/Icon';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { PayrollManagement } from './UserManagement/PayrollManagement';
import { LeaveManagement } from './UserManagement/LeaveManagement';
import { ExcelTimesheetManagement } from './UserManagement/ExcelTimesheetManagement';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInCalendarDays, format, endOfMonth, startOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { AddUserModal } from './UserManagement/AddUserModal';
import { resendStaffInvite } from '../../services/staffInviteService';
import { EditUserModal } from './UserManagement/EditUserModal';
import { DeleteUserModal } from './UserManagement/DeleteUserModal';
import { UserOverview } from './UserManagement/UserOverview';
import { TeamOverview } from './UserManagement/TeamOverview';
import { UserAvatar } from '../layout/ProfileMenu';
import { formatNad as formatNadAmount } from '../../utils/billing/money';
import { USER_SECTIONS, sectionFromAddress } from '../../utils/settingsSection';
import {
  downloadCsv,
  formatRole,
  formatStaffName,
  getDeactivationBlocker,
  isStaffAdmin,
  parseDateOnly,
  StaffActivityItem,
  toCsv
} from './UserManagement/staffUtils';

type TabType = 'overview' | 'payroll' | 'leave' | 'timesheets';
type StatusFilter = 'active' | 'inactive' | 'all';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  job_title?: string;
  department?: string;
  is_active: boolean;
  avatar?: string;
  gender?: string;
  practice_id?: string;
  contact_number?: string;
  address?: string;
  start_date?: string;
  employee_number?: string;
  reporting_manager_id?: string;
  bank_name?: string;
  account_number?: string;
  account_type?: string;
  hpcsa_number?: string | null;
  created_at?: string | null;
}

interface UserStats {
  leaveDaysRemaining: number;
  nextPayslipDate: string;
  timesheetStatus: string | null;
  hoursThisMonth: number | null;
  payslipCount: number;
  recentActivity: StaffActivityItem[];
}

/** Team list columns. Banking details are deliberately excluded; admins load them per person. */
const STAFF_LIST_COLUMNS =
  'id, email, full_name, role, job_title, department, is_active, avatar, practice_id, contact_number, ' +
  'address, start_date, employee_number, reporting_manager_id, hpcsa_number, created_at';

// Intl's en-NA format shows the Namibian dollar as a bare "$"; HPMS writes N$
const formatNad = (amount: number | string | null | undefined) => formatNadAmount(Number(amount ?? 0) || 0);

const isActiveStaff = (member: { is_active: boolean | null | undefined }) => member.is_active !== false;

export const EnhancedUserManagement: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  // A link names the tab to open (?section=payroll: "Settings > Users > Payroll"), else the overview
  const [activeTab, setActiveTab] = useState<TabType>(() => sectionFromAddress(USER_SECTIONS, 'overview'));
  const [leaveView, setLeaveView] = useState<'default' | 'calendar'>('default');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [showAddUser, setShowAddUser] = useState(false);
  const [sendingLinkFor, setSendingLinkFor] = useState<string | null>(null);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserData | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);

  // Staff, HR and payroll management is for administrators; everyone else gets self-service
  const isAdmin = isStaffAdmin(user);
  const canManageUsers = isAdmin;

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

  const { practiceId: contextPracticeId } = usePractice();
  const practiceId = user?.practice_id || currentUserData?.practice_id || contextPracticeId;

  // Fetch the team list (administrators only)
  const { data: users = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['users', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select(STAFF_LIST_COLUMNS)
        .eq('practice_id', practiceId)
        .order('full_name');

      if (error) throw error;
      return data as unknown as UserData[];
    },
    enabled: !!practiceId && isAdmin
  });

  // Self-service: a non-admin only ever loads their own record
  const {
    data: ownProfile,
    isError: ownProfileError,
    refetch: refetchOwnProfile
  } = useQuery({
    queryKey: ['my-staff-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('users')
        .select(STAFF_LIST_COLUMNS)
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data as unknown as UserData;
    },
    enabled: !!user?.id && !isAdmin
  });

  const activeProfile: UserData | null = isAdmin ? selectedUser : ownProfile ?? null;
  const isViewingTeam = isAdmin && !selectedUser;

  // Full record including banking details: administrators only, for the profile and edit form
  const { data: selectedUserDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['staff-details', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser?.id) return null;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', selectedUser.id)
        .single();
      
      if (error) throw error;
      return data as unknown as UserData;
    },
    enabled: isAdmin && !!selectedUser?.id
  });
      
  const userIds = useMemo(() => users.map(u => u.id), [users]);
      
  // Team-wide counts. leave_requests has no practice_id column, so scope by the practice's users.
  const { data: teamStats } = useQuery({
    queryKey: ['team-stats', practiceId, userIds],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [onLeave, pendingLeave, pendingTimesheets] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .in('user_id', userIds)
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today),
        supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .in('user_id', userIds)
          .eq('status', 'pending'),
        supabase
          .from('timesheets')
          .select('id', { count: 'exact', head: true })
          .in('user_id', userIds)
          .eq('status', 'submitted')
      ]);
      
      const firstError = onLeave.error || pendingLeave.error || pendingTimesheets.error;
      if (firstError) throw firstError;

      return {
        onLeave: onLeave.count ?? 0,
        pendingLeaveRequests: pendingLeave.count ?? 0,
        pendingTimesheets: pendingTimesheets.count ?? 0
      };
    },
    enabled: !!practiceId && isAdmin && userIds.length > 0
  });

  // Fetch live stats and recent activity for the staff member being viewed
  const { data: userStats, isLoading: isLoadingUserStats } = useQuery<UserStats | null>({
    queryKey: ['user-stats', activeProfile?.id, practiceId],
    queryFn: async () => {
      if (!activeProfile?.id) return null;
      
      const now = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      
      const [annualLeaveType, currentTimesheet, payslipCount, recentLeave, recentTimesheets, recentPayslips] = await Promise.all([
        supabase
          .from('leave_types')
          .select('id')
          .eq('practice_id', practiceId)
          .eq('name', 'Annual Leave')
          .limit(1),
        // Overlap match: older timesheets were saved with period_start one day early (UTC conversion)
        supabase
          .from('timesheets')
          .select('status, total_hours')
          .eq('user_id', activeProfile.id)
          .lte('period_start', monthEnd)
          .gte('period_end', monthStart)
          .order('period_end', { ascending: false })
          .limit(1),
        supabase
          .from('payslips')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', activeProfile.id),
        supabase
          .from('leave_requests')
          .select('id, status, start_date, end_date, days_requested, created_at, leave_type:leave_type_id (name)')
          .eq('user_id', activeProfile.id)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('timesheets')
          .select('id, status, period_end, total_hours, created_at, updated_at')
          .eq('user_id', activeProfile.id)
          .order('period_end', { ascending: false })
          .limit(3),
        supabase
          .from('payslips')
          .select('id, status, pay_period_end, net_pay, created_at')
          .eq('user_id', activeProfile.id)
          .order('pay_period_end', { ascending: false })
          .limit(3)
      ]);
      
      let leaveDaysRemaining = 0;
      const annualLeaveTypeId = annualLeaveType.data?.[0]?.id;
      if (annualLeaveTypeId) {
        const { data: leaveBalance } = await supabase
          .from('leave_balances')
          .select('balance_days')
          .eq('user_id', activeProfile.id)
          .eq('year', now.getFullYear())
          .eq('leave_type_id', annualLeaveTypeId)
          .maybeSingle();
        leaveDaysRemaining = Number(leaveBalance?.balance_days ?? 0);
      }
      
      const timesheet = currentTimesheet.data?.[0];
      const recentActivity: StaffActivityItem[] = [
        ...(recentLeave.data ?? []).map(request => ({
          id: `leave-${request.id}`,
          kind: 'leave' as const,
          title: `${(request.leave_type as { name?: string } | null)?.name ?? 'Leave'} request ${request.status ?? 'pending'}`,
          detail: `${format(parseDateOnly(request.start_date), 'dd MMM')} - ${format(parseDateOnly(request.end_date), 'dd MMM yyyy')} (${request.days_requested} days)`,
          date: request.created_at ?? request.start_date
        })),
        ...(recentTimesheets.data ?? []).map(sheet => ({
          id: `timesheet-${sheet.id}`,
          kind: 'timesheet' as const,
          title: `${format(parseDateOnly(sheet.period_end), 'MMMM yyyy')} timesheet ${sheet.status ?? 'draft'}`,
          detail: `${Number(sheet.total_hours ?? 0).toFixed(1)} hours recorded`,
          date: sheet.updated_at ?? sheet.created_at ?? sheet.period_end
        })),
        ...(recentPayslips.data ?? []).map(slip => ({
          id: `payslip-${slip.id}`,
          kind: 'payslip' as const,
          title: `${format(parseDateOnly(slip.pay_period_end), 'MMMM yyyy')} payslip ${slip.status === 'paid' ? 'paid' : 'generated'}`,
          detail: `Net pay ${formatNad(slip.net_pay)}`,
          date: slip.created_at ?? slip.pay_period_end
        }))
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      
      return {
        leaveDaysRemaining,
        nextPayslipDate: format(endOfMonth(now), 'dd MMM'),
        timesheetStatus: timesheet?.status ?? null,
        hoursThisMonth: timesheet ? Number(timesheet.total_hours ?? 0) : null,
        payslipCount: payslipCount.count ?? 0,
        recentActivity
      };
    },
    enabled: !!activeProfile?.id && !!practiceId
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

  const activeCount = users.filter(isActiveStaff).length;
  const inactiveCount = users.length - activeCount;
      
  // Filter users based on status and search
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredUsers = users.filter(u => {
    if (statusFilter === 'active' && !isActiveStaff(u)) return false;
    if (statusFilter === 'inactive' && isActiveStaff(u)) return false;
    if (!normalizedSearch) return true;
    return [u.full_name, u.email, u.job_title, u.department, formatRole(u.role), u.employee_number]
      .some(value => value?.toLowerCase().includes(normalizedSearch));
  });

  // Calculate stats
  const stats = {
    totalEmployees: users.length,
    activeEmployees: activeCount,
    departments: new Set(users.filter(isActiveStaff).map(u => u.department).filter(Boolean)).size,
    onLeave: teamStats?.onLeave ?? 0,
    pendingRequests: (teamStats?.pendingLeaveRequests ?? 0) + (teamStats?.pendingTimesheets ?? 0),
    pendingLeaveRequests: teamStats?.pendingLeaveRequests ?? 0,
    pendingTimesheets: teamStats?.pendingTimesheets ?? 0
  };

  const today = new Date();
  const daysToMonthEnd = differenceInCalendarDays(endOfMonth(today), today);
  const payrollDueLabel = daysToMonthEnd === 0 ? 'today' : daysToMonthEnd === 1 ? 'tomorrow' : `in ${daysToMonthEnd} days`;

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: SolarIcons.home },
    { id: 'payroll' as TabType, label: isAdmin ? 'Payroll' : 'Payslips', icon: SolarIcons.wallet },
    { id: 'leave' as TabType, label: 'Leave', icon: SolarIcons.calendar },
    { id: 'timesheets' as TabType, label: 'Timesheets', icon: SolarIcons.clock },
  ];

  const openTab = (tab: TabType, options?: { leaveCalendar?: boolean }) => {
    setLeaveView(options?.leaveCalendar ? 'calendar' : 'default');
    setActiveTab(tab);
  };

  const handleAddUser = () => {
    setShowAddUser(true);
  };

  const handleEditUser = (user: UserData) => {
    setUserToEdit(user);
    setShowEditUser(true);
  };

  const handleChangeStatus = (user: UserData) => {
    setUserToDelete(user);
    setShowDeleteUser(true);
  };

  // A new invitation email, or a forgotten password: the link lets the person choose a new password
  const handleSendSignInLink = async (staffMember: UserData) => {
    if (!practiceId || !staffMember.email) return;
    if (!window.confirm(`Email ${staffMember.email} a link to choose a new password?`)) return;
    setSendingLinkFor(staffMember.id);
    try {
      toast.success(await resendStaffInvite(practiceId, staffMember.email));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The link could not be sent.');
    } finally {
      setSendingLinkFor(null);
    }
  };

  const handleSelectAllUsers = () => {
    setSelectedUser(null);
  };

  const handleExportTeam = () => {
    const rows = users.filter(u =>
      statusFilter === 'all' || (statusFilter === 'active' ? isActiveStaff(u) : !isActiveStaff(u))
    );
    if (rows.length === 0) {
      toast.error('There are no staff members to export');
      return;
    }
    const csv = toCsv(rows, [
      { label: 'Name', value: u => formatStaffName(u) },
      { label: 'Email', value: u => u.email },
      { label: 'Role', value: u => formatRole(u.role) },
      { label: 'Job Title', value: u => u.job_title },
      { label: 'Department', value: u => u.department },
      { label: 'Employee Number', value: u => u.employee_number },
      { label: 'Professional Registration No.', value: u => u.hpcsa_number },
      { label: 'Phone', value: u => u.contact_number },
      { label: 'Start Date', value: u => u.start_date },
      { label: 'Status', value: u => (isActiveStaff(u) ? 'Active' : 'Inactive') }
    ]);
    downloadCsv(`staff-list-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv);
    toast.success(`Exported ${rows.length} staff member${rows.length === 1 ? '' : 's'}`);
  };

  const statusFilters: Array<{ id: StatusFilter; label: string; count: number }> = [
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'inactive', label: 'Inactive', count: inactiveCount },
    { id: 'all', label: 'All', count: users.length }
  ];

  // The record shown in the profile: admins get the full row (with banking) once it has loaded
  const profileRecord = isAdmin && selectedUserDetails?.id === selectedUser?.id
    ? selectedUserDetails ?? null
    : activeProfile;
  const detailsReady = !!selectedUserDetails && selectedUserDetails.id === selectedUser?.id;

  return (
    <div className="h-full flex flex-col gap-4 xl:flex-row">
      {/* Left Column - Users List (administrators only) */}
      {isAdmin && (
      <div className="w-full xl:w-64 xl:flex-shrink-0 space-y-4">
        {/* Search & status filter */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="relative">
              <Icon 
                icon="solar:magnifer-bold-duotone"
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search staff..."
                aria-label="Search staff"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg" role="tablist" aria-label="Staff status">
              {statusFilters.map(filter => (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`px-1 py-1 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === filter.id ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {filter.label} <span className="text-gray-400">{filter.count}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Team ({activeCount})
                {isFetching && !isLoading && (
                  <Icon icon="solar:refresh-bold-duotone" className="w-3.5 h-3.5 text-gray-400 animate-spin" aria-label="Refreshing" />
                )}
              </CardTitle>
              {canManageUsers && (
                <Button size="sm" variant="ghost" onClick={handleAddUser} title="Invite staff member" aria-label="Invite staff member">
                  <Icon icon={SolarIcons.plus} className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[calc(100vh-300px)] overflow-y-auto">
            {isLoading || (!practiceId && !isError) ? (
              <div className="divide-y divide-gray-100" aria-busy="true">
                {[0, 1, 2, 3, 4].map(index => (
                  <div key={index} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
                      <div className="h-2.5 w-1/2 rounded bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="p-4 text-center">
                <Icon icon={SolarIcons.dangerCircle} className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-gray-700">Staff list could not be loaded.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
                  <Icon icon={SolarIcons.refresh} className="w-4 h-4 mr-1" />
                  Try again
                </Button>
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
                    <p className="text-xs text-gray-500">{activeCount} active{inactiveCount > 0 ? `, ${inactiveCount} inactive` : ''}</p>
                  </div>
                </button>

                {/* Individual Users */}
                {filteredUsers.map((userData) => (
                  <button
                    key={userData.id}
                    onClick={() => setSelectedUser(userData)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
                      selectedUser?.id === userData.id ? 'bg-purple-50 border-l-2 border-purple-500' : ''
                    } ${isActiveStaff(userData) ? '' : 'opacity-70'}`}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                      {/* Their own photo, or their initials (never a stock photo of a stranger) */}
                      <span className="block h-full w-full text-xs"><UserAvatar avatar={userData.avatar} name={userData.full_name} /></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {formatStaffName(userData)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {userData.job_title || formatRole(userData.role)}
                      </p>
                    </div>
                    {isActiveStaff(userData) ? (
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" title="Active"></div>
                    ) : (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0">
                        Inactive
                      </span>
                    )}
                  </button>
                ))}

                {filteredUsers.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <Icon icon={SolarIcons.users} className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      {normalizedSearch
                        ? `No staff match "${searchTerm.trim()}"`
                        : statusFilter === 'inactive'
                          ? 'No inactive staff'
                          : 'No staff members yet'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Middle Column - Main Content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header with Tabs */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4 min-h-[52px]">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 truncate flex items-center gap-2">
                  {isViewingTeam
                    ? 'Team Management'
                    : activeProfile
                      ? formatStaffName(activeProfile)
                      : 'My HR'}
                  {activeProfile && !isActiveStaff(activeProfile) && (
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">Inactive</span>
                  )}
                </h2>
                <p className="text-sm text-gray-600 truncate">
                  {isViewingTeam 
                    ? `Managing ${activeCount} active team member${activeCount === 1 ? '' : 's'}`
                    : activeProfile
                      ? `${formatRole(activeProfile.role)} · ${activeProfile.email}`
                      : 'Your leave, timesheets and payslips'
                  }
                </p>
              </div>
              {isAdmin && selectedUser && (
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!detailsReady}
                    title={detailsReady ? undefined : 'Loading staff details...'}
                    onClick={() => selectedUserDetails && handleEditUser(selectedUserDetails)}
                  >
                    <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  {isActiveStaff(selectedUser) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sendingLinkFor === selectedUser.id}
                      title="Email a link to choose a new password (invitation not received, or password forgotten)"
                      onClick={() => handleSendSignInLink(selectedUser)}
                    >
                      <Icon icon="solar:letter-bold-duotone" className="w-4 h-4 mr-1" />
                      {sendingLinkFor === selectedUser.id ? 'Sending...' : 'Send sign-in link'}
                    </Button>
                  )}
                  {isActiveStaff(selectedUser) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-700 border-amber-500 hover:bg-amber-50"
                      onClick={() => handleChangeStatus(selectedUser)}
                    >
                      <Icon icon="solar:user-block-rounded-bold-duotone" className="w-4 h-4 mr-1" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700 border-green-500 hover:bg-green-50"
                      onClick={() => handleChangeStatus(selectedUser)}
                    >
                      <Icon icon="solar:user-check-rounded-bold-duotone" className="w-4 h-4 mr-1" />
                      Reactivate
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            {/* Compact Tabs */}
            <div className="flex gap-1 overflow-x-auto bg-gray-100 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => openTab(tab.id)}
                  className={`flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon={tab.icon} className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'leave' && stats.pendingLeaveRequests > 0 && canManageUsers && (
                    <span className="min-w-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] leading-[18px]">
                      {stats.pendingLeaveRequests}
                    </span>
                  )}
                  {tab.id === 'timesheets' && stats.pendingTimesheets > 0 && canManageUsers && (
                    <span className="min-w-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] leading-[18px]">
                      {stats.pendingTimesheets}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tab Content - min height keeps the page from jumping while tabs swap */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden min-h-[560px]">
          {!isAdmin && !ownProfile ? (
            <div className="p-6">
              {ownProfileError ? (
                <div className="text-center py-12">
                  <Icon icon={SolarIcons.dangerCircle} className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <p className="text-gray-700">Your staff profile could not be loaded.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => refetchOwnProfile()}>
                    Try again
                  </Button>
                </div>
              ) : (
                <div className="space-y-4" aria-busy="true">
                  <div className="h-24 rounded-lg bg-gray-100 animate-pulse" />
                  <div className="h-48 rounded-lg bg-gray-100 animate-pulse" />
                </div>
              )}
            </div>
          ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${isViewingTeam ? 'team' : activeProfile?.id}-${leaveView}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {activeTab === 'overview' && (
                isViewingTeam ? (
                  <TeamOverview users={users} stats={stats} onNavigate={(tab) => openTab(tab)} />
                ) : profileRecord ? (
                  <UserOverview 
                    user={profileRecord}
                    canEdit={canManageUsers && detailsReady}
                    onEdit={handleEditUser}
                    showBanking={isAdmin}
                    leaveDaysRemaining={userStats?.leaveDaysRemaining}
                    hoursThisMonth={userStats?.hoursThisMonth}
                    payslipCount={userStats?.payslipCount}
                    timesheetStatus={userStats?.timesheetStatus}
                    recentActivity={userStats?.recentActivity}
                    isLoadingStats={isLoadingUserStats || (isAdmin && isLoadingDetails)}
                  />
                ) : null
              )}

              {activeTab === 'payroll' && (
                <PayrollManagement
                  selectedUserId={isAdmin ? selectedUser?.id : user?.id}
                  selectedUserName={isAdmin ? selectedUser?.full_name : undefined}
                  isTeamView={isViewingTeam}
                  practiceId={practiceId}
                />
              )}

              {activeTab === 'leave' && (
                <LeaveManagement
                  selectedUserId={isAdmin ? selectedUser?.id : undefined}
                  isTeamView={isViewingTeam}
                  practiceId={practiceId}
                  initialView={leaveView === 'calendar' ? 'calendar' : undefined}
                />
              )}

              {activeTab === 'timesheets' && (
                <ExcelTimesheetManagement
                  selectedUserId={isAdmin ? selectedUser?.id : undefined}
                  isTeamView={isViewingTeam}
                  practiceId={practiceId}
                />
              )}
            </motion.div>
          </AnimatePresence>
          )}
        </div>
      </div>

      {/* Right Column - Stats & Notices */}
      <div className="w-full xl:w-64 xl:flex-shrink-0 space-y-4">
        {/* Context-aware Stats */}
        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {isViewingTeam ? 'Team Overview' : isAdmin ? 'Staff Stats' : 'My Stats'}
              </h3>
              <Icon icon="solar:chart-square-bold-duotone" className="w-5 h-5 opacity-70" />
            </div>
            <div className="space-y-3">
              {isViewingTeam ? (
                <>
                  <div>
                    <p className="text-purple-100 text-xs">Active Staff</p>
                    <p className="text-2xl font-bold">{stats.activeEmployees}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-purple-400/30">
                    <div>
                      <p className="text-purple-100 text-xs">On Leave Today</p>
                      <p className="text-lg font-semibold">{stats.onLeave}</p>
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
                      {activeProfile?.start_date
                        ? format(parseDateOnly(activeProfile.start_date), 'MMM yyyy')
                        : 'Not set'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-purple-400/30">
                    <div>
                      <p className="text-purple-100 text-xs">Annual Leave</p>
                      <p className="text-lg font-semibold">{userStats?.leaveDaysRemaining ?? 0} days</p>
                    </div>
                    <div>
                      <p className="text-purple-100 text-xs">Next Payslip</p>
                      <p className="text-lg font-semibold">{userStats?.nextPayslipDate || format(endOfMonth(today), 'dd MMM')}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-purple-400/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-xs">Status</p>
                        <p className="text-base font-semibold">
                          {activeProfile && isActiveStaff(activeProfile) ? 'Active' : 'Inactive'}
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
                          {userStats?.timesheetStatus
                            ? userStats.timesheetStatus.charAt(0).toUpperCase() + userStats.timesheetStatus.slice(1)
                            : 'None yet'}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={handleAddUser}
                >
                  <Icon icon="solar:user-plus-bold-duotone" className="w-3 h-3 mr-2" />
                  Invite Staff Member
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => openTab('payroll')}>
                  <Icon icon="solar:document-add-bold-duotone" className="w-3 h-3 mr-2" />
                  Generate Payslips
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => openTab('leave', { leaveCalendar: true })}>
                  <Icon icon={SolarIcons.calendar} className="w-3 h-3 mr-2" />
                  View Leave Calendar
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={handleExportTeam}>
                  <Icon icon={SolarIcons.download} className="w-3 h-3 mr-2" />
                  Export Staff List (CSV)
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => openTab('payroll')}>
                  <Icon icon={SolarIcons.wallet} className="w-3 h-3 mr-2" />
                  View Payslips
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => openTab('leave')}>
                  <Icon icon={SolarIcons.calendar} className="w-3 h-3 mr-2" />
                  Leave Balance & Requests
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => openTab('timesheets')}>
                  <Icon icon={SolarIcons.clock} className="w-3 h-3 mr-2" />
                  Timesheets
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
                <Icon icon={SolarIcons.bell} className="w-4 h-4 text-orange-500" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2 text-sm">
                <button
                  type="button"
                  onClick={() => openTab('leave')}
                  className="w-full flex items-center justify-between rounded-md px-1 py-0.5 hover:bg-gray-50"
                >
                  <span className="text-gray-600">Pending Leave Requests</span>
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{stats.pendingLeaveRequests}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openTab('timesheets')}
                  className="w-full flex items-center justify-between rounded-md px-1 py-0.5 hover:bg-gray-50"
                >
                  <span className="text-gray-600">Timesheets to Approve</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{stats.pendingTimesheets}</span>
                </button>
                <div className="flex items-center justify-between px-1 py-0.5">
                  <span className="text-gray-600">Month-end Payroll</span>
                  <span className="text-xs text-gray-500">{payrollDueLabel}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      {showAddUser && (
        <AddUserModal
          practiceId={practiceId ?? ''}
          onClose={() => {
            setShowAddUser(false);
            // The invited person (or a login made before the email failed) shows in the team list straight away
            void refetch();
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
            queryClient.invalidateQueries({ queryKey: ['staff-details'] });
            toast.success('Staff details saved');
          }}
        />
      )}

      {showDeleteUser && userToDelete && (
        <DeleteUserModal
          user={userToDelete}
          blocker={getDeactivationBlocker(userToDelete, user?.id, users)}
          onClose={() => {
            setShowDeleteUser(false);
            setUserToDelete(null);
          }}
          onSuccess={() => {
            setShowDeleteUser(false);
            setUserToDelete(null);
            refetch();
            queryClient.invalidateQueries({ queryKey: ['staff-details'] });
            queryClient.invalidateQueries({ queryKey: ['team-stats'] });
          }}
        />
      )}
    </div>
  );
};
