import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Read the SQL from the migration file
const sql = fs.readFileSync('C:\\projects\\hpms\\supabase\\migrations\\20251022_fix_dashboard_rpc_doctor_id.sql', 'utf8');

console.log('🚀 Executing Dashboard RPC Function Fix via Edge Function\n');
console.log('📝 Bug: Function uses v.user_id but should use v.doctor_id');
console.log('🔧 Affected queries: todays_visits, recent_visits\n');

async function executeFix() {
  try {
    console.log('📡 Calling execute-sql edge function...');

    const { data, error } = await supabase.functions.invoke('execute-sql', {
      body: {
        sql: sql,
        operation_type: 'DDL',
        description: 'Fix get_dashboard_data_bundle to use doctor_id instead of user_id'
      }
    });

    if (error) {
      console.error('❌ Edge function error:', error);
      console.log('\n💡 Alternative: Use Supabase Dashboard SQL Editor');
      console.log('   URL: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new');
      process.exit(1);
    }

    if (data.error) {
      console.error('❌ SQL execution error:', data.error);
      console.log('\n💡 Details:', data.details || data);
      process.exit(1);
    }

    console.log('✅ RPC function successfully updated!\n');
    console.log('📊 Execution details:');
    console.log('   ⏱️  Execution time:', data.execution_time_ms, 'ms');
    console.log('   📝 Operation type:', data.audit_log?.operation_type || 'DDL');
    console.log('   ✓ Success:', data.success);

    console.log('\n🎯 Changes applied:');
    console.log('   ✓ todays_visits now uses v.doctor_id');
    console.log('   ✓ recent_visits now uses v.doctor_id');
    console.log('   ✓ Doctor names will display correctly in dashboard');

    console.log('\n💡 Impact:');
    console.log('   - Dashboard will show accurate doctor assignments');
    console.log('   - Visit tracking will properly link to doctors');
    console.log('   - Data integrity improved for all practices\n');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify edge function is deployed: npx supabase functions list');
    console.log('   2. Check function logs: npx supabase functions logs execute-sql');
    console.log('   3. Use Supabase Dashboard SQL Editor as backup\n');
    process.exit(1);
  }
}

executeFix();
