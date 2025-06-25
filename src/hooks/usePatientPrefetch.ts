import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchPatientDetailsOptimized } from '../components/patients/OptimizedPatientQueries';

interface PrefetchOptions {
  maxPatients?: number; // Maximum number of patients to prefetch
  priority?: 'time' | 'status'; // Prioritize by appointment time or status
}

export function usePatientPrefetch() {
  const queryClient = useQueryClient();

  // Prefetch multiple patient details
  const prefetchPatientDetails = useCallback(async (
    patientIds: string[], 
    options: PrefetchOptions = {}
  ) => {
    const { maxPatients = 10 } = options;
    
    // Limit the number of patients to prefetch
    const idsToFetch = patientIds.slice(0, maxPatients);
    
    console.log(`🔄 Prefetching data for ${idsToFetch.length} patients...`);
    const startTime = performance.now();
    
    // Use requestIdleCallback for non-blocking prefetch if available
    const performPrefetch = async () => {
      const promises = idsToFetch.map(id => 
        queryClient.prefetchQuery({
          queryKey: ['patient-details-optimized', id],
          queryFn: () => fetchPatientDetailsOptimized(id),
          staleTime: 1000 * 60 * 10, // 10 minutes - patient data doesn't change often
          gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache longer
        })
      );
      
      // Use allSettled to prevent one failure from stopping others
      const results = await Promise.allSettled(promises);
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const totalTime = performance.now() - startTime;
      
      console.log(`✅ Prefetched ${successCount}/${idsToFetch.length} patients in ${totalTime.toFixed(2)}ms`);
    };
    
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => performPrefetch(), { timeout: 2000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(performPrefetch, 100);
    }
  }, [queryClient]);

  // Prefetch a single patient on hover with debounce
  const prefetchPatientOnHover = useCallback((patientId: string | null) => {
    if (!patientId) return;
    
    // Check if already cached
    const cached = queryClient.getQueryData(['patient-details-optimized', patientId]);
    if (cached) return;
    
    // Prefetch with lower priority
    queryClient.prefetchQuery({
      queryKey: ['patient-details-optimized', patientId],
      queryFn: () => fetchPatientDetailsOptimized(patientId),
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 30,
    });
  }, [queryClient]);

  // Get cached patient data if available
  const getCachedPatientData = useCallback((patientId: string) => {
    return queryClient.getQueryData(['patient-details-optimized', patientId]);
  }, [queryClient]);

  // Invalidate patient cache when needed
  const invalidatePatientCache = useCallback((patientId?: string) => {
    if (patientId) {
      queryClient.invalidateQueries({ queryKey: ['patient-details-optimized', patientId] });
    } else {
      // Invalidate all patient caches
      queryClient.invalidateQueries({ queryKey: ['patient-details-optimized'] });
    }
  }, [queryClient]);

  return {
    prefetchPatientDetails,
    prefetchPatientOnHover,
    getCachedPatientData,
    invalidatePatientCache
  };
}

// Hook to automatically prefetch patients from today's appointments
export function useAutoPatientPrefetch(appointments: any[], enabled: boolean = true) {
  const { prefetchPatientDetails } = usePatientPrefetch();

  useEffect(() => {
    if (!enabled || !appointments || appointments.length === 0) return;

    // Extract unique patient IDs
    const uniquePatientIds = Array.from(
      new Set(appointments.map(apt => apt.patient_id || apt.patient?.id).filter(Boolean))
    );

    if (uniquePatientIds.length === 0) return;

    // Sort appointments by time (earlier appointments have higher priority)
    const sortedAppointments = [...appointments].sort((a, b) => {
      const timeA = a.time || a.scheduled_time || '00:00';
      const timeB = b.time || b.scheduled_time || '00:00';
      return timeA.localeCompare(timeB);
    });

    // Get patient IDs in priority order
    const prioritizedIds = sortedAppointments
      .map(apt => apt.patient_id || apt.patient?.id)
      .filter(Boolean);

    // Remove duplicates while preserving order
    const uniquePrioritizedIds = Array.from(new Set(prioritizedIds));

    // Prefetch with priority order
    prefetchPatientDetails(uniquePrioritizedIds, {
      maxPatients: 15, // Prefetch up to 15 patients
      priority: 'time'
    });
  }, [appointments, enabled, prefetchPatientDetails]);
}