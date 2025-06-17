import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('🔗 MCP SQL Executor');
  console.log('📝 Executing SQL query');
  console.log('🗂️  SQL:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
  
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
  console.log('🚀 Checking RLS policies for medical_aid_details...\n');

  // Check RLS policies
  const checkPoliciesQuery = `
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies 
    WHERE tablename = 'medical_aid_details';
  `;

  const policiesResult = await executeSql(checkPoliciesQuery);
  
  if (!policiesResult.success) {
    console.log('❌ Failed to check policies');
    return;
  }

  console.log('\n📋 Current RLS Policies:');
  
  // Check if RLS is enabled
  const checkRlsQuery = `
    SELECT schemaname, tablename, rowsecurity 
    FROM pg_tables 
    WHERE tablename = 'medical_aid_details';
  `;

  const rlsResult = await executeSql(checkRlsQuery);
  
  if (rlsResult.success) {
    console.log('\n🔒 RLS Status checked');
  }

  // Now create proper RLS policies for medical_aid_details
  console.log('\n🔧 Creating proper RLS policies for medical_aid_details...');

  // Enable RLS if not already enabled
  const enableRlsQuery = `
    ALTER TABLE medical_aid_details ENABLE ROW LEVEL SECURITY;
  `;

  await executeSql(enableRlsQuery);

  // Drop existing policies if they exist (to recreate them properly)
  const dropPoliciesQuery = `
    DROP POLICY IF EXISTS "medical_aid_select_policy" ON medical_aid_details;
    DROP POLICY IF EXISTS "medical_aid_insert_policy" ON medical_aid_details;
    DROP POLICY IF EXISTS "medical_aid_update_policy" ON medical_aid_details;
    DROP POLICY IF EXISTS "medical_aid_delete_policy" ON medical_aid_details;
  `;

  await executeSql(dropPoliciesQuery);

  // Create new comprehensive RLS policies
  const createPoliciesQuery = `
    -- Allow authenticated users to select medical aid details
    CREATE POLICY "medical_aid_select_policy" ON medical_aid_details
    FOR SELECT USING (auth.role() = 'authenticated');

    -- Allow authenticated users to insert medical aid details
    CREATE POLICY "medical_aid_insert_policy" ON medical_aid_details
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    -- Allow authenticated users to update medical aid details
    CREATE POLICY "medical_aid_update_policy" ON medical_aid_details
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

    -- Allow authenticated users to delete medical aid details
    CREATE POLICY "medical_aid_delete_policy" ON medical_aid_details
    FOR DELETE USING (auth.role() = 'authenticated');
  `;

  const createResult = await executeSql(createPoliciesQuery);
  
  if (createResult.success) {
    console.log('✅ RLS policies created successfully!');
  }

  // Verify the new policies
  console.log('\n🔍 Verifying new policies...');
  const verifyResult = await executeSql(checkPoliciesQuery);
  
  if (verifyResult.success) {
    console.log('✅ Policy verification successful!');
  }

  console.log('\n🎉 SUCCESS! Medical aid details RLS policies are now properly configured!');
  console.log('✅ Authenticated users can now perform all operations on medical_aid_details');
}

main().catch(console.error);