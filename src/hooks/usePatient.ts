import { supabase } from '../lib/supabase';
import { differenceInYears } from 'date-fns';

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  occupation: string;
  home_language: string;
  home_address: string;
  postal_address: string;
  postal_code: string;
  medical_aid_details: Array<{
    provider: string;
    scheme: string;
    membership_number: string;
    plan_type: string;
    main_member_name: string;
    main_member_id_number: string;
    relationship_to_main: string;
  }>;
  next_of_kin: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    address: string;
  }>;
  chronicConditions?: string[];
}

export function calculateAge(dateOfBirth: string) {
  return differenceInYears(new Date(), new Date(dateOfBirth));
}

export function usePatient(patientId: string) {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_details_view')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;
      return data;
    }
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Patient> & { id: string }) => {
      const { error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
    }
  });
}