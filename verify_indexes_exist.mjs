import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM0NjA4MywiZXhwIjoyMDQ5OTIyMDgzfQ.qдок-zEbhcluj3pVBhXsD_QO8ws1v5wmA-Ge1Y2nvhE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('users', 'practices', 'patients', 'visits', 'system_notifications', 'internal_channel_members', 'practice_sms_subscriptions', 'practice_email_subscriptions')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
`;

console.log('🔍 Checking for performance indexes in the database...\n');

const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

if (error) {
  console.error('❌ Error executing query:', error);
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
console.log('   1. idx_users_practice_id');
console.log('   2. idx_users_role');
console.log('   3. idx_users_email');
console.log('   4. idx_practices_status');
console.log('   5. idx_practices_practice_type_id');
console.log('   6. idx_patients_practice_id');
console.log('   7. idx_visits_practice_id');
console.log('   8. idx_visits_patient_id');
console.log('   9. idx_visits_doctor_id');
console.log('   10. idx_system_notifications_user_id');
console.log('   11. idx_internal_channel_members_user_id');
console.log('   12. idx_practice_sms_subscriptions_practice_id');
console.log('   13. idx_practice_email_subscriptions_practice_id');

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
