import { createClient } from '@supabase/supabase-js';

// Database credentials (using anon key from .env)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTable(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`  ✗ ${tableName} - Error: ${error.message}`);
      return false;
    } else {
      console.log(`  ✓ ${tableName} - ${count} rows`);
      return true;
    }
  } catch (err) {
    console.log(`  ✗ ${tableName} - Exception: ${err.message}`);
    return false;
  }
}

async function checkTableStructure(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      return null;
    }
    
    if (data && data.length > 0) {
      return Object.keys(data[0]);
    }
    
    // If no data, try to get one row without limit to see structure
    const { data: emptyData, error: emptyError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', 'non-existent-id'); // This should return empty but with structure
    
    return emptyData ? Object.keys(emptyData[0] || {}) : [];
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('🚀 Direct Database Table Check\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);
  
  // Tables to check
  const tables = [
    'practices',
    'users', 
    'patients',
    'appointments',
    'visits',
    'medical_records',
    'vitals',
    'lab_requests',
    'medical_aid_details',
    'messages',
    'lab_results'
  ];
  
  console.log('🔍 Checking table existence and row counts:\n');
  
  const existingTables = [];
  
  for (const table of tables) {
    const exists = await checkTable(table);
    if (exists) {
      existingTables.push(table);
    }
  }
  
  console.log(`\n📊 Summary: ${existingTables.length}/${tables.length} tables exist\n`);
  
  // Check structure of key tables
  if (existingTables.length > 0) {
    console.log('🔍 Checking table structures:\n');
    
    for (const table of existingTables.slice(0, 3)) { // Check first 3 existing tables
      console.log(`📋 ${table} columns:`);
      const columns = await checkTableStructure(table);
      if (columns && columns.length > 0) {
        columns.forEach(col => console.log(`   - ${col}`));
      } else {
        console.log('   Unable to determine structure');
      }
      console.log('');
    }
  }
  
  // Check if specific columns exist in key tables
  if (existingTables.includes('users')) {
    console.log('🔍 Checking for practice_id in users table...');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('practice_id')
        .limit(1);
      
      if (error && error.message.includes('practice_id')) {
        console.log('  ✗ practice_id column does not exist in users table');
      } else {
        console.log('  ✓ practice_id column exists in users table');
      }
    } catch (err) {
      console.log('  ? Unable to check practice_id column');
    }
  }
  
  if (existingTables.includes('appointments')) {
    console.log('\n🔍 Checking for ready_status in appointments table...');
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('ready_status')
        .limit(1);
      
      if (error && error.message.includes('ready_status')) {
        console.log('  ✗ ready_status column does not exist in appointments table');
      } else {
        console.log('  ✓ ready_status column exists in appointments table');
      }
    } catch (err) {
      console.log('  ? Unable to check ready_status column');
    }
  }
  
  console.log('\n✅ Direct table check complete!');
  
  // Migration recommendations
  console.log('\n📝 Migration Recommendations:');
  
  if (!existingTables.includes('practices')) {
    console.log('  🔧 Need to create practices table');
  }
  
  if (existingTables.includes('users')) {
    console.log('  🔧 Check if users.practice_id column needs to be added');
  }
  
  if (existingTables.includes('appointments')) {
    console.log('  🔧 Check if appointments.ready_status column needs to be added');
  }
  
  console.log('\n📁 Available migration files to apply:');
  console.log('  - 20250526_multi_tenant_practices.sql (Multi-tenant setup)');
  console.log('  - 20250602_add_ready_status.sql (Ready status for appointments)');
}

main().catch(console.error);