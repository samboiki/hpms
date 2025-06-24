import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface DashboardStats {
  patient: {
    total: number;
    male: number;
    female: number;
    newThisMonth: number;
    newThisWeek: number;
    averageAge: number;
    activePatients: number;
  };
  encounter: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    percentageCompleted: number;
    percentagePending: number;
    newThisMonth: number;
  };
  invoice: {
    totalInvoices: number;
    totalRevenue: number;
    quarterlyRevenue: number;
    quarterlyInvoices: number;
    quarterlyPaidInvoices: number;
    quarterlyOutstandingInvoices: number;
    quarterlyPercentagePaid: number;
    quarterlyPercentageOutstanding: number;
    currentQuarter: number;
  };
  communication: {
    smsUsed: number;
    smsLimit: number;
    smsPercentage: number;
    emailUsed: number;
    emailLimit: number;
    emailPercentage: number;
  };
  lastRefreshed?: string;
}

export function useOptimizedDashboardStats() {
  const { user } = useAuthStore();
  const practiceId = user?.practice_id;

  return useQuery({
    queryKey: ['optimized-dashboard-stats', practiceId],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID available');

      const startTime = performance.now();
      console.log('⚡ Fetching optimized dashboard stats for practice:', practiceId);

      try {
        // Use the optimized function that queries the materialized view
        const { data, error } = await supabase.rpc('get_dashboard_stats', {
          p_practice_id: practiceId
        });

        if (error) throw error;

        const queryTime = performance.now() - startTime;
        console.log(`⚡ Dashboard stats fetched in ${queryTime.toFixed(2)}ms`);

        // Parse the JSONB response
        const stats = data as DashboardStats;
        
        // Log cache age if available
        if (stats.lastRefreshed) {
          const cacheAge = Date.now() - new Date(stats.lastRefreshed).getTime();
          const cacheAgeMinutes = Math.floor(cacheAge / 60000);
          console.log(`📊 Stats cache age: ${cacheAgeMinutes} minutes`);
        }

        return stats;
      } catch (error) {
        console.error('❌ Error fetching optimized dashboard stats:', error);
        
        // Fall back to empty stats on error
        return {
          patient: { total: 0, male: 0, female: 0, newThisMonth: 0, newThisWeek: 0, averageAge: 0, activePatients: 0 },
          encounter: { total: 0, completed: 0, pending: 0, inProgress: 0, percentageCompleted: 0, percentagePending: 0, newThisMonth: 0 },
          invoice: { totalInvoices: 0, totalRevenue: 0, quarterlyRevenue: 0, quarterlyInvoices: 0, quarterlyPaidInvoices: 0, quarterlyOutstandingInvoices: 0, quarterlyPercentagePaid: 0, quarterlyPercentageOutstanding: 0, currentQuarter: Math.floor(new Date().getMonth() / 3) + 1 },
          communication: { smsUsed: 0, smsLimit: 0, smsPercentage: 0, emailUsed: 0, emailLimit: 0, emailPercentage: 0 }
        } as DashboardStats;
      }
    },
    enabled: !!practiceId,
    staleTime: 1000 * 60, // Consider data stale after 1 minute
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus to reduce load
    retry: 1 // Only retry once on failure
  });
}

// Hook to manually refresh the materialized view
export function useRefreshDashboardStats() {
  return useMutation({
    mutationFn: async () => {
      const startTime = performance.now();
      console.log('🔄 Refreshing dashboard stats materialized view...');

      const { error } = await supabase.rpc('refresh_dashboard_stats');

      if (error) throw error;

      const refreshTime = performance.now() - startTime;
      console.log(`🔄 Dashboard stats refreshed in ${refreshTime.toFixed(2)}ms`);
    },
    onSuccess: () => {
      // Invalidate the dashboard stats query to fetch fresh data
      queryClient.invalidateQueries({ queryKey: ['optimized-dashboard-stats'] });
    }
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';