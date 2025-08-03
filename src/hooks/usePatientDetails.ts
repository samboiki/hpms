import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys, cacheConfig, queryOptimization } from '../lib/queryOptimization';

export function usePatientDetails(patientId: string) {
  return useQuery({
    queryKey: queryKeys.patientDetails(patientId),
    queryFn: async () => {
      if (!patientId) throw new Error('No patient ID provided');
      
      const startTime = performance.now();
      console.log(`🔍 Fetching details for patient ${patientId}...`);
      
      // Parallel fetch all patient data to avoid N+1 queries
      const [
        patientResult,
        nextOfKinResult,
        medicalAidResult,
        visitsResult,
        documentsResult
      ] = await Promise.all([
        // Basic patient info
        supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single(),
          
        // Next of kin
        supabase
          .from('next_of_kin')
          .select('*')
          .eq('patient_id', patientId)
          .maybeSingle(),
          
        // Medical aid details
        supabase
          .from('medical_aid_details')
          .select(`
            *,
            medical_aid_provider:medical_aid_providers (
              id,
              name,
              logo_url
            )
          `)
          .eq('patient_id', patientId)
          .maybeSingle(),
          
        // Recent visits (limit to last 10 for performance)
        supabase
          .from('visits')
          .select('*')
          .eq('patient_id', patientId)
          .order('visit_date', { ascending: false })
          .order('visit_time', { ascending: false })
          .limit(10),
          
        // Patient documents
        supabase
          .from('patient_documents')
          .select('*')
          .eq('patient_id', patientId)
          .order('uploaded_at', { ascending: false })
          .limit(20)
      ]);
      
      if (patientResult.error) throw patientResult.error;
      if (!patientResult.data) throw new Error('Patient not found');
      
      // Get visit counts efficiently
      let visitCounts = {};
      if (visitsResult.data && visitsResult.data.length > 0) {
        const visitIds = visitsResult.data.map(v => v.id);
        visitCounts = await queryOptimization.getVisitCounts(visitIds);
      }
      
      // Combine all data
      const patientDetails = {
        ...patientResult.data,
        next_of_kin: nextOfKinResult.data,
        medical_aid_details: medicalAidResult.data,
        recent_visits: visitsResult.data?.map(visit => ({
          ...visit,
          counts: visitCounts[visit.id] || { media: 0, lab: 0, imaging: 0 }
        })) || [],
        documents: documentsResult.data || []
      };
      
      const queryTime = performance.now() - startTime;
      console.log(`⏱️ Patient details fetched in ${queryTime.toFixed(2)}ms`);
      
      return patientDetails;
    },
    enabled: !!patientId,
    ...cacheConfig.mediumLived,
  });
}

// Hook for fetching all visit details for a patient
export function usePatientVisits(patientId: string) {
  return useQuery({
    queryKey: queryKeys.patientVisits(patientId),
    queryFn: async () => {
      if (!patientId) throw new Error('No patient ID provided');
      
      const startTime = performance.now();
      
      // Fetch all visits
      const { data: visits, error } = await supabase
        .from('visits')
        .select(`
          *,
          doctor:users!doctor_id (
            id,
            email,
            full_name
          )
        `)
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false });
        
      if (error) throw error;
      
      // Get counts for all visits efficiently
      let visitCounts = {};
      if (visits && visits.length > 0) {
        const visitIds = visits.map(v => v.id);
        visitCounts = await queryOptimization.getVisitCounts(visitIds);
      }
      
      // Combine visits with counts
      const visitsWithCounts = visits?.map(visit => ({
        ...visit,
        counts: visitCounts[visit.id] || { media: 0, lab: 0, imaging: 0 }
      })) || [];
      
      const queryTime = performance.now() - startTime;
      console.log(`⏱️ Patient visits fetched in ${queryTime.toFixed(2)}ms - ${visits?.length || 0} visits`);
      
      return visitsWithCounts;
    },
    enabled: !!patientId,
    ...cacheConfig.shortLived,
  });
}