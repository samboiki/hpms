import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';

interface PayslipData {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  status: string;
}

interface LeaveBalance {
  id: string;
  leave_type: {
    name: string;
    color: string;
  };
  balance_days: number;
  entitled_days: number;
  used_days: number;
}

export const UserSelfService: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'payslips' | 'leave' | 'timesheets'>('overview');

  // Fetch user data
  const { data: userData } = useQuery({
    queryKey: ['user-self-data', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          current_salary:employee_salaries(basic_salary, currency)
        `)
        .eq('id', user?.id)
        .eq('employee_salaries.is_active', true)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch payslips
  const { data: payslips = [] } = useQuery<PayslipData[]>({
    queryKey: ['my-payslips', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .eq('user_id', user?.id)
        .order('payment_date', { ascending: false })
        .limit(12);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Fetch leave balances
  const { data: leaveBalances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ['my-leave-balances', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_balances')
        .select(`
          *,
          leave_type:leave_types(name, color)
        `)
        .eq('user_id', user?.id)
        .eq('year', new Date().getFullYear());

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Fetch timesheets
  const { data: timesheets = [] } = useQuery({
    queryKey: ['my-timesheets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
        .select('*')
        .eq('user_id', user?.id)
        .order('period_start', { ascending: false })
        .limit(6);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const formatCurrency = (amount: number, currency: string = 'NAD') => {
    return new Intl.NumberFormat('en-NA', { style: 'currency', currency }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* User Header */}
      <Card className="bg-gradient-to-r from-teal-500 to-blue-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Icon icon="solar:user-bold-duotone" className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{userData?.full_name || 'Loading...'}</h2>
                <p className="text-white/80">{userData?.job_title || userData?.role}</p>
                <p className="text-sm text-white/60">{userData?.email}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/80">Employee #</p>
              <p className="text-lg font-semibold">{userData?.employee_number || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <Card>
        <CardContent className="p-0">
          <div className="flex border-b">
            {[
              { id: 'overview', label: 'Overview', icon: 'solar:home-2-bold-duotone' },
              { id: 'payslips', label: 'My Payslips', icon: 'solar:wallet-money-bold-duotone' },
              { id: 'leave', label: 'My Leave', icon: 'solar:calendar-bold-duotone' },
              { id: 'timesheets', label: 'My Timesheets', icon: 'solar:clock-circle-bold-duotone' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-teal-600 border-b-2 border-teal-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon icon={tab.icon} className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Icon icon="solar:wallet-money-bold-duotone" className="w-8 h-8 text-green-500" />
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Monthly</span>
              </div>
              <p className="text-sm text-gray-600">Current Salary</p>
              <p className="text-2xl font-bold text-gray-900">
                {userData?.current_salary?.[0]?.basic_salary 
                  ? formatCurrency(userData.current_salary[0].basic_salary, userData.current_salary[0].currency)
                  : 'Not Set'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Icon icon="solar:calendar-bold-duotone" className="w-8 h-8 text-blue-500" />
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">2024</span>
              </div>
              <p className="text-sm text-gray-600">Leave Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {leaveBalances.reduce((sum, bal) => sum + (bal.balance_days || 0), 0).toFixed(1)} days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Icon icon="solar:clock-circle-bold-duotone" className="w-8 h-8 text-purple-500" />
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">This Month</span>
              </div>
              <p className="text-sm text-gray-600">Hours Worked</p>
              <p className="text-2xl font-bold text-gray-900">
                {timesheets[0]?.total_hours || 0} hrs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Icon icon="solar:document-text-bold-duotone" className="w-8 h-8 text-orange-500" />
                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">YTD</span>
              </div>
              <p className="text-sm text-gray-600">Payslips</p>
              <p className="text-2xl font-bold text-gray-900">{payslips.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'payslips' && (
        <Card>
          <CardHeader>
            <CardTitle>My Payslips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payslips.map(payslip => (
                <div key={payslip.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(new Date(payslip.pay_period_start), 'MMMM yyyy')} Payslip
                    </p>
                    <p className="text-sm text-gray-600">
                      Period: {format(new Date(payslip.pay_period_start), 'MMM d')} - {format(new Date(payslip.pay_period_end), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{formatCurrency(payslip.net_pay)}</p>
                    <p className="text-xs text-gray-500">Net Pay</p>
                  </div>
                  <button className="ml-4 p-2 text-teal-600 hover:bg-teal-50 rounded-lg">
                    <Icon icon="solar:download-bold-duotone" className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {payslips.length === 0 && (
                <p className="text-center text-gray-500 py-8">No payslips available</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'leave' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leaveBalances.map(balance => (
            <Card key={balance.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: balance.leave_type.color }}
                    />
                    <h3 className="font-semibold text-gray-900">{balance.leave_type.name}</h3>
                  </div>
                  <Icon icon="solar:calendar-mark-bold-duotone" className="w-6 h-6 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Entitled</span>
                    <span className="font-medium">{balance.entitled_days} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Used</span>
                    <span className="font-medium text-red-600">{balance.used_days} days</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600 font-medium">Balance</span>
                    <span className="font-bold text-green-600">{balance.balance_days} days</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'timesheets' && (
        <Card>
          <CardHeader>
            <CardTitle>My Timesheets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timesheets.map(timesheet => (
                <div key={timesheet.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(new Date(timesheet.period_start), 'MMMM yyyy')} Timesheet
                    </p>
                    <p className="text-sm text-gray-600">
                      {timesheet.total_hours} hours ({timesheet.regular_hours} regular, {timesheet.overtime_hours} overtime)
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    timesheet.status === 'approved' ? 'bg-green-100 text-green-800' :
                    timesheet.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                    timesheet.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {timesheet.status}
                  </span>
                </div>
              ))}
              {timesheets.length === 0 && (
                <p className="text-center text-gray-500 py-8">No timesheets available</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};