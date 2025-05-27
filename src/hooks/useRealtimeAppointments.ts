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
              const { data, error } = await supabase
                .from('appointments')
                .select(`
                  *,
                  patient:patients(*)
                `)
                .eq('id', payload.new.id)
                .single();

              if (error) throw error;

              onAppointmentChange({
                eventType: payload.eventType,
                new: data,
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