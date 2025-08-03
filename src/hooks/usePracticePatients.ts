import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePractice } from '../contexts/PracticeContext';

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
  id_number?: string;
  practice_id: string;
  created_at?: string;
  updated_at?: string;
  medical_aid_details?: {
    id: string;
    patient_id: string;
    medical_aid_provider_id?: string;
    membership_number?: string;
    principal_member?: boolean;
    medical_aid_provider?: {
      id: string;
      name: string;
      logo_url?: string;
    };
  }[];
}

// Optimized hook with simplified query and aggressive caching
export function usePracticePatients() {
  const { practiceId } = usePractice();
  
  return useQuery({
    queryKey: ['practice-patients', practiceId],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID available');
      
      const startTime = performance.now();
      console.log('📋 Fetching practice patients...');
      
      // First, fetch just the patient data without joins
      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .eq('practice_id', practiceId)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });
        
      if (error) throw error;
      
      if (!patients || patients.length === 0) {
        const queryTime = performance.now() - startTime;
        console.log(`⏱️ Practice patients fetched in ${queryTime.toFixed(2)}ms - no patients found`);
        return [];
      }
      
      // Get unique patient IDs that have medical aid
      const patientIds = patients.map(p => p.id);
      
      // Fetch medical aid details separately (only if needed)
      const { data: medicalAidData } = await supabase
        .from('medical_aid_details')
        .select(`
          *,
          medical_aid_provider:medical_aid_providers (
            id,
            name,
            logo_url
          )
        `)
        .in('patient_id', patientIds);
      
      // Create a map of medical aid details by patient ID
      const medicalAidMap = new Map<string, typeof medicalAidData>();
      if (medicalAidData) {
        medicalAidData.forEach(mad => {
          if (!medicalAidMap.has(mad.patient_id)) {
            medicalAidMap.set(mad.patient_id, []);
          }
          medicalAidMap.get(mad.patient_id)?.push(mad);
        });
      }
      
      // Combine patients with their medical aid details
      const patientsWithMedicalAid = patients.map(patient => ({
        ...patient,
        medical_aid_details: medicalAidMap.get(patient.id) || []
      }));
      
      const queryTime = performance.now() - startTime;
      console.log(`⏱️ Practice patients fetched in ${queryTime.toFixed(2)}ms - ${patients.length} patients`);
      
      return patientsWithMedicalAid;
    },
    enabled: !!practiceId,
    staleTime: 1000 * 60 * 5, // Consider data stale after 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus - patients don't change that often
    refetchOnMount: false, // Don't refetch if we have cached data
  });
}

// Hook for searching patients with debounced search
export function useSearchPatients(searchTerm: string, debounceMs = 300) {
  const { practiceId } = usePractice();
  
  return useQuery({
    queryKey: ['search-patients', practiceId, searchTerm],
    queryFn: async () => {
      if (!practiceId) throw new Error('No practice ID available');
      if (!searchTerm || searchTerm.length < 2) return [];
      
      const startTime = performance.now();
      
      // Use Supabase's text search for better performance
      const searchPattern = `%${searchTerm}%`;
      
      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .eq('practice_id', practiceId)
        .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},cell_number.ilike.${searchPattern},email.ilike.${searchPattern}`)
        .order('last_name', { ascending: true })
        .limit(50); // Limit results for better performance
        
      if (error) throw error;
      
      const queryTime = performance.now() - startTime;
      console.log(`⏱️ Patient search completed in ${queryTime.toFixed(2)}ms - ${patients?.length || 0} results`);
      
      return patients || [];
    },
    enabled: !!practiceId && searchTerm.length >= 2,
    staleTime: 1000 * 60 * 2, // Cache search results for 2 minutes
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
  });
}