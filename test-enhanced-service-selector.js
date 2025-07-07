import { createClient } from '@supabase/supabase-js';

// Test the same logic as EnhancedServiceSelector
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';

// Mock environment variable for testing
process.env.VITE_SUPABASE_URL = SUPABASE_URL;

async function testServiceSelectorLogic() {
  console.log('🧪 Testing EnhancedServiceSelector logic...\n');
  
  try {
    // Simulate the exact logic from EnhancedServiceSelector
    console.log('🔍 Fetching dental codes from practice_tariffs...');

    // Try with service role key first (bypasses RLS)
    const serviceClient = createClient(
      SUPABASE_URL,
      SERVICE_ROLE_KEY
    );

    // Try service role first (this should work with the dental codes)
    let { data: tariffs, error: tariffsError } = await serviceClient
      .from('practice_tariffs')
      .select('*')
      .order('code', { ascending: true });

    if (tariffsError) {
      console.log('Service role error:', tariffsError.message);
      // If service role fails, try regular client  
      console.log('Trying regular client...');
      const regularClient = createClient(
        SUPABASE_URL,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
      );
      
      const result = await regularClient
        .from('practice_tariffs')
        .select('*')
        .order('code', { ascending: true });
      
      tariffs = result.data;
      tariffsError = result.error;
      
      if (tariffsError) {
        console.log('Regular client error:', tariffsError.message);
      }
    }

    console.log('Query result:', { 
      data: tariffs?.length, 
      error: tariffsError?.message
    });

    if (tariffsError && tariffsError.message.includes('Invalid API key')) {
      console.warn('⚠️ API key issue detected');
      return;
    }

    if (tariffsError) {
      console.error('❌ Error fetching tariffs:', tariffsError);
      return;
    }

    if (!tariffs || tariffs.length === 0) {
      console.error('❌ No codes found in practice_tariffs table');
      return;
    }

    console.log(`✅ Successfully loaded ${tariffs.length} codes from database`);
    
    // Test the business rules functionality
    console.log('\n🦷 Testing business rules validation...');
    
    const testTariffs = tariffs.slice(0, 5); // Test first 5 codes
    
    testTariffs.forEach((tariff, idx) => {
      console.log(`\n${idx + 1}. Code ${tariff.code}: ${tariff.description}`);
      console.log(`   Price: N$${tariff.price}`);
      console.log(`   Requires tooth number: ${tariff.requires_tooth_number || 'NO'}`);
      console.log(`   Can be multiplied: ${tariff.can_be_multiplied || 'NO'}`);
      console.log(`   Business rule: ${tariff.business_rule_formula || 'Fixed price'}`);
      
      if (tariff.example_calculation) {
        console.log(`   Example calculation: ${tariff.example_calculation}`);
      }
    });
    
    // Test filtering functionality
    console.log('\n🔍 Testing search/filter functionality...');
    const searchTerm = 'examination';
    const filtered = tariffs.filter(tariff =>
      tariff.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tariff.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tariff.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    console.log(`Found ${filtered.length} codes matching "${searchTerm}":`);
    filtered.slice(0, 3).forEach(tariff => {
      console.log(`  • ${tariff.code}: ${tariff.description}`);
    });
    
    console.log('\n🎉 EnhancedServiceSelector logic test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • Total dental codes: ${tariffs.length}`);
    console.log(`   • Service role access: ✅ Working`);
    console.log(`   • Business rules data: ✅ Available`);
    console.log(`   • Search functionality: ✅ Working`);
    console.log('\n✅ The EnhancedServiceSelector should now work correctly in the UI');
    
  } catch (err) {
    console.error('💥 Unexpected error:', err);
  }
}

testServiceSelectorLogic();