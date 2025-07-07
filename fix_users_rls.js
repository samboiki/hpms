import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
// You'll need to add your service role key here
const serviceKey = 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('🔗 MCP SQL Executor');
  console.log('📝 Executing SQL query');
  console.log('🗂️  SQL:', query.substring(0, 200) + (query.length > 200 ? '...' : ''));
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: query
    });

    if (error) {
      console.error('❌ SQL execution failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    return { success: true, data };
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🚀 Fixing Users RLS Policy (Removing Infinite Recursion)...\n');

  // First ensure the exec_raw_sql function exists
  const createFunctionQuery = `
CREATE OR REPLACE FUNCTION exec_raw_sql(sql_query text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result text;
  row_count_result integer;
BEGIN
  EXECUTE sql_query;
  GET DIAGNOSTICS row_count_result = ROW_COUNT;
  RETURN 'SUCCESS: Executed successfully. Rows affected: ' || row_count_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR: ' || SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')';
END;
$$;
  `;

  console.log('📝 Creating exec_raw_sql function if not exists...');
  const funcResult = await executeSql(createFunctionQuery);
  
  if (!funcResult.success) {
    console.log('❌ Failed to create exec_raw_sql function');
    return;
  }

  // Drop all existing policies
  const dropPoliciesQuery = `
DO $$ 
BEGIN
    -- Drop all existing policies
    DROP POLICY IF EXISTS "Users can view users in their practice" ON users;
    DROP POLICY IF EXISTS "Users can view own profile" ON users;
    DROP POLICY IF EXISTS "Users can update own profile" ON users;
    DROP POLICY IF EXISTS "Users can view practice members" ON users;
    DROP POLICY IF EXISTS "Admins can manage users" ON users;
    DROP POLICY IF EXISTS "Admins and doctors can manage practice users" ON users;
    DROP POLICY IF EXISTS "Allow users to view other users in same practice" ON users;
    DROP POLICY IF EXISTS "Enable read access for all users" ON users;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
    DROP POLICY IF EXISTS "Enable update for users based on id" ON users;
    DROP POLICY IF EXISTS "Enable delete for users based on id" ON users;
END $$;
  `;

  console.log('\n🗑️  Dropping all existing policies on users table...');
  const dropResult = await executeSql(dropPoliciesQuery);
  
  if (!dropResult.success) {
    console.log('❌ Failed to drop existing policies');
    return;
  }

  // Create new non-recursive policies
  const policies = [
    {
      name: 'users_select_policy',
      query: `
CREATE POLICY "users_select_policy" ON users
FOR SELECT
TO authenticated
USING (true);
      `
    },
    {
      name: 'users_update_own',
      query: `
CREATE POLICY "users_update_own" ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
      `
    },
    {
      name: 'users_insert_admin',
      query: `
CREATE POLICY "users_insert_admin" ON users
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'doctor')
    )
);
      `
    },
    {
      name: 'users_delete_admin',
      query: `
CREATE POLICY "users_delete_admin" ON users
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'doctor')
    )
);
      `
    }
  ];

  // Apply each policy
  for (const policy of policies) {
    console.log(`\n📋 Creating policy: ${policy.name}...`);
    const result = await executeSql(policy.query);
    
    if (!result.success) {
      console.log(`❌ Failed to create policy ${policy.name}`);
      console.log('Continuing with other policies...');
    } else {
      console.log(`✅ Policy ${policy.name} created successfully`);
    }
  }

  // Ensure RLS is enabled
  console.log('\n🔒 Ensuring RLS is enabled on users table...');
  const rlsResult = await executeSql('ALTER TABLE users ENABLE ROW LEVEL SECURITY;');
  
  if (!rlsResult.success) {
    console.log('❌ Failed to enable RLS');
  } else {
    console.log('✅ RLS enabled successfully');
  }

  console.log('\n🎉 RLS fix completed! The infinite recursion issue should be resolved.');
  console.log('📌 Note: All authenticated users can now view all users. You can restrict this later based on practice_id.');
}

main().catch(console.error);