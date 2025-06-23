import { supabase } from '../../lib/supabase';

// Ultra-optimized patient data fetching with maximum parallelization
export const fetchPatientDetailsOptimized = async (patientId: string) => {
  const startTime = performance.now();
  console.log(`🚀 ULTRA-OPTIMIZED fetchPatientDetails for patient: ${patientId}`);

  try {
    // 🚀 PHASE 1: Core patient data (critical path) - 3 parallel queries
    const coreStartTime = performance.now();
    const [patientResult, nextOfKinResult, visitsResult] = await Promise.all([
      // Patient details
      supabase
        .from('patient_details_view')
        .select('*')
        .eq('id', patientId)
        .single(),
        
      // Next of kin
      supabase
        .from('next_of_kin')
        .select('id, first_name, last_name, relationship, phone_number, email')
        .eq('patient_id', patientId)
        .limit(1)
        .maybeSingle(),
        
      // Visits with expanded data to reduce future queries
      supabase
        .from('visits')
        .select(`
          *,
          doctor:users!doctor_id(id, full_name),
          vitals(*),
          lab_requests(id, test_name, status, urgency, expected_results_date),
          medications(id, medication_name, dosage, frequency, duration, prescribed_date)
        `)
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false })
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

    // 🚀 PHASE 2: All remaining data in one massive parallel query (9 queries at once)
    const secondaryStartTime = performance.now();
    console.log(`🔥 Starting MEGA PARALLEL queries for ${visitIds.length} visits...`);
    
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
      // Billing data
      supabase
        .from('invoices_enhanced')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
        
      // Documents
      supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
        
      // Lab results (if we have lab requests)
      labRequestIds.length > 0 
        ? supabase
            .from('lab_results')
            .select('*, lab_request_id')
            .in('lab_request_id', labRequestIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
        
      // Media files
      supabase
        .from('patient_media')
        .select(`
          id, title, original_name, file_size, file_type, category, 
          storage_path, storage_bucket, created_at, visit_id,
          visit:visits!visit_id(id, visit_date, visit_number)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
        
      // Imaging data
      supabase
        .from('patient_imaging')
        .select(`
          id, imaging_type, study_date, body_part, file_size, file_type, 
          storage_path, storage_bucket, original_name, visit_id,
          visit:visits!visit_id(id, visit_date, visit_number)
        `)
        .eq('patient_id', patientId)
        .order('study_date', { ascending: false }),
        
      // Appointments
      supabase
        .from('appointments')
        .select(`
          *, 
          doctor:users!doctor_id(id, full_name),
          patient:patients!patient_id(id, first_name, last_name)
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
    const medications = visits.flatMap(visit => visit.medications || []);
    const labRequests = visits.flatMap(visit => visit.lab_requests || []);

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