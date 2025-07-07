import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cejwbpuuqhcyetfvzinl.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlandicHV1cWhjeWV0ZnZ6aW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTI0NzI3MCwiZXhwIjoyMDQ0ODIzMjcwfQ.yt5dNxe2v-OGq9VXmL9dZrI3dCr4dV6OBtq2kWJZr6g';

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

async function updateBranchPolicies() {
  console.log('🔄 Updating branch RLS policies to allow doctors...\n');

  const updatePoliciesQuery = `
    -- Update RLS policies for branches to allow doctors to manage branches too

    -- Drop existing restrictive policy
    DROP POLICY IF EXISTS "Admin can manage branches" ON branches;

    -- Create new policy that allows both admin and doctor roles to manage branches
    CREATE POLICY "Admin and doctors can manage branches"
      ON branches FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND role IN ('admin', 'doctor')
          AND practice_id = branches.practice_id
        )
      );

    -- Also update the insert policy to be explicit
    CREATE POLICY "Admin and doctors can insert branches"
      ON branches FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND role IN ('admin', 'doctor')
          AND practice_id = branches.practice_id
        )
      );

    -- Update doctor_branch_schedules policies as well
    DROP POLICY IF EXISTS "Admin can manage doctor schedules" ON doctor_branch_schedules;

    CREATE POLICY "Admin and doctors can manage doctor schedules"
      ON doctor_branch_schedules FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users u
          JOIN branches b ON b.practice_id = u.practice_id
          WHERE u.id = auth.uid() 
          AND u.role IN ('admin', 'doctor')
          AND b.id = doctor_branch_schedules.branch_id
        )
      );
  `;

  console.log('📝 Executing policy updates...');
  const result = await executeSql(updatePoliciesQuery);
  
  if (!result.success) {
    console.log('❌ Failed to update branch policies');
    console.log('ℹ️  Error:', result.error);
    console.log('\n📋 You can manually run the migration in Supabase SQL Editor:');
    console.log('   File: supabase/migrations/20250626_update_branch_policies.sql');
    return;
  }

  console.log('✅ Branch policies updated successfully!');
  console.log('✨ Doctors can now create and manage branches');

  // List current policies
  console.log('\n📋 Checking current policies...');
  const checkPoliciesQuery = `
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual
    FROM pg_policies 
    WHERE tablename IN ('branches', 'doctor_branch_schedules')
    ORDER BY tablename, policyname;
  `;

  const policiesResult = await executeSql(checkPoliciesQuery);
  if (policiesResult.success) {
    console.log('📊 Current policies:', policiesResult.data);
  }
}

updateBranchPolicies();