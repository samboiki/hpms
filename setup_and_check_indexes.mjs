import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🚀 Setting up and checking performance indexes...\n');

// Step 1: Create the RPC function (using supabase CLI or direct SQL)
console.log('📝 Step 1: Creating get_performance_indexes() RPC function...');
console.log('⚠️  Note: This requires service_role key or Supabase CLI\n');

// For now, let's try to call the function in case it already exists
console.log('🔍 Step 2: Attempting to query indexes...\n');

try {
  const { data, error } = await supabase.rpc('get_performance_indexes');

  if (error) {
    console.error('❌ Error calling get_performance_indexes():', error.message);
    console.log('\n⚠️  The RPC function does not exist yet.');
    console.log('\n📋 TO FIX THIS:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run the SQL from: create_get_indexes_function.sql');
    console.log('3. Or use Supabase CLI: npx supabase db execute --file create_get_indexes_function.sql');
    console.log('\nSQL file location: C:\\projects\\hpms\\create_get_indexes_function.sql\n');
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('⚠️  NO INDEXES FOUND matching the pattern idx_*');
    console.log('❌ This means the indexes were NOT created successfully!\n');

    console.log('📋 EXPECTED INDEXES (13 total):');
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
      console.log(`   ${i + 1}. ❌ ${name}`);
    });

    console.log('\n💡 All indexes are missing. They need to be recreated.\n');
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
  console.log('═'.repeat(80));

  Object.keys(byTable).sort().forEach(tablename => {
    const indexes = byTable[tablename];
    console.log(`\n📋 ${tablename.toUpperCase()} (${indexes.length} indexes):`);
    console.log('─'.repeat(80));
    indexes.forEach(idx => {
      console.log(`   ✓ ${idx.indexname}`);
      console.log(`     ${idx.indexdef}`);
      console.log('');
    });
  });

  console.log('═'.repeat(80));
  console.log('\n🎯 EXPECTED INDEXES (13 total):\n');

  const expectedIndexes = [
    { name: 'idx_users_practice_id', table: 'users', column: 'practice_id' },
    { name: 'idx_users_role', table: 'users', column: 'role' },
    { name: 'idx_users_email', table: 'users', column: 'email' },
    { name: 'idx_practices_status', table: 'practices', column: 'status' },
    { name: 'idx_practices_practice_type_id', table: 'practices', column: 'practice_type_id' },
    { name: 'idx_patients_practice_id', table: 'patients', column: 'practice_id' },
    { name: 'idx_visits_practice_id', table: 'visits', column: 'practice_id' },
    { name: 'idx_visits_patient_id', table: 'visits', column: 'patient_id' },
    { name: 'idx_visits_doctor_id', table: 'visits', column: 'doctor_id' },
    { name: 'idx_system_notifications_user_id', table: 'system_notifications', column: 'user_id' },
    { name: 'idx_internal_channel_members_user_id', table: 'internal_channel_members', column: 'user_id' },
    { name: 'idx_practice_sms_subscriptions_practice_id', table: 'practice_sms_subscriptions', column: 'practice_id' },
    { name: 'idx_practice_email_subscriptions_practice_id', table: 'practice_email_subscriptions', column: 'practice_id' }
  ];

  const foundIndexNames = data.map(idx => idx.indexname);
  const missingIndexes = expectedIndexes.filter(exp => !foundIndexNames.includes(exp.name));

  expectedIndexes.forEach((exp, i) => {
    const found = foundIndexNames.includes(exp.name);
    const status = found ? '✅' : '❌';
    console.log(`   ${i + 1}. ${status} ${exp.name}`);
    console.log(`      Table: ${exp.table}, Column: ${exp.column}`);
  });

  console.log('\n' + '═'.repeat(80));

  if (missingIndexes.length > 0) {
    console.log('\n⚠️  MISSING INDEXES:\n');
    missingIndexes.forEach(exp => {
      console.log(`   ❌ ${exp.name}`);
      console.log(`      Table: ${exp.table}, Column: ${exp.column}`);
    });
    console.log(`\n💡 ${missingIndexes.length} index(es) need to be created.`);
  } else {
    console.log('\n✅ ALL EXPECTED INDEXES ARE PRESENT!');
    console.log('🎉 Database is fully indexed for optimal performance!');
  }

  console.log(`\n📈 COVERAGE: ${foundIndexNames.length}/${expectedIndexes.length} indexes present`);
  console.log(`📊 COMPLETION: ${Math.round((foundIndexNames.length / expectedIndexes.length) * 100)}%\n`);

} catch (err) {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
}
