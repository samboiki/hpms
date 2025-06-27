import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, getMonth } from 'date-fns';

interface PayrollCalculation {
  userId: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  basicSalary: number;
  earnings: Array<{
    name: string;
    code?: string;
    amount: number;
    isCompanyContribution: boolean;
  }>;
  deductions: Array<{
    name: string;
    code?: string;
    amount: number;
  }>;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  ytdGrossEarnings: number;
  ytdTotalDeductions: number;
  ytdNetPay: number;
  leaveBalances: any;
  practiceName?: string;
  employeeCode?: string;
  employeeName?: string;
  department?: string;
  jobTitle?: string;
  bankName?: string;
  accountNumber?: string;
  branchCode?: string;
}

export class PayrollService {
  static async generatePayslips(userIds: string[], payPeriod: Date) {
    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const calculation = await this.calculatePayroll(userId, payPeriod);
        const payslipId = await this.createPayslip(calculation);
        results.push({ userId, payslipId, success: true });
      } catch (error: any) {
        errors.push({ userId, error: error.message });
      }
    }

    return { results, errors };
  }

  static async calculatePayroll(userId: string, payPeriod: Date): Promise<PayrollCalculation> {
    const payPeriodStart = startOfMonth(payPeriod);
    const payPeriodEnd = endOfMonth(payPeriod);
    const currentMonth = getMonth(payPeriod) + 1; // JavaScript months are 0-indexed

    // Fetch user data with practice info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        practices!inner(name)
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) throw new Error('User not found');

    // Fetch current salary
    const { data: salary, error: salaryError } = await supabase
      .from('employee_salaries')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (salaryError || !salary) throw new Error('No active salary configuration found');

    const basicSalary = parseFloat(salary.basic_salary);

    // Fetch salary configurations
    const { data: configs } = await supabase
      .from('employee_salary_configurations')
      .select(`
        *,
        benefit:benefits(*),
        deduction:deductions(*),
        bonus_configuration:bonus_configurations(*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    const earnings: PayrollCalculation['earnings'] = [];
    const deductions: PayrollCalculation['deductions'] = [];

    // Process benefits
    if (configs) {
      for (const config of configs) {
        if (config.benefit) {
          const benefit = config.benefit;
          const amount = config.custom_value || this.calculateValue(
            benefit.type,
            benefit.value,
            benefit.base_calculation,
            basicSalary,
            0 // Will be calculated after all earnings are added
          );

          earnings.push({
            name: benefit.name,
            code: benefit.code,
            amount,
            isCompanyContribution: benefit.is_company_contribution
          });
        } else if (config.deduction) {
          const deduction = config.deduction;
          const amount = config.custom_value || this.calculateValue(
            deduction.type,
            deduction.value,
            deduction.base_calculation,
            basicSalary,
            0 // Will be calculated after all earnings are added
          );

          deductions.push({
            name: deduction.name,
            code: deduction.code,
            amount
          });
        } else if (config.bonus_configuration) {
          const bonus = config.bonus_configuration;
          
          // Check if bonus applies this month
          let bonusApplies = false;
          
          if (bonus.period_type === 'monthly') {
            bonusApplies = true;
          } else if (bonus.period_type === 'yearly' && currentMonth === 12) {
            bonusApplies = true;
          } else if (bonus.period_type === 'birthday') {
            // Would need to check user's birth month here
            const birthMonth = user.birth_month || 1; // Assuming we add this field
            bonusApplies = birthMonth === currentMonth;
          } else if (bonus.period_type === 'custom' && bonus.period_months) {
            bonusApplies = bonus.period_months.includes(currentMonth);
          }

          if (bonusApplies) {
            const amount = this.calculateValue(
              bonus.type,
              bonus.value,
              bonus.base_calculation,
              basicSalary,
              basicSalary * 12 // Annual salary for bonus calculations
            );

            earnings.push({
              name: bonus.name,
              amount,
              isCompanyContribution: false
            });
          }
        }
      }
    }

    // Calculate totals
    const grossEarnings = basicSalary + earnings
      .filter(e => !e.isCompanyContribution)
      .reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay = grossEarnings - totalDeductions;

    // Calculate YTD values
    const ytdData = await this.calculateYTD(userId, payPeriod);

    // Fetch leave balances
    const leaveBalances = await this.fetchLeaveBalances(userId);

    return {
      userId,
      payPeriodStart,
      payPeriodEnd,
      basicSalary,
      earnings,
      deductions,
      grossEarnings,
      totalDeductions,
      netPay,
      ytdGrossEarnings: ytdData.grossEarnings + grossEarnings,
      ytdTotalDeductions: ytdData.totalDeductions + totalDeductions,
      ytdNetPay: ytdData.netPay + netPay,
      leaveBalances,
      practiceName: user.practices?.name,
      employeeCode: user.employee_number,
      employeeName: user.full_name,
      department: user.department,
      jobTitle: user.job_title,
      bankName: user.bank_name,
      accountNumber: user.account_number,
      branchCode: user.branch_code
    };
  }

  private static calculateValue(
    type: 'percentage' | 'fixed',
    value: number,
    baseCalculation: string,
    basicSalary: number,
    annualSalary: number
  ): number {
    if (type === 'fixed') return value;

    let base = 0;
    switch (baseCalculation) {
      case 'basic_salary':
        base = basicSalary;
        break;
      case 'annual_salary':
        base = annualSalary;
        break;
      case 'gross_salary':
        // This would need iterative calculation
        base = basicSalary * 1.2; // Approximation
        break;
      default:
        base = basicSalary;
    }

    return (base * value) / 100;
  }

  private static async calculateYTD(userId: string, upToDate: Date) {
    const year = upToDate.getFullYear();
    const { data: payslips } = await supabase
      .from('payslips')
      .select('gross_earnings, total_deductions, net_pay')
      .eq('user_id', userId)
      .gte('payment_date', `${year}-01-01`)
      .lt('payment_date', upToDate.toISOString())
      .eq('status', 'paid');

    if (!payslips || payslips.length === 0) {
      return { grossEarnings: 0, totalDeductions: 0, netPay: 0 };
    }

    return {
      grossEarnings: payslips.reduce((sum, p) => sum + parseFloat(p.gross_earnings), 0),
      totalDeductions: payslips.reduce((sum, p) => sum + parseFloat(p.total_deductions), 0),
      netPay: payslips.reduce((sum, p) => sum + parseFloat(p.net_pay), 0)
    };
  }

  private static async fetchLeaveBalances(userId: string) {
    const currentYear = new Date().getFullYear();
    const { data: balances } = await supabase
      .from('leave_balances')
      .select(`
        *,
        leave_type:leave_type_id(name, code)
      `)
      .eq('user_id', userId)
      .eq('year', currentYear);

    if (!balances) return {};

    const leaveBalances: any = {};
    balances.forEach(balance => {
      const code = balance.leave_type.code.toLowerCase();
      leaveBalances[code] = {
        balance: balance.balance_days,
        entitlement: balance.entitled_days,
        used: balance.used_days
      };
    });

    return leaveBalances;
  }

  private static async createPayslip(calculation: PayrollCalculation) {
    const { data: user } = await supabase
      .from('users')
      .select(`
        practice_id,
        employee_number,
        practices:practice_id (
          name
        )
      `)
      .eq('id', calculation.userId)
      .single();

    if (!user) throw new Error('User not found');

    // Create the payslip
    const { data: payslip, error: payslipError } = await supabase
      .from('payslips')
      .insert({
        user_id: calculation.userId,
        pay_period_start: calculation.payPeriodStart.toISOString(),
        pay_period_end: calculation.payPeriodEnd.toISOString(),
        payment_date: calculation.payPeriodEnd.toISOString(),
        basic_salary: calculation.basicSalary,
        gross_earnings: calculation.grossEarnings,
        total_deductions: calculation.totalDeductions,
        net_pay: calculation.netPay,
        ytd_gross_earnings: calculation.ytdGrossEarnings,
        ytd_total_deductions: calculation.ytdTotalDeductions,
        ytd_net_pay: calculation.ytdNetPay,
        leave_balances: calculation.leaveBalances,
        status: 'draft',
        payment_method: 'bank_transfer',
        practice_name: user.practices?.name || 'Company',
        employee_code: user.employee_number
      })
      .select()
      .single();

    if (payslipError || !payslip) throw payslipError;

    // Create payslip items
    const items = [];

    // Add earnings as items
    calculation.earnings.forEach(earning => {
      items.push({
        payslip_id: payslip.id,
        item_type: earning.isCompanyContribution ? 'benefit' : 'earning',
        name: earning.name,
        code: earning.code,
        amount: earning.amount,
        is_company_contribution: earning.isCompanyContribution
      });
    });

    // Add deductions as items
    calculation.deductions.forEach(deduction => {
      items.push({
        payslip_id: payslip.id,
        item_type: 'deduction',
        name: deduction.name,
        code: deduction.code,
        amount: deduction.amount,
        is_company_contribution: false
      });
    });

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('payslip_items')
        .insert(items);

      if (itemsError) throw itemsError;
    }

    return payslip.id;
  }

  static async getEmployeesDueForBonus(practiceId: string, month: number) {
    // Fetch all active bonus configurations
    const { data: bonuses } = await supabase
      .from('bonus_configurations')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('is_active', true);

    if (!bonuses || bonuses.length === 0) return [];

    // Find bonuses that apply this month
    const applicableBonuses = bonuses.filter(bonus => {
      if (bonus.period_type === 'monthly') return true;
      if (bonus.period_type === 'yearly' && month === 12) return true;
      if (bonus.period_type === 'custom' && bonus.period_months?.includes(month)) return true;
      return false;
    });

    if (applicableBonuses.length === 0) return [];

    // Fetch employees with these bonus configurations
    const { data: configs } = await supabase
      .from('employee_salary_configurations')
      .select(`
        user_id,
        user:users!inner(full_name, email, employee_number),
        bonus_configuration:bonus_configurations!inner(name, type, value)
      `)
      .in('bonus_configuration_id', applicableBonuses.map(b => b.id))
      .eq('is_active', true);

    return configs || [];
  }
}