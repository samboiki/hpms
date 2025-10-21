import { createClient } from '@supabase/supabase-js';

// Database credentials (using service role key for admin operations)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTableExistence(tableName) {
  console.log(`🔍 Checking if table '${tableName}' exists...`);

  try {
    // Try to execute SELECT COUNT(*) from the table
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log(`❌ Table '${tableName}' does not exist`);
        console.log(`   Error: ${error.message}`);
        return { exists: false, count: null, error: error.message };
      } else {
        console.log(`⚠️  Table '${tableName}' might exist but there's an access issue`);
        console.log(`   Error: ${error.message}`);
        return { exists: 'unknown', count: null, error: error.message };
      }
    } else {
      console.log(`✅ Table '${tableName}' exists with ${count} rows`);
      return { exists: true, count: count, error: null };
    }
  } catch (error) {
    console.log(`❌ Unexpected error checking table '${tableName}': ${error.message}`);
    return { exists: false, count: null, error: error.message };
  }
}

async function main() {
  console.log('🚀 Table Existence Checker\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  const tablesToCheck = ['wards', 'rooms', 'beds'];
  const results = {};

  for (const tableName of tablesToCheck) {
    results[tableName] = await checkTableExistence(tableName);
    console.log(''); // Empty line for readability
  }

  console.log('📊 SUMMARY:');
  console.log('═══════════');

  for (const [tableName, result] of Object.entries(results)) {
    if (result.exists === true) {
      console.log(`✅ ${tableName}: EXISTS (${result.count} rows)`);
    } else if (result.exists === 'unknown') {
      console.log(`⚠️  ${tableName}: ACCESS ISSUE - ${result.error}`);
    } else {
      console.log(`❌ ${tableName}: DOES NOT EXIST`);
    }
  }

  console.log('\n✅ Check complete!');
}

main().catch(console.error);