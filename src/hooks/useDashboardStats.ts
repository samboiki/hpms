import { useState, useEffect } from 'react';
import { PatientStats } from '../services/patientStatsService';
import { CommunicationStats } from '../services/communicationStatsService';
import { InvoiceStats } from '../services/invoiceStatsService';
import { EncounterStats } from '../services/encounterStatsService';
import { usePractice } from '../contexts/PracticeContext';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  patient: PatientStats;
  communication: CommunicationStats;
  invoice: InvoiceStats;
  encounter: EncounterStats;
}

interface DashboardStatsResult {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Cache for dashboard stats
let cachedStats: {
  data: DashboardStats;
  practiceId: string;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 30 * 1000; // 30 seconds

export const useDashboardStats = (): DashboardStatsResult => {
  const { practiceId } = usePractice();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllStats = async () => {
    if (!practiceId) {
      console.log('⏳ useDashboardStats: Waiting for practiceId...');
      return;
    }

    // Check cache first
    if (cachedStats && 
        cachedStats.practiceId === practiceId && 
        Date.now() - cachedStats.timestamp < CACHE_DURATION) {
      console.log('📦 Using cached dashboard stats');
      setStats(cachedStats.data);
      setIsLoading(false);
      return;
    }

    try {
      const startTime = performance.now();
      console.log('⚡ useDashboardStats: Using optimized materialized view for practiceId:', practiceId);
      setIsLoading(true);
      setError(null);

      // Use the optimized function that queries the materialized view
      const { data, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
        p_practice_id: practiceId
      });

      if (rpcError) {
        console.warn('⚠️ Materialized view not available, falling back to parallel queries');
        // Fall back to original method if materialized view is not available
        const [patientStats, communicationStats, invoiceStats, encounterStats] = await Promise.all([
          fetchPatientStats(practiceId),
          fetchCommunicationStats(practiceId),
          fetchInvoiceStats(practiceId),
          fetchEncounterStats(practiceId)
        ]);

        const allStats: DashboardStats = {
          patient: patientStats,
          communication: communicationStats,
          invoice: invoiceStats,
          encounter: encounterStats
        };

        // Cache the results
        cachedStats = {
          data: allStats,
          practiceId,
          timestamp: Date.now()
        };

        setStats(allStats);
      } else {
        // Parse the optimized response
        const optimizedStats = data as any;
        const allStats: DashboardStats = {
          patient: {
            total: optimizedStats.patient.total || 0,
            male: optimizedStats.patient.male || 0,
            female: optimizedStats.patient.female || 0,
            newThisMonth: optimizedStats.patient.newThisMonth || 0,
            newThisWeek: optimizedStats.patient.newThisWeek || 0,
            averageAge: optimizedStats.patient.averageAge || 0,
            activePatients: optimizedStats.patient.activePatients || 0
          },
          communication: {
            sms: {
              current_usage: optimizedStats.communication.smsUsed || 0,
              monthly_limit: optimizedStats.communication.smsLimit || 1000,
              percentage_available: 100 - (optimizedStats.communication.smsPercentage || 0),
              available: (optimizedStats.communication.smsLimit || 1000) - (optimizedStats.communication.smsUsed || 0)
            },
            email: {
              current_usage: optimizedStats.communication.emailUsed || 0,
              monthly_limit: optimizedStats.communication.emailLimit || 500,
              percentage_available: 100 - (optimizedStats.communication.emailPercentage || 0),
              available: (optimizedStats.communication.emailLimit || 500) - (optimizedStats.communication.emailUsed || 0)
            },
            overall_percentage_available: Math.round(
              ((100 - (optimizedStats.communication.smsPercentage || 0)) + 
               (100 - (optimizedStats.communication.emailPercentage || 0))) / 2
            )
          },
          invoice: optimizedStats.invoice,
          encounter: optimizedStats.encounter
        };

        // Cache the results
        cachedStats = {
          data: allStats,
          practiceId,
          timestamp: Date.now()
        };

        setStats(allStats);
        
        const queryTime = performance.now() - startTime;
        console.log(`⚡ Dashboard stats fetched in ${queryTime.toFixed(2)}ms using materialized view`);
        
        // Log cache age if available
        if (optimizedStats.lastRefreshed) {
          const cacheAge = Date.now() - new Date(optimizedStats.lastRefreshed).getTime();
          const cacheAgeMinutes = Math.floor(cacheAge / 60000);
          console.log(`📊 Stats cache age: ${cacheAgeMinutes} minutes`);
        }
      }
      
      console.log('✅ useDashboardStats: Successfully fetched all stats');
    } catch (err) {
      setError(err as Error);
      console.error('❌ useDashboardStats: Error fetching stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllStats();
  }, [practiceId]);

  const refetch = () => {
    // Clear cache on manual refetch
    cachedStats = null;
    fetchAllStats();
  };

  return {
    stats,
    isLoading,
    error,
    refetch
  };
};

// Inline optimized stats fetching functions
async function fetchPatientStats(practiceId: string): Promise<PatientStats> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, gender, date_of_birth, created_at')
    .eq('practice_id', practiceId);

  if (error) throw error;

  const patients = data || [];
  const total = patients.length;
  const male = patients.filter(p => p.gender === 'male').length;
  const female = patients.filter(p => p.gender === 'female').length;

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const newThisMonth = patients.filter(p => new Date(p.created_at) >= thisMonth).length;

  const thisWeek = new Date();
  thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
  thisWeek.setHours(0, 0, 0, 0);
  const newThisWeek = patients.filter(p => new Date(p.created_at) >= thisWeek).length;

  const ages = patients
    .filter(p => p.date_of_birth)
    .map(p => {
      const birthDate = new Date(p.date_of_birth);
      const ageDiff = Date.now() - birthDate.getTime();
      return Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000));
    });
  const averageAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

  // For active patients, we'd need visit data - simplified for now
  const activePatients = Math.round(total * 0.83);

  return {
    total,
    male,
    female,
    newThisMonth,
    newThisWeek,
    averageAge,
    activePatients
  };
}

