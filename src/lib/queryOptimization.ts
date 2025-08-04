import { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// Query optimization utilities
export const queryOptimization = {
  // Prefetch commonly used data
  async prefetchPracticeData(queryClient: QueryClient, practiceId: string) {
    const promises = [];
    
    // Prefetch practice details
    promises.push(
      queryClient.prefetchQuery({
        queryKey: ['practice-details', practiceId],
        queryFn: async () => {
          const { data } = await supabase
            .from('practices')
            .select('id, name, logo_url, primary_color, secondary_color, slug')
            .eq('id', practiceId)
            .single();
          return data;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
      })
    );
    
    // Prefetch practice doctors
    promises.push(
      queryClient.prefetchQuery({
        queryKey: ['practice-doctors', practiceId],
        queryFn: async () => {
          const { data } = await supabase
            .from('users')
            .select('id, email, full_name, role')
            .eq('practice_id', practiceId)
            .eq('role', 'doctor');
          return data || [];
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
      })
    );
    
    await Promise.all(promises);
  },
  
  // Batch fetch related data
  async batchFetchPatientData(patientIds: string[]) {
    if (!patientIds.length) return {};
    
    const [patientsData, medicalAidData, nextOfKinData] = await Promise.all([
      supabase
        .from('patients')
        .select('*')
        .in('id', patientIds),
      supabase
        .from('medical_aid_details')
        .select('*, medical_aid_provider:medical_aid_providers(*)')
        .in('patient_id', patientIds),
      supabase
        .from('next_of_kin')
        .select('*')
        .in('patient_id', patientIds)
    ]);
    
    // Create lookup maps
    const patientsMap = new Map(patientsData.data?.map(p => [p.id, p]) || []);
    const medicalAidMap = new Map<string, any[]>();
    const nextOfKinMap = new Map<string, any>();
    
    medicalAidData.data?.forEach(mad => {
      if (!medicalAidMap.has(mad.patient_id)) {
        medicalAidMap.set(mad.patient_id, []);
      }
      medicalAidMap.get(mad.patient_id)?.push(mad);
    });
    
    nextOfKinData.data?.forEach(nok => {
      nextOfKinMap.set(nok.patient_id, nok);
    });
    
    return { patientsMap, medicalAidMap, nextOfKinMap };
  },
  
  // Optimized visit counts fetching
  async getVisitCounts(visitIds: string[]) {
    if (!visitIds.length) return {};
    
    const [mediaCount, labCount, imagingCount] = await Promise.all([
      supabase
        .from('patient_media')
        .select('visit_id', { count: 'exact' })
        .in('visit_id', visitIds),
      supabase
        .from('lab_requests')
        .select('visit_id', { count: 'exact' })
        .in('visit_id', visitIds),
      supabase
        .from('imaging_requests')
        .select('visit_id', { count: 'exact' })
        .in('visit_id', visitIds)
    ]);
    
    // Create count map
    const countsMap: Record<string, { media: number; lab: number; imaging: number }> = {};
    
    visitIds.forEach(visitId => {
      countsMap[visitId] = {
        media: mediaCount.data?.filter(m => m.visit_id === visitId).length || 0,
        lab: labCount.data?.filter(l => l.visit_id === visitId).length || 0,
        imaging: imagingCount.data?.filter(i => i.visit_id === visitId).length || 0
      };
    });
    
    return countsMap;
  }
};

// Query keys for consistency
export const queryKeys = {
  practicePatients: (practiceId: string) => ['practice-patients', practiceId],
  practiceDetails: (practiceId: string) => ['practice-details', practiceId],
  practiceDoctors: (practiceId: string) => ['practice-doctors', practiceId],
  appointments: (practiceId: string, filters?: any) => ['appointments', practiceId, filters],
  todayAppointments: (practiceId: string, date: string) => ['appointments', 'today', practiceId, date],
  patientDetails: (patientId: string) => ['patient-details', patientId],
  patientVisits: (patientId: string) => ['patient-visits', patientId],
  visitDetails: (visitId: string) => ['visit-details', visitId],
};

// Cache configuration
export const cacheConfig = {
  // Long-lived caches (30 minutes)
  longLived: {
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  },
  // Medium-lived caches (5 minutes)
  mediumLived: {
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  },
  // Short-lived caches (1 minute)
  shortLived: {
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  },
  // Real-time caches (10 seconds)
  realTime: {
    staleTime: 1000 * 10,
    gcTime: 1000 * 60,
  }
};