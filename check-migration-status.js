// Check migration status using MCP SQL standard
import { createClient } from '@supabase/supabase-js';

// Use service role key for admin operations
const supabaseUrl = 'https://onehealthnamibia.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZWhlYWx0aG5hbWliaWEiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzMwNzIyMjcwLCJleHAiOjIwNDYyOTgyNzB9.VazVCl8PM8SdpCk-S5kJRXZGHLIFWYR3Hb0z3lKd5Yc';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStatus() {
  console.log('📊 Checking migration status using MCP SQL...');
  
  try {
    // Check appointments count
    const appointmentQuery = `
      SELECT COUNT(*) as count FROM appointments;
    `;
    
    const { data: aptResult, error: aptError } = await supabase.rpc('exec_raw_sql', {
      sql_query: appointmentQuery
    });

    // Check visits count
    const visitQuery = `
      SELECT COUNT(*) as count FROM visits;
    `;
    
    const { data: visitResult, error: visitError } = await supabase.rpc('exec_raw_sql', {
      sql_query: visitQuery
    });

    // Check migrated visits (with scheduled_date)
    const migratedQuery = `
      SELECT COUNT(*) as count FROM visits WHERE scheduled_date IS NOT NULL;
    `;
    
    const { data: migratedResult, error: migratedError } = await supabase.rpc('exec_raw_sql', {
      sql_query: migratedQuery
    });

    console.log('\n📈 Current Status:');
    console.log(`   • Appointments: ${aptResult || 'Error checking'}`);
    console.log(`   • Total Visits: ${visitResult || 'Error checking'}`);
    console.log(`   • Migrated Visits: ${migratedResult || 'Error checking'}`);

    if (aptError) console.log('❌ Appointment check error:', aptError);
    if (visitError) console.log('❌ Visit check error:', visitError);
    if (migratedError) console.log('❌ Migrated visit check error:', migratedError);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function runMigration() {
  console.log('🚀 Starting migration using MCP SQL...');
  
  try {
    // First, fetch all appointments
    const fetchQuery = `
      SELECT * FROM appointments ORDER BY date, time;
    `;
    
    const { data: appointments, error: fetchError } = await supabase.rpc('exec_raw_sql', {
      sql_query: fetchQuery
    });

    if (fetchError) {
      console.error('❌ Error fetching appointments:', fetchError);
      return;
    }

    console.log('📋 Appointments fetched:', appointments);

    // Create a migration query to insert visits
    const migrationQuery = `
      INSERT INTO visits (
        patient_id, doctor_id, visit_date, visit_time, visit_type,
        status, notes, practice_id, created_at, updated_at,
        is_scheduled, is_confirmed, is_ready, is_checked_in, is_cancelled,
        scheduled_date, scheduled_time, chief_complaint
      )
      SELECT 
        patient_id,
        doctor_id,
        date as visit_date,
        time as visit_time,
        COALESCE(type, 'consultation') as visit_type,
        CASE 
          WHEN status IN ('scheduled', 'confirmed', 'pending') THEN 'scheduled'
          ELSE status
        END as status,
        notes,
        practice_id,
        created_at,
        updated_at,
        -- Scheduling flags
        CASE WHEN status IN ('scheduled', 'pending', 'confirmed', 'ready', 'in-progress', 'completed') THEN true ELSE false END as is_scheduled,
        CASE WHEN status IN ('scheduled', 'confirmed', 'ready', 'in-progress', 'completed') THEN true ELSE false END as is_confirmed,
        CASE WHEN status = 'ready' THEN true ELSE false END as is_ready,
        CASE WHEN status IN ('ready', 'in-progress', 'completed') THEN true ELSE false END as is_checked_in,
        CASE WHEN status = 'cancelled' THEN true ELSE false END as is_cancelled,
        date as scheduled_date,
        time as scheduled_time,
        COALESCE(notes, 'Migrated from appointments') as chief_complaint
      FROM appointments
      WHERE NOT EXISTS (
        SELECT 1 FROM visits v 
        WHERE v.patient_id = appointments.patient_id 
        AND v.scheduled_date = appointments.date 
        AND v.scheduled_time = appointments.time
      );
    `;

    const { data: migrationResult, error: migrationError } = await supabase.rpc('exec_raw_sql', {
      sql_query: migrationQuery
    });

    if (migrationError) {
      console.error('❌ Migration error:', migrationError);
      return;
    }

    console.log('✅ Migration completed:', migrationResult);

    // Verify the migration
    await checkStatus();

  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

// Run based on command line argument
const command = process.argv[2];

switch (command) {
  case 'migrate':
    runMigration();
    break;
  case 'status':
    checkStatus();
    break;
  default:
    console.log('Usage: node check-migration-status.js [migrate|status]');
    break;
}