import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function executeRawSQL(sql) {
  try {
    // Use the REST API with service role key to execute DDL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      return { success: true, data: await response.json() };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function importClientLeads() {
  try {
    console.log('📊 Starting client leads import process...\n');
    console.log(`🔌 Using Supabase URL: ${supabaseUrl}`);
    console.log(`🔑 Service role key: ${supabaseServiceKey.substring(0, 20)}...`);
    console.log('');

    // Step 1: Test connection
    console.log('1️⃣ Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('practices')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Connection test failed:', testError.message);
      throw new Error('Cannot connect to Supabase');
    }
    console.log('✅ Connection successful\n');

    // Step 2: Check if table exists
    console.log('2️⃣ Checking if client_leads table exists...');
    const { data: existingData, error: existingError } = await supabase
      .from('client_leads')
      .select('id')
      .limit(1);

    if (existingError && existingError.code === '42P01') {
      console.log('⚠️  Table does not exist, will create it during first insert');
    } else if (!existingError) {
      console.log('✅ Table already exists');

      // Check current count
      const { count } = await supabase
        .from('client_leads')
        .select('*', { count: 'exact', head: true });

      console.log(`📊 Current records in table: ${count}\n`);
    }

    // Step 3: Read CSV file
    console.log('3️⃣ Reading CSV file...');
    const csvPath = 'C:\\Users\\Happyou2\\Downloads\\CLIENTS.csv';
    const csvContent = readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log(`✅ Read ${lines.length} lines (including header)\n`);

    // Step 4: Parse CSV
    console.log('4️⃣ Parsing CSV data...');
    const dataLines = lines.slice(1); // Skip header
    const records = [];

    for (const line of dataLines) {
      const parts = line.split(',');

      if (parts.length >= 7 && parts[2]?.trim()) {
        const record = {
          discipline_code: parts[0]?.trim() || null,
          discipline_name: parts[1]?.trim() || null,
          practice_number: parts[2]?.trim(),
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
    console.log(`📋 Sample record:`, JSON.stringify(records[0], null, 2));
    console.log('');

    // Step 5: Create table if it doesn't exist (via first insert attempt)
    console.log('5️⃣ Ensuring table structure...');

    // Try to create table using a separate admin operation
    try {
      // We'll use a workaround: create the table by ensuring it exists via INSERT
      // First, let's try a manual SQL execution through Supabase's SQL editor equivalent

      console.log('   Attempting to ensure table exists...');

      // Check if we can query the table
      const { error: checkError } = await supabase
        .from('client_leads')
        .select('id')
        .limit(0);

      if (checkError && checkError.code === '42P01') {
        console.log('   ⚠️  Table needs to be created');
        console.log('   📝 Creating table structure...');

        // Since we can't execute DDL directly, we'll need to use a migration
        // For now, let's inform the user
        console.log('\n');
        console.log('='+ '='.repeat(70));
        console.log('⚠️  TABLE CREATION REQUIRED');
        console.log('='.repeat(70));
        console.log('The client_leads table does not exist and needs to be created.');
        console.log('Please run the following SQL in your Supabase SQL Editor:');
        console.log('');
        console.log('CREATE TABLE IF NOT EXISTS client_leads (');
        console.log('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
        console.log('  discipline_code TEXT,');
        console.log('  discipline_name TEXT,');
        console.log('  practice_number TEXT UNIQUE NOT NULL,');
        console.log('  practice_name TEXT,');
        console.log('  town TEXT,');
        console.log('  phone TEXT,');
        console.log('  email TEXT,');
        console.log('  created_at TIMESTAMPTZ DEFAULT NOW(),');
        console.log('  updated_at TIMESTAMPTZ DEFAULT NOW()');
        console.log(');');
        console.log('');
        console.log('CREATE INDEX IF NOT EXISTS idx_client_leads_practice_number ON client_leads(practice_number);');
        console.log('CREATE INDEX IF NOT EXISTS idx_client_leads_town ON client_leads(town);');
        console.log('CREATE INDEX IF NOT EXISTS idx_client_leads_discipline_name ON client_leads(discipline_name);');
        console.log('');
        console.log('ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;');
        console.log('');
        console.log('CREATE POLICY "Service role has full access to client_leads"');
        console.log('  ON client_leads FOR ALL TO service_role');
        console.log('  USING (true) WITH CHECK (true);');
        console.log('');
        console.log('CREATE POLICY "Authenticated users can read client_leads"');
        console.log('  ON client_leads FOR SELECT TO authenticated');
        console.log('  USING (true);');
        console.log('='.repeat(70));
        console.log('');

        console.log('⏸️  Pausing for table creation. Press Ctrl+C to exit, or wait...');
        console.log('   Or, let me try to create it via the Supabase Management API...\n');

        // Try one more approach using fetch directly to postgres REST API
        const createSQL = `
CREATE TABLE IF NOT EXISTS client_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_code TEXT,
  discipline_name TEXT,
  practice_number TEXT UNIQUE NOT NULL,
  practice_name TEXT,
  town TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_leads_practice_number ON client_leads(practice_number);
CREATE INDEX IF NOT EXISTS idx_client_leads_town ON client_leads(town);
CREATE INDEX IF NOT EXISTS idx_client_leads_discipline_name ON client_leads(discipline_name);

ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role has full access to client_leads"
  ON client_leads FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can read client_leads"
  ON client_leads FOR SELECT TO authenticated
  USING (true);
        `.trim();

        // Save the SQL to a file for manual execution
        const { writeFileSync } = await import('fs');
        writeFileSync('C:\\projects\\hpms\\create-client-leads-table.sql', createSQL);
        console.log('   💾 SQL saved to: C:\\projects\\hpms\\create-client-leads-table.sql');
        console.log('');
        console.log('❌ Cannot proceed without table. Please create it first.');
        console.log('   You can run: supabase db execute --file create-client-leads-table.sql');
        console.log('   Or copy the SQL above into your Supabase dashboard SQL editor.');
        return;
      } else {
        console.log('✅ Table structure verified\n');
      }
    } catch (err) {
      console.error('❌ Error checking table:', err.message);
    }

    // Step 6: Insert records
    console.log('6️⃣ Inserting records into database...');
    console.log(`   Using batch size: 50 records per batch\n`);

    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const errors = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);

      process.stdout.write(`   📦 Batch ${batchNum}/${totalBatches} (${batch.length} records)... `);

      try {
        const { data, error } = await supabase
          .from('client_leads')
          .upsert(batch, {
            onConflict: 'practice_number',
            ignoreDuplicates: false
          });

        if (error) {
          console.log(`❌`);
          console.log(`      Error: ${error.message}`);
          errorCount += batch.length;
          errors.push({ batch: batchNum, error: error.message, code: error.code });
        } else {
          successCount += batch.length;
          console.log(`✅`);
        }
      } catch (err) {
        console.log(`❌`);
        console.log(`      Exception: ${err.message}`);
        errorCount += batch.length;
        errors.push({ batch: batchNum, error: err.message });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('');

    // Step 7: Verify import
    console.log('7️⃣ Verifying import...');
    const { count, error: countError } = await supabase
      .from('client_leads')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Could not verify count:', countError.message);
    } else {
      console.log(`✅ Total records in database: ${count}\n`);
    }

    // Final summary
    console.log('='.repeat(70));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`📁 CSV records processed: ${records.length}`);
    console.log(`✅ Successfully imported/updated: ${successCount} records`);
    console.log(`❌ Failed: ${errorCount} records`);
    console.log(`📈 Total in database: ${count ?? 'Unknown'}`);
    console.log('='.repeat(70));
    console.log('');

    if (errors.length > 0 && errors.length <= 10) {
      console.log('⚠️  Errors encountered:');
      errors.forEach(e => console.log(`   Batch ${e.batch}: ${e.error} ${e.code ? `(${e.code})` : ''}`));
      console.log('');
    }

    // Step 8: Show sample data
    if (successCount > 0) {
      console.log('8️⃣ Sample imported records:');
      const { data: samples } = await supabase
        .from('client_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (samples && samples.length > 0) {
        samples.forEach((s, i) => {
          console.log(`\n   ${i + 1}. ${s.practice_name}`);
          console.log(`      Practice #: ${s.practice_number}`);
          console.log(`      Discipline: ${s.discipline_name}`);
          console.log(`      Town: ${s.town}`);
          console.log(`      Phone: ${s.phone || 'N/A'}`);
          console.log(`      Email: ${s.email || 'N/A'}`);
        });
        console.log('');
      }

      // Step 9: Statistics
      console.log('9️⃣ Statistics by discipline:');
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
        console.log('');
      }

      console.log('🔟 Top 10 towns by practice count:');
      const { data: townRecords } = await supabase
        .from('client_leads')
        .select('town')
        .not('town', 'is', null);

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
        console.log('');
      }
    }

    console.log('✅ Import process completed!\n');

    return { successCount, errorCount, totalCount: count };

  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    console.error('   Stack trace:', error.stack);
    throw error;
  }
}

// Run the import
importClientLeads()
  .then(result => {
    if (result) {
      console.log(`🎉 Successfully imported ${result.successCount}/${result.totalCount} records!`);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  });
