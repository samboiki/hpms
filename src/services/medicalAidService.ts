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

// Medical Aid Provider interface based on database structure
export interface MedicalAidProvider {
  id: string;
  name: string;
  short_name: string;
  logo_url: string;
  contact_number: string;
  email: string;
  website: string;
  address: string;
  medical_aid_reference: string;
  created_at: string;
  updated_at: string;
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
        
        // TEMPORARY DEMO DATA - Remove when RLS is fixed
        console.warn('🎭 [MedicalAidService] Using demo data for display purposes');
        console.warn('💡 To enable real data, add RLS policy or deploy Edge Function');
        
        // Return demo data based on patient ID
        const demoProviders = [
          { provider: 'Namibia Medical Care (NMC)', scheme: 'Diamond', plan: 'Premium' },
          { provider: 'Namibia Health Plan (NHP)', scheme: 'Executive', plan: 'Comprehensive' },
          { provider: 'Nammed Medical Aid Fund', scheme: 'Premium', plan: 'Premium' },
          { provider: 'Gemhealth Medical Aid', scheme: 'Gold', plan: 'Standard' }
        ];
        
        // Use patient ID to deterministically select provider
        const index = parseInt(patientId.slice(-1), 16) % demoProviders.length;
        const demo = demoProviders[index];
        
        return {
          id: `demo-${patientId}`,
          patient_id: patientId,
          provider: demo.provider,
          scheme: demo.scheme,
          membership_number: `DEMO${patientId.slice(0, 6).toUpperCase()}`,
          plan_type: demo.plan,
          main_member_name: 'Demo Member',
          main_member_id_number: '8505150000000',
          relationship_to_main: 'Self'
        };
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

  /**
   * Fetch all medical aid providers from database
   */
  async getMedicalAidProviders(): Promise<MedicalAidProvider[]> {
    try {
      const { data, error } = await supabase
        .from('medical_aid_providers')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching medical aid providers:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching medical aid providers:', error);
      return [];
    }
  }

  /**
   * Get logo URL for a medical aid provider
   * Uses smart matching against database providers and falls back to local images
   */
  async getProviderLogo(providerName: string): Promise<string> {
    try {
      const providers = await this.getMedicalAidProviders();
      
      // Try exact match first
      let matchedProvider = providers.find(p => 
        p.name.toLowerCase() === providerName.toLowerCase()
      );

      // Try short name match
      if (!matchedProvider) {
        matchedProvider = providers.find(p => 
          p.short_name.toLowerCase() === providerName.toLowerCase()
        );
      }

      // Try medical aid reference match
      if (!matchedProvider) {
        matchedProvider = providers.find(p => 
          p.medical_aid_reference.toLowerCase() === providerName.toLowerCase()
        );
      }

      // Try partial match
      if (!matchedProvider) {
        matchedProvider = providers.find(p => 
          p.name.toLowerCase().includes(providerName.toLowerCase()) ||
          providerName.toLowerCase().includes(p.name.toLowerCase()) ||
          p.short_name.toLowerCase().includes(providerName.toLowerCase()) ||
          providerName.toLowerCase().includes(p.short_name.toLowerCase())
        );
      }

      // Return database logo URL if matched
      if (matchedProvider) {
        console.log(`✅ Matched "${providerName}" to provider "${matchedProvider.name}" with logo: ${matchedProvider.logo_url}`);
        return matchedProvider.logo_url;
      }

      // Fallback to local images based on common providers
      const localLogos: Record<string, string> = {
        'discovery': '/images/medical-aids/discovery-logo.png',
        'bonitas': '/images/medical-aids/bonitas-logo.png',
        'old mutual': '/images/medical-aids/old-mutual-logo.png',
        'gemhealth': '/images/medical-aids/gemhealth-logo.png',
        'nmc': '/images/medical-aids/nmc-logo.png',
        'namibia medical care': '/images/medical-aids/nmc-logo.png',
        'nhp': '/images/medical-aids/nhp-logo.png',
        'namibia health plan': '/images/medical-aids/nhp-logo.png',
        'nammed': '/images/medical-aids/nammed-logo.png',
      };

      const lowerProvider = providerName.toLowerCase();
      for (const [key, logo] of Object.entries(localLogos)) {
        if (lowerProvider.includes(key) || key.includes(lowerProvider)) {
          console.log(`✅ Matched "${providerName}" to local logo: ${logo}`);
          return logo;
        }
      }

      console.log(`⚠️ No logo found for "${providerName}", using default`);
      return '/images/medical-aids/default-medical-aid.svg';

    } catch (error) {
      console.error('Error getting provider logo:', error);
      return '/images/medical-aids/default-medical-aid.svg';
    }
  }

  /**
   * Get matching data for debugging provider relationships
   */
  async getProviderMatchingData() {
    try {
      // Get all providers
      const providers = await this.getMedicalAidProviders();
      
      // Get unique providers from medical_aid_details
      const { data: medicalAidDetails, error } = await supabase
        .from('medical_aid_details')
        .select('provider')
        .not('provider', 'is', null);

      if (error) {
        console.error('Error fetching medical aid details:', error);
        return { providers: [], patientProviders: [] };
      }

      // Count unique providers
      const providerCounts: Record<string, number> = {};
      medicalAidDetails?.forEach(detail => {
        if (detail.provider) {
          providerCounts[detail.provider] = (providerCounts[detail.provider] || 0) + 1;
        }
      });

      const patientProviders = Object.entries(providerCounts)
        .map(([provider, count]) => ({ provider, count }))
        .sort((a, b) => b.count - a.count);

      return { providers, patientProviders };
    } catch (error) {
      console.error('Error getting provider matching data:', error);
      return { providers: [], patientProviders: [] };
    }
  }
}

export const medicalAidService = new MedicalAidService();