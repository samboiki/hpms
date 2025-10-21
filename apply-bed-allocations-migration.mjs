import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

// Connection string for Supabase (using transaction pooler on port 6543)
const connectionString = 'postgresql://postgres.jjxlfunlbyayxwvlpgwt:Farma2025!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

async function applyMigration() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read the migration file
    const migrationPath = './supabase/migrations/20250130_fix_bed_allocations_fk.sql';
    console.log('📖 Reading migration file...\n');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔍 Step 1: Checking current constraints on bed_allocations.bed_id...\n');

    const checkQuery = `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name='bed_allocations'
        AND kcu.column_name='bed_id'
    `;

    const beforeResult = await client.query(checkQuery);
    console.log('Current constraints:');
    console.table(beforeResult.rows);

    console.log('\n🚀 Executing migration...\n');

    // Split migration into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await client.query(statement);
      }
    }

    console.log('\n✅ Migration executed successfully!\n');

    console.log('✅ Step 4: Verifying the new constraint...\n');

    const afterResult = await client.query(checkQuery);
    console.log('New constraints:');
    console.table(afterResult.rows);

    console.log('\n🎉 Foreign key constraint fix completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Dropped old constraint: bed_allocations_bed_id_fkey (if existed)');
    console.log('- Added new constraint: bed_allocations_bed_id_fkey');
    console.log('- New target table: beds (was: hospital_beds or unknown)');
    console.log('- Delete behavior: CASCADE');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed.');
  }
}

applyMigration();
