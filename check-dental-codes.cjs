const { createClient } = require('@supabase/supabase-js');

// Try both anon and service role keys
// Using the latest anon key from .env
const keys = [
  {
    name: 'Anon',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
  }
];

async function checkDentalCodes() {
  for (const keyInfo of keys) {
    console.log(`\n========== Testing with ${keyInfo.name} Key ==========`);
    
    const supabase = createClient(
      'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      keyInfo.key
    );

    try {
      // Test 1: Simple count
      console.log('\n1. Checking total count...');
      const { count, error: countError } = await supabase
        .from('practice_tariffs')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error(`   ❌ Count Error: ${countError.message}`);
      } else {
        console.log(`   ✅ Total records: ${count}`);
      }

      // Test 2: Get first 5 records
      console.log('\n2. Fetching first 5 records...');
      const { data: firstFive, error: fetchError } = await supabase
        .from('practice_tariffs')
        .select('*')
        .limit(5);
      
      if (fetchError) {
        console.error(`   ❌ Fetch Error: ${fetchError.message}`);
      } else if (firstFive && firstFive.length > 0) {
        console.log(`   ✅ Found ${firstFive.length} records:`);
        firstFive.forEach((record, idx) => {
          console.log(`      ${idx + 1}. Code: ${record.code}, Description: ${record.description || record.namaf_prace_2025 || 'N/A'}`);
        });
      } else {
        console.log('   ⚠️  No records found');
      }

      // Test 3: Check for dental codes specifically
      console.log('\n3. Checking for dental codes (starting with 8)...');
      const { data: dentalCodes, error: dentalError } = await supabase
        .from('practice_tariffs')
        .select('code')
        .like('code', '8%')
        .limit(10);
      
      if (dentalError) {
        console.error(`   ❌ Dental Error: ${dentalError.message}`);
      } else if (dentalCodes && dentalCodes.length > 0) {
        console.log(`   ✅ Found dental codes: ${dentalCodes.map(d => d.code).join(', ')}`);
      } else {
        console.log('   ⚠️  No dental codes found');
      }

      // Test 4: Check table structure
      console.log('\n4. Checking for key columns...');
      const { data: sample, error: sampleError } = await supabase
        .from('practice_tariffs')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error(`   ❌ Sample Error: ${sampleError.message}`);
      } else if (sample && sample.length > 0) {
        const columns = Object.keys(sample[0]);
        console.log(`   ✅ Table columns: ${columns.join(', ')}`);
      }

    } catch (err) {
      console.error(`   💥 Unexpected error: ${err.message}`);
    }
  }
}

checkDentalCodes().then(() => {
  console.log('\n========== Check Complete ==========');
});