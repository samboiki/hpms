import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Client } = pg;

// Use PostgreSQL connection string
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.jjxlfunlbyayxwvlpgwt:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

const tables = [
  'users',
  'practices',
  'patients',
  'visits',
  'system_notifications',
  'internal_channel_members',
  'practice_sms_subscriptions',
  'practice_email_subscriptions'
];

console.log('=== DATABASE PERFORMANCE ANALYSIS ===\n');
console.log('Connecting to database...\n');

const client = new Client({ connectionString });

try {
  await client.connect();

  for (const table of tables) {
    console.log(`\n📊 TABLE: ${table}`);
    console.log('─'.repeat(80));

    // Get indexes
    try {
      const idxResult = await client.query(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = $1
        ORDER BY indexname;
      `, [table]);

      console.log(`\nCurrent Indexes (${idxResult.rows.length}):`);
      if (idxResult.rows.length > 0) {
        idxResult.rows.forEach(idx => {
          console.log(`  • ${idx.indexname}`);
          console.log(`    ${idx.indexdef}`);
        });
      } else {
        console.log('  (No indexes found)');
      }
    } catch (err) {
      console.log('Error fetching indexes:', err.message);
    }

    // Get RLS policies
    try {
      const polResult = await client.query(`
        SELECT
          policyname,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = $1
        ORDER BY policyname;
      `, [table]);

      console.log(`\nRLS Policies (${polResult.rows.length}):`);
      if (polResult.rows.length > 0) {
        polResult.rows.forEach(pol => {
          console.log(`  • ${pol.policyname} (${pol.cmd})`);
          console.log(`    USING: ${pol.qual}`);
          if (pol.with_check) console.log(`    WITH CHECK: ${pol.with_check}`);
        });
      } else {
        console.log('  (No RLS policies found)');
      }
    } catch (err) {
      console.log('Error fetching policies:', err.message);
    }

    // Get table statistics
    try {
      const statResult = await client.query(`
        SELECT
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        AND relname = $1;
      `, [table]);

      if (statResult.rows.length > 0) {
        const stat = statResult.rows[0];
        console.log(`\nTable Statistics:`);
        console.log(`  Live Rows: ${stat.live_rows ? stat.live_rows.toLocaleString() : 0}`);
        console.log(`  Dead Rows: ${stat.dead_rows ? stat.dead_rows.toLocaleString() : 0}`);
        console.log(`  Last Analyze: ${stat.last_autoanalyze || stat.last_analyze || 'Never'}`);
      }
    } catch (err) {
      console.log('Error fetching stats:', err.message);
    }

    // Get column information
    try {
      const colResult = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      if (colResult.rows.length > 0) {
        console.log(`\nKey Columns:`);
        colResult.rows.forEach(col => {
          console.log(`  • ${col.column_name} (${col.data_type})`);
        });
      }
    } catch (err) {
      console.log('Error fetching columns:', err.message);
    }
  }

  // Check RPC functions
  console.log('\n\n📡 RPC FUNCTIONS ANALYSIS');
  console.log('─'.repeat(80));

  try {
    const funcResult = await client.query(`
      SELECT
        proname,
        prosrc
      FROM pg_proc
      WHERE proname IN ('get_dashboard_stats', 'get_channel_last_messages')
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    `);

    if (funcResult.rows.length > 0) {
      funcResult.rows.forEach(func => {
        console.log(`\n🔧 Function: ${func.proname}`);
        console.log('─'.repeat(80));
        console.log('Source:');
        console.log(func.prosrc);
      });
    } else {
      console.log('No RPC functions found with those names');
    }
  } catch (err) {
    console.log('Error fetching functions:', err.message);
  }

  // Get slow query insights
  console.log('\n\n⚡ PERFORMANCE INSIGHTS');
  console.log('─'.repeat(80));

  try {
    const scanResult = await client.query(`
      SELECT
        schemaname,
        relname as table_name,
        seq_scan as sequential_scans,
        seq_tup_read as rows_read_sequentially,
        idx_scan as index_scans,
        idx_tup_fetch as rows_fetched_by_index,
        CASE
          WHEN seq_scan > 0 THEN ROUND((seq_tup_read::numeric / seq_scan), 2)
          ELSE 0
        END as avg_rows_per_seq_scan
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      AND relname IN ('users', 'practices', 'patients', 'visits', 'system_notifications', 'internal_channel_members', 'practice_sms_subscriptions', 'practice_email_subscriptions')
      ORDER BY seq_scan DESC;
    `);

    if (scanResult.rows.length > 0) {
      console.log('\nSequential Scans vs Index Scans:');
      scanResult.rows.forEach(scan => {
        console.log(`\n  ${scan.table_name}:`);
        console.log(`    Sequential Scans: ${scan.sequential_scans ? scan.sequential_scans.toLocaleString() : 0}`);
        console.log(`    Index Scans: ${scan.index_scans ? scan.index_scans.toLocaleString() : 0}`);
        console.log(`    Avg Rows/Seq Scan: ${scan.avg_rows_per_seq_scan || 0}`);

        if (scan.sequential_scans > scan.index_scans * 2 && scan.sequential_scans > 100) {
          console.log(`    ⚠️  WARNING: High sequential scan ratio - needs indexes!`);
        }
      });
    }
  } catch (err) {
    console.log('Error fetching performance insights:', err.message);
  }

  // Get missing index suggestions
  console.log('\n\n💡 INDEX RECOMMENDATIONS');
  console.log('─'.repeat(80));

  // Common query patterns that need indexes
  const recommendations = {
    users: [
      'CREATE INDEX CONCURRENTLY idx_users_practice_id ON users(practice_id);',
      'CREATE INDEX CONCURRENTLY idx_users_email ON users(email);',
      'CREATE INDEX CONCURRENTLY idx_users_role ON users(role);',
      'CREATE INDEX CONCURRENTLY idx_users_practice_role ON users(practice_id, role);'
    ],
    practices: [
      'CREATE INDEX CONCURRENTLY idx_practices_status ON practices(status);',
      'CREATE INDEX CONCURRENTLY idx_practices_created_at ON practices(created_at DESC);'
    ],
    patients: [
      'CREATE INDEX CONCURRENTLY idx_patients_practice_id ON patients(practice_id);',
      'CREATE INDEX CONCURRENTLY idx_patients_email ON patients(email);',
      'CREATE INDEX CONCURRENTLY idx_patients_phone ON patients(phone_number);',
      'CREATE INDEX CONCURRENTLY idx_patients_practice_created ON patients(practice_id, created_at DESC);'
    ],
    visits: [
      'CREATE INDEX CONCURRENTLY idx_visits_practice_id ON visits(practice_id);',
      'CREATE INDEX CONCURRENTLY idx_visits_patient_id ON visits(patient_id);',
      'CREATE INDEX CONCURRENTLY idx_visits_scheduled_date ON visits(scheduled_date);',
      'CREATE INDEX CONCURRENTLY idx_visits_practice_scheduled ON visits(practice_id, scheduled_date);',
      'CREATE INDEX CONCURRENTLY idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC);',
      'CREATE INDEX CONCURRENTLY idx_visits_status ON visits(status);'
    ],
    system_notifications: [
      'CREATE INDEX CONCURRENTLY idx_notif_user_id ON system_notifications(user_id);',
      'CREATE INDEX CONCURRENTLY idx_notif_practice_id ON system_notifications(practice_id);',
      'CREATE INDEX CONCURRENTLY idx_notif_created_at ON system_notifications(created_at DESC);',
      'CREATE INDEX CONCURRENTLY idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC);',
      'CREATE INDEX CONCURRENTLY idx_notif_read_status ON system_notifications(is_read);'
    ],
    internal_channel_members: [
      'CREATE INDEX CONCURRENTLY idx_channel_members_user_id ON internal_channel_members(user_id);',
      'CREATE INDEX CONCURRENTLY idx_channel_members_channel_id ON internal_channel_members(channel_id);',
      'CREATE INDEX CONCURRENTLY idx_channel_members_practice ON internal_channel_members(practice_id);',
      'CREATE INDEX CONCURRENTLY idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id);'
    ],
    practice_sms_subscriptions: [
      'CREATE INDEX CONCURRENTLY idx_sms_sub_practice ON practice_sms_subscriptions(practice_id);',
      'CREATE INDEX CONCURRENTLY idx_sms_sub_status ON practice_sms_subscriptions(status);',
      'CREATE INDEX CONCURRENTLY idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status);'
    ],
    practice_email_subscriptions: [
      'CREATE INDEX CONCURRENTLY idx_email_sub_practice ON practice_email_subscriptions(practice_id);',
      'CREATE INDEX CONCURRENTLY idx_email_sub_status ON practice_email_subscriptions(status);',
      'CREATE INDEX CONCURRENTLY idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status);'
    ]
  };

  console.log('\nRecommended indexes to improve query performance:\n');

  for (const [table, indexes] of Object.entries(recommendations)) {
    console.log(`\n${table}:`);
    for (const idx of indexes) {
      // Check if index might already exist
      const indexName = idx.match(/idx_\w+/)[0];
      console.log(`  ${idx}`);
    }
  }

  console.log('\n\n✅ Analysis Complete!');
  console.log('\nNOTE: Run these CREATE INDEX CONCURRENTLY statements during off-peak hours.');
  console.log('CONCURRENTLY allows the index to be built without blocking writes.');

} catch (error) {
  console.error('Database connection error:', error.message);
  console.log('\nPlease set DATABASE_URL environment variable with your Supabase connection string');
} finally {
  await client.end();
}
