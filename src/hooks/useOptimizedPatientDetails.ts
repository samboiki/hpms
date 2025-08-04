import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { lightningCache } from '../lib/lightningCache';

interface UseOptimizedPatientDetailsOptions {
  onVisitsFetched?: (visits: any[]) => void;
}

export const useOptimizedPatientDetails = (options?: UseOptimizedPatientDetailsOptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatientDetails = useCallback(async (patientId: string) => {
    const startTime = performance.now();
    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 [OPTIMIZED] Starting lightning-fast patient details fetch...');

      // Fetch all data in parallel using lightning cache
      const [
        patientData,
        visitsData,
        medicationsData,
        mediaData,
        labData,
        imagingData,
        documentsData,
        billingData
      ] = await Promise.all([
        // Patient details with cache
        lightningCache.get(
          `patient:${patientId}:details`,
          async () => {
            const { data, error } = await supabase
              .from('patients')
              .select('*')
              .eq('id', patientId)
              .single();
            if (error) throw error;
            return data;
          },
          5 * 60 * 1000 // 5 minutes cache
        ),

        // Visits with cache
        lightningCache.get(
          `patient:${patientId}:visits`,
          async () => {
            const { data, error } = await supabase
              .from('visits')
              .select(`
                *,
                branch:branches!visits_branch_id_fkey(id, name, address),
                doctor:users!visits_doctor_id_fkey(id, full_name, role),
                assigned_to:users!visits_assigned_to_fkey(id, full_name, role)
              `)
              .eq('patient_id', patientId)
              .order('visit_date', { ascending: false })
              .order('visit_time', { ascending: false });
            if (error) throw error;
            return data || [];
          },
          2 * 60 * 1000 // 2 minutes cache
        ),

        // Medications with visit info
        lightningCache.get(
          `patient:${patientId}:medications`,
          async () => {
            const { data, error } = await supabase
              .from('medications')
              .select(`
                id, medication_name, dosage, frequency, duration, prescribed_date, visit_id,
                visit:visits!visit_id(id, visit_date, visit_number)
              `)
              .eq('patient_id', patientId)
              .order('prescribed_date', { ascending: false });
            if (error) throw error;
            return data || [];
          },
          3 * 60 * 1000 // 3 minutes cache
        ),

        // Media files
        lightningCache.get(
          `patient:${patientId}:media`,
          async () => {
            const { data, error } = await supabase
              .from('patient_media')
              .select(`
                id, title, original_name, file_size, file_type, category, storage_path, storage_bucket, created_at, visit_id,
                visit:visits!visit_id(id, visit_date, visit_number)
              `)
              .eq('patient_id', patientId)
              .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
          },
          3 * 60 * 1000
        ),

        // Lab data
        lightningCache.get(
          `patient:${patientId}:laboratory`,
          async () => {
            const { data, error } = await supabase
              .from('patient_laboratory')
              .select(`
                id, test_type, test_date, lab_name, status, is_abnormal, critical_result, visit_id,
                visit:visits!visit_id(id, visit_date, visit_number)
              `)
              .eq('patient_id', patientId)
              .order('test_date', { ascending: false });
            if (error) throw error;
            return data || [];
          },
          3 * 60 * 1000
        ),

        // Imaging data
        lightningCache.get(
          `patient:${patientId}:imaging`,
          async () => {
            const { data, error } = await supabase
              .from('patient_imaging')
              .select(`
                id, imaging_type, study_date, body_part, file_size, file_type, storage_path, storage_bucket, original_name, visit_id,
                visit:visits!visit_id(id, visit_date, visit_number)
              `)
              .eq('patient_id', patientId)
              .order('study_date', { ascending: false });
            if (error) throw error;
            return data || [];
          },
          3 * 60 * 1000
        ),

        // Documents
        lightningCache.get(
          `patient:${patientId}:documents`,
          async () => {
            const { data, error } = await supabase
              .from('patient_documents')
              .select('*')
              .eq('patient_id', patientId)
              .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
          },
          3 * 60 * 1000
        ),

        // Billing data
        lightningCache.get(
          `patient:${patientId}:billing`,
          async () => {
            const { data, error } = await supabase
              .from('invoices_enhanced')
              .select('*')
              .eq('patient_id', patientId)
              .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
          },
          2 * 60 * 1000
        )
      ]);

      // If we have visits, fetch related data in parallel
      let vitalsData = [];
      let labRequestsData = [];
      let imagingRequestsData = [];
      let labResultsData = [];

      if (visitsData.length > 0) {
        const visitIds = visitsData.map(v => v.id);
        
        // Notify about visits if callback provided
        if (options?.onVisitsFetched) {
          options.onVisitsFetched(visitsData);
        }

        const relatedResults = await Promise.all([
          // Vitals
          lightningCache.get(
            `patient:${patientId}:vitals`,
            async () => {
              const { data, error } = await supabase
                .from('vitals')
                .select('*')
                .in('visit_id', visitIds)
                .order('recorded_at', { ascending: false });
              if (error) throw error;
              return data || [];
            },
            2 * 60 * 1000
          ),

          // Lab requests
          lightningCache.get(
            `patient:${patientId}:lab-requests`,
            async () => {
              const { data, error } = await supabase
                .from('lab_requests')
                .select('*')
                .in('visit_id', visitIds)
                .order('created_at', { ascending: false });
              if (error) throw error;
              return data || [];
            },
            2 * 60 * 1000
          ),

          // Imaging requests
          lightningCache.get(
            `patient:${patientId}:imaging-requests`,
            async () => {
              const { data, error } = await supabase
                .from('imaging_requests')
                .select('*')
                .in('visit_id', visitIds)
                .order('created_at', { ascending: false });
              if (error) throw error;
              return data || [];
            },
            2 * 60 * 1000
          )
        ]);

        [vitalsData, labRequestsData, imagingRequestsData] = relatedResults;

        // Lab results (if we have lab requests)
        if (labRequestsData.length > 0) {
          const labRequestIds = labRequestsData.map(req => req.id);
          labResultsData = await lightningCache.get(
            `patient:${patientId}:lab-results`,
            async () => {
              const { data, error } = await supabase
                .from('lab_results')
                .select('*, lab_request_id')
                .in('lab_request_id', labRequestIds)
                .order('created_at', { ascending: false });
              if (error) throw error;
              return data || [];
            },
            2 * 60 * 1000
          );
        }
      }

      const totalTime = performance.now() - startTime;
      console.log(`⚡ [OPTIMIZED] Total fetch time: ${totalTime.toFixed(2)}ms`);
      
      if (totalTime < 100) {
        console.log('🚀 LIGHTNING FAST: All data served from cache!');
      } else if (totalTime < 500) {
        console.log('✅ FAST: Partial cache hit with minimal queries');
      }

      return {
        patient: patientData,
        visits: visitsData,
        medications: medicationsData,
        media: mediaData,
        laboratory: labData,
        imaging: imagingData,
        documents: documentsData,
        billing: billingData,
        vitals: vitalsData,
        labRequests: labRequestsData,
        imagingRequests: imagingRequestsData,
        labResults: labResultsData
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch patient details';
      console.error('Error in optimized patient fetch:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  // Method to invalidate patient cache when data changes
  const invalidatePatientCache = useCallback((patientId: string) => {
    lightningCache.invalidatePattern(`patient:${patientId}:`);
  }, []);

  return {
    fetchPatientDetails,
    invalidatePatientCache,
    isLoading,
    error
  };
};