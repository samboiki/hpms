const https = require('https');

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: 'jjxlfunlbyayxwvlpgwt.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
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

    try {
      const triggers = await executeSQL(triggerQuery);
      console.log('Triggers found:', JSON.stringify(triggers, null, 2));
    } catch (err) {
      console.log('⚠️  Could not query triggers:', err.message);
    }

    console.log('\n🔧 Step 2: Creating RLS policy for practice_settings...\n');

    // Drop existing policy
    try {
      await executeSQL('DROP POLICY IF EXISTS "Allow anon full access to practice_settings" ON practice_settings;');
      console.log('✅ Dropped existing policy (if any)');
    } catch (err) {
      console.log('⚠️  Drop policy:', err.message);
    }

    // Create new policy
    try {
      await executeSQL('CREATE POLICY "Allow anon full access to practice_settings" ON practice_settings FOR ALL TO anon USING (true) WITH CHECK (true);');
      console.log('✅ Successfully created RLS policy for practice_settings');
    } catch (err) {
      console.log('❌ Error creating policy:', err.message);
    }

    console.log('\n🔍 Step 3: Checking if practice_features table exists...\n');

    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'practice_features'
      ) AS exists;
    `;

    try {
      const tableCheck = await executeSQL(checkTableQuery);
      const tableExists = tableCheck && tableCheck[0]?.exists;
      console.log('practice_features table exists:', tableExists ? 'YES' : 'NO');

      if (tableExists) {
        console.log('\n🔧 Step 4: Creating RLS policy for practice_features...\n');

        await executeSQL('DROP POLICY IF EXISTS "Allow anon full access to practice_features" ON practice_features;');
        await executeSQL('CREATE POLICY "Allow anon full access to practice_features" ON practice_features FOR ALL TO anon USING (true) WITH CHECK (true);');
        console.log('✅ Successfully created RLS policy for practice_features');
      }
    } catch (err) {
      console.log('⚠️  practice_features check/update:', err.message);
    }

    console.log('\n🔍 Step 5: Verifying policies...\n');

    const verifyQuery = `
      SELECT schemaname, tablename, policyname, roles::text[], cmd
      FROM pg_policies
      WHERE tablename IN ('practice_settings', 'practice_features')
      ORDER BY tablename, policyname;
    `;

    try {
      const policies = await executeSQL(verifyQuery);
      console.log('Current RLS policies:');
      console.log(JSON.stringify(policies, null, 2));
    } catch (err) {
      console.log('⚠️  Could not verify policies:', err.message);
    }

    console.log('\n✅ All operations completed!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error);
  }
}

main();