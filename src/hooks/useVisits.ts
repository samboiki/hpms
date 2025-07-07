import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useVisits(patientId: string) {
  return useQuery({
    queryKey: ['visits', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select(`
          *,
          doctor:users!doctor_id (
            id,
            email,
            full_name,
            role
          ),
          vitals (
            id,
            blood_pressure_systolic,
            blood_pressure_diastolic,
            heart_rate,
            temperature,
            respiratory_rate,
            oxygen_saturation,
            weight,
            height,
            bmi
          ),
          lab_requests (
            id,
            test_name,
            status
          ),
          prescriptions:medical_records (
            id,
            prescriptions
          )
        `)
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });
}