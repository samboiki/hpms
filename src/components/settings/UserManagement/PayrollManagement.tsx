import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { EnhancedEmployeeRemunerationModal } from './EnhancedEmployeeRemunerationModal';
import { EnhancedPayslipGenerationModal } from './EnhancedPayslipGenerationModal';
import { PayslipPreview } from './PayslipPreview';
import { PayrollService } from '../../../services/payrollService';
import { loadPracticeHeading } from '../../../services/stock/stockService';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { formatNad } from '../../../utils/billing/money';
import { EnhancedBenefitsDeductionsManager } from './EnhancedBenefitsDeductionsManager';
import { PayslipAdjustments } from './PayslipAdjustments';
import { PayrollTooltips } from '../../ui/InfoTooltip';
import MonthInput from '../../ui/MonthInput';
import { ConfirmDialog } from './ConfirmDialog';
import {
  describeDbError,
  downloadCsv,
  ensureRowsUpdated,
  isStaffAdmin,
  maskAccountNumber,
  parseDateOnly,
  parseMonthValue,
  toCsv
} from './staffUtils';

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
    employee_number?: string;
    bank_name?: string;
    account_number?: string;
    branch_code?: string;
    address?: string | null;
    is_active?: boolean | null;
  };
}

interface Payslip {
  id: string;
  user_id: string;
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
  /** Generated payslips start as 'unpaid'; older rows may be 'draft'/'approved' */
  status: string;
  created_at?: string;
}

interface PayrollManagementProps {
  selectedUserId?: string;
  isTeamView: boolean;
  /** Practice resolved by the parent (falls back to the signed-in user's practice). */
  practiceId?: string | null;
  /** The name of the staff member shown (individual view), for setting up their salary from here */
  selectedUserName?: string;
}

type PayslipAction = { type: 'mark-paid' | 'delete'; payslip: Payslip };

const isSettled = (status: string) => status === 'paid' || status === 'cancelled';

/** Renders an on-screen element into an A4 PDF (spills onto extra pages when needed). */
async function exportElementToPdf(element: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { default: JsPdf }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });
  const pdf = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const printableHeight = pageHeight - margin * 2;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  let rendered = 0;
  pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
  rendered += printableHeight;
  while (rendered < imgHeight) {
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, margin - rendered, imgWidth, imgHeight);
    rendered += printableHeight;
  }
  pdf.save(filename);
}

// Component to handle async payslip calculation
const SamplePayslipSection: React.FC<{
  userId: string;
  userData: EmployeeSalary;
  practiceName?: string;
  companyAddress?: string | null;
}> = ({ userId, userData, practiceName, companyAddress }) => {
  const [payslipData, setPayslipData] = useState<React.ComponentProps<typeof PayslipPreview>['payslipData'] | null>(null);
  const [loading, setLoading] = useState(true);
  // The estimate could not be worked out: said so, never a payslip without its tax and deductions
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const calculatePayslip = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const calculation = await PayrollService.calculatePayroll(userId, new Date());
        if (cancelled) return;
        setPayslipData({
          employeeName: userData.user.full_name,
          employeeId: userId.substring(0, 8).toUpperCase(),
          employeeCode: userData.user.employee_number,
          department: userData.user.department,
          designation: userData.user.job_title,
          payPeriod: format(new Date(), 'MMMM yyyy'),
          payDate: format(new Date(), 'dd MMM yyyy'),
          basicSalary: calculation.basicSalary,
          earnings: calculation.earnings,
          deductions: calculation.deductions,
          currency: userData.currency || 'NAD',
          companyName: practiceName || 'Not provided',
          companyAddress,
          employeeAddress: userData.user.address,
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
        console.error('Payslip calculation error:', error);
        if (cancelled) return;
        // A payslip of the basic salary alone (no PAYE, Social Security or deductions) would look like a real estimate
        setPayslipData(null);
        setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    calculatePayslip();
    return () => {
      cancelled = true;
    };
  }, [userId, userData, practiceName, companyAddress, refreshKey]);

  return (
    <Card className="bg-white rounded-lg border border-gray-200 shadow-sm mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sample Payslip Preview</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Estimate for {format(new Date(), 'MMMM yyyy')} based on the current salary setup</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={loading}
            onClick={() => setRefreshKey(prev => prev + 1)}
          >
            <Icon icon={SolarIcons.refresh} className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {failed && !loading ? (
          <div className="text-center py-8 min-h-[240px] flex flex-col items-center justify-center" role="alert">
            <p className="text-gray-600">The estimate could not be worked out. Press Refresh to try again, or check the salary setup.</p>
          </div>
        ) : loading || !payslipData ? (
          <div className="text-center py-8 min-h-[240px] flex flex-col items-center justify-center">
            <Icon icon={SolarIcons.loader} className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Calculating payslip...</p>
          </div>
        ) : (
          <PayslipPreview payslipData={payslipData} />
        )}
      </CardContent>
    </Card>
  );
};

