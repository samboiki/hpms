import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
  id_number?: string;
  address?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  occupation?: string;
  employer?: string;
  marital_status?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  created_at?: string;
  updated_at?: string;
}

interface PatientsState {
  patients: Patient[];
  isLoading: boolean;
  error: string | null;
  fetchPatients: () => Promise<void>;
  fetchPatientById: (id: string) => Promise<Patient | null>;
  addPatient: (patient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) => Promise<Patient | null>;
  updatePatient: (id: string, updates: Partial<Patient>) => Promise<void>;
  searchPatients: (searchTerm: string) => Promise<void>;
}

export const usePatientsStoreNew = create<PatientsState>((set, get) => ({
  patients: [],
  isLoading: false,
  error: null,
  
  fetchPatients: async () => {
    set({ isLoading: true, error: null });
    try {
      // Get current user's practice_id
      const user = useAuthStore.getState().user;
      if (!user?.practice_id) {
        set({ patients: [], isLoading: false });
        return;
      }

      // First, get all appointments for this practice to find patient IDs
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          patient_id,
          doctor:users!doctor_id (
            id,
            practice_id
          )
        `)
        .not('patient_id', 'is', null);

      if (appointmentsError) throw appointmentsError;

      // Filter appointments by practice
      const practiceAppointments = (appointments || []).filter(
        apt => apt.doctor?.practice_id === user.practice_id
      );

      // Get unique patient IDs
      const patientIds = [...new Set(practiceAppointments.map(apt => apt.patient_id))];

      if (patientIds.length === 0) {
        set({ patients: [], isLoading: false });
        return;
      }

      // Fetch patients
      const { data: patients, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .in('id', patientIds)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (patientsError) throw patientsError;

      set({ patients: patients || [], isLoading: false });
    } catch (error) {
      console.error('Error fetching patients:', error);
      set({ error: 'Failed to fetch patients', isLoading: false });
    }
  },

  fetchPatientById: async (id: string) => {
    try {
      const { data: patient, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return patient;
    } catch (error) {
      console.error('Error fetching patient:', error);
      return null;
    }
  },

  addPatient: async (patientData) => {
    set({ isLoading: true, error: null });
    try {
      const { data: patient, error } = await supabase
        .from('patients')
        .insert([{
          ...patientData,
          country: patientData.country || 'Namibia'
        }])
        .select()
        .single();

      if (error) throw error;

      // Refresh patients list
      await get().fetchPatients();
      
      return patient;
    } catch (error) {
      console.error('Error adding patient:', error);
      set({ error: 'Failed to add patient', isLoading: false });
      return null;
    }
  },

  updatePatient: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Refresh patients list
      await get().fetchPatients();
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error updating patient:', error);
      set({ error: 'Failed to update patient', isLoading: false });
    }
  },

  searchPatients: async (searchTerm) => {
    set({ isLoading: true, error: null });
    try {
      // Get current user's practice_id
      const user = useAuthStore.getState().user;
      if (!user?.practice_id) {
        set({ patients: [], isLoading: false });
        return;
      }

      // Search patients
      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cell_number.ilike.%${searchTerm}%`)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (error) throw error;

      // Filter to only show patients who have appointments at this practice
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          patient_id,
          doctor:users!doctor_id (
            id,
            practice_id
          )
        `)
        .in('patient_id', patients?.map(p => p.id) || []);

      if (appointmentsError) throw appointmentsError;

      // Filter appointments by practice
      const practiceAppointments = (appointments || []).filter(
        apt => apt.doctor?.practice_id === user.practice_id
      );

      // Get patient IDs that belong to this practice
      const practicePatientIds = [...new Set(practiceAppointments.map(apt => apt.patient_id))];

      // Filter patients
      const practicePatients = (patients || []).filter(p => practicePatientIds.includes(p.id));

      set({ patients: practicePatients, isLoading: false });
    } catch (error) {
      console.error('Error searching patients:', error);
      set({ error: 'Failed to search patients', isLoading: false });
    }
  }
}));