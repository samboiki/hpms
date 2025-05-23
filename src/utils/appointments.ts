import { supabase } from '../lib/supabase';

/**
 * Opens a visit for an appointment, creating one if it doesn't exist
 * @param apptId Appointment ID
 * @returns Visit ID
 */
export async function openVisit(apptId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_visit', { _appt: apptId });
  
  if (error) {
    console.error('Error ensuring visit:', error);
    throw error;
  }
  
  return data as string;   // visit ID
}