#!/usr/bin/env node

import pg from 'pg';

// 🔑 CONFIGURATION - Direct connection string format like bolt.new uses
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function addEncounterDateField() {
  console.log('🚀 Adding encounter_date field to visits table...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    // Add encounter_date field to visits table
    const addColumnSql = `
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'visits' AND column_name = 'encounter_date'
        ) THEN
          ALTER TABLE visits ADD COLUMN encounter_date TIMESTAMP WITH TIME ZONE;
          COMMENT ON COLUMN visits.encounter_date IS 'Date and time when the encounter occurred';
          RAISE NOTICE 'Added encounter_date column to visits table';
        ELSE
          RAISE NOTICE 'encounter_date column already exists in visits table';
        END IF;
      END $$;
    `;

    console.log('📋 Adding encounter_date field...');
    await client.query(addColumnSql);
    console.log('✅ encounter_date field processed!\n');

    // Update existing visits to set encounter_date based on visit_date and visit_time
    const updateExistingSql = `
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
    const updateResult = await client.query(updateExistingSql);
    console.log(`✅ Updated ${updateResult.rowCount} existing visits with encounter_date\n`);

    // Verify the field was added
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'visits' AND column_name = 'encounter_date';
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log(`   • Column: ${verifyResult.rows[0].column_name}`);
      console.log(`   • Type: ${verifyResult.rows[0].data_type}`);
      console.log(`   • Nullable: ${verifyResult.rows[0].is_nullable}\n`);
      
      // Show a sample of updated data
      const sampleResult = await client.query(`
        SELECT id, visit_date, visit_time, encounter_date 
        FROM visits 
        WHERE encounter_date IS NOT NULL 
        LIMIT 3;
      `);
      
      if (sampleResult.rows.length > 0) {
        console.log('📊 Sample data:');
        sampleResult.rows.forEach((row, index) => {
          console.log(`   ${index + 1}. Visit ${row.id.substring(0, 8)}... | Date: ${row.visit_date} | Time: ${row.visit_time} | Encounter: ${row.encounter_date}`);
        });
      }
    } else {
      console.log('❌ Field not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 To fix this:');
    console.log('   1. Check database connection');
    console.log('   2. Verify database password');
    console.log('   3. Run again');
  } finally {
    await client.end();
    console.log('\n🎉 Database connection closed');
  }
}

// Execute the migration
try {
  await addEncounterDateField();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Installing pg module...');
    console.log('Run: npm install pg');
    console.log('Then run this script again');
  } else {
    console.error('Error:', error.message);
  }
}