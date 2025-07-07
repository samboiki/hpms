#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function debugMedicalAidQuery() {
  const elisabethPatientId = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8';
  
  console.log('🔍 DEBUGGING MEDICAL AID QUERY');
  console.log('==============================');
  console.log('Patient ID:', elisabethPatientId);
  
  // Test the exact same query that's failing in the frontend
  console.log('\n📋 Testing exact frontend query:');
  const { data: medicalAidData, error: medicalAidError } = await supabase
    .from('medical_aid_details')
    .select('id, provider, membership_number, medical_aid_provider_id')
    .eq('patient_id', elisabethPatientId);
  
  console.log('Result:', { data: medicalAidData, error: medicalAidError });
  
  // Test broader query
  console.log('\n📋 Testing broader query (all columns):');
  const { data: allData, error: allError } = await supabase
    .from('medical_aid_details')
    .select('*')
    .eq('patient_id', elisabethPatientId);
  
  console.log('Result:', { data: allData, error: allError });
  
  // Test if patient exists at all
  console.log('\n👤 Testing if patient exists:');
  const { data: patientData, error: patientError } = await supabase
    .from('patients')
    .select('id, first_name, last_name')
    .eq('id', elisabethPatientId);
  
  console.log('Patient result:', { data: patientData, error: patientError });
  
  // Check all medical aid records for Elisabeth
  console.log('\n🔍 Searching by patient name:');
  const { data: nameSearch, error: nameError } = await supabase
    .from('medical_aid_details')
    .select(`
      *,
      patients (
        first_name,
        last_name
      )
    `);
  
  if (!nameError && nameSearch) {
    const elisabethRecords = nameSearch.filter(record => 
      record.patients?.first_name === 'Elisabeth' && 
      record.patients?.last_name === 'Shilongo'
    );
    
    console.log('Elisabeth records found:', elisabethRecords);
    
    if (elisabethRecords.length > 0) {
      console.log('\n🚨 MISMATCH DETECTED:');
      console.log('Frontend patient ID:', elisabethPatientId);
      console.log('Actual patient ID in medical_aid_details:', elisabethRecords[0].patient_id);
    }
  }
  
  // Show the table structure
  console.log('\n📊 Medical aid details table structure:');
  const { data: tableData, error: tableError } = await supabase
    .from('medical_aid_details')
    .select('*')
    .limit(3);
  
  console.log('Sample records:', tableData);
}

debugMedicalAidQuery().catch(console.error);