import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

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

for (const table of tables) {
  console.log(`\n📊 TABLE: ${table}`);
  console.log('─'.repeat(80));

  // Get indexes
  const { data: indexes, error: idxError } = await supabase.rpc('execute_raw_sql', {
    query_text: `
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = '${table}'
      ORDER BY indexname;
    `
  });

  if (idxError) {
    console.log('Error fetching indexes:', idxError);
  } else {
    console.log(`\nCurrent Indexes (${indexes?.length || 0}):`);
    if (indexes && indexes.length > 0) {
      indexes.forEach(idx => {
        console.log(`  • ${idx.indexname}`);
        console.log(`    ${idx.indexdef}`);
      });
    } else {
      console.log('  (No indexes found)');
    }
  }

  // Get RLS policies
  const { data: policies, error: polError } = await supabase.rpc('execute_raw_sql', {
    query_text: `
      SELECT
        policyname,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = '${table}'
      ORDER BY policyname;
    `
  });

  if (polError) {
    console.log('Error fetching policies:', polError);
  } else {
    console.log(`\nRLS Policies (${policies?.length || 0}):`);
    if (policies && policies.length > 0) {
      policies.forEach(pol => {
        console.log(`  • ${pol.policyname} (${pol.cmd})`);
        console.log(`    USING: ${pol.qual}`);
        if (pol.with_check) console.log(`    WITH CHECK: ${pol.with_check}`);
      });
    } else {
      console.log('  (No RLS policies found)');
    }
  }

  // Get table statistics
  const { data: stats, error: statError } = await supabase.rpc('execute_raw_sql', {
    query_text: `
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
      AND relname = '${table}';
    `
  });

  if (!statError && stats && stats.length > 0) {
    const stat = stats[0];
    console.log(`\nTable Statistics:`);
    console.log(`  Live Rows: ${stat.live_rows ? stat.live_rows.toLocaleString() : 0}`);
    console.log(`  Dead Rows: ${stat.dead_rows ? stat.dead_rows.toLocaleString() : 0}`);
    console.log(`  Last Analyze: ${stat.last_autoanalyze || stat.last_analyze || 'Never'}`);
  }

  // Get column information
  const { data: columns, error: colError } = await supabase.rpc('execute_raw_sql', {
    query_text: `
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = '${table}'
      ORDER BY ordinal_position;
    `
  });

  if (!colError && columns && columns.length > 0) {
    console.log(`\nKey Columns:`);
    columns.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type})`);
    });
  }
}

// Check RPC functions
console.log('\n\n📡 RPC FUNCTIONS ANALYSIS');
console.log('─'.repeat(80));

const { data: functions, error: funcError } = await supabase.rpc('execute_raw_sql', {
  query_text: `
    SELECT
      proname,
      prosrc
    FROM pg_proc
    WHERE proname IN ('get_dashboard_stats', 'get_channel_last_messages')
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  `
});

if (!funcError && functions && functions.length > 0) {
  functions.forEach(func => {
    console.log(`\n🔧 Function: ${func.proname}`);
    console.log('─'.repeat(80));
    console.log('Source:');
    console.log(func.prosrc);
  });
} else {
  console.log('No RPC functions found or error:', funcError);
}

// Get slow query insights
console.log('\n\n⚡ PERFORMANCE INSIGHTS');
console.log('─'.repeat(80));

const { data: seqScans, error: scanError } = await supabase.rpc('execute_raw_sql', {
  query_text: `
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
  `
});

if (!scanError && seqScans && seqScans.length > 0) {
  console.log('\nSequential Scans vs Index Scans:');
  seqScans.forEach(scan => {
    console.log(`\n  ${scan.table_name}:`);
    console.log(`    Sequential Scans: ${scan.sequential_scans?.toLocaleString() || 0}`);
    console.log(`    Index Scans: ${scan.index_scans?.toLocaleString() || 0}`);
    console.log(`    Avg Rows/Seq Scan: ${scan.avg_rows_per_seq_scan || 0}`);

    if (scan.sequential_scans > scan.index_scans * 2) {
      console.log(`    ⚠️  WARNING: High sequential scan ratio - needs indexes!`);
    }
  });
}

console.log('\n\n✅ Analysis Complete!');