export const PayrollManagement: React.FC<PayrollManagementProps> = ({ selectedUserId, isTeamView, practiceId: practiceIdProp, selectedUserName }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const practiceId = practiceIdProp || user?.practice_id;
  const isAdmin = isStaffAdmin(user);
  const isOwnRecord = !!selectedUserId && selectedUserId === user?.id;
  const [activeView, setActiveView] = useState<'overview' | 'salaries' | 'components' | 'payslips' | 'adjustments'>('overview');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showGeneratePayslips, setShowGeneratePayslips] = useState(false);
  const [showRemunerationModal, setShowRemunerationModal] = useState(false);
  const [selectedEmployeeForRemuneration, setSelectedEmployeeForRemuneration] = useState<{ id: string; name: string } | null>(null);
  const [selectedUsersForPayslips, setSelectedUsersForPayslips] = useState<string[]>([]);
  const [selectedPayslipForPreview, setSelectedPayslipForPreview] = useState<Payslip | null>(null);
  const [showPayslipPreview, setShowPayslipPreview] = useState(false);
  const [previewPayslipData, setPreviewPayslipData] = useState<React.ComponentProps<typeof PayslipPreview>['payslipData'] | null>(null);
  const [loadingPayslipId, setLoadingPayslipId] = useState<string | null>(null);
  const [downloadAfterOpen, setDownloadAfterOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [payslipAction, setPayslipAction] = useState<PayslipAction | null>(null);
  const [isUpdatingPayslip, setIsUpdatingPayslip] = useState(false);
  const payslipRef = useRef<HTMLDivElement>(null);
  const currentMonth = new Date().getMonth() + 1;
  const selectedMonthKey = format(selectedMonth, 'yyyy-MM');

  // Fetch salary data with employee numbers and bonus eligibility
  const {
    data: salaryData = [],
    isLoading: isLoadingSalaries,
    isError: salariesError,
    refetch: refetchSalaries
  } = useQuery<EmployeeSalary[]>({
    queryKey: ['employee-salaries', practiceId, selectedUserId, isTeamView],
    queryFn: async () => {
      let query = supabase
        .from('employee_salaries')
        .select(`
          *,
          user:user_id!inner (
            full_name,
            email,
            job_title,
            department,
            employee_number,
            bank_name,
            account_number,
            branch_code,
            address,
            practice_id,
            is_active
          )
        `)
        .eq('is_active', true)
        .eq('user.practice_id', practiceId);

      // Filter by user if not team view
      if (!isTeamView && selectedUserId) {
        query = query.eq('user_id', selectedUserId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as EmployeeSalary[];
    },
    enabled: !!practiceId
  });

  // Inactive staff keep their history but are left out of new payroll runs
  const activeSalaries = salaryData.filter(salary => salary.user?.is_active !== false);

  // The practice's name and address for the payslip heading (as the stock documents print them)
  const { data: practiceHeading } = useQuery({
    queryKey: ['practice-heading', practiceId],
    queryFn: () => loadPracticeHeading(practiceId as string),
    enabled: !!practiceId
  });

  // Fetch employees due for bonuses
  const { data: bonusDueEmployees = [] } = useQuery({
    queryKey: ['bonus-due-employees', practiceId, currentMonth],
    queryFn: async () => {
      if (!practiceId) return [];
      return PayrollService.getEmployeesDueForBonus(practiceId, currentMonth);
    },
    enabled: !!practiceId && isTeamView
  });

  // Fetch payslips (filtered by month in the views below)
  const {
    data: payslips = [],
    isLoading: isLoadingPayslips,
    isError: payslipsError,
    refetch: refetchPayslips
  } = useQuery<Payslip[]>({
    queryKey: ['payslips', practiceId, selectedUserId, isTeamView],
    queryFn: async () => {
      let query = supabase
        .from('payslips')
        .select(`
          *,
          user:user_id!inner (
            full_name,
            email,
            practice_id
          )
        `);

      // Filter by user if not team view
      if (!isTeamView && selectedUserId) {
        query = query.eq('user_id', selectedUserId);
      } else if (isTeamView && practiceId) {
        // Filter by practice for team view
        query = query.eq('user.practice_id', practiceId);
      }

      const { data, error } = await query
        .order('payment_date', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as unknown as Payslip[];
    },
    enabled: !!practiceId
  });

  const payslipsForMonth = payslips.filter(p => p.pay_period_start?.slice(0, 7) === selectedMonthKey);

  // Calculate payroll summary
  const payrollSummary = {
    totalEmployees: activeSalaries.length,
    totalMonthlySalary: (isTeamView ? activeSalaries : salaryData).reduce((sum, emp) => sum + Number(emp.basic_salary), 0),
    totalPayslips: payslipsForMonth.length,
    paidPayslips: payslipsForMonth.filter(p => p.status === 'paid').length,
    pendingPayslips: payslipsForMonth.filter(p => !isSettled(p.status)).length,
    totalNetPay: payslipsForMonth.reduce((sum, p) => sum + Number(p.net_pay), 0),
  };

  const formatCurrency = (amount: number, currency: string = 'NAD') => {
    // Intl's en-NA format shows the Namibian dollar as a bare "$"; HPMS writes N$
    if (!currency || currency === 'NAD') return formatNad(Number(amount) || 0);
    return new Intl.NumberFormat('en-NA', {
      style: 'currency',
      currency,
    }).format(Number(amount) || 0);
  };

  const handleMonthChange = (value: string) => {
    const month = parseMonthValue(value);
    if (month) setSelectedMonth(month);
  };

  // Mark as paid / delete (with confirmation)
  const handleConfirmPayslipAction = async () => {
    if (!payslipAction) return;
    const { type, payslip } = payslipAction;
    setIsUpdatingPayslip(true);
    try {
      if (type === 'mark-paid') {
        const { data, error } = await supabase
          .from('payslips')
          .update({
            status: 'paid',
            approved_by: user?.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', payslip.id)
          .select('id');

        if (error) throw error;
        ensureRowsUpdated(data, 'The payslip');
        toast.success('Payslip marked as paid');
      } else {
        const { data, error } = await supabase
          .from('payslips')
          .delete()
          .eq('id', payslip.id)
          .select('id');
      
        if (error) throw error;
        ensureRowsUpdated(data, 'The payslip');
        toast.success('Payslip deleted');
      }
      queryClient.invalidateQueries({ queryKey: ['payslips'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      setPayslipAction(null);
    } catch (error) {
      console.error('Error updating payslip:', error);
      toast.error(describeDbError(error, type === 'mark-paid' ? 'Could not mark the payslip as paid' : 'Could not delete the payslip'));
    } finally {
      setIsUpdatingPayslip(false);
    }
  };

  // Load full payslip details and open the preview (optionally downloading it straight away)
  const openPayslipPreview = async (payslip: Payslip, options?: { download?: boolean }) => {
    if (loadingPayslipId) return;
    setLoadingPayslipId(payslip.id);
    try {
      const payslipDetails = await PayrollService.getPayslipWithItems(payslip.id);
      setPreviewPayslipData({
        employeeName: payslip.user.full_name,
        employeeId: payslip.id.substring(0, 8).toUpperCase(),
        employeeCode: payslipDetails.user?.employee_number,
        department: payslipDetails.user?.department,
        designation: payslipDetails.user?.job_title,
        payPeriod: format(parseDateOnly(payslip.pay_period_start), 'MMMM yyyy'),
        payDate: format(parseDateOnly(payslip.payment_date), 'dd MMM yyyy'),
        basicSalary: payslipDetails.basicSalary,
        earnings: payslipDetails.earnings,
        deductions: payslipDetails.deductions,
        currency: payslipDetails.currency || 'NAD',
        companyName: payslipDetails.practice_name || user?.practices?.name || 'Company',
        companyAddress: practiceHeading?.address,
        employeeAddress: payslipDetails.user?.address,
        bankName: payslipDetails.user?.bank_name,
        accountNumber: payslipDetails.user?.account_number,
        branchCode: payslipDetails.user?.branch_code,
        ytdGrossEarnings: payslipDetails.ytd_gross_earnings,
        ytdTotalDeductions: payslipDetails.ytd_total_deductions,
        ytdNetPay: payslipDetails.ytd_net_pay,
        leaveBalances: payslipDetails.leave_balances,
        leaveTypes: payslipDetails.leaveTypes
      });
      setSelectedPayslipForPreview(payslip);
      setDownloadAfterOpen(!!options?.download);
      setShowPayslipPreview(true);
    } catch (error) {
      console.error('Error loading payslip details:', error);
      toast.error('Failed to load payslip details');
    } finally {
      setLoadingPayslipId(null);
    }
  };

  const closePayslipPreview = () => {
    setShowPayslipPreview(false);
    setSelectedPayslipForPreview(null);
    setPreviewPayslipData(null);
    setDownloadAfterOpen(false);
  };
  // Escape closes the payslip preview, as its X does
  useEscapeToClose(showPayslipPreview && !!previewPayslipData, closePayslipPreview);

  const handleDownloadPayslip = useCallback(async () => {
    const element = payslipRef.current;
    if (!element || !selectedPayslipForPreview || isDownloading) return;
    setIsDownloading(true);
    try {
      const name = selectedPayslipForPreview.user.full_name.replace(/[^a-z0-9]+/gi, '_');
      const period = format(parseDateOnly(selectedPayslipForPreview.pay_period_start), 'yyyy-MM');
      await exportElementToPdf(element, `payslip_${name}_${period}.pdf`);
      toast.success('Payslip PDF downloaded');
    } catch (error) {
      console.error('Error generating payslip PDF:', error);
      toast.error('Could not generate the payslip PDF');
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, selectedPayslipForPreview]);

  // Row "Download" opens the preview first, then exports once it has rendered
  useEffect(() => {
    if (!showPayslipPreview || !downloadAfterOpen || !payslipRef.current) return;
    setDownloadAfterOpen(false);
    handleDownloadPayslip();
  }, [showPayslipPreview, downloadAfterOpen, handleDownloadPayslip]);

  const handleExportSalaries = () => {
    if (activeSalaries.length === 0) {
      toast.error('There are no salaries to export');
      return;
    }
    const csv = toCsv(activeSalaries, [
      { label: 'Employee', value: s => s.user.full_name },
      { label: 'Employee Number', value: s => s.user.employee_number },
      { label: 'Job Title', value: s => s.user.job_title },
      { label: 'Department', value: s => s.user.department },
      { label: 'Basic Salary', value: s => Number(s.basic_salary).toFixed(2) },
      { label: 'Currency', value: s => s.currency || 'NAD' },
      { label: 'Effective From', value: s => s.effective_from }
    ]);
    downloadCsv(`payroll-salaries-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv);
    toast.success(`Exported ${activeSalaries.length} salar${activeSalaries.length === 1 ? 'y' : 'ies'}`);
  };

  // Fetch all active users for payslip selection
  const { data: allUsers = [] } = useQuery<Array<{
    id: string;
    full_name: string;
    email: string;
    job_title?: string;
    department?: string;
  }>>({
    queryKey: ['all-users', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, job_title, department')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      return (data || []) as Array<{ id: string; full_name: string; email: string; job_title?: string; department?: string }>;
    },
    enabled: !!practiceId && isTeamView
  });

  const usersWithoutSalary = allUsers.filter(u => !salaryData.some(s => s.user_id === u.id));
  const recentPayslips = [...payslips]
    .sort((a, b) => (b.created_at ?? b.payment_date).localeCompare(a.created_at ?? a.payment_date))
    .slice(0, 5);

  const renderStatusBadge = (status: string) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
      status === 'paid'
        ? 'bg-green-100 text-green-800'
        : status === 'cancelled'
          ? 'bg-gray-100 text-gray-700'
          : 'bg-yellow-100 text-yellow-800'
    }`}>
      {status}
    </span>
  );

  const loadErrorBanner = (salariesError || payslipsError) && (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <div className="flex items-center gap-2">
        <Icon icon={SolarIcons.dangerCircle} className="w-5 h-5" />
        Some payroll information could not be loaded.
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          refetchSalaries();
          refetchPayslips();
        }}
      >
        Try again
      </Button>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: SolarIcons.home },
    { id: 'salaries', label: isTeamView ? 'Employee Salaries' : 'Salary Details', icon: SolarIcons.users },
    ...(isTeamView && isAdmin ? [{ id: 'components', label: 'Global Settings', icon: SolarIcons.settings }] : []),
    { id: 'payslips', label: 'Payslips', icon: SolarIcons.documentText },
    ...(isAdmin ? [{ id: 'adjustments', label: 'Adjustments', icon: 'solar:document-add-bold-duotone' }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      {!isTeamView && selectedUserId && (
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {isOwnRecord ? 'My Payroll' : 'Individual Payroll Overview'}
        </h2>
      )}

      {loadErrorBanner}

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
                  {isLoadingSalaries ? '…' : formatCurrency(payrollSummary.totalMonthlySalary)}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {isTeamView ? `${payrollSummary.totalEmployees} active employees` : 'Current salary'}
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
                  {format(selectedMonth, 'MMMM')} Payslips
                </p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {isLoadingPayslips ? '…' : payrollSummary.totalPayslips}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {payrollSummary.paidPayslips} paid, {payrollSummary.pendingPayslips} unpaid
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
                  {isLoadingPayslips ? '…' : formatCurrency(payrollSummary.totalNetPay)}
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
                <p className="text-sm font-medium text-orange-600">Pay Period</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {format(selectedMonth, 'MMM yyyy')}
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Change it in the Payslips tab
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Icon icon={SolarIcons.calendar} className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as typeof activeView)}
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
          {/* Quick Actions - administrators only */}
          {isTeamView && isAdmin && (
            <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => {
                      if (activeSalaries.length === 0) {
                        toast.error('No active employees with configured salaries in your practice');
                        return;
                      }
                      setSelectedUsersForPayslips(activeSalaries.map(s => s.user_id));
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
                    }}
                  >
                    <Icon icon={SolarIcons.settings} className="w-4 h-4 mr-2" />
                    Manage Benefits
                  </Button>
                  <Button variant="outline" onClick={handleExportSalaries}>
                    <Icon icon={SolarIcons.download} className="w-4 h-4 mr-2" />
                    Export Salaries (CSV)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payslips for Individual View */}
          {!isTeamView && selectedUserId && (
            <Card className="bg-white rounded-lg border border-gray-200 shadow-sm lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{isOwnRecord ? 'Your Payslips' : 'Payslips'}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingPayslips ? (
                  <div className="space-y-3" aria-busy="true">
                    {[0, 1, 2].map(index => <div key={index} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}
                  </div>
                ) : payslips.length > 0 ? (
                  <div className="space-y-3">
                    {payslips.map((payslip) => (
                      <div 
                        key={payslip.id} 
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => openPayslipPreview(payslip)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {format(parseDateOnly(payslip.pay_period_start), "do 'of' MMMM")} to {format(parseDateOnly(payslip.pay_period_end), "do 'of' MMMM yyyy")}
                            </p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-sm text-gray-600">Net Pay: <strong>{formatCurrency(payslip.net_pay)}</strong></span>
                              {renderStatusBadge(payslip.status)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              title="View Payslip"
                              disabled={loadingPayslipId === payslip.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPayslipPreview(payslip);
                              }}
                            >
                              <Icon icon={loadingPayslipId === payslip.id ? SolarIcons.loader : SolarIcons.eye} className={`w-4 h-4 ${loadingPayslipId === payslip.id ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              title="Download PDF"
                              disabled={!!loadingPayslipId}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPayslipPreview(payslip, { download: true });
                              }}
                            >
                              <Icon icon={SolarIcons.download} className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Icon icon={SolarIcons.document} className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No payslips have been generated yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Activity (live data) */}
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Payroll Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingPayslips ? (
                <div className="space-y-3" aria-busy="true">
                  {[0, 1, 2].map(index => <div key={index} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}
                </div>
              ) : recentPayslips.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No payslips have been generated yet.</p>
              ) : (
                <div className="space-y-4">
                  {recentPayslips.map(payslip => (
                    <div key={payslip.id} className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${payslip.status === 'paid' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                        <Icon
                          icon={payslip.status === 'paid' ? SolarIcons.checkCircle : SolarIcons.documentText}
                          className={`w-5 h-5 ${payslip.status === 'paid' ? 'text-green-600' : 'text-yellow-700'}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {payslip.user.full_name} · {format(parseDateOnly(payslip.pay_period_start), 'MMMM yyyy')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatCurrency(payslip.net_pay)} net · {payslip.status === 'paid' ? 'paid' : 'awaiting payment'}
                        </p>
                      </div>
                      {payslip.created_at && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatDistanceToNow(new Date(payslip.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                {isTeamView && isAdmin && (
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Configure employee salaries by clicking on the row or edit icon
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (usersWithoutSalary.length > 0) {
                          setSelectedEmployeeForRemuneration({
                            id: usersWithoutSalary[0].id,
                            name: usersWithoutSalary[0].full_name
                          });
                          setShowRemunerationModal(true);
                        } else {
                          toast('All active employees already have a salary configured');
                        }
                      }}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                    >
                      <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-1" />
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
                            aria-label="Select all employees"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsersForPayslips(activeSalaries.map(s => s.user_id));
                              } else {
                                setSelectedUsersForPayslips([]);
                              }
                            }}
                            checked={selectedUsersForPayslips.length === activeSalaries.length && activeSalaries.length > 0}
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
                      {isLoadingSalaries && (
                        <tr>
                          <td colSpan={8} className="py-6">
                            <div className="h-24 rounded-lg bg-gray-100 animate-pulse" aria-busy="true" />
                          </td>
                        </tr>
                      )}
                      {!isLoadingSalaries && activeSalaries.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-gray-500">
                            No salaries configured yet. Choose an employee below to set one up.
                          </td>
                        </tr>
                      )}
                      {activeSalaries.map((salary) => (
                        <tr 
                          key={salary.id} 
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => {
                            if (!isAdmin) return;
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
                              aria-label={`Select ${salary.user.full_name}`}
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
                              <p className="text-gray-500">{maskAccountNumber(salary.user.account_number)}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {bonusDueEmployees.some(e => e.user_id === salary.user_id) ? (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                                <Icon icon="solar:star-bold-duotone" className="w-3 h-3 inline mr-1" />
                                Bonus Due
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Edit salary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmployeeForRemuneration({
                                    id: salary.user_id,
                                    name: salary.user.full_name
                                  });
                                  setShowRemunerationModal(true);
                                }}
                              >
                                <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Show employees without salaries */}
                {isAdmin && usersWithoutSalary.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Employees Without Configured Salaries</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {usersWithoutSalary.map((staffMember) => (
                        <button
                          key={staffMember.id}
                          type="button"
                          className="p-4 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors text-left"
                          onClick={() => {
                            setSelectedEmployeeForRemuneration({
                              id: staffMember.id,
                              name: staffMember.full_name
                            });
                            setShowRemunerationModal(true);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{staffMember.full_name}</p>
                              <p className="text-sm text-gray-600">{staffMember.email}</p>
                              <p className="text-xs text-gray-500 mt-1">{staffMember.job_title || 'No job title'}</p>
                            </div>
                            <Icon icon={SolarIcons.plus} className="w-5 h-5 text-orange-600" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Individual salary details
              isLoadingSalaries ? (
                <div className="h-28 rounded-lg bg-gray-100 animate-pulse" aria-busy="true" />
              ) : salaryData.length > 0 ? (
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
                            {format(parseDateOnly(salaryData[0].effective_from), 'dd MMM yyyy')}
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
                    {/* An administrator sets the salary up from here, not only from the team view */}
                    {isAdmin && selectedUserId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => {
                          setSelectedEmployeeForRemuneration({ id: selectedUserId, name: selectedUserName || 'this staff member' });
                          setShowRemunerationModal(true);
                        }}
                      >
                        Add Employee Salary
                      </Button>
                    )}
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
              companyAddress={practiceHeading?.address}
            />
          )}
        </>
      )}

      {activeView === 'components' && isAdmin && (
        <EnhancedBenefitsDeductionsManager />
      )}

      {activeView === 'payslips' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payslips - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex items-center gap-3">
                <MonthInput
                  value={selectedMonthKey}
                  onChange={handleMonthChange}
                  placeholder="Select month"
                />
                {isTeamView && isAdmin && (
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
                )}
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
                  {isLoadingPayslips && (
                    <tr>
                      <td colSpan={7} className="py-6">
                        <div className="h-24 rounded-lg bg-gray-100 animate-pulse" aria-busy="true" />
                      </td>
                    </tr>
                  )}
                  {!isLoadingPayslips && payslipsForMonth.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        <Icon icon={SolarIcons.document} className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No payslips for {format(selectedMonth, 'MMMM yyyy')}</p>
                      </td>
                    </tr>
                  )}
                  {payslipsForMonth.map((payslip) => (
                    <tr 
                      key={payslip.id} 
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => openPayslipPreview(payslip)}
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{payslip.user.full_name}</p>
                          <p className="text-sm text-gray-600">{payslip.user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {format(parseDateOnly(payslip.pay_period_start), "do 'of' MMMM")} to{' '}
                        {format(parseDateOnly(payslip.pay_period_end), "do 'of' MMMM yyyy")}
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
                        {renderStatusBadge(payslip.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            title="View Payslip"
                            disabled={loadingPayslipId === payslip.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openPayslipPreview(payslip);
                            }}
                          >
                            <Icon icon={loadingPayslipId === payslip.id ? SolarIcons.loader : SolarIcons.eye} className={`w-4 h-4 ${loadingPayslipId === payslip.id ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            title="Download PDF"
                            disabled={!!loadingPayslipId}
                            onClick={(e) => {
                              e.stopPropagation();
                              openPayslipPreview(payslip, { download: true });
                            }}
                          >
                            <Icon icon={SolarIcons.download} className="w-4 h-4" />
                          </Button>
                          {isAdmin && !isSettled(payslip.status) && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              title="Mark as Paid"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPayslipAction({ type: 'mark-paid', payslip });
                              }}
                            >
                              <Icon icon="solar:money-bag-bold-duotone" className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {isAdmin && payslip.status !== 'paid' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              title="Delete Payslip"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPayslipAction({ type: 'delete', payslip });
                              }}
                              className="hover:bg-red-50"
                            >
                              <Icon icon={SolarIcons.trash} className="w-4 h-4 text-red-600" />
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

      {activeView === 'adjustments' && isAdmin && (
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
                value={selectedMonthKey}
                onChange={handleMonthChange}
                placeholder="Select month"
              />
            </div>
          </CardHeader>
          <CardContent>
            <PayslipAdjustments
              month={selectedMonth.getMonth() + 1}
              year={selectedMonth.getFullYear()}
              userId={!isTeamView ? selectedUserId : undefined}
              practiceId={practiceId}
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

      {/* Payslip Preview Modal */}
      {showPayslipPreview && previewPayslipData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Payslip Preview</h2>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleDownloadPayslip}
                    disabled={isDownloading}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                  >
                    <Icon icon={isDownloading ? SolarIcons.loader : SolarIcons.download} className={`w-4 h-4 mr-2 ${isDownloading ? 'animate-spin' : ''}`} />
                    {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
                  </Button>
                  <button
                    type="button"
                    onClick={closePayslipPreview}
                    aria-label="Close payslip preview"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Icon icon={SolarIcons.closeCircle} className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div ref={payslipRef} className="bg-white">
                <PayslipPreview payslipData={previewPayslipData} />
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!payslipAction}
        tone={payslipAction?.type === 'delete' ? 'danger' : 'success'}
        title={payslipAction?.type === 'delete' ? 'Delete payslip?' : 'Mark payslip as paid?'}
        message={payslipAction ? (
          <p>
            <strong>{payslipAction.payslip.user.full_name}</strong> · {format(parseDateOnly(payslipAction.payslip.pay_period_start), 'MMMM yyyy')} · net pay {formatCurrency(payslipAction.payslip.net_pay)}.
            {payslipAction.type === 'delete'
              ? ' The payslip and its line items will be removed so it can be regenerated.'
              : ' Confirm the salary has been paid to the employee.'}
          </p>
        ) : null}
        confirmLabel={payslipAction?.type === 'delete' ? 'Delete payslip' : 'Mark as paid'}
        isLoading={isUpdatingPayslip}
        onConfirm={handleConfirmPayslipAction}
        onCancel={() => setPayslipAction(null)}
      />
    </div>
  );
};
