import { createClient } from '@supabase/supabase-js';

const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';
const supabase = createClient('https://jjxlfunlbyayxwvlpgwt.supabase.co', serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testServiceRole() {
  console.log('Testing service role permissions...\n');
  
  // Test 1: Check current role
  console.log('1. Testing current role...');
  try {
    const { data, error } = await supabase.rpc('sql', { 
      query: 'SELECT current_user, current_role, session_user;' 
    });
    console.log('✅ Role test:', { data, error: error?.message });
  } catch (err) {
    console.log('❌ Role test failed:', err.message);
  }
  
  // Test 2: Direct table access
  console.log('\n2. Testing direct table access...');
  const testData = {
    slug: 'test-practice-' + Date.now(),
    name: 'Test Practice',
    domain: 'test.example.com',
    contact_email: 'test@example.com'
  };
  
  try {
    const { data, error } = await supabase
      .from('practices')
      .insert(testData)
      .select();
      
    console.log('✅ Insert result:', { 
      success: !error, 
      dataCount: data ? data.length : 0, 
      errorMsg: error ? error.message : null 
    });
    
    if (data && data.length > 0) {
      await supabase.from('practices').delete().eq('id', data[0].id);
      console.log('✅ Test data cleaned up');
    }
  } catch (err) {
    console.log('❌ Insert test failed:', err.message);
  }
  
  // Test 3: Storage access
  console.log('\n3. Testing storage access...');
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    console.log('✅ Storage test:', { bucketCount: buckets ? buckets.length : 0, error: error?.message });
    
    // Try creating a bucket
    const bucketName = 'test-bucket-' + Date.now();
    const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true });
    
    if (!createError) {
      console.log('✅ Bucket creation successful');
      // Clean up
      await supabase.storage.deleteBucket(bucketName);
      console.log('✅ Test bucket cleaned up');
    } else {
      console.log('❌ Bucket creation failed:', createError.message);
    }
  } catch (err) {
    console.log('❌ Storage test failed:', err.message);
  }
  
  // Test 4: RLS bypass check
  console.log('\n4. Testing RLS bypass...');
  try {
    // Try to access all practices (should bypass RLS with service role)
    const { data, error } = await supabase
      .from('practices')
      .select('id, name, slug')
      .limit(5);
      
    console.log('✅ RLS bypass test:', { 
      success: !error, 
      practiceCount: data ? data.length : 0, 
      errorMsg: error ? error.message : null 
    });
    
    if (data && data.length > 0) {
      console.log('   Found practices:', data.map(p => p.name).join(', '));
    }
  } catch (err) {
    console.log('❌ RLS bypass test failed:', err.message);
  }
}

testServiceRole().catch(console.error);