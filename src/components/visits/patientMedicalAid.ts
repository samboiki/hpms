import { supabase } from '../../lib/supabase';

/**
 * Whether the patient's bill goes to a medical aid: the check invoiceService makes when it creates an
 * invoice (the patient has a medical_aid_details record). null when the record can't be read; callers
 * then fall back to the billing lines' own flags, as invoiceService does.
 */
export async function loadPatientHasMedicalAid(patientId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('medical_aid_details')
      .select('id')
      .eq('patient_id', patientId)
      .limit(1);
    if (error) {
      console.warn('Medical aid lookup failed:', error.message);
      return null;
    }
    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.warn('Medical aid lookup failed:', error);
    return null;
  }
}
