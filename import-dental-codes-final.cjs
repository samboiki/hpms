const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const csv = require('csv-parse/sync');

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function importDentalCodes() {
  try {
    console.log('📂 Reading CSV file...');
    const csvContent = await fs.readFile('/home/happy/projects/hpms/dentalpractice_codes_2025.csv', 'utf8');
    
    console.log('📊 Parsing CSV data...');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';' // Using semicolon delimiter
    });
    
    console.log(`✅ Found ${records.length} dental codes in CSV`);
    
    // Transform CSV data to match database schema
    const dentalCodes = records.map(row => ({
      code: row.Code?.trim(),
      description: row.Description?.trim(),
      price: parseFloat(row.Price) || 0,
      official_2025_price_nad: parseFloat(row.Price) || 0,
      on_2025_list: row['On 2025 List']?.trim() || 'YES',
      found_in_claims: row['Found in Claims']?.trim() || 'NO',
      requires_tooth_number: row['Requires Tooth Number']?.trim() || 'NO',
      can_be_multiplied: row['Can Be Multiplied']?.trim() || 'NO',
      business_rule_formula: row['Business Rule/Formula']?.trim() || 'Fixed price',
      example_calculation: row['Example Calculation']?.trim() || '',
      notes: row.Notes?.trim() || '',
      unit: row['Can Be Multiplied'] === 'YES' ? 'per item' : 'per visit',
      is_active: true,
      effective_from: '2025-01-01',
      practice_type: null // Allow for all practice types
    })).filter(code => code.code); // Only include rows with valid codes
    
    console.log(`\n🗑️  Clearing existing data...`);
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .not('id', 'is', null); // Delete all rows
    
    if (deleteError) {
      console.error('❌ Error clearing data:', deleteError);
      return;
    }
    
    console.log(`\n📤 Importing ${dentalCodes.length} dental codes...`);
    
    // Insert in batches of 50
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < dentalCodes.length; i += batchSize) {
      const batch = dentalCodes.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('practice_tariffs')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error);
        continue;
      }
      
      totalInserted += data?.length || 0;
      console.log(`   ✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${data?.length || 0} codes`);
    }
    
    console.log(`\n🎉 Import complete! Total codes imported: ${totalInserted}`);
    
    // Verify the import
    const { count } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n✅ Verification: ${count} codes now in practice_tariffs table`);
    
    // Show sample of imported codes
    const { data: sample } = await supabase
      .from('practice_tariffs')
      .select('code, description, price')
      .limit(5);
    
    if (sample) {
      console.log('\nSample of imported codes:');
      sample.forEach((code, idx) => {
        console.log(`   ${idx + 1}. ${code.code}: ${code.description} - N$${code.price}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

importDentalCodes();