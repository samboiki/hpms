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
          vitals!fk_vitals_visit_id (*),
          lab_requests (
            id,
            status
          ),
          prescriptions:medications (
            id,
            medication_name,
            dosage,
            frequency
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