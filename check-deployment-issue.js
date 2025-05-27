import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugDeploymentIssue() {
  console.log('=== DEBUGGING DEPLOYMENT ISSUE ===\n');
  
  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
  
  // Test 1: Check current auth
  console.log('1. Checking authentication...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('Auth result:', { user: user?.id, error: authError?.message });
  
  // Test 2: Try to authenticate
  console.log('\n2. Authenticating...');
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'admin@drpolina.com',
    password: 'admin123'
  });
  
  if (signInError) {
    console.log('❌ Auth failed:', signInError.message);
  } else {
    console.log('✅ Auth successful:', authData.user.id);
  }
  
  // Test 3: Check RLS policies by trying different queries
  console.log('\n3. Testing different query approaches...');
  
  // Query A: The main query
  const { data: queryA, error: errorA } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(id, first_name, last_name, cell_number, date_of_birth, gender),
      doctor:users!doctor_id(id, full_name, practice_id)
    `)
    .eq('practice_id', practiceId);
  
  console.log('Query A (main):', { count: queryA?.length || 0, error: errorA?.message });
  
  // Query B: Without joins
  const { data: queryB, error: errorB } = await supabase
    .from('appointments')
    .select('*')
    .eq('practice_id', practiceId);
  
  console.log('Query B (no joins):', { count: queryB?.length || 0, error: errorB?.message });
  
  // Query C: Check if practice_id exists in appointments at all
  const { data: queryC, error: errorC } = await supabase
    .from('appointments')
    .select('id, practice_id')
    .not('practice_id', 'is', null)
    .limit(10);
  
  console.log('Query C (any with practice_id):', { 
    count: queryC?.length || 0, 
    error: errorC?.message,
    samplePracticeIds: queryC?.map(a => a.practice_id.substring(0, 8))
  });
  
  // Test 4: Check user's practice_id
  console.log('\n4. Checking user practice_id...');
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select('practice_id, role')
    .eq('email', 'admin@drpolina.com')
    .single();
  
  console.log('User profile:', { 
    practice_id: userProfile?.practice_id?.substring(0, 8), 
    role: userProfile?.role,
    error: profileError?.message 
  });
  
  // Test 5: Check if RLS is the issue by using a more permissive query
  console.log('\n5. Testing RLS permissions...');
  const { data: rqlTest, error: rlsError } = await supabase
    .rpc('test_appointments_access');
  
  console.log('RLS test result:', { data: rqlTest, error: rlsError?.message });
  
  // Test 6: Direct REST API call
  console.log('\n6. Testing direct REST API...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/appointments?practice_id=eq.${practiceId}&select=id,date,status`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const directData = await response.json();
    console.log('Direct API result:', { 
      status: response.status, 
      count: Array.isArray(directData) ? directData.length : 0,
      data: directData 
    });
  } catch (directError) {
    console.log('Direct API error:', directError.message);
  }
}

debugDeploymentIssue();