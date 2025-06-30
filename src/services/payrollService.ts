import { supabase } from '../lib/supabase';
import { startOfMonth, endOfMonth, getMonth, format } from 'date-fns';

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
  leaveTypes?: any;
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

    // Process each user individually to use calculatePayroll
    for (const userId of userIds) {
      try {
        // Use the calculatePayroll method to get full payroll data including leave balances
        const calculation = await this.calculatePayroll(userId, payPeriod);
        
        // Create the payslip using the private method that includes all data
        const payslipId = await this.createPayslip(calculation);
        
        results.push({ userId, success: true, payslipId });
      } catch (error: any) {
        errors.push({ userId, error: error.message });
      }
    }

    return { results, errors };
  }

  static async calculatePayroll(userId: string, payPeriod: Date): Promise<PayrollCalculation> {
    // console.log('Calculating payroll for userId:', userId);
    const payPeriodStart = startOfMonth(payPeriod);
    const payPeriodEnd = endOfMonth(payPeriod);
    const currentMonth = getMonth(payPeriod) + 1; // JavaScript months are 0-indexed

    // Fetch user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      throw new Error(`User not found: ${userError.message}`);
    }
    if (!user) throw new Error('User not found');

    // Fetch current salary
    const { data: salary, error: salaryError } = await supabase
      .from('employee_salaries')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (salaryError || !salary) throw new Error('No active salary configuration found');

    const basicSalary = parseFloat(salary.basic_salary);

    // Calculate unpaid leave deductions for this period
    const unpaidLeaveDeduction = await this.calculateUnpaidLeaveDeduction(
      userId, 
      payPeriodStart, 
      payPeriodEnd, 
      basicSalary
    );

    // Fetch salary configurations
    const { data: configs, error: configError } = await supabase
      .from('employee_salary_configurations')
      .select(`
        *,
        benefit:benefit_id(*),
        deduction:deduction_id(*),
        bonus_configuration:bonus_configuration_id(*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (configError) {
      console.error('Error fetching salary configurations:', configError);
      throw new Error('Failed to fetch salary configurations');
    }

    // Fetch payslip adjustments for this month
    const { data: adjustments, error: adjustmentError } = await supabase
      .from('payslip_adjustments')
      .select('*')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .eq('year', payPeriod.getFullYear())
      .eq('is_approved', true);

    if (adjustmentError) {
      console.error('Error fetching payslip adjustments:', adjustmentError);
    }

    const earnings: PayrollCalculation['earnings'] = [];
    const deductions: PayrollCalculation['deductions'] = [];

    // Add unpaid leave deduction if applicable
    if (unpaidLeaveDeduction > 0) {
      deductions.push({
        name: 'Unpaid Leave Deduction',
        code: 'UNPAID_LEAVE',
        amount: unpaidLeaveDeduction
      });
    }

    // console.log('Salary configurations found:', configs?.length || 0);

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

          // console.log(`Adding benefit: ${benefit.name} - Amount: ${amount}`);
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

    // Process payslip adjustments
    if (adjustments) {
      for (const adjustment of adjustments) {
        if (adjustment.type === 'benefit' || adjustment.type === 'bonus') {
          earnings.push({
            name: adjustment.name,
            code: adjustment.code || undefined,
            amount: parseFloat(adjustment.amount),
            isCompanyContribution: false
          });
        } else if (adjustment.type === 'deduction') {
          deductions.push({
            name: adjustment.name,
            code: adjustment.code || undefined,
            amount: parseFloat(adjustment.amount)
          });
        }
      }
    }

    // Calculate totals - gross earnings should include all earnings except company contributions
    const grossEarnings = basicSalary + earnings
      .filter(e => !e.isCompanyContribution)
      .reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay = grossEarnings - totalDeductions;

    // console.log('Payroll Calculation Summary:');
    // console.log('- Basic Salary:', basicSalary);
    // console.log('- Total Earnings:', earnings.length);
    // console.log('- Total Deductions:', deductions.length);
    // console.log('- Gross Earnings:', grossEarnings);
    // console.log('- Total Deductions:', totalDeductions);
    // console.log('- Net Pay:', netPay);

    // Calculate YTD values
    const ytdData = await this.calculateYTD(userId, payPeriod);

    // Fetch leave balances and types
    const { balances: leaveBalances, leaveTypes } = await this.fetchLeaveBalances(userId);

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
      leaveTypes,
      practiceName: 'New Charm Dental Practice', // Will be passed from frontend
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
      .lt('payment_date', format(upToDate, 'yyyy-MM-dd'))
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
    // console.log('Fetching leave balances for user:', userId, 'year:', currentYear);
    
    // First get user's practice ID to fetch leave types
    const { data: user } = await supabase
      .from('users')
      .select('practice_id')
      .eq('id', userId)
      .single();

    if (!user) return { balances: {}, leaveTypes: {} };

    // Get leave balances
    const { data: balances, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', userId)
      .eq('year', currentYear);

    if (error) {
      console.error('Error fetching leave balances:', error);
      return { balances: {}, leaveTypes: {} };
    }

    // Get all leave types for this practice
    const { data: allLeaveTypes } = await supabase
      .from('leave_types')
      .select('*')
      .eq('practice_id', user.practice_id)
      .eq('is_active', true);

    const leaveTypeMap = new Map(allLeaveTypes?.map(lt => [lt.id, lt]) || []);
    const leaveTypesDict: any = {};
    
    // Build leave types dictionary
    allLeaveTypes?.forEach(lt => {
      leaveTypesDict[lt.code.toLowerCase()] = {
        name: lt.name,
        code: lt.code,
        accrualRate: parseFloat(lt.accrual_rate),
        carryoverAllowed: lt.carryover_allowed,
        daysPerYear: parseFloat(lt.days_per_year)
      };
    });

    // console.log('Leave balances found:', balances?.length || 0);

    const leaveBalances: any = {};
    if (balances && balances.length > 0) {
      balances.forEach(balance => {
        const leaveType = leaveTypeMap.get(balance.leave_type_id);
        if (leaveType) {
          const code = leaveType.code.toLowerCase();
          leaveBalances[code] = {
            balance: parseFloat(balance.balance_days),
            entitlement: parseFloat(balance.entitled_days),
            used: parseFloat(balance.used_days),
            accrualRate: parseFloat(leaveType.accrual_rate),
            carryoverAllowed: leaveType.carryover_allowed
          };
          // console.log(`Leave type ${code}:`, leaveBalances[code]);
        }
      });
    }

    return { balances: leaveBalances, leaveTypes: leaveTypesDict };
  }

  private static async createPayslip(calculation: PayrollCalculation) {
    const { data: user } = await supabase
      .from('users')
      .select('practice_id, employee_number')
      .eq('id', calculation.userId)
      .single();

    if (!user) throw new Error('User not found');

    // Create the payslip
    // Use local date formatting to avoid timezone issues
    const { data: payslip, error: payslipError } = await supabase
      .from('payslips')
      .insert({
        user_id: calculation.userId,
        pay_period_start: format(calculation.payPeriodStart, 'yyyy-MM-dd'),
        pay_period_end: format(calculation.payPeriodEnd, 'yyyy-MM-dd'),
        payment_date: format(calculation.payPeriodEnd, 'yyyy-MM-dd'),
        basic_salary: calculation.basicSalary,
        gross_earnings: calculation.grossEarnings,
        total_deductions: calculation.totalDeductions,
        net_pay: calculation.netPay,
        ytd_gross_earnings: calculation.ytdGrossEarnings,
        ytd_total_deductions: calculation.ytdTotalDeductions,
        ytd_net_pay: calculation.ytdNetPay,
        leave_balances: calculation.leaveBalances,
        status: 'unpaid',
        payment_method: 'bank_transfer',
        practice_name: calculation.practiceName || 'Company',
        employee_code: user.employee_number
      })
      .select()
      .single();

    if (payslipError || !payslip) throw payslipError;

    // Create payslip items
    const items = [];

    // Add basic salary as an item
    items.push({
      payslip_id: payslip.id,
      component_name: 'Basic Salary',
      type: 'earning',
      amount: calculation.basicSalary
    });

    // Add earnings as items
    calculation.earnings.forEach(earning => {
      items.push({
        payslip_id: payslip.id,
        component_name: earning.name,
        type: earning.isCompanyContribution ? 'company_contribution' : 'earning',
        amount: earning.amount
      });
    });

    // Add deductions as items
    calculation.deductions.forEach(deduction => {
      items.push({
        payslip_id: payslip.id,
        component_name: deduction.name,
        type: 'deduction',
        amount: deduction.amount
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

  static async getPayslipWithItems(payslipId: string) {
    // Fetch payslip
    const { data: payslip, error: payslipError } = await supabase
      .from('payslips')
      .select(`
        *,
        user:user_id (
          full_name,
          email,
          employee_number,
          job_title,
          department,
          bank_name,
          account_number,
          branch_code
        )
      `)
      .eq('id', payslipId)
      .single();

    if (payslipError || !payslip) throw payslipError || new Error('Payslip not found');

    // Fetch payslip items
    const { data: items, error: itemsError } = await supabase
      .from('payslip_items')
      .select('*')
      .eq('payslip_id', payslipId)
      .order('type', { ascending: true })
      .order('component_name', { ascending: true });

    if (itemsError) throw itemsError;

    // Transform items into earnings and deductions
    const earnings = items
      ?.filter(item => item.type === 'earning' || item.type === 'company_contribution')
      .map(item => ({
        name: item.component_name,
        amount: parseFloat(item.amount),
        isCompanyContribution: item.type === 'company_contribution'
      })) || [];

    const deductions = items
      ?.filter(item => item.type === 'deduction')
      .map(item => ({
        name: item.component_name,
        amount: parseFloat(item.amount)
      })) || [];

    // Extract basic salary from earnings if present
    const basicSalaryItem = earnings.find(e => e.name === 'Basic Salary');
    const basicSalary = basicSalaryItem?.amount || parseFloat(payslip.basic_salary);
    
    // Remove basic salary from earnings array to avoid duplication
    const otherEarnings = earnings.filter(e => e.name !== 'Basic Salary');

    // Fetch leave types for the practice
    const { data: user } = await supabase
      .from('users')
      .select('practice_id')
      .eq('id', payslip.user_id)
      .single();

    const leaveTypes: any = {};
    if (user) {
      const { data: allLeaveTypes } = await supabase
        .from('leave_types')
        .select('*')
        .eq('practice_id', user.practice_id)
        .eq('is_active', true);

      allLeaveTypes?.forEach(lt => {
        leaveTypes[lt.code.toLowerCase()] = {
          name: lt.name,
          code: lt.code,
          accrualRate: parseFloat(lt.accrual_rate),
          carryoverAllowed: lt.carryover_allowed,
          daysPerYear: parseFloat(lt.days_per_year)
        };
      });
    }

    return {
      ...payslip,
      basicSalary,
      earnings: otherEarnings,
      deductions,
      items,
      leaveTypes
    };
  }

  // Calculate unpaid leave deduction for the given period
  private static async calculateUnpaidLeaveDeduction(
    userId: string, 
    payPeriodStart: Date, 
    payPeriodEnd: Date, 
    basicSalary: number
  ): Promise<number> {
    try {
      // Get approved unpaid leave requests for this period
      const { data: unpaidLeaves, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          leave_type:leave_types!inner(is_paid, name)
        `)
        .eq('user_id', userId)
        .eq('status', 'approved')
        .not('leave_type.is_paid', 'eq', true) // Only unpaid leave types
        .gte('start_date', payPeriodStart.toISOString().split('T')[0])
        .lte('end_date', payPeriodEnd.toISOString().split('T')[0]);

      if (error) {
        console.error('Error fetching unpaid leave:', error);
        return 0;
      }

      if (!unpaidLeaves || unpaidLeaves.length === 0) {
        return 0;
      }

      // Calculate total unpaid leave days in this period
      let totalUnpaidDays = 0;
      
      for (const leave of unpaidLeaves) {
        // Get the intersection of leave period with pay period
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        
        const periodStart = leaveStart < payPeriodStart ? payPeriodStart : leaveStart;
        const periodEnd = leaveEnd > payPeriodEnd ? payPeriodEnd : leaveEnd;
        
        if (periodStart <= periodEnd) {
          // Calculate working days in the intersection
          const currentDate = new Date(periodStart);
          let days = 0;
          
          while (currentDate <= periodEnd) {
            // Only count weekdays (Monday = 1, Sunday = 0)
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              days++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // Handle half-day leaves
          if (leave.is_half_day && days > 0) {
            days = days - 0.5;
          }
          
          totalUnpaidDays += days;
        }
      }

      if (totalUnpaidDays <= 0) {
        return 0;
      }

      // Calculate deduction: (monthly salary / working days in month) * unpaid days
      const workingDaysInMonth = this.getWorkingDaysInMonth(payPeriodStart);
      const dailyRate = basicSalary / workingDaysInMonth;
      const deduction = dailyRate * totalUnpaidDays;

      console.log(`Unpaid leave deduction: ${totalUnpaidDays} days * ${dailyRate.toFixed(2)} = ${deduction.toFixed(2)}`);
      
      return Math.round(deduction * 100) / 100; // Round to 2 decimal places
      
    } catch (error) {
      console.error('Error calculating unpaid leave deduction:', error);
      return 0;
    }
  }

  // Helper method to calculate working days in a month
  private static getWorkingDaysInMonth(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let workingDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dayOfWeek = currentDate.getDay();
      // Count weekdays only (Monday = 1, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  // Validate and process carryover for leave balances
  static async validateAndProcessCarryover(practiceId: string, fromYear: number, toYear: number) {
    try {
      console.log(`Processing carryover from ${fromYear} to ${toYear} for practice ${practiceId}`);

      // Get all leave types for this practice
      const { data: leaveTypes, error: leaveTypesError } = await supabase
        .from('leave_types')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true);

      if (leaveTypesError) throw leaveTypesError;

      // Get all users in this practice
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('practice_id', practiceId)
        .eq('is_active', true);

      if (usersError) throw usersError;

      const results = [];
      const errors = [];

      for (const user of users) {
        for (const leaveType of leaveTypes) {
          try {
            const result = await this.processUserLeaveCarryover(
              user.id,
              leaveType,
              fromYear,
              toYear
            );
            if (result) {
              results.push(result);
            }
          } catch (error: any) {
            errors.push({
              userId: user.id,
              leaveTypeId: leaveType.id,
              error: error.message
            });
          }
        }
      }

      return { results, errors };
    } catch (error) {
      console.error('Error processing carryover:', error);
      throw error;
    }
  }

  // Process carryover for a specific user and leave type
  private static async processUserLeaveCarryover(
    userId: string,
    leaveType: any,
    fromYear: number,
    toYear: number
  ) {
    try {
      // Check if carryover is allowed for this leave type
      if (!leaveType.carryover_allowed) {
        return null; // No carryover allowed
      }

      // Get previous year balance
      const { data: previousBalance, error: prevError } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', userId)
        .eq('leave_type_id', leaveType.id)
        .eq('year', fromYear)
        .single();

      if (prevError && prevError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw prevError;
      }

      if (!previousBalance) {
        return null; // No previous balance to carry over
      }

      // Calculate remaining balance (entitled - used)
      const remainingBalance = parseFloat(previousBalance.entitled_days) - parseFloat(previousBalance.used_days);
      
      if (remainingBalance <= 0) {
        return null; // Nothing to carry over
      }

      // Apply carryover limits
      const maxCarryover = parseFloat(leaveType.max_carryover_days) || 0;
      const carryoverAmount = maxCarryover > 0 
        ? Math.min(remainingBalance, maxCarryover)
        : remainingBalance;

      if (carryoverAmount <= 0) {
        return null;
      }

      // Check if next year balance already exists
      const { data: existingBalance, error: existingError } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', userId)
        .eq('leave_type_id', leaveType.id)
        .eq('year', toYear)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
      }

      const newEntitlement = parseFloat(leaveType.days_per_year);

      if (existingBalance) {
        // Update existing balance with carryover
        const { error: updateError } = await supabase
          .from('leave_balances')
          .update({
            carried_over_days: carryoverAmount,
            entitled_days: newEntitlement + carryoverAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingBalance.id);

        if (updateError) throw updateError;

        return {
          userId,
          leaveTypeId: leaveType.id,
          leaveTypeName: leaveType.name,
          fromYear,
          toYear,
          remainingBalance,
          maxAllowed: maxCarryover,
          carriedOver: carryoverAmount,
          action: 'updated'
        };
      } else {
        // Create new balance with carryover
        const { error: insertError } = await supabase
          .from('leave_balances')
          .insert({
            user_id: userId,
            leave_type_id: leaveType.id,
            year: toYear,
            entitled_days: newEntitlement + carryoverAmount,
            carried_over_days: carryoverAmount,
            used_days: 0,
            total_accrued: 0,
            accrued_this_month: 0
          });

        if (insertError) throw insertError;

        return {
          userId,
          leaveTypeId: leaveType.id,
          leaveTypeName: leaveType.name,
          fromYear,
          toYear,
          remainingBalance,
          maxAllowed: maxCarryover,
          carriedOver: carryoverAmount,
          action: 'created'
        };
      }
    } catch (error) {
      console.error(`Error processing carryover for user ${userId}, leave type ${leaveType.id}:`, error);
      throw error;
    }
  }

  // Validate carryover limits when approving leave requests
  static async validateCarryoverLimits(userId: string, leaveTypeId: string, year: number) {
    try {
      // Get leave type configuration
      const { data: leaveType, error: leaveTypeError } = await supabase
        .from('leave_types')
        .select('*')
        .eq('id', leaveTypeId)
        .single();

      if (leaveTypeError) throw leaveTypeError;

      if (!leaveType.carryover_allowed) {
        return { valid: true, message: 'No carryover validation needed' };
      }

      // Get current year balance
      const { data: balance, error: balanceError } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', userId)
        .eq('leave_type_id', leaveTypeId)
        .eq('year', year)
        .single();

      if (balanceError) {
        return { valid: true, message: 'No balance found for validation' };
      }

      const carriedOver = parseFloat(balance.carried_over_days) || 0;
      const maxCarryover = parseFloat(leaveType.max_carryover_days) || 0;

      if (maxCarryover > 0 && carriedOver > maxCarryover) {
        return {
          valid: false,
          message: `Carried over days (${carriedOver}) exceed maximum allowed (${maxCarryover})`
        };
      }

      return { valid: true, message: 'Carryover limits validated successfully' };
    } catch (error) {
      console.error('Error validating carryover limits:', error);
      return { valid: false, message: 'Error validating carryover limits' };
    }
  }
}