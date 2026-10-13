import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePractice } from '../contexts/PracticeContext';
import { format } from 'date-fns';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  status: string;
  type?: string;
  notes?: string;
  duration?: number;
  practice_id?: string;
  created_at?: string;
  updated_at?: string;
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    cell_number?: string;
  };
  doctor?: {
    id: string;
    full_name: string;
    email?: string;
  };
}

/**
 * Today's appointments of the practice, with each patient and practitioner. The practice is matched through the
 * appointment's patient in the same request (patients!patient_id!inner), instead of first reading every patient id of
 * the practice and putting them all in one address: past about a thousand patients that address became too long and
 * the Dashboard's appointments failed to load.
 */
export async function loadTodayAppointments(practiceId: string, todayDate: string): Promise<Appointment[]> {
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('*, patient:patients!patient_id!inner(id, first_name, last_name, email, cell_number, practice_id)')
    .eq('patient.practice_id', practiceId)
    .eq('date', todayDate)
    .order('time', { ascending: true });

  if (error) throw error;
  if (!appointments || appointments.length === 0) return [];

  // Only today's practitioners (a handful), so this list stays short
  const doctorIds = [...new Set(appointments.map(a => a.doctor_id).filter(Boolean))] as string[];
  const doctors = doctorIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', doctorIds)
    : { data: [], error: null };
  if (doctors.error) throw doctors.error;
  const doctorsMap = new Map((doctors.data || []).map(d => [d.id, d]));

  return (appointments as unknown as Appointment[]).map(appointment => ({
    ...appointment,
    doctor: appointment.doctor_id ? doctorsMap.get(appointment.doctor_id) : undefined
  }));
}

export function useTodayAppointments() {
  const { practiceId } = usePractice();
  const todayDate = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['appointments', 'today', practiceId, todayDate],
    queryFn: () => {
      if (!practiceId) throw new Error('No practice ID available');
      return loadTodayAppointments(practiceId, todayDate);
    },
    enabled: !!practiceId,
    staleTime: 1000 * 60, // Consider data stale after 1 minute
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    refetchInterval: 1000 * 60 * 2, // Auto-refresh every 2 minutes
    refetchOnWindowFocus: true
  });
}

// useAppointments (any day, with filters) read every patient id of the practice the same way; nothing used it, so it
// was removed (13 Oct 2026)

// Hook to subscribe to real-time appointment changes
export function useRealtimeAppointments() {
  const queryClient = useQueryClient();
  const { practiceId } = usePractice();
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  
  // Subscribe to real-time changes
  useEffect(() => {
    if (!practiceId) return;
    
    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `date=eq.${todayDate}`
        },
        (payload) => {
          console.log('🔄 Appointment change detected:', payload);
          
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ['appointments', 'today', practiceId, todayDate] });
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId, todayDate, queryClient]);
}

import { useEffect } from 'react';