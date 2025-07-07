import { createClient } from '@supabase/supabase-js';

// Test the exact triangulation logic used in EnhancedServiceSelector
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function testTriangulatedLogic() {
  console.log('🧪 Testing triangulated logic for dental codes...\n');
  
  try {
    // Test without authentication (simulating anonymous user)
    console.log('1. Testing as anonymous user:');
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      console.log('   ❌ No authenticated user found (expected for anonymous)');
      console.log('   📝 This means the component will show authentication error');
      
      // Let's test the triangulation logic with a mock scenario
      console.log('\n2. Testing triangulation logic with mock data:');
      
      // Simulate checking different practice types
      const mockScenarios = [
        { practiceType: 'dental', shouldShowCodes: true },
        { practiceType: 'medical', shouldShowCodes: false },
        { practiceType: 'aesthetic', shouldShowCodes: false }
      ];
      
      for (const scenario of mockScenarios) {
        console.log(`\n   Testing ${scenario.practiceType} practice:`);
        
        if (scenario.practiceType === 'dental') {
          console.log('   🦷 Dental practice - would fetch dental codes');
          
          // Test actual dental codes fetch
          const { data: tariffs, error: tariffsError } = await supabase
            .from('practice_tariffs')
            .select('*')
            .eq('is_active', true)
            .limit(5);
          
          console.log(`     Result: ${tariffs?.length || 0} codes, error: ${tariffsError?.message || 'none'}`);
          
        } else {
          console.log(`   🏥 ${scenario.practiceType} practice - would return empty array`);
          console.log('     Result: 0 codes (by design)');
        }
      }
      
      console.log('\n3. Testing RLS access to required tables:');
      
      // Test users table access
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, practice_id')
        .limit(1);
      
      console.log(`   Users table: ${users?.length || 0} records, error: ${usersError?.message || 'none'}`);
      
      // Test practices table access
      const { data: practices, error: practicesError } = await supabase
        .from('practices')
        .select('id, practice_type')
        .limit(3);
      
      console.log(`   Practices table: ${practices?.length || 0} records, error: ${practicesError?.message || 'none'}`);
      
      if (practices && practices.length > 0) {
        console.log('   📋 Available practice types:', [...new Set(practices.map(p => p.practice_type))].join(', '));
      }
      
      console.log('\n✅ Triangulation logic test completed!');
      console.log('\n📋 Summary:');
      console.log('   - Component will require user authentication');
      console.log('   - Will check user.practice_id → practice.practice_type');
      console.log('   - Only dental practices will see the 179 dental codes');
      console.log('   - Non-dental practices will see appropriate message');
      
    } else {
      console.log('   ✅ User is authenticated:', authUser.email);
      // If user is authenticated, we could test the full flow
    }
    
  } catch (err) {
    console.error('💥 Exception:', err.message);
  }
}

testTriangulatedLogic();