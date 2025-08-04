import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { practiceDataService } from '../lib/practiceDataService';
import { comprehensiveSearch } from '../utils/searchUtils';
import { fetchPatientsDirectly } from '../utils/directPatientFetch';
import { 
  getCachedPatients, 
  searchCachedPatients, 
  getCachedPracticeOverview,
  invalidatePatientCache,
  warmUpCache 
} from '../lib/cachedQueries';
import { lightning, lightningCache } from '../lib/lightningCache';

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
  home_language?: string;
  home_address?: string;
  postal_address?: string;
  created_at?: string;
  updated_at?: string;
  practice_id?: string;
  branch_id?: string;
  medical_aid_details?: {
    id?: string;
    provider: string;
    scheme?: string;
    membership_number: string;
    plan_type?: string;
    main_member_name?: string;
    main_member_id_number?: string;
    relationship_to_main?: string;
    medical_aid_provider?: {
      id: string;
      name: string;
      logo_url?: string;
    };
  }[];
  // Added fields for enhanced data
  last_visit_date?: string;
  total_visits?: number;
  practice?: {
    id: string;
    name: string;
  };
}

interface PatientsState {
  patients: Patient[];
  isLoading: boolean;
  error: string | null;
  fetchPatients: () => Promise<void>;
  fetchPatientsWithVisits: () => Promise<void>;
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
    const startTime = performance.now();
    
