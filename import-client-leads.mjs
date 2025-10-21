import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importClientLeads() {
  try {
    console.log('📊 Starting client leads import process...\n');

    // Step 1: Check if table exists
    console.log('1️⃣ Checking existing tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.log('⚠️  Could not query tables, will attempt to create table anyway');
    } else {
      console.log(`✅ Found ${tables?.length || 0} existing tables`);
    }

    // Step 2: Create table
    console.log('\n2️⃣ Creating client_leads table...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS client_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        discipline_code TEXT,
        discipline_name TEXT,
        practice_number TEXT UNIQUE,
        practice_name TEXT,
        town TEXT,
        phone TEXT,
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create index on practice_number for faster lookups
      CREATE INDEX IF NOT EXISTS idx_client_leads_practice_number ON client_leads(practice_number);

      -- Create index on town for filtering
      CREATE INDEX IF NOT EXISTS idx_client_leads_town ON client_leads(town);
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (createError) {
      console.log('⚠️  Table creation result:', createError.message);
      console.log('Attempting direct SQL execution...');

      // Try direct SQL execution
      const { error: directError } = await supabase.from('client_leads').select('count').limit(1);
      if (directError && directError.code === '42P01') {
        console.error('❌ Table does not exist and cannot be created. Please create it manually.');
        console.log('\n📋 SQL to run manually:');
        console.log(createTableSQL);
        return;
      }
    } else {
      console.log('✅ Table created successfully');
    }

    // Step 3: Read CSV file
    console.log('\n3️⃣ Reading CSV file...');
    const csvPath = 'C:\\Users\\Happyou2\\Downloads\\CLIENTS.csv';
    const csvContent = readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    console.log(`✅ Read ${lines.length} lines (including header)`);

    // Step 4: Parse CSV
    console.log('\n4️⃣ Parsing CSV data...');
    const header = lines[0];
    const dataLines = lines.slice(1);

    const records = dataLines.map((line, index) => {
      // Simple CSV parsing (handles basic cases)
      const values = line.split(',').map(v => v.trim());

      return {
        discipline_code: values[0] || null,
        discipline_name: values[1] || null,
        practice_number: values[2] || null,
        practice_name: values[3] || null,
        town: values[4] || null,
        phone: values[5] === '0' ? null : values[5] || null, // Convert '0' to null
        email: values[6] || null
      };
    }).filter(record => record.practice_number); // Only include records with practice number

    console.log(`✅ Parsed ${records.length} valid records`);
    console.log(`📋 Sample record:`, records[0]);

    // Step 5: Insert records in batches
    console.log('\n5️⃣ Inserting records into database...');
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);

      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

      const { data, error } = await supabase
        .from('client_leads')
        .upsert(batch, { onConflict: 'practice_number' })
        .select();

      if (error) {
        console.error(`❌ Batch ${batchNum} error:`, error.message);
        errorCount += batch.length;
        errors.push({ batch: batchNum, error: error.message });
      } else {
        successCount += batch.length;
        console.log(`✅ Batch ${batchNum} completed (${data?.length || batch.length} records)`);
      }
    }

    // Step 6: Verify import
    console.log('\n6️⃣ Verifying import...');
    const { count, error: countError } = await supabase
      .from('client_leads')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Could not verify count:', countError.message);
    } else {
      console.log(`✅ Total records in database: ${count}`);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully imported: ${successCount} records`);
    console.log(`❌ Failed: ${errorCount} records`);
    console.log(`📈 Total in database: ${count || 'Unknown'}`);

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach(e => console.log(`   Batch ${e.batch}: ${e.error}`));
    }

    console.log('='.repeat(60));

    // Show sample data
    console.log('\n7️⃣ Sample imported records:');
    const { data: samples } = await supabase
      .from('client_leads')
      .select('*')
      .limit(5);

    if (samples) {
      samples.forEach((s, i) => {
        console.log(`\n${i + 1}. ${s.practice_name}`);
        console.log(`   Practice #: ${s.practice_number}`);
        console.log(`   Town: ${s.town}`);
        console.log(`   Phone: ${s.phone}`);
        console.log(`   Email: ${s.email}`);
      });
    }

    // Show statistics
    console.log('\n8️⃣ Statistics by discipline:');
    const { data: stats } = await supabase
      .from('client_leads')
      .select('discipline_name')
      .order('discipline_name');

    if (stats) {
      const disciplineCounts = stats.reduce((acc, s) => {
        acc[s.discipline_name] = (acc[s.discipline_name] || 0) + 1;
        return acc;
      }, {});

      Object.entries(disciplineCounts).forEach(([discipline, count]) => {
        console.log(`   ${discipline}: ${count} practices`);
      });
    }

    console.log('\n✅ Import process completed successfully!');

  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    throw error;
  }
}

// Run the import
importClientLeads().catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});
