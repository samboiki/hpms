import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { usePractice } from '../contexts/PracticeContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export interface VisitsDataBundle {
  todayVisits: any[];
  upcomingVisits: any[];
  unconfirmedVisits: any[];
  inPracticeVisits: any[];
  completedVisits: any[];
  visitStats: {
    todayCount: number;
    unconfirmedCount: number;
    checkedInCount: number;
    readyCount: number;
    inProgressCount: number;
    completedCount: number;
  };
}

/**
 * React Query hook for fetching all visits data efficiently
 *
 * This hook fetches all visits-related data in parallel
 * for optimal performance on visits/appointments pages
 *
 * Usage:
 * ```typescript
 * const { data, isLoading, error } = useVisitsBundle();
 * // Or with specific date:
 * const { data, isLoading, error } = useVisitsBundle('2025-01-21');
 * ```
 */
export function useVisitsBundle(selectedDate?: string) {
  const { user } = useAuthStore();
  const { practiceId } = usePractice();

  const effectivePracticeId = practiceId || user?.practice_id;
  const effectiveDate = selectedDate || format(new Date(), 'yyyy-MM-dd');

  return useQuery<VisitsDataBundle>({
    queryKey: ['visits-bundle', effectivePracticeId, effectiveDate],
    queryFn: async () => {
      if (!effectivePracticeId) {
        throw new Error('Practice ID required');
      }

      console.log('⚡ [useVisitsBundle] Fetching visits data bundle...');
      const startTime = performance.now();

      // Execute ALL queries in parallel
      const [
        todayVisitsResult,
        upcomingVisitsResult,
        unconfirmedVisitsResult,
        inPracticeVisitsResult,
        completedVisitsResult,
      ] = await Promise.all([
        // 1. Today's visits
        supabase
          .from('visits')
          .select(`
            *,
            patient:patients!visits_patient_id_fkey(
              id, first_name, last_name, cell_number, email, date_of_birth
            ),
            doctor:users!doctor_id(
              id, full_name, role
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .or(`scheduled_date.eq.${effectiveDate},scheduled_date.eq.${format(new Date(effectiveDate), 'M/d/yyyy')}`)
          .order('scheduled_time', { ascending: true }),

        // 2. Upcoming visits (next 7 days)
        supabase
          .from('visits')
          .select(`
            *,
            patient:patients!visits_patient_id_fkey(
              id, first_name, last_name, cell_number
            ),
            doctor:users!doctor_id(
              id, full_name
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .gte('scheduled_date', effectiveDate)
          .lte('scheduled_date', format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
          .eq('status', 'scheduled')
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time', { ascending: true })
          .limit(50),

        // 3. Unconfirmed visits (need confirmation)
        supabase
          .from('visits')
          .select(`
            *,
            patient:patients!visits_patient_id_fkey(
              id, first_name, last_name, cell_number, email
            ),
            doctor:users!doctor_id(
              id, full_name
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .eq('is_scheduled', true)
          .eq('is_confirmed', false)
          .eq('is_cancelled', false)
          .eq('is_from_website', true)
          .order('created_at', { ascending: false }),

        // 4. In-practice visits (checked in, ready, in-progress)
        supabase
          .from('visits')
          .select(`
            *,
            patient:patients!visits_patient_id_fkey(
              id, first_name, last_name
            ),
            doctor:users!doctor_id(
              id, full_name
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .eq('is_checked_in', true)
          .neq('status', 'completed')
          .order('check_in_time', { ascending: true }),

        // 5. Completed visits (today)
        supabase
          .from('visits')
          .select(`
            *,
            patient:patients!visits_patient_id_fkey(
              id, first_name, last_name
            ),
            doctor:users!doctor_id(
              id, full_name
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .eq('scheduled_date', effectiveDate)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false }),
      ]);

      // Calculate statistics
      const visitStats = {
        todayCount: todayVisitsResult.data?.length || 0,
        unconfirmedCount: unconfirmedVisitsResult.data?.length || 0,
        checkedInCount: inPracticeVisitsResult.data?.filter(v => v.status === 'checked-in').length || 0,
        readyCount: inPracticeVisitsResult.data?.filter(v => v.status === 'ready').length || 0,
        inProgressCount: inPracticeVisitsResult.data?.filter(v => v.status === 'in-progress').length || 0,
        completedCount: completedVisitsResult.data?.length || 0,
      };

      const endTime = performance.now();
      console.log(`✅ [useVisitsBundle] Data fetched in ${(endTime - startTime).toFixed(2)}ms`);
      console.log('📊 Visit stats:', visitStats);

      return {
        todayVisits: todayVisitsResult.data || [],
        upcomingVisits: upcomingVisitsResult.data || [],
        unconfirmedVisits: unconfirmedVisitsResult.data || [],
        inPracticeVisits: inPracticeVisitsResult.data || [],
        completedVisits: completedVisitsResult.data || [],
        visitStats,
      };
    },
    enabled: !!effectivePracticeId,
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes (visits change more frequently)
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });
}

/**
 * Hook for invalidating visits cache
 */
export function useInvalidateVisits() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { practiceId } = usePractice();

  return async () => {
    const effectivePracticeId = practiceId || user?.practice_id;

    if (effectivePracticeId) {
      await queryClient.invalidateQueries({
        queryKey: ['visits-bundle', effectivePracticeId]
      });
    }
  };
}