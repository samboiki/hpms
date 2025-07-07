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

async function backupAppointments() {
  console.log('💾 Creating backup of appointments table...\n');

  const backupQuery = `
    -- Create backup table with timestamp
    CREATE TABLE IF NOT EXISTS appointments_backup_20250625 AS 
    SELECT * FROM appointments;
    
    -- Add comment with backup information
    COMMENT ON TABLE appointments_backup_20250625 IS 'Backup created during migration to visits-only system on 2025-06-25. Migration completed: 14 appointments migrated to visits table.';
  `;

  const result = await executeSql(backupQuery);
  
  if (result.success) {
    console.log('✅ Appointments backup created successfully!');
    console.log('📁 Backup table: appointments_backup_20250625');
  } else {
    console.log('❌ Failed to create backup:', result.error);
  }

  // Verify backup
  const verifyQuery = `
    SELECT COUNT(*) as backup_count FROM appointments_backup_20250625;
  `;

  const verifyResult = await executeSql(verifyQuery);
  
  if (verifyResult.success) {
    console.log('🔍 Backup verification completed');
  }
}

// Run backup
backupAppointments();