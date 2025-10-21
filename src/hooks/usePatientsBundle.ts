import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { usePractice } from '../contexts/PracticeContext';
import { supabase } from '../lib/supabase';

export interface PatientsDataBundle {
  patients: any[];
  patientsWithVisits: any[];
  recentPatients: any[];
  totalCount: number;
  branches: any[];
  patientSettings: any;
}

/**
 * React Query hook for fetching all patient data efficiently
 *
 * This hook uses our already optimized patientsStoreNew
 * but wraps it in React Query for better caching
 *
 * Usage:
 * ```typescript
 * const { data, isLoading, error } = usePatientsBundle();
 * ```
 */
export function usePatientsBundle() {
  const { user } = useAuthStore();
  const { practiceId } = usePractice();

  const effectivePracticeId = practiceId || user?.practice_id;

  return useQuery<PatientsDataBundle>({
    queryKey: ['patients-bundle', effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) {
        throw new Error('Practice ID required');
      }

      console.log('⚡ [usePatientsBundle] Fetching patients data bundle...');
      const startTime = performance.now();

      // Execute ALL queries in parallel
      const [
        patientsResult,
        recentPatientsResult,
        branchesResult,
        patientSettingsResult,
        countResult,
      ] = await Promise.all([
        // 1. All patients with medical aid and practice info
        supabase
          .from('patients')
          .select(`
            *,
            medical_aid_details!left (
              *,
              medical_aid_provider:medical_aid_providers (
                id, name, logo_url
              )
            ),
            practice:practices!fk_patients_practice_id (
              id, name
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .order('last_name', { ascending: true })
          .order('first_name', { ascending: true }),

        // 2. Recent patients (last 20 for dashboard)
        supabase
          .from('patients')
          .select('id, first_name, last_name, gender, date_of_birth, created_at')
          .eq('practice_id', effectivePracticeId)
          .order('created_at', { ascending: false })
          .limit(20),

        // 3. Branches for filtering
        supabase
          .from('branches')
          .select('id, name, practice_id')
          .eq('practice_id', effectivePracticeId)
          .order('name', { ascending: true }),

        // 4. Patient settings
        supabase
          .from('practice_settings')
          .select('*')
          .eq('practice_id', effectivePracticeId)
          .eq('setting_key', 'patient_settings')
          .maybeSingle(),

        // 5. Total count for pagination
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('practice_id', effectivePracticeId),
      ]);

      // Now fetch visits for all patients in a SINGLE query (not N+1!)
      const patientIds = (patientsResult.data || []).map(p => p.id);

      let patientsWithVisits = patientsResult.data || [];

      if (patientIds.length > 0) {
        const { data: allVisits } = await supabase
          .from('visits')
          .select('id, visit_date, status, patient_id')
          .in('patient_id', patientIds)
          .order('visit_date', { ascending: false });

        // Map visits to patients in memory
        patientsWithVisits = (patientsResult.data || []).map(patient => {
          const patientVisits = (allVisits || []).filter(v => v.patient_id === patient.id);
          const completedVisits = patientVisits.filter(v => v.status === 'completed');
          const lastVisit = completedVisits[0];

          return {
            ...patient,
            visits: patientVisits,
            last_visit_date: lastVisit?.visit_date || null,
            total_visits: completedVisits.length
          };
        });
      }

      const endTime = performance.now();
      console.log(`✅ [usePatientsBundle] Data fetched in ${(endTime - startTime).toFixed(2)}ms`);

      return {
        patients: patientsResult.data || [],
        patientsWithVisits,
        recentPatients: recentPatientsResult.data || [],
        totalCount: countResult.count || 0,
        branches: branchesResult.data || [],
        patientSettings: patientSettingsResult.data,
      };
    },
    enabled: !!effectivePracticeId,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });
}

/**
 * Hook for invalidating patients cache
 */
export function useInvalidatePatients() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { practiceId } = usePractice();

  return async () => {
    const effectivePracticeId = practiceId || user?.practice_id;

    if (effectivePracticeId) {
      await queryClient.invalidateQueries({
        queryKey: ['patients-bundle', effectivePracticeId]
      });
    }
  };
}