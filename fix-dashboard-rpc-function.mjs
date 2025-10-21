import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
CREATE OR REPLACE FUNCTION get_dashboard_data_bundle(
  p_practice_id uuid,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH
    -- User data
    user_data AS (
      SELECT row_to_json(u.*) as data
      FROM users u
      WHERE u.id = p_user_id
      LIMIT 1
    ),

    -- Practice data
    practice_data AS (
      SELECT row_to_json(p.*) as data
      FROM practices p
      WHERE p.id = p_practice_id
      LIMIT 1
    ),

    -- Today's visits - FIX: use doctor_id instead of user_id
    todays_visits AS (
      SELECT json_agg(row_to_json(v.*)) as data
      FROM (
        SELECT v.*,
               p.first_name, p.last_name, p.cell_number,
               u.full_name as doctor_name
        FROM visits v
        LEFT JOIN patients p ON v.patient_id = p.id
        LEFT JOIN users u ON v.doctor_id = u.id  -- FIXED: was v.user_id
        WHERE v.practice_id = p_practice_id
          AND v.visit_date::date = CURRENT_DATE
        ORDER BY v.visit_date DESC
        LIMIT 100
      ) v
    ),

    -- Recent patients (last 30 days)
    recent_patients AS (
      SELECT json_agg(row_to_json(p.*)) as data
      FROM (
        SELECT DISTINCT ON (p.id) p.*
        FROM patients p
        INNER JOIN visits v ON v.patient_id = p.id
        WHERE p.practice_id = p_practice_id
          AND v.visit_date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY p.id, v.visit_date DESC
        LIMIT 50
      ) p
    ),

    -- Recent visits - FIX: use doctor_id instead of user_id
    recent_visits AS (
      SELECT json_agg(row_to_json(v.*)) as data
      FROM (
        SELECT v.*,
               p.first_name, p.last_name, p.cell_number,
               u.full_name as doctor_name
        FROM visits v
        LEFT JOIN patients p ON v.patient_id = p.id
        LEFT JOIN users u ON v.doctor_id = u.id  -- FIXED: was v.user_id
        WHERE v.practice_id = p_practice_id
          AND v.visit_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY v.visit_date DESC
        LIMIT 100
      ) v
    ),

    -- Recent invoices
    recent_invoices AS (
      SELECT json_agg(row_to_json(i.*)) as data
      FROM (
        SELECT i.*, p.first_name, p.last_name
        FROM invoices_enhanced i
        LEFT JOIN patients p ON i.patient_id = p.id
        WHERE i.practice_id = p_practice_id
        ORDER BY i.created_at DESC
        LIMIT 20
      ) i
    ),

    -- Unread messages count
    messages_count AS (
      SELECT COUNT(*) as count
      FROM messages m
      WHERE m.receiver_id = p_user_id
        AND m.is_read = false
    ),

    -- Pending leave requests
    pending_leaves AS (
      SELECT json_agg(row_to_json(l.*)) as data
      FROM (
        SELECT l.*, u.full_name
        FROM leave_requests l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE l.practice_id = p_practice_id
          AND l.status = 'pending'
        ORDER BY l.created_at DESC
        LIMIT 10
      ) l
    ),

    -- Practice settings
    practice_settings_data AS (
      SELECT json_agg(row_to_json(ps.*)) as data
      FROM practice_settings ps
      WHERE ps.practice_id = p_practice_id
    ),

    -- Statistics
    stats AS (
      SELECT
        (SELECT COUNT(*) FROM visits WHERE practice_id = p_practice_id AND visit_date::date = CURRENT_DATE) as today_visits_count,
        (SELECT COUNT(*) FROM patients WHERE practice_id = p_practice_id) as total_patients,
        (SELECT COUNT(*) FROM visits WHERE practice_id = p_practice_id AND visit_date >= CURRENT_DATE - INTERVAL '30 days') as month_visits_count,
        (SELECT COUNT(*) FROM invoices_enhanced WHERE practice_id = p_practice_id AND payment_status = 'unpaid') as unpaid_invoices_count
    )

  -- Combine all results
  SELECT json_build_object(
    'user', (SELECT data FROM user_data),
    'practice', (SELECT data FROM practice_data),
    'todaysVisits', COALESCE((SELECT data FROM todays_visits), '[]'::json),
    'recentPatients', COALESCE((SELECT data FROM recent_patients), '[]'::json),
    'recentVisits', COALESCE((SELECT data FROM recent_visits), '[]'::json),
    'recentInvoices', COALESCE((SELECT data FROM recent_invoices), '[]'::json),
    'unreadMessagesCount', (SELECT count FROM messages_count),
    'pendingLeaveRequests', COALESCE((SELECT data FROM pending_leaves), '[]'::json),
    'practiceSettings', COALESCE((SELECT data FROM practice_settings_data), '[]'::json),
    'statistics', row_to_json((SELECT * FROM stats))
  ) INTO result;

  RETURN result;
END;
$$;
`;

async function fixDashboardFunction() {
  console.log('🔧 Fixing get_dashboard_data_bundle RPC function...\n');
  console.log('📝 Changes:');
  console.log('   - Line 35: v.user_id → v.doctor_id (todays_visits)');
  console.log('   - Line 70: v.user_id → v.doctor_id (recent_visits)\n');

  try {
    // Execute SQL directly via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_raw_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error executing SQL:', error);

      // Try alternative method using pg client
      console.log('\n🔄 Attempting alternative execution method...\n');
      const { Client } = await import('pg');

      const client = new Client({
        connectionString: process.env.DATABASE_URL || `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.VITE_SUPABASE_URL.split('.')[0].replace('https://', '')}.supabase.co:5432/postgres`
      });

      await client.connect();
      await client.query(sql);
      await client.end();

      console.log('✅ RPC function successfully updated using PostgreSQL client!\n');
      console.log('🎯 The function now correctly uses v.doctor_id instead of v.user_id');
      console.log('📊 This will properly populate doctor names in dashboard visits');
      return;
    }

    const data = await response.json();
    console.log('✅ RPC function successfully updated!\n');
    console.log('🎯 The function now correctly uses v.doctor_id instead of v.user_id');
    console.log('📊 This will properly populate doctor names in dashboard visits');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

fixDashboardFunction();
