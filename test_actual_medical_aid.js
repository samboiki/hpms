#!/usr/bin/env node
// Test actual medical aid data with current frontend setup
import { createClient } from '@supabase/supabase-js';

// Use actual frontend environment variables
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
  auth: { persistSession: true }
});

async function testActualMedicalAid() {
  console.log('🧪 Testing ACTUAL medical aid display with current frontend setup...');
  
  // Test patients that should have medical aid data
  const testPatients = [
    '2a2136ad-7af7-47d0-b431-7dcef3411859', // Maria Shilongo
    '327925ed-6d7d-4464-8581-5a6fae75931e', // Thomas Amukwaya  
    'd09ad54c-b7df-4c1f-b11b-994048aa730b'  // Johannes van der Merwe
  ];

  for (const patientId of testPatients) {
    console.log(`\n🔍 Testing patient: ${patientId}`);
    
    // Test 1: Can we get patient data?
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('first_name, last_name, practice_id')
      .eq('id', patientId)
      .single();

    if (patientError) {
      console.log(`❌ Patient fetch failed: ${patientError.message}`);
      continue;
    }

    console.log(`✅ Patient: ${patient.first_name} ${patient.last_name} (practice: ${patient.practice_id})`);

    // Test 2: Can we get medical aid data with current setup?
    const { data: medicalAid, error: medicalAidError } = await supabase
      .from('medical_aid_details')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle();

    if (medicalAidError && medicalAidError.code !== 'PGRST116') {
      console.log(`❌ Medical aid fetch failed: ${medicalAidError.message} (Code: ${medicalAidError.code})`);
      continue;
    }

    if (!medicalAid) {
      console.log(`⚠️ No medical aid data found for ${patient.first_name} ${patient.last_name}`);
    } else {
      console.log(`✅ Medical aid found: ${medicalAid.provider} - ${medicalAid.scheme} - #${medicalAid.membership_number}`);
    }

    // Test 3: Test the medical aid service approach
    try {
      console.log(`🔄 Testing service approach for ${patient.first_name}...`);
      // Simulate what the service does
      const serviceResult = medicalAid;
      if (serviceResult) {
        console.log(`✅ Service would return: ${serviceResult.provider}`);
      } else {
        console.log(`⚠️ Service would return null`);
      }
    } catch (err) {
      console.log(`❌ Service simulation failed: ${err.message}`);
    }
  }

  // Test 4: Check if we can access the table at all
  console.log('\n🔍 Testing general table access...');
  const { data: tableTest, error: tableError } = await supabase
    .from('medical_aid_details')
    .select('provider')
    .limit(1);

  if (tableError) {
    console.log(`❌ Cannot access medical_aid_details table: ${tableError.message} (Code: ${tableError.code})`);
    console.log('🎯 This confirms RLS is blocking access!');
  } else {
    console.log(`✅ Can access medical_aid_details table, found: ${tableTest?.length || 0} records`);
  }

  console.log('\n📊 SUMMARY:');
  console.log('If medical aid data is not showing, it\'s likely due to RLS policies blocking frontend access.');
  console.log('The component should show medical aid data only if the query succeeds.');
}

testActualMedicalAid();