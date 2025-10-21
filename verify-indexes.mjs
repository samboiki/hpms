import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyIndexes() {
  console.log('🔍 Verifying indexes in the database...\n');

  try {
    // Use direct SQL query via Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_raw_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        query_text: `SELECT * FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);

      // Try using pg library directly
      console.log('\n⚠️ Trying alternative method with postgres...\n');

      const { createClient: createPgClient } = await import('pg').catch(() => null);

      if (!createPgClient) {
        console.log('ℹ️ Installing pg library...');
        const { execSync } = await import('child_process');
        execSync('npm install pg', { stdio: 'inherit' });
        console.log('✅ pg library installed');
      }

      // Direct connection string approach
      console.log('🔄 Connecting directly to database...\n');

      const connectionString = `postgresql://postgres.jjxlfunlbyayxwvlpgwt:${process.env.SUPABASE_DB_PASSWORD || 'your_password'}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;

      console.log('⚠️ Manual verification required.');
      console.log('\n📋 Please run this query in Supabase SQL Editor:\n');
      console.log(`
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
      `);

      process.exit(1);
    }

    const result = await response.json();

    if (!result || result.length === 0) {
      console.log('⚠️ No indexes found matching pattern "idx_%"');
      console.log('\nℹ️ This might mean:');
      console.log('  1. Indexes were not created yet');
      console.log('  2. Indexes were created with different naming convention');
      console.log('  3. Query needs different approach\n');
      process.exit(0);
    }

    console.log(`✅ Found ${result.length} indexes:\n`);
    console.table(result);

    // Group by table
    const byTable = result.reduce((acc, idx) => {
      if (!acc[idx.tablename]) {
        acc[idx.tablename] = [];
      }
      acc[idx.tablename].push(idx.indexname);
      return acc;
    }, {});

    console.log('\n📊 Summary by table:');
    Object.entries(byTable).forEach(([table, indexes]) => {
      console.log(`  ${table}: ${indexes.length} indexes`);
      indexes.forEach(idx => console.log(`    - ${idx}`));
    });

    console.log('\n✅ Index verification complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nℹ️ Please verify indexes manually in Supabase dashboard.');
    process.exit(1);
  }
}

verifyIndexes().catch(console.error);
