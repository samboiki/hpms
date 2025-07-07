import { createClient } from '@supabase/supabase-js';

// Test the same way patients are accessed
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function testRLSAccess() {
  console.log('🧪 Testing RLS access patterns...\n');
  
  // Test 1: Practice tariffs (what we're trying to fix)
  console.log('1. Testing practice_tariffs access (dental codes):');
  try {
    const { data: tariffs, error: tariffsError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .eq('is_active', true)
      .order('code', { ascending: true });
    
    console.log('   Result:', { 
      count: tariffs?.length || 0, 
      error: tariffsError?.message || 'none',
      sampleCode: tariffs?.[0]?.code || 'none'
    });
  } catch (err) {
    console.log('   Exception:', err.message);
  }
  
  // Test 2: Patients access (what works)
  console.log('\n2. Testing patients access (what works):');
  try {
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('*')
      .limit(5);
    
    console.log('   Result:', { 
      count: patients?.length || 0, 
      error: patientsError?.message || 'none',
      sampleName: patients?.[0] ? `${patients[0].first_name} ${patients[0].last_name}` : 'none'
    });
  } catch (err) {
    console.log('   Exception:', err.message);
  }
  
  // Test 3: Try different tariffs query patterns
  console.log('\n3. Testing different tariffs query patterns:');
  
  // Pattern A: Without filters
  try {
    const { data, error } = await supabase
      .from('practice_tariffs')
      .select('*')
      .limit(5);
    
    console.log('   A (no filters):', { 
      count: data?.length || 0, 
      error: error?.message || 'none'
    });
  } catch (err) {
    console.log('   A Exception:', err.message);
  }
  
  // Pattern B: With practice_id filter
  try {
    const { data, error } = await supabase
      .from('practice_tariffs')
      .select('*')
      .eq('practice_id', 'some-practice-id')
      .limit(5);
    
    console.log('   B (with practice_id):', { 
      count: data?.length || 0, 
      error: error?.message || 'none'
    });
  } catch (err) {
    console.log('   B Exception:', err.message);
  }
  
  // Pattern C: Just get count
  try {
    const { count, error } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    console.log('   C (count only):', { 
      count: count || 0, 
      error: error?.message || 'none'
    });
  } catch (err) {
    console.log('   C Exception:', err.message);
  }
}

testRLSAccess();