// SIMPLE VERCEL AUTH TEST
// Paste this in browser console on https://onehealthx.vercel.app/

console.log('🔍 === SIMPLE VERCEL AUTH TEST ===');

// Create our own clean Supabase client
const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js');

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true }
});

console.log('✅ Created fresh Supabase client');

// Test 1: Check auth state
console.log('1. Checking auth state...');
const { data: { user }, error: authError } = await client.auth.getUser();

console.log('Auth result:', {
  hasUser: !!user,
  email: user?.email,
  error: authError?.message
});

// Test 2: Check localStorage
console.log('2. Checking localStorage...');
const authKeys = Object.keys(localStorage).filter(key => key.includes('supabase'));
console.log('Auth keys found:', authKeys);

if (authKeys.length === 0) {
  console.log('❌ NO AUTH TOKENS IN LOCALSTORAGE');
  console.log('💡 User is not logged in on Vercel');
  console.log('🔄 Try logging in again');
} else {
  authKeys.forEach(key => {
    const value = localStorage.getItem(key);
    try {
      const parsed = JSON.parse(value);
      console.log(`${key}:`, {
        hasUser: !!parsed.user,
        userEmail: parsed.user?.email,
        hasTokens: !!(parsed.access_token && parsed.refresh_token)
      });
    } catch {
      console.log(`${key}: Invalid data`);
    }
  });
}

if (!user) {
  console.log('❌ DIAGNOSIS: User not authenticated on Vercel');
  console.log('💡 SOLUTION: Log out completely and log back in');
  return;
}

// Test 3: Get practice_id
console.log('3. Getting practice_id...');
const { data: profile, error: profileError } = await client
  .from('users')
  .select('practice_id, role, full_name')
  .eq('id', user.id)
  .single();

if (profileError) {
  console.log('❌ Profile error:', profileError.message);
  if (user.user_metadata?.practice_id) {
    console.log('✅ Using metadata practice_id:', user.user_metadata.practice_id);
    var practiceId = user.user_metadata.practice_id;
  } else {
    console.log('❌ No practice_id found');
    return;
  }
} else {
  console.log('✅ Profile found:', profile);
  var practiceId = profile.practice_id;
}

// Test 4: Query appointments
console.log('4. Testing appointments query...');
const { data: appointments, error: apptError } = await client
  .from('appointments')
  .select('id, date, status, practice_id')
  .eq('practice_id', practiceId);

console.log('📊 Appointments result:', {
  count: appointments?.length || 0,
  error: apptError?.message
});

if (appointments && appointments.length > 0) {
  console.log('✅ APPOINTMENTS FOUND ON VERCEL!');
  console.log('Sample:', appointments.slice(0, 2));
  console.log('💡 The issue is in the React app, not the database');
} else if (apptError) {
  console.log('❌ QUERY FAILED:', apptError.message);
} else {
  console.log('⚠️ No appointments returned (but no error)');
}

console.log('🔍 FINAL DIAGNOSIS:');
if (!user) {
  console.log('❌ Authentication is broken on Vercel');
} else if (apptError) {
  console.log('❌ Database access is broken on Vercel');
} else if (appointments && appointments.length > 0) {
  console.log('✅ Everything works! React app has rendering issue');
} else {
  console.log('⚠️ No data but no errors - check practice_id');
}