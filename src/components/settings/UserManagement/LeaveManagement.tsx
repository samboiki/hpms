import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  days_per_year: number;
  is_paid: boolean;
  color: string;
  requires_approval: boolean;
  min_notice_days: number;
}

interface LeaveBalance {
  id: string;
  leave_type: LeaveType;
  year: number;
  entitled_days: number;
  used_days: number;
  carried_over_days: number;
  balance_days: number;
}

interface LeaveRequest {
  id: string;
  user: {
    full_name: string;
    email: string;
    avatar?: string;
  };
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
}

export const LeaveManagement: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'my-leave' | 'team-leave' | 'calendar' | 'settings'>('my-leave');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const isManager = user?.role === 'admin' || user?.role === 'doctor';
  const currentYear = new Date().getFullYear();

  // Fetch leave types
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as LeaveType[];
    },
    enabled: !!user?.practice_id
  });

  // Fetch user's leave balances
  const { data: myBalances = [] } = useQuery({
    queryKey: ['my-leave-balances', user?.id, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_balances')
        .select(`
          *,
          leave_type:leave_type_id (*)
        `)
        .eq('user_id', user?.id)
        .eq('year', currentYear);

      if (error) throw error;
      return data as LeaveBalance[];
    },
    enabled: !!user?.id
  });

  // Fetch leave requests
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests', user?.practice_id, activeView],
    queryFn: async () => {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          user:user_id (
            full_name,
            email,
            avatar
          ),
          leave_type:leave_type_id (*)
        `)
        .order('created_at', { ascending: false });

      if (activeView === 'my-leave') {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LeaveRequest[];
    },
    enabled: !!user?.practice_id
  });

  // Calculate leave summary
  const leaveSummary = {
    totalEntitled: myBalances.reduce((sum, b) => sum + b.entitled_days + b.carried_over_days, 0),
    totalUsed: myBalances.reduce((sum, b) => sum + b.used_days, 0),
    totalBalance: myBalances.reduce((sum, b) => sum + b.balance_days, 0),
    pendingRequests: leaveRequests.filter(r => r.status === 'pending').length,
  };

  // Generate calendar days
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get leave requests for calendar
  const calendarLeaves = leaveRequests.filter(request => {
    if (request.status !== 'approved') return false;
    const start = new Date(request.start_date);
    const end = new Date(request.end_date);
    return start <= monthEnd && end >= monthStart;
  });

  const getLeaveStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Leave Days</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {leaveSummary.totalEntitled}
                </p>
                <p className="text-xs text-blue-600 mt-1">For {currentYear}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Icon icon={SolarIcons.calendar} className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Days Available</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {leaveSummary.totalBalance}
                </p>
                <p className="text-xs text-green-600 mt-1">Can be used</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Icon icon={SolarIcons.checkCircle} className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Days Used</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {leaveSummary.totalUsed}
                </p>
                <p className="text-xs text-orange-600 mt-1">This year</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Icon icon={SolarIcons.plane} className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Pending Requests</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {leaveSummary.pendingRequests}
                </p>
                <p className="text-xs text-purple-600 mt-1">Awaiting approval</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Icon icon={SolarIcons.clock} className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveView('my-leave')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'my-leave'
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={SolarIcons.user} className="w-4 h-4" />
              My Leave
            </button>
            {isManager && (
              <button
                onClick={() => setActiveView('team-leave')}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeView === 'team-leave'
                    ? 'text-purple-600 border-purple-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <Icon icon={SolarIcons.users} className="w-4 h-4" />
                Team Leave
              </button>
            )}
            <button
              onClick={() => setActiveView('calendar')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'calendar'
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={SolarIcons.calendar} className="w-4 h-4" />
              Leave Calendar
            </button>
            {isManager && (
              <button
                onClick={() => setActiveView('settings')}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeView === 'settings'
                    ? 'text-purple-600 border-purple-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <Icon icon={SolarIcons.settings} className="w-4 h-4" />
                Leave Settings
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {activeView === 'my-leave' && (
        <div className="space-y-6">
          {/* Leave Balances */}
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>My Leave Balances</CardTitle>
                <Button
                  onClick={() => setShowRequestForm(true)}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                  Request Leave
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myBalances.map((balance) => (
                  <div
                    key={balance.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: balance.leave_type.color }}
                        />
                        <h4 className="font-semibold text-gray-900">
                          {balance.leave_type.name}
                        </h4>
                      </div>
                      {balance.leave_type.is_paid && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          Paid
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Entitled:</span>
                        <span className="font-medium">{balance.entitled_days} days</span>
                      </div>
                      {balance.carried_over_days > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Carried Over:</span>
                          <span className="font-medium">{balance.carried_over_days} days</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Used:</span>
                        <span className="font-medium text-orange-600">{balance.used_days} days</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex justify-between">
                          <span className="text-gray-900 font-medium">Balance:</span>
                          <span className="font-bold text-green-600">{balance.balance_days} days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* My Leave Requests */}
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>My Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveRequests.filter(r => r.user_id === user?.id).map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: request.leave_type.color }}
                          />
                          <h4 className="font-semibold text-gray-900">
                            {request.leave_type.name}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLeaveStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <Icon icon={SolarIcons.calendar} className="w-4 h-4" />
                            <span>
                              {format(new Date(request.start_date), 'dd MMM yyyy')} - 
                              {format(new Date(request.end_date), 'dd MMM yyyy')}
                            </span>
                            <span className="text-gray-900 font-medium">
                              ({request.days_requested} days)
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Icon icon={SolarIcons.messageText} className="w-4 h-4 mt-0.5" />
                            <span>{request.reason}</span>
                          </div>
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <Button variant="ghost" size="sm">
                          <Icon icon={SolarIcons.closeCircle} className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {leaveRequests.filter(r => r.user_id === user?.id).length === 0 && (
                  <div className="text-center py-8">
                    <Icon icon={SolarIcons.document} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No leave requests yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowRequestForm(true)}
                    >
                      Request Your First Leave
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === 'team-leave' && isManager && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Team Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaveRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-start gap-4">
                    {/* User Avatar */}
                    <div className="flex-shrink-0">
                      {request.user.avatar ? (
                        <img
                          src={request.user.avatar}
                          alt={request.user.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                          <Icon icon={SolarIcons.user} className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Request Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{request.user.full_name}</h4>
                          <p className="text-sm text-gray-600">{request.user.email}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLeaveStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: request.leave_type.color }}
                        />
                        <span className="font-medium text-gray-900">{request.leave_type.name}</span>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon icon={SolarIcons.calendar} className="w-4 h-4" />
                          <span>
                            {format(new Date(request.start_date), 'dd MMM yyyy')} - 
                            {format(new Date(request.end_date), 'dd MMM yyyy')}
                          </span>
                          <span className="text-gray-900 font-medium">
                            ({request.days_requested} days)
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Icon icon={SolarIcons.messageText} className="w-4 h-4 mt-0.5" />
                          <span>{request.reason}</span>
                        </div>
                      </div>

                      {/* Actions for pending requests */}
                      {request.status === 'pending' && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <Icon icon={SolarIcons.closeCircle} className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {leaveRequests.length === 0 && (
                <div className="text-center py-8">
                  <Icon icon={SolarIcons.checkCircle} className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600">No pending leave requests</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'calendar' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Leave Calendar - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
              <input
                type="month"
                value={format(selectedMonth, 'yyyy-MM')}
                onChange={(e) => setSelectedMonth(new Date(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {/* Weekday headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {calendarDays.map((day) => {
                const dayLeaves = calendarLeaves.filter(leave => {
                  const start = new Date(leave.start_date);
                  const end = new Date(leave.end_date);
                  return day >= start && day <= end;
                });

                const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const isWeekendDay = isWeekend(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`bg-white p-2 min-h-[100px] ${
                      isWeekendDay ? 'bg-gray-50' : ''
                    } ${isToday ? 'ring-2 ring-purple-500' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isWeekendDay ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayLeaves.slice(0, 3).map((leave, idx) => (
                        <div
                          key={`${leave.id}-${idx}`}
                          className="text-xs p-1 rounded truncate"
                          style={{
                            backgroundColor: leave.leave_type.color + '20',
                            color: leave.leave_type.color
                          }}
                        >
                          {leave.user.full_name.split(' ')[0]}
                        </div>
                      ))}
                      {dayLeaves.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayLeaves.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'settings' && isManager && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Leave Type Configuration</CardTitle>
              <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                Add Leave Type
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leaveTypes.map((type) => (
                <div
                  key={type.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: type.color }}
                      />
                      <h4 className="font-semibold text-gray-900">{type.name}</h4>
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                        {type.code}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Days per year:</span>
                      <span className="font-medium">{type.days_per_year}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {type.is_paid && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Icon icon={SolarIcons.checkCircle} className="w-4 h-4" />
                          Paid
                        </span>
                      )}
                      {type.requires_approval && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Icon icon={SolarIcons.userCheck} className="w-4 h-4" />
                          Requires Approval
                        </span>
                      )}
                    </div>
                    {type.min_notice_days > 0 && (
                      <div className="text-gray-600">
                        Min. {type.min_notice_days} days notice required
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};