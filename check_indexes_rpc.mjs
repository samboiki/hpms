import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Checking for performance indexes in the database...\n');

// First, let's try to see if we can query information_schema
const sql = `
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'practices', 'patients', 'visits', 'system_notifications', 'internal_channel_members', 'practice_sms_subscriptions', 'practice_email_subscriptions')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
`;

console.log('Attempting to query pg_indexes via RPC...\n');

// Try using exec_sql RPC if it exists
let result = await supabase.rpc('exec_sql', { sql_query: sql });

if (result.error) {
  console.log('⚠️  exec_sql RPC not available or error:', result.error.message);
  console.log('\nTrying alternative approach using get_indexes RPC...\n');

  // Try alternative RPC
  result = await supabase.rpc('get_indexes');

  if (result.error) {
    console.log('⚠️  get_indexes RPC also not available:', result.error.message);
    console.log('\n📝 We need to create an RPC function to query system tables.');
    console.log('\nHere\'s what we need to do:');
    console.log('1. Create an RPC function that can query pg_indexes');
    console.log('2. Grant proper permissions to execute it');
    console.log('\nWould you like me to create this RPC function?');
    process.exit(1);
  }
}

const data = result.data;

if (!data || data.length === 0) {
  console.log('⚠️  NO INDEXES FOUND matching the pattern idx_*');
  console.log('This means the indexes were NOT created successfully!\n');
  process.exit(0);
}

console.log(`✅ Found ${data.length} indexes\n`);

// Group by table
const byTable = {};
data.forEach(row => {
  if (!byTable[row.tablename]) {
    byTable[row.tablename] = [];
  }
  byTable[row.tablename].push(row);
});

// Display results
console.log('📊 INDEX SUMMARY BY TABLE:\n');
Object.keys(byTable).sort().forEach(tablename => {
  const indexes = byTable[tablename];
  console.log(`\n📋 ${tablename.toUpperCase()} (${indexes.length} indexes):`);
  indexes.forEach(idx => {
    console.log(`   ✓ ${idx.indexname}`);
    console.log(`     ${idx.indexdef}`);
  });
});

console.log('\n\n🎯 EXPECTED INDEXES (13 total):');
const expectedIndexes = [
  'idx_users_practice_id',
  'idx_users_role',
  'idx_users_email',
  'idx_practices_status',
  'idx_practices_practice_type_id',
  'idx_patients_practice_id',
  'idx_visits_practice_id',
  'idx_visits_patient_id',
  'idx_visits_doctor_id',
  'idx_system_notifications_user_id',
  'idx_internal_channel_members_user_id',
  'idx_practice_sms_subscriptions_practice_id',
  'idx_practice_email_subscriptions_practice_id'
];

expectedIndexes.forEach((name, i) => {
  console.log(`   ${i + 1}. ${name}`);
});

const foundIndexNames = data.map(idx => idx.indexname);
const missingIndexes = expectedIndexes.filter(name => !foundIndexNames.includes(name));

if (missingIndexes.length > 0) {
  console.log('\n\n⚠️  MISSING INDEXES:');
  missingIndexes.forEach(name => {
    console.log(`   ❌ ${name}`);
  });
} else {
  console.log('\n\n✅ ALL EXPECTED INDEXES ARE PRESENT!');
}

console.log(`\n\n📈 COVERAGE: ${foundIndexNames.length}/${expectedIndexes.length} indexes present`);
