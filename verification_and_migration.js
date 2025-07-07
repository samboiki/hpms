import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import fs from 'fs';

// Database credentials (using service role for admin access)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjM0MTU5NCwiZXhwIjoyMDUxOTE3NTk0fQ.w6_P8Ncw4gJUY01NKnfTr3oNdM8mPvmN2RUzgxeK3fI';

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Utility to create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Verification functions
async function checkTableExists(tableName) {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)
    .single();
  
  return !error && data !== null;
}

async function getTableColumns(tableName) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)
    .order('ordinal_position');
  
  if (error) {
    console.error(`Error getting columns for ${tableName}:`, error);
    return [];
  }
  
  return data || [];
}

async function getPracticesData() {
  const { data, error } = await supabase
    .from('practices')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching practices:', error);
    return [];
  }
  
  return data || [];
}

async function getExistingUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, practice_id')
    .order('email');
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  
  return data || [];
}

async function verifyCurrentState() {
  log('\n=== DATABASE VERIFICATION ===', 'bright');
  
  // Check if practices table exists
  log('\n1. Checking practices table...', 'cyan');
  const practicesExists = await checkTableExists('practices');
  
  if (practicesExists) {
    log('✓ Practices table exists', 'green');
    
    // Get table structure
    const columns = await getTableColumns('practices');
    log('\nPractices table columns:', 'yellow');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}${col.is_nullable === 'NO' ? ', NOT NULL' : ''})`);
    });
    
    // Get existing practices
    const practices = await getPracticesData();
    log(`\nExisting practices (${practices.length}):`, 'yellow');
    practices.forEach(practice => {
      console.log(`  - ${practice.name} (ID: ${practice.id}, Slug: ${practice.slug})`);
    });
  } else {
    log('✗ Practices table does not exist', 'red');
  }
  
  // Check users table
  log('\n2. Checking users table...', 'cyan');
  const usersExists = await checkTableExists('users');
  
  if (usersExists) {
    log('✓ Users table exists', 'green');
    
    // Check if practice_id column exists
    const userColumns = await getTableColumns('users');
    const hasPracticeId = userColumns.some(col => col.column_name === 'practice_id');
    
    if (hasPracticeId) {
      log('✓ Users table has practice_id column', 'green');
    } else {
      log('✗ Users table does not have practice_id column', 'red');
    }
    
    // Get user count by practice
    const users = await getExistingUsers();
    const usersByPractice = users.reduce((acc, user) => {
      const practiceId = user.practice_id || 'No Practice';
      acc[practiceId] = (acc[practiceId] || 0) + 1;
      return acc;
    }, {});
    
    log(`\nUsers by practice (${users.length} total):`, 'yellow');
    Object.entries(usersByPractice).forEach(([practiceId, count]) => {
      console.log(`  - ${practiceId}: ${count} users`);
    });
  } else {
    log('✗ Users table does not exist', 'red');
  }
  
  // Check appointments table
  log('\n3. Checking appointments table...', 'cyan');
  const appointmentsExists = await checkTableExists('appointments');
  
  if (appointmentsExists) {
    log('✓ Appointments table exists', 'green');
    
    // Check for practice_id column
    const appointmentColumns = await getTableColumns('appointments');
    const hasPracticeId = appointmentColumns.some(col => col.column_name === 'practice_id');
    
    if (hasPracticeId) {
      log('✓ Appointments table has practice_id column', 'green');
    } else {
      log('✗ Appointments table does not have practice_id column', 'red');
    }
  }
  
  // Check patients table
  log('\n4. Checking patients table...', 'cyan');
  const patientsExists = await checkTableExists('patients');
  
  if (patientsExists) {
    log('✓ Patients table exists', 'green');
    
    // Check for practice_id column
    const patientColumns = await getTableColumns('patients');
    const hasPracticeId = patientColumns.some(col => col.column_name === 'practice_id');
    
    if (hasPracticeId) {
      log('✓ Patients table has practice_id column', 'green');
    } else {
      log('✗ Patients table does not have practice_id column', 'red');
    }
  }
}

async function showMigrationPreview() {
  log('\n=== MIGRATION PREVIEW ===', 'bright');
  
  log('\nThis migration will:', 'cyan');
  console.log('1. Create practices table if it doesn\'t exist');
  console.log('2. Add practice_id columns to users, patients, and appointments tables');
  console.log('3. Create a default practice (ID: 00000000-0000-0000-0000-000000000001)');
  console.log('4. Migrate existing data to the default practice');
  console.log('5. Set up Row Level Security (RLS) policies for multi-tenancy');
  console.log('6. Add the ready_status column to appointments table');
  
  log('\nNew columns to be added:', 'yellow');
  console.log('- users.practice_id (UUID, references practices.id)');
  console.log('- patients.practice_id (UUID, references practices.id)');
  console.log('- appointments.practice_id (UUID, references practices.id)');
  console.log('- appointments.ready_status (TEXT, default: \'not_ready\')');
  
  log('\nRLS policies to be created:', 'yellow');
  console.log('- practices: Users can only see their own practice');
  console.log('- users: Users can only see users from their practice');
  console.log('- patients: Users can only see patients from their practice');
  console.log('- appointments: Users can only see appointments from their practice');
}

async function executeMigration() {
  log('\n=== EXECUTING MIGRATION ===', 'bright');
  
  try {
    // Read the migration SQL
    const migrationSQL = fs.readFileSync('/home/happy/projects/hpms/supabase/migrations/20250526_multi_tenant_practices.sql', 'utf8');
    const readyStatusSQL = fs.readFileSync('/home/happy/projects/hpms/supabase/migrations/20250602_add_ready_status.sql', 'utf8');
    
    log('\nExecuting multi-tenant practices migration...', 'cyan');
    
    // Execute the migration
    const { error: migrationError } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (migrationError) {
      log('✗ Migration failed:', 'red');
      console.error(migrationError);
      return false;
    }
    
    log('✓ Multi-tenant practices migration completed successfully', 'green');
    
    log('\nExecuting ready status migration...', 'cyan');
    
    // Execute the ready status migration
    const { error: readyStatusError } = await supabase.rpc('exec_sql', {
      sql: readyStatusSQL
    });
    
    if (readyStatusError) {
      log('✗ Ready status migration failed:', 'red');
      console.error(readyStatusError);
      return false;
    }
    
    log('✓ Ready status migration completed successfully', 'green');
    
    return true;
  } catch (error) {
    log('✗ Migration error:', 'red');
    console.error(error);
    return false;
  }
}

async function createRollbackScript() {
  log('\n=== CREATING ROLLBACK SCRIPT ===', 'bright');
  
  const rollbackSQL = `
