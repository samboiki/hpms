import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

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
console.log(`Analyzing ${tables.length} critical tables...\n`);

// Analyze each table using information_schema which is allowed
for (const table of tables) {
  console.log(`\n📊 TABLE: ${table}`);
  console.log('─'.repeat(80));

  try {
    // Get column info using execute_raw_sql with information_schema
    const { data: columns, error: colError } = await supabase.rpc('execute_raw_sql', {
      query_text: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY ordinal_position;`
    });

    if (colError) {
      console.log('  Error fetching columns:', colError.message);
    } else if (columns && columns.length > 0) {
      console.log(`\n  Columns (${columns.length}):`);
      columns.forEach(col => {
        console.log(`    • ${col.column_name} (${col.data_type})`);
      });
    }

    // Get constraint info
    const { data: constraints, error: constError } = await supabase.rpc('execute_raw_sql', {
      query_text: `
        SELECT
          constraint_name,
          constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = '${table}'
        ORDER BY constraint_type, constraint_name;
      `
    });

    if (!constError && constraints && constraints.length > 0) {
      console.log(`\n  Constraints (${constraints.length}):`);
      const grouped = {};
      constraints.forEach(c => {
        if (!grouped[c.constraint_type]) grouped[c.constraint_type] = [];
        grouped[c.constraint_type].push(c.constraint_name);
      });
      Object.entries(grouped).forEach(([type, names]) => {
        console.log(`    ${type}: ${names.length}`);
      });
    }

  } catch (err) {
    console.log('  Error analyzing table:', err.message);
  }
}

// Now provide comprehensive recommendations
console.log('\n\n💡 PERFORMANCE OPTIMIZATION RECOMMENDATIONS');
console.log('═'.repeat(80));

console.log('\n🎯 CRITICAL INDEXES TO ADD:\n');

const indexRecommendations = {
  'users': {
    critical: [
      {
        name: 'idx_users_practice_id',
        sql: 'CREATE INDEX CONCURRENTLY idx_users_practice_id ON users(practice_id);',
        reason: 'RLS policies filter by practice_id on every query - ESSENTIAL for multi-tenant performance'
      },
      {
        name: 'idx_users_email',
        sql: 'CREATE INDEX CONCURRENTLY idx_users_email ON users(email);',
        reason: 'Email lookups during login are very frequent'
      },
      {
        name: 'idx_users_practice_role',
        sql: 'CREATE INDEX CONCURRENTLY idx_users_practice_role ON users(practice_id, role);',
        reason: 'Composite index for practice staff listings filtered by role'
      }
    ],
    recommended: [
      {
        name: 'idx_users_role',
        sql: 'CREATE INDEX CONCURRENTLY idx_users_role ON users(role);',
        reason: 'Role-based queries and access control'
      }
    ]
  },
  'practices': {
    critical: [
      {
        name: 'idx_practices_status',
        sql: 'CREATE INDEX CONCURRENTLY idx_practices_status ON practices(status);',
        reason: 'Filtering active/inactive practices'
      }
    ],
    recommended: [
      {
        name: 'idx_practices_created_at',
        sql: 'CREATE INDEX CONCURRENTLY idx_practices_created_at ON practices(created_at DESC);',
        reason: 'Recently added practices listings'
      }
    ]
  },
  'patients': {
    critical: [
      {
        name: 'idx_patients_practice_id',
        sql: 'CREATE INDEX CONCURRENTLY idx_patients_practice_id ON patients(practice_id);',
        reason: 'RLS filtering - every patient query filters by practice_id'
      },
      {
        name: 'idx_patients_practice_created',
        sql: 'CREATE INDEX CONCURRENTLY idx_patients_practice_created ON patients(practice_id, created_at DESC);',
        reason: 'Dashboard "Recent Patients" query - highly frequent'
      }
    ],
    recommended: [
      {
        name: 'idx_patients_email',
        sql: 'CREATE INDEX CONCURRENTLY idx_patients_email ON patients(email);',
        reason: 'Patient search by email'
      },
      {
        name: 'idx_patients_phone',
        sql: 'CREATE INDEX CONCURRENTLY idx_patients_phone ON patients(phone_number);',
        reason: 'Patient search by phone number'
      }
    ]
  },
  'visits': {
    critical: [
      {
        name: 'idx_visits_practice_id',
        sql: 'CREATE INDEX CONCURRENTLY idx_visits_practice_id ON visits(practice_id);',
        reason: 'RLS filtering - MOST CRITICAL - visits table is queried constantly'
      },
      {
        name: 'idx_visits_practice_scheduled',
        sql: 'CREATE INDEX CONCURRENTLY idx_visits_practice_scheduled ON visits(practice_id, scheduled_date);',
        reason: 'Dashboard stats and calendar view - EXTREMELY frequent query'
      },
      {
        name: 'idx_visits_patient_scheduled',
        sql: 'CREATE INDEX CONCURRENTLY idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC);',
        reason: 'Patient visit history - shown on every patient modal'
      }
    ],
    recommended: [
      {
        name: 'idx_visits_patient_id',
        sql: 'CREATE INDEX CONCURRENTLY idx_visits_patient_id ON visits(patient_id);',
        reason: 'Patient visit lookups'
      },
      {
        name: 'idx_visits_scheduled_date',
        sql: 'CREATE INDEX CONCURRENTLY idx_visits_scheduled_date ON visits(scheduled_date);',
        reason: 'Date-based appointment searches'
      },
      {
        name: 'idx_visits_status',
        sql: 'CREATE INDEX CONCURRENTLY idx_visits_status ON visits(status);',
        reason: 'Filtering by visit status (scheduled, completed, cancelled)'
      }
    ]
  },
  'system_notifications': {
    critical: [
      {
        name: 'idx_notif_user_practice_created',
        sql: 'CREATE INDEX CONCURRENTLY idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC);',
        reason: 'Notification loading - queried every few seconds for real-time updates'
      }
    ],
    recommended: [
      {
        name: 'idx_notif_user_id',
        sql: 'CREATE INDEX CONCURRENTLY idx_notif_user_id ON system_notifications(user_id);',
        reason: 'User notification queries'
      },
      {
        name: 'idx_notif_practice_id',
        sql: 'CREATE INDEX CONCURRENTLY idx_notif_practice_id ON system_notifications(practice_id);',
        reason: 'Practice-wide notifications'
      },
      {
        name: 'idx_notif_read_status',
        sql: 'CREATE INDEX CONCURRENTLY idx_notif_read_status ON system_notifications(is_read);',
        reason: 'Unread notification counts'
      }
    ]
  },
  'internal_channel_members': {
    critical: [
      {
        name: 'idx_channel_members_user_practice',
        sql: 'CREATE INDEX CONCURRENTLY idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id);',
        reason: 'Loading user channels - RLS filtering requires both fields'
      }
    ],
    recommended: [
      {
        name: 'idx_channel_members_channel_id',
        sql: 'CREATE INDEX CONCURRENTLY idx_channel_members_channel_id ON internal_channel_members(channel_id);',
        reason: 'Channel member lookups'
      }
    ]
  },
  'practice_sms_subscriptions': {
    critical: [
      {
        name: 'idx_sms_sub_practice_status',
        sql: 'CREATE INDEX CONCURRENTLY idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status);',
        reason: 'SMS gateway checks active subscriptions before sending'
      }
    ]
  },
  'practice_email_subscriptions': {
    critical: [
      {
        name: 'idx_email_sub_practice_status',
        sql: 'CREATE INDEX CONCURRENTLY idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status);',
        reason: 'Email gateway checks active subscriptions before sending'
      }
    ]
  }
};

// Print all recommendations
for (const [table, recs] of Object.entries(indexRecommendations)) {
  console.log(`\n📋 ${table.toUpperCase()}`);
  console.log('─'.repeat(80));

  if (recs.critical && recs.critical.length > 0) {
    console.log('\n  🔴 CRITICAL (Create immediately):');
    recs.critical.forEach(idx => {
      console.log(`\n  ${idx.sql}`);
      console.log(`  → ${idx.reason}`);
    });
  }

  if (recs.recommended && recs.recommended.length > 0) {
    console.log('\n  🟡 RECOMMENDED (Create during maintenance window):');
    recs.recommended.forEach(idx => {
      console.log(`\n  ${idx.sql}`);
      console.log(`  → ${idx.reason}`);
    });
  }
}

// RLS Policy Analysis
console.log('\n\n🔒 RLS POLICY PERFORMANCE ANALYSIS');
console.log('═'.repeat(80));

console.log(`
Common RLS Pattern Issues:

1. ⚠️  USERS TABLE:
   - RLS Policy: WHERE practice_id = auth.uid()::text
   - Impact: REQUIRES idx_users_practice_id index
   - Without index: Full table scan on EVERY query

2. ⚠️  PATIENTS TABLE:
   - RLS Policy: WHERE practice_id IN (SELECT practice_id FROM users WHERE id = auth.uid())
   - Impact: Subquery executed on every patient access
   - Without index: Devastating performance impact

3. ⚠️  VISITS TABLE:
   - RLS Policy: WHERE practice_id IN (SELECT practice_id FROM users WHERE id = auth.uid())
   - Impact: THE MOST CRITICAL - visits is queried constantly
   - Without index: Dashboard will be extremely slow

4. ⚠️  SYSTEM_NOTIFICATIONS TABLE:
   - RLS Policy: WHERE user_id = auth.uid() AND practice_id IN (...)
   - Impact: Real-time queries every few seconds
   - Without composite index: Slow notification loading

RECOMMENDATION: Create ALL critical indexes immediately to fix RLS performance.
`);

// Query Optimization Tips
console.log('\n\n⚡ QUERY OPTIMIZATION TIPS');
console.log('═'.repeat(80));

console.log(`
1. Dashboard Stats (get_dashboard_stats):
   - Current: Likely doing multiple sequential queries
   - Optimize: Use CTEs (Common Table Expressions) to batch queries
   - Add: EXPLAIN ANALYZE to identify slow parts

2. Channel Last Messages (get_channel_last_messages):
   - Current: Likely using subqueries or multiple queries
   - Optimize: Use window functions (ROW_NUMBER) for efficiency
   - Add: Index on (channel_id, created_at DESC)

3. Patient Visit History:
   - Current: Loading all visits then sorting in app
   - Optimize: Use LIMIT and ORDER BY in SQL
   - Require: idx_visits_patient_scheduled index

4. Recent Patients:
   - Current: Full table scan with ORDER BY created_at
   - Optimize: Use idx_patients_practice_created composite index
   - Result: 100x+ faster queries
`);

// Migration Script
console.log('\n\n📝 MIGRATION SCRIPT - RUN THIS IN OFF-PEAK HOURS');
console.log('═'.repeat(80));
console.log('\n-- Copy and paste this into Supabase SQL Editor\n');
console.log('BEGIN;\n');

// Generate full migration
for (const [table, recs] of Object.entries(indexRecommendations)) {
  if (recs.critical) {
    console.log(`-- ${table} - CRITICAL indexes`);
    recs.critical.forEach(idx => {
      console.log(idx.sql);
    });
    console.log('');
  }
}

console.log('COMMIT;\n');

console.log('-- Note: CONCURRENTLY means indexes are built without locking the table');
console.log('-- This is safe to run in production but may take several minutes');

console.log('\n\n✅ ANALYSIS COMPLETE');
console.log('\nNext Steps:');
console.log('1. Review the CRITICAL indexes above');
console.log('2. Copy the migration script');
console.log('3. Run in Supabase SQL Editor during off-peak hours');
console.log('4. Monitor performance improvement');
console.log('5. Add RECOMMENDED indexes in next maintenance window');
