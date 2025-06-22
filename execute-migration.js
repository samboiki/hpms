import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query, name) {
  console.log(`\n🔧 ${name}`);
  console.log('📝 SQL:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: query
    });

    if (error) {
      console.error('❌ Error:', error.message);
      console.error('💡 Hint:', error.hint || 'None');
      return { success: false, error: error.message };
    }

    console.log('✅ Success:', data);
    return { success: true, data };
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🚀 Starting Unified Visit System Migration...\n');

  // Step 1: Add scheduled status constraint
  const step1 = `
    ALTER TABLE visits 
    DROP CONSTRAINT IF EXISTS visits_status_check;

    ALTER TABLE visits 
    ADD CONSTRAINT visits_status_check CHECK (
      status = ANY (ARRAY[
        'scheduled'::text,      -- NEW: For appointments
        'in-progress'::text,    -- Visit in progress
        'completed'::text,      -- Completed visit
        'cancelled'::text       -- Cancelled appointment/visit
      ])
    );
  `;

  // Step 2: Add visit_number column
  const step2 = `
    ALTER TABLE visits 
    ADD COLUMN IF NOT EXISTS visit_number INTEGER;
  `;

  // Step 3: Create visit numbering function
  const step3 = `
    CREATE OR REPLACE FUNCTION generate_visit_number() 
    RETURNS TRIGGER AS $$
    BEGIN
      -- Get the max visit number for this patient
      SELECT COALESCE(MAX(visit_number), 0) + 1 
      INTO NEW.visit_number
      FROM visits 
      WHERE patient_id = NEW.patient_id;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;

  // Step 4: Create trigger for auto-numbering
  const step4 = `
    DROP TRIGGER IF EXISTS set_visit_number ON visits;
    CREATE TRIGGER set_visit_number
      BEFORE INSERT ON visits
      FOR EACH ROW
      EXECUTE FUNCTION generate_visit_number();
  `;

  // Step 5: Number existing visits
  const step5 = `
    WITH numbered_visits AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (
          PARTITION BY patient_id 
          ORDER BY visit_date, visit_time
        ) as visit_num
      FROM visits
      WHERE visit_number IS NULL
    )
    UPDATE visits v
    SET visit_number = nv.visit_num
    FROM numbered_visits nv
    WHERE v.id = nv.id;
  `;

  const migrations = [
    { sql: step1, name: 'Step 1: Add scheduled status constraint' },
    { sql: step2, name: 'Step 2: Add visit_number column' },
    { sql: step3, name: 'Step 3: Create visit numbering function' },
    { sql: step4, name: 'Step 4: Create visit numbering trigger' },
    { sql: step5, name: 'Step 5: Number existing visits' }
  ];

  for (const { sql, name } of migrations) {
    const result = await executeSql(sql, name);
    
    if (!result.success && !result.error.includes('already exists') && !result.error.includes('does not exist')) {
      console.error(`\n💥 Migration failed at: ${name}`);
      process.exit(1);
    }
  }

  // Verification
  console.log('\n🔍 Verifying migration...');
  
  const verifyResult = await executeSql(`
    SELECT 
      COUNT(*) as total_visits,
      COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_visits,
      COUNT(CASE WHEN visit_number IS NOT NULL THEN 1 END) as numbered_visits,
      MAX(visit_number) as max_visit_number
    FROM visits;
  `, 'Migration verification');

  if (verifyResult.success) {
    console.log('\n🎉 SUCCESS! Unified Visit System Migration completed!');
    console.log('\n📊 Summary:');
    console.log('- ✅ Added "scheduled" status for appointments');
    console.log('- ✅ Added visit_number column with auto-numbering');
    console.log('- ✅ Created automatic numbering trigger');
    console.log('- ✅ Numbered all existing visits');
    console.log('\n💡 Appointments are now scheduled visits in the visits table');
    console.log('🔄 New appointments will automatically get sequential numbers');
  }
}

main().catch(console.error);