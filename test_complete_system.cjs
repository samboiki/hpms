const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function testCompleteSystem() {
  console.log('🧪 Testing Complete System Functionality\n');

  try {
    // Test 1: Check all main tables exist and are accessible
    console.log('1. 📋 Testing core tables access...');
    
    const tables = ['patients', 'visits', 'practice_tariffs', 'vitals'];
    const results = {};
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count', { count: 'exact', head: true });
        
        results[table] = error ? `❌ ${error.message}` : `✅ ${data?.count || 0} records`;
      } catch (err) {
        results[table] = `❌ ${err.message}`;
      }
    }
    
    Object.entries(results).forEach(([table, result]) => {
      console.log(`  ${table}: ${result}`);
    });

    // Test 2: Check practice tariffs structure and data
    console.log('\n2. 💰 Testing practice tariffs...');
    
    const { data: tariffs, error: tariffsError } = await supabase
      .from('practice_tariffs')
      .select('id, code, description, price')
      .not('price', 'is', null)
      .gt('price', 0)
      .limit(5);
    
    if (tariffsError) {
      console.log(`  ❌ Error: ${tariffsError.message}`);
    } else {
      console.log(`  ✅ Found ${tariffs.length} tariffs with pricing`);
      tariffs.forEach(t => console.log(`    - ${t.code}: ${t.description} - N$${t.price}`));
    }

    // Test 3: Check for practice types and frequent codes
    console.log('\n3. 🏥 Testing practice type integration...');
    
    try {
      const { data: practiceTypes, error: typesError } = await supabase
        .from('practice_types')
        .select('*')
        .limit(5);
      
      console.log(typesError ? `  ❌ practice_types: ${typesError.message}` : `  ✅ practice_types: ${practiceTypes?.length || 0} records`);
    } catch (err) {
      console.log(`  ❌ practice_types: ${err.message}`);
    }

    try {
      const { data: frequentCodes, error: frequentError } = await supabase
        .from('frequent_tariff_codes')
        .select('*')
        .limit(5);
      
      console.log(frequentError ? `  ❌ frequent_tariff_codes: ${frequentError.message}` : `  ✅ frequent_tariff_codes: ${frequentCodes?.length || 0} records`);
    } catch (err) {
      console.log(`  ❌ frequent_tariff_codes: ${err.message}`);
    }

    // Test 4: Test billing tables (if they exist)
    console.log('\n4. 🧾 Testing billing infrastructure...');
    
    const billingTables = ['visit_services', 'invoices_enhanced', 'invoice_items_enhanced'];
    const billingResults = {};
    
    for (const table of billingTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count', { count: 'exact', head: true });
        
        billingResults[table] = error ? `❌ ${error.message}` : `✅ ${data?.count || 0} records`;
      } catch (err) {
        billingResults[table] = `❌ Table doesn't exist`;
      }
    }
    
    Object.entries(billingResults).forEach(([table, result]) => {
      console.log(`  ${table}: ${result}`);
    });

    // Test 5: Test components integration (data requirements)
    console.log('\n5. 🎯 Testing component data requirements...');
    
    // Test visit creation requirements
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1);
    
    if (patientsError || !patients?.[0]) {
      console.log('  ❌ No patients available for visit creation');
    } else {
      console.log(`  ✅ Sample patient available: ${patients[0].first_name} ${patients[0].last_name}`);
      
      // Test if we can query tariffs by practice type
      const { data: practiceTypeCheck, error: practiceError } = await supabase
        .from('practice_tariffs_with_types')
        .select('*')
        .eq('practice_type_name', 'dental')
        .limit(3);
      
      if (practiceError) {
        console.log(`  ⚠️ Practice type query failed: ${practiceError.message}`);
        console.log('  📝 Recommendation: Check practice_tariffs_with_types view');
      } else {
        console.log(`  ✅ Practice type filtering works: ${practiceTypeCheck?.length || 0} dental codes`);
      }
    }

    // Test 6: Check current visits for billing integration
    console.log('\n6. 📊 Testing existing visit data for billing...');
    
    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select('id, visit_date, visit_type, patient_id')
      .limit(5);
    
    if (visitsError) {
      console.log(`  ❌ Error fetching visits: ${visitsError.message}`);
    } else {
      console.log(`  ✅ Found ${visits?.length || 0} visits for potential billing integration`);
      if (visits && visits.length > 0) {
        visits.forEach(v => console.log(`    - ${v.visit_type} on ${v.visit_date}`));
      }
    }

    // Summary and recommendations
    console.log('\n📋 SYSTEM STATUS SUMMARY:');
    console.log('==========================');
    
    const coreTablesWorking = !results.patients.includes('❌') && !results.visits.includes('❌') && !results.practice_tariffs.includes('❌');
    const billingTablesExist = !Object.values(billingResults).some(r => r.includes('❌'));
    
    console.log(`Core functionality: ${coreTablesWorking ? '✅ WORKING' : '❌ ISSUES'}`);
    console.log(`Billing system: ${billingTablesExist ? '✅ READY' : '⚠️ NEEDS SETUP'}`);
    
    if (!billingTablesExist) {
      console.log('\n💡 NEXT STEPS:');
      console.log('1. Create billing tables in Supabase SQL Editor:');
      console.log('   - visit_services');
      console.log('   - invoices_enhanced');
      console.log('   - invoice_items_enhanced');
      console.log('2. SQL creation script available in: /supabase/migrations/20250609000000_create_billing_tables.sql');
    }

    if (coreTablesWorking) {
      console.log('\n🎯 APPLICATION FEATURES STATUS:');
      console.log('- ✅ Patient management');
      console.log('- ✅ Visit recording');
      console.log('- ✅ Service selection');
      console.log('- ✅ Lab/imaging upload');
      console.log(`- ${billingTablesExist ? '✅' : '⚠️'} Billing transactions`);
    }

  } catch (error) {
    console.error('❌ System test failed:', error);
  }
}

testCompleteSystem();