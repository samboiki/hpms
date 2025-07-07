const { createClient } = require('@supabase/supabase-js');

// Using the current anon key from .env
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function testFetch() {
  console.log('Testing practice_tariffs fetch...\n');
  
  // Test 1: Basic select
  console.log('Test 1: Basic select all');
  const { data: test1, error: error1 } = await supabase
    .from('practice_tariffs')
    .select('*')
    .limit(5);
  
  if (error1) {
    console.error('Error:', error1);
  } else {
    console.log(`Found ${test1?.length || 0} records`);
    if (test1 && test1.length > 0) {
      console.log('First record:', test1[0]);
    }
  }
  
  // Test 2: Count
  console.log('\nTest 2: Count records');
  const { count, error: error2 } = await supabase
    .from('practice_tariffs')
    .select('*', { count: 'exact', head: true });
  
  if (error2) {
    console.error('Error:', error2);
  } else {
    console.log(`Total count: ${count}`);
  }
  
  // Test 3: Specific columns
  console.log('\nTest 3: Select specific columns');
  const { data: test3, error: error3 } = await supabase
    .from('practice_tariffs')
    .select('code, description, price')
    .limit(5);
  
  if (error3) {
    console.error('Error:', error3);
  } else {
    console.log(`Found ${test3?.length || 0} records`);
    test3?.forEach(record => {
      console.log(`  ${record.code}: ${record.description} - N$${record.price}`);
    });
  }
  
  // Test 4: Check if RLS is blocking
  console.log('\nTest 4: RLS check');
  const { data: test4, error: error4 } = await supabase.rpc('current_setting', { 
    setting: 'role' 
  }).single();
  
  if (!error4) {
    console.log('Current role:', test4);
  }
}

testFetch().catch(console.error);