import { create } from 'zustand';
import { format } from 'date-fns';
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
  /** The account number in Eminance, for patients brought over from it (proposals/2026-10-07-eminance-import.sql) */
  legacy_account_number?: string | null;
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
  visits?: { id: string; visit_date: string | null; status: string | null; branch_id: string | null }[];
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
      // (No visit-count "pre-warm" here: lib/lightningCache.ts keeps nothing, so those 10 requests were thrown away)
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

      // Fetch visits in batches of 100 patients (paged by 1000 rows) instead of one query per patient
      type VisitSummary = { id: string; patient_id: string; visit_date: string | null; status: string | null; branch_id: string | null };
      const PATIENTS_PER_QUERY = 100;
      const ROWS_PER_PAGE = 1000;
      const fetchVisitsFor = async (ids: string[]): Promise<VisitSummary[]> => {
        const rows: VisitSummary[] = [];
        for (let from = 0; ; from += ROWS_PER_PAGE) {
          const { data, error: visitsError } = await supabase
            .from('visits')
            .select('id, patient_id, visit_date, status, branch_id')
            .in('patient_id', ids)
            .order('visit_date', { ascending: false })
            .range(from, from + ROWS_PER_PAGE - 1);
          if (visitsError) throw visitsError;
          rows.push(...((data || []) as VisitSummary[]));
          if (!data || data.length < ROWS_PER_PAGE) return rows;
        }
      };

      const patientIds = (patientsWithData || []).map((patient) => patient.id);
      const idChunks: string[][] = [];
      for (let i = 0; i < patientIds.length; i += PATIENTS_PER_QUERY) {
        idChunks.push(patientIds.slice(i, i + PATIENTS_PER_QUERY));
      }
      const visitPages = await Promise.all(
        idChunks.map((ids) =>
          fetchVisitsFor(ids).catch((err) => {
            console.error('❌ Error fetching visits for a batch of patients:', err);
            return [] as VisitSummary[];
          })
        )
      );

      const visitsByPatient = new Map<string, VisitSummary[]>();
      visitPages.flat().forEach((visit) => {
        const list = visitsByPatient.get(visit.patient_id) || [];
        list.push(visit);
        visitsByPatient.set(visit.patient_id, list);
      });

      // A visit counts once it has taken place: dated today or earlier and not cancelled or a no-show.
      // (Counting only 'completed' showed "0 visits" because visits were never marked complete.)
      // Local calendar date (toISOString is UTC, still yesterday before 02:00 in Namibia)
      const today = format(new Date(), 'yyyy-MM-dd');
      const NOT_ATTENDED = ['cancelled', 'no-show', 'no_show'];
      const patientsWithVisits = (patientsWithData || []).map((patient) => {
        const visits = visitsByPatient.get(patient.id) || [];
        const attended = visits.filter(
          (v) => !!v.visit_date && v.visit_date.slice(0, 10) <= today && !NOT_ATTENDED.includes(v.status || '')
        );
        return {
          ...patient,
          visits,
          last_visit_date: attended[0]?.visit_date || null,
          total_visits: attended.length
        };
      });
      
      console.log('✅ [PatientsStore] Successfully processed all patients with visits');
      console.log('📊 Patients with visits:', patientsWithVisits.filter(p => p.total_visits > 0).length);
      
      set({ patients: patientsWithVisits, isLoading: false });
    } catch (error) {
      console.error('❌ [PatientsStore] Critical error:', error);
      
      // FALLBACK: Just get patients without visits
      try {
        // Keep the practice filter on the fallback too, so a failure never widens which patients are listed
        const fallbackContext = await practiceDataService.getAuthContext();
        if (!fallbackContext?.practiceId) {
          set({ patients: [], isLoading: false, error: 'Failed to fetch patients' });
          return;
        }
        const { data: fallbackPatients, error: fallbackError } = await supabase
          .from('patients')
          .select('*')
          .eq('practice_id', fallbackContext.practiceId)
          .order('last_name', { ascending: true });
        // An unread error here showed "No patients found" instead of saying the list failed to load
        if (fallbackError) throw fallbackError;

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