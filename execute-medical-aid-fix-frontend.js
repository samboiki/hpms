// Emergency frontend-based medical aid fix
// Execute this with: node execute-medical-aid-fix-frontend.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixMedicalAidSystem() {
  try {
    console.log('🔧 Starting medical aid system fix...');
    
    // Step 1: Check existing medical_aid_providers table
    console.log('📋 Checking existing medical aid providers...');
    const { data: existingProviders, error: providersError } = await supabase
      .from('medical_aid_providers')
      .select('*')
      .order('name');
      
    if (providersError) {
      console.error('❌ Error fetching providers:', providersError);
      return;
    }
    
    console.log('✅ Found existing providers:', existingProviders?.length || 0);
    if (existingProviders) {
      existingProviders.forEach(provider => {
        console.log(`  - ${provider.name} (${provider.short_name || provider.provider_code || 'No code'})`);
      });
    }
    
    // Step 2: Check medical_aid_details table structure
    console.log('\n📋 Checking medical_aid_details table...');
    const { data: medicalAidDetails, error: detailsError } = await supabase
      .from('medical_aid_details')
      .select('*')
      .limit(5);
      
    if (detailsError) {
      console.error('❌ Error fetching medical aid details:', detailsError);
    } else {
      console.log('✅ Medical aid details table accessible');
      console.log('Sample record structure:', medicalAidDetails?.[0] ? Object.keys(medicalAidDetails[0]) : 'No records');
    }
    
    // Step 3: Test the get_medical_aid_providers function
    console.log('\n🔧 Testing get_medical_aid_providers function...');
    const { data: functionResult, error: functionError } = await supabase
      .rpc('get_medical_aid_providers');
      
    if (functionError) {
      console.log('ℹ️ Function may not exist yet:', functionError.message);
    } else {
      console.log('✅ Function works! Providers:', functionResult?.length || 0);
    }
    
    // Step 4: Check if medical_aid_provider_id column exists
    console.log('\n🔧 Checking if foreign key column exists...');
    const { data: testRecord, error: testError } = await supabase
      .from('medical_aid_details')
      .select('medical_aid_provider_id')
      .limit(1);
      
    if (testError && testError.message.includes('medical_aid_provider_id')) {
      console.log('❌ medical_aid_provider_id column does not exist - needs to be added');
    } else {
      console.log('✅ medical_aid_provider_id column exists or accessible');
    }
    
    console.log('\n📊 Analysis complete. Next steps:');
    console.log('1. Execute the SQL fix in Supabase Dashboard > SQL Editor');
    console.log('2. Update frontend forms to use medical_aid_provider_id');
    console.log('3. Test patient registration');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

fixMedicalAidSystem();