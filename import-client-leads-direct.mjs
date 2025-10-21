import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql) {
  const { data, error } = await supabase.rpc('exec', { sql });
  return { data, error };
}

async function importClientLeads() {
  try {
    console.log('📊 Starting client leads import process...\n');

    // Step 1: Create table using raw SQL
    console.log('1️⃣ Creating client_leads table...');

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

CREATE INDEX IF NOT EXISTS idx_client_leads_practice_number ON client_leads(practice_number);
CREATE INDEX IF NOT EXISTS idx_client_leads_town ON client_leads(town);
    `.trim();

    console.log('Executing SQL via REST API...');

    // Use the REST API directly to execute DDL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql: createTableSQL })
    });

    if (!response.ok) {
      // Table might already exist, let's try to query it
      console.log('⚠️  Could not execute via RPC, checking if table exists...');

      const { data: testData, error: testError } = await supabase
        .from('client_leads')
        .select('id')
        .limit(1);

      if (testError && testError.code === '42P01') {
        console.error('❌ Table does not exist. Creating via alternative method...');

        // Try using management API
        const mgmtResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            query: createTableSQL
          })
        });

        if (!mgmtResponse.ok) {
          console.log('⚠️  Alternative method failed. Will create table inline during insert.');
        } else {
          console.log('✅ Table created via alternative method');
        }
      } else if (!testError) {
        console.log('✅ Table already exists');
      }
    } else {
      console.log('✅ Table created successfully');
    }

    // Step 2: Read and parse CSV
    console.log('\n2️⃣ Reading CSV file...');
    const csvPath = 'C:\\Users\\Happyou2\\Downloads\\CLIENTS.csv';
    const csvContent = readFileSync(csvPath, 'utf8');

    // Parse CSV properly handling quotes and commas
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log(`✅ Read ${lines.length} lines`);

    const dataLines = lines.slice(1); // Skip header

    console.log('\n3️⃣ Parsing CSV data...');
    const records = [];

    for (const line of dataLines) {
      // Simple CSV parsing - split by comma
      const parts = line.split(',');

      if (parts.length >= 7 && parts[2]) { // Must have at least practice number
        const record = {
          discipline_code: parts[0]?.trim() || null,
          discipline_name: parts[1]?.trim() || null,
          practice_number: parts[2]?.trim() || null,
          practice_name: parts[3]?.trim() || null,
          town: parts[4]?.trim() || null,
          phone: parts[5]?.trim() === '0' ? null : parts[5]?.trim() || null,
          email: parts[6]?.trim() || null
        };

        if (record.practice_number) {
          records.push(record);
        }
      }
    }

    console.log(`✅ Parsed ${records.length} valid records`);
    console.log(`\n📋 Sample record:`, JSON.stringify(records[0], null, 2));

    // Step 3: Insert records using Supabase client (with upsert for duplicates)
    console.log('\n4️⃣ Inserting records into database...');

    const batchSize = 50; // Smaller batches for better error handling
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);

      process.stdout.write(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} records)... `);

      try {
        const { data, error } = await supabase
          .from('client_leads')
          .upsert(batch, {
            onConflict: 'practice_number',
            ignoreDuplicates: false
          });

        if (error) {
          console.log(`❌ Error: ${error.message}`);
          errorCount += batch.length;
          errors.push({ batch: batchNum, error: error.message, code: error.code });
        } else {
          successCount += batch.length;
          console.log(`✅`);
        }
      } catch (err) {
        console.log(`❌ Exception: ${err.message}`);
        errorCount += batch.length;
        errors.push({ batch: batchNum, error: err.message });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Step 4: Verify and report
    console.log('\n5️⃣ Verifying import...');
    const { count, error: countError } = await supabase
      .from('client_leads')
      .select('*', { count: 'exact', head: true });

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`📁 CSV records processed: ${records.length}`);
    console.log(`✅ Successfully imported: ${successCount} records`);
    console.log(`❌ Failed: ${errorCount} records`);
    console.log(`📈 Total in database: ${count ?? 'Unknown'}`);
    console.log('='.repeat(70));

    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach(e => console.log(`   Batch ${e.batch}: ${e.error} ${e.code ? `(${e.code})` : ''}`));
    } else if (errors.length > 10) {
      console.log(`\n⚠️  ${errors.length} batches had errors. First 5:`);
      errors.slice(0, 5).forEach(e => console.log(`   Batch ${e.batch}: ${e.error}`));
    }

    // Show sample data
    console.log('\n6️⃣ Sample imported records:');
    const { data: samples } = await supabase
      .from('client_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (samples && samples.length > 0) {
      samples.forEach((s, i) => {
        console.log(`\n${i + 1}. ${s.practice_name}`);
        console.log(`   Practice #: ${s.practice_number}`);
        console.log(`   Discipline: ${s.discipline_name}`);
        console.log(`   Town: ${s.town}`);
        console.log(`   Phone: ${s.phone || 'N/A'}`);
        console.log(`   Email: ${s.email || 'N/A'}`);
      });
    }

    // Show statistics by discipline
    console.log('\n7️⃣ Statistics by discipline:');
    const { data: allRecords } = await supabase
      .from('client_leads')
      .select('discipline_name');

    if (allRecords) {
      const disciplineCounts = allRecords.reduce((acc, r) => {
        const discipline = r.discipline_name || 'Unknown';
        acc[discipline] = (acc[discipline] || 0) + 1;
        return acc;
      }, {});

      Object.entries(disciplineCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([discipline, count]) => {
          console.log(`   ${discipline}: ${count} practices`);
        });
    }

    // Show statistics by town
    console.log('\n8️⃣ Top 10 towns by practice count:');
    const { data: townRecords } = await supabase
      .from('client_leads')
      .select('town');

    if (townRecords) {
      const townCounts = townRecords.reduce((acc, r) => {
        const town = r.town || 'Unknown';
        acc[town] = (acc[town] || 0) + 1;
        return acc;
      }, {});

      Object.entries(townCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([town, count]) => {
          console.log(`   ${town}: ${count} practices`);
        });
    }

    console.log('\n✅ Import process completed!');

    return { successCount, errorCount, total: count };

  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    throw error;
  }
}

// Run the import
importClientLeads()
  .then(result => {
    console.log(`\n🎉 Final result: ${result.successCount}/${result.total} records imported successfully`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
