import { createClient } from '@supabase/supabase-js';

// Test with both anon and service role keys
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.0YHZfS6dTgTSIVPk1VN4FJ41qz7aCRt7gfCRc6zAT4c';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

async function testDepartmentOperations() {
  console.log('🧪 Testing department operations with different clients...\n');

  // Test with anon key (simulating frontend)
  console.log('1. Testing with ANON key (simulating frontend)...');
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Test SELECT
    const { data: anonSelectData, error: anonSelectError } = await anonClient
      .from('departments')
      .select('*')
      .limit(1);

    if (anonSelectError) {
      console.log('❌ Anon SELECT error:', anonSelectError.message);
      console.log('   Code:', anonSelectError.code);
      console.log('   Details:', anonSelectError.details);
    } else {
      console.log('✅ Anon SELECT successful, found', anonSelectData?.length || 0, 'departments');

      if (anonSelectData && anonSelectData.length > 0) {
        const testDept = anonSelectData[0];

        // Test UPDATE with anon key
        console.log('   Testing UPDATE with anon key...');
        const { data: anonUpdateData, error: anonUpdateError } = await anonClient
          .from('departments')
          .update({ name: testDept.name + ' (anon test)' })
          .eq('id', testDept.id)
          .select();

        if (anonUpdateError) {
          console.log('❌ Anon UPDATE error:', anonUpdateError.message);
          console.log('   Code:', anonUpdateError.code);
          console.log('   Details:', anonUpdateError.details);
          console.log('   Hint:', anonUpdateError.hint);
        } else {
          console.log('✅ Anon UPDATE successful');

          // Revert the change
          await anonClient
            .from('departments')
            .update({ name: testDept.name })
            .eq('id', testDept.id);
        }
      }
    }
  } catch (error) {
    console.log('❌ Anon client unexpected error:', error.message);
  }

  console.log('\n2. Testing with SERVICE ROLE key...');
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Test SELECT
    const { data: serviceSelectData, error: serviceSelectError } = await serviceClient
      .from('departments')
      .select('*')
      .limit(1);

    if (serviceSelectError) {
      console.log('❌ Service SELECT error:', serviceSelectError.message);
    } else {
      console.log('✅ Service SELECT successful, found', serviceSelectData?.length || 0, 'departments');

      if (serviceSelectData && serviceSelectData.length > 0) {
        const testDept = serviceSelectData[0];

        // Test UPDATE with service key
        console.log('   Testing UPDATE with service key...');
        const { data: serviceUpdateData, error: serviceUpdateError } = await serviceClient
          .from('departments')
          .update({ name: testDept.name + ' (service test)' })
          .eq('id', testDept.id)
          .select();

        if (serviceUpdateError) {
          console.log('❌ Service UPDATE error:', serviceUpdateError.message);
          console.log('   Code:', serviceUpdateError.code);
          console.log('   Details:', serviceUpdateError.details);
        } else {
          console.log('✅ Service UPDATE successful');

          // Revert the change
          await serviceClient
            .from('departments')
            .update({ name: testDept.name })
            .eq('id', testDept.id);
        }
      }
    }
  } catch (error) {
    console.log('❌ Service client unexpected error:', error.message);
  }

  console.log('\n3. Testing authenticated user simulation...');

  // Test with anon key but with auth context
  try {
    // First get auth user info if available
    const { data: authData, error: authError } = await anonClient.auth.getUser();
    console.log('Current auth status:', authError ? 'No user' : 'User found');

    if (authError) {
      console.log('ℹ️  No authenticated user - this is likely the issue!');
      console.log('   Departments table probably requires authentication');
      console.log('   The 400 error is likely due to RLS policies requiring auth.uid()');
    }
  } catch (error) {
    console.log('❌ Auth check error:', error.message);
  }

  console.log('\n4. Checking if RLS is the issue...');
  try {
    // Check table permissions
    const { data: permissionData, error: permissionError } = await serviceClient.rpc('exec_raw_sql', {
      sql_query: `
        SELECT
          table_name,
          privilege_type,
          grantee,
          is_grantable
        FROM information_schema.table_privileges
        WHERE table_name = 'departments'
        ORDER BY grantee, privilege_type;
      `
    });

    console.log('Table permissions query result:', permissionData);
  } catch (error) {
    console.log('❌ Permission check error:', error.message);
  }
}

testDepartmentOperations().catch(console.error);