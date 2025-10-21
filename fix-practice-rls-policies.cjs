const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzY1MTE5NCwiZXhwIjoyMDQ5MjI3MTk0fQ.J-IcrapboxEplemena7TuBhJfUKMMsDZ_wHPJJYE0k_A';

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function executeSQLQueries() {
  try {
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

    const { data: triggers, error: triggerError } = await supabase
      .rpc('exec_sql', { sql_query: triggerQuery });

    if (triggerError) {
      console.log('⚠️  Could not query triggers (exec_sql not available):', triggerError.message);
      console.log('Continuing with policy updates...\n');
    } else {
      console.log('Triggers found on practices table:');
      console.log(JSON.stringify(triggers, null, 2));
      console.log('');
    }

    console.log('🔧 Step 2: Creating RLS policy for practice_settings...\n');

    // Drop existing policy
    const dropPolicy1 = `DROP POLICY IF EXISTS "Allow anon full access to practice_settings" ON practice_settings;`;
    const { error: dropError1 } = await supabase.rpc('exec_sql', { sql_query: dropPolicy1 });

    if (dropError1) {
      console.log('⚠️  Drop policy warning:', dropError1.message);
    }

    // Create new policy
    const createPolicy1 = `CREATE POLICY "Allow anon full access to practice_settings" ON practice_settings FOR ALL TO anon USING (true) WITH CHECK (true);`;
    const { error: createError1 } = await supabase.rpc('exec_sql', { sql_query: createPolicy1 });

    if (createError1) {
      console.log('❌ Error creating practice_settings policy:', createError1.message);
    } else {
      console.log('✅ Successfully created RLS policy for practice_settings');
    }

    console.log('\n🔍 Step 3: Checking if practice_features table exists...\n');

    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'practice_features'
      ) AS exists;
    `;

    const { data: tableCheck, error: checkError } = await supabase.rpc('exec_sql', { sql_query: checkTableQuery });

    const tableExists = tableCheck && tableCheck[0]?.exists;
    console.log('practice_features table exists:', tableExists ? 'YES' : 'NO');

    if (tableExists) {
      console.log('\n🔧 Step 4: Creating RLS policy for practice_features...\n');

      // Drop existing policy
      const dropPolicy2 = `DROP POLICY IF EXISTS "Allow anon full access to practice_features" ON practice_features;`;
      await supabase.rpc('exec_sql', { sql_query: dropPolicy2 });

      // Create new policy
      const createPolicy2 = `CREATE POLICY "Allow anon full access to practice_features" ON practice_features FOR ALL TO anon USING (true) WITH CHECK (true);`;
      const { error: createError2 } = await supabase.rpc('exec_sql', { sql_query: createPolicy2 });

      if (createError2) {
        console.log('❌ Error creating practice_features policy:', createError2.message);
      } else {
        console.log('✅ Successfully created RLS policy for practice_features');
      }
    } else {
      console.log('⚠️  Skipping practice_features - table does not exist');
    }

    console.log('\n🔍 Step 5: Verifying policies...\n');

    const verifyQuery = `
      SELECT schemaname, tablename, policyname, roles::text[], cmd
      FROM pg_policies
      WHERE tablename IN ('practice_settings', 'practice_features')
      ORDER BY tablename, policyname;
    `;

    const { data: policies, error: verifyError } = await supabase.rpc('exec_sql', { sql_query: verifyQuery });

    if (verifyError) {
      console.log('⚠️  Could not verify policies:', verifyError.message);
    } else {
      console.log('Current RLS policies:');
      console.log(JSON.stringify(policies, null, 2));
    }

    console.log('\n✅ All operations completed!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error);
  }
}

executeSQLQueries();