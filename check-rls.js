import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function checkRLSPolicies() {
  console.log('🔍 Checking RLS policies for medical_aid_details table...\n');
  
  try {
    // Try to access the table directly to see the error
    console.log('🔍 Attempting direct table access with service role...');
    const { data: testData, error: testError } = await supabase
      .from('medical_aid_details')
      .select('*')
      .limit(1);
      
    if (testError) {
      console.log('❌ Error accessing medical_aid_details:', testError.message);
      console.log('Error code:', testError.code);
      console.log('Error details:', testError.details);
    } else {
      console.log('✅ Table accessible with service role, data sample:', testData);
    }
    
    // Now check RLS policies using raw SQL
    console.log('\n🔍 Checking RLS policies...');
    const { data: policies, error: policiesError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `
        SELECT 
          schemaname, 
          tablename, 
          policyname, 
          permissive, 
          roles, 
          cmd, 
          qual, 
          with_check 
        FROM pg_policies 
        WHERE tablename = 'medical_aid_details';
      `
    });
    
    if (policiesError) {
      console.log('Error getting policies:', policiesError.message);
    } else {
      console.log('RLS Policies result:', policies);
    }
    
    // Check if RLS is enabled
    console.log('\n🔍 Checking if RLS is enabled...');
    const { data: rlsStatus, error: rlsError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `
        SELECT 
          schemaname, 
          tablename, 
          rowsecurity 
        FROM pg_tables 
        WHERE tablename = 'medical_aid_details';
      `
    });
    
    if (rlsError) {
      console.log('Error checking RLS status:', rlsError.message);
    } else {
      console.log('RLS Status result:', rlsStatus);
    }
    
    // Test with authenticated user simulation
    console.log('\n🔍 Testing INSERT operation (simulating authenticated user error)...');
    const testInsert = {
      patient_id: '123e4567-e89b-12d3-a456-426614174000',
      provider: 'Test Provider',
      scheme: 'Test Scheme',
      membership_number: 'TEST123',
      plan_type: 'Basic',
      main_member_name: 'Test User',
      main_member_id_number: '1234567890123',
      relationship_to_main: 'Self'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('medical_aid_details')
      .insert(testInsert)
      .select();
      
    if (insertError) {
      console.log('❌ Insert error (expected):', insertError.message);
      console.log('Error code:', insertError.code);
      console.log('Error details:', insertError.details);
    } else {
      console.log('✅ Insert successful:', insertData);
      
      // Clean up test record
      await supabase
        .from('medical_aid_details')
        .delete()
        .eq('membership_number', 'TEST123');
    }
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
}

checkRLSPolicies();