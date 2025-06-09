import { createClient } from '@supabase/supabase-js';

// Test triangulated access pattern
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function testTriangulatedAccess() {
  console.log('🔍 Testing triangulated access pattern...\n');
  
  try {
    // Step 1: Check if we can access users table (anonymously)
    console.log('1. Testing users table access:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, practice_id')
      .limit(1);
    
    console.log('   Users:', { 
      count: users?.length || 0, 
      error: usersError?.message || 'none',
      samplePracticeId: users?.[0]?.practice_id || 'none'
    });
    
    // Step 2: Check practices table access
    console.log('\n2. Testing practices table access:');
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, practice_type')
      .limit(3);
    
    console.log('   Practices:', { 
      count: practices?.length || 0, 
      error: practicesError?.message || 'none',
      sampleTypes: practices?.map(p => p.practice_type) || []
    });
    
    // Step 3: Check practice_tariffs with type filter
    console.log('\n3. Testing practice_tariffs with type filter:');
    
    // Try 'dental' type
    const { data: dentalTariffs, error: dentalError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .eq('type', 'dental')
      .eq('is_active', true)
      .limit(5);
    
    console.log('   Dental tariffs:', { 
      count: dentalTariffs?.length || 0, 
      error: dentalError?.message || 'none',
      sampleCodes: dentalTariffs?.map(t => t.code) || []
    });
    
    // Try without type filter to see all types
    const { data: allTariffs, error: allError } = await supabase
      .from('practice_tariffs')
      .select('type')
      .eq('is_active', true)
      .limit(10);
    
    console.log('   All tariff types:', { 
      count: allTariffs?.length || 0, 
      error: allError?.message || 'none',
      types: [...new Set(allTariffs?.map(t => t.type) || [])]
    });
    
    // Step 4: Test the full triangulation if we have data
    if (practices && practices.length > 0) {
      console.log('\n4. Testing full triangulation with sample practice:');
      const samplePractice = practices[0];
      
      const { data: practiceTypeTariffs, error: triangulationError } = await supabase
        .from('practice_tariffs')
        .select('*')
        .eq('type', samplePractice.practice_type)
        .eq('is_active', true)
        .limit(5);
      
      console.log(`   Tariffs for practice type "${samplePractice.practice_type}":`, { 
        count: practiceTypeTariffs?.length || 0, 
        error: triangulationError?.message || 'none',
        sampleCodes: practiceTypeTariffs?.map(t => t.code) || []
      });
    }
    
  } catch (err) {
    console.error('💥 Exception:', err.message);
  }
}

testTriangulatedAccess();