import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('🔗 MCP SQL Executor');
  console.log('📝 Executing SQL query');
  console.log('🗂️  SQL:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: query
    });

    if (error) {
      console.error('❌ SQL execution failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    return { success: true, data };
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

async function checkMigrationStatus() {
  console.log('📊 Checking migration status...\n');

  // Check appointments count
  const appointmentCountQuery = `SELECT COUNT(*) as appointment_count FROM appointments;`;
  const appointmentResult = await executeSql(appointmentCountQuery);

  // Check visits count
  const visitCountQuery = `SELECT COUNT(*) as visit_count FROM visits;`;
  const visitResult = await executeSql(visitCountQuery);

  // Check migrated visits (with scheduled_date)
  const migratedVisitQuery = `SELECT COUNT(*) as migrated_count FROM visits WHERE scheduled_date IS NOT NULL;`;
  const migratedResult = await executeSql(migratedVisitQuery);

  // Check unconfirmed bookings
  const unconfirmedQuery = `SELECT COUNT(*) as unconfirmed_count FROM visits WHERE is_scheduled = true AND is_confirmed = false AND is_cancelled = false;`;
  const unconfirmedResult = await executeSql(unconfirmedQuery);

  console.log('\n📈 Migration Status Summary:');
  console.log(`   • Appointments in system: ${appointmentResult.success ? 'Checked' : 'Error'}`);
  console.log(`   • Total visits in system: ${visitResult.success ? 'Checked' : 'Error'}`);
  console.log(`   • Migrated visits (with scheduled dates): ${migratedResult.success ? 'Checked' : 'Error'}`);
  console.log(`   • Unconfirmed bookings: ${unconfirmedResult.success ? 'Checked' : 'Error'}`);

  return {
    appointmentResult,
    visitResult,
    migratedResult,
    unconfirmedResult
  };
}

async function runMigration() {
  console.log('🚀 Starting appointments to visits migration...\n');

  // First check if we have any appointments to migrate
  const checkQuery = `SELECT COUNT(*) as count FROM appointments;`;
  const checkResult = await executeSql(checkQuery);

  if (!checkResult.success) {
    console.log('❌ Could not check appointments table');
    return;
  }

  // Run the migration query
  const migrationQuery = `
    INSERT INTO visits (
      patient_id, doctor_id, visit_date, visit_time, visit_type,
      status, notes, practice_id, created_at, updated_at,
      is_scheduled, is_confirmed, is_ready, is_checked_in, is_cancelled,
      scheduled_date, scheduled_time, chief_complaint, visit_number,
      follow_up_required
    )
    SELECT 
      a.patient_id,
      a.doctor_id,
      a.date as visit_date,
      a.time as visit_time,
      COALESCE(a.type, 'consultation') as visit_type,
      CASE 
        WHEN a.status IN ('scheduled', 'confirmed', 'pending') THEN 'scheduled'
        ELSE a.status
      END as status,
      a.notes,
      a.practice_id,
      a.created_at,
      a.updated_at,
      -- Scheduling flags
      CASE WHEN a.status IN ('scheduled', 'pending', 'confirmed', 'ready', 'in-progress', 'completed') THEN true ELSE false END as is_scheduled,
      CASE WHEN a.status IN ('scheduled', 'confirmed', 'ready', 'in-progress', 'completed') THEN true ELSE false END as is_confirmed,
      CASE WHEN a.status = 'ready' THEN true ELSE false END as is_ready,
      CASE WHEN a.status IN ('ready', 'in-progress', 'completed') THEN true ELSE false END as is_checked_in,
      CASE WHEN a.status = 'cancelled' THEN true ELSE false END as is_cancelled,
      a.date as scheduled_date,
      a.time as scheduled_time,
      COALESCE(a.notes, 'Migrated appointment') as chief_complaint,
      1 as visit_number,
      false as follow_up_required
    FROM appointments a
    WHERE NOT EXISTS (
      SELECT 1 FROM visits v 
      WHERE v.patient_id = a.patient_id 
      AND v.scheduled_date = a.date 
      AND v.scheduled_time = a.time
    );
  `;

  console.log('💾 Executing migration query...');
  const migrationResult = await executeSql(migrationQuery);

  if (!migrationResult.success) {
    console.log('❌ Migration failed');
    return;
  }

  console.log('✅ Migration completed successfully!');

  // Verify the migration
  console.log('\n🔍 Verifying migration...');
  await checkMigrationStatus();

  console.log('\n🎯 Next Steps:');
  console.log('   1. Test the new visits-based components in the application');
  console.log('   2. Verify real-time updates work correctly');
  console.log('   3. Update any remaining appointment references');
  console.log('   4. Once confident, consider creating backup and removing appointments table');
}

// Run based on command line argument
const command = process.argv[2];

switch (command) {
  case 'migrate':
    runMigration();
    break;
  case 'status':
    checkMigrationStatus();
    break;
  default:
    console.log('Usage: node migration-check.js [migrate|status]');
    console.log('  migrate - Run the appointments to visits migration');
    console.log('  status  - Check current migration status');
    break;
}