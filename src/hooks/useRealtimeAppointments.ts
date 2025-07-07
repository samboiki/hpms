import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface AppointmentChange {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
}

interface UseRealtimeAppointmentsProps {
  practiceId: string | null;
  onAppointmentChange: (change: AppointmentChange) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeAppointments({
  practiceId,
  onAppointmentChange,
  onError
}: UseRealtimeAppointmentsProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!practiceId) return;

    console.log('🔌 Setting up real-time subscription for practice:', practiceId);

    // Subscribe to appointment changes for this practice
    const channel = supabase
      .channel(`appointments:practice_id=eq.${practiceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `practice_id=eq.${practiceId}`
        },
        async (payload) => {
          console.log('🔔 Real-time appointment change:', payload);
          
          // For INSERT and UPDATE, we need to fetch the full appointment data with patient info
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            try {
              // Get appointment data first
              const { data: appointmentData, error: appointmentError } = await supabase
                .from('appointments')
                .select('*')
                .eq('id', payload.new.id)
                .single();

              if (appointmentError) throw appointmentError;

              // Get patient data separately if patient_id exists
              let patientData = null;
              if (appointmentData.patient_id) {
                const { data: patient, error: patientError } = await supabase
                  .from('patients')
                  .select('id, first_name, last_name, cell_number, date_of_birth, gender')
                  .eq('id', appointmentData.patient_id)
                  .single();

                if (!patientError) {
                  patientData = patient;
                }
              }

              // Get doctor data separately if doctor_id exists
              let doctorData = null;
              if (appointmentData.doctor_id) {
                const { data: doctor, error: doctorError } = await supabase
                  .from('users')
                  .select('id, full_name')
                  .eq('id', appointmentData.doctor_id)
                  .single();

                if (!doctorError) {
                  doctorData = doctor;
                }
              }

              // Combine data
              const enrichedAppointment = {
                ...appointmentData,
                patient: patientData,
                doctor: doctorData
              };

              onAppointmentChange({
                eventType: payload.eventType,
                new: enrichedAppointment,
                old: payload.old
              });
            } catch (error) {
              console.error('Error fetching appointment details:', error);
              if (onError) onError(error as Error);
            }
          } else {
            // For DELETE, we just pass the payload as is
            onAppointmentChange({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active');
        }
      });

    channelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      console.log('🔌 Cleaning up real-time subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [practiceId, onAppointmentChange, onError]);

  // Function to manually trigger a refresh (useful for testing)
  const refresh = async () => {
    if (!practiceId) return;
    
    console.log('🔄 Manual refresh triggered');
    // This will trigger the subscription to re-fetch data
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      await channelRef.current.subscribe();
    }
  };

  return { refresh };
}

// Hook for real-time appointment stats
export function useRealtimeAppointmentStats(practiceId: string | null) {
  const statsRef = useRef<{
    pending: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }>({
    pending: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0
  });

  useEffect(() => {
    if (!practiceId) return;

    const channel = supabase
      .channel(`appointment-stats:${practiceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `practice_id=eq.${practiceId}`
        },
        (payload) => {
          // Update stats based on the change
          if (payload.eventType === 'INSERT') {
            statsRef.current[payload.new.status as keyof typeof statsRef.current]++;
          } else if (payload.eventType === 'UPDATE') {
            if (payload.old.status !== payload.new.status) {
              statsRef.current[payload.old.status as keyof typeof statsRef.current]--;
              statsRef.current[payload.new.status as keyof typeof statsRef.current]++;
            }
          } else if (payload.eventType === 'DELETE') {
            statsRef.current[payload.old.status as keyof typeof statsRef.current]--;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId]);

  return statsRef.current;
}