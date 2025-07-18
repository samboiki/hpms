import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface OptimizedAppointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_date: string;
  scheduled_time: string;
  visit_type: string;
  status: string;
  is_confirmed: boolean;
  is_cancelled: boolean;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
}

interface AppointmentStats {
  total_appointments: number;
  confirmed_count: number;
  pending_count: number;
  completed_count: number;
  cancelled_count: number;
  no_show_count: number;
  in_progress_count: number;
}

interface UseOptimizedAppointmentsOptions {
  date?: string;
  doctorId?: string;
  status?: string;
  limit?: number;
  offset?: number;
  useCache?: boolean;
  staleTime?: number;
}

// Hook for fetching appointments with server-side optimization
export function useOptimizedAppointments(options: UseOptimizedAppointmentsOptions = {}) {
  const { user } = useAuthStore();
  const practiceId = user?.practice_id;

  return useQuery({
    queryKey: ['optimized-appointments', practiceId, options],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID available');

      // Use the optimized database function
      const { data, error } = await supabase.rpc('get_appointments_optimized', {
        p_practice_id: practiceId,
        p_date: options.date || null,
        p_doctor_id: options.doctorId || null,
        p_status: options.status || null,
        p_limit: options.limit || 50,
        p_offset: options.offset || 0
      });

      if (error) throw error;
      return data as OptimizedAppointment[];
    },
    enabled: !!practiceId,
    staleTime: options.staleTime || 1000 * 60 * 2, // 2 minutes by default
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: options.useCache === false,
    refetchOnMount: options.useCache === false
  });
}

// Hook for fetching today's appointments using materialized view
export function useTodayAppointments() {
  const { user } = useAuthStore();
  const practiceId = user?.practice_id;

  return useQuery({
    queryKey: ['today-appointments', practiceId],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID available');

      // Query the materialized view directly for better performance
      const { data, error } = await supabase
        .from('today_visits_view')
        .select('*')
        .eq('practice_id', practiceId)
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!practiceId,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5 // Auto-refresh every 5 minutes
  });
}

// Hook for fetching appointment statistics
export function useAppointmentStats(date?: string) {
  const { user } = useAuthStore();
  const practiceId = user?.practice_id;

  return useQuery({
    queryKey: ['appointment-stats', practiceId, date],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID available');

      const { data, error } = await supabase.rpc('get_appointment_stats', {
        p_practice_id: practiceId,
        p_date: date || new Date().toISOString().split('T')[0]
      });

      if (error) throw error;
      return data[0] as AppointmentStats;
    },
    enabled: !!practiceId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10 // 10 minutes
  });
}

// Mutation to refresh the materialized view
export function useRefreshTodayView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const startTime = performance.now();
      console.log('⏱️ Refreshing today visits view...');

      const { error } = await supabase.rpc('refresh_today_visits_view');

      const refreshTime = performance.now() - startTime;
      console.log(`⏱️ View refreshed in ${refreshTime.toFixed(2)}ms`);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-stats'] });
    }
  });
}

// Hook for batch fetching appointments (reduces number of queries)
export function useBatchAppointments(patientIds: string[]) {
  const { user } = useAuthStore();
  const practiceId = user?.practice_id;

  return useQuery({
    queryKey: ['batch-appointments', practiceId, patientIds],
    queryFn: async () => {
      if (!practiceId || patientIds.length === 0) return [];

      const startTime = performance.now();
      console.log(`⏱️ useBatchAppointments: Fetching for ${patientIds.length} patients`);

      // Batch fetch appointments for multiple patients
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          doctor_id,
          date,
          time,
          type,
          status,
          patient:patients!appointments_patient_id_fkey(first_name, last_name)
        `)
        .in('patient_id', patientIds)
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(100);

      const queryTime = performance.now() - startTime;
      console.log(`⏱️ useBatchAppointments: Query completed in ${queryTime.toFixed(2)}ms, returned ${data?.length || 0} records`);

      if (error) throw error;
      return data;
    },
    enabled: !!practiceId && patientIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15 // 15 minutes
  });
}