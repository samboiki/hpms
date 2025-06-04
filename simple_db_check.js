import { createClient } from '@supabase/supabase-js';

// Database credentials (using anon key from .env)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Create Supabase client with anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTables() {
  console.log('🔍 Checking database tables...\n');
  
  try {
    // Get all tables in public schema using RPC call
    const { data: tables, error } = await supabase.rpc('get_public_tables');
    
    if (error) {
      console.error('❌ Error fetching tables:', error);
      return;
    }
    
    console.log('📋 Existing tables:');
    if (tables && tables.length > 0) {
      tables.forEach(table => {
        console.log(`  ✓ ${table.table_name}`);
      });
    } else {
      console.log('  No tables found in public schema');
    }
    
    // Check specific important tables
    const importantTables = ['users', 'patients', 'appointments', 'practices', 'visits'];
    
    console.log('\n🎯 Checking important tables:');
    for (const tableName of importantTables) {
      const exists = tables?.some(t => t.table_name === tableName);
      console.log(`  ${exists ? '✓' : '✗'} ${tableName}`);
      
      if (exists) {
        // Try to get row count
        try {
          const { count, error: countError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (!countError) {
            console.log(`    → ${count} rows`);
          }
        } catch (e) {
          console.log(`    → Unable to count rows (${e.message})`);
        }
      }
    }
    
    // Check auth.users table separately
    console.log('\n🔐 Checking auth schema:');
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (!authError) {
        console.log(`  ✓ auth.users (${authUsers.users?.length || 0} users)`);
      } else {
        console.log(`  ✗ auth.users (Error: ${authError.message})`);
      }
    } catch (e) {
      console.log(`  ✗ auth.users (Error: ${e.message})`);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function checkMigrationFiles() {
  console.log('\n📁 Checking migration files...\n');
  
  const fs = await import('fs');
  const path = await import('path');
  
  const migrationDir = '/home/happy/projects/hpms/supabase/migrations';
  
  try {
    const files = fs.readdirSync(migrationDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    
    console.log('📄 Available migration files:');
    sqlFiles.forEach(file => {
      const filePath = path.join(migrationDir, file);
      const size = fs.statSync(filePath).size;
      console.log(`  ✓ ${file} (${size} bytes)`);
    });
    
    // Check specific migrations we need
    const requiredMigrations = [
      '20250526_multi_tenant_practices.sql',
      '20250602_add_ready_status.sql'
    ];
    
    console.log('\n🎯 Required migration files:');
    requiredMigrations.forEach(file => {
      const exists = sqlFiles.includes(file);
      console.log(`  ${exists ? '✓' : '✗'} ${file}`);
    });
    
  } catch (error) {
    console.error('❌ Error reading migration directory:', error);
  }
}

async function main() {
  console.log('🚀 Supabase Database Verification Tool\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);
  
  await checkTables();
  await checkMigrationFiles();
  
  console.log('\n✅ Verification complete!');
}

main().catch(console.error);