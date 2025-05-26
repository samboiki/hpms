import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show' | 'requested';
  notes?: string;
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  doctor?: {
    id: string;
    full_name: string;
  };
}

interface AppointmentsState {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  fetchAppointments: (date?: string) => Promise<void>;
  fetchAppointmentsByPatient: (patientId: string) => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  checkInAppointment: (id: string) => Promise<string | null>; // Returns visit ID if successful
  cancelAppointment: (id: string) => Promise<void>;
}

export const useAppointmentsStore = create<AppointmentsState>((set, get) => ({
  appointments: [],
  isLoading: false,
  error: null,
  
  fetchAppointments: async (date) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients!patient_id (
            id,
            first_name,
            last_name
          ),
          doctor:users!doctor_id (
            id,
            full_name
          )
        `)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      
      if (date) {
        query = query.eq('date', date);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      set({ appointments: data || [], isLoading: false });
    } catch (error) {
      console.error('Error fetching appointments:', error);
      set({ error: 'Failed to fetch appointments', isLoading: false });
    }
  },
  
  fetchAppointmentsByPatient: async (patientId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients!patient_id (
            id,
            first_name,
            last_name
          ),
          doctor:users!doctor_id (
            id,
            full_name
          )
        `)
        .eq('patient_id', patientId)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      
      if (error) throw error;
      set({ appointments: data || [], isLoading: false });
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      set({ error: 'Failed to fetch appointments', isLoading: false });
    }
  },
  
  addAppointment: async (appointment) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert([appointment])
        .select();
      
      if (error) throw error;
      
      // Refresh appointments
      await get().fetchAppointments(appointment.date);
      set({ isLoading: false });
    } catch (error) {
      console.error('Error adding appointment:', error);
      set({ error: 'Failed to add appointment', isLoading: false });
    }
  },
  
  updateAppointment: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      
      // Refresh appointments
      const currentAppointments = get().appointments;
      const updatedAppointment = currentAppointments.find(a => a.id === id);
      if (updatedAppointment) {
        await get().fetchAppointments(updates.date || updatedAppointment.date);
      } else {
        await get().fetchAppointments();
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error updating appointment:', error);
      set({ error: 'Failed to update appointment', isLoading: false });
    }
  },
  
  checkInAppointment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Get the appointment details
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .single();
      
      if (appointmentError) throw appointmentError;
      
      // Create a visit for this appointment
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .insert([{
          appointment_id: id,
          patient_id: appointmentData.patient_id,
          doctor_id: appointmentData.doctor_id,
          visit_date: appointmentData.date,
          visit_time: appointmentData.time,
          visit_type: appointmentData.type,
          status: 'in-progress'
        }])
        .select()
        .single();
      
      if (visitError) throw visitError;
      
      // Update appointment status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'in-progress' })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      // Refresh appointments
      await get().fetchAppointments(appointmentData.date);
      set({ isLoading: false });
      
      return visitData.id;
    } catch (error) {
      console.error('Error checking in appointment:', error);
      set({ error: 'Failed to check in appointment', isLoading: false });
      return null;
    }
  },
  
  cancelAppointment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Get the appointment details
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('date')
        .eq('id', id)
        .single();
      
      if (appointmentError) throw appointmentError;
      
      // Update appointment status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      // Refresh appointments
      await get().fetchAppointments(appointmentData.date);
      set({ isLoading: false });
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      set({ error: 'Failed to cancel appointment', isLoading: false });
    }
  }
}));