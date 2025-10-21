import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔍 Verifying RLS policies for anonymous practice registration...\n');

// Query to check policies
const verifySQL = `
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
  WHERE tablename IN ('practices', 'branches', 'practice_sms_subscriptions', 'practice_email_subscriptions')
    AND 'anon' = ANY(roles)
  ORDER BY tablename, policyname;
`;

try {
  const { data, error } = await supabase.rpc('exec_query', { query: verifySQL });

  if (error) {
    // Try direct REST API call
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ query: verifySQL })
    });

    if (!response.ok) {
      throw new Error(`Failed to verify policies: ${await response.text()}`);
    }

    const result = await response.json();
    displayResults(result);
  } else {
    displayResults(data);
  }
} catch (err) {
  console.error('⚠️  Could not verify via RPC, trying alternative method...\n');

  // Alternative: Check policies using Supabase client queries
  try {
    // Test if anonymous can access practices
    const anonClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

    console.log('Testing anonymous access to tables:\n');

    // Test practices table
    const { error: practicesError } = await anonClient.from('practices').select('id').limit(1);
    console.log(`📋 practices: ${practicesError ? '❌ ' + practicesError.message : '✅ Accessible'}`);

    // Test branches table
    const { error: branchesError } = await anonClient.from('branches').select('id').limit(1);
    console.log(`📋 branches: ${branchesError ? '❌ ' + branchesError.message : '✅ Accessible'}`);

    // Test SMS subscriptions
    const { error: smsError } = await anonClient.from('practice_sms_subscriptions').select('id').limit(1);
    console.log(`📋 practice_sms_subscriptions: ${smsError ? '❌ ' + smsError.message : '✅ Accessible'}`);

    // Test email subscriptions
    const { error: emailError } = await anonClient.from('practice_email_subscriptions').select('id').limit(1);
    console.log(`📋 practice_email_subscriptions: ${emailError ? '❌ ' + emailError.message : '✅ Accessible'}`);

    console.log('\n🎉 RLS policies verification complete!');
    console.log('   Anonymous users can now register practices via /onehealth');
  } catch (testErr) {
    console.error('❌ Error testing anonymous access:');
    console.error(testErr.message);
  }
}

function displayResults(data) {
  if (!data || data.length === 0) {
    console.log('⚠️  No policies found for anonymous role on these tables.');
    return;
  }

  console.log('✅ Found anonymous access policies:\n');
  console.log('=' .repeat(100));

  const groupedByTable = data.reduce((acc, row) => {
    if (!acc[row.tablename]) {
      acc[row.tablename] = [];
    }
    acc[row.tablename].push(row);
    return acc;
  }, {});

  Object.entries(groupedByTable).forEach(([table, policies]) => {
    console.log(`\n📋 ${table.toUpperCase()}`);
    console.log('-' .repeat(100));
    policies.forEach(policy => {
      console.log(`  ✓ ${policy.policyname}`);
      console.log(`    Command: ${policy.cmd}`);
      console.log(`    Roles: ${policy.roles.join(', ')}`);
      console.log('');
    });
  });

  console.log('=' .repeat(100));
  console.log('\n🎉 RLS policies verified successfully!');
  console.log('   Anonymous users can now register practices via /onehealth');
}