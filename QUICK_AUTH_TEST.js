// QUICK AUTH TEST - Paste in browser console on dashboard
// This tests the exact same flow as practiceDataService

console.log('🔍 === QUICK AUTH CONTEXT TEST ===');

const testAuthFlow = async () => {
  // Use existing Supabase client or create one
  let client;
  
  if (window.supabase) {
    client = window.supabase;
  } else {
    const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
    
    if (typeof supabase !== 'undefined') {
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.log('❌ Supabase not available. Run this first:');
      console.log('const { createClient } = await import("https://cdn.skypack.dev/@supabase/supabase-js");');
      console.log('window.supabase = { createClient };');
      return;
    }
  }
  
  // Step 1: Get auth user (same as practiceDataService.getAuthContext)
  console.log('1. Getting auth user...');
  const { data: { user: authUser }, error: authError } = await client.auth.getUser();
  
  if (authError || !authUser) {
    console.log('❌ No authenticated user:', authError?.message);
    return;
  }
  
  console.log('✅ Auth user found:', {
    id: authUser.id,
    email: authUser.email,
    hasMetadata: !!authUser.user_metadata
  });
  
  // Step 2: Get user profile (same as practiceDataService.getAuthContext)
  console.log('2. Getting user profile...');
  const { data: userProfile, error: profileError } = await client
    .from('users')
    .select('id, email, full_name, role, practice_id')
    .eq('id', authUser.id)
    .single();
    
  let practiceId;
  
  if (profileError) {
    console.log('⚠️ Profile error:', profileError.message);
    
    if (authUser.user_metadata?.practice_id) {
      console.log('✅ Using metadata fallback');
      practiceId = authUser.user_metadata.practice_id;
    } else {
      console.log('❌ No practice_id in metadata either');
      return;
    }
  } else {
    console.log('✅ User profile found:', userProfile);
    practiceId = userProfile.practice_id;
  }
  
  if (!practiceId) {
    console.log('❌ No practice_id found');
    return;
  }
  
  console.log('📍 Using practice_id:', practiceId);
  
  // Step 3: Test appointment query (same as practiceDataService.getPracticeAppointments)
  console.log('3. Testing appointment query...');
  const { data: appointments, error: appointmentError } = await client
    .from('appointments')
    .select(`
      *,
      patient:patients(id, first_name, last_name, cell_number, date_of_birth, gender),
      doctor:users!doctor_id(id, full_name, practice_id)
    `)
    .eq('practice_id', practiceId)
    .order('date', { ascending: true })
    .order('time', { ascending: true });
    
  if (appointmentError) {
    console.log('❌ Appointment query failed:', appointmentError.message);
    console.log('   This is the exact error the dashboard is seeing!');
    console.log('   Error details:', appointmentError);
    
    // Test basic query without joins
    console.log('4. Testing basic query without joins...');
    const { data: basicAppointments, error: basicError } = await client
      .from('appointments')
      .select('id, date, status, practice_id')
      .eq('practice_id', practiceId);
      
    if (basicError) {
      console.log('❌ Even basic query failed:', basicError.message);
      console.log('   RLS policies are blocking appointments table access');
    } else {
      console.log('✅ Basic query worked:', basicAppointments?.length || 0, 'appointments');
      console.log('   Issue is with the JOIN to patients/users tables');
    }
    
  } else {
    console.log('✅ Appointment query SUCCESS!', appointments?.length || 0, 'appointments found');
    
    if (appointments && appointments.length > 0) {
      console.log('   Sample appointments:');
      appointments.slice(0, 3).forEach((apt, idx) => {
        console.log(`   ${idx + 1}. ${apt.date} - ${apt.patient?.first_name || 'Unknown'} ${apt.patient?.last_name || ''} - ${apt.status}`);
      });
      
      console.log('🎉 APPOINTMENTS ARE ACCESSIBLE! Dashboard should show them.');
      console.log('💡 If dashboard still shows 0, check React state/component rendering.');
    }
  }
  
  // Step 4: Test patients table access
  console.log('5. Testing patients table access...');
  const { data: patients, error: patientsError } = await client
    .from('patients')
    .select('id, first_name, last_name')
    .eq('practice_id', practiceId)
    .limit(5);
    
  if (patientsError) {
    console.log('❌ Patients query failed:', patientsError.message);
  } else {
    console.log('✅ Patients accessible:', patients?.length || 0);
  }
  
  // Step 5: Test users table access
  console.log('6. Testing users table access...');
  const { data: users, error: usersError } = await client
    .from('users')
    .select('id, full_name, role')
    .eq('practice_id', practiceId)
    .limit(5);
    
  if (usersError) {
    console.log('❌ Users query failed:', usersError.message);
  } else {
    console.log('✅ Users accessible:', users?.length || 0);
  }
};

// Auto-run
testAuthFlow();