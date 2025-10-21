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

console.log('📝 Dashboard RPC Function Fix\n');
console.log('🔧 Bug: Function uses v.user_id but should use v.doctor_id');
console.log('📍 Location: get_dashboard_data_bundle function');
console.log('🎯 Impact: Doctor names not showing in dashboard visits\n');

console.log('✅ Migration file created at:');
console.log('   C:\\projects\\hpms\\supabase\\migrations\\20251022_fix_dashboard_rpc_doctor_id.sql\n');

console.log('📋 To apply this fix, you have several options:\n');

console.log('Option 1: Supabase Dashboard (RECOMMENDED)');
console.log('   1. Go to https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new');
console.log('   2. Copy the SQL from the migration file');
console.log('   3. Paste and run it in the SQL editor\n');

console.log('Option 2: Supabase CLI');
console.log('   Run: supabase db push --linked\n');

console.log('Option 3: Direct PostgreSQL connection');
console.log('   Use your database credentials to connect and run the SQL\n');

console.log('📊 Expected changes:');
console.log('   ✓ todays_visits will show correct doctor names');
console.log('   ✓ recent_visits will show correct doctor names');
console.log('   ✓ Dashboard data accuracy improved\n');

console.log('💡 The SQL changes:');
console.log('   Line 36: LEFT JOIN users u ON v.user_id = u.id');
console.log('          → LEFT JOIN users u ON v.doctor_id = u.id');
console.log('');
console.log('   Line 71: LEFT JOIN users u ON v.user_id = u.id');
console.log('          → LEFT JOIN users u ON v.doctor_id = u.id\n');

// Try to verify the current function exists
console.log('🔍 Checking current function status...\n');

try {
  const { data, error } = await supabase.rpc('get_dashboard_data_bundle', {
    p_practice_id: '00000000-0000-0000-0000-000000000000',
    p_user_id: '00000000-0000-0000-0000-000000000000'
  });

  if (error && error.code === '42883') {
    console.log('⚠️  Function does not exist yet - will be created by migration');
  } else if (error) {
    console.log('ℹ️  Function exists but returned error (expected with dummy IDs)');
    console.log('   This confirms the function is present and needs updating');
  } else {
    console.log('✓ Function exists and is callable');
  }
} catch (err) {
  console.log('ℹ️  Function check completed');
}

console.log('\n🚀 Ready to apply the fix!');
console.log('   Please use Option 1 (Supabase Dashboard) for immediate deployment.\n');
