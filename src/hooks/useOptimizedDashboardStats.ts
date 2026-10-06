import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { CommunicationStatsService, CommunicationStats } from '../services/communicationStatsService';

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
  const { user, selectedPracticeId } = useAuthStore();
  // Same rule as the sidebar and Finance page: the practice a super admin switched to, else the user's own
  const practiceId = selectedPracticeId || user?.practice_id;

  return useQuery({
    queryKey: ['optimized-dashboard-stats', practiceId],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID available');

      const startTime = performance.now();
      console.log('⚡ Fetching optimized dashboard stats for practice:', practiceId);

      try {
        // Fetch main dashboard stats from RPC function
        const { data, error } = await supabase.rpc('get_dashboard_stats', {
          p_practice_id: practiceId
        });

        if (error) throw error;

        // Fetch communication stats separately
        console.log('🔍 Fetching communication stats separately...');
        const communicationStats = await CommunicationStatsService.getCommunicationStats(practiceId);
        console.log('📞 Communication stats fetched:', communicationStats);

        const queryTime = performance.now() - startTime;
        console.log(`⚡ Dashboard stats fetched in ${queryTime.toFixed(2)}ms`);

        // Parse the JSONB response from RPC
        const baseStats = data as Omit<DashboardStats, 'communication'>;
        
        // Transform communication stats to match the DashboardStats interface
        const transformedCommunicationStats = {
          smsUsed: communicationStats.sms.current_usage,
          smsLimit: communicationStats.sms.monthly_limit,
          smsPercentage: communicationStats.sms.percentage_available,
          emailUsed: communicationStats.email.current_usage,
          emailLimit: communicationStats.email.monthly_limit,
          emailPercentage: communicationStats.email.percentage_available
        };

        // Combine base stats with communication stats
        const stats: DashboardStats = {
          ...baseStats,
          communication: transformedCommunicationStats
        };
        
        // Log cache age if available
        if (stats.lastRefreshed) {
          const cacheAge = Date.now() - new Date(stats.lastRefreshed).getTime();
          const cacheAgeMinutes = Math.floor(cacheAge / 60000);
          console.log(`📊 Stats cache age: ${cacheAgeMinutes} minutes`);
        }

        console.log('✅ Final combined dashboard stats:', stats);
        return stats;
      } catch (error) {
        console.error('❌ Error fetching optimized dashboard stats:', error);
        // Re-throw instead of returning zeros (which showed N$0 on the Finance tile with no sign
        // of failure): react-query then exposes isError/error and keeps the last good data.
        // Supabase errors are plain objects, so wrap them to give callers a real Error message.
        const message = error instanceof Error
          ? error.message
          : (error as { message?: string } | null)?.message || 'Unknown error';
        throw new Error(`Dashboard stats could not be loaded: ${message}`);
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
  // Without this, onSuccess threw "queryClient is not defined" after every successful refresh
  const queryClient = useQueryClient();
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

// Hook for communication stats specifically for PremiumStatCard
export function useCommunicationStats() {
  const { user, selectedPracticeId } = useAuthStore();
  const practiceId = selectedPracticeId || user?.practice_id;

  return useQuery({
    queryKey: ['communication-stats', practiceId],
    queryFn: async (): Promise<CommunicationStats | null> => {
      if (!practiceId) return null;

      console.log('📞 Fetching communication stats for PremiumStatCard...');
      try {
        const stats = await CommunicationStatsService.getCommunicationStats(practiceId);
        console.log('✅ Communication stats for card:', stats);
        return stats;
      } catch (error) {
        console.error('❌ Error fetching communication stats for card:', error);
        return null;
      }
    },
    enabled: !!practiceId,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 2, // Auto-refresh every 2 minutes
  });
}