// STEP-BY-STEP DASHBOARD TEST
// Copy and paste this in the browser console while on your HPMS dashboard

console.log('🧪 === STEP-BY-STEP DASHBOARD TEST ===');

// Test 1: Check if we're on the dashboard
const currentUrl = window.location.href;
console.log('1. Current URL:', currentUrl);

// Test 2: Check Supabase client
const checkSupabaseClient = () => {
  // Check if supabase is available globally
  if (window.supabase) {
    console.log('2. ✅ Found global Supabase client');
    return window.supabase;
  }
  
  // Try to find it in React components
  const rootElement = document.querySelector('#root');
  if (rootElement?._reactInternalFiber || rootElement?._reactInternals) {
    console.log('2. ⚠️ React app found but no global Supabase. Creating manual client...');
  }
  
  // Create our own client
  console.log('2. 🔧 Creating test Supabase client...');
  
  const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
  
  if (typeof supabase !== 'undefined') {
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.log('2. ❌ Supabase not available. Import manually:');
    console.log('Run this first: await import("https://cdn.skypack.dev/@supabase/supabase-js")');
    return null;
  }
};

const runTestSequence = async () => {
  const client = checkSupabaseClient();
  
  if (!client) {
    console.log('❌ Cannot proceed without Supabase client');
    return;
  }

  // Test 3: Check authentication
  console.log('3. 🔐 Checking authentication...');
  const { data: { user }, error: authError } = await client.auth.getUser();
  
  if (authError) {
    console.log('3. ❌ Auth error:', authError.message);
    return;
  }
  
  if (!user) {
    console.log('3. ❌ No authenticated user found');
    console.log('   Try logging out and logging back in');
    return;
  }
  
  console.log('3. ✅ User authenticated:', {
    id: user.id,
    email: user.email,
    created_at: user.created_at
  });

  // Test 4: Check user profile
  console.log('4. 👤 Checking user profile...');
  const { data: userProfile, error: profileError } = await client
    .from('users')
    .select('id, email, full_name, role, practice_id')
    .eq('id', user.id)
    .single();
    
  if (profileError) {
    console.log('4. ❌ Profile error:', profileError.message);
    console.log('   This might be why appointments aren\'t showing');
  } else {
    console.log('4. ✅ User profile:', userProfile);
  }

  const practiceId = userProfile?.practice_id || 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
  console.log('Using practice ID:', practiceId);

  // Test 5: Check RLS policies - raw appointment count
  console.log('5. 📊 Testing appointments query (raw)...');
  const { data: rawAppointments, error: rawError } = await client
    .from('appointments')
    .select('id, date, status, practice_id')
    .eq('practice_id', practiceId);
    
  if (rawError) {
    console.log('5. ❌ Raw query error:', rawError.message);
    console.log('   This confirms RLS is blocking the query');
  } else {
    console.log('5. ✅ Raw appointments found:', rawAppointments?.length || 0);
    if (rawAppointments && rawAppointments.length > 0) {
      console.log('   Sample:', rawAppointments.slice(0, 2).map(a => ({
        id: a.id.substring(0, 8),
        date: a.date,
        status: a.status
      })));
    }
  }

  // Test 6: Check the exact query used by practiceDataService
  console.log('6. 🔍 Testing exact practiceDataService query...');
  const { data: fullAppointments, error: fullError } = await client
    .from('appointments')
    .select(`
      *,
      patient:patients(id, first_name, last_name, cell_number, date_of_birth, gender),
      doctor:users!doctor_id(id, full_name, practice_id)
    `)
    .eq('practice_id', practiceId)
    .order('date', { ascending: true })
    .order('time', { ascending: true });
    
  if (fullError) {
    console.log('6. ❌ Full query error:', fullError.message);
    console.log('   Details:', fullError);
  } else {
    console.log('6. ✅ Full appointments found:', fullAppointments?.length || 0);
    if (fullAppointments && fullAppointments.length > 0) {
      console.log('   Sample appointments:');
      fullAppointments.slice(0, 3).forEach((apt, idx) => {
        console.log(`   ${idx + 1}. ${apt.date} ${apt.time} - ${apt.patient?.first_name} ${apt.patient?.last_name} - ${apt.status}`);
      });
    }
  }

  // Test 7: Check localStorage for auth tokens
  console.log('7. 🗄️ Checking auth storage...');
  const authKeys = Object.keys(localStorage).filter(key => key.includes('supabase'));
  if (authKeys.length === 0) {
    console.log('7. ⚠️ No Supabase auth keys in localStorage');
  } else {
    authKeys.forEach(key => {
      const value = localStorage.getItem(key);
      try {
        const parsed = JSON.parse(value);
        console.log(`7. ${key}:`, {
          hasAccessToken: !!parsed.access_token,
          hasRefreshToken: !!parsed.refresh_token,
          expiresAt: parsed.expires_at
        });
      } catch {
        console.log(`7. ${key}:`, value ? 'Has value' : 'Empty');
      }
    });
  }

  // Test 8: Final diagnosis
  console.log('8. 🩺 DIAGNOSIS:');
  
  if (rawError) {
    console.log('   ❌ PROBLEM: RLS policies are blocking appointment access');
    console.log('   💡 SOLUTION: Apply the RLS fix in fix-appointments-rls.sql');
  } else if (!rawAppointments || rawAppointments.length === 0) {
    console.log('   ❌ PROBLEM: No appointments found for this practice');
    console.log('   💡 CHECK: Verify practice_id and appointments exist');
  } else if (fullError) {
    console.log('   ❌ PROBLEM: Basic query works but JOIN query fails');
    console.log('   💡 CHECK: RLS policies on patients or users tables');
  } else if (fullAppointments && fullAppointments.length > 0) {
    console.log('   ✅ APPOINTMENTS FOUND! Query works in browser console');
    console.log('   💡 PROBLEM: Issue is in the React application state/auth');
    console.log('   🔄 Try refreshing the page or clearing localStorage');
  }
};

// Auto-run if Supabase is available, otherwise provide instructions
if (typeof supabase !== 'undefined') {
  runTestSequence();
} else {
  console.log('❌ Supabase not available globally. Run this first:');
  console.log('');
  console.log('const { createClient } = await import("https://cdn.skypack.dev/@supabase/supabase-js");');
  console.log('window.supabase = { createClient };');
  console.log('');
  console.log('Then paste this script again.');
}