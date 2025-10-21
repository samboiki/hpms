import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   Please set it in your environment or .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

console.log('🚀 Creating 13 Critical Performance Indexes');
console.log('='.repeat(70) + '\n');

// All 13 indexes in a single SQL statement
const allIndexesSQL = `
-- USERS TABLE (3 indexes)
CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_practice_role ON users(practice_id, role);

-- PRACTICES TABLE (1 index)
CREATE INDEX IF NOT EXISTS idx_practices_status ON practices(status);

-- PATIENTS TABLE (2 indexes)
CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON patients(practice_id);
CREATE INDEX IF NOT EXISTS idx_patients_practice_created ON patients(practice_id, created_at DESC);

-- VISITS TABLE (3 indexes) - MOST CRITICAL
CREATE INDEX IF NOT EXISTS idx_visits_practice_id ON visits(practice_id);
CREATE INDEX IF NOT EXISTS idx_visits_practice_scheduled ON visits(practice_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC);

-- NOTIFICATIONS TABLE (1 index)
CREATE INDEX IF NOT EXISTS idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC);

-- CHANNEL MEMBERS TABLE (1 index)
CREATE INDEX IF NOT EXISTS idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id);

-- COMMUNICATION SUBSCRIPTIONS (2 indexes)
CREATE INDEX IF NOT EXISTS idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status);
CREATE INDEX IF NOT EXISTS idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status);
`;

console.log('📝 Executing all 13 CREATE INDEX statements...\n');

// Try using the supabase REST API directly
const executeSQL = async (sql) => {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        query: sql
      })
    });

    if (response.ok) {
      return { success: true };
    } else {
      const text = await response.text();
      return { success: false, error: text };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const result = await executeSQL(allIndexesSQL);

if (result.success) {
  console.log('✅ All indexes created successfully!\n');
} else {
  console.error('❌ Execution failed:', result.error);
  console.log('\n⚠️  Attempting individual index creation...\n');

  // Try each index individually
  const indexes = [
    { name: 'idx_users_practice_id', sql: 'CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id)' },
    { name: 'idx_users_email', sql: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)' },
    { name: 'idx_users_practice_role', sql: 'CREATE INDEX IF NOT EXISTS idx_users_practice_role ON users(practice_id, role)' },
    { name: 'idx_practices_status', sql: 'CREATE INDEX IF NOT EXISTS idx_practices_status ON practices(status)' },
    { name: 'idx_patients_practice_id', sql: 'CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON patients(practice_id)' },
    { name: 'idx_patients_practice_created', sql: 'CREATE INDEX IF NOT EXISTS idx_patients_practice_created ON patients(practice_id, created_at DESC)' },
    { name: 'idx_visits_practice_id', sql: 'CREATE INDEX IF NOT EXISTS idx_visits_practice_id ON visits(practice_id)' },
    { name: 'idx_visits_practice_scheduled', sql: 'CREATE INDEX IF NOT EXISTS idx_visits_practice_scheduled ON visits(practice_id, scheduled_date)' },
    { name: 'idx_visits_patient_scheduled', sql: 'CREATE INDEX IF NOT EXISTS idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC)' },
    { name: 'idx_notif_user_practice_created', sql: 'CREATE INDEX IF NOT EXISTS idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC)' },
    { name: 'idx_channel_members_user_practice', sql: 'CREATE INDEX IF NOT EXISTS idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id)' },
    { name: 'idx_sms_sub_practice_status', sql: 'CREATE INDEX IF NOT EXISTS idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status)' },
    { name: 'idx_email_sub_practice_status', sql: 'CREATE INDEX IF NOT EXISTS idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status)' }
  ];

  for (const { name, sql } of indexes) {
    console.log(`Creating ${name}...`);
    const res = await executeSQL(sql);
    if (res.success) {
      console.log(`   ✅ Success`);
    } else {
      console.log(`   ❌ Failed: ${res.error}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

// Verify
console.log('\n🔍 Verifying indexes...\n');

try {
  const { data, error } = await supabase
    .from('pg_indexes')
    .select('tablename, indexname')
    .eq('schemaname', 'public')
    .like('indexname', 'idx_%')
    .order('tablename')
    .order('indexname');

  if (error) {
    console.error('⚠️  Verification query failed:', error.message);
  } else if (data && data.length > 0) {
    console.log('📋 VERIFIED INDEXES:\n');

    const byTable = {};
    data.forEach(row => {
      if (!byTable[row.tablename]) byTable[row.tablename] = [];
      byTable[row.tablename].push(row.indexname);
    });

    Object.keys(byTable).sort().forEach(tableName => {
      console.log(`\n📁 ${tableName.toUpperCase()}:`);
      byTable[tableName].forEach(indexName => {
        console.log(`   ✓ ${indexName}`);
      });
    });

    console.log(`\n📊 Total indexes found: ${data.length}`);
  } else {
    console.log('⚠️  No indexes found');
  }
} catch (err) {
  console.error('⚠️  Verification error:', err.message);
}

console.log('\n✅ Process completed!\n');
