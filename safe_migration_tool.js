import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import fs from 'fs';

// Database credentials
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkTable(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return { exists: false, count: 0, error: error.message };
    } else {
      return { exists: true, count: count || 0, error: null };
    }
  } catch (err) {
    return { exists: false, count: 0, error: err.message };
  }
}

async function checkColumn(tableName, columnName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(1);
    
    if (error && (error.message.includes(columnName) || error.code === '42703')) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function verifyCurrentState() {
  log('\n=== DATABASE VERIFICATION ===', 'bright');
  
  const tables = ['practices', 'users', 'patients', 'appointments', 'visits', 'medical_records'];
  const tableStatus = {};
  
  log('\n📋 Table Status:', 'cyan');
  
  for (const table of tables) {
    const status = await checkTable(table);
    tableStatus[table] = status;
    
    if (status.exists) {
      log(`  ✓ ${table} (${status.count} rows)`, 'green');
    } else {
      log(`  ✗ ${table} - ${status.error}`, 'red');
    }
  }
  
  // Check specific columns
  log('\n🔍 Column Analysis:', 'cyan');
  
  if (tableStatus.users?.exists) {
    const hasPracticeId = await checkColumn('users', 'practice_id');
    log(`  ${hasPracticeId ? '✓' : '✗'} users.practice_id`, hasPracticeId ? 'green' : 'yellow');
  }
  
  if (tableStatus.patients?.exists) {
    const hasPracticeId = await checkColumn('patients', 'practice_id');
    log(`  ${hasPracticeId ? '✓' : '✗'} patients.practice_id`, hasPracticeId ? 'green' : 'yellow');
  }
  
  if (tableStatus.appointments?.exists) {
    const hasPracticeId = await checkColumn('appointments', 'practice_id');
    const hasReadyStatus = await checkColumn('appointments', 'ready_status');
    log(`  ${hasPracticeId ? '✓' : '✗'} appointments.practice_id`, hasPracticeId ? 'green' : 'yellow');
    log(`  ${hasReadyStatus ? '✓' : '✗'} appointments.ready_status`, hasReadyStatus ? 'green' : 'yellow');
  }
  
  // Check practices data
  if (tableStatus.practices?.exists && tableStatus.practices.count > 0) {
    log('\n🏥 Existing Practices:', 'cyan');
    try {
      const { data: practices, error } = await supabase
        .from('practices')
        .select('id, name, slug')
        .order('name');
      
      if (!error && practices) {
        practices.forEach(practice => {
          console.log(`  - ${practice.name} (${practice.slug}) - ID: ${practice.id}`);
        });
      }
    } catch (err) {
      log('  Unable to fetch practice details', 'red');
    }
  }
  
  return tableStatus;
}

async function analyzeDataDistribution() {
  log('\n📊 Data Distribution Analysis:', 'cyan');
  
  try {
    // Check patients by practice
    const { data: patientsByPractice, error: patientsError } = await supabase
      .from('patients')
      .select('practice_id')
      .not('practice_id', 'is', null);
    
    if (!patientsError && patientsByPractice) {
      const practiceGroups = patientsByPractice.reduce((acc, p) => {
        acc[p.practice_id] = (acc[p.practice_id] || 0) + 1;
        return acc;
      }, {});
      
      log('  Patients by practice:', 'yellow');
      Object.entries(practiceGroups).forEach(([practiceId, count]) => {
        console.log(`    Practice ${practiceId}: ${count} patients`);
      });
    }
    
    // Check patients without practice_id
    const { count: orphanPatients, error: orphanError } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .is('practice_id', null);
    
    if (!orphanError) {
      if (orphanPatients > 0) {
        log(`  ⚠️ ${orphanPatients} patients without practice_id`, 'yellow');
      } else {
        log('  ✓ All patients have practice_id assigned', 'green');
      }
    }
    
  } catch (err) {
    log('  Unable to analyze data distribution', 'red');
  }
}

async function showMigrationPlan() {
  log('\n=== MIGRATION PLAN ===', 'bright');
  
  // Check what migrations are needed
  const appointmentsHasReadyStatus = await checkColumn('appointments', 'ready_status');
  
  const migrationsNeeded = [];
  
  if (!appointmentsHasReadyStatus) {
    migrationsNeeded.push({
      file: '20250602_add_ready_status.sql',
      description: 'Add ready_status column to appointments table',
      changes: [
        'Add ready_status ENUM column to appointments',
        'Set default value to \'not_ready\'',
        'Update existing appointments to \'not_ready\' status'
      ]
    });
  }
  
  if (migrationsNeeded.length === 0) {
    log('✅ No migrations needed! Database is up to date.', 'green');
    return false;
  }
  
  log('📋 Migrations to apply:', 'cyan');
  migrationsNeeded.forEach((migration, index) => {
    log(`\n${index + 1}. ${migration.file}`, 'yellow');
    log(`   ${migration.description}`, 'reset');
    log('   Changes:', 'blue');
    migration.changes.forEach(change => {
      console.log(`   - ${change}`);
    });
  });
  
  return migrationsNeeded;
}

async function createBackup() {
  log('\n=== CREATING BACKUP ===', 'bright');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `/home/happy/projects/hpms/backup_${timestamp}.sql`;
  
  // Create a simple backup of current schema
  const backupSQL = `-- Database backup created on ${new Date().toISOString()}
-- This is a basic backup of key table structures

-- To restore, you would need to manually recreate the structure
-- This backup is mainly for reference

-- Current database state:
-- Tables exist: practices, users, patients, appointments, visits, medical_records, vitals, lab_requests, medical_aid_details, messages, lab_results
-- Appointments table ready_status column: ${await checkColumn('appointments', 'ready_status') ? 'EXISTS' : 'MISSING'}

-- Note: Use Supabase dashboard for full database backups
-- This is just a schema reference backup
`;
  
  fs.writeFileSync(backupFile, backupSQL);
  log(`✓ Basic backup created: ${backupFile}`, 'green');
  log('💡 For full backups, use Supabase dashboard or pg_dump', 'yellow');
  
  return backupFile;
}

async function executeMigrations(migrations) {
  log('\n=== EXECUTING MIGRATIONS ===', 'bright');
  
  for (const migration of migrations) {
    log(`\n🔧 Applying ${migration.file}...`, 'cyan');
    
    try {
      // Read migration file
      const migrationPath = `/home/happy/projects/hpms/supabase/migrations/${migration.file}`;
      
      if (!fs.existsSync(migrationPath)) {
        log(`❌ Migration file not found: ${migrationPath}`, 'red');
        continue;
      }
      
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // For this demo, we'll show what would be executed
      log('📄 Migration content preview:', 'yellow');
      const preview = migrationSQL.substring(0, 300) + (migrationSQL.length > 300 ? '...' : '');
      console.log(preview);
      
      log('\n⚠️ This tool cannot execute raw SQL migrations safely.', 'yellow');
      log('To apply this migration:', 'cyan');
      log(`1. Open Supabase SQL Editor: ${SUPABASE_URL.replace('https://', 'https://app.')}/sql`, 'blue');
      log(`2. Copy and paste the content from: ${migrationPath}`, 'blue');
      log('3. Execute the SQL manually', 'blue');
      log('4. Come back and run this verification tool again', 'blue');
      
    } catch (err) {
      log(`❌ Error reading migration: ${err.message}`, 'red');
    }
  }
}

async function createRollbackScript() {
  log('\n=== CREATING ROLLBACK SCRIPT ===', 'bright');
  
  const rollbackSQL = `-- Rollback script for ready_status migration
-- WARNING: This will remove the ready_status column from appointments table

BEGIN;

-- Remove ready_status column from appointments table
ALTER TABLE appointments DROP COLUMN IF EXISTS ready_status;

-- Add any other rollback operations here

COMMIT;

-- Note: Execute this script in Supabase SQL Editor if you need to rollback
`;

  const rollbackFile = '/home/happy/projects/hpms/rollback_ready_status.sql';
  fs.writeFileSync(rollbackFile, rollbackSQL);
  
  log(`✓ Rollback script created: ${rollbackFile}`, 'green');
  log('💡 Use this script if you need to undo the migration', 'yellow');
}

async function main() {
  log('=== SAFE DATABASE MIGRATION TOOL ===', 'bright');
  log(`🔗 Database: ${SUPABASE_URL}`, 'cyan');
  log('📅 ' + new Date().toISOString(), 'blue');
  
  // Step 1: Verify current state
  const tableStatus = await verifyCurrentState();
  
  // Step 2: Analyze data distribution
  await analyzeDataDistribution();
  
  // Step 3: Show migration plan
  const migrationsNeeded = await showMigrationPlan();
  
  if (!migrationsNeeded || migrationsNeeded.length === 0) {
    log('\n🎉 Database is up to date! No migrations needed.', 'green');
    rl.close();
    return;
  }
  
  // Step 4: Get user confirmation
  log('\n=== USER CONFIRMATION ===', 'bright');
  const proceed = await question('\nDo you want to proceed with showing migration instructions? (yes/no): ');
  
  if (proceed.toLowerCase() !== 'yes') {
    log('\n❌ Migration cancelled by user.', 'yellow');
    rl.close();
    return;
  }
  
  // Step 5: Create backup
  await createBackup();
  
  // Step 6: Create rollback script
  await createRollbackScript();
  
  // Step 7: Show migration instructions
  await executeMigrations(migrationsNeeded);
  
  log('\n=== NEXT STEPS ===', 'bright');
  log('1. Apply the migrations in Supabase SQL Editor', 'cyan');
  log('2. Run this tool again to verify changes', 'cyan');
  log('3. Test your application to ensure everything works', 'cyan');
  log('4. Keep the rollback script safe in case of issues', 'cyan');
  
  log('\n✅ Migration planning complete!', 'green');
  
  rl.close();
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error);
  rl.close();
  process.exit(1);
});

// Run the tool
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  rl.close();
  process.exit(1);
});