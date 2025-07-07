// Appointment caching strategy to reduce API calls
import { QueryClient } from '@tanstack/react-query';

interface CacheConfig {
  staleTime: number;
  gcTime: number;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
}

// Cache configurations for different query types
export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Today's appointments - refresh more frequently
  todayAppointments: {
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 minutes
    refetchOnWindowFocus: true
  },
  
  // Historical appointments - cache longer
  historicalAppointments: {
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false
  },
  
  // Patient appointments - moderate caching
  patientAppointments: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
    refetchOnWindowFocus: false
  },
  
  // Appointment stats - cache moderately
  appointmentStats: {
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: true
  }
};

// Prefetch appointments for better perceived performance
export async function prefetchAppointments(
  queryClient: QueryClient,
  practiceId: string,
  date?: string
) {
  const startTime = performance.now();
  console.log('🔄 Prefetching appointments for date:', date || 'today');

  // Prefetch today's appointments
  await queryClient.prefetchQuery({
    queryKey: ['today-appointments', practiceId],
    queryFn: async () => {
      // This would be the actual fetch function
      return [];
    },
    staleTime: CACHE_CONFIGS.todayAppointments.staleTime
  });

  const prefetchTime = performance.now() - startTime;
  console.log(`🔄 Prefetch completed in ${prefetchTime.toFixed(2)}ms`);
}

// Smart cache invalidation
export function invalidateAppointmentCaches(
  queryClient: QueryClient,
  options: {
    practiceId?: string;
    patientId?: string;
    doctorId?: string;
    date?: string;
    invalidateAll?: boolean;
  }
) {
  console.log('🔄 Invalidating appointment caches with options:', options);

  if (options.invalidateAll) {
    // Invalidate all appointment-related queries
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['optimized-appointments'] });
    queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
    queryClient.invalidateQueries({ queryKey: ['appointment-stats'] });
    return;
  }

  // Selective invalidation based on options
  if (options.practiceId) {
    queryClient.invalidateQueries({ 
      queryKey: ['optimized-appointments', options.practiceId] 
    });
    queryClient.invalidateQueries({ 
      queryKey: ['today-appointments', options.practiceId] 
    });
  }

  if (options.patientId) {
    queryClient.invalidateQueries({ 
      queryKey: ['appointments', { patientId: options.patientId }] 
    });
  }

  if (options.date) {
    queryClient.invalidateQueries({ 
      queryKey: ['appointments', { date: options.date }] 
    });
    queryClient.invalidateQueries({ 
      queryKey: ['appointment-stats', options.practiceId, options.date] 
    });
  }
}

// Optimistic update helper
export function optimisticUpdateAppointment(
  queryClient: QueryClient,
  appointmentId: string,
  updates: Record<string, any>
) {
  console.log('🔄 Optimistic update for appointment:', appointmentId);

  // Update all queries that might contain this appointment
  queryClient.setQueriesData(
    { queryKey: ['appointments'] },
    (oldData: any) => {
      if (!oldData) return oldData;
      
      if (Array.isArray(oldData)) {
        return oldData.map((apt: any) =>
          apt.id === appointmentId ? { ...apt, ...updates } : apt
        );
      }
      
      return oldData;
    }
  );
}

// Batch query helper to reduce API calls
export class AppointmentBatchLoader {
  private batchQueue: Set<string> = new Set();
  private batchTimer: NodeJS.Timeout | null = null;
  private batchDelay = 50; // ms
  private maxBatchSize = 50;

  constructor(
    private queryClient: QueryClient,
    private fetchFunction: (ids: string[]) => Promise<any[]>
  ) {}

  async load(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batchQueue.add(id);

      if (this.batchQueue.size >= this.maxBatchSize) {
        this.executeBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.executeBatch(), this.batchDelay);
      }

      // Store resolve/reject callbacks
      const callbacks = this.queryClient.getQueryData(['batch-callbacks', id]) || [];
      callbacks.push({ resolve, reject });
      this.queryClient.setQueryData(['batch-callbacks', id], callbacks);
    });
  }

  private async executeBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const ids = Array.from(this.batchQueue);
    this.batchQueue.clear();

    if (ids.length === 0) return;

    console.log(`🔄 Batch loading ${ids.length} appointments`);
    const startTime = performance.now();

    try {
      const results = await this.fetchFunction(ids);
      const resultMap = new Map(results.map(r => [r.id, r]));

      // Resolve all promises
      ids.forEach(id => {
        const callbacks = this.queryClient.getQueryData(['batch-callbacks', id]) || [];
        const result = resultMap.get(id);
        
        callbacks.forEach(({ resolve }: any) => resolve(result));
        this.queryClient.removeQueries({ queryKey: ['batch-callbacks', id] });
      });

      const batchTime = performance.now() - startTime;
      console.log(`🔄 Batch completed in ${batchTime.toFixed(2)}ms`);
    } catch (error) {
      // Reject all promises
      ids.forEach(id => {
        const callbacks = this.queryClient.getQueryData(['batch-callbacks', id]) || [];
        callbacks.forEach(({ reject }: any) => reject(error));
        this.queryClient.removeQueries({ queryKey: ['batch-callbacks', id] });
      });
    }
  }
}