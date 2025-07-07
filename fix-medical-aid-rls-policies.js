// Fix RLS policies for medical_aid_details table
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLSPolicies() {
  try {
    console.log('🔧 Fixing RLS policies for medical_aid_details...');
    
    // Check current policies
    const { data: currentPolicies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'medical_aid_details');
      
    if (policiesError) {
      console.log('Could not fetch current policies (this is normal):', policiesError.message);
    } else {
      console.log('Current policies count:', currentPolicies?.length || 0);
    }
    
    // Test current user's practice access
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.log('Auth check failed:', userError.message);
    } else if (userData.user) {
      const { data: userPractice, error: practiceError } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', userData.user.id)
        .single();
        
      if (practiceError) {
        console.log('Could not get user practice:', practiceError.message);
      } else {
        console.log('User practice_id:', userPractice?.practice_id);
      }
    }
    
    // Try a simple test insert to see what happens
    console.log('\\n🧪 Testing simple medical aid insert...');
    
    // First create a test patient
    const testPatient = {
      first_name: 'RLS',
      last_name: 'Test', 
      id_number: `RLSTEST${Date.now()}`,
      date_of_birth: '1990-01-01',
      gender: 'male',
      practice_id: 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3' // Dr. Polina's practice
    };
    
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .insert([testPatient])
      .select()
      .single();
      
    if (patientError) {
      console.error('❌ Failed to create test patient:', patientError);
      return;
    }
    
    console.log('✅ Created test patient:', patientData.id);
    
    // Now try to insert medical aid details
    const medicalAidData = {
      patient_id: patientData.id,
      provider: 'Test Provider',
      scheme: 'Test Scheme',
      membership_number: 'TEST123',
      plan_type: 'Test Plan', // This was missing!
      main_member_name: 'Test Member',
      main_member_id_number: '1234567890',
      relationship_to_main: 'self'
    };
    
    const { data: medicalAidResult, error: medicalAidError } = await supabase
      .from('medical_aid_details')
      .insert([medicalAidData])
      .select()
      .single();
      
    if (medicalAidError) {
      console.error('❌ Medical aid insert failed:', medicalAidError);
      console.log('Error code:', medicalAidError.code);
      console.log('Error details:', medicalAidError.details);
      console.log('Error hint:', medicalAidError.hint);
    } else {
      console.log('✅ Medical aid insert succeeded:', medicalAidResult.id);
      
      // Clean up
      await supabase.from('medical_aid_details').delete().eq('id', medicalAidResult.id);
    }
    
    // Clean up test patient
    await supabase.from('patients').delete().eq('id', patientData.id);
    console.log('🧹 Cleaned up test data');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

fixRLSPolicies();