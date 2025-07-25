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

export function useTodayAppointments() {
  const { practiceId } = usePractice();
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['appointments', 'today', practiceId, todayDate],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID available');
      
      const startTime = performance.now();
      console.log('📅 Fetching today\'s appointments for practice:', practiceId);
      
      // Get all patients for this practice first
      const { data: patients, error: patientsError } = await supabase
        .from('patients')
        .select('id')
        .eq('practice_id', practiceId);
        
      if (patientsError) throw patientsError;
      
      if (!patients || patients.length === 0) {
        console.log('⚠️ No patients found for practice');
        return [];
      }
      
      const patientIds = patients.map(p => p.id);
      
      // Get today's appointments
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .in('patient_id', patientIds)
        .eq('date', todayDate)
        .order('time', { ascending: true });
        
      if (error) throw error;
      
      if (!appointments || appointments.length === 0) {
        console.log('⚠️ No appointments found for today');
        return [];
      }
      
      // Get unique patient and doctor IDs
      const uniquePatientIds = [...new Set(appointments.map(a => a.patient_id).filter(Boolean))];
      const uniqueDoctorIds = [...new Set(appointments.map(a => a.doctor_id).filter(Boolean))];
      
      // Fetch patients and doctors in parallel
      const [patientsResponse, doctorsResponse] = await Promise.all([
        uniquePatientIds.length > 0 
          ? supabase
              .from('patients')
              .select('id, first_name, last_name, email, cell_number')
              .in('id', uniquePatientIds)
          : Promise.resolve({ data: [], error: null }),
        uniqueDoctorIds.length > 0
          ? supabase
              .from('users')
              .select('id, full_name, email')
              .in('id', uniqueDoctorIds)
          : Promise.resolve({ data: [], error: null })
      ]);
      
      if (patientsResponse.error) throw patientsResponse.error;
      if (doctorsResponse.error) throw doctorsResponse.error;
      
      // Create lookup maps
      const patientsMap = new Map((patientsResponse.data || []).map(p => [p.id, p]));
      const doctorsMap = new Map((doctorsResponse.data || []).map(d => [d.id, d]));
      
      // Combine appointments with patient and doctor data
      const appointmentsWithRelations = appointments.map(appointment => ({
        ...appointment,
        patient: appointment.patient_id ? patientsMap.get(appointment.patient_id) : undefined,
        doctor: appointment.doctor_id ? doctorsMap.get(appointment.doctor_id) : undefined
      }));
      
      const queryTime = performance.now() - startTime;
      console.log(`⏱️ Today's appointments fetched in ${queryTime.toFixed(2)}ms`);
      console.log(`📊 Found ${appointments.length} appointments for today`);
      
      return appointmentsWithRelations;
    },
    enabled: !!practiceId,
    staleTime: 1000 * 60, // Consider data stale after 1 minute
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    refetchInterval: 1000 * 60 * 2, // Auto-refresh every 2 minutes
    refetchOnWindowFocus: true
  });
}

export function useAppointments(filters?: {
  date?: string;
  doctorId?: string;
  status?: string;
  patientId?: string;
}) {
  const { practiceId } = usePractice();
  
  return useQuery({
    queryKey: ['appointments', practiceId, filters],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID available');
      
      // Get all patients for this practice first
      const { data: patients, error: patientsError } = await supabase
        .from('patients')
        .select('id')
        .eq('practice_id', practiceId);
        
      if (patientsError) throw patientsError;
      
      if (!patients || patients.length === 0) {
        return [];
      }
      
      const patientIds = patients.map(p => p.id);
      
      // Build query
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients!appointments_patient_id_fkey(id, first_name, last_name, email, cell_number),
          doctor:users!appointments_doctor_id_fkey(id, full_name, email)
        `)
        .in('patient_id', patientIds);
        
      // Apply filters
      if (filters?.date) {
        query = query.eq('date', filters.date);
      }
      if (filters?.doctorId) {
        query = query.eq('doctor_id', filters.doctorId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.patientId) {
        query = query.eq('patient_id', filters.patientId);
      }
      
      // Order by date and time
      query = query.order('date', { ascending: false }).order('time', { ascending: true });
      
      const { data: appointments, error } = await query;
      
      if (error) throw error;
      
      return appointments || [];
    },
    enabled: !!practiceId,
    staleTime: 1000 * 60 * 2, // Consider data stale after 2 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });
}

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
          queryClient.invalidateQueries({ queryKey: ['appointments', practiceId] });
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId, todayDate, queryClient]);
}

import { useEffect } from 'react';