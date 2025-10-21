import pg from 'pg';
const { Client } = pg;

// Direct PostgreSQL connection
const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.jjxlfunlbyayxwvlpgwt',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

console.log('🚀 Adding 13 Critical Performance Indexes...\n');
console.log('📡 Connecting to database...');

try {
  await client.connect();
  console.log('✅ Connected successfully!\n');

  const indexes = [
    // USERS TABLE (3 indexes)
    {
      name: 'idx_users_practice_id',
      table: 'users',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_practice_id ON users(practice_id);'
    },
    {
      name: 'idx_users_email',
      table: 'users',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);'
    },
    {
      name: 'idx_users_practice_role',
      table: 'users',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_practice_id_role ON users(practice_id, role);'
    },

    // PRACTICES TABLE (1 index)
    {
      name: 'idx_practices_status',
      table: 'practices',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practices_status ON practices(status);'
    },

    // PATIENTS TABLE (2 indexes)
    {
      name: 'idx_patients_practice_id',
      table: 'patients',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_practice_id ON patients(practice_id);'
    },
    {
      name: 'idx_patients_practice_created',
      table: 'patients',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_practice_created ON patients(practice_id, created_at DESC);'
    },

    // VISITS TABLE (3 indexes) - MOST CRITICAL
    {
      name: 'idx_visits_practice_id',
      table: 'visits',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_practice_id ON visits(practice_id);'
    },
    {
      name: 'idx_visits_practice_scheduled',
      table: 'visits',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_practice_scheduled ON visits(practice_id, scheduled_date);'
    },
    {
      name: 'idx_visits_patient_scheduled',
      table: 'visits',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC);'
    },

    // NOTIFICATIONS TABLE (1 index)
    {
      name: 'idx_notif_user_practice_created',
      table: 'system_notifications',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC);'
    },

    // CHANNEL MEMBERS TABLE (1 index)
    {
      name: 'idx_channel_members_user_practice',
      table: 'internal_channel_members',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id);'
    },

    // COMMUNICATION SUBSCRIPTIONS (2 indexes)
    {
      name: 'idx_sms_sub_practice_status',
      table: 'practice_sms_subscriptions',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status);'
    },
    {
      name: 'idx_email_sub_practice_status',
      table: 'practice_email_subscriptions',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status);'
    }
  ];

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const results = [];

  for (let i = 0; i < indexes.length; i++) {
    const { name, table, sql } = indexes[i];

    console.log(`\n[${i + 1}/${indexes.length}] Creating ${name} on ${table}...`);

    try {
      await client.query(sql);
      console.log(`   ✅ Created successfully!`);
      results.push({ name, table, status: 'created' });
      successCount++;
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log(`   ⚠️  Already exists (skipped)`);
        results.push({ name, table, status: 'already_exists' });
        skipCount++;
      } else {
        console.error(`   ❌ Failed: ${err.message}`);
        results.push({ name, table, status: 'failed', error: err.message });
        failCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 EXECUTION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Indexes: ${indexes.length}`);
  console.log(`✅ Created: ${successCount}`);
  console.log(`⚠️  Already Existed: ${skipCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('='.repeat(70) + '\n');

  // Verify indexes
  console.log('🔍 Verifying all indexes...\n');

  const verifySQL = `
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname;
  `;

  const verifyResult = await client.query(verifySQL);

  if (verifyResult.rows.length > 0) {
    console.log('📋 VERIFIED INDEXES:\n');

    // Group by table
    const byTable = {};
    verifyResult.rows.forEach(row => {
      if (!byTable[row.tablename]) {
        byTable[row.tablename] = [];
      }
      byTable[row.tablename].push(row.indexname);
    });

    Object.keys(byTable).sort().forEach(table => {
      console.log(`\n📁 ${table.toUpperCase()}:`);
      byTable[table].forEach(index => {
        const isNew = results.find(r => r.name === index && r.status === 'created');
        const marker = isNew ? '🆕' : '✓';
        console.log(`   ${marker} ${index}`);
      });
    });

    console.log(`\n📊 Total indexes verified: ${verifyResult.rows.length}`);
  } else {
    console.log('⚠️  No indexes found');
  }

} catch (err) {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
} finally {
  await client.end();
  console.log('\n✅ Index creation process completed!');
  console.log('🔌 Database connection closed.\n');
}