    try {
      console.log('⚡ [PatientsStore] Using LIGHTNING CACHE for instant loading...');
      
      // Get practice ID from auth context
      const authContext = await practiceDataService.getAuthContext();
      if (!authContext?.practiceId) {
        throw new Error('No practice context found');
      }
      
      // Use lightning cache for instant results
      const patients = await lightning.getPatients(authContext.practiceId);
      
      const loadTime = performance.now() - startTime;
      console.log(`⚡ [PatientsStore] LIGHTNING LOADED: ${patients.length} patients in ${loadTime.toFixed(2)}ms`);
      
      if (loadTime < 50) {
        console.log('🚀 LIGHTNING SPEED ACHIEVED!');
      }
      
      set({ patients, isLoading: false });
      
      // Pre-warm visit counts for visible patients
      setTimeout(() => {
        patients.slice(0, 10).forEach(patient => {
          lightning.getVisitCount(patient.id).catch(() => {});
        });
      }, 100);
    } catch (error) {
      console.error('❌ [PatientsStore] Error fetching patients:', error);
      set({ error: 'Failed to fetch patients', isLoading: false });
    }
  },
  
  fetchPatientsWithVisits: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('🔄 [PatientsStore] Starting ENHANCED fetchPatientsWithVisits');
      
      // Get authenticated user context
      const authContext = await practiceDataService.getAuthContext();
      if (!authContext?.practiceId) {
        console.error('❌ [PatientsStore] No practice ID found in auth context');
        set({ patients: [], isLoading: false, error: 'No practice context found' });
        return;
      }

      // APPROACH 1: Try the standard Supabase query first
      const { data: patientsWithData, error } = await supabase
        .from('patients')
        .select(`
          *,
          medical_aid_details!left (
            *,
            medical_aid_provider:medical_aid_providers (
              id,
              name,
              logo_url
            )
          ),
          practice:practices!fk_patients_practice_id (
            id,
            name
          )
        `)
        .eq('practice_id', authContext?.practiceId)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (error) {
        console.error('❌ Initial query error:', error);
        throw error;
      }

      console.log('📊 Fetched patients:', patientsWithData?.length);

      // APPROACH 2: Fetch visits separately for each patient
      const patientsWithVisits = await Promise.all(
        (patientsWithData || []).map(async (patient) => {
          try {
            // Get visits for this specific patient
            const { data: visits, error: visitsError } = await supabase
              .from('visits')
              .select('id, visit_date, status')
              .eq('patient_id', patient.id)
              .order('visit_date', { ascending: false });

            if (visitsError) {
              console.error(`❌ Error fetching visits for ${patient.first_name}:`, visitsError);
              return { ...patient, visits: [], last_visit_date: null, total_visits: 0 };
            }

            // Calculate visit statistics
            const completedVisits = (visits || []).filter(v => v.status === 'completed');
            const lastVisit = completedVisits[0];

            // Debug specific patients
            if (patient.first_name === 'Mirjam' || patient.first_name === 'Imms') {
              console.log(`🔍 ${patient.first_name} ${patient.last_name} visits:`, visits);
            }

            return {
              ...patient,
              visits: visits || [],
              last_visit_date: lastVisit?.visit_date || null,
              total_visits: completedVisits.length
            };
          } catch (err) {
            console.error(`Error processing patient ${patient.id}:`, err);
            return { ...patient, visits: [], last_visit_date: null, total_visits: 0 };
          }
        })
      );
      
      console.log('✅ [PatientsStore] Successfully processed all patients with visits');
      console.log('📊 Patients with visits:', patientsWithVisits.filter(p => p.total_visits > 0).length);
      
      set({ patients: patientsWithVisits, isLoading: false });
    } catch (error) {
      console.error('❌ [PatientsStore] Critical error:', error);
      
      // FALLBACK: Just get patients without visits
      try {
        const { data: fallbackPatients } = await supabase
          .from('patients')
          .select('*')
          .order('last_name', { ascending: true });
          
        set({ patients: fallbackPatients || [], isLoading: false });
      } catch (fallbackError) {
        console.error('❌ Even fallback failed:', fallbackError);
        set({ error: 'Failed to fetch patients', isLoading: false });
      }
    }
  },

  fetchPatientById: async (id: string) => {
    try {
      // Get authenticated user context to ensure we only fetch patients from the user's practice
      const authContext = await practiceDataService.getAuthContext();
      if (!authContext?.practiceId) {
        console.error('❌ [PatientsStore] No practice ID found in auth context');
        return null;
      }

      const { data: patient, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .eq('practice_id', authContext.practiceId) // CRITICAL: Ensure patient belongs to user's practice
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.error('❌ Patient not found or not in user\'s practice');
        } else {
          console.error('❌ Error fetching patient:', error);
        }
        throw error;
      }
      
      return patient;
    } catch (error) {
      console.error('Error fetching patient:', error);
      return null;
    }
  },

  addPatient: async (patientData) => {
    set({ isLoading: true, error: null });
    try {
      // Get authenticated user context to ensure we add patients to the correct practice
      const authContext = await practiceDataService.getAuthContext();
      if (!authContext?.practiceId) {
        console.error('❌ [PatientsStore] No practice ID found in auth context');
        set({ error: 'No practice context found', isLoading: false });
        return null;
      }

      const { data: patient, error } = await supabase
        .from('patients')
        .insert([{
          ...patientData,
          practice_id: authContext.practiceId, // CRITICAL: Always set the practice ID
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
      // Get authenticated user context to ensure we only update patients in the user's practice
      const authContext = await practiceDataService.getAuthContext();
      if (!authContext?.practiceId) {
        console.error('❌ [PatientsStore] No practice ID found in auth context');
        set({ error: 'No practice context found', isLoading: false });
        return;
      }

      // CRITICAL: Never allow updating the practice_id field
      const { practice_id, ...safeUpdates } = updates;
      if (practice_id) {
        console.warn('⚠️ Attempted to update practice_id - this is not allowed');
      }

      const { error } = await supabase
        .from('patients')
        .update(safeUpdates)
        .eq('id', id)
        .eq('practice_id', authContext.practiceId); // CRITICAL: Ensure patient belongs to user's practice

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
    const startTime = performance.now();
    
    try {
      console.log('🔍 [PatientsStore] Using CACHED search for instant results...');
      
      // Use cached search for instant results
      const filteredPatients = await searchCachedPatients(searchTerm);
      
      const searchTime = performance.now() - startTime;
      console.log(`⚡ [PatientsStore] CACHED SEARCH: ${filteredPatients.length} results in ${searchTime.toFixed(2)}ms`);
      
      // Sort by relevance and then by name
      filteredPatients.sort((a, b) => {
        const lastNameCompare = (a.last_name || '').localeCompare(b.last_name || '');
        if (lastNameCompare !== 0) return lastNameCompare;
        return (a.first_name || '').localeCompare(b.first_name || '');
      });

      set({ patients: filteredPatients, isLoading: false });
    } catch (error) {
      console.error('Error searching patients:', error);
      set({ error: 'Failed to search patients', isLoading: false });
    }
  }
}));