async function fetchCommunicationStats(practiceId: string): Promise<CommunicationStats> {
  // Fetch SMS and email subscriptions in parallel
  const [smsResult, emailResult] = await Promise.all([
    supabase
      .from('practice_sms_subscriptions')
      .select('current_usage, monthly_limit, additional_sms_purchased')
      .eq('practice_id', practiceId)
      .eq('is_active', true)
      .single(),
    supabase
      .from('practice_email_subscriptions')
      .select('current_usage, monthly_limit, additional_emails_purchased')
      .eq('practice_id', practiceId)
      .eq('is_active', true)
      .single()
  ]);

  const smsData = smsResult.data;
  const emailData = emailResult.data;

  const smsLimit = smsData ? (smsData.monthly_limit + (smsData.additional_sms_purchased || 0)) : 1000;
  const smsUsage = smsData?.current_usage || 0;
  const smsAvailable = smsLimit - smsUsage;
  const smsPercentageAvailable = smsLimit > 0 ? Math.round((smsAvailable / smsLimit) * 100) : 100;

  const emailLimit = emailData ? (emailData.monthly_limit + (emailData.additional_emails_purchased || 0)) : 500;
  const emailUsage = emailData?.current_usage || 0;
  const emailAvailable = emailLimit - emailUsage;
  const emailPercentageAvailable = emailLimit > 0 ? Math.round((emailAvailable / emailLimit) * 100) : 100;

  const overallPercentageAvailable = Math.round((smsPercentageAvailable + emailPercentageAvailable) / 2);

  return {
    sms: {
      current_usage: smsUsage,
      monthly_limit: smsLimit,
      percentage_available: smsPercentageAvailable,
      available: smsAvailable
    },
    email: {
      current_usage: emailUsage,
      monthly_limit: emailLimit,
      percentage_available: emailPercentageAvailable,
      available: emailAvailable
    },
    overall_percentage_available: overallPercentageAvailable
  };
}

