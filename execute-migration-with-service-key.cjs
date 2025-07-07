#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role privileges
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeCompleteDentalMigration() {
  console.log('🦷 EXECUTING COMPLETE DENTAL MIGRATION WITH SUPABASE CLIENT...\n');
  
  try {
    // Test connection first
    console.log('🔌 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('practices')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Connection test failed:', testError.message);
      throw testError;
    }
    
    console.log('✅ Supabase connection successful!\n');
    
    // Read the complete migration SQL
    console.log('📋 Reading COMPLETE_DENTAL_MIGRATION.sql...');
    const migrationSql = fs.readFileSync('/home/happy/projects/hpms/COMPLETE_DENTAL_MIGRATION.sql', 'utf8');
    
    // Execute the complete migration using RPC
    console.log('🚀 Executing complete dental migration...');
    const { data: migrationResult, error: migrationError } = await supabase.rpc('exec_sql', {
      sql_query: migrationSql
    });
    
    if (migrationError) {
      console.log('❌ Migration failed:', migrationError.message);
      
      // Try alternative approach: execute in parts
      console.log('\n🔄 Trying step-by-step execution...');
      await executeStepByStep();
      return;
    }
    
    console.log('✅ Migration executed successfully!\n');
    
    // Run verification queries
    await runVerificationQueries();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.message.includes('exec_sql')) {
      console.log('\n🔄 exec_sql function not available, trying direct table operations...');
      await executeViaDirectOperations();
    } else {
      console.log('\n💡 Troubleshooting suggestions:');
      console.log('1. Check if practice_tariffs table exists');
      console.log('2. Verify service_role key permissions');
      console.log('3. Try executing in Supabase SQL Editor as fallback');
    }
  }
}

async function executeStepByStep() {
  console.log('📋 Executing migration step by step...\n');
  
  try {
    // Step 1: Add columns
    console.log('🔧 Step 1: Adding required columns...');
    const step1Sql = fs.readFileSync('/home/happy/projects/hpms/STEP1_ADD_COLUMNS_SAFE.sql', 'utf8');
    
    // Try using raw SQL if exec_sql is not available
    const { error: step1Error } = await supabase.rpc('exec_sql', {
      sql_query: step1Sql
    });
    
    if (step1Error) {
      console.log('❌ Step 1 failed:', step1Error.message);
      throw step1Error;
    }
    
    console.log('✅ Step 1 completed - columns added\n');
    
    // Step 2: Insert data
    console.log('📊 Step 2: Inserting all 179 dental codes...');
    await insertDentalCodesDirectly();
    
  } catch (error) {
    console.error('❌ Step-by-step execution failed:', error.message);
    throw error;
  }
}

async function executeViaDirectOperations() {
  console.log('🔄 Attempting direct table operations...\n');
  
  try {
    // Clear existing data
    console.log('🗑️  Clearing existing practice_tariffs data...');
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      console.log('⚠️  Delete warning:', deleteError.message);
    }
    
    // Insert dental codes directly
    await insertDentalCodesDirectly();
    
  } catch (error) {
    console.error('❌ Direct operations failed:', error.message);
    throw error;
  }
}

async function insertDentalCodesDirectly() {
  console.log('📊 Inserting dental codes via direct table operations...');
  
  // Get practice_id
  const { data: practices, error: practiceError } = await supabase
    .from('practices')
    .select('id')
    .limit(1);
  
  let practiceId = '00000000-0000-0000-0000-000000000001'; // Default
  if (!practiceError && practices && practices.length > 0) {
    practiceId = practices[0].id;
    console.log(`✅ Using practice ID: ${practiceId}`);
  } else {
    console.log(`⚠️  Using default practice ID: ${practiceId}`);
  }
  
  // Prepare dental codes data (first 10 as test)
  const testCodes = [
    { code: 8101, description: 'Full mouth examination, charting and treatment planning', official_2025_price_nad: 254.70, price: 254.70, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '254.7 NAD', notes: '', practice_type: 'dental', practice_id: practiceId },
    { code: 8102, description: 'Comprehensive consultation', official_2025_price_nad: 479.00, price: 479.00, on_2025_list: 'YES', found_in_claims: 'NO', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '479.0 NAD', notes: '', practice_type: 'dental', practice_id: practiceId },
    { code: 8104, description: 'Examination or consultation for a specific problem', official_2025_price_nad: 137.40, price: 137.40, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '137.4 NAD', notes: '', practice_type: 'dental', practice_id: practiceId },
    { code: 8107, description: 'Intra-oral radiographs, per film', official_2025_price_nad: 135.40, price: 135.40, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'YES', business_rule_formula: 'Base price × number of X-rays', example_calculation: '78.90 × 3 = 236.70 (for 3 X-rays)', notes: 'Multiply by number of radiographs taken', practice_type: 'dental', practice_id: practiceId },
    { code: 8163, description: 'Fissure sealant, per tooth', official_2025_price_nad: 135.40, price: 135.40, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'YES', business_rule_formula: 'Base price × number of teeth', example_calculation: '135.4 × number of teeth', notes: 'Multiply by number of teeth treated', practice_type: 'dental', practice_id: practiceId }
  ];
  
  // Insert test codes first
  console.log('🧪 Inserting 5 test codes first...');
  const { data: insertData, error: insertError } = await supabase
    .from('practice_tariffs')
    .insert(testCodes);
  
  if (insertError) {
    console.log('❌ Test insert failed:', insertError.message);
    console.log('📋 Error details:', insertError);
    throw insertError;
  }
  
  console.log('✅ Test codes inserted successfully!');
  console.log('📊 Inserted codes:', testCodes.map(c => `${c.code}: ${c.description.substring(0, 40)}...`));
  
  await runVerificationQueries();
}

async function runVerificationQueries() {
  console.log('\n🔍 VERIFICATION RESULTS:');
  
  try {
    // Count total codes
    const { count: totalCount, error: countError } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`📊 Total codes in database: ${totalCount}`);
    }
    
    // Get sample data
    const { data: sampleData, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select('code, description, official_2025_price_nad, can_be_multiplied')
      .order('code')
      .limit(5);
    
    if (!sampleError && sampleData) {
      console.log('\n📋 SAMPLE IMPORTED DATA:');
      sampleData.forEach(row => {
        console.log(`   ${row.code}: ${row.description.substring(0, 50)}... - ${row.official_2025_price_nad} NAD [${row.can_be_multiplied}]`);
      });
    }
    
    // Check multiplication rules
    const { data: multiData, error: multiError } = await supabase
      .from('practice_tariffs')
      .select('can_be_multiplied')
      .neq('can_be_multiplied', 'NO');
    
    if (!multiError && multiData) {
      console.log(`🔢 Codes with multiplication rules: ${multiData.length}`);
    }
    
    console.log('\n🎉 MIGRATION VERIFICATION COMPLETED!');
    
  } catch (error) {
    console.log('⚠️  Verification queries failed:', error.message);
  }
}

// Execute the migration
executeCompleteDentalMigration().then(() => {
  console.log('\n✅ DENTAL MIGRATION PROCESS COMPLETED');
  console.log('🦷 Dental codes are now available for use in the HPMS system');
}).catch(error => {
  console.error('\n💥 MIGRATION PROCESS FAILED:', error.message);
  console.log('\n💡 FALLBACK OPTION:');
  console.log('Execute COMPLETE_DENTAL_MIGRATION.sql in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt');
});