// Test medical aid registration fix
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMedicalAidRegistration() {
  try {
    console.log('🧪 Testing medical aid registration fix...');
    
    // Login as admin to bypass RLS
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@onehealth.local',
      password: 'admin123'
    });
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }
    
    console.log('✅ Authenticated as admin');
    
    // Get providers to test with
    const { data: providers, error: providersError } = await supabase
      .from('medical_aid_providers')
      .select('*')
      .limit(1);
      
    if (providersError) {
      console.error('❌ Error fetching providers:', providersError);
      return;
    }
    
    if (!providers || providers.length === 0) {
      console.error('❌ No providers found');
      return;
    }
    
    const testProvider = providers[0];
    console.log('✅ Using test provider:', testProvider.name);
    
    // Test patient data
    const testPatientData = {
      first_name: 'Test',
      last_name: 'Patient',
      id_number: `TEST${Date.now()}`,
      date_of_birth: '1990-01-01',
      gender: 'male',
      cell_number: '081234567',
      email: 'test@example.com',
      practice_id: 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3' // Dr. Polina's practice
    };
    
    // Insert test patient
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .insert([testPatientData])
      .select()
      .single();
      
    if (patientError) {
      console.error('❌ Error creating patient:', patientError);
      return;
    }
    
    console.log('✅ Created test patient:', patientData.id);
    
    // Test medical aid details insertion with correct field names
    const medicalAidData = {
      patient_id: patientData.id,
      provider: testProvider.name,
      scheme: 'Test Plan',
      medical_aid_provider_id: testProvider.id, // CORRECT field name
      membership_number: 'TEST123456', // CORRECT field name
      main_member_name: 'Test Patient',
      main_member_id_number: testPatientData.id_number,
      relationship_to_main: 'self' // CORRECT field name
    };
    
    console.log('🔧 Testing medical aid insertion with correct fields...');
    const { data: medicalAidResult, error: medicalAidError } = await supabase
      .from('medical_aid_details')
      .insert([medicalAidData])
      .select()
      .single();
      
    if (medicalAidError) {
      console.error('❌ Medical aid insertion failed:', medicalAidError);
      console.log('Data attempted:', medicalAidData);
    } else {
      console.log('✅ Medical aid details created successfully!');
      console.log('Created record:', medicalAidResult.id);
    }
    
    // Cleanup - delete test records
    console.log('🧹 Cleaning up test data...');
    
    if (medicalAidResult) {
      await supabase.from('medical_aid_details').delete().eq('id', medicalAidResult.id);
    }
    await supabase.from('patients').delete().eq('id', patientData.id);
    
    console.log('✅ Test completed and cleaned up');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testMedicalAidRegistration();