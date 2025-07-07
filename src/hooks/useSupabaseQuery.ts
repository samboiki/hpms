import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Tables, Insertable, Updatable } from '../types/database.types';

// ============= PATIENTS HOOKS =============

export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (patient: Insertable<'patients'>) => {
      const { data, error } = await supabase
        .from('patients')
        .insert(patient)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    }
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Updatable<'patients'> }) => {
      const { data, error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients', data.id] });
    }
  });
}

// ============= APPOINTMENTS HOOKS =============

export function useAppointments(filters?: {
  date?: string;
  doctorId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['appointments', filters],
    queryFn: async () => {
      const startTime = performance.now();
      console.log('⏱️ useAppointments: Starting query with filters:', filters);
      
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(id, first_name, last_name, cell_number),
          doctor:users!appointments_doctor_id_fkey(id, email, full_name)
        `)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });
      
      if (filters?.date) {
        query = query.eq('appointment_date', filters.date);
      }
      if (filters?.doctorId) {
        query = query.eq('doctor_id', filters.doctorId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      
      const queryTime = performance.now() - startTime;
      console.log(`⏱️ useAppointments: Query completed in ${queryTime.toFixed(2)}ms, returned ${data?.length || 0} records`);
      
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (appointment: Insertable<'appointments'>) => {
      const { data, error } = await supabase
        .from('appointments')
        .insert(appointment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  });
}

// ============= VISITS HOOKS =============

export function useVisits(patientId?: string) {
  return useQuery({
    queryKey: ['visits', patientId],
    queryFn: async () => {
      let query = supabase
        .from('visits')
        .select(`
          *,
          patient:patients(id, first_name, last_name),
          doctor:users!visits_doctor_id_fkey(id, email, full_name),
          vitals(*)
        `)
        .order('visit_date', { ascending: false });
      
      if (patientId) {
        query = query.eq('patient_id', patientId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    }
  });
}

// ============= REAL-TIME SUBSCRIPTIONS =============

export function useRealtimeAppointments(
  callback: (payload: any) => void,
  filters?: { date?: string; doctorId?: string }
) {
  useEffect(() => {
    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: filters?.doctorId ? `doctor_id=eq.${filters.doctorId}` : undefined
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [callback, filters]);
}

// ============= TYPE-SAFE QUERIES =============

export function useTypedQuery<T extends keyof Database['public']['Tables']>(
  table: T,
  options?: {
    select?: string;
    filters?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
  }
) {
  return useQuery({
    queryKey: [table, options],
    queryFn: async () => {
      let query = supabase.from(table).select(options?.select || '*');
      
      // Apply filters
      if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      
      // Apply ordering
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true
        });
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Tables<T>[];
    }
  });
}

// ============= SCHEMA INTROSPECTION =============

export function useDatabaseSchema() {
  return useQuery({
    queryKey: ['database-schema'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_database_schema');
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });
}

export function useTableSchema(tableName: string) {
  return useQuery({
    queryKey: ['table-schema', tableName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_table_schema', {
        table_name: tableName
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tableName
  });
}

import { useEffect } from 'react';
import { Database } from '../types/database.types';