import { supabase } from '../../lib/supabase';
import { lightningCache } from '../../lib/lightningCache';

// Ultra-optimized patient data fetching with maximum parallelization and lightning cache
export const fetchPatientDetailsOptimized = async (patientId: string) => {
  const startTime = performance.now();
  console.log(`🚀 ULTRA-OPTIMIZED fetchPatientDetails with LIGHTNING CACHE for patient: ${patientId}`);

  try {
    // 🚀 PHASE 1: Core patient data (critical path) - 3 parallel queries with caching
    const coreStartTime = performance.now();
    const [patientResult, nextOfKinResult, visitsResult] = await Promise.all([
      // Patient details with cache
      lightningCache.get(
        `patient:${patientId}:details`,
        async () => {
          const result = await supabase
            .from('patient_details_view')
            .select('*')
            .eq('id', patientId)
            .single();
          return result;
        },
        5 * 60 * 1000 // 5 minutes cache
      ),
        
      // Next of kin with cache
      lightningCache.get(
        `patient:${patientId}:nextofkin`,
        async () => {
          const result = await supabase
            .from('next_of_kin')
            .select('id, name, relationship, phone, address')
            .eq('patient_id', patientId)
            .limit(1)
            .maybeSingle();
          return result;
        },
        5 * 60 * 1000
      ),
        
      // Visits with expanded data and cache
      lightningCache.get(
        `patient:${patientId}:visits-expanded`,
        async () => {
          const result = await supabase
            .from('visits')
            .select(`
              *,
              doctor:users!doctor_id(id, full_name),
              vitals!fk_vitals_visit_id(*),
              lab_requests(id, status, request_date, lab_facility, notes),
              medications(id, medication_name, dosage, frequency, duration, prescribed_date)
            `)
            .eq('patient_id', patientId)
            .order('visit_date', { ascending: false })
            .order('visit_time', { ascending: false });
          return result;
        },
        2 * 60 * 1000 // 2 minutes cache for visits
      )
    ]);
    
    const coreTime = performance.now() - coreStartTime;
    console.log(`⚡ CORE QUERIES completed in ${coreTime.toFixed(2)}ms`);

    // Check if patient exists
    if (patientResult.error) {
      throw patientResult.error;
    }

    const visits = visitsResult.data || [];
    const visitIds = visits.map(v => v.id);
    const labRequestIds = visits.flatMap(v => v.lab_requests?.map(lr => lr.id) || []);

    // 🚀 PHASE 2: All remaining data in one massive parallel query with caching
    const secondaryStartTime = performance.now();
    console.log(`🔥 Starting MEGA PARALLEL cached queries for ${visitIds.length} visits...`);
    
    const [
      billingResult,
      documentsResult,
      labResultsResult,
      mediaResult,
      imagingResult,
      appointmentsResult,
      medicalAidResult,
      visitCountsResult,
      practiceResult
    ] = await Promise.all([
      // Billing data with cache
      lightningCache.get(
        `patient:${patientId}:billing`,
        async () => {
          const result = await supabase
            .from('invoices_enhanced')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });
          return result;
        },
        2 * 60 * 1000
      ),
        
      // Documents with cache
      lightningCache.get(
        `patient:${patientId}:documents`,
        async () => {
          const result = await supabase
            .from('patient_documents')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });
          return result;
        },
        3 * 60 * 1000
      ),
        
      // Lab results with cache
      labRequestIds.length > 0 
        ? lightningCache.get(
            `patient:${patientId}:lab-results`,
            async () => {
              const result = await supabase
                .from('lab_results')
                .select('*, lab_request_id')
                .in('lab_request_id', labRequestIds)
                .order('created_at', { ascending: false });
              return result;
            },
            2 * 60 * 1000
          )
        : Promise.resolve({ data: [], error: null }),
        
      // Media files with cache
      lightningCache.get(
        `patient:${patientId}:media`,
        async () => {
          const result = await supabase
            .from('patient_media')
            .select(`
              id, title, original_name, file_size, file_type, category, 
              storage_path, storage_bucket, created_at, visit_id,
              visit:visits!visit_id(id, visit_date, visit_number)
            `)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });
          return result;
        },
        3 * 60 * 1000
      ),
        
      // Imaging data with cache
      lightningCache.get(
        `patient:${patientId}:imaging`,
        async () => {
          const result = await supabase
            .from('patient_imaging')
            .select(`
              id, imaging_type, study_date, body_part, file_size, file_type, 
              storage_path, storage_bucket, original_name, visit_id,
              visit:visits!visit_id(id, visit_date, visit_number)
            `)
            .eq('patient_id', patientId)
            .order('study_date', { ascending: false });
          return result;
        },
        3 * 60 * 1000
      ),
        
      // Appointments
      supabase
        .from('appointments')
        .select(`
          *, 
          doctor:users!doctor_id(id, full_name),
          patient:patients!appointments_patient_id_fkey(id, first_name, last_name)
        `)
        .eq('patient_id', patientId)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false }),
        
      // Medical aid details
      supabase
        .from('medical_aid_details')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
        
      // Visit counts (batch operation)
      visitIds.length > 0
        ? supabase.rpc('get_visit_counts_batch', { visit_ids: visitIds })
        : Promise.resolve({ data: {}, error: null }),
        
      // Practice data - skip for now as it's fetched separately
      Promise.resolve({ data: null, error: null })
    ]);
    
    const secondaryTime = performance.now() - secondaryStartTime;
    console.log(`⚡ MEGA PARALLEL QUERIES completed in ${secondaryTime.toFixed(2)}ms`);

    // 🚀 PHASE 3: Process and organize data
    const processingStartTime = performance.now();

    // Extract vitals and medications from visits (already fetched)
    const vitals = visits.flatMap(visit => visit.vitals || []);
    // Each medication keeps its visit, so the Medications tab can show the visit number and date and open it
    const medications = visits.flatMap(visit => (visit.medications || []).map((medication: Record<string, unknown>) => ({
      ...medication,
      visit_id: visit.id,
      visit: { id: visit.id, visit_date: visit.visit_date, visit_number: visit.visit_number }
    })));
    // Each request keeps its visit, so the patient's lab list can show the visit and open it
    const labRequests = visits.flatMap(visit => (visit.lab_requests || []).map((request: Record<string, unknown>) => ({
      ...request,
      visit_id: visit.id,
      visit: { id: visit.id, visit_date: visit.visit_date, visit_number: visit.visit_number }
    })));

    // Visit counts processing
    const visitCounts: Record<string, any> = {};
    if (visitCountsResult.data) {
      if (Array.isArray(visitCountsResult.data)) {
        visitCountsResult.data.forEach((count: any) => {
          if (count.visit_id) {
            visitCounts[count.visit_id] = count;
          }
        });
      } else {
        Object.assign(visitCounts, visitCountsResult.data);
      }
    }

    // A section that failed to load must not look like an empty one, so callers can tell staff what is missing
    const sectionResults: Array<[string, { error: unknown } | null | undefined]> = [
      ['visits', visitsResult],
      ['next of kin', nextOfKinResult],
      ['invoices', billingResult],
      ['documents', documentsResult],
      ['lab results', labResultsResult],
      ['media', mediaResult],
      ['imaging', imagingResult],
      ['medical aid', medicalAidResult]
    ];
    const failedSections = sectionResults.filter(([, result]) => result?.error).map(([name]) => name);

    const processingTime = performance.now() - processingStartTime;
    console.log(`⚡ DATA PROCESSING completed in ${processingTime.toFixed(2)}ms`);

    const totalTime = performance.now() - startTime;
    console.log(`🎯 TOTAL ULTRA-OPTIMIZED FETCH completed in ${totalTime.toFixed(2)}ms`);
    
    if (totalTime > 1000) {
      console.warn(`⚠️ STILL SLOW: Total fetch took ${totalTime.toFixed(2)}ms`);
    } else {
      console.log(`✅ PERFORMANCE TARGET MET: ${totalTime.toFixed(2)}ms`);
    }

    return {
      patient: patientResult.data,
      nextOfKin: nextOfKinResult.data,
      visits: visits.map(visit => ({
        ...visit,
        vitals: visit.vitals || [],
        lab_requests: visit.lab_requests || [],
        medications: visit.medications || []
      })),
      visitCounts,
      appointments: appointmentsResult.data || [],
      vitals,
      labRequests,
      labResults: labResultsResult.data || [],
      medications,
      mediaRequests: mediaResult.data || [],
      imagingRequests: imagingResult.data || [],
      billingData: billingResult.data || [],
      medicalAid: medicalAidResult.data,
      practiceData: practiceResult.data,
      documents: documentsResult.data || [],
      failedSections,
      timings: {
        core: coreTime,
        secondary: secondaryTime,
        processing: processingTime,
        total: totalTime
      }
    };

  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(`❌ ULTRA-OPTIMIZED FETCH FAILED after ${totalTime.toFixed(2)}ms:`, error);
    throw error;
  }
};

