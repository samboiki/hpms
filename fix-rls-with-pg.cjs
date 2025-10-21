const { Pool } = require('pg');
const fs = require('fs');

// Supabase connection string
const connectionString = 'postgresql://postgres.jjxlfunlbyayxwvlpgwt:AJsquare4121!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function executeSQL() {
  const client = await pool.connect();

  try {
    console.log('🔗 Connected to Supabase database\n');

    // Step 1: Check triggers on practices table
    console.log('🔍 Step 1: Checking triggers on practices table...\n');
    const triggerQuery = `
      SELECT
          tgname AS trigger_name,
          tgrelid::regclass AS table_name,
          proname AS function_name
      FROM pg_trigger
      JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
      WHERE tgrelid = 'practices'::regclass;
    `;

    const triggersResult = await client.query(triggerQuery);
    if (triggersResult.rows.length > 0) {
      console.log('Triggers found on practices table:');
      console.table(triggersResult.rows);
    } else {
      console.log('No triggers found on practices table');
    }
    console.log('');

    // Step 2: Drop and create policy for practice_settings
    console.log('🔧 Step 2: Creating RLS policy for practice_settings...\n');

    await client.query('DROP POLICY IF EXISTS "Allow anon full access to practice_settings" ON practice_settings;');
    console.log('✅ Dropped existing policy (if any)');

    await client.query('CREATE POLICY "Allow anon full access to practice_settings" ON practice_settings FOR ALL TO anon USING (true) WITH CHECK (true);');
    console.log('✅ Successfully created RLS policy for practice_settings\n');

    // Step 3: Check if practice_features exists
    console.log('🔍 Step 3: Checking if practice_features table exists...\n');
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'practice_features'
      ) AS exists;
    `;

    const tableCheckResult = await client.query(checkTableQuery);
    const tableExists = tableCheckResult.rows[0].exists;
    console.log('practice_features table exists:', tableExists ? 'YES' : 'NO');
    console.log('');

    // Step 4: Create policy for practice_features if it exists
    if (tableExists) {
      console.log('🔧 Step 4: Creating RLS policy for practice_features...\n');

      await client.query('DROP POLICY IF EXISTS "Allow anon full access to practice_features" ON practice_features;');
      console.log('✅ Dropped existing policy (if any)');

      await client.query('CREATE POLICY "Allow anon full access to practice_features" ON practice_features FOR ALL TO anon USING (true) WITH CHECK (true);');
      console.log('✅ Successfully created RLS policy for practice_features\n');
    } else {
      console.log('⚠️  Skipping practice_features - table does not exist\n');
    }

    // Step 5: Verify policies
    console.log('🔍 Step 5: Verifying policies...\n');
    const verifyQuery = `
      SELECT schemaname, tablename, policyname, roles::text[], cmd
      FROM pg_policies
      WHERE tablename IN ('practice_settings', 'practice_features')
      ORDER BY tablename, policyname;
    `;

    const policiesResult = await client.query(verifyQuery);
    if (policiesResult.rows.length > 0) {
      console.log('Current RLS policies:');
      console.table(policiesResult.rows);
    } else {
      console.log('⚠️  No policies found (this might be an issue)');
    }

    console.log('\n✅ All operations completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

executeSQL();