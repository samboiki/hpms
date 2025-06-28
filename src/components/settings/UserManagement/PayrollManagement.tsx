import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { EnhancedEmployeeRemunerationModal } from './EnhancedEmployeeRemunerationModal';
import { EnhancedPayslipGenerationModal } from './EnhancedPayslipGenerationModal';
import { PayslipPreview } from './PayslipPreview';
import { PayrollService } from '../../../services/payrollService';
import { EnhancedBenefitsDeductionsManager } from './EnhancedBenefitsDeductionsManager';
import { PayslipAdjustments } from './PayslipAdjustments';
import { InfoTooltip, PayrollTooltips } from '../../ui/InfoTooltip';
import MonthInput from '../../ui/MonthInput';

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

interface PayrollManagementProps {
  selectedUserId?: string;
  isTeamView: boolean;
}

// Component to handle async payslip calculation
const SamplePayslipSection: React.FC<{
  userId: string;
  userData: any;
  practiceName?: string;
}> = ({ userId, userData, practiceName }) => {
  const [payslipData, setPayslipData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const calculatePayslip = async () => {
    setLoading(true);
    try {
        const calculation = await PayrollService.calculatePayroll(userId, new Date());
        
        setPayslipData({
          employeeName: userData.user.full_name,
          employeeId: userId.substring(0, 8).toUpperCase(),
          employeeCode: userData.user.employee_number,
          department: userData.user.department,
          designation: userData.user.job_title,
          payPeriod: format(new Date(), 'MMMM yyyy'),
          payDate: format(new Date(), 'dd MMM yyyy'),
          basicSalary: calculation.basicSalary,
          earnings: calculation.earnings, // Include all earnings for display
          deductions: calculation.deductions,
          currency: userData.currency,
          companyName: practiceName || 'Company Name',
          bankName: userData.user.bank_name,
          accountNumber: userData.user.account_number,
          branchCode: userData.user.branch_code,
          ytdGrossEarnings: calculation.ytdGrossEarnings,
          ytdTotalDeductions: calculation.ytdTotalDeductions,
          ytdNetPay: calculation.ytdNetPay,
          leaveBalances: calculation.leaveBalances,
          leaveTypes: calculation.leaveTypes
        });
      } catch (error) {
        console.error('Error calculating payslip:', error);
        // Use basic data as fallback
        setPayslipData({
          employeeName: userData.user.full_name,
          employeeId: userId.substring(0, 8).toUpperCase(),
          employeeCode: userData.user.employee_number,
          department: userData.user.department,
          designation: userData.user.job_title,
          payPeriod: format(new Date(), 'MMMM yyyy'),
          payDate: format(new Date(), 'dd MMM yyyy'),
          basicSalary: userData.basic_salary,
          earnings: [],
          deductions: [],
          currency: userData.currency,
          companyName: practiceName || 'Company Name',
          bankName: userData.user.bank_name,
          accountNumber: userData.user.account_number,
          branchCode: userData.user.branch_code,
        });
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    calculatePayslip();
  }, [userId, userData, practiceName, refreshKey]);

  if (loading) {
    return (
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm mt-6">
        <CardHeader>
          <CardTitle>Sample Payslip Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Icon icon={SolarIcons.loading} className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Calculating payslip...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-lg border border-gray-200 shadow-sm mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Sample Payslip Preview</CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRefreshKey(prev => prev + 1)}
          >
            <Icon icon={SolarIcons.refresh} className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <PayslipPreview
          payslipData={payslipData}
          onDownload={() => toast.success('Payslip download started')}
        />
      </CardContent>
    </Card>
  );
};

export const PayrollManagement: React.FC<PayrollManagementProps> = ({ selectedUserId, isTeamView }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'overview' | 'salaries' | 'components' | 'payslips' | 'adjustments'>('overview');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showGeneratePayslips, setShowGeneratePayslips] = useState(false);
  const [showRemunerationModal, setShowRemunerationModal] = useState(false);
  const [selectedEmployeeForRemuneration, setSelectedEmployeeForRemuneration] = useState<any>(null);
  const [selectedUsersForPayslips, setSelectedUsersForPayslips] = useState<string[]>([]);
  const [showBenefitsManager, setShowBenefitsManager] = useState(false);
  const currentMonth = new Date().getMonth() + 1;

  // Fetch salary data with employee numbers and bonus eligibility
  const { data: salaryData = [] } = useQuery<EmployeeSalary[]>({
    queryKey: ['employee-salaries', user?.practice_id, selectedUserId, isTeamView],
    queryFn: async () => {
      let query = supabase
        .from('employee_salaries')
        .select(`
          *,
          user:user_id (
            full_name,
            email,
            job_title,
            department,
            employee_number,
            bank_name,
            account_number,
            branch_code
          )
        `)
        .eq('is_active', true);

      // Filter by user if not team view
      if (!isTeamView && selectedUserId) {
        query = query.eq('user_id', selectedUserId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmployeeSalary[];
    },
    enabled: !!user?.practice_id
  });

  // Fetch employees due for bonuses
  const { data: bonusDueEmployees = [] } = useQuery({
    queryKey: ['bonus-due-employees', user?.practice_id, currentMonth],
    queryFn: async () => {
      if (!user?.practice_id) return [];
      return PayrollService.getEmployeesDueForBonus(user.practice_id, currentMonth);
    },
    enabled: !!user?.practice_id && isTeamView
  });

  // Fetch salary components
  const { data: components = [] } = useQuery<SalaryComponent[]>({
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
    enabled: !!user?.practice_id,
    onError: (error) => {
      console.error('Error fetching components:', error);
      toast.error('Failed to load salary components');
    }
  });

  // Fetch payslips for selected month
  const { data: payslips = [] } = useQuery<Payslip[]>({
    queryKey: ['payslips', user?.practice_id, format(selectedMonth, 'yyyy-MM'), selectedUserId, isTeamView],
    queryFn: async () => {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

      let query = supabase
        .from('payslips')
        .select(`
          *,
          user:user_id (
            full_name,
            email
          )
        `)
        .gte('pay_period_start', monthStart.toISOString())
        .lte('pay_period_end', monthEnd.toISOString());

      // Filter by user if not team view
      if (!isTeamView && selectedUserId) {
        query = query.eq('user_id', selectedUserId);
      }

      const { data, error } = await query.order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payslip[];
    },
    enabled: !!user?.practice_id,
    onError: (error) => {
      console.error('Error fetching payslips:', error);
      toast.error('Failed to load payslips');
    }
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



  // Fetch all users for payslip selection
  const { data: allUsers = [] } = useQuery<Array<{
    id: string;
    full_name: string;
    email: string;
    job_title?: string;
    department?: string;
  }>>({
    queryKey: ['all-users', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, job_title, department')
        .eq('practice_id', user?.practice_id)
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.practice_id && isTeamView
  });

  return (
    <div className="space-y-6">
      {/* Page Title */}
      {!isTeamView && selectedUserId && (
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Individual Payroll Overview
        </h2>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">
                  {isTeamView ? 'Total Monthly Payroll' : 'Monthly Salary'}
                </p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {formatCurrency(payrollSummary.totalMonthlySalary)}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {isTeamView ? `${payrollSummary.totalEmployees} employees` : 'Current salary'}
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
                <p className="text-sm font-medium text-blue-600">
                  {isTeamView ? 'Current Month Payslips' : 'Your Payslips'}
                </p>
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
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-purple-600">Total Net Pay</p>
                  {PayrollTooltips.netPay}
                </div>
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
                  <Icon icon={SolarIcons.settings} className="w-8 h-8" />
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Configure Settings
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
              { id: 'salaries', label: isTeamView ? 'Employee Salaries' : 'Salary Details', icon: SolarIcons.users },
              ...(isTeamView ? [{ id: 'components', label: 'Global Settings', icon: SolarIcons.settings }] : []),
              { id: 'payslips', label: 'Payslips', icon: SolarIcons.documentText },
              { id: 'adjustments', label: 'Adjustments', icon: SolarIcons.documentAdd },
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
          {/* Quick Actions - Only show in team view */}
          {isTeamView && (
            <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => {
                      if (salaryData.length === 0) {
                        toast.error('No employees with configured salaries');
                        return;
                      }
                      setSelectedUsersForPayslips(salaryData.map(s => s.user_id));
                      setShowGeneratePayslips(true);
                    }}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                  >
                    <Icon icon={SolarIcons.documentText} className="w-4 h-4 mr-2" />
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
                    onClick={() => {
                      setActiveView('components');
                      setShowBenefitsManager(true);
                    }}
                  >
                    <Icon icon={SolarIcons.settings} className="w-4 h-4 mr-2" />
                    Manage Benefits
                  </Button>
                  <Button variant="outline">
                    <Icon icon={SolarIcons.download} className="w-4 h-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
        <>
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{isTeamView ? 'Employee Salaries' : 'Salary Details'}</CardTitle>
                {isTeamView && (
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Configure employee salaries by clicking on the row or edit icon
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        // Get all users without salaries
                        const usersWithoutSalary = allUsers.filter(
                          u => !salaryData.some(s => s.user_id === u.id)
                        );
                        if (usersWithoutSalary.length > 0) {
                          setSelectedEmployeeForRemuneration({
                            id: usersWithoutSalary[0].id,
                            name: usersWithoutSalary[0].full_name
                          });
                          setShowRemunerationModal(true);
                        } else {
                          toast.info('All employees have salaries configured');
                        }
                      }}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                    >
                      <Icon icon={SolarIcons.addCircle} className="w-4 h-4 mr-1" />
                      Add Employee Salary
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isTeamView ? (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-3 px-4">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsersForPayslips(salaryData.map(s => s.user_id));
                              } else {
                                setSelectedUsersForPayslips([]);
                              }
                            }}
                            checked={selectedUsersForPayslips.length === salaryData.length && salaryData.length > 0}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Employee</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Job Title</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Department</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Basic Salary</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Banking</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Bonus Due</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryData.map((salary) => (
                        <tr 
                          key={salary.id} 
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedEmployeeForRemuneration({
                              id: salary.user_id,
                              name: salary.user.full_name
                            });
                            setShowRemunerationModal(true);
                          }}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedUsersForPayslips.includes(salary.user_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsersForPayslips([...selectedUsersForPayslips, salary.user_id]);
                                } else {
                                  setSelectedUsersForPayslips(selectedUsersForPayslips.filter(id => id !== salary.user_id));
                                }
                              }}
                              className="rounded text-teal-600 focus:ring-teal-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{salary.user.full_name}</p>
                              <p className="text-sm text-gray-600">
                                {salary.user.employee_number || 'No emp code'} • {salary.user.email}
                              </p>
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
                          <td className="py-3 px-4">
                            <div className="text-sm">
                              <p className="text-gray-700">{salary.user.bank_name || 'Not set'}</p>
                              <p className="text-gray-500">{salary.user.account_number || 'No account'}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {bonusDueEmployees.some(e => e.user_id === salary.user_id) ? (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                                <Icon icon={SolarIcons.star} className="w-3 h-3 inline mr-1" />
                                Bonus Due
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedEmployeeForRemuneration({
                                  id: salary.user_id,
                                  name: salary.user.full_name
                                });
                                setShowRemunerationModal(true);
                              }}
                            >
                              <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Show employees without salaries */}
                {(() => {
                  const usersWithoutSalary = allUsers.filter(
                    u => !salaryData.some(s => s.user_id === u.id)
                  );
                  
                  if (usersWithoutSalary.length > 0) {
                    return (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Employees Without Configured Salaries</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {usersWithoutSalary.map((user) => (
                            <div
                              key={user.id}
                              className="p-4 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
                              onClick={() => {
                                setSelectedEmployeeForRemuneration({
                                  id: user.id,
                                  name: user.full_name
                                });
                                setShowRemunerationModal(true);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">{user.full_name}</p>
                                  <p className="text-sm text-gray-600">{user.email}</p>
                                  <p className="text-xs text-gray-500 mt-1">{user.job_title || 'No job title'}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-orange-600"
                                >
                                  <Icon icon={SolarIcons.addCircle} className="w-5 h-5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            ) : (
              // Individual salary details
              salaryData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Basic Salary</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(salaryData[0].basic_salary, salaryData[0].currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Effective From</p>
                          <p className="text-lg font-medium text-gray-900">
                            {format(new Date(salaryData[0].effective_from), 'dd MMM yyyy')}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Job Title</p>
                          <p className="font-medium text-gray-900">
                            {salaryData[0].user.job_title || 'Not set'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Department</p>
                          <p className="font-medium text-gray-900">
                            {salaryData[0].user.department || 'Not set'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Icon icon={SolarIcons.wallet} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No salary configured yet</p>
                  </div>
                )
              )}
            </CardContent>
          </Card>
          
          {/* Payslip Preview for Individual View */}
          {!isTeamView && salaryData.length > 0 && selectedUserId && (
            <SamplePayslipSection 
              userId={selectedUserId}
              userData={salaryData[0]}
              practiceName={user?.practices?.name}
            />
          )}
        </>
      )}

      {activeView === 'components' && (
        <EnhancedBenefitsDeductionsManager />
      )}

      {activeView === 'payslips' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payslips - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex items-center gap-3">
                <MonthInput
                  value={format(selectedMonth, 'yyyy-MM')}
                  onChange={(value) => setSelectedMonth(new Date(value + '-01'))}
                  placeholder="Select month"
                />
                <Button 
                  onClick={() => {
                    setSelectedUsersForPayslips(allUsers.map(u => u.id));
                    setShowGeneratePayslips(true);
                  }}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                >
                  <Icon icon={SolarIcons.documentText} className="w-4 h-4 mr-2" />
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

      {activeView === 'adjustments' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Payslip Adjustments</CardTitle>
                  {PayrollTooltips.approvalWorkflow}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Manage one-time adjustments for {format(selectedMonth, 'MMMM yyyy')}
                </p>
              </div>
              <MonthInput
                value={format(selectedMonth, 'yyyy-MM')}
                onChange={(value) => setSelectedMonth(new Date(value + '-01'))}
                placeholder="Select month"
              />
            </div>
          </CardHeader>
          <CardContent>
            <PayslipAdjustments
              month={selectedMonth.getMonth() + 1}
              year={selectedMonth.getFullYear()}
              userId={!isTeamView ? selectedUserId : undefined}
            />
          </CardContent>
        </Card>
      )}


      {/* Employee Remuneration Modal */}
      {showRemunerationModal && selectedEmployeeForRemuneration && (
        <EnhancedEmployeeRemunerationModal
          isOpen={showRemunerationModal}
          onClose={() => {
            setShowRemunerationModal(false);
            setSelectedEmployeeForRemuneration(null);
          }}
          userId={selectedEmployeeForRemuneration.id}
          userName={selectedEmployeeForRemuneration.name}
        />
      )}

      {/* Payslip Generation Modal */}
      {showGeneratePayslips && (
        <EnhancedPayslipGenerationModal
          isOpen={showGeneratePayslips}
          onClose={() => {
            setShowGeneratePayslips(false);
            setSelectedUsersForPayslips([]);
          }}
          selectedUsers={selectedUsersForPayslips}
          month={selectedMonth}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['payslips'] });
            setShowGeneratePayslips(false);
            setSelectedUsersForPayslips([]);
          }}
        />
      )}
    </div>
  );
};