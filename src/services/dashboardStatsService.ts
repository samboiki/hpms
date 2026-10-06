import { supabase } from '../lib/supabase';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { financialKpiService } from './financialKpiService';

export interface DashboardStats {
  patients: {
    total: number;
    male: number;
    female: number;
    newThisMonth: number;
    averageAge: number;
    topMedicalAids: { name: string; count: number }[];
    growthData: number[];
  };
  notifications: {
    total: number;
    unread: number;
    urgent: number;
    types: { type: string; count: number; color: string }[];
    weeklyData: number[];
  };
  encounters: {
    total: number;
    thisMonth: number;
    completed: number;
    pending: number;
    types: { type: string; count: number; color: string }[];
    monthlyData: number[];
  };
  finance: {
    totalRevenue: number;
    thisMonth: number;
    outstanding: number;
    paidInvoices: number;
    unpaidInvoices: number;
    revenueData: number[];
    paymentMethods: { method: string; amount: number; color: string }[];
  };
  communications: {
    smsAllocated: number;
    smsUsed: number;
    smsAvailable: number;
    smsUsagePercentage: number;
    emailAllocated: number;
    emailUsed: number;
    emailAvailable: number;
    emailUsagePercentage: number;
    total: number;
  };
}

class DashboardStatsService {
  async getComprehensiveStats(practiceId: string): Promise<DashboardStats> {
    try {
      // Get date ranges
      const today = new Date();
      const monthStart = startOfMonth(today);
      const lastMonthStart = startOfMonth(subMonths(today, 1));
      const last6Months = subMonths(today, 6);
      const last7Days = subDays(today, 7);

      // Parallel data fetching for performance with error handling
      const [
        patientsData,
        visitData,
        appointmentData,
        invoiceData,
        medicalAidData,
        communicationsData
      ] = await Promise.allSettled([
        this.getPatientsStats(practiceId, monthStart, last6Months),
        this.getVisitStats(practiceId, monthStart, last6Months),
        this.getAppointmentStats(practiceId, monthStart),
        this.getFinanceStats(practiceId),
        this.getMedicalAidStats(practiceId),
        this.getCommunicationStats(practiceId)
      ]);

      // Extract successful results and provide defaults for failed ones
      const patientsResult = patientsData.status === 'fulfilled' ? patientsData.value : {
        total: 0, male: 0, female: 0, newThisMonth: 0, averageAge: 0, topMedicalAids: [], growthData: []
      };
      
      const visitResult = visitData.status === 'fulfilled' ? visitData.value : {
        total: 0, thisMonth: 0, completed: 0, pending: 0, types: [], monthlyData: []
      };
      
      const appointmentResult = appointmentData.status === 'fulfilled' ? appointmentData.value : {
        appointmentsThisMonth: 0, pendingAppointments: 0
      };
      
      const invoiceResult = invoiceData.status === 'fulfilled' ? invoiceData.value : {
        totalRevenue: 0, thisMonth: 0, outstanding: 0, paidInvoices: 0, unpaidInvoices: 0, revenueData: [], paymentMethods: []
      };
      
      const communicationsResult = communicationsData.status === 'fulfilled' ? communicationsData.value : {
        smsAllocated: 0, smsUsed: 0, smsAvailable: 0, smsUsagePercentage: 0,
        emailAllocated: 0, emailUsed: 0, emailAvailable: 0, emailUsagePercentage: 0, total: 0
      };

      // Log any failures
      if (patientsData.status === 'rejected') console.error('Patients stats failed:', patientsData.reason);
      if (visitData.status === 'rejected') console.error('Visit stats failed:', visitData.reason);
      if (appointmentData.status === 'rejected') console.error('Appointment stats failed:', appointmentData.reason);
      if (invoiceData.status === 'rejected') console.error('Invoice stats failed:', invoiceData.reason);
      if (communicationsData.status === 'rejected') console.error('Communications stats failed:', communicationsData.reason);

      // Generate mock notification data (since we don't have a notifications table)
      const notifications = this.generateNotificationStats();

      return {
        patients: patientsResult,
        notifications,
        encounters: {
          ...visitResult,
          ...appointmentResult
        },
        finance: invoiceResult,
        communications: communicationsResult
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  private async getPatientsStats(practiceId: string, monthStart: Date, last6Months: Date) {
    // Get all patients for the practice
    const { data: patients, error } = await supabase
      .from('patients')
      .select(`
        *,
        medical_aid_details (
          provider
        )
      `)
      .eq('practice_id', practiceId);

    if (error) throw error;

    const total = patients?.length || 0;
    const male = patients?.filter(p => p.gender?.toLowerCase() === 'male').length || 0;
    const female = patients?.filter(p => p.gender?.toLowerCase() === 'female').length || 0;
    const newThisMonth = patients?.filter(p => 
      p.created_at && new Date(p.created_at) >= monthStart
    ).length || 0;

    // Calculate average age
    const patientsWithAge = patients?.filter(p => p.date_of_birth) || [];
    const averageAge = patientsWithAge.length > 0 
      ? Math.round(patientsWithAge.reduce((sum, p) => {
          const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
          return sum + age;
        }, 0) / patientsWithAge.length)
      : 0;

    // Top medical aids
    const medicalAidCounts: { [key: string]: number } = {};
    patients?.forEach(p => {
      if (p.medical_aid_details && p.medical_aid_details.length > 0) {
        const provider = p.medical_aid_details[0].provider || 'Unknown';
        medicalAidCounts[provider] = (medicalAidCounts[provider] || 0) + 1;
      }
    });

    const topMedicalAids = Object.entries(medicalAidCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate growth data for last 6 months
    const growthData: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStartDate = startOfMonth(monthDate);
      const monthEndDate = endOfMonth(monthDate);
      
      const monthlyCount = patients?.filter(p => 
        p.created_at && 
        new Date(p.created_at) >= monthStartDate && 
        new Date(p.created_at) <= monthEndDate
      ).length || 0;
      
      growthData.push(monthlyCount);
    }

    return {
      total,
      male,
      female,
      newThisMonth,
      averageAge,
      topMedicalAids,
      growthData
    };
  }

  private async getVisitStats(practiceId: string, monthStart: Date, last6Months: Date) {
    // First get all patients for this practice
    const { data: practicePatients } = await supabase
      .from('patients')
      .select('id')
      .eq('practice_id', practiceId);
    
    const patientIds = practicePatients?.map(p => p.id) || [];
    
    if (patientIds.length === 0) {
      return {
        total: 0,
        thisMonth: 0,
        completed: 0,
        pending: 0,
        types: [],
        monthlyData: []
      };
    }

    // Then get visits for those patients
    const { data: visits, error } = await supabase
      .from('visits')
      .select('*')
      .in('patient_id', patientIds)
      .gte('visit_date', format(last6Months, 'yyyy-MM-dd'));

    if (error) throw error;

    const total = visits?.length || 0;
    const thisMonth = visits?.filter(v => 
      new Date(v.visit_date) >= monthStart
    ).length || 0;
    
    const completed = visits?.filter(v => v.status === 'completed').length || 0;
    const pending = visits?.filter(v => v.status === 'in-progress').length || 0;

    // Visit types breakdown
    const typeCounts: { [key: string]: number } = {};
    visits?.forEach(v => {
      const type = v.visit_type || 'consultation';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const types = Object.entries(typeCounts).map(([type, count], index) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count,
      color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]
    }));

    // Monthly data for last 6 months
    const monthlyData: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStartDate = startOfMonth(monthDate);
      const monthEndDate = endOfMonth(monthDate);
      
      const monthlyCount = visits?.filter(v => 
        new Date(v.visit_date) >= monthStartDate && 
        new Date(v.visit_date) <= monthEndDate
      ).length || 0;
      
      monthlyData.push(monthlyCount);
    }

    return {
      total,
      thisMonth,
      completed,
      pending,
      types,
      monthlyData
    };
  }

  private async getAppointmentStats(practiceId: string, monthStart: Date) {
    // Get appointments directly by practice_id filter
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('practice_id', practiceId)
      .gte('date', format(monthStart, 'yyyy-MM-dd'));

    if (error) throw error;

    return {
      appointmentsThisMonth: appointments?.length || 0,
      pendingAppointments: appointments?.filter(a => a.status === 'pending').length || 0
    };
  }

  private async getFinanceStats(practiceId: string): Promise<DashboardStats['finance']> {
    // Real invoices (invoices_enhanced) through the loader the Finance page uses. This used to
    // invent 100 random invoices with random amounts, statuses and payment methods.
    const kpis = await financialKpiService.getFinancialKPIs(practiceId, '6m');
    const { paid, pending, overdue } = kpis.statusSummary;

    return {
      totalRevenue: paid.amount + pending.amount + overdue.amount,
      thisMonth: kpis.totalBilledMTD,
      outstanding: kpis.totalOutstanding,
      paidInvoices: paid.count,
      unpaidInvoices: pending.count + overdue.count,
      // Billed per month (cancelled invoices excluded) for the last 6 months
      revenueData: kpis.monthlyRevenueTrend.map(month => month.revenue),
      // The loader has no per-payment-method totals; an empty list shows "no data", not made-up splits
      paymentMethods: []
    };
  }

  private async getMedicalAidStats(practiceId: string) {
    const { data: medicalAids, error } = await supabase
      .from('medical_aid_details')
      .select(`
        *,
        patients!inner(practice_id)
      `)
      .eq('patients.practice_id', practiceId);

    if (error) throw error;

    return medicalAids || [];
  }

  private generateNotificationStats(): DashboardStats['notifications'] {
    // No notification counts are read here, so report none rather than the made-up
    // 28 / 15 unread / 4 urgent this used to return
    return {
      total: 0,
      unread: 0,
      urgent: 0,
      types: [],
      weeklyData: []
    };
  }

  private async getCommunicationStats(practiceId: string) {
    try {
      console.log('🔍 [Communications] Fetching real subscription data for practice:', practiceId);

      // Fetch SMS subscription data using practice_id - NO FALLBACKS
      const { data: smsSubscription, error: smsError } = await supabase
        .from('practice_sms_subscriptions')
        .select(`
          monthly_limit,
          additional_sms_purchased,
          current_usage
        `)
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single();

      if (smsError) {
        console.log('🔍 [SMS] No active SMS subscription found for practice:', practiceId);
      }

      // Calculate SMS stats - current_usage/monthly_limit * 100 (REAL DATA ONLY)
      const smsMonthlyLimit = smsSubscription?.monthly_limit || 0;
      const smsUsed = smsSubscription?.current_usage || 0;
      const smsAdditional = smsSubscription?.additional_sms_purchased || 0;
      const smsAllocated = smsMonthlyLimit + smsAdditional;
      const smsAvailable = Math.max(0, smsAllocated - smsUsed);
      const smsUsagePercentage = smsMonthlyLimit > 0 ? Math.round((smsUsed / smsMonthlyLimit) * 100) : 0;

      // Fetch Email subscription data using practice_id - NO FALLBACKS
      let emailSubscription = null;
      let emailError = null;
      
      try {
        const emailResult = await supabase
          .from('practice_email_subscriptions' as any)
          .select(`
            monthly_limit,
            additional_emails_purchased,
            current_usage
          `)
          .eq('practice_id', practiceId)
          .eq('is_active', true)
          .single();
        
        emailSubscription = emailResult.data;
        emailError = emailResult.error;
      } catch (err) {
        console.log('🔍 [Email] Email subscription table does not exist for practice:', practiceId);
        emailError = err;
      }

      if (emailError) {
        console.log('🔍 [Email] No active Email subscription found for practice:', practiceId);
      }

      // Calculate Email stats - current_usage/monthly_limit * 100 (REAL DATA ONLY)
      const emailMonthlyLimit = (emailSubscription as any)?.monthly_limit || 0;
      const emailUsed = (emailSubscription as any)?.current_usage || 0;
      const emailAdditional = (emailSubscription as any)?.additional_emails_purchased || 0;
      const emailAllocated = emailMonthlyLimit + emailAdditional;
      const emailAvailable = Math.max(0, emailAllocated - emailUsed);
      const emailUsagePercentage = emailMonthlyLimit > 0 ? Math.round((emailUsed / emailMonthlyLimit) * 100) : 0;

      // Calculate total active communications based on actual usage from subscriptions
      // Using the current_usage from subscriptions instead of querying non-existent log tables
      const totalActiveComms = smsUsed + emailUsed;

      console.log('📊 [Communications] REAL Stats for practice', practiceId, ':', {
        sms: {
          monthlyLimit: smsMonthlyLimit,
          used: smsUsed,
          additional: smsAdditional,
          allocated: smsAllocated,
          available: smsAvailable,
          usagePercentage: smsUsagePercentage
        },
        email: {
          monthlyLimit: emailMonthlyLimit,
          used: emailUsed,
          additional: emailAdditional,
          allocated: emailAllocated,
          available: emailAvailable,
          usagePercentage: emailUsagePercentage
        },
        totalActiveComms
      });

      return {
        smsAllocated: smsMonthlyLimit, // Use monthly limit for percentage calculation
        smsUsed,
        smsAvailable,
        smsUsagePercentage,
        emailAllocated: emailMonthlyLimit, // Use monthly limit for percentage calculation
        emailUsed,
        emailAvailable,
        emailUsagePercentage,
        total: totalActiveComms
      };
    } catch (error) {
      console.error('Error fetching communication stats for practice', practiceId, ':', error);
      return {
        smsAllocated: 0,
        smsUsed: 0,
        smsAvailable: 0,
        smsUsagePercentage: 0,
        emailAllocated: 0,
        emailUsed: 0,
        emailAvailable: 0,
        emailUsagePercentage: 0,
        total: 0
      };
    }
  }
}

export const dashboardStatsService = new DashboardStatsService();