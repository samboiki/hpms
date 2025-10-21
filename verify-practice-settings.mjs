import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTable() {
  console.log('🔍 Checking practice_settings table existence...\n');

  // Try to query the table directly
  const { data, error } = await supabase
    .from('practice_settings')
    .select('*')
    .limit(1);

  if (error) {
    console.log('❌ practice_settings table DOES NOT EXIST');
    console.log(`   Error code: ${error.code}`);
    console.log(`   Error message: ${error.message}\n`);
    return false;
  }

  console.log('✅ practice_settings table EXISTS');
  console.log(`   Sample data available: ${data ? 'Yes' : 'No'}\n`);
  return true;
}

checkTable().catch(console.error);
