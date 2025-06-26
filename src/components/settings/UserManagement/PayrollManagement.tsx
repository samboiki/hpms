import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface EmployeeSalary {
  id: string;
  user_id: string;
  basic_salary: number;
  currency: string;
  effective_from: string;
  is_active: boolean;
  user: {
    full_name: string;
    email: string;
    job_title?: string;
    department?: string;
  };
}

interface SalaryComponent {
  id: string;
  name: string;
  type: 'earnings' | 'deductions';
  category: string;
  is_recurring: boolean;
  is_taxable: boolean;
  description?: string;
}

interface Payslip {
  id: string;
  user: {
    full_name: string;
    email: string;
  };
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
}

export const PayrollManagement: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'overview' | 'salaries' | 'components' | 'payslips'>('overview');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showGeneratePayslips, setShowGeneratePayslips] = useState(false);
  const [showAddComponent, setShowAddComponent] = useState(false);

  // Fetch salary data
  const { data: salaryData = [] } = useQuery({
    queryKey: ['employee-salaries', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_salaries')
        .select(`
          *,
          user:user_id (
            full_name,
            email,
            job_title,
            department
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmployeeSalary[];
    },
    enabled: !!user?.practice_id
  });

  // Fetch salary components
  const { data: components = [] } = useQuery({
    queryKey: ['salary-components', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_components')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('name');

      if (error) throw error;
      return data as SalaryComponent[];
    },
    enabled: !!user?.practice_id
  });

  // Fetch payslips for selected month
  const { data: payslips = [] } = useQuery({
    queryKey: ['payslips', user?.practice_id, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

      const { data, error } = await supabase
        .from('payslips')
        .select(`
          *,
          user:user_id (
            full_name,
            email
          )
        `)
        .gte('pay_period_start', monthStart.toISOString())
        .lte('pay_period_end', monthEnd.toISOString())
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payslip[];
    },
    enabled: !!user?.practice_id
  });

  // Calculate payroll summary
  const payrollSummary = {
    totalEmployees: salaryData.length,
    totalMonthlySalary: salaryData.reduce((sum, emp) => sum + Number(emp.basic_salary), 0),
    totalPayslips: payslips.length,
    paidPayslips: payslips.filter(p => p.status === 'paid').length,
    pendingPayslips: payslips.filter(p => p.status === 'draft' || p.status === 'approved').length,
    totalNetPay: payslips.reduce((sum, p) => sum + Number(p.net_pay), 0),
  };

  const formatCurrency = (amount: number, currency: string = 'NAD') => {
    return new Intl.NumberFormat('en-NA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Monthly Payroll</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {formatCurrency(payrollSummary.totalMonthlySalary)}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {payrollSummary.totalEmployees} employees
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Icon icon={SolarIcons.wallet} className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Current Month Payslips</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {payrollSummary.totalPayslips}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {payrollSummary.paidPayslips} paid, {payrollSummary.pendingPayslips} pending
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Icon icon={SolarIcons.document} className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Total Net Pay</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {formatCurrency(payrollSummary.totalNetPay)}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  {format(selectedMonth, 'MMMM yyyy')}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Icon icon={SolarIcons.cashOut} className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Components</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {components.length}
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Allowances & deductions
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Icon icon={SolarIcons.listCheck} className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: SolarIcons.home },
              { id: 'salaries', label: 'Employee Salaries', icon: SolarIcons.users },
              { id: 'components', label: 'Salary Components', icon: SolarIcons.settings },
              { id: 'payslips', label: 'Payslips', icon: SolarIcons.documentText },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeView === tab.id
                    ? 'text-purple-600 border-purple-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <Icon icon={tab.icon} className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => setShowGeneratePayslips(true)}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                >
                  <Icon icon={SolarIcons.documentAdd} className="w-4 h-4 mr-2" />
                  Generate Payslips
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveView('salaries')}
                >
                  <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-2" />
                  Manage Salaries
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddComponent(true)}
                >
                  <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                  Add Component
                </Button>
                <Button variant="outline">
                  <Icon icon={SolarIcons.download} className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Payroll Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Icon icon={SolarIcons.checkCircle} className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">5 Payslips Generated</p>
                    <p className="text-sm text-gray-600">March 2024 payroll completed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon icon={SolarIcons.userEdit} className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Salary Updated</p>
                    <p className="text-sm text-gray-600">John Doe's salary adjusted</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Icon icon={SolarIcons.plus} className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">New Component Added</p>
                    <p className="text-sm text-gray-600">Transport Allowance created</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === 'salaries' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Employee Salaries</CardTitle>
              <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                Configure Salary
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Employee</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Job Title</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Department</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Basic Salary</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Effective From</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryData.map((salary) => (
                    <tr key={salary.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{salary.user.full_name}</p>
                          <p className="text-sm text-gray-600">{salary.user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {salary.user.job_title || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {salary.user.department || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {formatCurrency(salary.basic_salary, salary.currency)}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {format(new Date(salary.effective_from), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="ghost" size="sm">
                          <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'components' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Salary Components</CardTitle>
              <Button 
                onClick={() => setShowAddComponent(true)}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
              >
                <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                Add Component
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Earnings */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Icon icon={SolarIcons.arrowUp} className="w-5 h-5 text-green-600" />
                  Earnings
                </h3>
                <div className="space-y-3">
                  {components.filter(c => c.type === 'earnings').map((component) => (
                    <div key={component.id} className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{component.name}</h4>
                          <p className="text-sm text-gray-600">{component.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                              {component.category}
                            </span>
                            {component.is_recurring && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                Recurring
                              </span>
                            )}
                            {component.is_taxable && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                                Taxable
                              </span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Icon icon={SolarIcons.arrowDown} className="w-5 h-5 text-red-600" />
                  Deductions
                </h3>
                <div className="space-y-3">
                  {components.filter(c => c.type === 'deductions').map((component) => (
                    <div key={component.id} className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{component.name}</h4>
                          <p className="text-sm text-gray-600">{component.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                              {component.category}
                            </span>
                            {component.is_recurring && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                Recurring
                              </span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'payslips' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payslips - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex items-center gap-3">
                <input
                  type="month"
                  value={format(selectedMonth, 'yyyy-MM')}
                  onChange={(e) => setSelectedMonth(new Date(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <Button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                  <Icon icon={SolarIcons.documentAdd} className="w-4 h-4 mr-2" />
                  Generate Payslips
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Employee</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Period</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Gross</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Deductions</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Net Pay</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((payslip) => (
                    <tr key={payslip.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{payslip.user.full_name}</p>
                          <p className="text-sm text-gray-600">{payslip.user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {format(new Date(payslip.pay_period_start), 'dd MMM')} - 
                        {format(new Date(payslip.pay_period_end), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {formatCurrency(payslip.gross_earnings)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-red-600">
                        -{formatCurrency(payslip.total_deductions)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        {formatCurrency(payslip.net_pay)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          payslip.status === 'paid' 
                            ? 'bg-green-100 text-green-800'
                            : payslip.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : payslip.status === 'draft'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {payslip.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Icon icon={SolarIcons.eye} className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Icon icon={SolarIcons.download} className="w-4 h-4" />
                          </Button>
                          {payslip.status === 'draft' && (
                            <Button variant="ghost" size="sm">
                              <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};