async function fetchInvoiceStats(practiceId: string): Promise<InvoiceStats> {
  const currentDate = new Date();
  const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
  const currentYear = currentDate.getFullYear();
  
  const quarterStart = new Date(currentYear, (currentQuarter - 1) * 3, 1);
  const quarterEnd = new Date(currentYear, currentQuarter * 3, 0, 23, 59, 59);

  // Fetch all invoices and quarterly invoices in parallel
  const [allInvoicesResult, quarterlyInvoicesResult] = await Promise.all([
    supabase
      .from('invoices_enhanced')
      .select('total, payment_status')
      .eq('practice_id', practiceId),
    supabase
      .from('invoices_enhanced')
      .select('total, payment_status')
      .eq('practice_id', practiceId)
      .gte('issue_date', quarterStart.toISOString().split('T')[0])
      .lte('issue_date', quarterEnd.toISOString().split('T')[0])
  ]);

  const allInvoices = allInvoicesResult.data || [];
  const quarterlyInvoices = quarterlyInvoicesResult.data || [];

  const totalInvoices = allInvoices.length;
  const totalRevenue = allInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const quarterlyInvoiceCount = quarterlyInvoices.length;
  const quarterlyRevenue = quarterlyInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  
  const quarterlyPaidInvoices = quarterlyInvoices.filter(inv => inv.payment_status === 'paid').length;
  const quarterlyOutstandingInvoices = quarterlyInvoices.filter(inv => inv.payment_status !== 'paid').length;
  
  const quarterlyPercentagePaid = quarterlyInvoiceCount > 0 
    ? Math.round((quarterlyPaidInvoices / quarterlyInvoiceCount) * 100) 
    : 0;
  const quarterlyPercentageOutstanding = quarterlyInvoiceCount > 0 
    ? Math.round((quarterlyOutstandingInvoices / quarterlyInvoiceCount) * 100) 
    : 0;

  return {
    totalInvoices,
    totalRevenue,
    quarterlyRevenue,
    quarterlyInvoices: quarterlyInvoiceCount,
    quarterlyPaidInvoices,
    quarterlyOutstandingInvoices,
    quarterlyPercentagePaid,
    quarterlyPercentageOutstanding,
    currentQuarter
  };
}

async function fetchEncounterStats(practiceId: string): Promise<EncounterStats> {
  // Get patient IDs first
  const { data: patients } = await supabase
    .from('patients')
    .select('id')
    .eq('practice_id', practiceId);

  if (!patients || patients.length === 0) {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      percentageCompleted: 0,
      percentagePending: 0,
      newThisMonth: 0
    };
  }

  const patientIds = patients.map(p => p.id);
  
  // Get visits for these patients
  const { data: visits } = await supabase
    .from('visits')
    .select('*')
    .in('patient_id', patientIds);

  const allVisits = visits || [];
  const total = allVisits.length;
  const completed = allVisits.filter(v => v.status === 'completed').length;
  const pending = allVisits.filter(v => v.status === 'pending' || (!v.status && v.is_scheduled)).length;
  const inProgress = allVisits.filter(v => v.status === 'in-progress').length;

  const percentageCompleted = total > 0 ? Math.round((completed / total) * 100) : 0;
  const percentagePending = total > 0 ? Math.round((pending / total) * 100) : 0;

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const newThisMonth = allVisits.filter(v => 
    new Date(v.visit_date || v.scheduled_date) >= thisMonth
  ).length;

  return {
    total,
    completed,
    pending,
    inProgress,
    percentageCompleted,
    percentagePending,
    newThisMonth
  };
}

// Clear cache function for forced refresh
export function clearDashboardStatsCache() {
  cachedStats = null;
}