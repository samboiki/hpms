import { createClient } from '@supabase/supabase-js';

// Use the correct service role key provided by user
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';

async function testDentalCodesAccess() {
  console.log('🔍 Testing dental codes access with correct service role key...\n');
  
  // Create client with service role key
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  
  try {
    // Test 1: Count total records
    console.log('📊 Test 1: Counting total records...');
    const { count, error: countError } = await serviceClient
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log(`❌ Count error: ${countError.message}`);
      return;
    }
    
    console.log(`✅ Total records found: ${count}`);
    
    // Test 2: Fetch first 10 records
    console.log('\n📋 Test 2: Fetching first 10 records...');
    const { data: tariffs, error: fetchError } = await serviceClient
      .from('practice_tariffs')
      .select('code, description, price, official_2025_price_nad, can_be_multiplied, requires_tooth_number')
      .limit(10);
    
    if (fetchError) {
      console.log(`❌ Fetch error: ${fetchError.message}`);
      return;
    }
    
    if (!tariffs || tariffs.length === 0) {
      console.log('❌ No records returned');
      return;
    }
    
    console.log(`✅ Successfully fetched ${tariffs.length} records:`);
    tariffs.forEach((tariff, idx) => {
      console.log(`  ${idx + 1}. ${tariff.code}: ${tariff.description} - N$${tariff.price}`);
      if (tariff.can_be_multiplied === 'YES') {
        console.log(`     🔄 Can be multiplied`);
      }
      if (tariff.requires_tooth_number === 'YES') {
        console.log(`     🦷 Requires tooth number`);
      }
    });
    
    // Test 3: Test specific dental codes from the 179 list
    console.log('\n🎯 Test 3: Testing specific dental codes...');
    const testCodes = ['8101', '8211', '8341', '8501', '8826'];
    
    for (const code of testCodes) {
      const { data: codeData, error: codeError } = await serviceClient
        .from('practice_tariffs')
        .select('*')
        .eq('code', code)
        .single();
      
      if (codeError) {
        console.log(`  ❌ Code ${code}: ${codeError.message}`);
      } else if (codeData) {
        console.log(`  ✅ Code ${code}: ${codeData.description} - N$${codeData.price}`);
      } else {
        console.log(`  ⚠️  Code ${code}: Not found`);
      }
    }
    
    // Test 4: Test regular anon client
    console.log('\n🔍 Test 4: Testing with regular anon client...');
    const anonClient = createClient(
      SUPABASE_URL,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
    );
    
    const { count: anonCount, error: anonError } = await anonClient
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    if (anonError) {
      console.log(`❌ Anon client error: ${anonError.message}`);
      console.log('⚠️  This indicates RLS is blocking access for anonymous users');
    } else {
      console.log(`✅ Anon client can see ${anonCount} records`);
    }
    
    console.log('\n🎉 Access test completed!');
    
    if (count > 0) {
      console.log('\n✅ SUMMARY: Dental codes are accessible with service role key');
      console.log(`   • Total codes: ${count}`);
      console.log(`   • Service role access: ✅ Working`);
      console.log(`   • Anon access: ${anonError ? '❌ Blocked by RLS' : '✅ Working'}`);
      
      console.log('\n📝 Next steps:');
      console.log('   1. Update EnhancedServiceSelector to handle RLS properly');
      console.log('   2. Test the UI to ensure dental codes display correctly');
      console.log('   3. Run the development server to verify integration');
    }
    
  } catch (err) {
    console.error('💥 Unexpected error:', err);
  }
}

testDentalCodesAccess();