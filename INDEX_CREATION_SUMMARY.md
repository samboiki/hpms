.repeat(70) + '\n');

// List of all indexes to create (removed CONCURRENTLY since it requires direct DB access)
const indexStatements = [
  // USERS TABLE (3 indexes)
  { name: 'idx_users_practice_id', table: 'users', sql: 'CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id)' },
  { name: 'idx_users_email', table: 'users', sql: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)' },
  { name: 'idx_users_practice_role', table: 'users', sql: 'CREATE INDEX IF NOT EXISTS idx_users_practice_role ON users(practice_id, role)' },

  // PRACTICES TABLE (1 index)
  { name: 'idx_practices_status', table: 'practices', sql: 'CREATE INDEX IF NOT EXISTS idx_practices_status ON practices(status)' },

  // PATIENTS TABLE (2 indexes)
  { name: 'idx_patients_practice_id', table: 'patients', sql: 'CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON patients(practice_id)' },
  { name: 'idx_patients_practice_created', table: 'patients', sql: 'CREATE INDEX IF NOT EXISTS idx_patients_practice_created ON patients(practice_id, created_at DESC)' },

  // VISITS TABLE (3 indexes) - MOST CRITICAL
  { name: 'idx_visits_practice_id', table: 'visits', sql: 'CREATE INDEX IF NOT EXISTS idx_visits_practice_id ON visits(practice_id)' },
  { name: 'idx_visits_practice_scheduled', table: 'visits', sql: 'CREATE INDEX IF NOT EXISTS idx_visits_practice_scheduled ON visits(practice_id, scheduled_date)' },
  { name: 'idx_visits_patient_scheduled', table: 'visits', sql: 'CREATE INDEX IF NOT EXISTS idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC)' },

  // NOTIFICATIONS TABLE (1 index)
  { name: 'idx_notif_user_practice_created', table: 'system_notifications', sql: 'CREATE INDEX IF NOT EXISTS idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC)' },

  // CHANNEL MEMBERS TABLE (1 index)
  { name: 'idx_channel_members_user_practice', table: 'internal_channel_members', sql: 'CREATE INDEX IF NOT EXISTS idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id)' },

  // COMMUNICATION SUBSCRIPTIONS (2 indexes)
  { name: 'idx_sms_sub_practice_status', table: 'practice_sms_subscriptions', sql: 'CREATE INDEX IF NOT EXISTS idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status)' },
  { name: 'idx_email_sub_practice_status', table: 'practice_email_subscriptions', sql: 'CREATE INDEX IF NOT EXISTS idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status)' }
];

let successCount = 0;
let skipCount = 0;
let failCount = 0;

console.log(`📋 Total indexes to create: ${indexStatements.length}\n`);

for (let i = 0; i < indexStatements.length; i++) {
  const { name, table, sql } = indexStatements[i];

  console.log(`[${i + 1}/${indexStatements.length}] Creating ${name} on ${table}...`);

  try {
    // Execute raw SQL - this uses Supabase's SQL execution endpoint
    const { data, error } = await supabase.rpc('exec', {
      sql: sql
    }).single();

    if (error) {
      // Check if it's just because index already exists
      if (error.message && (error.message.includes('already exists') || error.code === '42P07')) {
        console.log(`   ⚠️  Already exists (skipped)`);
        skipCount++;
      } else {
        console.error(`   ❌ Failed: ${error.message || JSON.stringify(error)}`);
        failCount++;
      }
    } else {
      console.log(`   ✅ Created successfully!`);
      successCount++;
    }
  } catch (err) {
    console.error(`   ❌ Exception: ${err.message}`);
    failCount++;
  }

  // Small delay between operations
  await new Promise(resolve => setTimeout(resolve, 200));
}

console.log('\n' + '='.repeat(70));
console.log('📊 EXECUTION SUMMARY');
console.log('='.repeat(70));
console.log(`Total Indexes: ${indexStatements.length}`);
console.log(`✅ Created: ${successCount}`);
console.log(`⚠️  Already Existed: ${skipCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log('='.repeat(70));

// Verify indexes
console.log('\n🔍 Verifying indexes...\n');

const { data: indexes, error: verifyError } = await supabase
  .from('pg_indexes')
  .select('tablename, indexname')
  .eq('schemaname', 'public')
  .like('indexname', 'idx_%')
  .order('tablename')
  .order('indexname');

if (verifyError) {
  console.error('⚠️  Verification failed:', verifyError.message);
} else if (indexes && indexes.length > 0) {
  console.log('📋 VERIFIED INDEXES:\n');

  const byTable = {};
  indexes.forEach(row => {
    if (!byTable[row.tablename]) byTable[row.tablename] = [];
    byTable[row.tablename].push(row.indexname);
  });

  Object.keys(byTable).sort().forEach(tableName => {
    console.log(`\n📁 ${tableName.toUpperCase()}:`);
    byTable[tableName].forEach(indexName => {
      console.log(`   ✓ ${indexName}`);
    });
  });

  console.log(`\n📊 Total indexes found: ${indexes.length}`);
} else {
  console.log('⚠️  No indexes found');
}

console.log('\n✅ Process completed!\n');
