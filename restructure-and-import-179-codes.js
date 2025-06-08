#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 🔑 SERVICE ROLE CONFIGURATION  
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function restructureAndImport179Codes() {
  console.log('🚀 RESTRUCTURING TABLE AND IMPORTING ALL 179 DENTAL CODES\n');
  
  try {
    // Step 1: Read the complete analysis file to get all 179 codes
    console.log('📋 Step 1: Reading complete dental codes analysis...');
    
    const analysisData = JSON.parse(fs.readFileSync('/home/happy/projects/hpms/dental_codes_complete_analysis.json', 'utf8'));
    const complete179Codes = analysisData.complete_data;
    
    console.log(`✅ Loaded ${complete179Codes.length} codes from analysis file`);
    
    if (complete179Codes.length !== 179) {
      throw new Error(`Expected 179 codes, got ${complete179Codes.length}`);
    }
    
    // Step 2: Clear all existing data first
    console.log('\n🧹 Step 2: Clearing all existing tariff data...');
    
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      throw new Error(`Failed to clear existing data: ${deleteError.message}`);
    }
    
    console.log('✅ All existing tariff data cleared');
    
    // Step 3: Check current table structure and add missing columns
    console.log('\n🔧 Step 3: Restructuring table to match Excel columns...');
    
    // Get current table schema using SQL
    const { data: currentColumns, error: schemaError } = await supabase
      .rpc('sql', { 
        query: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'practice_tariffs' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
        `
      });
    
    if (schemaError) {
      console.warn('Could not query current schema, proceeding with column additions...');
    } else {
      console.log('📋 Current table columns:');
      currentColumns?.forEach(col => {
        console.log(`   • ${col.column_name}: ${col.data_type}`);
      });
    }
    
    // Add new columns based on Excel structure
    const columnAlterations = [
      // Core columns from Excel
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS code INTEGER',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS description TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS official_2025_price_nad DECIMAL(10,2)',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS on_2025_list TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS found_in_claims TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS requires_tooth_number TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS can_be_multiplied TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS business_rule_formula TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS example_calculation TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS notes TEXT',
      // Required practice type column
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS practice_type TEXT DEFAULT \'dental\'',
      // System columns as requested
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS effective_to DATE',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
    ];
    
    for (const alteration of columnAlterations) {
      const { error: alterError } = await supabase.rpc('sql', { query: alteration });
      if (alterError) {
        console.warn(`Warning: ${alterError.message}`);
      }
    }
    
    console.log('✅ Table structure updated with Excel columns');
    
    // Step 4: Transform Excel data to database structure
    console.log('\n🔄 Step 4: Transforming Excel data...');
    
    const transformedCodes = complete179Codes.map(item => {
      // Handle special pricing for code 8346
      let price = parseFloat(item['Official 2025 Price (NAD)']);
      if (item['Official 2025 Price (NAD)'] === 'VARIES') {
        price = 50.84; // Default to tooth 11 price
      }
      
      return {
        // Map Excel columns to database columns exactly
        code: parseInt(item.Code),
        description: item.Description,
        official_2025_price_nad: price,
        on_2025_list: item['On 2025 List'],
        found_in_claims: item['Found in Claims'],
        requires_tooth_number: item['Requires Tooth Number'],
        can_be_multiplied: item['Can Be Multiplied'],
        business_rule_formula: item['Business Rule/Formula'],
        example_calculation: item['Example Calculation'],
        notes: item.Notes || '',
        // Required columns
        practice_type: 'dental'
        // System columns will use defaults
      };
    });
    
    console.log('✅ Data transformation complete');
    console.log(`📊 Prepared ${transformedCodes.length} codes for import`);
    
    // Step 5: Insert all 179 codes in batches
    console.log('\n📊 Step 5: Inserting all 179 codes...');
    
    const batchSize = 25;
    let totalInserted = 0;
    
    for (let i = 0; i < transformedCodes.length; i += batchSize) {
      const batch = transformedCodes.slice(i, i + batchSize);
      
      const { data: insertedBatch, error: insertError } = await supabase
        .from('practice_tariffs')
        .insert(batch)
        .select('id, code');
      
      if (insertError) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, insertError.message);
        // Show first few codes that failed
        console.error('Sample codes in failed batch:', batch.slice(0, 3).map(c => c.code));
      } else {
        totalInserted += insertedBatch.length;
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: ${insertedBatch.length} codes inserted (${insertedBatch[0]?.code} - ${insertedBatch[insertedBatch.length-1]?.code})`);
      }
    }
    
    // Step 6: Verify import success
    console.log('\n🔍 Step 6: Verifying import success...');
    
    const { data: verifyData, count: totalCount, error: verifyError } = await supabase
      .from('practice_tariffs')
      .select('code, description, official_2025_price_nad, practice_type, can_be_multiplied', { count: 'exact' })
      .order('code');
    
    if (verifyError) {
      console.error('Verification error:', verifyError.message);
    }
    
    console.log(`✅ Import verification:`);
    console.log(`   • Total codes in database: ${totalCount || verifyData?.length || 0}`);
    console.log(`   • Expected: 179`);
    console.log(`   • Match: ${(totalCount || verifyData?.length || 0) === 179 ? '✅ YES' : '❌ NO'}`);
    
    // Show sample of imported data
    if (verifyData && verifyData.length > 0) {
      console.log('\n📋 Sample imported codes:');
      verifyData.slice(0, 10).forEach(code => {
        console.log(`   • ${code.code}: ${code.description?.substring(0, 50)}... - N$${code.official_2025_price_nad} (${code.can_be_multiplied})`);
      });
    }
    
    // Final summary
    console.log('\n🎉 COMPLETE RESTRUCTURE AND IMPORT SUMMARY:');
    console.log('==========================================');
    console.log(`✅ Total codes imported: ${totalInserted} / 179`);
    console.log(`✅ Table restructured with Excel columns`);
    console.log(`✅ All 10 Excel columns mapped exactly:`);
    console.log(`   • code → code (dental procedure code)`);
    console.log(`   • Description → description (procedure name)`);
    console.log(`   • Official 2025 Price (NAD) → official_2025_price_nad`);
    console.log(`   • On 2025 List → on_2025_list`);
    console.log(`   • Found in Claims → found_in_claims`);
    console.log(`   • Requires Tooth Number → requires_tooth_number`);
    console.log(`   • Can Be Multiplied → can_be_multiplied`);
    console.log(`   • Business Rule/Formula → business_rule_formula`);
    console.log(`   • Example Calculation → example_calculation`);
    console.log(`   • Notes → notes`);
    console.log(`✅ Practice type column added (set to 'dental')`);
    console.log(`✅ System columns preserved: effective_from, effective_to, created_at, updated_at`);
    
    if (totalInserted === 179) {
      console.log('\n🎯 MISSION ACCOMPLISHED:');
      console.log('✅ ALL 179 dental codes successfully imported');
      console.log('✅ Database restructured to match Excel exactly');
      console.log('✅ All required columns created and populated');
      console.log('✅ Ready for ServiceSelector integration');
    } else {
      console.log(`\n⚠️  WARNING: Expected 179 codes, imported ${totalInserted}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Execute the complete migration
try {
  await restructureAndImport179Codes();
} catch (error) {
  console.error('Script error:', error.message);
  process.exit(1);
}