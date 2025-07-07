// Copy and paste this ENTIRE script into the browser console while on the dashboard
// This will debug the exact issue in the live environment

console.log('🔍 === BROWSER CONSOLE DEBUG TEST ===');

// Test 1: Check if we can access the Supabase client
const checkSupabase = () => {
  // Try to find supabase client in various ways
  if (window.supabase) {
    console.log('✅ Found window.supabase');
    return window.supabase;
  }
  
  // Look for it in React context or other globals
  const reactFiber = document.querySelector('#root')?._reactInternalFiber || 
                    document.querySelector('#root')?._reactInternals;
  
  console.log('❌ No direct supabase access, need to create client');
  return null;
};

const supabaseClient = checkSupabase();

// Test 2: Create our own client if needed
const createTestClient = () => {
  console.log('🔧 Creating test Supabase client...');
  
  // These should match your environment variables
  const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
  
  // Import Supabase dynamically
  return import('https://cdn.skypack.dev/@supabase/supabase-js').then(module => {
    return module.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });
};

// Test 3: Run the actual test
const runTest = async (client) => {
  console.log('🧪 Running appointment query test...');
  
  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
  
  // Check auth state
  const { data: { user }, error: authError } = await client.auth.getUser();
  console.log('👤 Current user:', { id: user?.id, email: user?.email, error: authError?.message });
  
  if (!user) {
    console.log('❌ No authenticated user - this is likely the issue!');
    console.log('💡 Try logging out and logging back in');
    return;
  }
  
  // Test the exact query
  console.log('📊 Testing appointment query...');
  const { data: appointments, error: queryError } = await client
    .from('appointments')
    .select(`
      *,
      patient:patients(id, first_name, last_name, cell_number, date_of_birth, gender),
      doctor:users!doctor_id(id, full_name, practice_id)
    `)
    .eq('practice_id', practiceId);
  
  console.log('📋 Query result:', { 
    count: appointments?.length || 0, 
    error: queryError?.message,
    appointments: appointments?.map(a => ({
      id: a.id.substring(0, 8),
      patient: `${a.patient?.first_name} ${a.patient?.last_name}`,
      date: a.date,
      status: a.status
    }))
  });
  
  if (appointments && appointments.length > 0) {
    console.log('✅ APPOINTMENTS FOUND! The query works in the browser.');
    console.log('🔍 Issue must be in the practiceDataService or component state');
  } else if (queryError) {
    console.log('❌ Query error:', queryError);
    console.log('🔍 Check RLS policies or authentication');
  } else {
    console.log('⚠️ No appointments returned but no error');
    console.log('🔍 Check if practice_id is correct or RLS is blocking');
  }
};

// Execute the test
if (supabaseClient) {
  runTest(supabaseClient);
} else {
  createTestClient().then(client => {
    console.log('✅ Test client created');
    runTest(client);
  }).catch(err => {
    console.log('❌ Failed to create test client:', err);
    console.log('💡 Manual test:');
    console.log('1. Check if you are logged in');
    console.log('2. Check browser Network tab for failed requests');
    console.log('3. Check Application tab > Local Storage for auth tokens');
  });
}

// Also check local storage for auth issues
console.log('🗄️ Checking auth storage...');
const authKeys = Object.keys(localStorage).filter(key => key.includes('supabase') || key.includes('auth'));
console.log('Auth keys in localStorage:', authKeys);
authKeys.forEach(key => {
  const value = localStorage.getItem(key);
  try {
    const parsed = JSON.parse(value);
    console.log(`${key}:`, parsed);
  } catch {
    console.log(`${key}:`, value);
  }
});