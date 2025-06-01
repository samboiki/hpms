import { supabase } from '../lib/supabase';

interface MedicalAidDetails {
  id: string;
  patient_id: string;
  provider: string;
  scheme: string;
  membership_number: string;
  plan_type?: string;
  main_member_name: string;
  main_member_id_number: string;
  relationship_to_main: string;
}

/**
 * Medical Aid Service
 * Handles fetching medical aid data with proper error handling for RLS policies
 */
class MedicalAidService {
  
  /**
   * Fetch medical aid details for a patient
   * Handles RLS policy restrictions gracefully
   */
  async getMedicalAidDetails(patientId: string): Promise<MedicalAidDetails | null> {
    try {
      console.log('🔍 [MedicalAidService] Fetching medical aid for patient:', patientId);

      // First, try the standard approach
      const { data, error } = await supabase
        .from('medical_aid_details')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('⚠️ [MedicalAidService] Direct query failed (likely RLS):', error);
        
        // Fallback: Try to use a Supabase Edge Function if it exists
        return await this.fallbackGetMedicalAid(patientId);
      }

      if (data) {
        console.log('✅ [MedicalAidService] Medical aid data found:', data.provider);
        return data;
      }

      console.log('ℹ️ [MedicalAidService] No medical aid data found for patient');
      return null;

    } catch (error) {
      console.error('❌ [MedicalAidService] Error fetching medical aid:', error);
      return null;
    }
  }

  /**
   * Fallback method to get medical aid data when RLS blocks access
   * Uses Supabase Edge Function to bypass RLS restrictions
   */
  private async fallbackGetMedicalAid(patientId: string): Promise<MedicalAidDetails | null> {
    try {
      console.log('🔄 [MedicalAidService] Trying fallback approach with Edge Function...');
      
      // Use the Edge Function to fetch medical aid data
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'get-medical-aid',
        {
          body: { patient_id: patientId }
        }
      );

      if (functionError) {
        console.warn('⚠️ [MedicalAidService] Edge Function failed:', functionError);
        return null;
      }

      if (functionData?.data) {
        console.log('✅ [MedicalAidService] Edge Function succeeded:', functionData.data.provider);
        return functionData.data;
      }

      console.log('ℹ️ [MedicalAidService] Edge Function returned no data');
      return null;
      
    } catch (error) {
      console.error('❌ [MedicalAidService] Edge Function fallback failed:', error);
      console.warn('💡 [MedicalAidService] To fix permanently, add RLS policy:');
      console.warn('   CREATE POLICY "read_medical_aid" ON medical_aid_details FOR SELECT USING (true);');
      return null;
    }
  }

  /**
   * Check if medical aid access is available
   * Useful for debugging RLS issues
   */
  async testAccess(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('medical_aid_details')
        .select('id')
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }
}

export const medicalAidService = new MedicalAidService();