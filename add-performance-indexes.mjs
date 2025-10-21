import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🚀 Adding 13 Critical Performance Indexes...\n');

const indexSQL = `
-- CRITICAL PERFORMANCE INDEXES
-- These indexes will dramatically improve query performance by supporting RLS policy filtering

-- USERS TABLE (3 indexes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_practice_id ON users(practice_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_practice_role ON users(practice_id, role);

-- PRACTICES TABLE (1 index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practices_status ON practices(status);

-- PATIENTS TABLE (2 indexes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_practice_id ON patients(practice_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_practice_created ON patients(practice_id, created_at DESC);

-- VISITS TABLE (3 indexes) - MOST CRITICAL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_practice_id ON visits(practice_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_practice_scheduled ON visits(practice_id, scheduled_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC);

-- NOTIFICATIONS TABLE (1 index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC);

-- CHANNEL MEMBERS TABLE (1 index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id);

-- COMMUNICATION SUBSCRIPTIONS (2 indexes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status);
`;

// Split into individual CREATE INDEX statements
const statements = indexSQL
  .split('\n')
  .filter(line => line.trim().startsWith('CREATE INDEX'))
  .map(line => line.trim());

console.log(`📋 Found ${statements.length} index creation statements\n`);

// Execute each index creation individually
let successCount = 0;
let failCount = 0;
const results = [];

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i];
  const indexName = statement.match(/idx_[\w_]+/)?.[0] || `index_${i + 1}`;

  console.log(`\n[${i + 1}/${statements.length}] Creating ${indexName}...`);

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: statement
    });

    if (error) {
      // Check if error is just "index already exists"
      if (error.message?.includes('already exists')) {
        console.log(`   ⚠️  Already exists: ${indexName}`);
        results.push({ index: indexName, status: 'already_exists' });
        successCount++;
      } else {
        console.error(`   ❌ Failed: ${error.message}`);
        results.push({ index: indexName, status: 'failed', error: error.message });
        failCount++;
      }
    } else {
      console.log(`   ✅ Created: ${indexName}`);
      results.push({ index: indexName, status: 'created' });
      successCount++;
    }
  } catch (err) {
    console.error(`   ❌ Exception: ${err.message}`);
    results.push({ index: indexName, status: 'exception', error: err.message });
    failCount++;
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 EXECUTION SUMMARY');
console.log('='.repeat(60));
console.log(`Total Statements: ${statements.length}`);
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log('='.repeat(60) + '\n');

// Now verify indexes were created
console.log('🔍 Verifying indexes...\n');

const verifySQL = `
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
`;

try {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: verifySQL
  });

  if (error) {
    console.error('❌ Verification query failed:', error.message);
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
      console.log(`\n${table}:`);
      byTable[table].forEach(index => {
        console.log(`   ✓ ${index}`);
      });
    });

    console.log(`\n📊 Total indexes found: ${data.length}`);
  } else {
    console.log('⚠️  No indexes found (verification query returned empty)');
  }
} catch (err) {
  console.error('❌ Verification exception:', err.message);
}

console.log('\n✅ Index creation process completed!');
