import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cejwbpuuqhcyetfvzinl.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlandicHV1cWhjeWV0ZnZ6aW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTI0NzI3MCwiZXhwIjoyMDQ0ODIzMjcwfQ.yt5dNxe2v-OGq9VXmL9dZrI3dCr4dV6OBtq2kWJZr6g';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('📝 Executing SQL query...');
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: query
    });

    if (error) {
      console.error('❌ SQL execution failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ SQL executed successfully!');
    return { success: true, data };
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

async function fixBranchesRLS() {
  console.log('🔧 Fixing branches table RLS policies...\n');

  // First, let's drop ALL existing policies on branches table
  const dropAllPoliciesQuery = `
    -- Drop all existing policies on branches table
    DROP POLICY IF EXISTS "Users can view branches of their practice" ON branches;
    DROP POLICY IF EXISTS "Admin can manage branches" ON branches;
    DROP POLICY IF EXISTS "Admin and doctors can manage branches" ON branches;
    DROP POLICY IF EXISTS "Admin and doctors can insert branches" ON branches;
  `;

  console.log('🗑️  Dropping all existing policies...');
  await executeSql(dropAllPoliciesQuery);

  // Now create comprehensive policies
  const createPoliciesQuery = `
    -- Enable RLS on branches table if not already enabled
    ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

    -- Policy 1: Allow users to VIEW branches from their practice
    CREATE POLICY "Users can view their practice branches"
      ON branches FOR SELECT
      USING (
        practice_id IN (
          SELECT practice_id FROM users WHERE id = auth.uid()
        )
      );

    -- Policy 2: Allow admin and doctor to INSERT branches
    CREATE POLICY "Admin and doctor can create branches"
      ON branches FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND role IN ('admin', 'doctor')
          AND practice_id = branches.practice_id
        )
      );

    -- Policy 3: Allow admin and doctor to UPDATE branches
    CREATE POLICY "Admin and doctor can update branches"
      ON branches FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND role IN ('admin', 'doctor')
          AND practice_id = branches.practice_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND role IN ('admin', 'doctor')
          AND practice_id = branches.practice_id
        )
      );

    -- Policy 4: Allow admin and doctor to DELETE branches
    CREATE POLICY "Admin and doctor can delete branches"
      ON branches FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND role IN ('admin', 'doctor')
          AND practice_id = branches.practice_id
        )
      );
  `;

  console.log('✨ Creating new comprehensive policies...');
  const result = await executeSql(createPoliciesQuery);
  
  if (!result.success) {
    console.log('❌ Failed to create new policies');
    console.log('\n📋 Manual fix instructions:');
    console.log('1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Run the following SQL:\n');
    console.log(dropAllPoliciesQuery);
    console.log(createPoliciesQuery);
    return;
  }

  console.log('✅ RLS policies fixed successfully!');
  
  // Verify the policies
  console.log('\n🔍 Verifying policies...');
  const verifyQuery = `
    SELECT 
      policyname,
      permissive,
      cmd,
      qual,
      with_check
    FROM pg_policies 
    WHERE tablename = 'branches'
    ORDER BY policyname;
  `;

  const verifyResult = await executeSql(verifyQuery);
  if (verifyResult.success) {
    console.log('📊 Current branch policies:', verifyResult.data);
  }

  // Also check if the user making requests has the right role
  console.log('\n🔍 Checking authenticated user info...');
  const userCheckQuery = `
    SELECT id, email, role, practice_id 
    FROM users 
    WHERE id = auth.uid();
  `;

  const userResult = await executeSql(userCheckQuery);
  if (userResult.success) {
    console.log('👤 Current user:', userResult.data);
  }
}

// Execute the fix
fixBranchesRLS();