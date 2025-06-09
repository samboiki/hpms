import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${serviceKey}` } }
});

async function clearAndImport179Codes() {
  try {
    console.log('🧹 CLEARING ALL EXISTING DATA FROM practice_tariffs...');
    
    // First, get count of existing records
    const { count: beforeCount } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Found ${beforeCount || 0} existing records`);
    
    // Clear ALL existing records from practice_tariffs table
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
      
    if (deleteError) {
      console.error('❌ Error clearing table:', deleteError);
      return;
    }
    
    console.log('✅ All existing records cleared from practice_tariffs table');
    
    // Verify table is empty
    const { count: afterClearCount } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Records after clearing: ${afterClearCount || 0}`);
    
    if (afterClearCount > 0) {
      console.error('❌ Table not completely cleared!');
      return;
    }
    
    console.log('\n🚀 STARTING FRESH IMPORT OF 179 DENTAL CODES...');
    
    // Read the 179 dental codes from JSON file
    const dentalCodes = JSON.parse(fs.readFileSync('./dental_codes_179_from_csv.json', 'utf8'));
    console.log(`📊 Found ${dentalCodes.length} dental codes to import`);

    // Prepare bulk insert data with correct column mapping
    const bulkInsertData = [];
    let skippedCount = 0;
    
    console.log('📋 Preparing dental codes for import...');
    
    for (const code of dentalCodes) {
      // Skip if required fields are missing
      if (!code.Code || !code.Description) {
        console.log(`⚠️  Skipping incomplete code:`, code.Code);
        skippedCount++;
        continue;
      }

      // Parse price safely
      const price = parseFloat(code['Official 2025 Price (NAD)']) || 0;

      bulkInsertData.push({
        code: code.Code,
        description: code.Description,
        price: price,
        official_2025_price_nad: price,
        on_2025_list: code['On 2025 List'] || 'YES',
        found_in_claims: code['Found in Claims'] || 'NO',
        requires_tooth_number: code['Requires Tooth Number'] || 'NO',
        can_be_multiplied: code['Can Be Multiplied'] || 'NO',
        business_rule_formula: code['Business Rule/Formula'] || 'Fixed price',
        example_calculation: code['Example Calculation'] || '',
        notes: code.Notes || '',
        unit: code['Can Be Multiplied'] === 'YES' ? 'per item' : 'per visit',
        is_active: true,
        effective_from: '2025-01-01'
      });
    }

    console.log(`🚀 Bulk inserting ${bulkInsertData.length} fresh dental codes...`);
    console.log(`⚠️  Skipped ${skippedCount} incomplete records`);
    
    // Insert in chunks to avoid timeout
    const chunkSize = 50;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < bulkInsertData.length; i += chunkSize) {
      const chunk = bulkInsertData.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i/chunkSize) + 1;
      const totalChunks = Math.ceil(bulkInsertData.length / chunkSize);
      
      console.log(`📦 Inserting chunk ${chunkNumber}/${totalChunks} (${chunk.length} records)...`);
      
      const { data, error } = await supabase
        .from('practice_tariffs')
        .insert(chunk);
        
      if (error) {
        console.error(`❌ Error inserting chunk ${chunkNumber}:`, error);
        errorCount += chunk.length;
      } else {
        successCount += chunk.length;
        console.log(`✅ Successfully inserted chunk ${chunkNumber}`);
      }
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final verification
    const { count: finalCount, error: countError } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    console.log('\n🎉 FRESH IMPORT SUMMARY');
    console.log('======================');
    console.log(`🧹 Cleared: ${beforeCount || 0} old records`);
    console.log(`✅ Successfully imported: ${successCount} new records`);
    console.log(`❌ Errors encountered: ${errorCount} records`);
    console.log(`⚠️  Skipped incomplete: ${skippedCount} records`);
    console.log(`📊 Total records in database: ${finalCount || 0}`);
    console.log(`📋 Expected: 179 dental codes`);

    // Show sample of imported data
    const { data: sampleData, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select(`
        code,
        description,
        price,
        official_2025_price_nad,
        on_2025_list,
        can_be_multiplied
      `)
      .order('code')
      .limit(5);
    
    if (!sampleError && sampleData) {
      console.log('\n📋 SAMPLE FRESH DATA:');
      console.table(sampleData);
    }

    if (finalCount === 179) {
      console.log('\n🎊 PERFECT! Fresh import of all 179 dental codes completed successfully!');
    } else {
      console.log(`\n⚠️  Expected 179 codes but have ${finalCount} in database`);
    }

  } catch (error) {
    console.error('💥 Clear and import failed:', error);
  }
}

console.log('🚀 Starting CLEAR ALL and FRESH IMPORT of 179 dental codes...');
clearAndImport179Codes();