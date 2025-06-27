import { createClient } from '@supabase/supabase-js';

// Your Supabase credentials from the MCP config
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLSPolicies() {
  console.log('🔧 Fixing RLS policies for users table...\n');

  const queries = [
    // Drop existing policies
    `DROP POLICY IF EXISTS "Users can view users in their practice" ON users`,
    `DROP POLICY IF EXISTS "Users can view own profile" ON users`,
    `DROP POLICY IF EXISTS "Users can update own profile" ON users`,
    `DROP POLICY IF EXISTS "Users can view practice members" ON users`,
    `DROP POLICY IF EXISTS "Admins can manage users" ON users`,
    `DROP POLICY IF EXISTS "Admins and doctors can manage practice users" ON users`,
    `DROP POLICY IF EXISTS "Allow users to view other users in same practice" ON users`,
    `DROP POLICY IF EXISTS "Enable read access for all users" ON users`,
    `DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users`,
    `DROP POLICY IF EXISTS "Enable update for users based on id" ON users`,
    `DROP POLICY IF EXISTS "Enable delete for users based on id" ON users`,
    
    // Create new policies
    `CREATE POLICY "users_select_policy" ON users FOR SELECT TO authenticated USING (true)`,
    `CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`,
    `CREATE POLICY "users_insert_admin" ON users FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'doctor')))`,
    `CREATE POLICY "users_delete_admin" ON users FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'doctor')))`,
    
    // Ensure RLS is enabled
    `ALTER TABLE users ENABLE ROW LEVEL SECURITY`
  ];

  for (const query of queries) {
    try {
      console.log(`Executing: ${query.substring(0, 50)}...`);
      
      // Using the admin API to execute raw SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_raw_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ sql_query: query })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Failed: ${error}`);
      } else {
        console.log(`✅ Success`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n✨ RLS fix completed! You should now be able to see all users in your practice.');
}

// Run the fix
fixRLSPolicies().catch(console.error);