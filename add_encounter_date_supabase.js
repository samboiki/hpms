import { createClient } from '@supabase/supabase-js';

// Use service role for administrative operations
const serviceClient = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function addEncounterDateField() {
  console.log('🚀 Adding encounter_date field to visits table...\n');
  
  try {
    // First, let's check if the column already exists by examining the table structure
    const { data: sampleVisit, error: sampleError } = await serviceClient
      .from('visits')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.log('❌ Error accessing visits table:', sampleError.message);
      return;
    }
    
    if (sampleVisit && sampleVisit.length > 0) {
      const existingColumns = Object.keys(sampleVisit[0]);
      console.log('📋 Current visits table columns:');
      existingColumns.forEach((col, idx) => {
        console.log(`  ${idx + 1}. ${col}`);
      });
      
      if (existingColumns.includes('encounter_date')) {
        console.log('\n✅ encounter_date field already exists!');
        return;
      } else {
        console.log('\n⚠️ encounter_date field does not exist, need to add it via SQL');
      }
    }
    
    // Execute SQL to add the column
    const addColumnSql = `
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'visits' AND column_name = 'encounter_date'
        ) THEN
          ALTER TABLE visits ADD COLUMN encounter_date TIMESTAMP WITH TIME ZONE;
          COMMENT ON COLUMN visits.encounter_date IS 'Date and time when the encounter occurred';
        END IF;
      END $$;
    `;

    console.log('📋 Executing SQL to add encounter_date field...');
    const { data: sqlResult, error: sqlError } = await serviceClient.rpc('exec_sql', {
      sql: addColumnSql
    });

    if (sqlError) {
      console.log('❌ SQL execution failed:', sqlError.message);
      
      // Try a different approach - using direct SQL execution if available
      console.log('\n🔄 Trying alternative method...');
      
      // Create a migration file that can be run manually
      console.log('\n📝 Manual SQL to run in Supabase SQL Editor:');
      console.log('----------------------------------------');
      console.log(addColumnSql);
      console.log('----------------------------------------');
      
      // Also try to set encounter_date from existing fields for new visits
      const updateSql = `
        UPDATE visits 
        SET encounter_date = (
          CASE 
            WHEN visit_time IS NOT NULL THEN 
              (visit_date::text || ' ' || visit_time::text)::timestamp with time zone
            ELSE 
              (visit_date::text || ' 09:00:00')::timestamp with time zone
          END
        )
        WHERE encounter_date IS NULL AND visit_date IS NOT NULL;
      `;
      
      console.log('\nThen run this to populate existing data:');
      console.log('----------------------------------------');
      console.log(updateSql);
      console.log('----------------------------------------');
      
      return;
    }

    console.log('✅ encounter_date field added successfully!\n');

    // Now update existing visits to populate encounter_date
    const updateSql = `
      UPDATE visits 
      SET encounter_date = (
        CASE 
          WHEN visit_time IS NOT NULL THEN 
            (visit_date::text || ' ' || visit_time::text)::timestamp with time zone
          ELSE 
            (visit_date::text || ' 09:00:00')::timestamp with time zone
        END
      )
      WHERE encounter_date IS NULL AND visit_date IS NOT NULL;
    `;

    console.log('🔄 Updating existing visits with encounter_date...');
    const { data: updateResult, error: updateError } = await serviceClient.rpc('exec_sql', {
      sql: updateSql
    });

    if (updateError) {
      console.log('❌ Update failed:', updateError.message);
      console.log('\n📝 Manual SQL to run for updating existing data:');
      console.log('----------------------------------------');
      console.log(updateSql);
      console.log('----------------------------------------');
    } else {
      console.log('✅ Existing visits updated successfully!\n');
    }

    // Verify the field was added by checking a sample record again
    const { data: verifyVisit, error: verifyError } = await serviceClient
      .from('visits')
      .select('id, visit_date, visit_time, encounter_date')
      .limit(3);
    
    if (verifyError) {
      console.log('❌ Verification failed:', verifyError.message);
    } else if (verifyVisit && verifyVisit.length > 0) {
      console.log('✅ Verification successful! Sample data:');
      verifyVisit.forEach((visit, index) => {
        console.log(`  ${index + 1}. Visit ${visit.id.substring(0, 8)}... | Date: ${visit.visit_date} | Time: ${visit.visit_time} | Encounter: ${visit.encounter_date}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 Manual steps:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Run the SQL provided above');
    console.log('   3. Verify the field was added');
  }
}

// Execute the migration
addEncounterDateField();