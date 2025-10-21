import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

console.log('🚀 Adding 13 Critical Performance Indexes...\n');

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
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_practice_role ON users(practice_id, role);'
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

// Execute each index via raw SQL using the REST API
for (let i = 0; i < indexes.length; i++) {
  const { name, table, sql } = indexes[i];

  console.log(`\n[${i + 1}/${indexes.length}] Creating ${name} on ${table}...`);

  try {
    // Use fetch to execute raw SQL via PostgREST
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      console.log(`   ✅ Created successfully!`);
      results.push({ name, table, status: 'created' });
      successCount++;
    } else {
      const error = await response.text();
      if (error.includes('already exists') || error.includes('IF NOT EXISTS')) {
        console.log(`   ⚠️  Already exists (skipped)`);
        results.push({ name, table, status: 'already_exists' });
        skipCount++;
      } else {
        console.error(`   ❌ Failed: ${error}`);
        results.push({ name, table, status: 'failed', error });
        failCount++;
      }
    }
  } catch (err) {
    console.error(`   ❌ Exception: ${err.message}`);
    results.push({ name, table, status: 'exception', error: err.message });
    failCount++;
  }

  // Add small delay between creates to avoid overwhelming the database
  await new Promise(resolve => setTimeout(resolve, 500));
}

console.log('\n' + '='.repeat(70));
console.log('📊 EXECUTION SUMMARY');
console.log('='.repeat(70));
console.log(`Total Indexes: ${indexes.length}`);
console.log(`✅ Created: ${successCount}`);
console.log(`⚠️  Already Existed: ${skipCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log('='.repeat(70) + '\n');

// Verify using simple query
console.log('🔍 Verifying indexes via Supabase query...\n');

try {
  // Query pg_indexes view to verify
  const { data, error } = await supabase
    .from('pg_indexes')
    .select('tablename, indexname')
    .eq('schemaname', 'public')
    .like('indexname', 'idx_%')
    .order('tablename')
    .order('indexname');

  if (error) {
    console.error('⚠️  Could not verify via pg_indexes:', error.message);
  } else if (data && data.length > 0) {
    console.log('📋 VERIFIED INDEXES:\n');

    // Group by table
    const byTable = {};
    data.forEach(row => {
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

    console.log(`\n📊 Total indexes verified: ${data.length}`);
  } else {
    console.log('⚠️  No indexes found');
  }
} catch (err) {
  console.error('⚠️  Verification error:', err.message);
}

console.log('\n✅ Index creation process completed!\n');
