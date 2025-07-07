import { createClient } from '@supabase/supabase-js';

async function testDirectAccess() {
  console.log('🔍 Testing direct database access...\n');
  
  // Test 1: Service role access
  console.log('Test 1: Service role access');
  const serviceClient = createClient(
    'https://jjxlfunlbyayxwvlpgwt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
  );
  
  try {
    const { data, error, count } = await serviceClient
      .from('practice_tariffs')
      .select('*', { count: 'exact' })
      .limit(5);
    
    console.log('Service role result:', { error: error?.message, count, dataLength: data?.length });
    if (data && data.length > 0) {
      console.log('Sample data:', data[0]);
    }
  } catch (err) {
    console.log('Service role exception:', err.message);
  }
  
  // Test 2: Anonymous access
  console.log('\nTest 2: Anonymous access');
  const anonClient = createClient(
    'https://jjxlfunlbyayxwvlpgwt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
  );
  
  try {
    const { data, error, count } = await anonClient
      .from('practice_tariffs')
      .select('*', { count: 'exact' })
      .limit(5);
    
    console.log('Anon result:', { error: error?.message, count, dataLength: data?.length });
    if (data && data.length > 0) {
      console.log('Sample data:', data[0]);
    }
  } catch (err) {
    console.log('Anon exception:', err.message);
  }
  
  // Test 3: Check if RLS is the issue - try disabling it temporarily
  console.log('\nTest 3: Checking table permissions');
  try {
    const { data: tableInfo } = await serviceClient
      .rpc('exec_sql', {
        sql: `
          SELECT 
            tablename,
            tableowner,
            hasindexes,
            hasrules,
            hastriggers,
            rowsecurity
          FROM pg_tables 
          WHERE tablename = 'practice_tariffs';
        `
      });
    
    console.log('Table info:', tableInfo);
  } catch (err) {
    console.log('Table info error:', err.message);
  }
}

testDirectAccess();