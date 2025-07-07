import { createClient } from '@supabase/supabase-js';

// Use service role key for direct database access
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function analyzeMedicalAidStructure() {
  console.log('=== MEDICAL AID DATA STRUCTURE ANALYSIS ===\n');
  
  try {
    // 1. Check medical_aid_details table structure
    console.log('1. MEDICAL_AID_DETAILS TABLE STRUCTURE:');
    console.log('=====================================');
    
    const { data: sampleDetails, error: detailsError } = await supabase
      .from('medical_aid_details')
      .select('*')
      .limit(3);
    
    if (detailsError) {
      console.log('Error querying medical_aid_details:', detailsError.message);
    } else if (sampleDetails && sampleDetails.length > 0) {
      console.log('Table exists with sample data:');
      console.log('Columns found:', Object.keys(sampleDetails[0]));
      console.log('\nSample records:');
      sampleDetails.forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`);
        Object.entries(record).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    } else {
      console.log('Table exists but no data found');
    }
    
    // 2. Check medical_aid_providers table
    console.log('\n2. MEDICAL_AID_PROVIDERS TABLE:');
    console.log('==============================');
    
    const { data: providers, error: providersError } = await supabase
      .from('medical_aid_providers')
      .select('*')
      .order('provider_name');
    
    if (providersError) {
      console.log('Error querying medical_aid_providers:', providersError.message);
    } else if (providers && providers.length > 0) {
      console.log(`Found ${providers.length} providers:`);
      console.log('Columns:', Object.keys(providers[0]));
      providers.forEach((provider, index) => {
        console.log(`\nProvider ${index + 1}:`);
        Object.entries(provider).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    } else {
      console.log('Table exists but no data found');
    }
    
    // 3. Check unique providers in medical_aid_details
    console.log('\n3. UNIQUE PROVIDERS IN MEDICAL_AID_DETAILS:');
    console.log('==========================================');
    
    const { data: uniqueProviders, error: uniqueError } = await supabase
      .rpc('get_unique_providers');
    
    if (uniqueError) {
      // If function doesn't exist, do a direct query
      const { data: directProviders, error: directError } = await supabase
        .from('medical_aid_details')
        .select('provider')
        .not('provider', 'is', null);
      
      if (directError) {
        console.log('Error getting unique providers:', directError.message);
      } else {
        const providerCounts = {};
        directProviders.forEach(record => {
          if (record.provider) {
            providerCounts[record.provider] = (providerCounts[record.provider] || 0) + 1;
          }
        });
        
        console.log('Unique providers found:');
        Object.entries(providerCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([provider, count]) => {
            console.log(`  ${provider}: ${count} patients`);
          });
      }
    }
    
    // 4. Check how to match providers
    console.log('\n4. LOGO MATCHING STRATEGY:');
    console.log('=========================');
    
    if (providers && providers.length > 0 && sampleDetails && sampleDetails.length > 0) {
      console.log('Suggested matching logic:');
      console.log('1. Exact match: medical_aid_details.provider = medical_aid_providers.provider_name');
      console.log('2. Case-insensitive match: LOWER(provider) = LOWER(provider_name)');
      console.log('3. Reference match: provider = medical_aid_reference');
      console.log('4. Partial match for common abbreviations');
      
      // Show example matches
      const exampleProvider = sampleDetails[0].provider;
      if (exampleProvider) {
        const matchingProvider = providers.find(p => 
          p.provider_name?.toLowerCase() === exampleProvider.toLowerCase() ||
          p.medical_aid_reference?.toLowerCase() === exampleProvider.toLowerCase()
        );
        
        if (matchingProvider) {
          console.log(`\nExample match found:`);
          console.log(`  Patient provider: "${exampleProvider}"`);
          console.log(`  Matches: "${matchingProvider.provider_name}"`);
          console.log(`  Logo URL: ${matchingProvider.logo_url || 'No logo'}`);
        } else {
          console.log(`\nExample - no match found for: "${exampleProvider}"`);
        }
      }
    }
    
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('Error during analysis:', error.message);
  }
}

analyzeMedicalAidStructure();