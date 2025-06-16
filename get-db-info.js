import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function getInfo() {
  console.log('🔍 Getting database information...\n');
  
  // Get tables using direct query
  console.log('📋 All tables:');
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');
    
  if (tablesError) {
    console.log('❌ Error getting tables:', tablesError);
  } else {
    tables?.forEach(table => console.log(`  - ${table.table_name}`));
  }
  
  console.log('\n🏥 Looking for practice-related data...');
  
  // Check if users table has role information
  const { data: users, error: usersError } = await supabase
    .from('auth.users')
    .select('id, email, raw_user_meta_data')
    .limit(5);
    
  if (!usersError && users) {
    console.log('👥 Sample users:');
    users.forEach(user => {
      console.log(`  - ${user.email}: ${JSON.stringify(user.raw_user_meta_data || {})}`);
    });
  }
  
  // Check what tables actually exist by trying to query them
  const commonTables = ['patients', 'appointments', 'visits', 'medical_records', 'users'];
  
  for (const table of commonTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
        
      if (!error) {
        console.log(`✅ Table '${table}' exists and has data`);
      }
    } catch (e) {
      console.log(`❌ Table '${table}' not accessible or doesn't exist`);
    }
  }
}

getInfo();