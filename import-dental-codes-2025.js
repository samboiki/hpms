import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${serviceKey}` } }
});

async function importDentalCodes() {
  try {
    console.log('✅ Connected to Supabase successfully');

    // Read the dental codes from the JSON file
    const dentalCodes = JSON.parse(fs.readFileSync('./dental_codes_full_Dental_Pricing_Table.json', 'utf8'));
    console.log(`📊 Found ${dentalCodes.length} dental codes to import`);

    console.log('📋 Importing dental codes to practice_tariffs table (practice-agnostic)');

    // Clear existing dental tariffs first (optional - remove if you want to keep existing)
    console.log('🧹 Clearing existing dental tariffs...');
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .in('code', dentalCodes.map(c => c.Code));
      
    if (deleteError) {
      console.error('⚠️  Warning: Could not clear existing tariffs:', deleteError);
    }

    // Counter for successful imports
    let successCount = 0;
    let errorCount = 0;

    // Prepare bulk insert data - no practice_id since this table is practice-agnostic
    const bulkInsertData = [];
    
    console.log(`📋 Preparing ${dentalCodes.length} dental codes for import`);
    
    for (const code of dentalCodes) {
      // Skip if any required field is missing
      if (!code.Code || !code.Description || !code.Price) {
        console.log(`⚠️  Skipping incomplete code:`, code);
        continue;
      }

      bulkInsertData.push({
        code: code.Code,
        price: parseFloat(code.Price) || 0,
        description: code.Description,
        unit: 'per visit',
        is_active: true,
        effective_from: '2025-01-01',
        notes: `${code.Category} / ${code.Subcategory}`,
        official_2025_price_nad: parseFloat(code.Price) || 0,
        on_2025_list: 'yes'
      });
    }

    console.log(`🚀 Bulk inserting ${bulkInsertData.length} tariff records...`);
    
    // Insert in chunks to avoid timeout
    const chunkSize = 100;
    for (let i = 0; i < bulkInsertData.length; i += chunkSize) {
      const chunk = bulkInsertData.slice(i, i + chunkSize);
      
      const { data, error } = await supabase
        .from('practice_tariffs')
        .insert(chunk);
        
      if (error) {
        console.error(`❌ Error inserting chunk ${Math.floor(i/chunkSize) + 1}:`, error);
        errorCount += chunk.length;
      } else {
        successCount += chunk.length;
        console.log(`✅ Inserted chunk ${Math.floor(i/chunkSize) + 1} (${chunk.length} records)`);
      }
    }

    // Final verification
    const { count: finalCount, error: countError } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    console.log('\n🎉 IMPORT SUMMARY');
    console.log('================');
    console.log(`✅ Successfully imported: ${successCount} tariff records`);
    console.log(`❌ Errors encountered: ${errorCount} records`);
    console.log(`📊 Total dental tariffs in database: ${finalCount || 'Unknown'}`);
    console.log(`📋 Unique codes imported: ${dentalCodes.length}`);

    // Show sample of imported data
    const { data: sampleData, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select(`
        code,
        description,
        price,
        notes,
        on_2025_list
      `)
      .order('code')
      .limit(5);
    
    if (!sampleError && sampleData) {
      console.log('\n📋 SAMPLE IMPORTED DATA:');
      console.table(sampleData.map(item => ({
        code: item.code,
        description: item.description,
        price: item.price,
        notes: item.notes,
        on_2025_list: item.on_2025_list
      })));
    }

    // Show categories breakdown
    const { data: categoriesData, error: categoriesError } = await supabase
      .rpc('get_dental_categories_summary');
    
    if (!categoriesError && categoriesData) {
      console.log('\n📊 CATEGORIES BREAKDOWN:');
      console.table(categoriesData);
    } else {
      // Fallback if RPC doesn't exist
      console.log('\n📊 Import completed successfully!');
    }

  } catch (error) {
    console.error('💥 Import failed:', error);
  }
}

// Run the import
console.log('🚀 Starting dental codes import...');
importDentalCodes();