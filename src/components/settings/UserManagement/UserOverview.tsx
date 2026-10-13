import React from 'react';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { format, formatDistanceToNow } from 'date-fns';
import { getGenderAppropriateAvatar, getFallbackAvatarColors } from '../../../utils/avatarUtils';
import { formatRole, formatStaffName, maskAccountNumber, parseDateOnly, StaffActivityItem } from './staffUtils';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  job_title?: string;
  department?: string;
  is_active: boolean;
  contact_number?: string;
  address?: string;
  start_date?: string;
  employee_number?: string;
  reporting_manager_id?: string;
  avatar?: string;
  bank_name?: string;
  account_number?: string;
  account_type?: string;
  gender?: string;
  hpcsa_number?: string | null;
}

interface UserOverviewProps {
  user: UserData;
  canEdit: boolean;
  onEdit: (user: UserData) => void;
  /** Banking details are only shown to administrators, and only once the full record has loaded. */
  showBanking?: boolean;
  leaveDaysRemaining?: number;
  hoursThisMonth?: number | null;
  payslipCount?: number;
  timesheetStatus?: string | null;
  recentActivity?: StaffActivityItem[];
  isLoadingStats?: boolean;
}

const ACTIVITY_STYLES: Record<StaffActivityItem['kind'], { icon: string; wrap: string }> = {
  leave: { icon: SolarIcons.calendar, wrap: 'bg-blue-100 text-blue-600' },
  timesheet: { icon: SolarIcons.clock, wrap: 'bg-green-100 text-green-600' },
  payslip: { icon: SolarIcons.wallet, wrap: 'bg-purple-100 text-purple-600' }
};

export const UserOverview: React.FC<UserOverviewProps> = ({
  user,
  canEdit,
  onEdit,
  showBanking = false,
  leaveDaysRemaining,
  hoursThisMonth,
  payslipCount,
  timesheetStatus,
  recentActivity = [],
  isLoadingStats = false
}) => {
  const roleColors = {
    admin: 'bg-purple-100 text-purple-700',
    doctor: 'bg-blue-100 text-blue-700',
    nurse: 'bg-green-100 text-green-700',
    receptionist: 'bg-yellow-100 text-yellow-700'
  };

  const displayName = formatStaffName(user);
  const isClinical = user.role === 'doctor' || user.role === 'nurse';
  // The team list omits banking columns; they arrive with the administrator-only detail query
  const bankingLoaded = 'bank_name' in user || 'account_number' in user;

  const formatDate = (date: string | undefined) => {
    if (!date) return 'Not set';
    return format(parseDateOnly(date), 'd MMM yyyy');
  };

  const statValue = (value: React.ReactNode) => (isLoadingStats ? '…' : value);

  return (
    <div className="space-y-6">
      {/* User Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-200">
            <img 
              src={user.avatar || getGenderAppropriateAvatar(user.gender, user.email)}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                const target = e.currentTarget;
                // If the avatar fails to load, show initials with gender-appropriate colors
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="w-full h-full bg-gradient-to-br ${getFallbackAvatarColors(user.gender)} flex items-center justify-center">
                      <span class="text-white text-2xl font-bold">${user.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                  `;
                }
              }}
            />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{displayName}</h3>
            <p className="text-gray-600">{user.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleColors[user.role as keyof typeof roleColors] || 'bg-gray-100 text-gray-700'}`}>
                {formatRole(user.role)}
              </span>
              {user.is_active ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(user)}>
            <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        )}
      </div>

      {!user.is_active && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Icon icon={SolarIcons.infoCircle} className="w-5 h-5 flex-shrink-0" />
          <p>This staff member is inactive. Their history is kept; reactivate them to include them in payroll and leave again.</p>
        </div>
      )}

      {/* Information Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Icon icon={SolarIcons.user} className="w-5 h-5 text-gray-600" />
            Personal Information
          </h4>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Full Name</p>
              <p className="font-medium text-gray-900">{displayName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email Address</p>
              <p className="font-medium text-gray-900">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone Number</p>
              <p className="font-medium text-gray-900">{user.contact_number || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Address</p>
              <p className="font-medium text-gray-900">{user.address || 'Not provided'}</p>
            </div>
          </div>
        </div>

        {/* Employment Information */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Icon icon={SolarIcons.case} className="w-5 h-5 text-gray-600" />
            Employment Information
          </h4>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Job Title</p>
              <p className="font-medium text-gray-900">{user.job_title || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Department</p>
              <p className="font-medium text-gray-900">{user.department || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Employee Number</p>
              <p className="font-medium text-gray-900">{user.employee_number || 'Not assigned'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Start Date</p>
              <p className="font-medium text-gray-900">{formatDate(user.start_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Professional Registration No.</p>
              {user.hpcsa_number ? (
                <p className="font-medium text-gray-900">{user.hpcsa_number}</p>
              ) : isClinical ? (
                <p className="font-medium text-amber-600">Missing - needed on medical aid claims</p>
              ) : (
                <p className="font-medium text-gray-900">Not applicable</p>
              )}
            </div>
          </div>
        </div>

        {/* Banking Information (administrators only) */}
        {showBanking && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon icon={SolarIcons.wallet} className="w-5 h-5 text-gray-600" />
              Banking Details
            </h4>
            {bankingLoaded ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Bank Name</p>
                  <p className="font-medium text-gray-900">{user.bank_name || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Account Number</p>
                  <p className="font-medium text-gray-900">{maskAccountNumber(user.account_number)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Account Type</p>
                  <p className="font-medium text-gray-900">
                    {user.account_type
                      ? user.account_type.charAt(0).toUpperCase() + user.account_type.slice(1)
                      : 'Not provided'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map(index => (
                  <div key={index} className="h-9 rounded bg-gray-200/70 animate-pulse" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats (live data; two across on a phone, so no figure is cut off) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.calendar} className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-blue-900">{statValue(leaveDaysRemaining ?? 0)}</span>
          </div>
          <p className="text-sm text-blue-700">Annual Leave Days Available</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.clock} className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold text-green-900">
              {statValue(hoursThisMonth === null || hoursThisMonth === undefined ? '—' : hoursThisMonth.toFixed(1))}
            </span>
          </div>
          <p className="text-sm text-green-700">Timesheet Hours This Month</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.wallet} className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold text-purple-900">{statValue(payslipCount ?? 0)}</span>
          </div>
          <p className="text-sm text-purple-700">Payslips Generated</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.listCheck} className="w-8 h-8 text-orange-600" />
            <span className="text-lg font-bold text-orange-900 capitalize">
              {/* Plain words: "pending approval", not "pending_approval" */}
              {statValue(timesheetStatus ? timesheetStatus.replace(/_/g, ' ') : 'None')}
            </span>
          </div>
          <p className="text-sm text-orange-700">This Month's Timesheet</p>
        </div>
      </div>

      {/* Recent Activity (live data) */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon icon={SolarIcons.history} className="w-5 h-5 text-gray-600" />
          Recent Activity
        </h4>
        {isLoadingStats ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map(index => (
              <div key={index} className="h-10 rounded-lg bg-gray-200/70 animate-pulse" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No leave, timesheet or payslip activity yet.</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentActivity.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ACTIVITY_STYLES[item.kind].wrap}`}>
                    <Icon icon={ACTIVITY_STYLES[item.kind].icon} className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600">{item.detail}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
