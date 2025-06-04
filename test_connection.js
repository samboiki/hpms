import { createClient } from '@supabase/supabase-js';

// Test with different approaches
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';

// Try different keys (you may need to update these)
const TEST_KEYS = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjM0MTU5NCwiZXhwIjoyMDUxOTE3NTk0fQ.w6_P8Ncw4gJUY01NKnfTr3oNdM8mPvmN2RUzgxeK3fI', // service_role
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNDE1OTQsImV4cCI6MjA1MTkxNzU5NH0.yBSN8hj1LgJrvOz6E1pU_1kHyLO9HZhXFV7WRZgYAIY' // anon
];

async function testConnection(keyIndex, key) {
  console.log(`\n🧪 Testing connection ${keyIndex + 1}/2...`);
  
  const client = createClient(SUPABASE_URL, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Try a simple query
    const { data, error } = await client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);
    
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Connection successful! Found ${data?.length || 0} tables`);
    if (data && data.length > 0) {
      console.log('   Sample tables:', data.map(t => t.table_name).join(', '));
    }
    return true;
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
    return false;
  }
}

async function testAuth() {
  console.log('\n🔐 Testing auth access...');
  
  const client = createClient(SUPABASE_URL, TEST_KEYS[0], { // service role
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    const { data, error } = await client.auth.admin.listUsers();
    if (error) {
      console.log(`❌ Auth error: ${error.message}`);
    } else {
      console.log(`✅ Auth access successful! Found ${data.users?.length || 0} users`);
    }
  } catch (err) {
    console.log(`❌ Auth exception: ${err.message}`);
  }
}

async function main() {
  console.log('🚀 Supabase Connection Test\n');
  console.log(`🔗 Database: ${SUPABASE_URL}`);
  
  let workingKeyIndex = -1;
  
  for (let i = 0; i < TEST_KEYS.length; i++) {
    const success = await testConnection(i, TEST_KEYS[i]);
    if (success) {
      workingKeyIndex = i;
      break;
    }
  }
  
  if (workingKeyIndex === -1) {
    console.log('\n❌ No working connection found. Please check:');
    console.log('   1. Supabase URL is correct');
    console.log('   2. API keys are valid and not expired');
    console.log('   3. Database is accessible');
    console.log('   4. Network connectivity');
    return;
  }
  
  console.log(`\n✅ Using key ${workingKeyIndex + 1} for further operations`);
  
  await testAuth();
  
  console.log('\n📋 Next steps:');
  console.log('   1. Use the working key in your migration script');
  console.log('   2. Run the database verification');
  console.log('   3. Execute migrations if needed');
}

main().catch(console.error);