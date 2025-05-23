import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useVisits(patientId: string) {
  return useQuery({
    queryKey: ['visits', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_timeline_view')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });
}