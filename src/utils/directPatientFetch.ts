import { supabase } from '../lib/supabase';

export interface EnhancedPatient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
  created_at?: string;
  practice_id?: string;
  practice?: {
    id: string;
    name: string;
  };
  medical_aid_details?: any[];
  visits?: any[];
  last_visit_date?: string;
  total_visits: number;
}

// DIRECT SQL APPROACH - NO NONSENSE
export async function fetchPatientsDirectly(practiceId: string): Promise<EnhancedPatient[]> {
  console.log('🚀 DIRECT FETCH: Getting patients with EVERYTHING');
  
  try {
    // Use our bulletproof RPC function
    const { data: rawPatients, error: patientsError } = await supabase
      .rpc('get_patients_with_full_data', { 
        p_practice_id: practiceId 
      });

    if (patientsError) {
      console.error('RPC error:', patientsError);
      
      // FALLBACK: Use direct queries with explicit foreign key
      const { data: patients, error } = await supabase
        .from('patients')
        .select(`
          *,
          practice:practices!fk_patients_practice_id (
            id,
            name
          ),
          medical_aid_details!left (
            *,
            medical_aid_provider:medical_aid_providers (
              id,
              name,
              logo_url
            )
          )
        `)
        .eq('practice_id', practiceId);

      if (error) throw error;

      // Now get visits for each patient
      const patientIds = patients?.map(p => p.id) || [];
      
      const { data: allVisits } = await supabase
        .from('visits')
        .select('*')
        .in('patient_id', patientIds)
        .order('visit_date', { ascending: false });

      // Combine the data
      const enhancedPatients = (patients || []).map(patient => {
        const patientVisits = (allVisits || []).filter(v => v.patient_id === patient.id);
        const completedVisits = patientVisits.filter(v => v.status === 'completed');
        const lastCompletedVisit = completedVisits[0];

        return {
          ...patient,
          practice: patient.practice,
          medical_aid_details: patient.medical_aid_details || [], // Preserve medical aid data
          visits: patientVisits,
          last_visit_date: lastCompletedVisit?.visit_date || null,
          total_visits: completedVisits.length
        };
      });

      console.log('✅ Direct fetch complete:', enhancedPatients.length, 'patients');
      return enhancedPatients;
    }

    // Transform RPC data to match our interface
    if (rawPatients) {
      const transformedPatients = rawPatients.map(patient => {
        // Parse medical aid data if it's a JSON string
        let medicalAidDetails = [];
        if (patient.medical_aid_data) {
          try {
            medicalAidDetails = typeof patient.medical_aid_data === 'string' 
              ? JSON.parse(patient.medical_aid_data) 
              : patient.medical_aid_data;
            // Ensure it's an array
            if (!Array.isArray(medicalAidDetails)) {
              medicalAidDetails = [medicalAidDetails];
            }
          } catch (e) {
            console.error('Failed to parse medical aid data:', e);
            medicalAidDetails = [];
          }
        }

        return {
          id: patient.id,
          first_name: patient.first_name,
          last_name: patient.last_name,
          email: patient.email,
          cell_number: patient.cell_number,
          date_of_birth: patient.date_of_birth,
          gender: patient.gender,
          created_at: patient.created_at,
          practice_id: patient.practice_id,
          patient_id: patient.patient_id,
          id_number: patient.id_number,
          blood_type: patient.blood_type,
          allergies: patient.allergies,
          chronic_conditions: patient.chronic_conditions,
          practice: patient.practice_name ? {
            id: patient.practice_id,
            name: patient.practice_name
          } : undefined,
          medical_aid_details: medicalAidDetails,
          last_visit_date: patient.last_visit_date,
          total_visits: Number(patient.total_visits) || 0
        };
      });
      
      console.log('✅ RPC fetch successful:', transformedPatients.length, 'patients');
      console.log('📊 Patients with visits:', transformedPatients.filter(p => p.total_visits > 0).length);
      console.log('💊 Patients with medical aid:', transformedPatients.filter(p => p.medical_aid_details && p.medical_aid_details.length > 0).length);
      if (transformedPatients[0]) {
        console.log('🏥 Sample patient:', {
          name: `${transformedPatients[0].first_name} ${transformedPatients[0].last_name}`,
          medical_aid: transformedPatients[0].medical_aid_details
        });
      }
      
      return transformedPatients;
    }
    
    return [];
  } catch (error) {
    console.error('💥 Direct fetch failed:', error);
    return [];
  }
}

// Create the RPC function if it doesn't exist
export const createPatientsFetchRPC = `
-- This function is already created in the database
-- Keeping this here for reference only
`;