-- Rollback script for multi-tenant migration
-- WARNING: This will remove multi-tenancy support and may result in data loss

BEGIN;

-- Drop RLS policies
DROP POLICY IF EXISTS "practices_isolation" ON practices;
DROP POLICY IF EXISTS "users_practice_isolation" ON users;
DROP POLICY IF EXISTS "patients_practice_isolation" ON patients;
DROP POLICY IF EXISTS "appointments_practice_isolation" ON appointments;

-- Remove foreign key constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_practice_id_fkey;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_practice_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_practice_id_fkey;

-- Remove columns
ALTER TABLE users DROP COLUMN IF EXISTS practice_id;
ALTER TABLE patients DROP COLUMN IF EXISTS practice_id;
ALTER TABLE appointments DROP COLUMN IF EXISTS practice_id;
ALTER TABLE appointments DROP COLUMN IF EXISTS ready_status;

-- Drop practices table
DROP TABLE IF EXISTS practices CASCADE;

COMMIT;
`;

  fs.writeFileSync('/home/happy/projects/hpms/rollback_multi_tenant.sql', rollbackSQL);
  
  log('✓ Rollback script created: rollback_multi_tenant.sql', 'green');
  log('  To rollback, execute: psql -d your_database -f rollback_multi_tenant.sql', 'yellow');
}

async function main() {
  log('=== Supabase Migration Verification & Execution Tool ===', 'bright');
  log('Database: ' + SUPABASE_URL, 'cyan');
  
  // Verify current state
  await verifyCurrentState();
  
  // Show migration preview
  await showMigrationPreview();
  
  // Ask for confirmation
  log('\n=== CONFIRMATION ===', 'bright');
  const proceed = await question('\nDo you want to proceed with the migration? (yes/no): ');
  
  if (proceed.toLowerCase() === 'yes') {
    // Create rollback script first
    await createRollbackScript();
    
    // Execute migration
    const success = await executeMigration();
    
    if (success) {
      log('\n✓ Migration completed successfully!', 'green');
      
      // Verify new state
      log('\nVerifying new state...', 'cyan');
      await verifyCurrentState();
    } else {
      log('\n✗ Migration failed. Check the errors above.', 'red');
      log('You can use the rollback script if needed.', 'yellow');
    }
  } else {
    log('\nMigration cancelled.', 'yellow');
  }
  
  rl.close();
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Note about exec_sql function
log('\n=== IMPORTANT NOTE ===', 'bright');
log('This script uses the exec_sql RPC function.', 'yellow');
log('If this function doesn\'t exist, you\'ll need to create it first:', 'yellow');
console.log(`
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`);
log('\nAlternatively, you can execute the migration SQL directly in the Supabase SQL editor.', 'cyan');

// Run the script
main().catch(console.error);