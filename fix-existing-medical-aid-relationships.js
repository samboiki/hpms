// Fix existing medical_aid_details records by populating medical_aid_provider_id
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixExistingRelationships() {
  try {
    console.log('🔧 Fixing existing medical aid relationships...');
    
    // Get all medical aid providers with their exact data
    const { data: providers, error: providersError } = await supabase
      .from('medical_aid_providers')
      .select('*');
      
    if (providersError) {
      console.error('❌ Error fetching providers:', providersError);
      return;
    }
    
    console.log('✅ Found providers:', providers.map(p => `${p.name} (${p.short_name})`));
    
    // Get all medical aid details records that need fixing
    const { data: medicalAidRecords, error: recordsError } = await supabase
      .from('medical_aid_details')
      .select('*')
      .is('medical_aid_provider_id', null);
      
    if (recordsError) {
      console.error('❌ Error fetching medical aid records:', recordsError);
      return;
    }
    
    console.log('📋 Found', medicalAidRecords?.length || 0, 'records to fix');
    
    if (!medicalAidRecords || medicalAidRecords.length === 0) {
      console.log('✅ All records already have proper relationships');
      return;
    }
    
    // Create provider name mapping based on your existing data
    const providerMapping = {
      'Methealth Namibia': providers.find(p => p.short_name === 'Methealth')?.id,
      'Namibia Health Plan (NHP)': providers.find(p => p.short_name === 'NHP')?.id,
      'Namibia Medical Care (NMC)': providers.find(p => p.short_name === 'NMC')?.id,
      'Namibia Medical Care': providers.find(p => p.short_name === 'NMC')?.id,
      'Nammed Medical Aid Fund': providers.find(p => p.short_name === 'Nammed')?.id,
      'Prosperity Health': providers.find(p => p.short_name === 'PROS')?.id,
      // Handle other provider name variations
      'Discovery Health': providers.find(p => p.name.includes('Discovery'))?.id,
      'Bonitas': providers.find(p => p.name.includes('Bonitas'))?.id,
      'Momentum Health': providers.find(p => p.name.includes('Momentum'))?.id,
      'Renaissance Health Medical Aid Fund': providers.find(p => p.name.includes('Renaissance'))?.id,
      'Bankmed Namibia': providers.find(p => p.name.includes('Bankmed'))?.id,
      'Napotel Medical Aid': providers.find(p => p.name.includes('Napotel'))?.id,
    };
    
    console.log('📍 Provider mapping created:', Object.keys(providerMapping).length, 'mappings');
    
    let fixedCount = 0;
    let errors = [];
    
    // Fix each record
    for (const record of medicalAidRecords) {
      try {
        const providerId = providerMapping[record.provider];
        
        if (providerId) {
          const { error: updateError } = await supabase
            .from('medical_aid_details')
            .update({ medical_aid_provider_id: providerId })
            .eq('id', record.id);
            
          if (updateError) {
            errors.push(`Failed to update ${record.id}: ${updateError.message}`);
          } else {
            fixedCount++;
            console.log(`✅ Fixed: ${record.provider} → ${providerId}`);
          }
        } else {
          console.log(`⚠️ No mapping found for: ${record.provider}`);
        }
      } catch (err) {
        errors.push(`Error processing ${record.id}: ${err.message}`);
      }
    }
    
    console.log('\\n📊 Results:');
    console.log(`✅ Fixed: ${fixedCount} records`);
    console.log(`⚠️ Errors: ${errors.length} errors`);
    
    if (errors.length > 0) {
      console.log('\\nErrors:');
      errors.forEach(err => console.log(`  - ${err}`));
    }
    
    console.log('\\n🎉 Relationship fix completed!');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

fixExistingRelationships();