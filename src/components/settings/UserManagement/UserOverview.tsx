import React from 'react';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { format } from 'date-fns';

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
}

interface UserOverviewProps {
  user: UserData;
  canEdit: boolean;
  onEdit: (user: UserData) => void;
}

export const UserOverview: React.FC<UserOverviewProps> = ({ user, canEdit, onEdit }) => {
  const roleColors = {
    admin: 'bg-purple-100 text-purple-700',
    doctor: 'bg-blue-100 text-blue-700',
    nurse: 'bg-green-100 text-green-700',
    receptionist: 'bg-yellow-100 text-yellow-700'
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return 'Not set';
    return format(new Date(date), 'MMM dd, yyyy');
  };

  return (
    <div className="space-y-6">
      {/* User Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
            <span className="text-white text-2xl font-bold">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{user.full_name}</h3>
            <p className="text-gray-600">{user.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleColors[user.role as keyof typeof roleColors] || 'bg-gray-100 text-gray-700'}`}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
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
              <p className="font-medium text-gray-900">{user.full_name}</p>
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
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.calendar} className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-blue-900">21</span>
          </div>
          <p className="text-sm text-blue-700">Leave Days Available</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.clock} className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold text-green-900">160</span>
          </div>
          <p className="text-sm text-green-700">Hours This Month</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.wallet} className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold text-purple-900">12</span>
          </div>
          <p className="text-sm text-purple-700">Payslips Generated</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Icon icon={SolarIcons.award} className="w-8 h-8 text-orange-600" />
            <span className="text-2xl font-bold text-orange-900">98%</span>
          </div>
          <p className="text-sm text-orange-700">Attendance Rate</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon icon={SolarIcons.history} className="w-5 h-5 text-gray-600" />
          Recent Activity
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Icon icon={SolarIcons.check} className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Timesheet Submitted</p>
                <p className="text-xs text-gray-600">June 25, 2025</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">2 days ago</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Icon icon={SolarIcons.calendar} className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Leave Request Approved</p>
                <p className="text-xs text-gray-600">June 20, 2025</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">7 days ago</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Icon icon={SolarIcons.wallet} className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Payslip Generated</p>
                <p className="text-xs text-gray-600">May 31, 2025</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">1 month ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};