// Browser debug script - run this in the browser console
// Navigate to localhost:5001 and paste this in the developer console

console.log('🔍 Debug: Testing dental codes access from browser...');

// Test 1: Check if Supabase is available
if (typeof window.supabase === 'undefined') {
  console.log('❌ Supabase not available globally, using direct import...');
  
  // Test with service role key
  const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js');
  
  const serviceClient = createClient(
    'https://jjxlfunlbyayxwvlpgwt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
  );
  
  console.log('🔄 Testing service role access...');
  
  try {
    const { data, error, count } = await serviceClient
      .from('practice_tariffs')
      .select('*', { count: 'exact' })
      .limit(5);
    
    if (error) {
      console.log('❌ Service role error:', error);
    } else {
      console.log('✅ Service role success:', { count, sampleData: data });
    }
  } catch (err) {
    console.log('💥 Service role exception:', err);
  }
  
  // Test with anon key
  const anonClient = createClient(
    'https://jjxlfunlbyayxwvlpgwt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
  );
  
  console.log('🔄 Testing anon access...');
  
  try {
    const { data, error, count } = await anonClient
      .from('practice_tariffs')
      .select('*', { count: 'exact' })
      .limit(5);
    
    if (error) {
      console.log('❌ Anon error:', error);
    } else {
      console.log('✅ Anon success:', { count, sampleData: data });
    }
  } catch (err) {
    console.log('💥 Anon exception:', err);
  }
  
} else {
  console.log('✅ Supabase available globally');
}