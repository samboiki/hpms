import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
// Using the anon key instead
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDYwODMsImV4cCI6MjA0OTkyMjA4M30.pCULAI_iniAGyP6dM8Sx57MIL7IUbhLqZfFPL8H0J7Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Checking for performance indexes in the database...\n');

try {
  // Try to query pg_indexes directly
  const { data, error } = await supabase
    .from('pg_indexes')
    .select('schemaname, tablename, indexname, indexdef')
    .in('tablename', ['users', 'practices', 'patients', 'visits', 'system_notifications', 'internal_channel_members', 'practice_sms_subscriptions', 'practice_email_subscriptions'])
    .like('indexname', 'idx_%')
    .order('tablename')
    .order('indexname');

  if (error) {
    console.error('❌ Error querying pg_indexes:', error);
    console.log('\n⚠️  Note: pg_indexes is a system view and may not be directly accessible.');
    console.log('We need to use a different approach or create an RPC function.\n');
    process.exit(1);
  }

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

} catch (err) {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
}
