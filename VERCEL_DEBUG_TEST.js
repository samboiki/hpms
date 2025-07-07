// VERCEL PRODUCTION DEBUG TEST
// Paste this in browser console on https://onehealthx.vercel.app/

console.log('🔍 === VERCEL PRODUCTION DEBUG ===');

const debugVercelAuth = async () => {
  console.log('Environment:', window.location.href);
  
  // Check if we can create a Supabase client
  let client;
  
  const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
  
  // Try to access the app's Supabase client first
  if (window.supabase) {
    console.log('✅ Found app Supabase client');
    client = window.supabase;
  } else {
    console.log('🔧 Creating test Supabase client');
    
    if (typeof supabase !== 'undefined') {
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true }
      });
    } else {
      console.log('❌ Need to import Supabase. Run this first:');
      console.log('const { createClient } = await import("https://cdn.skypack.dev/@supabase/supabase-js");');
      console.log('window.supabase = { createClient };');
      return;
    }
  }

  // Step 1: Check authentication state
  console.log('1. 🔐 Checking auth state...');
  const { data: { user }, error: authError } = await client.auth.getUser();
  
  console.log('Auth result:', {
    hasUser: !!user,
    userId: user?.id,
    email: user?.email,
    error: authError?.message,
    createdAt: user?.created_at
  });

  // Step 2: Check session storage
  console.log('2. 🗄️ Checking auth storage...');
  const authKeys = Object.keys(localStorage).filter(key => key.includes('supabase'));
  console.log('Auth storage keys:', authKeys);
  
  authKeys.forEach(key => {
    const value = localStorage.getItem(key);
    try {
      const parsed = JSON.parse(value);
      console.log(`${key}:`, {
        hasAccessToken: !!parsed.access_token,
        hasRefreshToken: !!parsed.refresh_token,
        expiresAt: parsed.expires_at,
        user: parsed.user?.email
      });
    } catch {
      console.log(`${key}: Invalid JSON`);
    }
  });

  if (!user) {
    console.log('❌ NO USER AUTHENTICATED ON VERCEL');
    console.log('💡 This is why appointments are 0');
    console.log('🔄 Try logging out completely and logging back in');
    
    // Check if there's a session but getUser failed
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    console.log('Session check:', {
      hasSession: !!session,
      sessionUser: session?.user?.email,
      error: sessionError?.message
    });
    
    return;
  }

  // Step 3: Test the exact appointment query that's failing
  console.log('3. 📊 Testing appointment query...');
  
  // First, get the practice_id from user profile
  const { data: userProfile, error: profileError } = await client
    .from('users')
    .select('id, practice_id, role, full_name')
    .eq('id', user.id)
    .single();
    
  if (profileError) {
    console.log('❌ User profile error:', profileError.message);
    
    // Check if user has metadata
    if (user.user_metadata?.practice_id) {
      console.log('✅ Found practice_id in metadata:', user.user_metadata.practice_id);
      var practiceId = user.user_metadata.practice_id;
    } else {
      console.log('❌ No practice_id found anywhere');
      return;
    }
  } else {
    console.log('✅ User profile found:', userProfile);
    var practiceId = userProfile.practice_id;
  }

  if (!practiceId) {
    console.log('❌ No practice_id - this is the problem!');
    return;
  }

  console.log('📍 Using practice_id:', practiceId);

  // Test the exact query from practiceDataService
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

  console.log('📋 Appointment query result:', {
    count: appointments?.length || 0,
    error: appointmentError?.message,
    errorDetails: appointmentError
  });

  if (appointmentError) {
    console.log('❌ QUERY FAILED - This is why dashboard shows 0');
    
    // Test basic query
    const { data: basicAppts, error: basicError } = await client
      .from('appointments')
      .select('id, date, status')
      .eq('practice_id', practiceId);
      
    console.log('Basic query result:', {
      count: basicAppts?.length || 0,
      error: basicError?.message
    });
    
  } else if (appointments && appointments.length > 0) {
    console.log('✅ APPOINTMENTS FOUND!', appointments.length);
    console.log('Sample:', appointments.slice(0, 2).map(a => ({
      date: a.date,
      patient: `${a.patient?.first_name} ${a.patient?.last_name}`,
      status: a.status
    })));
    console.log('🎉 The query works! Check React app state/rendering.');
  } else {
    console.log('⚠️ Query succeeded but no appointments returned');
  }

  // Step 4: Compare with localhost behavior
  console.log('4. 🔄 Diagnosis:');
  if (!user) {
    console.log('❌ ISSUE: Not authenticated on Vercel');
    console.log('💡 FIX: Log out completely, clear storage, log back in');
  } else if (appointmentError) {
    console.log('❌ ISSUE: Database query failing on Vercel');
    console.log('💡 FIX: Check RLS policies or Vercel environment');
  } else if (appointments && appointments.length > 0) {
    console.log('✅ GOOD: Auth and query work on Vercel');
    console.log('💡 ISSUE: React app not displaying the data');
  }
};

// Auto-run if Supabase available
if (typeof supabase !== 'undefined') {
  debugVercelAuth();
} else {
  console.log('Setting up Supabase...');
  import('https://cdn.skypack.dev/@supabase/supabase-js').then(module => {
    window.supabase = module;
    debugVercelAuth();
  }).catch(err => {
    console.log('❌ Failed to load Supabase. Run manually:');
    console.log('const { createClient } = await import("https://cdn.skypack.dev/@supabase/supabase-js");');
    console.log('window.supabase = { createClient };');
  });
}