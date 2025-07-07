const { Client } = require('pg');

async function addEncounterDateField() {
  const client = new Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

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
        END IF;
      END $$;
    `;

    await client.query(addColumnSql);
    console.log('✅ Successfully added encounter_date field to visits table');

    // Update existing visits to set encounter_date based on visit_date and visit_time
    const updateExistingSql = `
      UPDATE visits 
      SET encounter_date = (visit_date::text || ' ' || COALESCE(visit_time::text, '09:00:00'))::timestamp with time zone
      WHERE encounter_date IS NULL AND visit_date IS NOT NULL;
    `;

    const updateResult = await client.query(updateExistingSql);
    console.log(`✅ Updated ${updateResult.rowCount} existing visits with encounter_date`);

    // Verify the field was added
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'visits' AND column_name = 'encounter_date';
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log('Column details:', verifyResult.rows[0]);
    } else {
      console.log('❌ Field not found after creation');
    }

  } catch (error) {
    console.error('❌ Error adding encounter_date field:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

// Run the migration
addEncounterDateField()
  .then(() => {
    console.log('🎉 Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });