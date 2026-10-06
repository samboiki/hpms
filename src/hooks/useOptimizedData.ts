import { useQuery, useQueryClient } from '@tanstack/react-query';
import { performanceOptimizer } from '../lib/performanceOptimizer';
import { usePractice } from '../contexts/PracticeContext';
import { supabase } from '../lib/supabase';

// Hook for optimized practice overview
export function useOptimizedPracticeOverview() {
  const { practiceId } = usePractice();
  
  return useQuery({
    queryKey: ['optimized-practice-overview', practiceId],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID');
      
      return performanceOptimizer.fetchOptimized('practice_overview', {
        practiceId,
        date: new Date().toISOString().split('T')[0]
      });
    },
    enabled: !!practiceId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // Prefetch on hover
    onSuccess: (data) => {
      if (data.appointments?.length > 0) {
        // Warm up patient cache
        const patientIds = [...new Set(data.appointments.map((a: any) => a.patient_id).filter(Boolean))];
        performanceOptimizer.prefetchData(practiceId!);
      }
    }
  });
}

// Hook for optimized patient list with virtual scrolling support
export function useOptimizedPatientList(options?: { 
  search?: string; 
  virtualScroll?: boolean;
  pageSize?: number;
}) {
  const { practiceId } = usePractice();
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['optimized-patient-list', practiceId, options?.search],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID');
      
      // For search, use local filtering on cached data first
      if (options?.search) {
        const cachedData = queryClient.getQueryData(['optimized-patient-list', practiceId, undefined]);
        if (cachedData && (cachedData as any).patients) {
          const searchLower = options.search.toLowerCase();
          const filtered = (cachedData as any).patients.filter((p: any) => 
            p.first_name?.toLowerCase().includes(searchLower) ||
            p.last_name?.toLowerCase().includes(searchLower) ||
            p.cell_number?.includes(options.search!) ||
            p.email?.toLowerCase().includes(searchLower)
          );
          return { patients: filtered, fromCache: true };
        }
      }
      
      return performanceOptimizer.fetchOptimized('patient_list', {
        practiceId,
        includeVisitCounts: true
      });
    },
    enabled: !!practiceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    keepPreviousData: true, // Keep previous data while searching
  });
}

// Hook for today's appointments with real-time updates
export function useOptimizedTodayAppointments() {
  const { practiceId } = usePractice();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  
  const query = useQuery({
    queryKey: ['optimized-appointments-today', practiceId, today],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID');
      
      return performanceOptimizer.fetchOptimized('appointments_today', {
        practiceId,
        date: today
      });
    },
    enabled: !!practiceId,
    staleTime: 30 * 1000, // 30 seconds for real-time feel
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!practiceId) return;
    
    const channel = supabase
      .channel(`appointments-${practiceId}-${today}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `practice_id=eq.${practiceId}`
        },
        (payload) => {
          console.log('🔄 Real-time appointment update:', payload);
          queryClient.invalidateQueries({
            queryKey: ['optimized-appointments-today', practiceId, today]
          });
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId, today, queryClient]);
  
  return query;
}

// Hook for patient details with intelligent prefetching
export function useOptimizedPatientDetails(patientId: string | null) {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['optimized-patient-details', patientId],
    queryFn: async () => {
      if (!patientId) throw new Error('No patient ID');
      
      return performanceOptimizer.fetchOptimized('patient_details', {
        patientId
      });
    },
    enabled: !!patientId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    // Prefetch related data
    onSuccess: async (data) => {
      if (data.recentVisits?.length > 0) {
        // Prefetch visit details for recent visits
        const visitIds = data.recentVisits.slice(0, 3).map((v: any) => v.id);
        visitIds.forEach((visitId: string) => {
          queryClient.prefetchQuery({
            queryKey: ['visit-details', visitId],
            queryFn: () => fetchVisitDetails(visitId),
            staleTime: 30 * 60 * 1000,
          });
        });
      }
    }
  });
}

// Helper function for visit details
async function fetchVisitDetails(visitId: string) {
  const { data, error } = await supabase
    .from('visits')
    .select(`
      *,
      patient:patients!fk_visits_patient_id(first_name, last_name),
      doctor:users!doctor_id(full_name),
      vitals!fk_vitals_visit_id(*),
      lab_requests(count),
      imaging_requests(count),
      patient_media(count)
    `)
    .eq('id', visitId)
    .single();
    
  if (error) throw error;
  return data;
}

// Hook for background data synchronization
export function useBackgroundSync() {
  const { practiceId } = usePractice();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!practiceId) return;
    
    // Initial prefetch
    performanceOptimizer.prefetchData(practiceId);
    
    // Set up periodic background sync
    const syncInterval = setInterval(() => {
      // Sync critical data in background
      queryClient.prefetchQuery({
        queryKey: ['optimized-practice-overview', practiceId],
        queryFn: () => performanceOptimizer.fetchOptimized('practice_overview', {
          practiceId,
          date: new Date().toISOString().split('T')[0]
        }),
        staleTime: 30 * 60 * 1000,
      });
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(syncInterval);
  }, [practiceId, queryClient]);
}

// Virtual scrolling hook for large lists
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerRef: React.RefObject<HTMLElement>
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const updateDimensions = () => {
      setContainerHeight(container.clientHeight);
    };
    
    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef]);
  
  return performanceOptimizer.createVirtualList(
    items,
    itemHeight,
    containerHeight,
    scrollTop
  );
}

import { useEffect } from 'react';