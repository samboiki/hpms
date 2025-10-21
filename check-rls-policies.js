import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA',
  { auth: { autoRefreshToken: false, persistSession: false }}
);

async function checkRLSPolicies() {
  console.log('🔐 Checking RLS policies for departments table...');

  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: `
        SELECT
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE tablename = 'departments'
        ORDER BY policyname;
      `
    });

    if (error) {
      console.log('❌ Error checking policies:', error);
      return;
    }

    console.log('Raw policy data:', data);
    console.log('Data type:', typeof data);
    console.log('Is array:', Array.isArray(data));

    if (Array.isArray(data) && data.length > 0) {
      console.log('📋 RLS Policies for departments table:');
      console.log('=====================================');
      data.forEach((policy, index) => {
        console.log(`${index + 1}. Policy: ${policy.policyname}`);
        console.log(`   Command: ${policy.cmd}`);
        console.log(`   Roles: ${policy.roles}`);
        console.log(`   Condition: ${policy.qual || 'None'}`);
        console.log('');
      });
    } else if (data) {
      console.log('📋 RLS Policy data (non-array format):');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('ℹ️  No RLS policies found for departments table');
    }

    // Check if RLS is enabled
    const { data: rlsStatus, error: rlsError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `
        SELECT
          schemaname,
          tablename,
          rowsecurity
        FROM pg_tables
        WHERE tablename = 'departments'
          AND schemaname = 'public';
      `
    });

    if (rlsError) {
      console.log('❌ Error checking RLS status:', rlsError);
    } else if (rlsStatus && rlsStatus.length > 0) {
      console.log('🔒 RLS Status:');
      console.log(`   RLS Enabled: ${rlsStatus[0].rowsecurity}`);
    }

  } catch (error) {
    console.log('❌ Unexpected error:', error);
  }
}

checkRLSPolicies().catch(console.error);