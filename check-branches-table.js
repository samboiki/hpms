import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cejwbpuuqhcyetfvzinl.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlandicHV1cWhjeWV0ZnZ6aW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTI0NzI3MCwiZXhwIjoyMDQ0ODIzMjcwfQ.yt5dNxe2v-OGq9VXmL9dZrI3dCr4dV6OBtq2kWJZr6g';

const supabase = createClient(supabaseUrl, serviceKey);

async function checkBranchesTable() {
  console.log('🔍 Checking if branches table exists...\n');

  try {
    // First check if branches table exists
    const { data: tables, error: tablesError } = await supabase
      .from('branches')
      .select('id')
      .limit(1);

    if (tablesError && tablesError.code === '42P01') {
      console.log('❌ Branches table does not exist');
      console.log('ℹ️  Please run the migration: 20250626_add_branch_support.sql');
      return;
    } else if (tablesError) {
      console.error('❌ Error checking branches table:', tablesError);
      return;
    }

    console.log('✅ Branches table exists!');
    
    // Check if there are any branches
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('*')
      .order('name');

    if (branchesError) {
      console.error('❌ Error fetching branches:', branchesError);
      return;
    }

    console.log(`📊 Found ${branches?.length || 0} branches`);
    
    if (branches && branches.length > 0) {
      console.log('\n📋 Existing branches:');
      branches.forEach(branch => {
        console.log(`   - ${branch.name} (${branch.is_active ? 'Active' : 'Inactive'})`);
      });
    }

    // Check if user table has branch columns
    const { data: userColumns, error: userError } = await supabase
      .rpc('exec_raw_sql', {
        sql_query: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name IN ('branch_id', 'allowed_branches')
        `
      });

    if (userError) {
      console.error('❌ Error checking user columns:', userError);
    } else {
      console.log('\n✅ User table has branch columns:', userColumns);
    }

  } catch (err) {
    console.error('💥 Unexpected error:', err);
  }
}

checkBranchesTable();