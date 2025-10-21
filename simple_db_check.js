import { createClient } from '@supabase/supabase-js';

// Database credentials (using service role key for admin operations)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
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

async function addDepartmentIdToHospitalWards() {
  console.log('🏥 Adding department_id column to hospital_wards table...\n');

  try {
    // First check if hospital_wards table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'hospital_wards');

    if (tableError) {
      console.log('❌ Error checking hospital_wards table:', tableError.message);
      return;
    }

    if (!tables || tables.length === 0) {
      console.log('❌ hospital_wards table does not exist');
      return;
    }

    console.log('✅ hospital_wards table exists');

    // Check if departments table exists
    const { data: deptTables, error: deptError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'departments');

    if (deptError) {
      console.log('❌ Error checking departments table:', deptError.message);
      return;
    }

    if (!deptTables || deptTables.length === 0) {
      console.log('❌ departments table does not exist - cannot create foreign key reference');
      return;
    }

    console.log('✅ departments table exists');

    // Check if department_id column already exists
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'hospital_wards')
      .eq('column_name', 'department_id');

    if (columnError) {
      console.log('❌ Error checking columns:', columnError.message);
      return;
    }

    if (columns && columns.length > 0) {
      console.log('ℹ️  department_id column already exists in hospital_wards table');
      return;
    }

    console.log('🔧 Since exec_sql function is not available, please execute the following SQL manually in Supabase dashboard:');
    console.log(`
ALTER TABLE hospital_wards
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hospital_wards_department ON hospital_wards(department_id);

COMMENT ON COLUMN hospital_wards.department_id IS 'Department responsible for managing this ward';
    `);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Department Ward Migration Tool\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  await addDepartmentIdToHospitalWards();

  console.log('\n✅ Migration complete!');
}

main().catch(console.error);