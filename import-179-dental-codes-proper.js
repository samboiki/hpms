import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${serviceKey}` } }
});

async function import179DentalCodes() {
  try {
    console.log('🚀 Starting import of 179 dental codes...');
    console.log('✅ Connected to Supabase successfully');

    // Read the 179 dental codes from JSON file
    const dentalCodes = JSON.parse(fs.readFileSync('./dental_codes_179_from_csv.json', 'utf8'));
    console.log(`📊 Found ${dentalCodes.length} dental codes to import`);

    // Clear existing dental codes (codes starting with 8)
    console.log('🧹 Clearing existing dental codes (8xxx series)...');
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .like('code', '8%');
      
    if (deleteError) {
      console.error('⚠️  Warning: Could not clear existing codes:', deleteError);
    } else {
      console.log('✅ Existing dental codes cleared');
    }

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

    console.log(`🚀 Bulk inserting ${bulkInsertData.length} tariff records...`);
    console.log(`⚠️  Skipped ${skippedCount} incomplete records`);
    
    // Insert in chunks to avoid timeout
    const chunkSize = 50; // Smaller chunks for reliability
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
      .select('*', { count: 'exact', head: true })
      .like('code', '8%');
    
    console.log('\n🎉 IMPORT SUMMARY');
    console.log('================');
    console.log(`✅ Successfully imported: ${successCount} tariff records`);
    console.log(`❌ Errors encountered: ${errorCount} records`);
    console.log(`⚠️  Skipped incomplete: ${skippedCount} records`);
    console.log(`📊 Total dental codes in database: ${finalCount || 'Unknown'}`);
    console.log(`📋 Expected codes: 179`);

    // Show sample of imported data
    const { data: sampleData, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select(`
        code,
        description,
        price,
        official_2025_price_nad,
        on_2025_list,
        found_in_claims,
        requires_tooth_number,
        can_be_multiplied
      `)
      .like('code', '8%')
      .order('code')
      .limit(5);
    
    if (!sampleError && sampleData) {
      console.log('\n📋 SAMPLE IMPORTED DATA:');
      console.table(sampleData);
    }

    // Show statistics
    const { data: stats } = await supabase
      .from('practice_tariffs')
      .select('price')
      .like('code', '8%');
      
    if (stats && stats.length > 0) {
      const prices = stats.map(s => parseFloat(s.price));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      
      console.log('\n💰 PRICE STATISTICS:');
      console.log(`Min price: ${minPrice} NAD`);
      console.log(`Max price: ${maxPrice} NAD`);
      console.log(`Average price: ${avgPrice.toFixed(2)} NAD`);
    }

    if (finalCount === 179) {
      console.log('\n🎊 SUCCESS! All 179 dental codes imported correctly!');
    } else {
      console.log(`\n⚠️  Expected 179 codes but have ${finalCount} in database`);
    }

  } catch (error) {
    console.error('💥 Import failed:', error);
  }
}

console.log('🚀 Starting 179 dental codes import...');
import179DentalCodes();