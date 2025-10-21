import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('🔍 Checking RLS policies on practices table...\n');

  // Check if RLS is enabled
  const { data: rlsStatus, error: rlsError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        schemaname,
        tablename,
        rowsecurity as rls_enabled,
        forcerowsecurity as rls_forced
      FROM pg_tables
      WHERE tablename = 'practices' AND schemaname = 'public';
    `
  });

  if (rlsError) {
    console.error('❌ Error checking RLS status:', rlsError);
  } else {
    console.log('📊 RLS Status:');
    console.log(JSON.stringify(rlsStatus, null, 2));
  }

  // Check existing policies
  const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
    sql: `
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
      WHERE tablename = 'practices';
    `
  });

  if (policiesError) {
    console.error('❌ Error checking policies:', policiesError);
  } else {
    console.log('\n📋 Existing RLS Policies:');
    if (policies && policies.length > 0) {
      console.log(JSON.stringify(policies, null, 2));
    } else {
      console.log('⚠️  No RLS policies found on practices table');
    }
  }

  // Try to insert a test practice to see the actual error
  console.log('\n🧪 Testing practice insertion...');
  const { data: insertData, error: insertError } = await supabase
    .from('practices')
    .insert({
      slug: 'test-practice-' + Date.now(),
      name: 'Test Practice',
      contact_email: 'test@test.com'
    })
    .select();

  if (insertError) {
    console.error('❌ Insert error:', insertError);
  } else {
    console.log('✅ Insert successful:', insertData);

    // Clean up test data
    if (insertData && insertData[0]) {
      await supabase.from('practices').delete().eq('id', insertData[0].id);
      console.log('🧹 Test data cleaned up');
    }
  }
}

checkRLS().catch(console.error);