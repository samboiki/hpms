import { createClient } from '@supabase/supabase-js';

// Database credentials (using service role key for admin operations)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAvailableFunctions() {
  console.log('🔍 Checking available RPC functions...\n');

  try {
    // Try to get list of functions from information_schema
    const { data, error } = await supabase.rpc('get_public_tables');

    if (error) {
      console.log('❌ get_public_tables error:', error.message);
    } else {
      console.log('✅ get_public_tables works:', data);
    }

    // Try different function names that might exist
    const functionsToTry = [
      'execute_sql',
      'execute_raw_sql',
      'exec_sql',
      'run_sql',
      'sql_exec',
      'get_schema_info',
      'get_table_info'
    ];

    for (const funcName of functionsToTry) {
      try {
        const { data: funcData, error: funcError } = await supabase.rpc(funcName, {});
        if (!funcError) {
          console.log(`✅ Function ${funcName} exists`);
        } else {
          console.log(`❌ Function ${funcName}: ${funcError.message}`);
        }
      } catch (e) {
        console.log(`❌ Function ${funcName}: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking functions:', error.message);
  }
}

checkAvailableFunctions();