// Alternative: Super-fast minimal query for initial load
export const fetchPatientDetailsMinimal = async (patientId: string) => {
  console.log(`🚀 MINIMAL fetchPatientDetails for patient: ${patientId}`);
  const startTime = performance.now();

  try {
    // Only fetch absolutely essential data
    const [patientResult, visitsResult] = await Promise.all([
      supabase
        .from('patient_details_view')
        .select('*')
        .eq('id', patientId)
        .single(),
        
      supabase
        .from('visits')
        .select('id, visit_date, visit_time, visit_number, chief_complaint, diagnosis, status, doctor:users!doctor_id(id, full_name)')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false })
        .limit(10) // Only recent visits
    ]);

    const totalTime = performance.now() - startTime;
    console.log(`⚡ MINIMAL FETCH completed in ${totalTime.toFixed(2)}ms`);

    return {
      patient: patientResult.data,
      visits: visitsResult.data || [],
      totalTime
    };

  } catch (error) {
    console.error('❌ MINIMAL FETCH FAILED:', error);
    throw error;
  }
};

// Progressive loading: Load essential data first, then enhance
export const fetchPatientDetailsProgressive = async (
  patientId: string, 
  onInitialLoad: (data: any) => void,
  onEnhancedLoad: (data: any) => void
) => {
  try {
    // Phase 1: Get essential data fast
    const minimal = await fetchPatientDetailsMinimal(patientId);
    onInitialLoad(minimal);

    // Phase 2: Get comprehensive data
    const enhanced = await fetchPatientDetailsOptimized(patientId);
    onEnhancedLoad(enhanced);

  } catch (error) {
    console.error('❌ PROGRESSIVE FETCH FAILED:', error);
    throw error;
  }
};