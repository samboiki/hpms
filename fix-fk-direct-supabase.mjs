import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.jjxlfunlbyayxwvlpgwt',
  password: 'sbp_06ebe645acd5e8acbdf6adb17c635f317268ab0f',
  ssl: { rejectUnauthorized: false }
});

async function fixFK() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Drop old constraint
    console.log('🔧 Dropping old FK constraint...');
    await client.query('ALTER TABLE bed_allocations DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey CASCADE;');
    console.log('✅ Old constraint dropped');

    // Add new constraint to beds table
    console.log('🔧 Adding new FK constraint to beds table...');
    await client.query(`
      ALTER TABLE bed_allocations 
      ADD CONSTRAINT bed_allocations_bed_id_fkey 
      FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE;
    `);
    console.log('✅ New constraint added!');

    console.log('\n🎉 SUCCESS! bed_allocations now points to beds table!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

fixFK();
