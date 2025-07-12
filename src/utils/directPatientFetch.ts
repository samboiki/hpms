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
      
      // FALLBACK: Use direct queries
      const { data: patients, error } = await supabase
        .from('patients')
        .select(`
          *,
          practices!practice_id (
            id,
            name
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
          practice: patient.practices,
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
      const transformedPatients = rawPatients.map(patient => ({
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
        blood_type: patient.blood_type,
        allergies: patient.allergies,
        chronic_conditions: patient.chronic_conditions,
        practice: patient.practice_name ? {
          id: patient.practice_id,
          name: patient.practice_name
        } : undefined,
        medical_aid_details: patient.medical_aid_data || [],
        last_visit_date: patient.last_visit_date,
        total_visits: Number(patient.total_visits) || 0
      }));
      
      console.log('✅ RPC fetch successful:', transformedPatients.length, 'patients');
      console.log('📊 Patients with visits:', transformedPatients.filter(p => p.total_visits > 0));
      console.log('🏥 Sample patient:', transformedPatients[0]);
      
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
CREATE OR REPLACE FUNCTION get_patients_with_full_data(p_practice_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text,
  cell_number text,
  date_of_birth date,
  gender text,
  created_at timestamptz,
  practice_id uuid,
  practice_name text,
  last_visit_date date,
  total_visits bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.cell_number,
    p.date_of_birth,
    p.gender,
    p.created_at,
    p.practice_id,
    pr.name as practice_name,
    MAX(v.visit_date) as last_visit_date,
    COUNT(CASE WHEN v.status = 'completed' THEN 1 END) as total_visits
  FROM patients p
  LEFT JOIN practices pr ON pr.id = p.practice_id
  LEFT JOIN visits v ON v.patient_id = p.id
  WHERE p.practice_id = p_practice_id
  GROUP BY p.id, pr.name
  ORDER BY p.last_name, p.first_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;